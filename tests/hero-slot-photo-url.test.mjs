import assert from "node:assert/strict";
import test from "node:test";
import { isHeroSlotPhotoUrl } from "../lib/hero-slot-photo-url.mjs";

const base = "https://example.test/storage/v1/object/public/invitation-photos/";
const owner = base + "11111111-1111-4111-8111-111111111111/";
const event = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const file = "44444444-4444-4444-8444-444444444444.webp";

test("HERO slots accept legacy owner paths and the saved event's photo paths", () => {
  assert.equal(isHeroSlotPhotoUrl(owner + file, owner), true);
  assert.equal(isHeroSlotPhotoUrl(owner + "photo/" + event + "/" + file, owner, event), true);
});

test("HERO slots reject cross-event and cross-owner paths and ambiguous URLs", () => {
  for (const url of [
    owner + "photo/" + other + "/" + file,
    base + other + "/" + file,
    owner + "photo/" + event + "/../" + file,
    owner + "photo/" + event + "/%2e%2e/" + file,
    owner + "photo%2f" + event + "%2f" + file,
    owner + "photo%252f" + event + "%252f" + file,
    owner + "photo\\" + event + "\\" + file,
    owner + "gallery/" + event + "/" + file,
    owner + file + "?download",
    owner + file + "#fragment",
    owner + file + "\n",
    owner + "-".repeat(36) + ".webp",
  ]) assert.equal(isHeroSlotPhotoUrl(url, owner, event), false, url);
  assert.equal(isHeroSlotPhotoUrl(owner + "photo/" + event + "/" + file, owner), false);
});
