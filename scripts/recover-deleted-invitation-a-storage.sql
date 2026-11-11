-- Rehearsal only. A commit requires separate approval and verified provenance.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $recover$
DECLARE
  a constant uuid := 'f929dca4-ee23-4b51-bb72-b189db1e73c0';
  owner_a constant uuid := '80dee347-43ab-417a-8b99-5f3634f4eebf';
  b constant uuid := 'b11c45a4-4045-4282-91a5-36d84d0aa7b0';
  photo_bucket constant text := 'invitation-photos';
  path text;
  paths text[] := ARRAY[
    owner_a || '/gallery/' || a || '/076c69f5-1ec9-4065-be03-4d4d824475ae.jpg',
    owner_a || '/gallery/' || a || '/0b4a4466-c4db-4deb-a5fb-bcf96cd78db4.jpg',
    owner_a || '/gallery/' || a || '/710c33a3-dbb1-407a-909c-c77e7e395c34.jpg',
    owner_a || '/gallery/' || a || '/b9cfc4a9-8456-4ab7-9a0a-2948c92ab930.jpg',
    owner_a || '/gallery/' || a || '/fc17ba0a-0d60-4dc8-b83a-bd330585bbef.jpg',
    owner_a || '/notice/' || a || '/33313658-3b3f-4abe-8bbe-f40004a8ac4d.jpg'
  ];
  guard_enabled boolean;
BEGIN
  IF EXISTS (SELECT 1 FROM public.events WHERE id = a)
     OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = b) THEN
    RAISE EXCEPTION 'Expected A absent and B present';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.invitation_deletion_audit
    WHERE event_id = a AND owner_id = owner_a AND outcome = 'completed'
  ) THEN
    RAISE EXCEPTION 'Missing original completed deletion audit for A';
  END IF;
  SELECT require_reservation INTO STRICT guard_enabled
  FROM public.invitation_storage_write_gate WHERE singleton FOR SHARE;
  IF guard_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Existing Storage write guard must already be enabled';
  END IF;

  IF (SELECT count(DISTINCT m.storage_path)
      FROM public.event_media m JOIN storage.objects o
        ON o.bucket_id = photo_bucket AND o.name = m.storage_path
      WHERE m.event_id = b AND NOT (m.storage_path = ANY(paths))) <> 4 THEN
    RAISE EXCEPTION 'Expected four protected B photos outside the manifest';
  END IF;

  FOREACH path IN ARRAY paths LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.invitation_upload_reservations r
      WHERE r.event_id = a AND r.owner_id = owner_a AND r.bucket = photo_bucket
        AND r.storage_path = path AND r.status = 'uploaded'
    ) OR NOT EXISTS (
      SELECT 1 FROM public.invitation_storage_objects o
      WHERE o.bucket = photo_bucket AND o.storage_path = path AND o.state = 'active'
    ) OR NOT EXISTS (
      SELECT 1 FROM storage.objects o WHERE o.bucket_id = photo_bucket AND o.name = path
    ) THEN
      RAISE EXCEPTION 'Missing upload provenance or active object for A';
    END IF;

    IF EXISTS (SELECT 1 FROM public.invitation_storage_object_references r
               WHERE r.bucket = photo_bucket AND r.storage_path = path)
       OR EXISTS (SELECT 1 FROM public.event_media m WHERE m.storage_path = path)
       OR EXISTS (SELECT 1 FROM public.bgm_tracks t
                  WHERE t.storage_bucket = photo_bucket AND t.storage_path = path)
       OR EXISTS (
         SELECT 1 FROM public.events e
         WHERE strpos(coalesce(e.cover_image_url, ''), path) > 0
            OR strpos(e.settings::text, path) > 0
            OR EXISTS (
              SELECT 1 FROM public.invitation_storage_reference_candidates(e.settings, e.cover_image_url) c
              WHERE c.bucket = photo_bucket AND c.storage_path = path
            )
       ) THEN
      RAISE EXCEPTION 'A file still has a live reference';
    END IF;
  END LOOP;

  -- Set the role claim locally for the existing service-only enqueue helper.
  -- Execute only in the privileged SQL Editor session.
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  FOREACH path IN ARRAY paths LOOP
    PERFORM public.enqueue_invitation_cleanup_object(a, owner_a, photo_bucket, path);
  END LOOP;
  IF (SELECT count(*) FROM public.invitation_storage_cleanup_jobs j
      WHERE j.event_id = a AND j.owner_id = owner_a AND j.bucket = photo_bucket
        AND j.storage_path = ANY(paths) AND j.status IN ('pending', 'retry')) <> cardinality(paths) THEN
    RAISE EXCEPTION 'Could not queue the exact six A objects';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.invitation_deletion_audit
    WHERE event_id = a AND owner_id = owner_a AND outcome = 'completed'
      AND storage_cleanup_eligible
  ) THEN
    INSERT INTO public.invitation_deletion_audit
      (event_id, owner_id, outcome, details, storage_cleanup_eligible)
    VALUES (a, owner_a, 'completed', 'Verified recovery of six A photo objects', true);
  END IF;
END
$recover$;

ROLLBACK;
