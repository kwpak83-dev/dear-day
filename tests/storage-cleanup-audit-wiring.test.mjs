import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../app/api/retention/storage-cleanup/route.js", import.meta.url),
  "utf8"
);

test("Storage cleanup remains read-only and reports in-flight reservations", () => {
  assert.match(source, /mode: "dry-run"/);
  assert.match(source, /removed: 0/);
  assert.match(source, /inFlight: 0/);
  assert.match(source, /from\("invitation_upload_reservations"\)/);
  assert.match(source, /reservation\.status === "reserved"/);
  assert.match(source, /report\.inFlight\+\+;\s*continue;/);
  assert.doesNotMatch(source, /\.storage\.from\([^)]*\)\.remove\(/);
});
