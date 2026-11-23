import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const editor = await readFile(new URL("../app/create/page.js", import.meta.url), "utf8");
const start = editor.indexOf("  useEffect(() => {", editor.indexOf("// Debounce position changes;"));
const effect = editor.slice(start, editor.indexOf("  const updateNotice", start));

function fixture() {
  let callback, finishUpload, requestCount = 0, imageUrl, slug = "event-a", owner = "owner-a", fail = false;
  const state = {
    useEffect: run => run(),
    window: { setTimeout: run => { callback = run; return 1; }, clearTimeout() {} },
    crypto: globalThis.crypto,
    eventSlug: slug,
    submitting: "",
    galleryBusy: false,
    kakaoCropY: 50,
    kakaoCrop: { file: new Blob(["same-image"]) },
    kakaoSaveRevision: { current: 0 },
    kakaoSaveBusy: { current: null },
    confirmedKakaoUpload: { current: null },
    photoBusy: { current: false },
    setUploadingPhoto() {},
    setKakaoSharePhotoNotice() {},
    setInvitation(update) { imageUrl = update({}).kakaoShareImageUrl; },
    getSupabaseBrowserClient: () => ({ auth: { getSession: async () => ({
      data: { session: { access_token: "fixture", user: { id: owner } } },
    }) } }),
    prepareKakaoSharePhoto: async (file, _x, y) => new Blob([file, String(y)]),
    ensureEventSlugForUpload: async () => slug,
    fetch: async (_url, options) => {
      requestCount++;
      assert.equal(options.headers["X-Event-Slug"], slug);
      if (finishUpload) await finishUpload;
      return fail ? Response.json({ error: "fixture failure" }, { status: 503 })
        : Response.json({ url: `https://fixture.test/image-${requestCount}` });
    },
  };
  const run = new Function(...Object.keys(state), effect);
  return {
    state, get requestCount() { return requestCount; }, get imageUrl() { return imageUrl; },
    setScope(id, event) { slug = event; owner = id; state.eventSlug = event; },
    failNext(value) { fail = value; },
    hold(promise) { finishUpload = promise; },
    run() { callback = undefined; run(...Object.values(state)); return callback?.(); },
  };
}

test("same confirmed JPEG uses one upload across reselection and editor transitions", async () => {
  const f = fixture();
  await f.run();
  f.state.kakaoCrop = { file: new Blob(["same-image"]) };
  await f.run();
  f.state.galleryBusy = true;
  await f.run();
  f.state.galleryBusy = false;
  await f.run();
  for (let i = 0; i < 2; i++) {
    f.state.submitting = "save";
    await f.run();
    f.state.submitting = "";
    await f.run();
  }
  assert.equal(f.requestCount, 1);
  assert.equal(f.imageUrl, "https://fixture.test/image-1");
  f.state.kakaoCropY = 70;
  await f.run();
  assert.equal(f.requestCount, 2);
});

test("opening an editor with no local crop does not upload an existing image", () => {
  const f = fixture();
  f.state.kakaoCrop = null;
  assert.equal(f.run(), undefined);
  assert.equal(f.requestCount, 0);
});

test("failed upload can retry, and owner/event changes cannot reuse the URL", async () => {
  const f = fixture();
  f.failNext(true);
  await f.run();
  assert.equal(f.imageUrl, undefined);
  f.failNext(false);
  await f.run();
  f.setScope("owner-b", "event-a");
  await f.run();
  f.setScope("owner-b", "event-b");
  await f.run();
  assert.equal(f.requestCount, 4);
});

test("a delayed upload does not duplicate identical bytes or discard a later crop", async () => {
  const f = fixture();
  let release;
  f.hold(new Promise(resolve => { release = resolve; }));
  const initial = f.run();
  while (!f.requestCount) await new Promise(resolve => setImmediate(resolve));
  const duplicate = f.run();
  release();
  await Promise.all([initial, duplicate]);
  assert.equal(f.requestCount, 1);
  assert.equal(f.imageUrl, "https://fixture.test/image-1");

  f.state.kakaoCropY = 60;
  let releaseCrop;
  f.hold(new Promise(resolve => { releaseCrop = resolve; }));
  const crop = f.run();
  while (f.requestCount < 2) await new Promise(resolve => setImmediate(resolve));
  f.state.kakaoCropY = 70;
  const latest = f.run();
  releaseCrop();
  await Promise.all([crop, latest]);
  assert.equal(f.requestCount, 3);
  assert.equal(f.imageUrl, "https://fixture.test/image-3");
});
