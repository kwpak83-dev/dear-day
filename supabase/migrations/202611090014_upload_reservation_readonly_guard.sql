-- Reject upload reservations for expired/read-only invitations, including suspended ones.
-- This migration only changes reservation validation; it does not activate cleanup.
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
     and (v_event.starts_at is null or v_event.starts_at<=clock_timestamp()) then
    raise exception 'Invitation is read-only' using errcode='23514';
  end if;
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path)
    values(p_event,p_owner,p_bucket,p_path) returning id into v_id;
  return v_id;
end;
$reserve$;
revoke all on function public.reserve_invitation_upload(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.reserve_invitation_upload(uuid,uuid,text,text) to service_role;
