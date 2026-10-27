// Offline regression tests. No environment loading, network, Event or Storage writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const source = file => fs.readFile(new URL(file, root), "utf8");
const dataUrl = text => "data:text/javascript;base64," + Buffer.from(text).toString("base64");
const brandUrl = dataUrl(await source("lib/brand-share-image.js"));
const policyUrl = dataUrl((await source("lib/card-share-image.js")).replace('"./brand-share-image"', JSON.stringify(brandUrl)));
const load = async file => import(dataUrl((await source(file)).replace('"./brand-share-image"', JSON.stringify(brandUrl)).replace('"./card-share-image"', JSON.stringify(policyUrl))));
const brand = await import(brandUrl);
const policy = await load("lib/card-share-image.js");
const cards = await load("lib/event-card-images.js");
const image = brand.getBrandShareImage("https://brand.example/dearday.png");

test("brand share URL is absolute HTTPS with the correct asset", () => {
  assert.equal(new URL(image.imageUrl).pathname, "/dearday.png");
  assert.equal(new URL(image.imageUrl).protocol, "https:");
  for (const url of ["http://brand.example/a.png", "javascript:alert(1)", "https://user:secret@brand.example/a.png"]) assert.equal(brand.getBrandShareImage(url), null);
  assert.equal(image.imageWidth, 1730); assert.equal(image.imageHeight, 909);
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
  assert.deepEqual(result, events.map(event => ({ ...event, cardImageUrl: "old-photo", cardImageSource: "user-photo", kakaoShareImage: { imageUrl: "old-photo" } })));
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
  for (const [file, width, height] of [["dearday-brand-share.png", 1730, 909], ["dearday-brand-thumbnail.png", 1087, 1447]]) {
    const bytes = await fs.readFile(new URL("public/images/" + file, root));
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(bytes.readUInt32BE(16), width); assert.equal(bytes.readUInt32BE(20), height);
  }
});
test("my page separates portrait thumbnails from horizontal Kakao images", async () => {
  const code = await source("app/my-invitations/page.js");
  assert.ok(code.includes('url={event.cardImageUrl}'));
  assert.ok(code.includes('event.kakaoShareImage'));
  assert.doesNotMatch(code, /imageUrl=\{event.cardImageUrl/);
});

test("uploaded representative photo wins over old manual image for photo/frame", () => {
  for (const mode of ["photo", "frame"]) assert.deepEqual(policy.selectCardShareImage({ coverPhotoUrl: "uploaded-photo", kakaoShareImageUrl: "old-manual" }, { hero: { mode } }, "legacy"), { imageUrl: "uploaded-photo" });
});
test("saved Hero mode controls list sharing, while thumbnails remain common", async () => {
  const hero1 = "11111111-1111-4111-8111-111111111111", hero2 = "22222222-2222-4222-8222-222222222222";
  const client = { from(table) { assert.equal(table, "hero_presets"); return { select() { return { in() { return Promise.resolve({ data: [{ id: hero1, config: { mode: "illustration" } }, { id: hero2, config: { mode: "frame" } }] }); } }; } }; } };
  const result = await cards.addEventCardImages(client, [{ hero_preset_id: hero1, settings: { coverPhotoUrl: "stale-photo" } }, { hero_preset_id: hero2, settings: { coverPhotoUrl: "uploaded-photo" } }]);
  assert.equal(result[0].kakaoShareImage.imageUrl, brand.getBrandShareImage()?.imageUrl || "");
  assert.equal(result[1].kakaoShareImage.imageUrl, "uploaded-photo");
  assert.equal(result[0].cardImageUrl, brand.BRAND_THUMBNAIL_PATH);
  assert.equal(result[1].cardImageUrl, "uploaded-photo");
  const failed = await cards.addEventCardImages({ from() { throw Error("lookup failed"); } }, [{ hero_preset_id: hero1, settings: { coverPhotoUrl: "stale-photo" } }]);
  assert.equal(failed[0].kakaoShareImage.imageUnavailable, true);
});
test("Kakao image validation rejects local/404 images and accepts a loaded HTTPS PNG", async () => {
  const { prepareKakaoImage } = await load("lib/kakao-share-image.js");
  for (const url of ["http://localhost:3000/a.png", "https://172.30.1.150/a.png", "https://localhost/a.png"]) await assert.rejects(prepareKakaoImage(url), { code: "KAKAO_IMAGE_UNAVAILABLE" });
  class GoodImage { set src(value) { this.naturalWidth = 1200; queueMicrotask(() => this.onload()); } }
  class BadImage { set src(value) { queueMicrotask(() => this.onerror()); } }
  assert.equal(await prepareKakaoImage(image.imageUrl, { ImageClass: GoodImage }), image.imageUrl);
  await assert.rejects(prepareKakaoImage(image.imageUrl, { ImageClass: BadImage }), /404/);
});

test("environment URL selection never assumes localhost or an absent production asset", () => {
  assert.equal(brand.resolveBrandShareImageUrl({}), "");
  assert.equal(brand.resolveBrandShareImageUrl({ NEXT_PUBLIC_SHARE_IMAGE_ORIGIN: "http://localhost:3000" }), "");
  assert.equal(brand.resolveBrandShareImageUrl({ VERCEL_ENV: "preview", VERCEL_URL: "preview.example" }), "https://preview.example/images/dearday-brand-share.png?v=2");
  assert.equal(brand.resolveBrandShareImageUrl({ VERCEL_ENV: "production", VERCEL_URL: "deployment.example", VERCEL_PROJECT_PRODUCTION_URL: "production.example" }), "https://production.example/images/dearday-brand-share.png?v=2");
  assert.equal(brand.resolveBrandShareImageUrl({ NEXT_PUBLIC_SHARE_IMAGE_ORIGIN: "https://images.example", VERCEL_URL: "preview.example" }), "https://images.example/images/dearday-brand-share.png?v=2");
});
test("legacy cover and pinned version select thumbnails without changing invitation data", async () => {
  const versionId = "33333333-3333-4333-8333-333333333333";
  for (const mode of ["photo", "frame", "illustration"]) {
    const client = { from(table) { assert.equal(table, "template_versions"); return { select() { return { in() { return { data: [{ id: versionId, template_id: "body", config: { hero: { mode } } }] }; } }; } }; } };
    const event = { template_version_id: versionId, template_id: "body", cover_image_url: "legacy-upload", settings: {} };
    const before = JSON.stringify(event);
    const [result] = await cards.addEventCardImages(client, [event]);
    assert.equal(result.cardImageUrl, mode === "illustration" ? brand.BRAND_THUMBNAIL_PATH : "legacy-upload");
    assert.equal(JSON.stringify(event), before);
  }
});
test("thumbnail fields do not enter Hero rendering and expected image errors stay in UI", async () => {
  for (const file of ["components/invitation/invitation-renderer.js", "components/invitation/templates/classic-template.js", "components/invitation/template-config-render.js"]) assert.doesNotMatch(await source(file), /cardImageUrl|BRAND_THUMBNAIL_PATH/);
  const code = await source("components/share-actions.js");
  assert.ok(code.includes('if (error?.code !== "KAKAO_IMAGE_UNAVAILABLE") console.error'));
  assert.ok(code.includes('if (duration) noticeTimer.current'));
});

test("full Storage test URL applies only to local development card images", () => {
  const url = "https://project.supabase.co/storage/v1/object/public/template-assets/brand-share-tests/unique/dearday-brand-share.png";
  const env = { NODE_ENV: "development", NEXT_PUBLIC_DEV_CARD_SHARE_IMAGE_URL: url };
  assert.equal(brand.resolveBrandShareImageUrl(env), url);
  assert.equal(brand.resolveBrandShareImageUrl({ ...env, NODE_ENV: "production" }), "");
  assert.equal(brand.resolveBrandShareImageUrl({ ...env, VERCEL_ENV: "preview", VERCEL_URL: "preview.example" }), "https://preview.example/images/dearday-brand-share.png?v=2");
  assert.equal(brand.resolveBrandShareImageUrl({ ...env, NEXT_PUBLIC_DEV_CARD_SHARE_IMAGE_URL: "http://localhost/a.png" }), "");
});

test("version query survives selection and the SDK image preparation unchanged", async () => {
  const url = "https://production.example/images/dearday-brand-share.png?v=2";
  const selected = policy.selectCardShareImage({ kakaoShareGenerated: { url: "old-silver" } }, { hero: { mode: "illustration" } }, "old-fallback", brand.getBrandShareImage(url));
  class Image { set src(value) { this.naturalWidth = 1730; queueMicrotask(() => this.onload()); } }
  const { prepareKakaoImage } = await load("lib/kakao-share-image.js");
  assert.equal(await prepareKakaoImage(selected.imageUrl, { ImageClass: Image }), url);
  const code = await source("components/share-actions.js");
  assert.ok(code.includes("content.imageUrl = verifiedImageUrl;"));
  const page = await source("app/invite/[slug]/page.js");
  assert.ok(page.includes("url: image.imageUrl"));
  assert.ok(page.includes("imageUrl={shareImage.imageUrl}"));
});
