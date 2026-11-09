-- Fail-closed validation for nullable manifest fields and lease parameters.
-- No deletion or Storage cleanup is activated by this migration.
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
revoke all on function public.enqueue_invitation_cleanup_object(uuid,uuid,text,text)
  from public,anon,authenticated;
grant execute on function public.enqueue_invitation_cleanup_object(uuid,uuid,text,text)
  to service_role;

-- Null lease values previously bypassed the range validation.
create or replace function public.claim_invitation_deletion_job(
  p_job_id uuid, p_lease_minutes integer default 10
)
returns table(job_id uuid, event_id uuid, owner_id uuid, due_at timestamptz, attempts integer, claim_token uuid)
language plpgsql security definer set search_path = public
as $claim$
declare v_token uuid := gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_job_id is null or p_lease_minutes is null or
     p_lease_minutes < 1 or p_lease_minutes > 60 then
    raise exception 'Invalid lease' using errcode='22023';
  end if;
  return query
    update public.invitation_deletion_jobs j
       set status='processing', attempts=j.attempts+1,
           claimed_at=clock_timestamp(),
           lease_expires_at=clock_timestamp()+make_interval(mins=>p_lease_minutes),
           claim_token=v_token, updated_at=clock_timestamp()
     where j.id=p_job_id and j.attempts<10
       and j.due_at<=clock_timestamp()
       and j.next_attempt_at<=clock_timestamp()
       and (j.status in ('pending','retry')
         or (j.status='processing' and
           coalesce(j.lease_expires_at,j.claimed_at+interval '10 minutes')<clock_timestamp()))
    returning j.id,j.event_id,j.owner_id,j.due_at,j.attempts,j.claim_token;
end;
$claim$;
revoke all on function public.claim_invitation_deletion_job(uuid,integer)
  from public,anon,authenticated;
grant execute on function public.claim_invitation_deletion_job(uuid,integer)
  to service_role;
