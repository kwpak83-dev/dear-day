import assert from "node:assert/strict";
import test from "node:test";
import { cleanupLegacyOrphans, executionRequested, protectedEvent, target } from "../scripts/cleanup-legacy-orphan-a.mjs";

const name = "33313658-3b3f-4abe-8bbe-f40004a8ac4d.jpg";
const path = `80dee347-43ab-417a-8b99-5f3634f4eebf/notice/${target}/${name}`;
const origin = "https://fixture.supabase.co";

function fixture({ gate = true, state = "deletion_pending", referenced = false, reserved = false, unknown = false, loseResponse = false } = {}) {
  let present = true;
  const removals = [];
  const storage = {
    list: async prefix => ({ data: prefix.includes("/notice/") && present ? [{ name: unknown ? "unknown.jpg" : name, id: "1" }] : [] }),
    info: async () => ({ data: {} }),
    async remove(paths) {
      removals.push(...paths);
      present = false;
      if (loseResponse) throw Error("Lost response");
      return { error: null };
    },
  };
  const db = {
    storage: { from: () => storage },
    from(table) {
      const filters = {};
      const query = {
        select: () => query, in: () => query, order: () => query, range: () => query,
        limit: () => query, maybeSingle: () => query,
        eq: (key, value) => { filters[key] = value; return query; },
        then(resolve) {
          const data = {
            events: [{ id: protectedEvent }],
            event_media: filters.event_id ? [1, 2, 3, 4].map(i => ({ storage_path: `b/${i}.jpg` })) : [],
            invitation_storage_object_references: referenced ? [{ event_id: protectedEvent }] : [],
            invitation_upload_reservations: reserved ? [{ id: "1" }] : [],
            invitation_storage_objects: { state },
            invitation_storage_cleanup_jobs: [],
            bgm_tracks: [],
            invitation_storage_write_gate: { require_reservation: gate },
          }[table];
          resolve({ data });
        },
      };
      return query;
    },
  };
  return { db, removals };
}

test("execution requires a flag and exact UUID confirmation", () => {
  assert.equal(executionRequested([], target), false);
  assert.equal(executionRequested(["--execute"], target), true);
  assert.throws(() => executionRequested(["--execute"], protectedEvent));
});

test("dry-run, missing fence, disabled guard, shared reference and pending upload preserve files", async () => {
  const options = { log() {} };
  const dry = fixture();
  await cleanupLegacyOrphans(dry.db, origin, options);
  assert.deepEqual(dry.removals, []);
  for (const input of [{ gate: false }, { state: "active" }, { referenced: true }, { reserved: true }, { unknown: true }]) {
    const sample = fixture(input);
    await assert.rejects(cleanupLegacyOrphans(sample.db, origin, { ...options, execute: true }));
    assert.deepEqual(sample.removals, []);
  }
});

test("retry reconciles a lost response without deleting an absent object again", async () => {
  const sample = fixture({ loseResponse: true });
  const log = [];
  const options = { execute: true, log: line => log.push(JSON.parse(line)) };
  await assert.rejects(cleanupLegacyOrphans(sample.db, origin, options), /could not be confirmed/);
  await cleanupLegacyOrphans(sample.db, origin, options);
  assert.deepEqual(sample.removals, [path]);
  assert.ok(log.some(row => row.action === "remove-unconfirmed" && row.path === path));
  assert.ok(log.some(row => row.action === "already-absent" && row.path === path));
});
