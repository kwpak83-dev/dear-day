import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async path => readFile(new URL("../"+path,import.meta.url),"utf8");

test("all editor photo/BGM POST calls supply event slug",async()=>{
  const src=await read("app/create/page.js");
  const calls=[...src.matchAll(/fetch\("\/api\/(photos|bgm-upload)"\s*,\s*\{[\s\S]*?\}\)/g)]
    .filter(m=>/method\s*:\s*"POST"/.test(m[0]));
  assert.equal(calls.length,7,"expected all seven editor upload calls");
  for(const call of calls)assert.match(call[0],/"X-Event-Slug"\s*:\s*eventSlug\s*\|\|\s*""/);
});
test("gallery reserves in DB before sending Storage bytes",async()=>{
  const route=await read("app/api/gallery/route.js");
  assert.ok(route.indexOf('mutateGallery(context, "reserve"')>=0);
  assert.ok(route.indexOf('mutateGallery(context, "begin"')<route.indexOf(".upload(row.storage_path"));
  assert.ok(route.indexOf(".upload(row.storage_path")<route.indexOf('mutateGallery(context, "finish"'));
});
test("photo and BGM uploads reserve before upload and finalize after",async()=>{
  for(const path of ["app/api/photos/route.js","app/api/bgm-upload/route.js"]){
    const src=await read(path);
    assert.ok(src.indexOf("reserveUploadIfEnabled(")<src.indexOf(".upload(path"),path);
    assert.ok(src.indexOf(".upload(path")<src.indexOf("finishReservedUpload("),path);
  }
});
test("reservation feature is opt-in, physical deletion stays disabled",async()=>{
  const helper=await read("lib/invitation-upload-reservation.js");
  assert.match(helper,/INVITATION_UPLOAD_RESERVATIONS_READY !== "true"/);
  assert.doesNotMatch(helper,/\.remove\s*\(/);
});
