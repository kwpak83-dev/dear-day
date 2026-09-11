const fs = require('node:fs');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
(async () => {
  const source = fs.readFileSync(__dirname + '/../../lib/gallery-server.js','utf8').replace('import { createClient } from "@supabase/supabase-js";', 'const createClient = () => globalThis.testClient;');
  const lib = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const owner=randomUUID(), event=randomUUID(), id=randomUUID();
  let rows=[], outbox=[], files=new Set(), removed=[], failStorage=false, failDB=false, referenced=false;
  globalThis.testClient={
    auth:{getUser:async token=>({data:{user:token==='valid'?{id:owner}:null}})},
    from(table){
      const filters=[];
      let deleting=false;
      const query={select(){return query;},update(){return query;},delete(){deleting=true;return query;},eq(key,value){filters.push(row=>row[key]===value);return query;},neq(key,value){filters.push(row=>row[key]!==value);return query;},lt(){return query;},not(){return query;},limit(){return query;},order(){return query;},maybeSingle(){return Promise.resolve({data:null});},
        then(resolve){
          if(table==='gallery_storage_cleanup') {
            const selected=outbox.filter(row=>filters.every(test=>test(row)));
            if(deleting)outbox=outbox.filter(row=>!selected.includes(row));
            return Promise.resolve({data:selected}).then(resolve);
          }
          return Promise.resolve(table==='events'?{data:referenced?[{id:'another'}]:[]}:{data:rows.filter(row=>filters.every(test=>test(row)))}).then(resolve);
        }};
      return query;
    },
    rpc:async(name,{p_action,p_data})=>{
      if(p_action==='purge') {
        if(failDB)return {error:{message:'connection failed'}};
        rows=rows.filter(row=>row.id!==p_data.id);
      }
      return {data:true};
    },
    storage:{from:()=>({getPublicUrl:path=>({data:{publicUrl:'https://example.test/'+path}}),remove:async paths=>{removed.push(...paths);if(failStorage)return {error:{message:'offline'}};paths.forEach(path=>files.delete(path));return {};}})},
  };
  const context={supabase:globalThis.testClient,user:{id:owner},event:{id:event}};
  const seed=()=>{const path=`${owner}/gallery/${event}/${id}.jpg`;rows=[{id,event_id:event,storage_path:path,gallery_state:'deleting'}];files=new Set([path]);removed=[];};
  seed(); failStorage=true; await lib.cleanupGallery(context); assert.equal(rows.length,1);assert.equal(files.size,1);
  failStorage=false;failDB=true;await lib.cleanupGallery(context);assert.equal(rows.length,1);assert.equal(files.size,0);
  failDB=false;await lib.cleanupGallery(context);assert.equal(rows.length,0); // Retry of already-removed object.
  seed();referenced=true;await lib.cleanupGallery(context);assert.equal(removed.length,0);assert.equal(rows.length,1);
  referenced=false;await lib.cleanupGallery(context);assert.equal(rows.length,0);
  seed();rows[0].storage_path='someone-else/main.jpg';await lib.cleanupGallery(context);assert.equal(removed.length,0);
  seed();outbox=[{storage_path:rows[0].storage_path,owner_id:owner}];rows=[];
  failStorage=true;await lib.cleanupOrphanPhotos(context.supabase,owner);assert.equal(outbox.length,1);assert.equal(files.size,1);
  failStorage=false;referenced=true;await lib.cleanupOrphanPhotos(context.supabase,owner);assert.equal(outbox.length,1);
  referenced=false;await lib.cleanupOrphanPhotos(context.supabase,owner);assert.equal(outbox.length,0);assert.equal(files.size,0);
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
  await assert.rejects(()=>lib.galleryContext(new Request('http://test/api/gallery?slug=valid-slug')),error=>error.status===401);
  await assert.rejects(()=>lib.galleryContext(new Request('http://test/api/gallery?slug=valid-slug',{headers:{Authorization:'Bearer expired'}})),error=>error.status===401);
  await assert.rejects(()=>lib.galleryContext(new Request('http://test/api/gallery?slug=someone-elses',{headers:{Authorization:'Bearer valid'}})),error=>error.status===404);
  const request=(body,type='image/jpeg')=>new Request('http://test',{method:'PUT',headers:{'Content-Type':type},body});
  await assert.rejects(()=>lib.readPhotoBytes(request('bad','image/svg+xml')),error=>error.status===415);
  await assert.rejects(()=>lib.readPhotoBytes(request('bad')),error=>error.status===400);
  await assert.rejects(()=>lib.readPhotoBytes(request(new Uint8Array(3*1024*1024+1))),error=>error.status===413);
  assert.equal((await lib.readPhotoBytes(request(new Uint8Array([255,216,255,217])))).length,4);
  console.log('PASS server: auth/ownership, file limits, deletion retry after Storage/DB failure, shared references, main/foreign path protection. Storage is mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
