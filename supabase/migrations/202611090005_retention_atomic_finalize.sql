-- Atomic DB-first finalization. No Storage objects are removed by this function.
-- This migration alone does not enable any worker.
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
     v_job.claim_token is distinct from p_claim_token or
     v_job.claimed_at <= now() - interval '10 minutes' or
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
revoke all on function public.finalize_invitation_deletion(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finalize_invitation_deletion(uuid,uuid,jsonb) to service_role;
