import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { request } from "node:http";
import { createClient } from "@supabase/supabase-js";

const endpoint = new URL(process.env.DEARDAY_TEST_STORAGE_URL || "http://127.0.0.1:54321");
assert.equal(endpoint.hostname, "127.0.0.1", "Use the isolated loopback Supabase API");
assert.equal(endpoint.protocol, "http:");
const standalone = process.argv.includes("--standalone");
const jwt = () => {
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = encode({ alg: "HS256", typ: "JWT" }) + "." +
    encode({ role: "service_role", exp: Math.floor(Date.now() / 1000) + 3600 });
  return body + "." + createHmac("sha256", "dearday-isolated-storage-jwt-secret-only-2026").update(body).digest("base64url");
};
if (standalone) assert.equal(endpoint.port, "55450");
const key = standalone ? jwt() : process.env.DEARDAY_TEST_STORAGE_SERVICE_KEY;
assert.ok(key, "Supply the disposable local service key explicitly");
function storageFetch(input, init) {
  const target = new URL(input);
  assert.equal(target.origin, endpoint.origin);
  if (standalone) {
    assert.ok(target.pathname.startsWith("/storage/v1/"));
    target.pathname = target.pathname.slice("/storage/v1".length);
  }
  return fetch(target, init);
}
const client = createClient(endpoint.origin, key, {
  auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: storageFetch },
});
const result = ({ data, error }) => {
  if (error) throw new Error(error.message);
  return data;
};
const run = randomUUID();
const bucket = "invitation-photos";
const guarded = process.argv.includes("--guard-on");
assert.equal(fixtureSql("select require_reservation from public.invitation_storage_write_gate"), guarded ? "t" : "f");
const listed = result(await client.storage.listBuckets());
if (!listed.some(entry => entry.id === bucket)) result(await client.storage.createBucket(bucket));
const storage = client.storage.from(bucket);
const user = standalone ? { id: randomUUID() } : result(await client.auth.admin.createUser({
  email: `storage-${run}@example.test`, password: randomUUID(), email_confirm: true,
})).user;
const eventId = randomUUID();
if (standalone) {
  fixtureSql(`insert into auth.users(id,email) values('${user.id}','storage-${run}@example.test');
    insert into public.events(id,owner_id,kind,status,slug,title)
    values('${eventId}','${user.id}','wedding','draft','storage-${run}','Synthetic Storage fixture')`);
} else result(await client.from("events").insert({
  id: eventId, owner_id: user.id, kind: "wedding", status: "draft",
  slug: `storage-${run}`, title: "Synthetic Storage integration fixture",
}));

const bytes = Buffer.from("Dear Day local Storage fixture");
const options = { contentType: "application/octet-stream", upsert: false };
function fixtureSql(sql) {
  const container = "supabase_db_dearday-storage-http";
  const project = execFileSync("docker", ["inspect", "--format",
    '{{ index .Config.Labels "com.supabase.cli.project" }}', container], { encoding: "utf8" }).trim();
  assert.equal(project, "dearday-storage-http");
  return execFileSync("docker", ["exec", container, "psql", "-X", "-U", "postgres", "-d",
    "postgres", "-v", "ON_ERROR_STOP=1", "-Atqc", sql], { encoding: "utf8" }).trim();
}
const reserve = async path => standalone ? { data: fixtureSql(`
  set request.jwt.claim.role = 'service_role';
  select public.reserve_invitation_upload('${eventId}','${user.id}','${bucket}','${path}');
`) } : client.rpc("reserve_invitation_upload", {
  p_event: eventId, p_owner: user.id, p_bucket: bucket, p_path: path,
});
async function checkAbsent(path) {
  assert.ok((await storage.download(path)).error, "Rejected object must not download");
  const slash = path.lastIndexOf("/");
  const files = result(await storage.list(path.slice(0, slash), { search: path.slice(slash + 1) }));
  assert.ok(!files.some(entry => entry.name === path.slice(slash + 1)), "Rejected object must not have listing metadata");
  if (standalone) assert.equal(backendHashes(path).length, 0, "Rejected object left orphan backend bytes");
}
function backendHashes(path) {
  const output = execFileSync("docker", ["exec", "supabase_storage_dearday-storage-http",
    "sh", "-c", 'if [ -d "$1" ]; then find "$1" -type f -exec sha256sum {} +; fi', "sh",
    `/var/lib/storage/dearday-http/dearday-http/${bucket}/${path}`], { encoding: "utf8" }).trim();
  return output ? output.split(/\r?\n/).map(line => line.split(" ")[0]) : [];
}
async function check(path) {
  const downloaded = result(await storage.download(path));
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), bytes);
  const slash = path.lastIndexOf("/");
  const files = result(await storage.list(path.slice(0, slash), { search: path.slice(slash + 1) }));
  const file = files.find(entry => entry.name === path.slice(slash + 1));
  assert.ok(file, "Storage listing must include uploaded metadata");
  assert.equal(file.metadata.size, bytes.length);
  if (standalone) assert.deepEqual(backendHashes(path), [createHash("sha256").update(bytes).digest("hex")]);
}

