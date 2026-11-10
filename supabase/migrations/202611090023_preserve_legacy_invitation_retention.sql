-- Existing invitations retain their stored deadlines. Only a first publication
-- after this migration opts into 30-day deletion.
alter table public.events add column retention_v2 boolean not null default false;

create function public.invitation_public_at(p_status text, p_v2 boolean,
  p_start timestamptz, p_legacy_expiry timestamptz, p_now timestamptz)
returns boolean language sql stable set search_path = public
as $policy$
  select p_status = 'published' and case when p_v2
    then coalesce(public.event_retention_deadline_kst(p_start) > p_now, false)
    else p_legacy_expiry is null or p_legacy_expiry > p_now end;
$policy$;

create or replace function public.is_published_event(target_event_id uuid)
returns boolean language sql stable security definer set search_path = public
as $public$
  select exists(select 1 from public.events e where e.id=target_event_id and
    public.invitation_public_at(e.status::text,e.retention_v2,e.starts_at,e.service_expires_at,now()));
$public$;
drop policy if exists "published events are public" on public.events;
create policy "published events are public" on public.events for select
  using (public.invitation_public_at(status::text,retention_v2,starts_at,service_expires_at,now()));

create or replace function public.enforce_event_start_edit_lock()
returns trigger language plpgsql set search_path = public
as $lock$
begin
  if tg_op = 'INSERT' then
    new.retention_v2 := false;
    return new;
  end if;
  new.retention_v2 := old.retention_v2;
  if old.status in ('published','suspended','archived') and new.status in ('draft','paid') then
    raise exception 'EVENT_PUBLICATION_CANNOT_BE_RESET' using errcode='23514';
  end if;
  if old.published_at is not null then
    new.published_at := old.published_at;
  end if;
  if old.status in ('draft','paid') and old.published_at is null and new.status='published' then
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
drop trigger if exists enforce_event_start_edit_lock on public.events;
create trigger enforce_event_start_edit_lock before insert or update on public.events
  for each row execute function public.enforce_event_start_edit_lock();

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
  if not found or not v_event.retention_v2 or v_event.owner_id <> v_job.owner_id or
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
  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details)
    values(v_event.id,v_event.owner_id,'completed','DB deletion committed; Storage cleanup pending review');
  delete from public.events where id=v_event.id;
  return true;
end;
$finalize$;

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
    if not found or not v_event.retention_v2 or v_event.status not in ('published', 'suspended')
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

create or replace function public.reserve_invitation_upload(
  p_event uuid,p_owner uuid,p_bucket text,p_path text
) returns uuid language plpgsql security definer set search_path=public
as $reserve$
declare v_event public.events%rowtype; v_id uuid;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_event is null or p_owner is null or p_bucket not in ('invitation-photos','invitation-bgm')
     or p_path is null or length(p_path)>1024
     or left(p_path,length(p_owner::text)+1)<>p_owner::text||'/' then
    raise exception 'Invalid upload reservation' using errcode='22023';
  end if;
  -- Match the deletion transaction's event row lock.
  select * into v_event from public.events where id=p_event for update;
  if not found or v_event.owner_id<>p_owner
     or v_event.status not in ('draft','paid','published','suspended') then
    raise exception 'Invitation unavailable for upload' using errcode='23503';
  end if;
  if v_event.status in ('published','suspended')
     and (case when v_event.retention_v2
       then v_event.starts_at is null or v_event.starts_at<=clock_timestamp()
       else v_event.starts_at is not null and
         (((v_event.starts_at at time zone 'Asia/Seoul')::date+1)::timestamp at time zone 'Asia/Seoul') <= clock_timestamp() end) then
    raise exception 'Invitation is read-only' using errcode='23514';
  end if;
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path)
    values(p_event,p_owner,p_bucket,p_path) returning id into v_id;
  return v_id;
end;
$reserve$;
