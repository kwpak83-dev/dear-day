import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import sharp from "sharp";
import { inquiryAttachmentPath, removeInquiryAttachments, signInquiryAttachments, validateInquiryPhotos } from "../lib/inquiry-attachments.js";
import { GET as customerDetail, POST as submitInquiry } from "../app/api/inquiries/route.js";
import { GET as adminList } from "../app/api/admin/inquiries/route.js";
import { GET as menuAccess } from "../app/api/admin/menu-access/route.js";

const owner = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000002";
const id = "00000000-0000-4000-8000-000000000003";
const reply = "00000000-0000-4000-8000-000000000004";
const path = inquiryAttachmentPath(owner, id, 0);

test("real Supabase client gates customer reads and administrator API/count separately", async t => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54999", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-pub",
    SUPABASE_SERVICE_ROLE_KEY: "test-service", DEARDAY_SUPER_ADMIN_IDS: admin };
  for (const [key, value] of Object.entries(env)) {
    const old = process.env[key];
    process.env[key] = value;
    t.after(() => { if (old === undefined) delete process.env[key]; else process.env[key] = old; });
  }
  let user = owner;
  let allowed = false;
  let lookupFails = false;
  const calls = [];
  const original = globalThis.fetch;
  t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async (input, options) => {
    const url = new URL(input);
    assert.equal(url.host, "127.0.0.1:54999");
    calls.push(url.pathname);
    if (url.pathname === "/auth/v1/user") return Response.json({ id: user });
    if (url.pathname.endsWith("/rpc/is_admin")) return Response.json(allowed);
    if (url.pathname === "/auth/v1/admin/users/" + owner) return lookupFails
      ? Response.json({ message: "lookup failed" }, { status: 500 })
      : Response.json({ id: owner, user_metadata: { full_name: "Test Member" } });
    if (url.pathname === "/auth/v1/admin/users") return Response.json({ users: [{ id: owner, user_metadata: { full_name: "Test Member" } }] });
    if (allowed && url.pathname === "/rest/v1/inquiries" && options.method !== "HEAD") {
      if (url.searchParams.has("or")) assert.ok(url.searchParams.get("or").includes(owner));
      return Response.json([{ id, user_id: owner, title: "question", attachments: [] }], { headers: { "content-range": "0-0/1" } });
    }
    if (options.method === "HEAD") return new Response(null, { headers: { "content-range": "0-1/2" } });
    assert.equal(url.pathname, "/rest/v1/inquiries");
    assert.equal(url.searchParams.get("user_id"), "eq." + owner);
    assert.equal(url.searchParams.get("id"), "eq." + id);
    return Response.json([]);
  };
  const request = (path, options = {}) => new Request("https://example.test" + path, {
    ...options, headers: { Authorization: "Bearer test-user-token" },
  });
  const adminPath = "/api/admin/inquiries";
  assert.equal((await adminList(new Request("https://example.test" + adminPath))).status, 401);
  assert.equal((await adminList(request(adminPath))).status, 403);
  const badge = () => menuAccess(request("/api/admin/menu-access?inquiries=1"));
  assert.deepEqual(await (await badge()).json(), { canManage: false });
  assert.equal(calls.some(value => value.startsWith("/rest/")), false);
  const denied = await customerDetail(request("/api/inquiries?id=" + id));
  assert.equal(denied.status, 404);
  assert.equal(denied.headers.get("cache-control"), "private, no-store");
  assert.equal((await submitInquiry(request("/api/inquiries", { method: "POST", body: "bad JSON" }))).status, 400);
  user = admin;
  assert.equal((await adminList(request(adminPath))).status, 403);
  allowed = true;
  assert.deepEqual(await (await badge()).json(), { canManage: true, pendingInquiries: 2 });
  const list = async suffix => (await adminList(request(adminPath + suffix))).json();
  assert.equal((await list("")).inquiries[0].memberName, "Test Member");
  assert.equal((await list("?search=Test")).inquiries[0].memberName, "Test Member");
  lookupFails = true;
  assert.equal((await list("")).inquiries[0].memberName, "이름 없음");
  assert.equal(calls.includes("/rest/v1/profiles"), false);
});

