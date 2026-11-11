BEGIN READ ONLY;

SELECT require_reservation
FROM public.invitation_storage_write_gate
WHERE singleton;

SELECT t.tgrelid::regclass AS relation, t.tgname, t.tgenabled,
       pg_get_triggerdef(t.oid, true) AS trigger_definition,
       pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t
WHERE NOT t.tgisinternal
  AND t.tgrelid IN (
    'storage.objects'::regclass, 'public.events'::regclass,
    'public.event_media'::regclass, 'public.invitation_upload_reservations'::regclass,
    'public.invitation_storage_object_references'::regclass
  )
ORDER BY t.tgrelid::regclass::text, t.tgname;

SELECT schemaname, tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies
WHERE (schemaname = 'storage' AND tablename = 'objects')
   OR (schemaname = 'public' AND tablename IN (
      'events', 'event_media', 'invitation_upload_reservations',
      'invitation_storage_objects', 'invitation_storage_object_references',
      'invitation_storage_write_gate'
   ))
ORDER BY schemaname, tablename, policyname;

SELECT bucket, storage_path, state
FROM public.invitation_storage_objects
WHERE bucket = 'invitation-photos'
  AND split_part(storage_path, '/', 1) = '80dee347-43ab-417a-8b99-5f3634f4eebf'
  AND split_part(storage_path, '/', 3) = 'f929dca4-ee23-4b51-bb72-b189db1e73c0'
ORDER BY storage_path;

ROLLBACK;
