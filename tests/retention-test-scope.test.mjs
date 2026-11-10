import assert from "node:assert/strict";
import test from "node:test";
import { retentionTestScope } from "../lib/retention-test-scope.mjs";

const target = "51801c77-0cc6-40be-a569-41d73c62a0a9";
const env = {
  RETENTION_SCOPED_TEST_EVENT_ID: target,
  RETENTION_SCOPED_TEST_SECRET: "scoped",
  CRON_SECRET: "cron",
};

function request(query = "", secret = "scoped") {
  return new Request(`https://example.test/api/retention/cleanup${query}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
}

test("scoped retention requires the configured UUID and a separate secret", () => {
  const query = `?testEventId=${target}`;
  assert.equal(retentionTestScope(request(query), env), target);
  assert.equal(retentionTestScope(request(query, "cron"), env), false);
  assert.equal(retentionTestScope(request(query), { ...env, CRON_SECRET: "scoped" }), false);
  assert.equal(retentionTestScope(request(query), {}), false);
  assert.equal(retentionTestScope(request(query + "&testEventId=" + target), env), false);
  assert.equal(retentionTestScope(request("?testEventId=invite-" + target), env), false);
  assert.equal(retentionTestScope(request(), env), null);
});
