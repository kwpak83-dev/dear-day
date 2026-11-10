-- New-invitation retention: add draft (last saved +30 days) to the existing
-- durable queue and atomic finalizer. Do NOT execute until dry-run review.
-- Historical migrations 001-024 remain intact; no data is deleted by migration.
begin;

-- Deleted event rows cannot be joined later; retain lightweight metadata for
-- a future administrator's deletion history screen.
alter table public.invitation_deletion_audit
  add column if not exists event_kind text,
  add column if not exists source_status text;

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
    -- Only new (creation-gated) invitations; drafts have not been published.
    if not found or not v_event.retention_delete_eligible then
      continue;
    end if;
    if v_event.status = 'draft' then
      if v_event.updated_at is null then continue; end if;
      v_due := v_event.updated_at + interval '720 hours';
    elsif v_event.status in ('published', 'suspended')
      and v_event.retention_v2 and v_event.starts_at is not null then
      v_due := public.event_retention_deadline_kst(v_event.starts_at);
    else
      -- paid, legacy and unsupported statuses are never scheduled.
      continue;
    end if;
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
  if not found or not v_event.retention_delete_eligible or v_event.owner_id <> v_job.owner_id then
    return false;
  end if;
  -- Revalidate under the event lock: a draft may have been saved or paid
  -- after the job was scheduled. A stale job must never delete that event.
  if v_event.status = 'draft' then
    if v_event.updated_at is null then return false; end if;
    v_due := v_event.updated_at + interval '720 hours';
  elsif v_event.status in ('published','suspended') and
        v_event.retention_v2 and v_event.starts_at is not null then
    v_due := public.event_retention_deadline_kst(v_event.starts_at);
  else
    return false;
  end if;
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
  insert into public.invitation_deletion_audit(
    event_id,owner_id,outcome,details,storage_cleanup_eligible,event_kind,source_status)
    values(v_event.id,v_event.owner_id,'completed',
      'Automatic 30-day deletion committed; Storage cleanup queued',true,
      v_event.kind::text,v_event.status::text);
  delete from public.events where id=v_event.id;
  return true;
end;
$finalize$;



revoke all on function public.reconcile_invitation_deletion_schedule(uuid[])
  from public, anon, authenticated;
grant execute on function public.reconcile_invitation_deletion_schedule(uuid[]) to service_role;
revoke all on function public.finalize_invitation_deletion(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.finalize_invitation_deletion(uuid,uuid,jsonb) to service_role;

commit;
