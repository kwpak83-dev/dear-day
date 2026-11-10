import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { timingSafeEqual } from "node:crypto";

const source = readFileSync(new URL("../app/api/retention/storage-cleanup/route.js", import.meta.url), "utf8");
const match = source.match(/function authorized\(request\) \{([\s\S]*?)\n\}/);
assert.ok(match, "Storage cleanup authorization function exists");
const authorized = runInNewContext(
  `(function authorized(request) {${match[1]}\n})`,
  { process, Buffer, timingSafeEqual }
);
function request(token) {
  return { headers: { get: () => token ? `Bearer ${token}` : null } };
}
test("existing cron secret is accepted", () => {
  process.env.CRON_SECRET = "cron-test-123";
  process.env.RETENTION_STORAGE_TEST_SECRET = "separate-test-456";
  assert.equal(authorized(request("cron-test-123")), true);
});
test("separate test secret is accepted", () => {
  process.env.CRON_SECRET = "cron-test-123";
  process.env.RETENTION_STORAGE_TEST_SECRET = "separate-test-456";
  assert.equal(authorized(request("separate-test-456")), true);
});
test("invalid and missing credentials are rejected", () => {
  process.env.CRON_SECRET = "cron-test-123";
  process.env.RETENTION_STORAGE_TEST_SECRET = "separate-test-456";
  assert.equal(authorized(request("wrong")), false);
  assert.equal(authorized(request(null)), false);
});
test("unset secrets never authorize", () => {
  delete process.env.CRON_SECRET;
  delete process.env.RETENTION_STORAGE_TEST_SECRET;
  assert.equal(authorized(request("anything")), false);
});
