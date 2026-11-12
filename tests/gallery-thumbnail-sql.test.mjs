import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const bin = process.env.TEST_POSTGRES_BIN || "C:/Program Files/PostgreSQL/17/bin";
const exe = name => path.join(bin, name + (process.platform === "win32" ? ".exe" : ""));
const migration = name => fs.readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");

test("isolated PostgreSQL thumbnail migration, fencing, ownership and concurrent link/delete", { skip: !fs.existsSync(exe("initdb")) || !fs.existsSync(path.join(bin,"../share/postgres.bki")), timeout: 90000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dearday-thumbnail-"));
  const data = path.join(dir, "data"), port = "55439";
  const env = { ...process.env, PGHOST: "127.0.0.1", PGPORT: port, PGUSER: "postgres", PGDATABASE: "postgres", PGPASSWORD: "", PGSERVICE: "", PGSERVICEFILE: "" };
  const run = (name, args, input) => execFileSync(exe(name), args, { env, input, encoding: "utf8", windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
  const sql = text => run("psql", ["-X", "-v", "ON_ERROR_STOP=1", "-Atq"], text).trim();
  const session = text => new Promise((resolve, reject) => {
    const child = spawn(exe("psql"), ["-X", "-v", "ON_ERROR_STOP=1", "-Atq"], { env, windowsHide: true });
    let out = "", err = "";
    child.stdout.on("data", x => out += x); child.stderr.on("data", x => err += x);
    child.on("error", reject); child.on("close", code => code === 0 ? resolve(out.trim()) : reject(Error(err)));
    child.stdin.end(text);
  });
  let started = false;
  try {
    run("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"]);
    run("pg_ctl", ["-D", data, "-l", path.join(dir, "server.log"), "-o", `-h 127.0.0.1 -p ${port}`, "-w", "start"]); started = true;
    sql(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role')$$;`);
    sql(migration("202609090001_initial_event_platform.sql"));
    // Focused fixture: production retention_v2 is defined by SQL 023. This is
    // not a claim that all retention migrations have been integration-tested here.
    sql("alter type event_status add value 'paid'; alter type event_status add value 'suspended'; alter table events add column retention_v2 boolean not null default false;");
    for (const name of ["202609110001_invitation_gallery.sql", "202611090012_upload_reservations.sql", "202611090017_invitation_storage_object_fence.sql", "202611090018_inventory_invitation_storage_references.sql", "202611120001_gallery_thumbnail_path.sql", "202611120002_gallery_thumbnail_link.sql"]) sql(migration(name));
    const owner=randomUUID(), other=randomUUID(), event=randomUUID(), media=randomUUID();
    const original=`${owner}/gallery/${event}/${media}.jpg`, thumb=`${owner}/photo/${event}/${randomUUID()}.webp`, second=`${owner}/photo/${event}/${randomUUID()}.webp`;
    sql(`insert into auth.users(id) values('${owner}'),('${other}'); insert into events(id,owner_id,kind,slug,title) values('${event}','${owner}','wedding','thumbnail-test','Fixture'); insert into event_media(id,event_id,storage_path,gallery_state) values('${media}','${event}','${original}','ready');`);
    assert.equal(sql(`select gallery_thumbnail_path is null from event_media where id='${media}'`), "t");
    const link = p => `select link_gallery_thumbnail('${event}','${owner}','${media}','${p}');`;
    assert.throws(() => sql(link(thumb)), /Uploaded reservation required/);
    for (const p of [thumb,second]) sql(`select finish_invitation_upload(reserve_invitation_upload('${event}','${owner}','invitation-photos','${p}'),'${owner}',true);`);
    assert.equal(sql(`select link_gallery_thumbnail('${event}','${other}','${media}','${thumb}') is null;`), "t");
    assert.throws(() => sql(`set request.jwt.claim.role='authenticated'; ${link(thumb)}`), /Service role required/);
    // Two real database sessions contend on the same event lock.
    const [a,b] = await Promise.all([session(`begin; select 1 from events where id='${event}' for update; select pg_sleep(0.3); ${link(thumb)} commit;`), session(link(second))]);
    const winner=sql(`select gallery_thumbnail_path from event_media where id='${media}'`);
    assert.ok([thumb,second].includes(winner)); assert.ok(a.includes(winner)); assert.equal(b,winner);
    assert.equal(sql(`select count(*) from invitation_storage_object_references where event_id='${event}' and bucket='invitation-photos' and storage_path='${winner}'`), "1");
    assert.equal(sql(`select count(*) from gallery_storage_cleanup`), "1");
    const fenced=`${owner}/photo/${event}/${randomUUID()}.webp`;
    sql(`insert into invitation_storage_objects(bucket,storage_path,state) values('invitation-photos','${fenced}','deletion_pending')`);
    assert.throws(() => sql(`select reserve_invitation_upload('${event}','${owner}','invitation-photos','${fenced}')`), /fenced/);
    const protectedEvent=randomUUID();
    sql(`insert into events(id,owner_id,kind,slug,title) values('${protectedEvent}','${other}','wedding','protected-fixture','Protected')`);
    await Promise.all([session(`begin; select 1 from events where id='${event}' for update; select pg_sleep(0.3); delete from event_media where id='${media}'; commit;`), session(`select pg_sleep(0.1); ${link(thumb)}`)]);
    assert.equal(sql(`select count(*) from event_media where id='${media}'`),"0");
    assert.equal(sql(`select count(*) from gallery_storage_cleanup where storage_path in ('${original}','${winner}')`),"2");
    assert.equal(sql(`select count(*) from events where id='${protectedEvent}'`),"1");
    assert.equal(sql(`select has_function_privilege('authenticated','public.link_gallery_thumbnail(uuid,uuid,uuid,text)','execute')`),"f");
  } finally {
    if (started) run("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
    if (!dir.startsWith(path.join(os.tmpdir(), "dearday-thumbnail-"))) throw Error("Unsafe cleanup path");
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("PGlite executes thumbnail migrations, ownership, duplicate linking, rollback and deletion queues", { skip: !process.env.TEST_PGLITE_MODULE, timeout: 60000 }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.TEST_PGLITE_MODULE).href);
  const db = new PGlite();
  const one = async sql => (await db.query(sql)).rows[0];
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claim.role',true),''),'service_role')$$;`);
    await db.exec(migration("202609090001_initial_event_platform.sql").replace("create extension if not exists pgcrypto;", ""));
    await db.exec("alter type event_status add value 'paid'; alter type event_status add value 'suspended'; alter table events add column retention_v2 boolean not null default false;");
    for (const name of ["202609110001_invitation_gallery.sql", "202611090012_upload_reservations.sql", "202611090017_invitation_storage_object_fence.sql", "202611090018_inventory_invitation_storage_references.sql", "202611120001_gallery_thumbnail_path.sql", "202611120002_gallery_thumbnail_link.sql"]) await db.exec(migration(name));
    await db.exec(migration("202611120002_gallery_thumbnail_link.sql")); // SQL Editor retry is safe.
    const owner=randomUUID(), other=randomUUID(), event=randomUUID(), media=randomUUID(), protectedEvent=randomUUID();
    const original=`${owner}/gallery/${event}/${media}.jpg`, first=`${owner}/photo/${event}/${randomUUID()}.webp`, second=`${owner}/photo/${event}/${randomUUID()}.webp`;
    await db.exec(`insert into auth.users(id) values('${owner}'),('${other}');
      insert into events(id,owner_id,kind,slug,title) values('${event}','${owner}','wedding','thumbnail-test','Fixture'),('${protectedEvent}','${other}','wedding','protected-test','Protected');
      insert into event_media(id,event_id,storage_path,gallery_state) values('${media}','${event}','${original}','ready');`);
    const link = (p,who=owner) => `select link_gallery_thumbnail('${event}','${who}','${media}','${p}') as path`;
    assert.equal((await one(`select gallery_thumbnail_path is null as legacy from event_media where id='${media}'`)).legacy,true);
    await assert.rejects(() => db.query(link(first)), /Uploaded reservation required/);
    for (const p of [first,second]) await db.query(`select finish_invitation_upload(reserve_invitation_upload('${event}','${owner}','invitation-photos','${p}'),'${owner}',true)`);
    assert.equal((await one(link(first,other))).path,null);
    assert.equal((await one(link(first))).path,first);
    assert.equal((await one(link(second))).path,first);
    assert.equal((await one(`select count(*)::int n from invitation_storage_object_references where event_id='${event}' and bucket='invitation-photos' and storage_path='${first}'`)).n,1);
    assert.equal((await one(`select count(*)::int n from gallery_storage_cleanup where storage_path='${second}'`)).n,1);
    const fenced=`${owner}/photo/${event}/${randomUUID()}.webp`;
    await db.exec(`insert into invitation_storage_objects(bucket,storage_path,state) values('invitation-photos','${fenced}','deletion_pending')`);
    await assert.rejects(() => db.query(`select reserve_invitation_upload('${event}','${owner}','invitation-photos','${fenced}')`), /fenced/);
    await db.exec("begin");
    await db.exec(`delete from event_media where id='${media}'`);
    assert.equal((await one(link(first))).path,null);
    await db.exec("rollback");
    assert.equal((await one(link(first))).path,first);
    await db.exec(`delete from events where id='${event}'`);
    assert.equal((await one(`select count(*)::int n from gallery_storage_cleanup where storage_path in ('${original}','${first}')`)).n,2);
    assert.equal((await one(`select count(*)::int n from events where id='${protectedEvent}'`)).n,1);
    assert.equal((await one(`select has_function_privilege('authenticated','public.link_gallery_thumbnail(uuid,uuid,uuid,text)','execute') allowed`)).allowed,false);
  } finally { await db.close(); }
});
