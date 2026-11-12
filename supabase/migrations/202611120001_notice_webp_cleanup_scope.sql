-- Extend only event-scoped notice cleanup to WebP, retaining owner, reservation,
-- audit, live-reference and storage-state safety checks. Existing migrations remain immutable.
BEGIN;

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
  -- Upload gate intentionally does not block cleanup.

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
  if not ((v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/gallery/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]jpg$'))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/notice/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/photo/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-bgm' and v_job.storage_path ~ ('^' || v_job.owner_id || '/bgm/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]mp3$'))) then return; end if;

  select o.state into v_state from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) for update;
  if not found or v_state not in ('active','deleting')
    or exists(select 1 from public.events where id=v_job.event_id)
    or not exists(select 1 from public.invitation_deletion_audit a
      where a.event_id=v_job.event_id and a.owner_id=v_job.owner_id and a.outcome='completed' and a.storage_cleanup_eligible)
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
$claim$;))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/notice/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/photo/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-bgm' and v_job.storage_path ~ ('^' || v_job.owner_id || '/bgm/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]mp3$'))) then return; end if;

  select o.state into v_state from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) for update;
  if not found or v_state not in ('active','deleting')
    or exists(select 1 from public.events where id=v_job.event_id)
    or not exists(select 1 from public.invitation_deletion_audit a
      where a.event_id=v_job.event_id and a.owner_id=v_job.owner_id and a.outcome='completed' and a.storage_cleanup_eligible)
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
$claim$;))
    or (v_job.bucket = 'invitation-photos' and v_job.storage_path ~ ('^' || v_job.owner_id || '/photo/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.](jpg|webp)$'))
    or (v_job.bucket = 'invitation-bgm' and v_job.storage_path ~ ('^' || v_job.owner_id || '/bgm/' || v_job.event_id || '/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}[.]mp3$'))) then return; end if;

  select o.state into v_state from public.invitation_storage_objects o
    where (o.bucket,o.storage_path)=(v_job.bucket,v_job.storage_path) for update;
  if not found or v_state not in ('active','deleting')
    or exists(select 1 from public.events where id=v_job.event_id)
    or not exists(select 1 from public.invitation_deletion_audit a
      where a.event_id=v_job.event_id and a.owner_id=v_job.owner_id and a.outcome='completed' and a.storage_cleanup_eligible)
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

CREATE OR REPLACE FUNCTION public.delete_invitation_and_queue_storage(
  p_event uuid, p_owner uuid, p_expected_updated_at timestamptz
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public
AS $delete$
DECLARE
  invitation public.events%ROWTYPE;
  queued integer;
  held integer;
  object_uuid constant text := '[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}';
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  -- Match automatic deletion's job-then-event lock order.
  PERFORM 1 FROM public.invitation_deletion_jobs WHERE event_id = p_event FOR UPDATE;
  SELECT * INTO invitation FROM public.events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR invitation.owner_id IS DISTINCT FROM p_owner
     OR invitation.updated_at IS DISTINCT FROM p_expected_updated_at
     OR invitation.status NOT IN ('draft', 'paid', 'published', 'suspended') THEN
    RETURN NULL;
  END IF;

  WITH candidates AS (
    SELECT r.bucket, r.storage_path FROM public.invitation_upload_reservations r
    WHERE r.event_id = p_event AND r.owner_id = p_owner
    UNION
    SELECT c.bucket, c.storage_path
    FROM public.invitation_storage_reference_candidates(invitation.settings, invitation.cover_image_url) c
    UNION
    SELECT 'invitation-photos', m.storage_path FROM public.event_media m WHERE m.event_id = p_event
    UNION
    SELECT r.bucket, r.storage_path FROM public.invitation_storage_object_references r WHERE r.event_id = p_event
    UNION
    -- Include replaced photos in event-scoped folders even if settings no longer list them.
    SELECT o.bucket_id, o.name FROM storage.objects o
    WHERE (o.bucket_id = 'invitation-photos' AND (
      o.name LIKE p_owner || '/notice/' || p_event || '/%' OR
      o.name LIKE p_owner || '/gallery/' || p_event || '/%' OR
      o.name LIKE p_owner || '/photo/' || p_event || '/%'
    )) OR (o.bucket_id = 'invitation-bgm' AND o.name LIKE p_owner || '/bgm/' || p_event || '/%')
  ), owned AS (
    SELECT c.*, EXISTS (
      SELECT 1 FROM public.invitation_upload_reservations r
      WHERE r.event_id = p_event AND r.owner_id = p_owner
        AND r.bucket = c.bucket AND r.storage_path = c.storage_path
        AND r.status IN ('reserved', 'uploaded')
    ) AND (
      (c.bucket = 'invitation-photos' AND c.storage_path ~ (
        '^' || p_owner || '/((notice|gallery)/' || p_event ||
        '/' || object_uuid || '[.](jpg|webp)|photo/' || p_event || '/' || object_uuid || '[.](jpg|webp))$'))
      OR (c.bucket = 'invitation-bgm' AND c.storage_path ~ (
        '^' || p_owner || '/bgm/' || p_event || '/' || object_uuid || '[.]mp3$'))
    ) AS reserved
    FROM candidates c
    WHERE c.bucket IN ('invitation-photos', 'invitation-bgm')
      AND length(c.storage_path) BETWEEN 1 AND 1024
      AND starts_with(c.storage_path, p_owner || '/')
      AND NOT EXISTS (
        SELECT 1 FROM public.invitation_upload_reservations r
        WHERE r.bucket = c.bucket AND r.storage_path = c.storage_path
          AND (r.event_id, r.owner_id) IS DISTINCT FROM (p_event, p_owner)
      )
  ), inserted AS (
    INSERT INTO public.invitation_storage_cleanup_jobs
      (event_id, owner_id, bucket, storage_path, status, last_error)
    SELECT p_event, p_owner, bucket, storage_path,
      CASE WHEN reserved THEN 'pending' ELSE 'failed' END,
      CASE WHEN NOT reserved THEN 'Preserved: no matching event-scoped upload reservation' END
    FROM owned ORDER BY bucket, storage_path
    ON CONFLICT (bucket, storage_path) DO NOTHING
    RETURNING status
  )
  SELECT count(*) FILTER (WHERE status = 'pending'), count(*) FILTER (WHERE status = 'failed')
  INTO queued, held FROM inserted;

  INSERT INTO public.invitation_deletion_audit
    (event_id, owner_id, outcome, details, storage_cleanup_eligible, event_kind, source_status)
  VALUES (p_event, p_owner, 'completed',
    format('Owner deletion committed; Storage queued: %s; preserved for review: %s', queued, held),
    true, invitation.kind::text, invitation.status::text);

  DELETE FROM public.events WHERE id = p_event;
  IF NOT FOUND THEN RAISE EXCEPTION 'Locked invitation was not deleted'; END IF;
  RETURN jsonb_build_object('queued', queued, 'held', held);
END;
$delete$;

REVOKE ALL ON FUNCTION public.delete_invitation_and_queue_storage(uuid, uuid, timestamptz)
  FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_invitation_and_queue_storage(uuid, uuid, timestamptz)
  TO service_role;

COMMIT;
