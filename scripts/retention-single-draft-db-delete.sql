-- One-time production test. Run the verification script before and after.
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';

DO $delete_test$
DECLARE
  v_id constant uuid := '15e6eb30-a3a7-46a5-ab46-ab7023bf69f5';
  v_slug constant text := 'invite-6cce66b9-5ecd-4031-916d-7e2cdc8414eb';
  v_event public.events%rowtype;
BEGIN
  -- Match the existing finalizer's lock order.
  PERFORM 1 FROM public.invitation_deletion_jobs WHERE event_id = v_id FOR UPDATE;

  SELECT * INTO STRICT v_event
  FROM public.events
  WHERE id = v_id AND slug = v_slug AND status = 'draft'
    AND paid_at IS NULL AND retention_delete_eligible IS TRUE
  FOR UPDATE;

  IF EXISTS (SELECT 1 FROM public.invitation_deletion_audit WHERE event_id = v_id)
     OR EXISTS (SELECT 1 FROM public.invitation_storage_cleanup_jobs WHERE event_id = v_id) THEN
    RAISE EXCEPTION 'Existing audit or Storage cleanup work for target';
  END IF;

  -- Reuse the existing FK cascades. The automatic and manual cleanup RPCs
  -- enqueue Storage work, so this DB-only test writes its own audit marker.
  DELETE FROM public.events
  WHERE id = v_id AND slug = v_slug AND status = 'draft'
    AND paid_at IS NULL AND retention_delete_eligible IS TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target was not deleted'; END IF;

  INSERT INTO public.invitation_deletion_audit
    (event_id, owner_id, outcome, details, storage_cleanup_eligible, event_kind, source_status)
  VALUES (v_id, v_event.owner_id, 'completed',
    'One-time manual DB-only draft deletion test', false, v_event.kind::text, v_event.status::text);
END
$delete_test$;

COMMIT;
