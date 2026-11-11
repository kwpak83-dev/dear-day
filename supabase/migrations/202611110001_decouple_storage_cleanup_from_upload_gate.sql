-- Storage cleanup is independently authorized by reservation, ownership, audit,
-- object state, path shape and reference checks in the claim RPC.
-- The upload write gate must not disable cleanup of already-deleted events.
DO $migration$
DECLARE
  current_def text;
  old_condition text := 'if not v_enabled then return; end if;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO STRICT current_def
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'claim_scoped_invitation_storage_cleanup'
    AND pg_get_function_identity_arguments(p.oid) = 'p_job_id bigint';

  IF position(old_condition IN current_def) = 0 THEN
    RAISE EXCEPTION 'Unexpected claim function definition; refusing migration';
  END IF;

  -- Keep the existing safety checks unchanged. Only remove the unrelated
  -- upload-write gate, which is currently false in production.
  EXECUTE replace(current_def, old_condition,
    '/* Storage cleanup is independent of the upload write gate. */');
END;
$migration$;
