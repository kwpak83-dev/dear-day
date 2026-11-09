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
