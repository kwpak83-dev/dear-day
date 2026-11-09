-- Reconcile against the current event row rather than the scheduler's snapshot.
create or replace function public.reconcile_invitation_deletion_schedule(p_event_ids uuid[])
returns integer
language plpgsql security definer set search_path = public
as $reconcile$
declare
  v_id uuid;
  v_job public.invitation_deletion_jobs%rowtype;
  v_event public.events%rowtype;
  v_due timestamptz;
  v_count integer := 0;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_event_ids is null or cardinality(p_event_ids) > 100 then
    raise exception 'Invalid schedule batch' using errcode = '22023';
  end if;
  for v_id in select distinct id from unnest(p_event_ids) as ids(id)
    where id is not null order by id
  loop
    -- Same order as the deletion RPCs when a job already exists.
    select * into v_job from public.invitation_deletion_jobs
      where event_id = v_id for update;
    select * into v_event from public.events where id = v_id for update;
    if not found or v_event.status not in ('published', 'suspended')
      or v_event.starts_at is null then
      continue;
    end if;
    v_due := public.event_retention_deadline_kst(v_event.starts_at);
    if v_job.id is not null then
      if v_job.status <> 'failed'
        and (v_job.due_at is distinct from v_due or v_job.owner_id is distinct from v_event.owner_id) then
        update public.invitation_deletion_jobs
        set due_at = v_due, owner_id = v_event.owner_id, status = 'pending',
            attempts = 0, next_attempt_at = v_due, last_error = null,
            claimed_at = null, claim_token = null, lease_expires_at = null,
            updated_at = clock_timestamp()
        where id = v_job.id;
        v_count := v_count + 1;
      end if;
    elsif v_due <= clock_timestamp() then
      insert into public.invitation_deletion_jobs(event_id, owner_id, due_at)
      values (v_id, v_event.owner_id, v_due)
      on conflict (event_id) do nothing;
      if found then v_count := v_count + 1; end if;
    end if;
  end loop;
  return v_count;
end;
$reconcile$;
revoke all on function public.reconcile_invitation_deletion_schedule(uuid[])
  from public, anon, authenticated;
grant execute on function public.reconcile_invitation_deletion_schedule(uuid[]) to service_role;
