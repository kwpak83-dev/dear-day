import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

const read = path => readFile(new URL(path, import.meta.url), "utf8");
const helperSource = (await read("../lib/invitation-upload-reservation.js")).replaceAll("export ", "");
const makeHelpers = new Function("process", `${helperSource}\nreturn { reserveUpload, finishReservedUpload };`);
const source = (await read("../app/api/gallery/route.js")).replace(/^import .*$/gm, "");
const makeHandlers = new Function("dependencies", `
  const { createHash, galleryContext, mutateGallery, readGallery, cleanupGallery,
    readPhotoBytes, photoForClient, GalleryError, GALLERY_BUCKET, MAX_PHOTO_BYTES,
    reserveUpload, finishReservedUpload, process } = dependencies;
  ${source.replaceAll("export const", "const")}
  return { PUT, PATCH, DELETE };
`);
const owner = "10000000-0000-4000-8000-000000000001";
const event = "20000000-0000-4000-8000-000000000001";
const media = "30000000-0000-4000-8000-000000000001";
const bucket = "invitation-photos";
const path = `${owner}/gallery/${event}/${media}.jpg`;
const bytes = Buffer.from([255, 216, 255, 217]);
const hash = createHash("sha256").update(bytes).digest("hex");

function fixture({ enabled = true, published = false, ...options } = {}) {
  const row = { id: media, gallery_state: options.ready ? "ready" : "pending", storage_path: options.rowPath || path, sort_order: 4 };
  let object = options.ready ? bytes : null;
  if (options.object !== undefined) object = options.object;
  let reservation = options.reservation === undefined ? null : options.reservation;
  let failures = options.failures || 0;
  const calls = [];
  const response = value => Response.json(value);
  const supabase = createClient("https://fixture.test", "fixture", {
    auth: { persistSession: false },
    global: { fetch: async (url, request) => {
      const { pathname, searchParams } = new URL(url);
      const name = pathname.split("/").at(-1);
      calls.push(name);
      if (name === "event_media") return response({ content_hash: hash });
      if (name === "invitation_upload_reservations") {
        const match = reservation && Object.entries(reservation.key).every(([k, v]) => searchParams.get(k) === `eq.${v}`);
        return response(match ? [{ id: reservation.id, status: reservation.status }] : []);
      }
      if (name === "reserve_invitation_upload") {
        if (options.denyReservation) return response(null);
        const args = JSON.parse(request.body);
        reservation = existing("reserved", { event_id: args.p_event, owner_id: args.p_owner, bucket: args.p_bucket, storage_path: args.p_path });
        return response(reservation.id);
      }
      if (name === "finish_invitation_upload") {
        assert.deepEqual(JSON.parse(request.body), { p_reservation: "reservation", p_owner: owner, p_uploaded: true });
        if (failures > 0) { failures--; return response(false); }
        if (reservation.status !== "reserved") return response(false);
        reservation.status = "uploaded";
        return response(true);
      }
      if (pathname === `/storage/v1/bucket/${bucket}`) return response({ id: bucket });
      if (pathname.endsWith(`/${bucket}/${path}`)) {
        if (request.method === "POST") {
          calls.push("upload");
          if (options.uploadError) return Response.json({ message: "fixture upload failed" }, { status: 500 });
          object = bytes;
          return response({ Key: path });
        }
        calls.push("download");
        return object ? new Response(object) : new Response(null, { status: 404 });
      }
      throw Error(`Unexpected fixture request: ${pathname}`);
    } },
  });
  class GalleryError extends Error {
    constructor(message, status) { super(message); this.status = status; }
  }
  const process = { env: { INVITATION_UPLOAD_RESERVATIONS_READY: String(enabled) } };
  const handlers = makeHandlers({
    ...makeHelpers(process), process, createHash, GalleryError, GALLERY_BUCKET: bucket, MAX_PHOTO_BYTES: 3 * 1024 * 1024,
    galleryContext: async () => ({ supabase, event: { id: event, status: published ? "published" : "draft" }, user: { id: owner } }),
    mutateGallery: async (_context, action) => {
      calls.push(action);
      if (action === "begin" && row.gallery_state === "pending") row.gallery_state = "uploading";
      if (action === "finish") row.gallery_state = "ready";
      if (action === "reorder") row.sort_order = 0;
      if (action === "delete") row.gallery_state = "deleting";
      return row;
    },
    readPhotoBytes: async req => Buffer.from(await req.arrayBuffer()),
    photoForClient: (_client, photo) => ({ url: photo.storage_path, sortOrder: photo.sort_order }),
    cleanupGallery: async () => { calls.push("cleanup"); },
    readGallery: async () => ({ photos: [] }),
  });
  return {
    calls, row, get reservation() { return reservation; },
    call(method = "PUT") {
      const body = method === "PUT" ? bytes : method === "PATCH" ? JSON.stringify({ ids: [media], expected: [media] }) : undefined;
      return handlers[method](new Request(`https://fixture.test/api/gallery?id=${media}`, { method, body }));
    },
  };
}

function existing(status, key = {}) {
  return { id: "reservation", status, key: { owner_id: owner, event_id: event, bucket, storage_path: path, ...key } };
}

for (const published of [false, true]) test(`T01/T11 initial upload (published=${published})`, async () => {
  const f = fixture({ published });
  assert.equal((await f.call()).status, 200);
  assert.equal(f.row.gallery_state, "ready");
  assert.deepEqual(f.reservation, existing("uploaded"));
});

