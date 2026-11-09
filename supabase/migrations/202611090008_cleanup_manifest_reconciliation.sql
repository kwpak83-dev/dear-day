-- Durable cleanup ledger reconciliation. This does NOT enable Storage deletion.
-- A pre-existing completed/failed row must never silently swallow a new deletion request.
-- Existing schema's unique(bucket,storage_path) means one ledger row per object.
create or replace function public.enqueue_invitation_cleanup_object(
  p_event uuid, p_owner uuid, p_bucket text, p_path text
) returns void language plpgsql security definer set search_path = public
as $enqueue$
declare v_row public.invitation_storage_cleanup_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_bucket not in ('invitation-photos','invitation-bgm') or
     p_path is null or length(p_path) > 1024 or
     left(p_path,length(p_owner::text)+1) <> p_owner::text || '/' then
    raise exception 'Invalid cleanup path' using errcode = '22023';
  end if;
  insert into public.invitation_storage_cleanup_jobs(event_id,owner_id,bucket,storage_path,status)
    values (p_event,p_owner,p_bucket,p_path,'pending')
    on conflict (bucket,storage_path) do nothing;
  select * into v_row from public.invitation_storage_cleanup_jobs
    where bucket=p_bucket and storage_path=p_path for update;
  if not found or v_row.owner_id <> p_owner then
    raise exception 'Cleanup ledger ownership mismatch' using errcode = '23514';
  end if;
  -- Preserve previous event identity for audit only when it is the same event.
  -- A shared object across events is not eligible for automatic cleanup.
  if v_row.event_id <> p_event then
    raise exception 'Cleanup path shared by multiple events; manual review required'
      using errcode = '23514';
  end if;
  if v_row.status in ('done','failed') then
    raise exception 'Terminal cleanup record requires manual reconciliation'
      using errcode = '23514';
  end if;
end;
$enqueue$;
revoke all on function public.enqueue_invitation_cleanup_object(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.enqueue_invitation_cleanup_object(uuid,uuid,text,text) to service_role;

-- Redefine both deletion RPCs to use the same fail-closed ledger invariant.
create or replace function public.delete_invitation_with_cleanup(
  p_event uuid, p_owner uuid, p_expected_updated_at timestamptz,
  p_files jsonb default '[]'::jsonb
) returns boolean
language plpgsql security definer set search_path = public
as $delete$
declare
  v_event public.events%rowtype;
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
  select * into v_event from public.events where id = p_event for update;
  if not found or v_event.owner_id <> p_owner or
     v_event.status not in ('draft','suspended','published','paid') or
     v_event.updated_at is distinct from p_expected_updated_at then
    return false;
  end if;

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

  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details)
    values (p_event,p_owner,'completed','Owner deletion committed; Storage cleanup deferred');
  delete from public.events where id = p_event;
  return true;
end;
$delete$;
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
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files) > 1000 then
    raise exception 'Invalid file manifest' using errcode = '22023';
  end if;
  -- Row locks serialize finalization with another claim and event edits.
  select * into v_job from public.invitation_deletion_jobs
   where id = p_job_id for update;
  if not found or v_job.status <> 'processing' or
     p_claim_token is null or v_job.claim_token is null or
     v_job.claim_token <> p_claim_token or
     v_job.claimed_at is null or v_job.lease_expires_at is null or
     v_job.lease_expires_at <= now() or
     v_job.attempts > 10 then
    return false;
  end if;
  select * into v_event from public.events where id = v_job.event_id for update;
  if not found or v_event.owner_id <> v_job.owner_id or
     v_event.status not in ('published','suspended') or v_event.starts_at is null then
    return false;
  end if;
  v_due := (((v_event.starts_at at time zone 'Asia/Seoul')::date + 30)::timestamp at time zone 'Asia/Seoul');
  if v_due > now() or v_due <> v_job.due_at then
    return false;
  end if;
  for v_file in select value from jsonb_array_elements(p_files)
  loop
    v_bucket := v_file->>'bucket';
    v_path := v_file->>'storage_path';
    if v_bucket not in ('invitation-photos','invitation-bgm') or
       v_path is null or length(v_path) > 1024 or
       left(v_path, length(v_job.owner_id::text) + 1) <> v_job.owner_id::text || '/' then
      raise exception 'Invalid Storage path' using errcode = '22023';
    end if;
    perform public.enqueue_invitation_cleanup_object(v_event.id,v_event.owner_id,v_bucket,v_path);
  end loop;
  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details)
    values (v_event.id,v_event.owner_id,'completed','DB deletion committed; Storage cleanup pending review');
  delete from public.events where id = v_event.id;
  return true;
end;
$finalize$;

revoke all on function public.delete_invitation_with_cleanup(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.delete_invitation_with_cleanup(uuid,uuid,timestamptz,jsonb) to service_role;
revoke all on function public.finalize_invitation_deletion(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_invitation_deletion(uuid,uuid,jsonb) to service_role;
