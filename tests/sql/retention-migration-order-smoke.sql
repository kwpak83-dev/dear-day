\set ON_ERROR_STOP on
-- Run in a fresh, disposable PostgreSQL database. This fixture models
-- platform schemas only and does not exercise the Supabase Storage API.
do $roles$
declare v_role text;
begin
  foreach v_role in array array['service_role', 'authenticated', 'anon'] loop
    if not exists (select 1 from pg_roles where rolname = v_role) then
      execute format('create role %I nologin', v_role);
    end if;
  end loop;
end;
$roles$;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
create schema storage;
create table storage.objects (
  bucket_id text not null, name text not null, metadata jsonb,
  last_accessed_at timestamptz, primary key (bucket_id, name)
);

\ir ../../supabase/migrations/202609090001_initial_event_platform.sql
\ir ../../supabase/migrations/202609110001_invitation_gallery.sql
\ir ../../supabase/migrations/202609150001_event_payment_publish_states.sql
\ir ../../supabase/migrations/202609190001_event_suspended_status.sql
\ir ../../supabase/migrations/202609210001_event_retention.sql
\ir ../../supabase/migrations/202609300001_public_bgm_tracks.sql
\ir ../../supabase/migrations/202611090001_event_retention_policy_alignment.sql
\ir ../../supabase/migrations/202611090002_invitation_deletion_jobs.sql
\ir ../../supabase/migrations/202611090003_retention_notices.sql
\ir ../../supabase/migrations/202611090004_retention_job_claim.sql
\ir ../../supabase/migrations/202611090005_retention_atomic_finalize.sql
\ir ../../supabase/migrations/202611090006_retention_lease_recovery.sql
\ir ../../supabase/migrations/202611090007_manual_deletion_atomic.sql
\ir ../../supabase/migrations/202611090008_cleanup_manifest_reconciliation.sql
\ir ../../supabase/migrations/202611090009_event_media_deletion_fence.sql
\ir ../../supabase/migrations/202611090010_cleanup_validation_hardening.sql
\ir ../../supabase/migrations/202611090011_retention_retry_lease_consistency.sql
\ir ../../supabase/migrations/202611090012_upload_reservations.sql
\ir ../../supabase/migrations/202611090013_collect_upload_reservations_on_deletion.sql
\ir ../../supabase/migrations/202611090014_upload_reservation_readonly_guard.sql
\ir ../../supabase/migrations/202611090015_manual_deletion_lock_order.sql
\ir ../../supabase/migrations/202611090016_reconcile_retention_schedule.sql
\ir ../../supabase/migrations/202611090017_invitation_storage_object_fence.sql
\ir ../../supabase/migrations/202611090018_inventory_invitation_storage_references.sql
\ir ../../supabase/migrations/202611090019_guard_invitation_storage_writes.sql
\ir ../../supabase/migrations/202611090020_scoped_storage_cleanup.sql
\ir ../../supabase/migrations/202611090021_expand_scoped_storage_cleanup.sql

do $test$
begin
  if (select require_reservation from public.invitation_storage_write_gate where singleton)
     is distinct from false then
    raise exception 'Migration must leave the upload guard disabled';
  end if;
  if not has_function_privilege('service_role', 'public.reserve_invitation_upload(uuid,uuid,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.reserve_invitation_upload(uuid,uuid,text,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.reserve_invitation_upload(uuid,uuid,text,text)', 'EXECUTE') then
    raise exception 'Reservation RPC grants changed';
  end if;
  if not exists (select 1 from pg_trigger
    where tgrelid = 'storage.objects'::regclass and tgname = 'guard_invitation_storage_write' and tgenabled = 'O') then
    raise exception 'Storage metadata trigger missing';
  end if;
  if has_function_privilege('authenticated', 'public.claim_scoped_invitation_storage_cleanup(bigint)', 'EXECUTE')
    or has_function_privilege('anon', 'public.settle_scoped_invitation_storage_cleanup(bigint,integer,boolean)', 'EXECUTE') then
    raise exception 'Storage cleanup RPC grants are too broad';
  end if;
end;
$test$;
