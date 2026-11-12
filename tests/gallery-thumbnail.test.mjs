import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = (await readFile(new URL("../app/api/gallery/thumbnail/route.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replace("export async function PUT", "async function PUT");
const id = "11111111-1111-4111-8111-111111111111";
const path = "owner/photo/event/thumb.webp";
const valid = Buffer.from("UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=", "base64");
class GalleryError extends Error { constructor(message, status) { super(message); this.status = status; } }

function fixture(options = {}) {
  const calls = [];
  const db = {
    from() {
      const q = { select: () => q, eq: () => q, maybeSingle: async () => ({
        data: options.missing ? null : { storage_path: "original.jpg", gallery_state: options.state || "ready", gallery_thumbnail_path: options.existing },
        error: options.lookupError,
      }) };
      return q;
    },
    async rpc(name, args) {
      calls.push({ name, args });
      if (name === "reserve_invitation_upload") return { data: "reservation", error: options.reserveError };
      if (name === "finish_invitation_upload") return { data: !options.finishError };
      if (name === "link_gallery_thumbnail") return { data: options.deleted ? null : options.winner || args.p_path, error: options.linkError };
      throw Error("Unexpected RPC");
    },
    storage: { from: () => ({ getPublicUrl: p => ({ data: { publicUrl: `https://fixture.test/${p}` } }),
      upload: async (p, bytes, settings) => { calls.push({ name: "upload", path: p, settings }); return { error: options.uploadError }; },
      remove: () => { throw Error("Physical deletion forbidden"); },
    }) },
  };
  const handler = runInNewContext(`${source}\nPUT`, {
    Buffer, URL, Response, GalleryError, GALLERY_BUCKET: "invitation-photos", randomUUID: () => id,
    databaseError: e => new GalleryError("DB unavailable", ["42703", "PGRST204", "PGRST202"].includes(e.code) ? 503 : 500),
    galleryContext: async () => { if (options.authError) throw new GalleryError("Unauthorized", 401); return { supabase: db, user: { id: "owner" }, event: { id: "event" } }; },
  });
  return { calls, run: (body = valid, headers = {}, mediaId = id) => handler(new Request(`https://fixture.test/api/gallery/thumbnail?slug=fixture&id=${mediaId}`, { method: "PUT", headers: { "content-type": "image/webp", ...headers }, body })) };
}

test("thumbnail reserves, uploads immutably, completes reservation and atomically links", async () => {
  const f = fixture(); const r = await f.run(); assert.equal(r.status, 200);
  assert.deepEqual(f.calls.map(c => c.name), ["reserve_invitation_upload", "upload", "finish_invitation_upload", "link_gallery_thumbnail"]);
  assert.equal(f.calls[1].settings.upsert, false);
  assert.match(f.calls[1].path, /^owner\/photo\/event\/.+\.webp$/);
});
test("existing thumbnail returns without uploading", async () => { const f = fixture({ existing: path }); assert.equal((await f.run()).status, 200); assert.equal(f.calls.length, 0); });
test("concurrent upload returns the DB winner", async () => { const f = fixture({ winner: path }); assert.equal((await (await f.run()).json()).thumbnailUrl, `https://fixture.test/${path}`); });
for (const [name, opts, status] of [
  ["unauthenticated", { authError: true }, 401], ["foreign or missing row", { missing: true }, 404],
  ["deleting row", { state: "deleting" }, 404], ["old schema", { lookupError: { code: "42703" } }, 503],
  ["reservation blocked", { reserveError: {} }, 409], ["upload conflict is not accepted as success", { uploadError: { statusCode: "409" } }, 503],
  ["lost finish response", { finishError: true }, 503], ["deleted during upload", { deleted: true }, 409],
]) test(name, async () => { const f = fixture(opts); assert.equal((await f.run()).status, status); });
test("invalid UUID is rejected before upload", async () => { const f = fixture(); assert.equal((await f.run(valid, {}, "-".repeat(36))).status, 400); assert.equal(f.calls.length, 0); });
test("truncated WebP is rejected before reservation", async () => { const f = fixture(); assert.equal((await f.run(Buffer.from("RIFF0000WEBP"))).status, 400); assert.equal(f.calls.length, 0); });
test("oversize streaming input without content length is bounded", async () => { const f = fixture(); assert.equal((await f.run(Buffer.alloc(150 * 1024 + 1))).status, 413); assert.equal(f.calls.length, 0); });
test("incorrect MIME type is rejected", async () => { const f = fixture(); assert.equal((await f.run(valid, { "content-type": "image/jpeg" })).status, 415); });

const gallerySource = (await readFile(new URL("../lib/gallery-server.js", import.meta.url), "utf8"))
  .replace(/^import .*;\r?\n/gm, "").replaceAll("export ", "");
for (const oldSchema of [false, true]) test(`gallery read preserves originals and optional thumbnails (${oldSchema ? "old" : "new"} schema)`, async () => {
  let reads = 0;
  const row = { id, storage_path: "original.jpg", gallery_state: "ready", ...(oldSchema ? {} : { gallery_thumbnail_path: "thumb.webp" }) };
  const db = {
    from() {
      const q = { select: () => q, eq: () => q, not: () => q, order: () => q,
        then(resolve) { return Promise.resolve(oldSchema && reads++ === 0 ? { error: { code: "42703" } } : { data: [row, { gallery_state: "deleting" }, { gallery_state: "pending" }] }).then(resolve); },
      }; return q;
    },
    storage: { from: () => ({ getPublicUrl: p => ({ data: { publicUrl: `https://fixture.test/${p}` } }) }) },
  };
  const read = runInNewContext(`${gallerySource}\nreadGallery`, {});
  const result = await read({ supabase: db, event: { id: "event" } });
  assert.equal(result.photos.length, 1); assert.equal(result.photos[0].url, "https://fixture.test/original.jpg");
  assert.equal(result.photos[0].thumbnailUrl, oldSchema ? null : "https://fixture.test/thumb.webp");
  assert.equal(result.pendingCount, 1); assert.equal(result.cleanupPending, true);
});
