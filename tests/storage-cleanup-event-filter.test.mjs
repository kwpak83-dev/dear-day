import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runScopedStorageCleanup } from "../lib/scoped-invitation-storage-worker.mjs";

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
      return Promise.resolve({ data: jobs.filter(j => j[column] === value), error: null });
    },
    then(resolve, reject) { return Promise.resolve({ data: jobs, error: null }).then(resolve, reject); },
  };
  const db = {
    from(name) { assert.equal(name, "invitation_storage_cleanup_jobs"); return query; },
    async rpc(name, args) {
      if (name === "claim_scoped_invitation_storage_cleanup") {
        state.claims.push(args.p_job_id);
        return { data: [{ bucket: "invitation-photos", storage_path: "test.jpg", attempt: 1 }], error: null };
      }
      assert.equal(name, "settle_scoped_invitation_storage_cleanup");
      return { data: true, error: null };
    },
    storage: { from() { return { async remove(paths) { state.removals.push(...paths); return { error: null }; } }; } },
  };
  return { db, state };
}

test("event-scoped worker only claims jobs belonging to the selected event", async () => {
  const { db, state } = fakeDb();
  const result = await runScopedStorageCleanup(db, target);
  assert.deepEqual(state.filters, [["event_id", target]]);
  assert.deepEqual(state.claims, [1]);
  assert.equal(result.removed, 1);
});

test("production cleanup requires an event ID or a separate global rollout gate", () => {
  const source = readFileSync(new URL("../app/api/retention/storage-cleanup/route.js", import.meta.url), "utf8");
  assert.match(source, /RETENTION_STORAGE_CLEANUP_EVENT_ID/);
  assert.match(source, /RETENTION_STORAGE_GLOBAL_ENABLED/);
  assert.match(source, /Global Storage cleanup not enabled/);
  assert.match(source, /runScopedStorageCleanup\\(db, validEventId \\? eventId : null\\)/);
});