test("checks bytes, format, count and decoded dimensions before upload", async () => {
  const image = sharp({ create: { width: 35, height: 27, channels: 3, background: "#842f1e" } });
  const webp = new File([await image.clone().webp().toBuffer()], "photo.webp", { type: "image/webp" });
  const [validated] = await validateInquiryPhotos([webp]);
  assert.deepEqual([validated.width, validated.height], [35, 27]);
  assert.equal((await sharp(validated.bytes).metadata()).format, "webp");
  await assert.rejects(validateInquiryPhotos([webp, webp, webp, webp]), /3장/);
  await assert.rejects(validateInquiryPhotos([new File([await image.png().toBuffer()], "fake.webp", { type: "image/webp" })]), /손상/);
  await assert.rejects(validateInquiryPhotos([new File([Buffer.alloc(512001)], "large.webp", { type: "image/webp" })]), /512KB/);
  const wide = await sharp({ create: { width: 1921, height: 1, channels: 3, background: "#000" } }).webp().toBuffer();
  await assert.rejects(validateInquiryPhotos([new File([wide], "wide.webp", { type: "image/webp" })]), /손상/);
});

test("signs only scoped objects and requires positive absence confirmation during cleanup", async () => {
  const calls = [];
  let status = 404;
  const db = { storage: { from(bucket) {
    assert.equal(bucket, "inquiry-attachments");
    return {
      createSignedUrl: async (key, ttl) => {
        calls.push([key, ttl]);
        return { data: { signedUrl: "https://storage.example.test/signed" } };
      },
      remove: async keys => { calls.push(keys); return {}; },
      info: async () => ({ error: { status, code: "NoSuchKey" } }),
    };
  } } };
  const foreign = inquiryAttachmentPath(admin, id, 0);
  const photos = await signInquiryAttachments(db, { id, user_id: owner, attachments: [{ path }, { path: foreign }] });
  assert.equal(photos.length, 1);
  assert.equal(photos[0].path, undefined);
  assert.deepEqual(calls, [[path, 120]]);
  await assert.rejects(removeInquiryAttachments(db, owner, id, [foreign]), /scope/);
  assert.equal(calls.length, 1);
  await removeInquiryAttachments(db, owner, id, [path]);
  status = 403;
  await assert.rejects(removeInquiryAttachments(db, owner, id, [path]), /absence not confirmed/);
});

test("PostgreSQL reply transaction enforces grants and retries without duplicate answers", { skip: !process.env.TEST_PGLITE_MODULE }, async () => {
  const { PGlite } = await import(pathToFileURL(resolve(process.env.TEST_PGLITE_MODULE)).href);
  const db = new PGlite();
  const sql = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.role() returns text language sql as $$select current_user::text$$;
      grant usage on schema auth to service_role;
      create schema storage; create table storage.buckets
      (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);`);
    await db.exec(await sql("202609200001_inquiries.sql"));
    const attachments = await sql("202611270001_inquiry_attachments.sql");
    await db.exec(attachments);
    await db.exec(attachments);
    await db.exec(await sql("202611270002_inquiry_reply_transaction.sql"));
    const { rows: [permissions] } = await db.query(`select
      has_function_privilege('authenticated','public.answer_customer_inquiry(uuid,uuid,uuid,text)','execute') as member,
      has_function_privilege('service_role','public.answer_customer_inquiry(uuid,uuid,uuid,text)','execute') as service`);
    assert.deepEqual(permissions, { member: false, service: true });
    await db.query("insert into auth.users values ($1), ($2)", [owner, admin]);
    await db.query("insert into inquiries(id,user_id,category,title,content) values ($1,$2,'other','title','question')", [id, owner]);
    await db.exec("set role service_role");
    const answer = content => db.query("select answer_customer_inquiry($1,$2,$3,$4)", [id, reply, admin, content]);
    await answer("answer");
    const { rows: [first] } = await db.query("select status, answered_at from inquiries");
    assert.equal(first.status, "answered");
    assert.ok(first.answered_at);
    await answer("answer");
    await assert.rejects(answer("conflicting retry"), { code: "23505" });
    assert.deepEqual((await db.query("select status, answered_at from inquiries")).rows, [first]);
    assert.equal((await db.query("select content from inquiry_replies")).rows.length, 1);
  } finally {
    await db.close();
  }
});
