-- Existing rows retain their publication and edit policy and are excluded from
-- destructive retention. Enable the creation gate separately after cutover.
BEGIN;

alter table public.events
  add column retention_delete_eligible boolean not null default false;
alter table public.invitation_deletion_audit
  add column storage_cleanup_eligible boolean not null default false;

create table public.invitation_retention_creation_gate (
  singleton boolean primary key default true check (singleton),
  enroll_new_events boolean not null default false
);
insert into public.invitation_retention_creation_gate default values;
alter table public.invitation_retention_creation_gate enable row level security;
revoke all on public.invitation_retention_creation_gate from public, anon, authenticated, service_role;


create or replace function public.enforce_event_start_edit_lock()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $lock$
begin
  if tg_op = 'INSERT' then
    -- Serialize classification with the operator's activation UPDATE.
    select enroll_new_events into strict new.retention_delete_eligible
    from public.invitation_retention_creation_gate where singleton for share;
    new.retention_v2 := false;
    return new;
  end if;
  new.retention_v2 := old.retention_v2;
  new.retention_delete_eligible := old.retention_delete_eligible;
  if old.status in ('published','suspended','archived') and new.status in ('draft','paid') then
    raise exception 'EVENT_PUBLICATION_CANNOT_BE_RESET' using errcode='23514';
  end if;
  if old.published_at is not null then
    new.published_at := old.published_at;
  end if;
  if old.retention_delete_eligible and old.status in ('draft','paid')
     and old.published_at is null and new.status='published' then
    new.retention_v2 := true;
  end if;
  if old.status in ('published','suspended') and
     (case when old.retention_v2 then old.starts_at is null or old.starts_at <= now()
       else old.starts_at is not null and
         (((old.starts_at at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul') <= now() end) then
    raise exception 'EVENT_EDIT_CLOSED' using errcode='23514';
  end if;
  if new.retention_v2 and new.status in ('published','suspended') then
    if new.starts_at is null or new.starts_at <= now() then
      raise exception 'EVENT_DATE_MUST_BE_FUTURE' using errcode='23514';
    end if;
    new.service_expires_at := public.event_retention_deadline_kst(new.starts_at);
    new.grace_ends_at := new.service_expires_at;
  end if;
  return new;
end;
$lock$;

create or replace function public.reconcile_invitation_deletion_schedule(p_event_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $reconcile$
declare
  v_id uuid;
  v_job public.invitation_deletion_jobs%rowtype;
  v_event public.events%rowtype;
  v_due timestamptz;
  v_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_event_ids is null or cardinality(p_event_ids) > 100 then
    raise exception 'Invalid schedule batch' using errcode = '22023';
  end if;
  for v_id in select distinct id from unnest(p_event_ids) as ids(id)
    where id is not null order by id
  loop
    -- Same order as the deletion RPCs when a job already exists.
    select * into v_job from public.invitation_deletion_jobs
      where event_id = v_id for update;
    select * into v_event from public.events where id = v_id for update;
    if not found or not v_event.retention_delete_eligible or not v_event.retention_v2 or v_event.status not in ('published', 'suspended')
      or v_event.starts_at is null then
      continue;
    end if;
    v_due := public.event_retention_deadline_kst(v_event.starts_at);
    if v_job.id is not null then
      if v_job.status <> 'failed'
        and (v_job.due_at is distinct from v_due or v_job.owner_id is distinct from v_event.owner_id) then
        update public.invitation_deletion_jobs
        set due_at = v_due, owner_id = v_event.owner_id, status = 'pending',
            attempts = 0, next_attempt_at = v_due, last_error = null,
            claimed_at = null, claim_token = null, lease_expires_at = null,
            updated_at = clock_timestamp()
        where id = v_job.id;
        v_count := v_count + 1;
      end if;
    elsif v_due <= clock_timestamp() then
      insert into public.invitation_deletion_jobs(event_id, owner_id, due_at)
      values (v_id, v_event.owner_id, v_due)
      on conflict (event_id) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;
  return v_count;
end;
$reconcile$;

create or replace function public.finalize_invitation_deletion(
  p_job_id uuid, p_claim_token uuid, p_files jsonb default '[]'::jsonb
) returns boolean
language plpgsql security definer set search_path = public
as $finalize$
declare
  v_job public.invitation_deletion_jobs%rowtype;
  v_event public.events%rowtype;
  v_due timestamptz;
  v_file jsonb;
  v_bucket text;
  v_path text;
  v_media record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files) > 1000 then
    raise exception 'Invalid file manifest' using errcode = '22023';
  end if;
  select * into v_job from public.invitation_deletion_jobs where id=p_job_id for update;
  if not found or v_job.status <> 'processing' or
     p_claim_token is null or v_job.claim_token is null or
     v_job.claim_token <> p_claim_token or
     v_job.claimed_at is null or v_job.lease_expires_at is null or
     v_job.lease_expires_at <= clock_timestamp() or
     v_job.attempts > 10 then
    return false;
  end if;
  select * into v_event from public.events where id=v_job.event_id for update;
  if not found or not v_event.retention_delete_eligible or not v_event.retention_v2 or v_event.owner_id <> v_job.owner_id or
     v_event.status not in ('published','suspended') or v_event.starts_at is null then
    return false;
  end if;
  v_due := (((v_event.starts_at at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul');
  if v_due > clock_timestamp() or v_due <> v_job.due_at or
     v_job.lease_expires_at <= clock_timestamp() then
    return false;
  end if;
  -- Read every reserved path under the event lock, including unfinished uploads.
  -- The ledger is intentionally retained after event deletion; physical cleanup
  -- must still recheck references and in-flight uploads before removing anything.
  for v_media in
    select bucket,storage_path from public.invitation_upload_reservations
    where event_id=v_event.id and owner_id=v_event.owner_id
  loop
    perform public.enqueue_invitation_cleanup_object(v_event.id,v_event.owner_id,v_media.bucket,v_media.storage_path);
  end loop;

  for v_media in select storage_path from public.event_media where event_id=v_event.id loop
    if v_media.storage_path is not null and
       left(v_media.storage_path,length(v_event.owner_id::text)+1)=v_event.owner_id::text || '/' then
      perform public.enqueue_invitation_cleanup_object(v_event.id,v_event.owner_id,'invitation-photos',v_media.storage_path);
    end if;
  end loop;
  for v_file in select value from jsonb_array_elements(p_files) loop
    v_bucket := v_file->>'bucket';
    v_path := v_file->>'storage_path';
    if v_bucket not in ('invitation-photos','invitation-bgm') or
       v_path is null or length(v_path)>1024 or
       left(v_path,length(v_job.owner_id::text)+1) <> v_job.owner_id::text || '/' then
      raise exception 'Invalid Storage path' using errcode='22023';
    end if;
    perform public.enqueue_invitation_cleanup_object(v_event.id,v_event.owner_id,v_bucket,v_path);
  end loop;
  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details,storage_cleanup_eligible)
    values(v_event.id,v_event.owner_id,'completed','DB deletion committed; Storage cleanup pending review',true);
  delete from public.events where id=v_event.id;
  return true;
end;
$finalize$;

create or replace function public.delete_invitation_with_cleanup(
  p_event uuid, p_owner uuid, p_expected_updated_at timestamptz,
  p_files jsonb default '[]'::jsonb
) returns boolean
language plpgsql security definer set search_path = public
as $delete$
declare
  v_event public.events%rowtype;
  v_job_id uuid;
  v_file jsonb;
  v_bucket text;
  v_path text;
  v_media record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_files is null or jsonb_typeof(p_files) <> 'array' or jsonb_array_length(p_files) > 1000 then
    raise exception 'Invalid cleanup manifest' using errcode = '22023';
  end if;
  -- Automatic finalization locks the deletion job first. Match that order.
  select id into v_job_id from public.invitation_deletion_jobs
    where event_id = p_event for update;
  select * into v_event from public.events where id = p_event for update;
  if not found or v_event.owner_id <> p_owner or
     v_event.status not in ('draft','suspended','published','paid') or
     v_event.updated_at is distinct from p_expected_updated_at then
    return false;
  end if;

  if not v_event.retention_delete_eligible then
    delete from public.events where id = p_event;
    return true;
  end if;

  -- Read every reserved path under the event lock, including unfinished uploads.
  -- The ledger is intentionally retained after event deletion; physical cleanup
  -- must still recheck references and in-flight uploads before removing anything.
  for v_media in
    select bucket,storage_path from public.invitation_upload_reservations
    where event_id=p_event and owner_id=p_owner
  loop
    perform public.enqueue_invitation_cleanup_object(p_event,p_owner,v_media.bucket,v_media.storage_path);
  end loop;

  -- DB-owned media paths are read inside the transaction, not trusted from the API.
  for v_media in select storage_path from public.event_media where event_id = p_event
  loop
    if v_media.storage_path is not null and
       left(v_media.storage_path, length(p_owner::text) + 1) = p_owner::text || '/' then
      perform public.enqueue_invitation_cleanup_object(p_event,p_owner,'invitation-photos',v_media.storage_path);
    end if;
  end loop;

  for v_file in select value from jsonb_array_elements(p_files)
  loop
    v_bucket := v_file->>'bucket';
    v_path := v_file->>'storage_path';
    if v_bucket is null or v_bucket not in ('invitation-photos','invitation-bgm') or
       v_path is null or length(v_path) > 1024 or
       left(v_path, length(p_owner::text) + 1) <> p_owner::text || '/' then
      raise exception 'Invalid cleanup object' using errcode = '22023';
    end if;
    perform public.enqueue_invitation_cleanup_object(p_event,p_owner,v_bucket,v_path);
  end loop;

  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details,storage_cleanup_eligible)
    values (p_event,p_owner,'completed','Owner deletion committed; Storage cleanup deferred',true);
  delete from public.events where id = p_event;
  return true;
end;
$delete$;

create or replace function public.claim_scoped_invitation_storage_cleanup(p_job_id bigint)
returns table(bucket text, storage_path text, attempt integer)
language plpgsql security definer set search_path = pg_catalog, public
as $claim$
declare
  v_job public.invitation_storage_cleanup_jobs%rowtype;
  v_state text;
  v_enabled boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select require_reservation into strict v_enabled from public.invitation_storage_write_gate
    where singleton for share;
  if not v_enabled then return; end if;

  select * into v_job from public.invitation_storage_cleanup_jobs j
    where j.id = p_job_id for update;
  if not found or v_job.status not in ('pending', 'retry')
    or v_job.next_attempt_at > clock_timestamp() then return; end if;
  if v_job.attempts >= 10 then
    update public.invitation_storage_cleanup_jobs set status='failed',
      last_error='Storage cleanup attempt limit reached', updated_at=clock_timestamp()
      where id=p_job_id;
    return;
  end if;
  if not ((v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/(notice|gallery)/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]jpg$'))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/photo/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-bgm' and v_job.storage_path ~ ('^' || v_job.owner_id || '/bgm/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]mp3$'))) then return; end if;

  select o.state into v_state from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) for update;
  if not found or v_state not in ('active','deleting')
    or exists(select 1 from public.events where id=v_job.event_id)
    or not exists(select 1 from public.invitation_deletion_audit a
      where a.event_id=v_job.event_id and a.owner_id=v_job.owner_id and a.outcome='completed' and a.storage_cleanup_eligible)
    or not exists(select 1 from public.invitation_upload_reservations r
      where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path)
        and r.event_id=v_job.event_id and r.owner_id=v_job.owner_id and r.status='uploaded')
    or exists(select 1 from public.invitation_storage_object_references r
      where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path))
    or exists(select 1 from public.bgm_tracks t
      where (t.storage_bucket,t.storage_path)=(v_job.bucket,v_job.storage_path))
    or exists(select 1 from public.event_media m where m.storage_path=v_job.storage_path)
    or exists(select 1 from public.events e where
      strpos(coalesce(e.cover_image_url,''),v_job.storage_path)>0
      or strpos(e.settings::text,v_job.storage_path)>0
      or exists(select 1 from public.invitation_storage_reference_candidates(e.settings,e.cover_image_url) c
        where (c.bucket,c.storage_path)=(v_job.bucket,v_job.storage_path)))
    then
      update public.invitation_storage_cleanup_jobs set next_attempt_at=clock_timestamp()+interval '1 day',
        last_error='Storage reference or ownership requires review', updated_at=clock_timestamp()
        where id=p_job_id;
      return;
  end if;

  update public.invitation_storage_objects o set state='deleting'
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path);
  return query
    update public.invitation_storage_cleanup_jobs j set status='retry', attempts=j.attempts+1,
      next_attempt_at=clock_timestamp()+interval '5 minutes', updated_at=clock_timestamp()
      where j.id=p_job_id returning j.bucket,j.storage_path,j.attempts;
end;
$claim$;

COMMIT;
