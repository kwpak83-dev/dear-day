// Offline regression tests. No environment loading, network, Event or Storage writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const source = file => fs.readFile(new URL(file, root), "utf8");
const dataUrl = text => "data:text/javascript;base64," + Buffer.from(text).toString("base64");
const brandUrl = dataUrl(await source("lib/brand-share-image.js"));
const load = async file => import(dataUrl((await source(file)).replace('"./brand-share-image"', JSON.stringify(brandUrl))));
const brand = await import(brandUrl);
const policy = await load("lib/card-share-image.js");
const cards = await load("lib/event-card-images.js");
const image = brand.getBrandShareImage("https://brand.example/dearday.png");

test("brand share URL is absolute HTTPS with the correct asset", () => {
  assert.equal(new URL(brand.getBrandShareImage().imageUrl).pathname, "/images/dearday-brand-share.png");
  assert.equal(new URL(brand.getBrandShareImage().imageUrl).protocol, "https:");
  for (const url of ["http://brand.example/a.png", "javascript:alert(1)", "https://user:secret@brand.example/a.png"]) assert.equal(brand.getBrandShareImage(url), null);
  assert.equal(image.imageWidth, 1200); assert.equal(image.imageHeight, 630);
});
test("all six card event kinds use brand before manual or historical generated image", () => {
  for (const eventKind of ["wedding", "first_birthday", "birthday", "milestone_birthday", "gathering", "opening"]) {
    const settings = { eventKind, kakaoShareImageUrl: "manual", kakaoShareGenerated: { url: "old", fingerprint: "old" } };
    assert.deepEqual(policy.selectCardShareImage(settings, { hero: { mode: "illustration" } }, "sample-name", image), image);
    assert.deepEqual(policy.selectCardShareImage(settings, { hero: { mode: "illustration" } }, "sample-name", null), { imageUrl: "", imageUnavailable: true });
  }
});
test("photo, frame and legacy Hero keep manual image, fallback and default dimensions", () => {
  for (const mode of ["photo", "frame", undefined]) {
    assert.deepEqual(policy.selectCardShareImage({ kakaoShareImageUrl: "manual" }, { hero: { mode } }, "photo", image), { imageUrl: "manual" });
    assert.deepEqual(policy.selectCardShareImage({ kakaoShareGenerated: { url: "old" } }, { hero: { mode } }, "photo", image), { imageUrl: "photo" });
  }
});
test("ordinary saves preserve server metadata and ignore client replacements", () => {
  const stored = { kakaoShareGenerated: { path: "historical.png" } };
  assert.deepEqual(policy.preserveCardShareMetadata({ eventTitle: "name", kakaoShareGenerated: { path: "tampered" } }, stored), { eventTitle: "name", ...stored });
  assert.deepEqual(policy.preserveCardShareMetadata({ eventTitle: "name", kakaoShareGenerated: {} }), { eventTitle: "name" });
});
test("list images never access Supabase or sample Hero images", async () => {
  const events = ["wedding", "first_birthday", "birthday"].map(kind => ({ kind, settings: { coverPhotoUrl: "old-photo" }, title: "HTML title" }));
  const result = await cards.addEventCardImages(new Proxy({}, { get() { throw Error("DB forbidden"); } }), events);
  assert.deepEqual(result, events.map(event => ({ ...event, cardImageUrl: brand.BRAND_THUMBNAIL_PATH, cardImageSource: "dearday-brand" })));
  assert.deepEqual(events[0].settings, { coverPhotoUrl: "old-photo" });
});
test("retired API cannot access DB or upload files", async () => {
  const api = await import(dataUrl(await source("app/api/events/share-image/route.js")));
  for (const handler of [api.GET, api.POST]) {
    const response = handler(new Proxy({}, { get() { throw Error("request must not be read"); } }));
    assert.equal(response.status, 410); assert.equal((await response.json()).code, "SHARE_IMAGE_RETIRED");
  }
});
test("publish and explicit save complete without capture states or jobs", async () => {
  const code = await source("app/create/page.js");
  assert.doesNotMatch(code, /CardShareImageTask|setCardShareJob|publishShareStatus|updateShareStatus|shareCapture/);
  assert.ok(code.includes('showSavedToast("수정사항이 공개 초대장에 반영되었습니다.")'));
  assert.ok(code.includes("setPublished(true)"));
});

test("PNG assets have the expected dimensions and real PNG signatures", async () => {
  for (const [file, width, height] of [["dearday-brand-share.png", 1200, 630], ["dearday-brand-thumbnail.png", 1086, 1448]]) {
    const bytes = await fs.readFile(new URL("public/images/" + file, root));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), width); assert.equal(bytes.readUInt32BE(20), height);
  }
});
test("my page separates portrait thumbnails from horizontal Kakao images", async () => {
  const code = await source("app/my-invitations/page.js");
  assert.ok(code.includes('<CardImage url={BRAND_THUMBNAIL_PATH} />'));
  assert.ok(code.includes('{...getBrandShareImage()}'));
  assert.doesNotMatch(code, /imageUrl=\{event.cardImageUrl/);
});