test("T02 → T03 ready row recovers the original reservation after one failure", async () => {
  const f = fixture({ failures: 1 });
  assert.equal((await f.call()).status, 503);
  assert.equal(f.row.gallery_state, "ready");
  assert.deepEqual(f.reservation, existing("reserved"));
  const response = await f.call();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { duplicate: true, photo: { url: path, sortOrder: 4 } });
  assert.deepEqual(f.reservation, existing("uploaded"));
  for (const name of ["upload", "reserve_invitation_upload", "download"]) {
    assert.equal(f.calls.filter(call => call === name).length, 1);
  }
});

test("T04 uploaded reservation preserves the duplicate response without a download", async () => {
  const f = fixture({ ready: true, reservation: existing("uploaded") });
  assert.equal((await (await f.call()).json()).duplicate, true);
  assert.ok(!f.calls.includes("download") && !f.calls.includes("finish_invitation_upload"));
});

test("retry after losing the success response never uploads or reserves twice", async () => {
  const f = fixture();
  await f.call();
  assert.equal((await (await f.call()).json()).duplicate, true);
  assert.deepEqual(f.reservation, existing("uploaded"));
  for (const name of ["reserve_invitation_upload", "upload", "finish_invitation_upload"]) {
    assert.equal(f.calls.filter(call => call === name).length, 1);
  }
});

for (const [name, options] of [
  ["T05 no reservation", {}],
  ["T06 different owner", { reservation: existing("reserved", { owner_id: event }) }],
  ["T07 different event", { reservation: existing("reserved", { event_id: owner }) }],
  ["T08 missing object", { reservation: existing("reserved"), object: null }],
  ["T09 mismatched bucket", { reservation: existing("reserved", { bucket: "template-assets" }) }],
  ["T09 mismatched reservation path", { reservation: existing("reserved", { storage_path: path + ".jpg" }) }],
  ["T09 mismatched media path", { reservation: existing("reserved"), rowPath: path + ".jpg" }],
  ["object hash differs", { reservation: existing("reserved"), object: Buffer.from("other object") }],
  ["reservation marked failed", { reservation: existing("failed") }],
]) test(name, async () => {
  const f = fixture({ ready: true, ...options });
  assert.equal((await f.call()).status, 503);
  for (const call of ["finish_invitation_upload", "reserve_invitation_upload", "upload"]) assert.ok(!f.calls.includes(call));
});

test("T10 concurrent retries converge on the same uploaded reservation", async () => {
  const f = fixture({ ready: true, reservation: existing("reserved") });
  const responses = await Promise.all([f.call(), f.call()]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  assert.deepEqual(f.reservation, existing("uploaded"));
  assert.ok(!f.calls.includes("upload") && !f.calls.includes("reserve_invitation_upload"));
});

test("T12/T13 reorder and deletion preserve the upload reservation", async () => {
  const f = fixture({ ready: true, reservation: existing("uploaded") });
  assert.equal((await f.call("PATCH")).status, 200);
  assert.equal(f.row.sort_order, 0);
  assert.equal((await f.call("DELETE")).status, 200);
  assert.equal(f.row.gallery_state, "deleting");
  assert.deepEqual(f.reservation, existing("uploaded"));
  assert.deepEqual(f.calls, ["reorder", "delete", "cleanup"]);
});

test("photos still reserve when the BGM rollout flag is disabled", async () => {
  const f = fixture({ enabled: false });
  assert.equal((await f.call()).status, 200);
  assert.deepEqual(f.reservation, existing("uploaded"));
});

test("reservation rejection blocks Storage upload", async () => {
  const f = fixture({ denyReservation: true });
  assert.equal((await f.call()).status, 409);
  assert.ok(!f.calls.includes("upload"));
});

test("an unsuccessful Storage upload leaves the reservation unconfirmed", async () => {
  const f = fixture({ uploadError: true });
  assert.equal((await f.call()).status, 500);
  assert.deepEqual(f.reservation, existing("reserved"));
  assert.ok(!f.calls.includes("finish_invitation_upload"));
});

test("T16 persistent RPC failures remain retryable and return errors", async () => {
  const f = fixture({ ready: true, reservation: existing("reserved"), failures: 3 });
  for (let attempt = 0; attempt < 3; attempt++) assert.equal((await f.call()).status, 503);
  assert.deepEqual(f.reservation, existing("reserved"));
  assert.ok(!f.calls.includes("upload") && !f.calls.includes("reserve_invitation_upload"));
});

test("editor retries an already visible original even when the gallery is full", async () => {
  const editor = await read("../app/create/gallery-editor.js");
  const selection = editor.slice(editor.indexOf("  const selectPhotos ="), editor.indexOf("  const remove ="));
  const methods = [];
  const selectPhotos = new Function("deps", `
    const { photos, crypto, request } = deps;
    const loaded = true, pending = 0, LIMIT = 20, slug = "fixture";
    const currentSlug = { current: slug };
    const start = () => true;
    const preparePhoto = async file => file;
    const setFailures = () => {}, setProgress = () => {}, setNotice = () => {}, end = () => {};
    const apply = () => {};
    ${selection}
    return selectPhotos;
  `)({
    photos: [{ id: media, hash, thumbnailUrl: "exists" }, ...Array.from({ length: 19 }, () => ({}))],
    crypto: globalThis.crypto,
    request: async (method, _body, id) => {
      methods.push([method, id]);
      return { duplicate: true };
    },
  });
  await selectPhotos({ target: { files: [new Blob([bytes])], value: "selected" } });
  assert.deepEqual(methods, [["PUT", media], ["GET", undefined]]);
});
