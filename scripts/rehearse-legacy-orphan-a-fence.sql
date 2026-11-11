-- Rehearsal. Verify deployed trigger definitions and actual behavior first.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $fence$
DECLARE
  a constant uuid := 'f929dca4-ee23-4b51-bb72-b189db1e73c0';
  b constant uuid := 'b11c45a4-4045-4282-91a5-36d84d0aa7b0';
  owner_a constant text := '80dee347-43ab-417a-8b99-5f3634f4eebf';
  photos constant text := 'invitation-photos';
  paths constant text[] := ARRAY[
    owner_a || '/gallery/' || a || '/076c69f5-1ec9-4065-be03-4d4d824475ae.jpg',
    owner_a || '/gallery/' || a || '/0b4a4466-c4db-4deb-a5fb-bcf96cd78db4.jpg',
    owner_a || '/gallery/' || a || '/710c33a3-dbb1-407a-909c-c77e7e395c34.jpg',
    owner_a || '/gallery/' || a || '/b9cfc4a9-8456-4ab7-9a0a-2948c92ab930.jpg',
    owner_a || '/gallery/' || a || '/fc17ba0a-0d60-4dc8-b83a-bd330585bbef.jpg',
    owner_a || '/notice/' || a || '/33313658-3b3f-4abe-8bbe-f40004a8ac4d.jpg'
  ];
  path text;
  guard_enabled boolean;
  object_state text;
BEGIN
  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Expected normal trigger execution';
  END IF;
  SELECT require_reservation INTO STRICT guard_enabled
  FROM public.invitation_storage_write_gate WHERE singleton FOR SHARE;
  IF guard_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Storage reservation guard must already be enabled';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM (VALUES
      ('storage.objects'::regclass, 'guard_invitation_storage_write', 'public.guard_invitation_storage_write()'::regprocedure),
      ('storage.objects'::regclass, 'keep_invitation_storage_deletion_fence', 'public.keep_invitation_storage_deletion_fence()'::regprocedure),
      ('public.invitation_upload_reservations'::regclass, 'invitation_upload_reservations_object_fence', 'public.require_active_invitation_storage_object()'::regprocedure),
      ('public.invitation_storage_object_references'::regclass, 'invitation_storage_references_object_fence', 'public.require_active_invitation_storage_object()'::regprocedure),
      ('public.events'::regclass, 'track_event_storage_references', 'public.track_invitation_storage_references()'::regprocedure),
      ('public.event_media'::regclass, 'track_media_storage_references', 'public.track_invitation_storage_references()'::regprocedure)
    ) expected(relid, trigger_name, function_id)
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_trigger t
      WHERE t.tgrelid = expected.relid AND t.tgname = expected.trigger_name
        AND t.tgfoid = expected.function_id AND t.tgenabled IN ('O', 'A')
    )
  ) THEN
    RAISE EXCEPTION 'Expected Storage and reference triggers must be enabled';
  END IF;
  IF EXISTS (SELECT 1 FROM public.events WHERE id = a)
     OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = b) THEN
    RAISE EXCEPTION 'Expected A absent and B present';
  END IF;
  IF (SELECT count(*) FROM public.event_media WHERE event_id = b) <> 4
     OR (SELECT count(DISTINCT m.storage_path)
         FROM public.event_media m JOIN storage.objects o
           ON o.bucket_id = photos AND o.name = m.storage_path
         WHERE m.event_id = b AND NOT (m.storage_path = ANY(paths))) <> 4 THEN
    RAISE EXCEPTION 'Expected four B photos outside the manifest';
  END IF;

  -- Take the same per-object lock as uploads and reference registration.
  -- No Storage metadata row, upload reservation or deletion audit is created.
  FOREACH path IN ARRAY paths LOOP
    INSERT INTO public.invitation_storage_objects(bucket, storage_path)
    VALUES (photos, path) ON CONFLICT (bucket, storage_path) DO NOTHING;
    SELECT o.state INTO STRICT object_state FROM public.invitation_storage_objects o
    WHERE o.bucket = photos AND o.storage_path = path FOR UPDATE;
    IF object_state NOT IN ('active', 'deletion_pending')
       OR NOT EXISTS (SELECT 1 FROM storage.objects o
                      WHERE o.bucket_id = photos AND o.name = path)
       OR EXISTS (SELECT 1 FROM public.invitation_storage_object_references r
                  WHERE r.bucket = photos AND r.storage_path = path)
       OR EXISTS (SELECT 1 FROM public.event_media m WHERE m.storage_path = path)
       OR EXISTS (SELECT 1 FROM public.invitation_upload_reservations r
                  WHERE r.bucket = photos AND r.storage_path = path AND r.status = 'reserved')
       OR EXISTS (SELECT 1 FROM public.invitation_storage_cleanup_jobs j
                  WHERE j.bucket = photos AND j.storage_path = path AND j.status IN ('pending', 'retry'))
       OR EXISTS (SELECT 1 FROM public.bgm_tracks t
                  WHERE t.storage_bucket = photos AND t.storage_path = path)
       OR EXISTS (
         SELECT 1 FROM public.events e
         WHERE strpos(coalesce(e.cover_image_url, ''), path) > 0
            OR strpos(e.settings::text, path) > 0
            OR EXISTS (
              SELECT 1 FROM public.invitation_storage_reference_candidates(e.settings, e.cover_image_url) c
              WHERE c.bucket = photos AND c.storage_path = path
            )
       ) THEN
      RAISE EXCEPTION 'Missing object, conflicting state, live reference, or in-flight work for %', path;
    END IF;
    UPDATE public.invitation_storage_objects o SET state = 'deletion_pending'
    WHERE o.bucket = photos AND o.storage_path = path AND o.state = 'active';
  END LOOP;
  RAISE NOTICE 'Validated and fenced exactly % paths inside this rehearsal', cardinality(paths);
END
$fence$;

ROLLBACK;
