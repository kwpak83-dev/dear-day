-- Expand the existing claim predicate. Preserve account-wide and unreserved legacy paths.
create or replace function public.claim_scoped_invitation_storage_cleanup(p_job_id bigint)
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
  if not ((v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/(notice|gallery)/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]jpg$'))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/photo/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-bgm' and v_job.storage_path ~ ('^' || v_job.owner_id || '/bgm/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]mp3$'))) then return; end if;

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
    or exists(select 1 from public.bgm_tracks t
      where (t.storage_bucket,t.storage_path)=(v_job.bucket,v_job.storage_path))
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