const reserved = `${user.id}/${run}/reserved.bin`;
const reservation = result(await reserve(reserved));
result(await storage.upload(reserved, bytes, options));
const finished = standalone ? fixtureSql(`set request.jwt.claim.role = 'service_role';
  select public.finish_invitation_upload('${reservation}','${user.id}',true)`) === "t" :
  result(await client.rpc("finish_invitation_upload", {
  p_reservation: reservation, p_owner: user.id, p_uploaded: true,
}));
assert.equal(finished, true);
await check(reserved);
assert.ok((await storage.upload(reserved, Buffer.from("replacement"), options)).error);
await check(reserved);

// Compatibility mode is deliberately exercised with the write guard off.
// A successful unreserved upload here is not evidence of guard-on behavior.
const direct = `${user.id}/${run}/direct.bin`;
if (guarded) {
  assert.ok((await storage.upload(direct, bytes, options)).error);
  await checkAbsent(direct);
  assert.ok((await storage.upload(reserved, Buffer.from("overwrite"), { ...options, upsert: true })).error);
  await check(reserved);
  const stale = `${user.id}/${run}/stale.bin`;
  const staleId = result(await reserve(stale));
  assert.match(staleId, /^[0-9a-f-]{36}$/);
  fixtureSql(`update public.invitation_upload_reservations set created_at = now() - interval '2 days' where id = '${staleId}'`);
  assert.ok((await storage.upload(stale, bytes, options)).error);
  await checkAbsent(stale);
  const fenced = `${user.id}/${run}/fenced.bin`;
  const fencedId = result(await reserve(fenced));
  assert.match(fencedId, /^[0-9a-f-]{36}$/);
  fixtureSql(`update public.invitation_storage_objects o set state='deletion_pending' from public.invitation_upload_reservations r where r.id='${fencedId}' and (o.bucket,o.storage_path)=(r.bucket,r.storage_path)`);
  assert.ok((await storage.upload(fenced, bytes, options)).error);
  await checkAbsent(fenced);
} else {
  result(await storage.upload(direct, bytes, options));
  await check(direct);
}
const signed = `${user.id}/${run}/signed.bin`;
if (guarded) {
  assert.ok((await storage.createSignedUploadUrl(signed)).error);
  await checkAbsent(signed);
  const signedId = result(await reserve(signed));
  const expiredToken = result(await storage.createSignedUploadUrl(signed)).token;
  fixtureSql(`update public.invitation_upload_reservations set created_at=now()-interval '2 days' where id='${signedId}'`);
  assert.ok((await storage.uploadToSignedUrl(signed, expiredToken, bytes, options)).error);
  await checkAbsent(signed);
  fixtureSql(`update public.invitation_upload_reservations set created_at=now() where id='${signedId}'`);
}
const { token } = result(await storage.createSignedUploadUrl(signed));
result(await storage.uploadToSignedUrl(signed, token, bytes, options));
await check(signed);

if (standalone) {
  const aborted = `${user.id}/${run}/aborted.bin`;
  const abortedId = result(await reserve(aborted));
  await new Promise((resolve, reject) => {
    const upload = request(new URL(`/object/${bucket}/${aborted}`, endpoint), {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": options.contentType, "content-length": 1024 },
    });
    upload.on("response", response => {
      response.resume();
      reject(new Error(`Upload responded before interruption: ${response.statusCode}`));
    });
    upload.on("error", error => {
      if (error.message === "Synthetic upload interruption") resolve();
      else reject(error);
    });
    upload.write(bytes, () => setTimeout(() => upload.destroy(new Error("Synthetic upload interruption")), 250));
  });
  await checkAbsent(aborted);
  assert.equal(fixtureSql(`select status from public.invitation_upload_reservations where id='${abortedId}'`), "reserved");
}

const uncertain = `${user.id}/${run}/response-lost.bin`;
result(await reserve(uncertain));
let responseLost = false;
const interruptedClient = createClient(endpoint.origin, key, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: async (input, init) => {
    const response = await storageFetch(input, init);
    if (init?.method === "POST" && new URL(input).pathname.endsWith("/response-lost.bin") && response.ok) {
      await response.arrayBuffer();
      responseLost = true;
      throw new Error("Synthetic response loss after server success");
    }
    return response;
  } },
});
assert.ok((await interruptedClient.storage.from(bucket).upload(uncertain, bytes, options)).error);
assert.equal(responseLost, true);
await check(uncertain);
const status = standalone ? fixtureSql(`select status from public.invitation_upload_reservations
  where bucket='${bucket}' and storage_path='${uncertain}'`) :
  result(await client.from("invitation_upload_reservations").select("status")
    .eq("bucket", bucket).eq("storage_path", uncertain).single()).status;
assert.equal(status, "reserved");
console.log(`PASS: guard-${guarded ? "on" : "off"} HTTP cases and response loss; metadata and download bytes match`);
