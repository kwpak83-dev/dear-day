import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const source = await readFile(new URL("../lib/invitation-storage-references.js", import.meta.url), "utf8");
const { inspectStorageReferences } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function fakeDb(events, media = []) {
  return { from(table) {
    const state = { path: null };
    return {
      select() { return this; },
      eq(key, value) { if (key === "storage_path") state.path = value; return this; },
      order() { return this; },
      async range(start, end) {
        const rows = table === "events" ? events : media.filter(row => row.storage_path === state.path);
        return { data: rows.slice(start, end + 1), error: null };
      }
    };
  }};
}
const base = "https://example.supabase.co";
const path = "owner-a/gallery/file.jpg";
const url = base + "/storage/v1/object/public/invitation-photos/" + path;

test("detects cross-account settings reference", async () => {
  const db = fakeDb([{ id: "event-a", settings: {} }, { id: "event-b", settings: { image: url } }]);
  const result = await inspectStorageReferences(db, { supabaseUrl: base, bucket: "invitation-photos", path, excludeEventId: "event-a" });
  assert.equal(result.referenced, true);
});
test("detects cross-account media reference", async () => {
  const db = fakeDb([], [{ event_id: "event-b", storage_path: path }]);
  assert.equal((await inspectStorageReferences(db, { supabaseUrl: base, bucket: "invitation-photos", path, excludeEventId: "event-a" })).referenced, true);
});
test("ignores deleted event reference", async () => {
  const db = fakeDb([{ id: "event-a", cover_image_url: url }]);
  assert.equal((await inspectStorageReferences(db, { supabaseUrl: base, bucket: "invitation-photos", path, excludeEventId: "event-a" })).referenced, false);
});
test("fails closed on database error", async () => {
  const db = { from() { return { select() { return this; }, order() { return this; }, async range() { return { data: null, error: new Error("offline") }; } }; } };
  await assert.rejects(inspectStorageReferences(db, { supabaseUrl: base, bucket: "invitation-photos", path }), /scan failed/);
});

test("detects another invitation's cover image reference", async () => {
  const db = fakeDb([
    { id: "event-a", cover_image_url: null, settings: {} },
    { id: "event-b", cover_image_url: url, settings: {} },
  ]);
  const result = await inspectStorageReferences(db, {
    supabaseUrl: base, bucket: "invitation-photos", path, excludeEventId: "event-a",
  });
  assert.equal(result.referenced, true);
  assert.equal(result.safeToDelete, false);
  assert.equal(result.inspectionOnly, true);
});

test("ambiguous media path across buckets is treated as shared", async () => {
  const db = fakeDb([], [{ event_id: "event-b", storage_path: path }]);
  const result = await inspectStorageReferences(db, {
    supabaseUrl: base, bucket: "invitation-bgm", path, excludeEventId: "event-a",
  });
  // Current event_media records do not carry a bucket discriminator. A matching
  // path must therefore be treated conservatively as potentially shared.
  assert.equal(result.referenced, true);
  assert.equal(result.safeToDelete, false);
});

test("even an unreferenced object is never authorized for deletion by inspection", async () => {
  const result = await inspectStorageReferences(fakeDb([], []), {
    supabaseUrl: base, bucket: "invitation-photos", path,
  });
  assert.equal(result.referenced, false);
  assert.equal(result.safeToDelete, false);
  assert.equal(result.inspectionOnly, true);
});
