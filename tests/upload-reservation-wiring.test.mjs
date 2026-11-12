import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const read = async path => readFile(new URL("../"+path,import.meta.url),"utf8");

test("all editor photo/BGM POST calls supply event slug",async()=>{
  const src=await read("app/create/page.js");
  const calls=[...src.matchAll(/fetch\("\/api\/(photos|bgm-upload)"\s*,\s*\{[\s\S]*?\}\)/g)]
    .filter(m=>/method\s*:\s*"POST"/.test(m[0]));
  assert.ok(calls.length >= 3,"expected shared photo upload, HERO upload and BGM upload calls");
  for(const call of calls)assert.match(call[0],/"X-Event-Slug"\s*:\s*await uploadEventSlug\(\)/);
});
test("gallery reserves in DB before sending Storage bytes",async()=>{
  const route=await read("app/api/gallery/route.js");
  assert.ok(route.indexOf('mutateGallery(context, "reserve"')>=0);
  assert.ok(route.indexOf('mutateGallery(context, "begin"')<route.indexOf(".upload(row.storage_path"));
  assert.ok(route.indexOf(".upload(row.storage_path")<route.indexOf('mutateGallery(context, "finish"'));
});
test("photo, notice and BGM uploads reserve before upload and finalize after",async()=>{
  for(const path of ["app/api/photos/route.js","app/api/notice-photo/route.js","app/api/bgm-upload/route.js"]){
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

test("expired published and suspended events cannot reserve uploads",async()=>{
  const sql=await read("supabase/migrations/202611090014_upload_reservation_readonly_guard.sql");
  assert.match(sql,/v_event\.status in \('published','suspended'\)/);
  assert.match(sql,/v_event\.starts_at<=clock_timestamp\(\)/);
  assert.match(sql,/from public\.events where id=p_event for update/);
});
test("manual and scheduled deletion both collect reservation rows",async()=>{
  const sql=await read("supabase/migrations/202611090013_collect_upload_reservations_on_deletion.sql");
  assert.equal((sql.match(/from public\.invitation_upload_reservations/g)||[]).length,2);
  assert.match(sql,/where event_id=p_event and owner_id=p_owner/);
  assert.match(sql,/where event_id=v_event\.id and owner_id=v_event\.owner_id/);
});
test("first upload saves an event when the client opt-in is enabled",async()=>{
  const helper=await read("lib/invitation-upload-reservation.js");
  assert.match(helper,/x-event-slug/);
  assert.match(helper,/초대장을 먼저 임시저장/);
  const editor=await read("app/create/page.js");
  assert.ok(editor.includes('const [eventSlug, setEventSlug] = useState("")'));
  assert.match(editor,/NEXT_PUBLIC_INVITATION_UPLOAD_RESERVATIONS_READY === "true"/);
  assert.match(editor,/saveDraft\(\{ showLoading: false, allowUploadBusy: true \}\)/);
  assert.match(editor,/if \(!slug \|\| slug === "local"\) throw new Error/);
});

test("shared editor upload helper is used for wedding, parents, timeline and brand images", async () => {
  const src = await read("app/create/page.js");
  for (const handler of ["uploadBrandImage", "uploadParentIntroPhoto", "uploadWeddingSectionPhoto", "uploadTimelinePhoto"]) {
    const start = src.indexOf("const " + handler + " =");
    assert.ok(start >= 0, handler);
    const end = src.indexOf("\n  };", start);
    assert.ok(end > start, handler + " must have a complete handler body");
    const section = src.slice(start, end);
    assert.match(section, /uploadEditorPhoto\(file,\s*session\)/, handler);
  }
  assert.match(src, /WEBP_UPLOAD_FAILED/);
});
test("notice WebP save validation and cleanup scopes stay aligned", async () => {
  const events = await read("app/api/events/route.js");
  assert.match(events, /isNoticeImagePath\(invitation.notice.imagePath, user.id, existing\?\.id\)/);
  const cleanup = await read("lib/invitation-storage-cleanup-scope.js");
  assert.match(cleanup, /\["notice", "photo"\]/);
  const sql = await read("supabase/migrations/202611120004_notice_webp_cleanup_scope.sql");
  assert.match(sql, /notice\//);
  assert.match(sql, /\[\.\]\(jpg\|webp\)/);
});
