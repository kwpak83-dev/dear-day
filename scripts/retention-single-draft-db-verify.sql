BEGIN READ ONLY;
WITH target AS (
  SELECT '15e6eb30-a3a7-46a5-ab46-ab7023bf69f5'::uuid AS id,
         'invite-6cce66b9-5ecd-4031-916d-7e2cdc8414eb'::text AS slug
)
SELECT
  (SELECT count(*) FROM public.events e WHERE e.id = t.id OR e.slug = t.slug) AS matching_events,
  (SELECT count(*) FROM public.events e
   WHERE e.id = t.id AND e.slug = t.slug AND e.status = 'draft'
     AND e.paid_at IS NULL AND e.retention_delete_eligible IS TRUE) AS eligible_unpaid_drafts,
  (SELECT count(*) FROM public.event_media WHERE event_id = t.id) AS media_rows,
  (SELECT count(*) FROM public.invitation_deletion_jobs WHERE event_id = t.id) AS deletion_jobs,
  (SELECT count(*) FROM public.invitation_storage_cleanup_jobs WHERE event_id = t.id) AS storage_jobs,
  (SELECT count(*) FROM public.invitation_deletion_audit
   WHERE event_id = t.id AND outcome = 'completed' AND source_status = 'draft'
     AND storage_cleanup_eligible IS FALSE
     AND details = 'One-time manual DB-only draft deletion test') AS test_audit_rows,
  (SELECT require_reservation FROM public.invitation_storage_write_gate WHERE singleton) AS storage_guard
FROM target t;
COMMIT;
