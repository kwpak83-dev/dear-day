import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const migration = name => readFile(new URL(`../supabase/migrations/${name}`, import.meta.url), "utf8");
const newMigration = await migration("202611120003_gallery_active_hash.sql");

test("reupload SQL changes only reserve matching and the active hash index", async () => {
  const original = await migration("202609110001_invitation_gallery.sql");
  const rpc = sql => sql.slice(sql.indexOf("create or replace function public.mutate_invitation_gallery("), sql.lastIndexOf("commit;")).trim();
  let expected = rpc(original);
  for (const key of ["hashes.h", "v_hash"]) expected = expected.replace(`content_hash = ${key} and gallery_state is not null`, `content_hash = ${key} and gallery_state in ('pending','uploading','ready')`);
  assert.equal(rpc(newMigration).replaceAll("\r\n", "\n"), expected.replaceAll("\r\n", "\n"));
  assert.match(newMigration, /where gallery_state in \('pending','uploading','ready'\)/);
  assert.match(newMigration, /lock table public.event_media in share row exclusive mode/);
  assert.match(newMigration, /begin;[\s\S]+commit;/);
});

test("deferred cleanup stays internal while user success messages are neutral", async () => {
  const editor = await readFile(new URL("../app/create/gallery-editor.js", import.meta.url), "utf8");
  assert.ok(editor.includes('setNotice("사진이 갤러리에서 삭제되었습니다.")'));
  assert.ok(editor.includes('setNotice("갤러리를 새로 불러왔어요.")'));
  assert.doesNotMatch(editor, /result\.cleanupPending/);
  assert.match(editor, /setNotice\(error.message\)/);
  const server = await readFile(new URL("../lib/gallery-server.js", import.meta.url), "utf8");
  assert.match(server, /cleanupPending: data.some/);
  const gallery = await readFile(new URL("../app/invite/[slug]/gallery.js", import.meta.url), "utf8");
  assert.match(gallery, /src=\{photo.thumbnailUrl\|\|photo.url\}/);
  assert.match(gallery, /src=\{photos\[active\]\.url\}/);
});

