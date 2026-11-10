\set ON_ERROR_STOP on
-- Run after retention-migration-order-smoke.sql in a disposable database.
\ir ../../supabase/migrations/202611090024_retention_creation_cohort.sql

do $test$
declare
  owner_id_fixture constant uuid := '88888888-8888-4888-8888-888888888888';
  old_live constant uuid := '99999999-9999-4999-8999-999999999999';
  old_v2 uuid;
  old_draft uuid;
  fresh uuid;
  manual_new uuid;
  legacy_manual uuid;
  job_id uuid;
  token uuid;
  path text;
  legacy_expiry timestamptz;
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  if exists(select 1 from public.events where retention_delete_eligible)
     or (select enroll_new_events from public.invitation_retention_creation_gate) then
    raise exception 'Existing rows or disabled gate classified as eligible';
  end if;
  select id into strict old_v2 from public.events where slug='new-policy-fixture';
  -- Move only a synthetic, already v2 row past the deadline.
  alter table public.events disable trigger enforce_event_start_edit_lock;
  update public.events set starts_at=now()-interval '40 days' where id=old_v2;
  update public.events set starts_at=now()+interval '2 days' where id=old_live;
  alter table public.events enable trigger enforce_event_start_edit_lock;
  select service_expires_at into legacy_expiry from public.events where id=old_live;
  update public.events set title='Legacy edit', status='suspended' where id=old_live;
  update public.events set status='published', retention_delete_eligible=true where id=old_live;
  if not exists(select 1 from public.events where id=old_live and not retention_v2 and not retention_delete_eligible and service_expires_at is not distinct from legacy_expiry) then
    raise exception 'Legacy re-publication changed cohort';
  end if;

  insert into public.events(owner_id,kind,status,slug,title,starts_at,retention_delete_eligible)
    values(owner_id_fixture,'wedding','draft','cohort-old-draft','Fixture',now()+interval '2 days',true)
    returning id into old_draft;
  update public.invitation_retention_creation_gate set enroll_new_events=true where singleton;
  update public.events set status='published',published_at=now(),retention_delete_eligible=true where id=old_draft;
  if exists(select 1 from public.events where id=old_draft and (retention_v2 or retention_delete_eligible))
    then raise exception 'Pre-cutover draft became eligible'; end if;

  if not exists(select 1 from public.events where id=old_v2 and retention_v2 and not retention_delete_eligible)
     or public.reconcile_invitation_deletion_schedule(array[old_v2])<>0 then
    raise exception 'Existing v2 event lost protection';
  end if;
  insert into public.invitation_deletion_jobs(event_id,owner_id,due_at)
    select id,owner_id,public.event_retention_deadline_kst(starts_at) from public.events where id=old_v2 returning id into job_id;
  select claim_token into token from public.claim_invitation_deletion_job(job_id,10);
  if token is null or public.finalize_invitation_deletion(job_id,token,'[]') then
    raise exception 'Stale job bypassed cohort fence';
  end if;

  insert into public.events(owner_id,kind,status,slug,title,starts_at,retention_delete_eligible)
    values(owner_id_fixture,'wedding','paid','cohort-new','Fixture',now()+interval '2 days',false)
    returning id into fresh;
  update public.events set status='published',published_at=now(),retention_delete_eligible=false where id=fresh;
  if not exists(select 1 from public.events where id=fresh and retention_delete_eligible and retention_v2
    and service_expires_at=public.event_retention_deadline_kst(starts_at)) then
    raise exception 'Post-cutover first publication did not set retention policy';
  end if;

  -- Both manual modes must still delete the database row.
  legacy_manual := old_draft;
  path := owner_id_fixture||'/photo/'||legacy_manual||'/cccccccc-cccc-4ccc-8ccc-cccccccccccc.jpg';
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path,status)
    values(legacy_manual,owner_id_fixture,'invitation-photos',path,'uploaded');
  if not public.delete_invitation_with_cleanup(legacy_manual,owner_id_fixture,
       (select updated_at from public.events where id=legacy_manual),'[]') then
    raise exception 'Legacy manual deletion failed';
  end if;
  if exists(select 1 from public.invitation_storage_cleanup_jobs where event_id=legacy_manual) then
    raise exception 'Legacy manual deletion enqueued physical cleanup';
  end if;
  insert into public.events(owner_id,kind,status,slug,title)
    values(owner_id_fixture,'wedding','draft','cohort-new-manual','Fixture') returning id into manual_new;
  path := owner_id_fixture||'/photo/'||manual_new||'/dddddddd-dddd-4ddd-8ddd-dddddddddddd.jpg';
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path,status)
    values(manual_new,owner_id_fixture,'invitation-photos',path,'uploaded');
  if not public.delete_invitation_with_cleanup(manual_new,owner_id_fixture,
       (select updated_at from public.events where id=manual_new),'[]') then
    raise exception 'Eligible manual deletion failed';
  end if;
  if not exists(select 1 from public.invitation_storage_cleanup_jobs where event_id=manual_new and storage_path=path)
     or not exists(select 1 from public.invitation_deletion_audit where event_id=manual_new and storage_cleanup_eligible) then
    raise exception 'Eligible manual deletion did not persist cleanup provenance';
  end if;

  alter table public.events disable trigger enforce_event_start_edit_lock;
  update public.events set starts_at=now()-interval '40 days' where id=fresh;
  alter table public.events enable trigger enforce_event_start_edit_lock;
  if public.reconcile_invitation_deletion_schedule(array[fresh])<>1 then
    raise exception 'New v2 event was not enrolled';
  end if;
  select id into job_id from public.invitation_deletion_jobs where event_id=fresh;
  select claim_token into token from public.claim_invitation_deletion_job(job_id,10);
  if token is null or not public.finalize_invitation_deletion(job_id,token,'[]') then
    raise exception 'New v2 event did not finalize';
  end if;
  if not exists(select 1 from public.invitation_deletion_audit where event_id=fresh and storage_cleanup_eligible) then
    raise exception 'New v2 event did not finalize';
  end if;
  raise notice 'PASS creation cohort, legacy protection, manual and automatic deletion';
end;
$test$;
