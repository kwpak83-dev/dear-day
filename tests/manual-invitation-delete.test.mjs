import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../app/api/events/route.js", import.meta.url), "utf8");
const auth = source.slice(source.indexOf("async function getAuthenticatedClient"), source.indexOf("async function getEventTypeConfig"));
const deletion = source.slice(source.indexOf("export async function DELETE")).replace("export async", "async");
const slug = "invite-fixture";
const owner = "signed-in-owner";
const serverKey = "fixture-server-credential";

function fixture({ eventOwner = owner, key = serverKey, rpcError = null } = {}) {
  const calls = [];
  const logs = [];
  let clients = 0;
  const handler = runInNewContext(`${auth}\n${deletion}\nDELETE`, {
    URL,
    slugPattern: /^invite-[a-z]+$/,
    TERMS_VERSION: "terms",
    PRIVACY_VERSION: "privacy",
    json: (body, status = 200) => Response.json(body, { status }),
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://fixture.test", SUPABASE_SERVICE_ROLE_KEY: key } },
    console: { error: (...args) => logs.push(args) },
    createClient(_url, credential, options) {
      assert.equal(credential, serverKey);
      assert.equal(options.auth.persistSession, false);
      if (++clients === 1) {
        return {
          auth: { async getUser(jwt) {
            calls.push("login");
            assert.equal(jwt, "user-jwt");
            return { data: { user: { id: owner } } };
          } },
          from(table) {
            const query = {
              select: () => query,
              eq: () => query,
              async maybeSingle() {
                calls.push(table);
                return { data: table === "user_consents"
                  ? { terms_version: "terms", privacy_version: "privacy" }
                  : { id: "event-id", owner_id: eventOwner, status: "draft", updated_at: "revision" } };
              },
            };
            return query;
          },
        };
      }
      return { async rpc(name, args) {
        calls.push("rpc");
        assert.equal(name, "delete_invitation_and_queue_storage");
        assert.equal(args.p_event, "event-id");
        assert.equal(args.p_owner, owner);
        assert.equal(args.p_expected_updated_at, "revision");
        return { data: rpcError ? null : { queued: 1, held: 0 }, error: rpcError };
      } };
    },
  });
  return { calls, logs, run: () => handler(new Request(`https://fixture.test/api/events?slug=${slug}`, {
    method: "DELETE", headers: { authorization: "Bearer user-jwt" },
  })) };
}

test("owner deletion uses a separate RPC client after login, consent and ownership checks", async () => {
  const f = fixture();
  const response = await f.run();
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, slug, cleanupPending: true, cleanupQueued: true, cleanupHeld: 0 });
  assert.deepEqual(f.calls, ["login", "user_consents", "events", "rpc"]);
});

test("another owner's invitation is rejected before calling the RPC", async () => {
  const f = fixture({ eventOwner: "other-owner" });
  assert.equal((await f.run()).status, 403);
  assert.deepEqual(f.calls, ["login", "user_consents", "events"]);
});

test("missing server credential fails closed", async () => {
  const f = fixture({ key: "" });
  assert.equal((await f.run()).status, 503);
  assert.deepEqual(f.calls, []);
});

test("RPC permission error returns a generic 503 and logs only its code", async () => {
  const f = fixture({ rpcError: { code: "42501", message: serverKey } });
  const response = await f.run();
  assert.equal(response.status, 503);
  assert.equal((await response.text()).includes(serverKey), false);
  assert.equal(JSON.stringify(f.logs).includes(serverKey), false);
  assert.equal(f.logs[0][1].code, "42501");
});
