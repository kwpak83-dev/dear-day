begin;

create function public.expire_scoped_invitation_deletion_lease(p_event_id uuid)
returns integer
language plpgsql security definer set search_path = pg_catalog, public
as $$
declare v_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  with expired as (
    select id from public.invitation_deletion_jobs
    where event_id = p_event_id and status = 'processing' and attempts >= 10
      and coalesce(lease_expires_at, claimed_at + interval '10 minutes') < now()
    for update skip locked
  )
  update public.invitation_deletion_jobs j
  set status = 'failed', claim_token = null, claimed_at = null,
      lease_expires_at = null, last_error = 'Lease expired after maximum attempts',
      updated_at = now()
  from expired where j.id = expired.id;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.finalize_scoped_invitation_deletion(
  p_event_id uuid, p_job_id uuid, p_claim_token uuid, p_files jsonb
)
returns boolean
language plpgsql security definer set search_path = pg_catalog, public
as $$
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  perform 1 from public.invitation_deletion_jobs
    where id = p_job_id and event_id = p_event_id for update;
  if not found then return false; end if;
  -- Hold the same event lock through finalization so payment cannot race the check.
  perform 1 from public.events where id = p_event_id and paid_at is null for update;
  if not found then return false; end if;
  return public.finalize_invitation_deletion(p_job_id, p_claim_token, p_files);
end;
$$;

revoke all on function public.expire_scoped_invitation_deletion_lease(uuid),
  public.finalize_scoped_invitation_deletion(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.expire_scoped_invitation_deletion_lease(uuid),
  public.finalize_scoped_invitation_deletion(uuid, uuid, uuid, jsonb) to service_role;

commit;
