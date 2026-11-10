-- Serialize manual deletion with scheduled finalization using job -> event lock order.
-- No deletion workers or Storage removal are enabled here.
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

  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details)
    values (p_event,p_owner,'completed','Owner deletion committed; Storage cleanup deferred');
  delete from public.events where id = p_event;
  return true;
end;
$delete$;

revoke all on function public.delete_invitation_with_cleanup(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.delete_invitation_with_cleanup(uuid,uuid,timestamptz,jsonb) to service_role;
