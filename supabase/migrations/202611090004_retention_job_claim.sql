-- Atomic job claim and crash recovery. Does not enable deletion.
-- Only service_role may execute these functions.
create or replace function public.claim_invitation_deletion_job(p_job_id uuid, p_lease_minutes integer default 10)
returns table(job_id uuid, event_id uuid, owner_id uuid, due_at timestamptz, attempts integer, claim_token uuid)
language plpgsql security definer set search_path = public
as $claim$
declare v_token uuid := gen_random_uuid();
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_lease_minutes < 1 or p_lease_minutes > 60 then
    raise exception 'Invalid lease' using errcode = '22023';
  end if;
  return query
    update public.invitation_deletion_jobs j
       set status = 'processing', attempts = j.attempts + 1,
           claimed_at = now(), claim_token = v_token, updated_at = now()
     where j.id = p_job_id
       and j.due_at <= now()
       and j.next_attempt_at <= now()
       and (j.status in ('pending', 'retry')
            or (j.status = 'processing'
                and j.claimed_at < now() - make_interval(mins => p_lease_minutes)))
    returning j.id, j.event_id, j.owner_id, j.due_at, j.attempts, j.claim_token;
end;
$claim$;

create or replace function public.retry_invitation_deletion_job(
  p_job_id uuid, p_claim_token uuid, p_error text
) returns boolean
language plpgsql security definer set search_path = public
as $retry$
declare v_updated integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  update public.invitation_deletion_jobs
     set status = case when attempts >= 10 then 'failed' else 'retry' end,
         last_error = left(p_error, 500),
         next_attempt_at = now() + make_interval(hours => least(24, power(2, least(attempts, 5))::integer)),
         claimed_at = null, claim_token = null, updated_at = now()
   where id = p_job_id and status = 'processing' and claim_token = p_claim_token;
  get diagnostics v_updated = row_count;
  return v_updated = 1;
end;
$retry$;

alter table public.invitation_deletion_jobs
  add column if not exists claim_token uuid;
revoke all on function public.claim_invitation_deletion_job(uuid, integer) from public, anon, authenticated;
revoke all on function public.retry_invitation_deletion_job(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.claim_invitation_deletion_job(uuid, integer) to service_role;
grant execute on function public.retry_invitation_deletion_job(uuid, uuid, text) to service_role;
