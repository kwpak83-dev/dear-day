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

-- Match finalization to the persisted lease boundary; reject NULL tokens.
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
    insert into public.invitation_storage_cleanup_jobs
      (event_id,owner_id,bucket,storage_path,status)
      values (v_event.id,v_event.owner_id,v_bucket,v_path,'pending')
      on conflict (bucket,storage_path) do nothing;
  end loop;
  insert into public.invitation_deletion_audit(event_id,owner_id,outcome,details)
    values (v_event.id,v_event.owner_id,'completed','DB deletion committed; Storage cleanup pending review');
  delete from public.events where id = v_event.id;
  return true;
end;
$finalize$;

revoke all on function public.expire_invitation_deletion_leases(integer) from public, anon, authenticated;
grant execute on function public.expire_invitation_deletion_leases(integer) to service_role;
