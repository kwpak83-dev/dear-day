-- Ensure a retried/failed job cannot retain an active-looking lease.
-- Does not enable automatic deletion or physical Storage removal.
create or replace function public.retry_invitation_deletion_job(
  p_job_id uuid, p_claim_token uuid, p_error text
) returns boolean
language plpgsql security definer set search_path = public
as $retry$
declare v_updated integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode='42501';
  end if;
  if p_job_id is null or p_claim_token is null then
    raise exception 'Job ID and claim token are required' using errcode='22023';
  end if;
  update public.invitation_deletion_jobs
     set status=case when attempts>=10 then 'failed' else 'retry' end,
         last_error=left(coalesce(p_error,'Unknown failure'),500),
         next_attempt_at=clock_timestamp()+make_interval(hours=>least(24,power(2,least(attempts,5))::integer)),
         claimed_at=null, claim_token=null, lease_expires_at=null,
         updated_at=clock_timestamp()
   where id=p_job_id and status='processing' and claim_token=p_claim_token
     and lease_expires_at is not null
     and lease_expires_at>clock_timestamp();
  get diagnostics v_updated=row_count;
  return v_updated=1;
end;
$retry$;
revoke all on function public.retry_invitation_deletion_job(uuid,uuid,text)
  from public,anon,authenticated;
grant execute on function public.retry_invitation_deletion_job(uuid,uuid,text)
  to service_role;
