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
\ir ../../supabase/migrations/202611090022_preserve_shared_cleanup_ownership.sql

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

do $shared$
declare
  v_owner uuid := '44444444-4444-4444-8444-444444444444';
  v_source uuid := '55555555-5555-4555-8555-555555555555';
  v_consumer uuid := '66666666-6666-4666-8666-666666666666';
  v_path text := v_owner::text || '/photo/' || v_source::text || '/77777777-7777-4777-8777-777777777777.jpg';
begin
  perform set_config('request.jwt.claim.role','service_role',true);
  insert into public.invitation_upload_reservations(event_id,owner_id,bucket,storage_path,status)
    values(v_source,v_owner,'invitation-photos',v_path,'uploaded');
  perform public.enqueue_invitation_cleanup_object(v_consumer,v_owner,'invitation-photos',v_path);
  if exists(select 1 from public.invitation_storage_cleanup_jobs where storage_path=v_path) then
    raise exception 'Consumer took ownership before original event was deleted';
  end if;
  perform public.enqueue_invitation_cleanup_object(v_source,v_owner,'invitation-photos',v_path);
  perform public.enqueue_invitation_cleanup_object(v_consumer,v_owner,'invitation-photos',v_path);
  if (select event_id from public.invitation_storage_cleanup_jobs where storage_path=v_path) is distinct from v_source then
    raise exception 'Consumer replaced the original cleanup job';
  end if;
end;
$shared$;
