import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../lib/invitation-retention.js", import.meta.url), "utf8");
const retention = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
const { eventDeletionTime, calculateRetentionDates, isEventReadOnly, getRetentionState } = retention;
const kst = (date) => new Date(date).getTime();

test("event deletion is midnight KST 30 calendar days after event date", () => {
  assert.equal(eventDeletionTime("2026-11-07T16:00:00+09:00"), kst("2026-12-07T00:00:00+09:00"));
  assert.equal(eventDeletionTime("2026-09-20T14:00:00+09:00"), kst("2026-10-20T00:00:00+09:00"));
  assert.equal(eventDeletionTime("2026-12-31T23:59:00+09:00"), kst("2027-01-30T00:00:00+09:00"));
  assert.equal(eventDeletionTime("2026-01-31T00:00:00+09:00"), kst("2026-03-02T00:00:00+09:00"));
});
test("event start cutoff is exact instant, not midnight", () => {
  const event = { status: "published", starts_at: "2026-11-09T15:30:00+09:00" };
  assert.equal(isEventReadOnly(event, kst("2026-11-09T15:29:59+09:00")), false);
  assert.equal(isEventReadOnly(event, kst("2026-11-09T15:30:00+09:00")), true);
});
test("retention boundary is exact and legacy expiry columns ignored", () => {
  const event = { status: "published", starts_at: "2026-11-07T16:00:00+09:00", service_expires_at: "2026-11-21T16:00:00+09:00" };
  assert.equal(getRetentionState(event, kst("2026-12-06T23:59:59+09:00")).phase, "active");
  assert.equal(getRetentionState(event, kst("2026-12-07T00:00:00+09:00")).phase, "expired");
  assert.equal(calculateRetentionDates(event.starts_at).service_expires_at, "2026-12-06T15:00:00.000Z");
});
test("missing and invalid dates never produce a deletion timestamp", () => {
  assert.equal(eventDeletionTime(null), null);
  assert.equal(eventDeletionTime("invalid"), null);
  assert.equal(calculateRetentionDates("invalid"), null);
});
test("legacy stored expiry and KST edit boundary are preserved", () => {
  const event = { status: "published", retention_v2: false,
    starts_at: "2026-11-09T15:30:00+09:00", service_expires_at: "2026-11-23T15:30:00+09:00" };
  assert.equal(getRetentionState(event, kst("2026-11-24T00:00:00+09:00")).phase, "expired");
  assert.equal(getRetentionState(event).deletionEligibleAt, null);
  assert.equal(isEventReadOnly(event, kst("2026-11-09T22:00:00+09:00")), false);
  assert.equal(isEventReadOnly(event, kst("2026-11-10T00:00:00+09:00")), true);
  assert.equal(retention.isPublicPeriodExpired({ ...event, starts_at: null, service_expires_at: null }), false);
  assert.equal(retention.isPublicPeriodExpired({ ...event, retention_v2: true, starts_at: null }), true);
});
