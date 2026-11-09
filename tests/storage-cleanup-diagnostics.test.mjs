import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/storage-cleanup-diagnostics.js", import.meta.url), "utf8");
const { cleanupFailureCategory } = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

test("classifies known failures without returning raw messages", () => {
  assert.equal(cleanupFailureCategory("Shared Storage path conflict: secret/file.jpg"), "path_conflict");
  assert.equal(cleanupFailureCategory("Upload reservation still pending"), "upload_incomplete");
  assert.equal(cleanupFailureCategory("Object referenced by another invitation"), "reference_exists");
  assert.equal(cleanupFailureCategory("Database connection timeout"), "inspection_error");
  assert.equal(cleanupFailureCategory("Unexpected secret/path.jpg"), "unknown");
  assert.equal(cleanupFailureCategory(null), "unknown");
});
test("audit response uses category rather than raw error text", async () => {
  const route = await readFile(new URL("../app/api/retention/storage-cleanup/route.js", import.meta.url), "utf8");
  assert.match(route, /category: cleanupFailureCategory\(job\.last_error\)/);
  assert.match(route, /report\.errors\.push\(\{ id: job\.id, category: cleanupFailureCategory/);
  assert.doesNotMatch(route, /error: String\(err\.message/);
});
