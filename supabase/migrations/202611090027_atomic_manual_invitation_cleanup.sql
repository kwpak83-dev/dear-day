BEGIN;

CREATE FUNCTION public.delete_invitation_and_queue_storage(
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
        '/' || object_uuid || '[.]jpg|photo/' || p_event || '/' || object_uuid || '[.](jpg|webp))$'))
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
