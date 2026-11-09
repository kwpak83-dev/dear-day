-- Existing queue fields also carry the lease. Attempts fence stale acknowledgments.
create function public.claim_scoped_invitation_storage_cleanup(p_job_id bigint)
returns table(bucket text, storage_path text, attempt integer)
language plpgsql security definer set search_path = pg_catalog, public
as $claim$
declare
  v_job public.invitation_storage_cleanup_jobs%rowtype;
  v_state text;
  v_enabled boolean;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  select require_reservation into strict v_enabled from public.invitation_storage_write_gate
    where singleton for share;
  if not v_enabled then return; end if;

  select * into v_job from public.invitation_storage_cleanup_jobs j
    where j.id = p_job_id for update;
  if not found or v_job.status not in ('pending', 'retry')
    or v_job.next_attempt_at > clock_timestamp() then return; end if;
  if v_job.attempts >= 10 then
    update public.invitation_storage_cleanup_jobs set status='failed',
      last_error='Storage cleanup attempt limit reached', updated_at=clock_timestamp()
      where id=p_job_id;
    return;
  end if;
  if v_job.bucket <> 'invitation-photos'
    or v_job.storage_path !~ ('^' || v_job.owner_id || '/notice/' || v_job.event_id ||
      '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.jpg$') then return; end if;

  select o.state into v_state from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) for update;
  if not found or v_state not in ('active','deleting')
    or exists(select 1 from public.events where id=v_job.event_id)
    or not exists(select 1 from public.invitation_deletion_audit a
      where a.event_id=v_job.event_id and a.owner_id=v_job.owner_id and a.outcome='completed')
    or not exists(select 1 from public.invitation_upload_reservations r
      where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path)
        and r.event_id=v_job.event_id and r.owner_id=v_job.owner_id and r.status='uploaded')
    or exists(select 1 from public.invitation_storage_object_references r
      where (r.bucket,r.storage_path)=(v_job.bucket,v_job.storage_path))
    or exists(select 1 from public.event_media m where m.storage_path=v_job.storage_path)
    or exists(select 1 from public.events e where
      strpos(coalesce(e.cover_image_url,''),v_job.storage_path)>0
      or strpos(e.settings::text,v_job.storage_path)>0
      or exists(select 1 from public.invitation_storage_reference_candidates(e.settings,e.cover_image_url) c
        where (c.bucket,c.storage_path)=(v_job.bucket,v_job.storage_path)))
    then
      update public.invitation_storage_cleanup_jobs set next_attempt_at=clock_timestamp()+interval '1 day',
        last_error='Storage reference or ownership requires review', updated_at=clock_timestamp()
        where id=p_job_id;
      return;
  end if;

  update public.invitation_storage_objects o set state='deleting'
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path);
  return query
    update public.invitation_storage_cleanup_jobs j set status='retry', attempts=j.attempts+1,
      next_attempt_at=clock_timestamp()+interval '5 minutes', updated_at=clock_timestamp()
      where j.id=p_job_id returning j.bucket,j.storage_path,j.attempts;
end;
$claim$;

create function public.settle_scoped_invitation_storage_cleanup(p_job_id bigint, p_attempt integer, p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = pg_catalog, public
as $settle$
declare v_job public.invitation_storage_cleanup_jobs%rowtype;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Service role required' using errcode = '42501';
  end if;
  if p_attempt is null or p_succeeded is null then return false; end if;
  select * into v_job from public.invitation_storage_cleanup_jobs j
    where j.id=p_job_id for update;
  if not found or v_job.status <> 'retry' or v_job.attempts <> p_attempt
    or v_job.next_attempt_at <= clock_timestamp() then return false; end if;
  perform 1 from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) and o.state='deleting' for update;
  if not found then return false; end if;
  if p_succeeded then
    update public.invitation_storage_objects o set state='deleted'
      where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path);
  end if;
  update public.invitation_storage_cleanup_jobs set
    status=case when p_succeeded then 'done' when attempts>=10 then 'failed' else 'retry' end,
    last_error=case when p_succeeded then null else 'Storage remove failed or outcome unknown' end,
    next_attempt_at=clock_timestamp()+make_interval(mins=>least(60,5*p_attempt)),
    updated_at=clock_timestamp() where id=p_job_id;
  return true;
end;
$settle$;

revoke all on function public.claim_scoped_invitation_storage_cleanup(bigint),
  public.settle_scoped_invitation_storage_cleanup(bigint,integer,boolean) from public, anon, authenticated;
grant execute on function public.claim_scoped_invitation_storage_cleanup(bigint),
  public.settle_scoped_invitation_storage_cleanup(bigint,integer,boolean) to service_role;

-- A committed deletion fence must outlive upload-gate rollback and worker
-- timeouts. A retry may still have an older HTTP request in flight.
create function public.keep_invitation_storage_deletion_fence()
returns trigger language plpgsql security definer set search_path = pg_catalog, public
as $fence$
declare v_state text;
begin
  if tg_op = 'UPDATE' then
    if (to_jsonb(new) - 'last_accessed_at') = (to_jsonb(old) - 'last_accessed_at') then return new; end if;
    select state into v_state from public.invitation_storage_objects
      where (bucket,storage_path)=(old.bucket_id,old.name) for update;
    if found and v_state <> 'active' then
      raise exception 'Invitation Storage object is fenced' using errcode='23514';
    end if;
  end if;
  select state into v_state from public.invitation_storage_objects
    where (bucket,storage_path)=(new.bucket_id,new.name) for update;
  if found and v_state <> 'active' then
    raise exception 'Invitation Storage object is fenced' using errcode='23514';
  end if;
  return new;
end;
$fence$;
revoke all on function public.keep_invitation_storage_deletion_fence() from public, anon, authenticated, service_role;
create trigger keep_invitation_storage_deletion_fence
before insert or update on storage.objects
for each row execute function public.keep_invitation_storage_deletion_fence();
