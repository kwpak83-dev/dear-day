\set ON_ERROR_STOP on
-- Disposable CI database only; executed after the reservation and retry fixtures.
create table public.event_media (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text
);
\ir ../../supabase/migrations/202611090008_cleanup_manifest_reconciliation.sql
\ir ../../supabase/migrations/202611090009_event_media_deletion_fence.sql
\ir ../../supabase/migrations/202611090010_cleanup_validation_hardening.sql
\ir ../../supabase/migrations/202611090013_collect_upload_reservations_on_deletion.sql

do $test$
declare
  owner uuid := '11111111-1111-4111-8111-111111111111';
  manual_id uuid := '88888888-8888-4888-8888-888888888888';
  conflict_id uuid := '99999999-9999-4999-8999-999999999999';
  auto_id uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  starts timestamptz := clock_timestamp()-interval '40 days';
  due timestamptz;
  job_id uuid;
  token uuid;
  updated timestamptz;
begin
  insert into public.events(id,owner_id,status) values(manual_id,owner,'draft');
  select updated_at into updated from public.events where id=manual_id;
  perform public.reserve_invitation_upload(manual_id,owner,'invitation-photos',owner::text||'/manual.jpg');
  if public.delete_invitation_with_cleanup(manual_id,owner,updated-interval '1 second','[]'::jsonb) then
    raise exception 'Stale updated_at permitted manual deletion';
  end if;
  if not public.delete_invitation_with_cleanup(manual_id,owner,updated,'[]'::jsonb) then
    raise exception 'Valid manual deletion failed';
  end if;
  if exists(select 1 from public.events where id=manual_id) then
    raise exception 'Manual deletion retained event';
  end if;
  if not exists(select 1 from public.invitation_storage_cleanup_jobs
    where event_id=manual_id and storage_path=owner::text||'/manual.jpg' and status='pending') then
    raise exception 'Manual deletion lost upload cleanup reservation';
  end if;
  if not exists(select 1 from public.invitation_deletion_audit
    where event_id=manual_id and outcome='completed') then
    raise exception 'Manual deletion audit missing';
  end if;

  insert into public.events(id,owner_id,status) values(conflict_id,owner,'draft');
  select updated_at into updated from public.events where id=conflict_id;
  perform public.reserve_invitation_upload(conflict_id,owner,'invitation-photos',owner::text||'/conflict.jpg');
  insert into public.invitation_storage_cleanup_jobs(event_id,owner_id,bucket,storage_path,status)
    values(manual_id,owner,'invitation-photos',owner::text||'/conflict.jpg','done');
  begin
    perform public.delete_invitation_with_cleanup(conflict_id,owner,updated,'[]'::jsonb);
    raise exception 'Conflicting cleanup ledger allowed deletion';
  exception when sqlstate '23514' then null;
  end;
  if not exists(select 1 from public.events where id=conflict_id) then
    raise exception 'Failed deletion did not roll back';
  end if;
  if exists(select 1 from public.invitation_deletion_audit where event_id=conflict_id) then
    raise exception 'Failed deletion wrote completion audit';
  end if;

  insert into public.events(id,owner_id,status,starts_at)
    values(auto_id,owner,'published',starts);
  due := (((starts at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul');
  insert into public.invitation_deletion_jobs(event_id,owner_id,due_at)
    values(auto_id,owner,due) returning id into job_id;
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path,status)
    values(auto_id,owner,'invitation-bgm',owner::text||'/auto.mp3','uploaded');
  select claim_token into token from public.claim_invitation_deletion_job(job_id,10);
  if token is null then raise exception 'Automatic deletion claim failed'; end if;
  if public.finalize_invitation_deletion(job_id,gen_random_uuid(),'[]'::jsonb) then
    raise exception 'Wrong token finalized automatic deletion';
  end if;
  if not exists(select 1 from public.events where id=auto_id) then
    raise exception 'Wrong token deleted event';
  end if;
  if not public.finalize_invitation_deletion(job_id,token,'[]'::jsonb) then
    raise exception 'Valid automatic finalization failed';
  end if;
  if exists(select 1 from public.events where id=auto_id) then
    raise exception 'Automatic finalization retained event';
  end if;
  if not exists(select 1 from public.invitation_storage_cleanup_jobs
    where event_id=auto_id and storage_path=owner::text||'/auto.mp3' and status='pending') then
    raise exception 'Automatic deletion lost BGM cleanup record';
  end if;
  if not exists(select 1 from public.invitation_deletion_audit
    where event_id=auto_id and outcome='completed') then
    raise exception 'Automatic deletion audit missing';
  end if;
  raise notice 'PASS: manual and automatic atomic deletion, conflict rollback, stale update, claim token';
end;
$test$;
