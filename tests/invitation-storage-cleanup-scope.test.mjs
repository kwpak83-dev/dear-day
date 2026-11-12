import assert from "node:assert/strict";
import test from "node:test";
import { hasInvitationScopedUpload } from "../lib/invitation-storage-cleanup-scope.js";

const owner = "11111111-1111-4111-8111-111111111111";
const event = "22222222-2222-4222-8222-222222222222";
const name = "33333333-3333-4333-8333-333333333333";
const job = { owner_id: owner, event_id: event, bucket: "invitation-photos", storage_path: `${owner}/notice/${event}/${name}.jpg` };
const reservation = { owner_id: owner, event_id: event, status: "uploaded" };

test("completed uploads require an event-scoped path and matching bucket", () => {
  assert.equal(hasInvitationScopedUpload(job, reservation), true);
  for (const [bucket, kind, extension] of [
    ["invitation-photos", "photo", "webp"],
    ["invitation-photos", "notice", "webp"],
    ["invitation-photos", "gallery", "jpg"],
    ["invitation-bgm", "bgm", "mp3"],
  ]) {
    assert.equal(hasInvitationScopedUpload({
      ...job, bucket, storage_path: `${owner}/${kind}/${event}/${name}.${extension}`,
    }, reservation), true);
  }
  for (const candidate of [
    { ...job, bucket: "invitation-bgm" },
    { ...job, storage_path: `${owner}/${name}.jpg` },
    { ...job, storage_path: job.storage_path.replace("/notice/", "/bgm/") },
    { ...job, storage_path: job.storage_path + "/extra" },
    { ...job, storage_path: `${owner}/gallery/${event}/${name}.webp` },
  ]) assert.equal(hasInvitationScopedUpload(candidate, reservation), false);
  for (const candidate of [null, { ...reservation, status: "reserved" }, { ...reservation, event_id: name }]) {
    assert.equal(hasInvitationScopedUpload(job, candidate), false);
  }
});
