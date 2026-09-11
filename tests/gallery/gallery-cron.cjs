const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
  let created=0,events=0,orphans=0;
  globalThis.cronClient=()=>{created++;return {from:table=>{
    const query={select(){return query;},in(){return query;},lt(){return query;},order(){return query;},limit(){return query;},then(resolve){return Promise.resolve({data:table==='event_media'?[{event_id:'event',events:{owner_id:'owner'}}]:[{owner_id:'owner'}]}).then(resolve);}};return query;
  }}};
  globalThis.cronHelpers={cleanupGallery:async context=>{assert.equal(context.event.id,'event');events++;},cleanupOrphanPhotos:async(client,owner)=>{assert.equal(owner,'owner');orphans++;}};
  const source=fs.readFileSync(__dirname+'/../../app/api/gallery/cleanup/route.js','utf8')
    .replace('import { createClient } from "@supabase/supabase-js";','const createClient = globalThis.cronClient;')
    .replace(/import \{ cleanupGallery, cleanupOrphanPhotos \} from "[^"]+";/,'const { cleanupGallery, cleanupOrphanPhotos } = globalThis.cronHelpers;');
  const {GET}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const request=token=>new Request('http://test/api/gallery/cleanup',{headers:token?{Authorization:'Bearer '+token}:{}});
  delete process.env.CRON_SECRET;assert.equal((await GET(request())).status,401);
  process.env.CRON_SECRET='test-secret';assert.equal((await GET(request('wrong'))).status,401);assert.equal(created,0);
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;assert.equal((await GET(request('test-secret'))).status,503);
  process.env.NEXT_PUBLIC_SUPABASE_URL='https://example.test';process.env.SUPABASE_SERVICE_ROLE_KEY='test';
  assert.equal((await GET(request('test-secret'))).status,200);assert.equal(events,1);assert.equal(orphans,1);
  console.log('PASS cron: missing/wrong secret rejected before DB access, config validation, event and orphan cleanup invoked. Backend mocked.');
})().catch(error=>{console.error(error);process.exitCode=1;});
