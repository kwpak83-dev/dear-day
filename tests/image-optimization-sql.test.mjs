import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

// Match psql's include boundaries. Concatenating enum migrations into one
// implicit transaction would incorrectly reject subsequent enum usage.
async function executeFile(db,file){
  let chunk="";
  const flush=async()=>{if(chunk.trim())await db.exec(chunk.replaceAll("create extension if not exists pgcrypto;",""));chunk=""};
  for(const line of (await readFile(file,"utf8")).split(/\r?\n/)){
    const include=line.match(/^\\ir (.+)$/);
    if(include){await flush();await executeFile(db,new URL(include[1],file));}
    else if(!line.startsWith("\\set"))chunk+=line+"\n";
  }
  await flush();
}

test("notice cleanup migration has a unique version and exactly two complete function definitions",async()=>{
  const sql=await readFile(new URL('../supabase/migrations/202611120004_notice_webp_cleanup_scope.sql',import.meta.url),'utf8');
  assert.equal((sql.match(/\$claim\$;/g)||[]).length,1);
  assert.equal((sql.match(/create or replace function/gi)||[]).length,2);
  assert.match(sql,/COMMIT;/);
});

test("PGlite executes retention migrations and tests WebP claim ownership, reservation, references and settlement",{skip:!process.env.TEST_PGLITE_MODULE,timeout:90000},async()=>{
  const {PGlite}=await import(pathToFileURL(process.env.TEST_PGLITE_MODULE).href);const db=new PGlite();
  try{
    for(const file of ['retention-migration-order-smoke.sql','retention-creation-cohort-smoke.sql','manual-invitation-cleanup-smoke.sql'])
      await executeFile(db,new URL('./sql/'+file,import.meta.url));
    const sql=await readFile(new URL('../supabase/migrations/202611120004_notice_webp_cleanup_scope.sql',import.meta.url),'utf8');
    await db.exec(sql);await db.exec(sql);
    await db.exec("set request.jwt.claim.role='service_role'");
    const owner='88888888-8888-4888-8888-888888888888',event=randomUUID(),survivor=randomUUID();
    await db.query("insert into events(id,owner_id,kind,status,slug,title) values($1,$3,'wedding','draft',$4,'Image fixture'),($2,$3,'wedding','draft',$5,'Protected')",[event,survivor,owner,'image-'+event,'protected-'+survivor]);
    const cases=[['notice','jpg',true],['notice','webp',true],['gallery','jpg',true],['gallery','webp',false],['photo','jpg',true],['photo','webp',true],['notice','webp',false,'shared'],['notice','webp',false,'unreserved']];
    for(const c of cases){c.push(`${owner}/${c[0]}/${event}/${randomUUID()}.${c[1]}`);if(c[3]!=='unreserved')await db.query("select finish_invitation_upload(reserve_invitation_upload($1,$2,'invitation-photos',$3),$2,true)",[event,owner,c.at(-1)]);}
    const shared=cases.find(c=>c[3]==='shared').at(-1);
    await db.query("insert into invitation_storage_object_references(event_id,bucket,storage_path) values($1,'invitation-photos',$2)",[survivor,shared]);
    const expected=(await db.query('select updated_at from events where id=$1',[event])).rows[0].updated_at;
    assert.ok((await db.query('select delete_invitation_and_queue_storage($1,$2,$3) result',[event,owner,expected])).rows[0].result);
    for(const c of cases){
      const path=c.at(-1);const row=(await db.query("select id,status from invitation_storage_cleanup_jobs where event_id=$1 and storage_path=$2",[event,path])).rows[0];
      if(c[3]==='unreserved'){assert.equal(row,undefined);continue;}
      assert.ok(row);if(c[0]==='gallery'&&c[1]==='webp')assert.equal(row.status,'failed');
      const claims=(await db.query('select * from claim_scoped_invitation_storage_cleanup($1)',[row.id])).rows;
      assert.equal(claims.length,c[2]?1:0,`${c[0]} ${c[1]} ${c[3]||''}`);
      if(claims.length){
        assert.equal((await db.query('select * from claim_scoped_invitation_storage_cleanup($1)',[row.id])).rows.length,0);
        assert.equal((await db.query('select settle_scoped_invitation_storage_cleanup($1,$2,false) ok',[row.id,claims[0].attempt])).rows[0].ok,true);
      }
    }
    // The cleanup RPC does not remove bytes. Shared references and the survivor persist.
    assert.equal((await db.query('select count(*)::int n from events where id=$1',[survivor])).rows[0].n,1);
    assert.equal((await db.query("select has_function_privilege('authenticated','public.claim_scoped_invitation_storage_cleanup(bigint)','execute') allowed")).rows[0].allowed,false);
  }finally{await db.close()}
});
