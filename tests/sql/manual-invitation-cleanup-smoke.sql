\set ON_ERROR_STOP on
-- Run after retention-migration-order-smoke.sql and retention-creation-cohort-smoke.sql.
\ir ../../supabase/migrations/202611090025_new_draft_retention.sql
\ir ../../supabase/migrations/202611090026_scoped_retention_test.sql
\ir ../../supabase/migrations/202611090027_atomic_manual_invitation_cleanup.sql

BEGIN;
DO $test$
DECLARE
  owner_id_fixture constant uuid := '88888888-8888-4888-8888-888888888888';
  event_status_fixture public.event_status;
  invitation public.events%ROWTYPE;
  survivor uuid;
  own_path text;
  shared_path text;
  legacy_path text := owner_id_fixture || '/legacy.jpg';
  summary jsonb;
  own_job bigint;
  shared_job bigint;
  attempt_number integer;
BEGIN
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.invitation_retention_creation_gate SET enroll_new_events = false WHERE singleton;
  FOREACH event_status_fixture IN ARRAY ARRAY['draft', 'paid', 'published', 'suspended']::public.event_status[] LOOP
    INSERT INTO public.events(owner_id, kind, status, slug, title)
    VALUES (owner_id_fixture, 'wedding', event_status_fixture, 'manual-sql-' || event_status_fixture, 'Fixture')
    RETURNING * INTO invitation;
    IF public.delete_invitation_and_queue_storage(invitation.id, gen_random_uuid(), invitation.updated_at) IS NOT NULL
       OR public.delete_invitation_and_queue_storage(invitation.id, owner_id_fixture, invitation.updated_at - interval '1 second') IS NOT NULL THEN
      RAISE EXCEPTION 'Owner or revision mismatch accepted';
    END IF;
    summary := public.delete_invitation_and_queue_storage(invitation.id, owner_id_fixture, invitation.updated_at);
    IF summary IS DISTINCT FROM '{"queued":0,"held":0}'::jsonb
       OR EXISTS (SELECT 1 FROM public.events WHERE id = invitation.id) THEN
      RAISE EXCEPTION 'Manual deletion failed for %', event_status_fixture;
    END IF;
  END LOOP;

  INSERT INTO public.events(owner_id, kind, status, slug, title)
  VALUES (owner_id_fixture, 'wedding', 'draft', 'manual-sql-files', 'Fixture')
  RETURNING * INTO invitation;
  own_path := owner_id_fixture || '/photo/' || invitation.id || '/11111111-1111-4111-8111-111111111111.jpg';
  shared_path := owner_id_fixture || '/gallery/' || invitation.id || '/22222222-2222-4222-8222-222222222222.jpg';
  INSERT INTO public.invitation_upload_reservations(event_id, owner_id, bucket, storage_path, status)
  VALUES (invitation.id, owner_id_fixture, 'invitation-photos', own_path, 'uploaded'),
         (invitation.id, owner_id_fixture, 'invitation-photos', shared_path, 'uploaded');
  INSERT INTO public.events(owner_id, kind, status, slug, title, cover_image_url)
  VALUES (owner_id_fixture, 'wedding', 'draft', 'manual-sql-survivor', 'Fixture',
    'https://fixture.test/storage/v1/object/public/invitation-photos/' || shared_path)
  RETURNING id INTO survivor;
  UPDATE public.events
  SET settings = jsonb_build_object('heroSlotPhotos', jsonb_build_object('main',
    'https://fixture.test/storage/v1/object/public/invitation-photos/' || legacy_path))
  WHERE id = invitation.id RETURNING * INTO invitation;

  summary := public.delete_invitation_and_queue_storage(invitation.id, owner_id_fixture, invitation.updated_at);
  IF summary IS DISTINCT FROM '{"queued":2,"held":1}'::jsonb
     OR EXISTS (SELECT 1 FROM public.events WHERE id = invitation.id)
     OR NOT EXISTS (SELECT 1 FROM public.events WHERE id = survivor)
     OR NOT EXISTS (SELECT 1 FROM public.invitation_deletion_audit WHERE event_id = invitation.id AND outcome = 'completed')
     OR NOT EXISTS (SELECT 1 FROM public.invitation_storage_cleanup_jobs
                    WHERE event_id = invitation.id AND storage_path = legacy_path AND status = 'failed' AND last_error IS NOT NULL) THEN
    RAISE EXCEPTION 'Atomic deletion or legacy preservation failed';
  END IF;
  SELECT id INTO STRICT own_job FROM public.invitation_storage_cleanup_jobs WHERE storage_path = own_path;
  SELECT id INTO STRICT shared_job FROM public.invitation_storage_cleanup_jobs WHERE storage_path = shared_path;
  UPDATE public.invitation_storage_write_gate SET require_reservation = false WHERE singleton;
  IF EXISTS (SELECT 1 FROM public.claim_scoped_invitation_storage_cleanup(own_job)) THEN
    RAISE EXCEPTION 'Storage claim bypassed disabled guard';
  END IF;
  UPDATE public.invitation_storage_write_gate SET require_reservation = true WHERE singleton;
  IF EXISTS (SELECT 1 FROM public.claim_scoped_invitation_storage_cleanup(shared_job)) THEN
    RAISE EXCEPTION 'Shared object was claimed';
  END IF;
  SELECT c.attempt INTO STRICT attempt_number FROM public.claim_scoped_invitation_storage_cleanup(own_job) c;
  BEGIN
    UPDATE public.events SET cover_image_url = 'https://fixture.test/storage/v1/object/public/invitation-photos/' || own_path
    WHERE id = survivor;
    RAISE EXCEPTION 'New reference bypassed deletion fence';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NOT public.settle_scoped_invitation_storage_cleanup(own_job, attempt_number, false) THEN
    RAISE EXCEPTION 'Storage failure was not acknowledged';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.invitation_storage_cleanup_jobs
                    WHERE id = own_job AND status = 'retry' AND last_error IS NOT NULL) THEN
    RAISE EXCEPTION 'Storage failure did not retain a retry';
  END IF;
END
$test$;
ROLLBACK;
