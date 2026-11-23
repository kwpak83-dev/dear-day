import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { processScopedStorageJob, runScopedStorageCleanup } from "../lib/scoped-invitation-storage-worker.mjs";

const target = "a527a271-5fac-4bb8-b3a4-cf6ed7a44e8c";
const other = "11111111-1111-4111-8111-111111111111";

function fakeDb() {
  const jobs = [{ id: 1, event_id: target }, { id: 2, event_id: other }];
  const state = { filters: [], claims: [], removals: [] };
  const query = {
    select() { return this; },
    or() { return this; },
    in() { return this; },
    lte() { return this; },
    order() { return this; },
    limit() { return this; },
    eq(column, value) {
      state.filters.push([column, value]);
      this.conditions.push([column, value]);
      return this;
    },
    maybeSingle() { return Promise.resolve({ data: jobs.find(j => this.conditions.every(([k,v]) => j[k] === v)) || null, error: null }); },
    then(resolve, reject) { return Promise.resolve({ data: jobs.filter(j => this.conditions.every(([k,v]) => j[k] === v)), error: null }).then(resolve, reject); },
  };
  const db = {
    from(name) { assert.equal(name, "invitation_storage_cleanup_jobs"); return { ...query, conditions: [] }; },
    async rpc(name, args) {
      if (name === "claim_scoped_invitation_storage_cleanup") {
        state.claims.push(args.p_job_id);
        return { data: [{ bucket: "invitation-photos", storage_path: "test.jpg", attempt: 1 }], error: null };
      }
      assert.equal(name, "settle_scoped_invitation_storage_cleanup");
      return { data: true, error: null };
    },
    storage: { from() { return {
      async info() {
        return state.removals.length ? { error: { status: 404, code: "NoSuchKey" } } : { data: {} };
      },
      async remove(paths) { state.removals.push(...paths); return { error: null }; },
    }; } },
  };
  return { db, state };
}

test("event-scoped worker only claims jobs belonging to the selected event", async () => {
  const { db, state } = fakeDb();
  const result = await runScopedStorageCleanup(db, target);
  assert.ok(state.filters.some(([key]) => key === "event_id"));
  assert.ok(state.filters.filter(([key]) => key === "event_id").every(([,value]) => value === target));
  assert.deepEqual(state.claims, [1]);
  assert.equal(result.removed, 1);
});

test("photo cleanup requires an explicit missing-object response before settling success", async () => {
  const missing = { status: 404, code: "NoSuchKey" };
  const cases = [
    { before: missing, succeeds: true, removes: 0 },
    { after: missing, succeeds: true, removes: 1 },
    { after: null, succeeds: false, removes: 1 },
    { after: { status: 404, code: "NoSuchBucket", message: "Bucket not found" }, succeeds: false, removes: 1 },
    { before: { status: 403, code: "AccessDenied" }, succeeds: false, removes: 0 },
    { removeError: new Error("network"), succeeds: false, removes: 1 },
  ];
  for (const { before, after, removeError, succeeds, removes } of cases) {
    let calls = 0;
    let deletes = 0;
    let settled;
    const db = {
      async rpc(name, args) {
        if (name.startsWith("claim")) return { data: [{ bucket: "invitation-photos", storage_path: "object.jpg", attempt: 1 }] };
        settled = args.p_succeeded;
        return { data: true };
      },
      storage: { from: () => ({
        async info() { return { data: {}, error: calls++ === 0 ? before : after }; },
        async remove() { deletes++; return { error: removeError }; },
      }) },
    };
    assert.equal(await processScopedStorageJob(db, 1), succeeds ? "removed" : "failed");
    assert.equal(settled, succeeds);
    assert.equal(deletes, removes);
  }
});

test("production cleanup requires an event ID or a separate global rollout gate", () => {
  const source = readFileSync(new URL("../app/api/retention/storage-cleanup/route.js", import.meta.url), "utf8");
  assert.match(source, /RETENTION_STORAGE_CLEANUP_EVENT_ID/);
  assert.match(source, /RETENTION_STORAGE_GLOBAL_ENABLED/);
  assert.match(source, /Global Storage cleanup not enabled/);
  assert.ok(source.includes("runScopedStorageCleanup(db, validEventId ? eventId : null)"));
});
