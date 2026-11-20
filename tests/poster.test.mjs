import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { checkExport, missingMedia, parsePoster } from "../lib/poster-validation.mjs";

const ids = Array.from({ length: 4 }, (_, i) => `00000000-0000-4000-8000-00000000000${i}`);
const photos = ids.map(mediaId => ({ mediaId }));
const input = { designKey: "playful-pop", settings: { englishNames: { groom: " Sam " }, gallery: { photos: photos.slice(0, 2) } } };

test("partial galleries save and changing design preserves common settings", () => {
  const a = parsePoster(input);
  const b = parsePoster({ ...a, designKey: "modern-editorial" });
  assert.deepEqual(a.settings, b.settings);
  assert.equal(a.settings.englishNames.groom, "Sam");
  assert.equal(a.settings.gallery.photos.length, 2);
});

test("duplicate IDs, invalid main ID, crop and cover source are rejected", () => {
  for (const settings of [
    { gallery: { photos: [photos[0], photos[0]] } },
    { gallery: { photos: [photos[0]], mainMediaId: ids[1] } },
    { cover: { crop: { x: 101 } } },
    { cover: { source: "external" } },
  ]) assert.throws(() => parsePoster({ ...input, settings }), { status: 400 });
});

test("only page 2 and the combined output require four ready photos", () => {
  const source = { autoCoverUrl: "https://example.test/cover" };
  const settings = parsePoster(input).settings;
  assert.doesNotThrow(() => checkExport("page1", settings, source, []));
  assert.doesNotThrow(() => checkExport("page3", settings, {}, []));
  for (const scope of ["page2", "all"]) assert.throws(() => checkExport(scope, settings, source, []), { status: 422 });
  const complete = parsePoster({ ...input, settings: { gallery: { photos, mainMediaId: ids[0] } } }).settings;
  const ready = ids.map(id => ({ id }));
  assert.doesNotThrow(() => checkExport("all", complete, source, ready));
  assert.deepEqual(missingMedia(complete, ready.slice(1)), [ids[0]]);
});

test("untrusted cover URLs cannot select another event or escape the event folder", async () => {
  const hook = registerHooks({ resolve(specifier, context, next) {
    return next(specifier === "./invitation-retention" ? specifier + ".js" : specifier, context);
  } });
  try {
    const { eventPhotoPath } = await import("../lib/poster-server.js");
    const event = { owner_id: ids[0], id: ids[1] };
    const base = "https://storage.example.test";
    const path = `${ids[0]}/photo/${ids[1]}/${ids[2]}.webp`;
    const url = base + "/storage/v1/object/public/invitation-photos/" + path;
    assert.equal(eventPhotoPath(url, base, event), path);
    assert.equal(eventPhotoPath(url.replace(`/photo/${ids[1]}`, ""), base, event), `${ids[0]}/${ids[2]}.webp`);
    for (const value of [url.replace(ids[1], ids[3]), url + "?x=1", url.replace(base, "https://other.test"), url.replace(ids[2], "%2e%2e")]) {
      assert.equal(eventPhotoPath(value, base, event), null);
    }
  } finally { hook.deregister(); }
});

