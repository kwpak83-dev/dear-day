-- Manual deletion: durable cleanup manifest, audit, and event deletion in one transaction.
-- This migration does not authorize physical Storage removal.
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
      insert into public.invitation_storage_cleanup_jobs(event_id,owner_id,bucket,storage_path,status)
        values (p_event,p_owner,'invitation-photos',v_media.storage_path,'pending')
        on conflict (bucket,storage_path) do nothing;
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
    insert into public.invitation_storage_cleanup_jobs(event_id,owner_id,bucket,storage_path,status)
      values (p_event,p_owner,v_bucket,v_path,'pending')
      on conflict (bucket,storage_path) do nothing;
  end loop;

  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details)
    values (p_event,p_owner,'completed','Owner deletion committed; Storage cleanup deferred');
  delete from public.events where id = p_event;
  return true;
end;
$delete$;
revoke all on function public.delete_invitation_with_cleanup(uuid,uuid,timestamptz,jsonb)
  from public,anon,authenticated;
grant execute on function public.delete_invitation_with_cleanup(uuid,uuid,timestamptz,jsonb)
  to service_role;
