import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sql = async (number, name) => readFile(new URL(`../supabase/migrations/20261109${String(number).padStart(4,"0")}_${name}.sql`, import.meta.url), "utf8");
const route = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("manual and automatic deletion enqueue under an event row lock", async () => {
  const source = await sql(8, "cleanup_manifest_reconciliation");
  const fence = await sql(9, "event_media_deletion_fence");
  assert.match(source, /select \* into v_event from public\.events where id = p_event for update/i);
  assert.match(source, /for v_media in select storage_path from public\.event_media/i);
  assert.match(fence, /select \* into v_event from public\.events where id=v_job\.event_id for update/i);
  assert.match(fence, /for v_media in select storage_path from public\.event_media/i);
  assert.match(fence, /before insert or update on public\.event_media/i);
});

test("cleanup ledger rejects cross-event and terminal reuse", async () => {
  const source = await sql(10, "cleanup_validation_hardening");
  assert.match(source, /v_row\.event_id <> p_event/);
  assert.match(source, /v_row\.status in \('done','failed'\)/);
  assert.match(source, /p_bucket is null/);
  assert.match(source, /p_owner is null/);
});

test("retry clears the persisted lease and requires an unexpired claim", async () => {
  const source = await sql(11, "retention_retry_lease_consistency");
  assert.match(source, /lease_expires_at=null/);
  assert.match(source, /lease_expires_at>clock_timestamp\(\)/);
  assert.match(source, /p_claim_token is null/);
});

test("destructive retention and Storage cleanup default to disabled", async () => {
  const cleanup = await route("app/api/retention/cleanup/route.js");
  const storage = await route("app/api/retention/storage-cleanup/route.js");
  assert.match(cleanup, /const execute = process\.env\.RETENTION_DELETE_ENABLED === "true"/);
  assert.match(storage, /RETENTION_STORAGE_DELETE_ENABLED === "true" &&\s*process\.env\.RETENTION_STORAGE_INVENTORY_VERIFIED === "true"/);
  assert.doesNotMatch(storage, /\.remove\s*\(/);
});

test("manual atomic RPC uses server-side credentials only", async () => {
  const source = await route("app/api/events/route.js");
  assert.match(source, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /serviceDb\.rpc\("delete_invitation_with_cleanup"/);
  assert.match(source, /MANUAL_DELETION_ATOMIC_READY === "true"/);
});

test("cleanup recovery RPC matches the bounded SQL transition", async () => {
  const cleanup = await route("app/api/retention/cleanup/route.js");
  const recovery = await sql(6, "retention_lease_recovery");
  assert.match(cleanup, /if \(execute\)\s*\{\s*report\.recovered = await required\(db\.rpc\("expire_invitation_deletion_leases", \{ p_limit: 100 \}/);
  assert.match(recovery, /expire_invitation_deletion_leases\(p_limit integer default 100\)/);
  assert.match(recovery, /status = 'processing' and attempts >= 10/);
  assert.match(recovery, /for update skip locked/i);
  assert.match(recovery, /set status = 'failed', claim_token = null, claimed_at = null,\s*lease_expires_at = null/);
  assert.match(cleanup, /\.lt\("attempts", 10\)\.lte\("due_at", now\)\.lte\("next_attempt_at", now\)/);
  assert.ok(cleanup.indexOf("if (!claimed)") < cleanup.indexOf("const files = await planFiles"));
});

test("schedule reconciliation locks the job then reads the current event deadline", async () => {
  const source = await sql(16, "reconcile_retention_schedule");
  const scheduler = await route("app/api/retention/schedule/route.js");
  assert.match(scheduler, /rpc\("reconcile_invitation_deletion_schedule", \{\s*p_event_ids:/);
  assert.match(source, /reconcile_invitation_deletion_schedule\(p_event_ids uuid\[\]\)/);
  assert.match(source, /from public\.invitation_deletion_jobs\s+where event_id = v_id for update;\s+select \* into v_event from public\.events where id = v_id for update;/);
  assert.match(source, /event_retention_deadline_kst\(v_event\.starts_at\)/);
  assert.match(source, /v_job\.due_at is distinct from v_due/);
  assert.match(source, /claimed_at = null, claim_token = null, lease_expires_at = null/);
});

test("new draft retention reuses queue and atomic finalization", async () => {
  const migration = await sql(25, "new_draft_retention");
  const schedule = await route("app/api/retention/schedule/route.js");
  const cleanup = await route("app/api/retention/cleanup/route.js");
  const simple = await route("app/api/retention/simple/route.js");

  assert.match(migration, /not v_event\.retention_delete_eligible/);
  assert.match(migration, /v_event\.updated_at \+ interval '720 hours'/);
  assert.match(migration, /v_event\.status in \('published','suspended'\)/);
  assert.match(migration, /v_due <> v_job\.due_at/);
  assert.match(migration, /source_status/);
  assert.match(migration, /event_kind/);
  assert.match(schedule, /\["draft", "published", "suspended"\]/);
  assert.match(cleanup, /invitationDeletionTime\(event\)/);
  assert.match(simple, /mode: "dry-run", mutationPerformed: false/);
  assert.doesNotMatch(simple, /\.delete\s*\(/);
  assert.doesNotMatch(simple, /\.remove\s*\(/);
  assert.doesNotMatch(simple, /SIMPLE_RETENTION_DELETE_ENABLED\s*===/);
});
