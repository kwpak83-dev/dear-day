-- Lease recovery and terminal failure handling. No deletion is enabled.
alter table public.invitation_deletion_jobs
  add column if not exists lease_expires_at timestamptz;

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
           claimed_at = now(), lease_expires_at = now() + make_interval(mins => p_lease_minutes),
           claim_token = v_token, updated_at = now()
     where j.id = p_job_id
       and j.attempts < 10
       and j.due_at <= now()
       and j.next_attempt_at <= now()
       and (j.status in ('pending','retry')
         or (j.status = 'processing' and coalesce(j.lease_expires_at, j.claimed_at + interval '10 minutes') < now()))
    returning j.id, j.event_id, j.owner_id, j.due_at, j.attempts, j.claim_token;
end;
$claim$;

create or replace function public.expire_invitation_deletion_leases(p_limit integer default 100)
returns integer
language plpgsql security definer set search_path = public
as $expire$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 1000 then
    raise exception 'Invalid batch size' using errcode = '22023';
  end if;
  with expired as (
    select id from public.invitation_deletion_jobs
    where status = 'processing' and attempts >= 10
      and coalesce(lease_expires_at, claimed_at + interval '10 minutes') < now()
    order by id limit p_limit for update skip locked
  )
  update public.invitation_deletion_jobs j
     set status = 'failed', claim_token = null, claimed_at = null,
         lease_expires_at = null, last_error = 'Lease expired after maximum attempts',
         updated_at = now()
  from expired where j.id = expired.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$expire$;

-- The finalize RPC defined in 005 must check the same stored lease boundary.
-- Redefine only the lease predicate without changing its transactional contract.
revoke all on function public.expire_invitation_deletion_leases(integer) from public, anon, authenticated;
grant execute on function public.expire_invitation_deletion_leases(integer) to service_role;
