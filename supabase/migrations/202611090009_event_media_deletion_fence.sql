-- Protect event_media registration from racing an event deletion.
-- This is a partial fence only: cover/settings/notice uploads need the same protocol.
-- No physical Storage deletion or automatic cleanup is enabled.
create or replace function public.lock_event_for_media_registration()
returns trigger language plpgsql security definer set search_path = public
as $fence$
declare v_id uuid;
begin
  if tg_op = 'UPDATE' and new.event_id is distinct from old.event_id then
    raise exception 'Moving media between invitations is not supported' using errcode='23514';
  end if;
  v_id := new.event_id;
  -- FOR UPDATE serializes media writes with manual/automatic event deletion.
  perform 1 from public.events where id=v_id for update;
  if not found then
    raise exception 'Invitation no longer exists' using errcode='23503';
  end if;
  return new;
end;
$fence$;
drop trigger if exists event_media_registration_fence on public.event_media;
create trigger event_media_registration_fence
before insert or update on public.event_media
for each row execute function public.lock_event_for_media_registration();

-- Finalization reads DB-owned media only after obtaining the event row lock.
-- Keep the external manifest as a best-effort supplement, not an authorization
-- to remove Storage objects.
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
  if not found or v_event.owner_id <> v_job.owner_id or
     v_event.status not in ('published','suspended') or v_event.starts_at is null then
    return false;
  end if;
  v_due := (((v_event.starts_at at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul');
  if v_due > clock_timestamp() or v_due <> v_job.due_at or
     v_job.lease_expires_at <= clock_timestamp() then
    return false;
  end if;
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
revoke all on function public.finalize_invitation_deletion(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_invitation_deletion(uuid,uuid,jsonb) to service_role;
