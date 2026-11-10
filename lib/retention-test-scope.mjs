import { timingSafeEqual } from "node:crypto";

export function retentionTestScope(request, env = process.env) {
  const ids = new URL(request.url).searchParams.getAll("testEventId");
  if (!ids.length) return null;
  const secret = env.RETENTION_SCOPED_TEST_SECRET;
  const eventId = ids[0];
  if (ids.length !== 1 || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(eventId) ||
      eventId !== env.RETENTION_SCOPED_TEST_EVENT_ID || !secret ||
      secret === env.CRON_SECRET || secret === env.RETENTION_STORAGE_TEST_SECRET) return false;
  const actual = Buffer.from(request.headers.get("authorization") || "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? eventId : false;
}
