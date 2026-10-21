// Offline mock tests only. No .env loading, network, real Event, or Storage writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { deflateSync } from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let activeDb;
const sandbox = vm.createContext({ Buffer, Blob, URL, Request, Response, DOMException, AbortController,
  TextEncoder, TextDecoder, setTimeout, clearTimeout, console, performance,
  process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://mock.example", SUPABASE_SERVICE_ROLE_KEY: "mock-only" } },
  fetch: () => { throw new Error("Real network forbidden in mock tests"); },
});
const modules = new Map();
async function moduleFor(specifier, parent = path.join(root, "index.js")) {
  if (specifier.startsWith("node:")) {
    if (!modules.has(specifier)) {
      const values = await import(specifier);
      modules.set(specifier, new vm.SyntheticModule(Object.keys(values), function () { for (const key of Object.keys(values)) this.setExport(key, values[key]); }, { context: sandbox }));
    }
    return modules.get(specifier);
  }
  if (specifier === "@supabase/supabase-js") {
    if (!modules.has(specifier)) modules.set(specifier, new vm.SyntheticModule(["createClient"], function () { this.setExport("createClient", () => activeDb); }, { context: sandbox }));
    return modules.get(specifier);
  }
  if (specifier === "next/server") {
    if (!modules.has(specifier)) modules.set(specifier, new vm.SyntheticModule(["NextResponse"], function () { this.setExport("NextResponse", { json: Response.json }); }, { context: sandbox }));
    return modules.get(specifier);
  }
  if (!specifier.startsWith(".")) throw new Error(`Unexpected external dependency: ${specifier}`);
  let filename = path.resolve(path.dirname(parent), specifier);
  if (!path.extname(filename)) filename += ".js";
  assert.ok(filename.startsWith(root + path.sep));
  if (!modules.has(filename)) modules.set(filename, new vm.SourceTextModule(await fs.readFile(filename, "utf8"), { identifier: filename, context: sandbox }));
  return modules.get(filename);
}
async function load(relative) {
  const module = await moduleFor(`./${relative}`);
  if (module.status === "unlinked") await module.link((specifier, parent) => moduleFor(specifier, parent.identifier));
  if (module.status !== "evaluated") await module.evaluate();
  return module.namespace;
}
const policy = await load("lib/card-share-image.js");
const png = await load("lib/card-share-png.js");
const contextModule = await load("lib/card-share-context.js");
const upload = await load("lib/card-share-upload.js");
const jobModule = await load("lib/card-share-job.js");
const browserCapture = await load("lib/browser-hero-png.js");
const route = await load("app/api/events/share-image/route.js");
const eventRoute = await load("app/api/events/route.js");
const ownerId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const templateId = "33333333-3333-4333-8333-333333333333";
const presetId = "44444444-4444-4444-8444-444444444444";
const firstRevision = "2026-01-01T00:00:00.000001+00:00";
const nextRevision = "2026-01-01T00:00:01.000001+00:00";
function mock(kind = "wedding", mode = "illustration", options = {}) {
  const state = { event: { id, owner_id: ownerId, slug: "invite-mock", status: "published", kind,
    template_id: templateId, template_version_id: "pinned", hero_preset_id: presetId, updated_at: firstRevision,
    settings: { groom: "예시", bride: "테스트", childName: "아이", person1Name: "주인공", eventTitle: "행사", date: "2027-01-01", time: "12:00", venue: "예시 장소", venueAddress: "예시 주소" } }, uploads: [], removes: [], updates: 0 };
  const base = { hero: options.omitMode ? {} : { mode: "photo" }, background: { color: "#ffffff" } };
  const db = {
    auth: { getUser: async () => options.unauthorized ? { data: { user: null }, error: {} } : { data: { user: { id: ownerId } }, error: null } },
    storage: { from: () => ({ upload: async (storagePath) => { state.uploads.push(storagePath); return { error: options.uploadFail ? {} : null }; },
      remove: async paths => { state.removes.push(...paths); return { error: null }; } }) },
    from(table) {
      const filters = [], q = { action: "read" };
      const builder = {
        select: () => builder, order: () => builder, limit: () => builder, in: () => builder,
        eq: (key, value) => { filters.push([key, value]); return builder; },
        update: patch => { q.action = "update"; q.patch = patch; return builder; },
        maybeSingle: () => { q.single = true; return resolve(); }, then: (yes, no) => resolve().then(yes, no),
      };
      async function resolve() {
        if (table === "events") {
          if (filters.some(([key, value]) => state.event[key] !== value)) return { data: null, error: null };
          if (q.action === "update") {
            if (options.casFail) return { data: null, error: null };
            state.updates++; state.event = { ...state.event, ...q.patch, updated_at: nextRevision };
            if (options.thrownCommit) throw new Error("Simulated disconnect after commit");
            return { data: state.event, error: options.ambiguousCommit ? {} : null };
          }
          return { data: q.single ? structuredClone(state.event) : [structuredClone(state.event)], error: null };
        }
        if (table === "template_versions") return { data: filters.some(([key]) => key === "status") ? null : { id: "pinned", config: base }, error: null };
        if (table === "templates") { const row = { id: templateId, is_active: true, status: "on_sale", current_sale_version_id: "pinned" }; return { data: q.single ? row : [row], error: null }; }
        if (table === "hero_presets") return { data: { config: { ...(options.omitMode ? {} : { mode }), textLayers: [{ id: "heading", source: "title", x: 50, y: 20, fontSize: 30 }] } }, error: null };
        if (table === "hero_preset_assets") return { data: [], error: null };
        if (table === "event_type_configs") return { data: { fields: {} }, error: null };
        throw new Error(`Unexpected table ${table}`);
      }
      return builder;
    },
  };
  return { db, state };
}
function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12); bytes.writeUInt32BE(data.length); bytes.write(type, 4); data.copy(bytes, 8);
  bytes.writeUInt32BE(png.pngCrc(bytes.subarray(4, bytes.length - 4)), bytes.length - 4); return bytes;
}
function makePng(width = 1200) {
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(630, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * 630);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
}
const bytes = makePng();
async function register(db, state, extra = {}) {
  const context = await contextModule.loadCardShareContext(db, ownerId, state.event.slug);
  return upload.registerCardShareImage({ db, ownerId, context, revision: context.event.updated_at, fingerprint: context.fingerprint,
    bytes, loadContext: contextModule.loadCardShareContext, writesApproved: true, ...extra });
}

