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
  assert.match(source, /priorErrors: 0/);
  assert.match(source, /retries: 0/);
  assert.match(source, /totals: \{ pending: 0, retry: 0, failed: 0, done: 0 \}/);
  assert.match(source, /\["pending", "retry", "failed", "done"\]/);
  assert.match(source, /count: "exact", head: true/);
  assert.match(source, /report\.totals\[status\] = count/);
  assert.match(source, /job\.status === "retry"/);
  assert.match(source, /job\.last_error/);
  assert.doesNotMatch(source, /\.from\("invitation_storage_cleanup_jobs"\)[\s\S]{0,180}\.update\(/);
  assert.match(source, /from\("invitation_upload_reservations"\)/);
  assert.match(source, /reservation\.status === "reserved"/);
  assert.match(source, /report\.inFlight\+\+;\s*continue;/);
  assert.doesNotMatch(source, /\.storage\.from\([^)]*\)\.remove\(/);
});