test("PGlite: deleted hash gets a new path; active duplicates, limits, thumbnails and cleanup survive", { skip: !process.env.TEST_PGLITE_MODULE, timeout: 60000 }, async () => {
  const { PGlite } = await import(pathToFileURL(process.env.TEST_PGLITE_MODULE).href);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create function auth.role() returns text language sql stable as $$select 'service_role'::text$$;`);
    await db.exec((await migration("202609090001_initial_event_platform.sql")).replace("create extension if not exists pgcrypto;", ""));
    await db.exec("alter type event_status add value 'paid'; alter type event_status add value 'suspended'; alter table events add column retention_v2 boolean not null default false;");
    for (const name of ["202609110001_invitation_gallery.sql", "202611090012_upload_reservations.sql", "202611090017_invitation_storage_object_fence.sql", "202611090018_inventory_invitation_storage_references.sql", "202611120001_gallery_thumbnail_path.sql", "202611120002_gallery_thumbnail_link.sql"]) await db.exec(await migration(name));
    const owner=randomUUID(), event=randomUUID(), other=randomUUID(), hash=n=>n.toString(16).padStart(64,"0");
    await db.query("insert into auth.users(id) values($1)",[owner]);
    await db.query("insert into events(id,owner_id,kind,slug,title,status,starts_at) values($1,$3,'wedding','gallery-fixture','Fixture','draft',null),($2,$3,'wedding','legacy-fixture','Legacy','published','2020-01-01')",[event,other,owner]);
    const mutate=async(action,data={},target=event)=>(await db.query("select mutate_invitation_gallery($1,$2,$3,$4) result",[target,owner,action,JSON.stringify(data)])).rows[0].result;
    const ready=async row=>{await mutate("begin",{id:row.id});await mutate("finish",{id:row.id});};
    const rows=await mutate("reserve",{hashes:[hash(1),hash(2),hash(3)]});
    for(const row of rows)await ready(row);
    const old=rows[0];
    const thumb=`${owner}/photo/${event}/${randomUUID()}.webp`;
    await db.query("select finish_invitation_upload(reserve_invitation_upload($1,$2,'invitation-photos',$3),$2,true)",[event,owner,thumb]);
    await db.query("select link_gallery_thumbnail($1,$2,$3,$4)",[event,owner,old.id,thumb]);
    await mutate("delete",{id:old.id});
    await db.query("insert into gallery_storage_cleanup(storage_path,owner_id) values($1,$2)",[old.storage_path,owner]);
    // Demonstrate the original bug before changing the schema.
    assert.equal((await mutate("reserve",{hashes:[hash(1)]}))[0].gallery_state,"deleting");
    await db.exec(newMigration);
    await db.exec(newMigration); // Retry does not reset cleanup records or rows.
    const fresh=(await mutate("reserve",{hashes:[hash(1)]}))[0];
    assert.notEqual(fresh.id,old.id);assert.notEqual(fresh.storage_path,old.storage_path);
    assert.ok(fresh.storage_path.endsWith(`/${fresh.id}.jpg`));
    assert.equal(fresh.gallery_state,"pending");assert.equal(fresh.gallery_thumbnail_path,null);
    const savedOld=(await db.query("select * from event_media where id=$1",[old.id])).rows[0];
    assert.equal(savedOld.gallery_state,"deleting");assert.equal(savedOld.gallery_thumbnail_path,thumb);
    assert.equal((await db.query("select count(*)::int n from gallery_storage_cleanup where storage_path=$1",[old.storage_path])).rows[0].n,1);
    assert.equal((await mutate("reserve",{hashes:[hash(1),hash(1)]}))[0].id,fresh.id);
    await mutate("begin",{id:fresh.id});
    assert.equal((await mutate("reserve",{hashes:[hash(1)]}))[0].id,fresh.id);
    await assert.rejects(()=>mutate("begin",{id:fresh.id}),/GALLERY_BUSY/);
    await mutate("finish",{id:fresh.id});
    assert.equal((await mutate("reserve",{hashes:[hash(1)]}))[0].id,fresh.id);
    const newThumb=`${owner}/photo/${event}/${randomUUID()}.webp`;
    await db.query("select finish_invitation_upload(reserve_invitation_upload($1,$2,'invitation-photos',$3),$2,true)",[event,owner,newThumb]);
    assert.equal((await db.query("select link_gallery_thumbnail($1,$2,$3,$4) path",[event,owner,fresh.id,newThumb])).rows[0].path,newThumb);
    await mutate("reserve",{hashes:Array.from({length:17},(_,i)=>hash(i+4))});
    await assert.rejects(()=>mutate("reserve",{hashes:[hash(21)]}),/GALLERY_LIMIT/);
    assert.equal((await db.query("select count(*)::int n from event_media where event_id=$1 and gallery_state in ('pending','uploading','ready')",[event])).rows[0].n,20);
    assert.equal((await db.query("select count(*)::int n from event_media where event_id=$1 and gallery_state='deleting'",[event])).rows[0].n,1);
    // Repeated delete/reupload never revives old rows.
    await mutate("delete",{id:fresh.id});
    const again=(await mutate("reserve",{hashes:[hash(1)]}))[0];assert.notEqual(again.id,fresh.id);assert.notEqual(again.id,old.id);
    // Cross-event sharing of a content hash remains valid; existing legacy fields survive.
    const legacy=(await mutate("reserve",{hashes:[hash(1)]},other))[0];assert.notEqual(legacy.id,again.id);
    const legacyEvent=(await db.query("select status,starts_at,retention_v2 from events where id=$1",[other])).rows[0];
    assert.equal(legacyEvent.status,"published");assert.equal(legacyEvent.retention_v2,false);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.mutate_invitation_gallery(uuid,uuid,text,jsonb)','execute') allowed")).rows[0].allowed,false);
    assert.equal((await db.query("select count(*)::int n from invitation_storage_object_references where event_id=$1 and storage_path in ($2,$3)",[event,thumb,newThumb])).rows[0].n,2);
  } finally { await db.close(); }
});
