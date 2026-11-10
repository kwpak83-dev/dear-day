import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../app/api/retention/schedule/route.js", import.meta.url), "utf8");
const id = index => `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;

function mockScheduler(total, pageCap, enroll = false) {
  let queries = 0;
  const db = {
    from(table) {
      assert.equal(table, "events");
      queries++;
      let after = 0;
      const filters = new Map();
      const query = {
        select: () => query, eq: (key, value) => {
          filters.set(key, value);
          assert.equal(value, true);
          return query;
        }, in: () => query, order: () => query, limit: () => query,
        gt: (_, cursor) => { after = Number(cursor.slice(-12)); return query; },
        then: resolve => {
          assert.deepEqual(filters, new Map([["retention_delete_eligible", true], ["retention_v2", true]]));
          return resolve({
            data: Array.from({ length: Math.min(pageCap, total - after) }, (_, index) => ({
              id: id(after + index + 1), starts_at: "2000-01-01",
            })),
          });
        },
      };
      return query;
    },
  };
  const handler = runInNewContext(
    source.replace(/^import .*$/gm, "").replaceAll("export ", "") + "\nGET",
    {
      Buffer, URL, Response, createClient: () => db, eventDeletionTime: Date.parse,
      timingSafeEqual: (a, b) => a.equals(b), console: { error() {} },
      process: { env: {
        CRON_SECRET: "test", NEXT_PUBLIC_SUPABASE_URL: "http://mock",
        SUPABASE_SERVICE_ROLE_KEY: "test", RETENTION_SCHEMA_READY: "true",
        RETENTION_ENROLL_ENABLED: String(enroll),
      } },
    },
  );
  return {
    get: (search = "") => handler(new Request(`http://mock/${search}`, {
      headers: { authorization: "Bearer test" },
    })),
    queries: () => queries,
  };
}

test("invalid cursor is rejected without querying events", async () => {
  const scheduler = mockScheduler(0, 100);
  assert.equal((await scheduler.get("?after=bad")).status, 400);
  assert.equal(scheduler.queries(), 0);
});

test("short server pages do not terminate the scan", async () => {
  const scheduler = mockScheduler(101, 50);
  const result = await (await scheduler.get()).json();
  assert.equal(result.scanned, 101);
  assert.equal(result.nextCursor, null);
});

test("20,001 rows continue at the first unprocessed row", async () => {
  const scheduler = mockScheduler(20001, 100);
  const first = await (await scheduler.get()).json();
  assert.equal(first.scanned, 20000);
  assert.equal(first.nextCursor, id(20000));
  const last = await (await scheduler.get(`?after=${first.nextCursor}`)).json();
  assert.equal(last.scanned, 1);
  assert.equal(last.nextCursor, null);
});

test("exact page budget is complete and resumed enrollment is refused", async () => {
  const full = await (await mockScheduler(20000, 100).get()).json();
  assert.equal(full.truncated, false);
  const resumed = await mockScheduler(20001, 100, true).get(`?after=${id(20000)}`);
  assert.equal(resumed.status, 500);
});
