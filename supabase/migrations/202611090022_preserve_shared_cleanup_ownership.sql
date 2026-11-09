-- Keep cleanup ownership with the event that owns the upload reservation.
create or replace function public.enqueue_invitation_cleanup_object(
  p_event uuid, p_owner uuid, p_bucket text, p_path text
) returns void language plpgsql security definer set search_path = public
as $enqueue$
declare v_row public.invitation_storage_cleanup_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_event is null or p_owner is null or
     p_bucket is null or p_bucket not in ('invitation-photos','invitation-bgm') or
     p_path is null or length(p_path)=0 or length(p_path)>1024 or
     left(p_path,length(p_owner::text)+1) <> p_owner::text || '/' then
    raise exception 'Invalid cleanup object' using errcode='22023';
  end if;
  -- A consumer may share another invitation's reserved file. Its deletion
  -- must neither take over the original queue entry nor block event removal.
  if exists (select 1 from public.invitation_upload_reservations r
    where (r.bucket,r.storage_path)=(p_bucket,p_path)
      and r.owner_id=p_owner and r.event_id<>p_event) then
    return;
  end if;
  insert into public.invitation_storage_cleanup_jobs(event_id,owner_id,bucket,storage_path,status)
    values(p_event,p_owner,p_bucket,p_path,'pending')
    on conflict (bucket,storage_path) do nothing;
  select * into v_row from public.invitation_storage_cleanup_jobs
    where bucket=p_bucket and storage_path=p_path for update;
  if not found or v_row.owner_id <> p_owner or v_row.event_id <> p_event or
     v_row.status in ('done','failed') then
    raise exception 'Cleanup ledger conflict requires manual reconciliation'
      using errcode='23514';
  end if;
end;
$enqueue$;