test("API enforces owner and expiry, maps revision conflicts and returns missing IDs", async () => {
  const { getPoster, putPoster, exportPosterPreflight } = await import("../lib/poster-server.js");
  const oldFetch = globalThis.fetch;
  const oldEnv = Object.fromEntries(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "POSTER_PUBLIC_ORIGIN"]
    .map(key => [key, process.env[key]]));
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://mock.invalid", SUPABASE_SERVICE_ROLE_KEY: "fixture",
    POSTER_PUBLIC_ORIGIN: "https://invitations.example.test" });
  const event = { id: ids[1], owner_id: ids[0], slug: "fixture-event", kind: "wedding",
    status: "published", retention_v2: false, service_expires_at: "2099-01-01T00:00:00Z", settings: {} };
  const calls = [];
  globalThis.fetch = async (resource, options) => {
    const url = new URL(resource);
    assert.equal(url.origin, "https://mock.invalid");
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: ids[0] });
    if (url.pathname.endsWith("/events")) return Response.json(url.searchParams.get("owner_id") === `eq.${event.owner_id}` ? event : null);
    if (url.pathname.endsWith("/invitation_posters")) return Response.json({ design_key: "playful-pop", settings: input.settings, revision: 1 });
    if (url.pathname.endsWith("/event_media")) return Response.json([]);
    if (url.pathname.endsWith("/event_type_configs")) return Response.json(null);
    if (url.pathname.endsWith("/rpc/save_invitation_poster")) {
      const args = JSON.parse(options.body);
      assert.equal(args.p_owner, ids[0]);
      return Response.json({ error: "revision_conflict" });
    }
    throw new Error("Unexpected mock endpoint");
  };
  try {
    const ctx = { params: Promise.resolve({ slug: event.slug }) };
    const req = (method, body, authed = true) => new Request("http://localhost", {
      method, headers: authed ? { authorization: "Bearer fixture" } : {},
      ...(body && { body: JSON.stringify(body) }),
    });
    assert.equal((await getPoster(req("GET", null, false), ctx)).status, 401);
    event.owner_id = ids[3];
    assert.equal((await getPoster(req("GET"), ctx)).status, 404);
    assert.equal(calls.includes("/rest/v1/invitation_posters"), false);
    event.owner_id = ids[0];
    event.status = "suspended";
    assert.equal((await getPoster(req("GET"), ctx)).status, 409);
    event.status = "published";
    const got = await getPoster(req("GET"), ctx);
    assert.equal(got.headers.get("cache-control"), "no-store");
    assert.deepEqual((await got.json()).missingMediaIds, ids.slice(0, 2));
    assert.equal((await putPoster(req("PUT", { ...input, expectedRevision: 0 }), ctx)).status, 409);
    const exportResult = await exportPosterPreflight(req("POST", { ...input, scope: "page3" }), ctx);
    assert.equal((await exportResult.json()).source.publicUrl, "https://invitations.example.test/invite/fixture-event");
    event.service_expires_at = "2000-01-01T00:00:00Z";
    assert.equal((await exportPosterPreflight(req("POST", { ...input, scope: "page3" }), ctx)).status, 410);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(oldEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("wedding account groups match the invitation's couple and parent rows", async () => {
  const { posterAccounts } = await import("../lib/poster-server.js");
  const settings = { groom: "신랑 이름", groomAccount: " 123 ", groomFatherAccount: "456",
    groomFatherName: "아버지 이름", groomMotherAccount: " ", brideAccount: "789" };
  const groups = [{ key: "groom", label: "신랑 가족" }, { key: "bride", label: "신부 가족" }];
  const config = state => ({ fields: { accounts: { state, groups } } });
  assert.deepEqual(posterAccounts(settings, config("optional"), "groom"), {
    groom: { label: "신랑 가족", rows: [
      { label: "신랑", number: "123", bank: "", holder: "신랑 이름" },
      { label: "신랑 아버지", number: "456", bank: "", holder: "아버지 이름" },
    ] },
  });
  assert.equal(posterAccounts(settings, null, "bride").bride.rows.length, 1);
  assert.deepEqual(posterAccounts(settings, config("optional"), "none"), {});
  assert.deepEqual(posterAccounts(settings, config("none")), {});
});

test("auto cover prefers an existing representative photo and then verified HERO slots", async () => {
  const { autoCover } = await import("../lib/poster-server.js");
  const url = "https://storage.example.test";
  const prefix = url + "/storage/v1/object/public/invitation-photos/";
  const legacy = `${ids[0]}/${ids[2]}.jpg`;
  const cover = `${ids[0]}/photo/${ids[1]}/${ids[2]}.jpg`;
  const slot = `${ids[0]}/photo/${ids[1]}/${ids[3]}.webp`;
  const event = { id: ids[1], owner_id: ids[0], hero_preset_id: ids[2], settings: {
    coverPhotoUrl: prefix + cover, coverPhoto: prefix + legacy,
    heroSlotPhotos: { hidden: prefix + cover, unrelated: prefix + slot.replace(ids[1], ids[2]), valid: prefix + slot },
  } };
  const existing = new Set([cover, slot, legacy]);
  let reservation = false;
  const calls = [];
  const supabase = {
    storage: { from: () => ({
      exists: async path => { calls.push(path); return { data: existing.has(path) }; },
      getPublicUrl: path => ({ data: { publicUrl: prefix + path } }),
    }) },
    from: table => {
      const filters = {};
      const q = { select: () => q, eq: (key, value) => { filters[key] = value; return q; },
        maybeSingle: async () => {
          if (table === "hero_presets") return { data: { config: {
            photoLayers: [{ id: "hidden", visible: false }, { id: "unrelated" }, { id: "valid" }],
          } } };
          assert.equal(table, "invitation_upload_reservations");
          assert.deepEqual(filters, { bucket: "invitation-photos", storage_path: legacy,
            event_id: ids[1], owner_id: ids[0], status: "uploaded" });
          return { data: reservation ? { id: ids[2] } : null };
        } };
      return q;
    },
  };
  assert.equal(await autoCover({ supabase, event, url }), prefix + cover);
  existing.delete(cover);
  assert.equal(await autoCover({ supabase, event, url }), prefix + slot);
  assert.deepEqual(calls, [cover, cover, slot]);
  reservation = true;
  assert.equal(await autoCover({ supabase, event, url }), prefix + legacy);
  reservation = false;
  existing.delete(slot);
  assert.equal(await autoCover({ supabase, event, url }), null);
});