for (const kind of ["wedding", "first_birthday", "milestone_birthday", "gathering", "opening"]) {
  test(`${kind}: final preset mode enables card registration (mock writes only)`, async () => {
    const { db, state } = mock(kind); const result = await register(db, state);
    assert.equal(result.image.width, 1200); assert.equal(result.image.height, 630);
    assert.equal(state.updates, 1); assert.equal(state.uploads.length, 1);
    assert.equal(state.event.settings.eventTitle, "행사");
  });
}
test("PNG signature, dimensions, CRC, decoded image and size limits", () => {
  assert.equal(png.pngCrc(Buffer.from("123456789")), 0xcbf43926);
  png.validateCardSharePng(bytes);
  assert.throws(() => png.validateCardSharePng(makePng(1199)));
  const corrupt = Buffer.from(bytes); corrupt[42] ^= 1; assert.throws(() => png.validateCardSharePng(corrupt));
  assert.throws(() => png.validateCardSharePng(Buffer.alloc(policy.CARD_SHARE_MAX_BYTES + 1)));
  const incomplete = Buffer.concat([bytes.subarray(0, 33), chunk("IDAT", deflateSync(Buffer.alloc(2))), chunk("IEND", Buffer.alloc(0))]);
  assert.throws(() => png.validateCardSharePng(incomplete));
});
test("Storage gate prevents all real writes by default", async () => {
  assert.equal(upload.CARD_SHARE_STORAGE_WRITES_APPROVED, false);
  const { db, state } = mock(); await assert.rejects(register(db, state, { writesApproved: false }), /Storage/);
  assert.equal(state.uploads.length, 0); assert.equal(state.updates, 0);
});
test("photo/frame/missing mode cannot register or use an old automatic PNG", async () => {
  for (const mode of ["photo", "frame", undefined]) {
    const { db, state } = mock("wedding", mode, { omitMode: mode === undefined });
    const context = await contextModule.loadCardShareContext(db, ownerId, state.event.slug);
    assert.equal(context.eligible, false); await assert.rejects(register(db, state), /카드형/);
    assert.equal(policy.getCardShareImage(state.event.settings, { hero: { mode } }, { origin: "https://mock.example", ownerId, eventId: id }), null);
    assert.equal(state.uploads.length, 0);
  }
});
test("fingerprint ignores BODY/accounts/message/metadata; tracks HERO and template design", async () => {
  const { db, state } = mock(); const first = await contextModule.loadCardShareContext(db, ownerId, state.event.slug);
  Object.assign(state.event.settings, { groomBank: "은행", message: "본문 변경", bgmMode: "none", kakaoShareGenerated: { fingerprint: "old" } });
  const same = await contextModule.loadCardShareContext(db, ownerId, state.event.slug); assert.equal(first.fingerprint, same.fingerprint);
  state.event.settings.groom = "다른 이름";
  const changed = await contextModule.loadCardShareContext(db, ownerId, state.event.slug); assert.notEqual(first.fingerprint, changed.fingerprint);
});
test("general save retains only trusted server metadata; client cannot inject it", () => {
  const trusted = { path: "trusted" };
  assert.equal(policy.preserveCardShareMetadata({ eventTitle: "새 제목", kakaoShareGenerated: { path: "forged" } }, { kakaoShareGenerated: trusted }).kakaoShareGenerated, trusted);
  assert.equal(policy.preserveCardShareMetadata({ kakaoShareGenerated: { path: "forged" } }).kakaoShareGenerated, undefined);
});
test("upload failure preserves previous metadata and invitation", async () => {
  const { db, state } = mock("wedding", "illustration", { uploadFail: true });
  state.event.settings.kakaoShareGenerated = { path: "previous" };
  await assert.rejects(register(db, state), /업로드/);
  assert.equal(state.event.settings.kakaoShareGenerated.path, "previous"); assert.equal(state.updates, 0);
});
test("edit during capture/upload rejects stale registration and removes only new PNG", async () => {
  const { db, state } = mock(); const before = structuredClone(state.event);
  await assert.rejects(register(db, state, { loadContext: async () => ({ event: { ...before, updated_at: nextRevision }, eligible: true, fingerprint: "changed" }) }), /변경/);
  assert.equal(state.updates, 0); assert.deepEqual(state.removes, state.uploads);
});
test("CAS conflict cannot overwrite a newer save", async () => {
  const { db, state } = mock("wedding", "illustration", { casFail: true });
  await assert.rejects(register(db, state), /다른 수정사항/); assert.equal(state.updates, 0); assert.deepEqual(state.removes, state.uploads);
});
test("ambiguous committed update never deletes the referenced object", async () => {
  const { db, state } = mock("wedding", "illustration", { ambiguousCommit: true });
  const result = await register(db, state); assert.equal(result.image.path, state.event.settings.kakaoShareGenerated.path); assert.equal(state.removes.length, 0);
});
test("thrown connection error after commit confirms registration without deleting PNG", async () => {
  const { db, state } = mock("wedding", "illustration", { thrownCommit: true });
  const result = await register(db, state); assert.equal(result.image.path, state.event.settings.kakaoShareGenerated.path); assert.equal(state.removes.length, 0);
});
test("duplicate fingerprint reuses metadata without a second upload", async () => {
  const { db, state } = mock(); await register(db, state); const result = await register(db, state);
  assert.equal(result.reused, true); assert.equal(state.uploads.length, 1); assert.equal(state.updates, 1);
});
test("simultaneous duplicate registrations have one winner and preserve user settings", async () => {
  const { db, state } = mock();
  const results = await Promise.allSettled([register(db, state), register(db, state)]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  assert.equal(state.updates, 1); assert.equal(state.removes.length, 1);
  assert.equal(state.event.settings.eventTitle, "행사");
  assert.equal(state.removes.includes(state.event.settings.kakaoShareGenerated.path), false);
});
test("card to photo switch keeps metadata but sharing ignores it", async () => {
  const { db, state } = mock(); const result = await register(db, state);
  const inputs = { origin: "https://mock.example", ownerId, eventId: id };
  assert.equal(policy.getCardShareImage(state.event.settings, { hero: { mode: "illustration" } }, inputs).path, result.image.path);
  assert.equal(policy.getCardShareImage(state.event.settings, { hero: { mode: "photo" } }, inputs), null);
});
test("manual > card automatic > legacy fallback; photo/manual retain default image dimensions", async () => {
  const { db, state } = mock(); await register(db, state);
  const identity = { origin: "https://mock.example", ownerId, eventId: id };
  const card = { hero: { mode: "illustration" } }, photo = { hero: { mode: "photo" } };
  const automatic = policy.selectCardShareImage(state.event.settings, card, identity, "legacy");
  assert.equal(automatic.imageWidth, 1200); assert.equal(automatic.imageHeight, 630);
  const manual = policy.selectCardShareImage({ ...state.event.settings, kakaoShareImageUrl: "manual" }, card, identity, "legacy");
  assert.equal(manual.imageUrl, "manual"); assert.equal(manual.imageWidth, undefined);
  const old = policy.selectCardShareImage(state.event.settings, photo, identity, "legacy");
  assert.equal(old.imageUrl, "legacy"); assert.equal(old.imageWidth, undefined); assert.equal(old.imageHeight, undefined);
});
test("unauthenticated, wrong owner and closed-gate API requests never write", async () => {
  const { db, state } = mock(); activeDb = db;
  const base = "https://local.example/api/events/share-image?slug=invite-mock";
  assert.equal((await route.GET(new Request(base))).status, 401);
  state.event.owner_id = "other";
  assert.equal((await route.GET(new Request(base, { headers: { Authorization: "Bearer mock" } }))).status, 404);
  state.event.owner_id = ownerId;
  const context = await contextModule.loadCardShareContext(db, ownerId, state.event.slug);
  const get = await route.GET(new Request(base + "&revision=" + encodeURIComponent(firstRevision), { headers: { Authorization: "Bearer mock" } }));
  assert.equal((await get.json()).storageApproved, false);
  const response = await route.POST(new Request(base, { method: "POST", headers: { Authorization: "Bearer mock", "Content-Type": "image/png", "X-Share-Revision": firstRevision, "X-Share-Fingerprint": context.fingerprint }, body: bytes }));
  assert.equal(response.status, 503); assert.equal(state.uploads.length, 0); assert.equal(state.updates, 0);
});
test("API rejects invalid JWT, MIME, oversized body and malformed PNG before writes", async () => {
  const denied = mock("wedding", "illustration", { unauthorized: true }); activeDb = denied.db;
  const endpoint = "https://local.example/api/events/share-image?slug=invite-mock";
  assert.equal((await route.GET(new Request(endpoint, { headers: { Authorization: "Bearer invalid" } }))).status, 401);
  const { db, state } = mock(); activeDb = db;
  const context = await contextModule.loadCardShareContext(db, ownerId, state.event.slug);
  const headers = { Authorization: "Bearer mock", "Content-Type": "image/png", "X-Share-Revision": firstRevision, "X-Share-Fingerprint": context.fingerprint };
  for (const [extra, body, status] of [[{ "Content-Type": "image/jpeg" }, bytes, 415], [{ "Content-Length": String(policy.CARD_SHARE_MAX_BYTES + 1) }, bytes, 413], [{}, Buffer.from("not png"), 400]]) {
    const response = await route.POST(new Request(endpoint, { method: "POST", headers: { ...headers, ...extra }, body }));
    assert.equal(response.status, status);
  }
  assert.equal(state.uploads.length, 0); assert.equal(state.updates, 0);
});
test("browser capture rejects a stale public render before fetching images or fonts", async () => {
  for (const patch of [{ cardShareFingerprint: "old" }, { cardShareRevision: "old" }, { cardShareMode: "photo" }]) {
    const marker = { dataset: { cardShareFingerprint: "expected", cardShareRevision: "revision", cardShareMode: "illustration", ...patch } };
    const article = { closest: () => marker }, hero = { closest: () => article };
    const doc = { readyState: "complete", querySelector: selector => selector === ".suspended-invitation" ? null : hero, querySelectorAll: () => [hero] };
    const frame = { contentDocument: doc, contentWindow: { location: { pathname: "/invite/mock" } } };
    await assert.rejects(browserCapture.browserHeroPng(frame, "/invite/mock", { signal: new AbortController().signal, onStage() {}, expectedFingerprint: "expected", expectedRevision: "revision" }), /변경/);
  }
});
test("ordinary published Event save retains server image, returns revision, and rejects forged metadata", async () => {
  const { db, state } = mock(); activeDb = db;
  const stored = { path: "server-owned", fingerprint: "previous" };
  state.event.settings.kakaoShareGenerated = stored;
  const response = await eventRoute.POST(new Request("https://local.example/api/events", { method: "POST", headers: { Authorization: "Bearer mock", "Content-Type": "application/json" },
    body: JSON.stringify({ slug: state.event.slug, invitation: { ...state.event.settings, eventKind: "wedding", templateId, heroPresetId: presetId, kakaoShareGenerated: { path: "forged" } } }) }));
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.revision, nextRevision); assert.equal(state.event.settings.kakaoShareGenerated.path, "server-owned");
});
test("first publication returns a capture revision without changing pinned Version", async () => {
  const { db, state } = mock(); activeDb = db; state.event.status = "paid";
  const response = await eventRoute.POST(new Request("https://local.example/api/events", { method: "POST", headers: { Authorization: "Bearer mock", "Content-Type": "application/json" },
    body: JSON.stringify({ slug: state.event.slug, publish: true, invitation: { ...state.event.settings, eventKind: "wedding", templateId, heroPresetId: presetId } }) }));
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.status, "published"); assert.equal(result.revision, nextRevision);
  assert.equal(state.event.template_version_id, "pinned"); assert.equal(state.uploads.length, 0);
});
test("ordinary Event save cannot overwrite metadata after a CAS conflict", async () => {
  const { db, state } = mock("wedding", "illustration", { casFail: true }); activeDb = db;
  state.event.settings.kakaoShareGenerated = { path: "trusted" };
  const response = await eventRoute.POST(new Request("https://local.example/api/events", { method: "POST", headers: { Authorization: "Bearer mock", "Content-Type": "application/json" },
    body: JSON.stringify({ slug: state.event.slug, invitation: { ...state.event.settings, eventKind: "wedding", templateId, heroPresetId: presetId } }) }));
  assert.equal(response.status, 409); assert.equal(state.updates, 0); assert.equal(state.event.settings.kakaoShareGenerated.path, "trusted");
});
test("client job skips photos and identical images; generation/upload failures do not resave Event", async () => {
  const { db, state } = mock(); const context = await contextModule.loadCardShareContext(db, ownerId, state.event.slug);
  for (const mode of ["photo", "unchanged", "disabled", "capture-fail", "upload-fail", "success"]) {
    let requests = 0, captures = 0;
    const run = jobModule.runCardShareJob({ job: { slug: state.event.slug, revision: firstRevision }, token: "mock", signal: new AbortController().signal,
      capture: async () => { captures++; if (mode === "capture-fail") throw new Error("CORS test failure"); return { blob: new Blob([bytes], { type: "image/png" }) }; },
      fetcher: async (url, options) => {
        requests++;
        if (!options.method) return Response.json({ eligible: mode !== "photo", revision: firstRevision, fingerprint: context.fingerprint, needsGeneration: mode !== "unchanged", storageApproved: mode !== "disabled" });
        assert.equal(url.startsWith("/api/events/share-image?"), true);
        return mode === "upload-fail" ? Response.json({ error: "mock upload failure" }, { status: 503 }) : Response.json({ image: { path: "mock" } });
      } });
    if (["disabled", "capture-fail", "upload-fail"].includes(mode)) await assert.rejects(run);
    else assert.equal((await run).state, mode === "photo" ? "not-card" : mode === "unchanged" ? "unchanged" : "saved");
    assert.equal(captures, ["photo", "unchanged", "disabled"].includes(mode) ? 0 : 1);
    assert.equal(requests, ["success", "upload-fail"].includes(mode) ? 2 : 1);
    assert.equal(state.updates, 0);
  }
});
