import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json = (body, status = 200) => NextResponse.json(body, { status });
const kinds = new Set(["wedding","first_birthday","birthday","milestone_birthday","gathering","opening","baby_shower","bridal_shower","anniversary","housewarming","graduation","corporate","party","other"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bucket = "template-assets";
async function admin(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !key || !publicKey) return { error: "관리자 설정을 확인해 주세요.", status: 503 };
  if (!token) return { error: "로그인이 필요합니다.", status: 401 };
  const server = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error } = await server.auth.getUser(token);
  if (error || !user) return { error: "로그인이 만료되었습니다.", status: 401 };
  const client = createClient(url, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: isAdmin, error: roleError } = await client.rpc("is_admin");
  if (roleError || isAdmin !== true) return { error: "관리자 권한이 없습니다.", status: 403 };
  return { server };
}
function fields(input) {
  const title = typeof input?.title === "string" ? input.title.trim() : "";
  const composer = typeof input?.composer === "string" ? input.composer.trim() : "";
  const license = typeof input?.license_name === "string" ? input.license_name.trim() : "";
  const eventKinds = input?.event_kinds;
  if (!title || title.length > 120 || composer.length > 120 || !license || license.length > 120 ||
      !Array.isArray(eventKinds) || eventKinds.some(k => !kinds.has(k)) || new Set(eventKinds).size !== eventKinds.length ||
      typeof input?.is_active !== "boolean" || !Number.isInteger(input?.sort_order) ||
      input.sort_order < -10000 || input.sort_order > 10000) return null;
  return { title, composer, license_name: license, event_kinds: eventKinds, is_active: input.is_active, sort_order: input.sort_order };
}
export async function GET(request) {
  const auth = await admin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const { data, error } = await auth.server.from("bgm_tracks").select("*").order("sort_order").order("created_at");
  if (error) return json({ error: "음악 목록을 불러오지 못했어요. DB 변경 SQL 적용 여부를 확인해 주세요." }, 500);
  return json({ tracks: (data || []).map(t => ({ ...t, url: auth.server.storage.from(t.storage_bucket).getPublicUrl(t.storage_path).data.publicUrl })) });
}
export async function POST(request) {
  const auth = await admin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  let input;
  try { input = JSON.parse(form?.get("details") || "null"); } catch { return json({ error: "입력 형식이 올바르지 않아요." }, 400); }
  const values = fields(input);
  if (!values || !file || typeof file.arrayBuffer !== "function" || file.size < 1 || file.size > 10 * 1024 * 1024 ||
      !(file.name || "").toLowerCase().endsWith(".mp3") || !["audio/mpeg","audio/mp3","application/octet-stream",""].includes(file.type)) {
    return json({ error: "정보를 확인하고 10MB 이하 MP3를 선택해 주세요." }, 400);
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length < 3 || !(bytes.subarray(0,3).toString() === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0))) return json({ error: "올바른 MP3 파일이 아니에요." }, 400);
  const path = `bgm-catalog/${randomUUID()}.mp3`;
  const { error: uploadError } = await auth.server.storage.from(bucket).upload(path, bytes, { contentType: "audio/mpeg", upsert: false });
  if (uploadError) return json({ error: "MP3 업로드에 실패했어요." }, 500);
  const { error } = await auth.server.from("bgm_tracks").insert({ ...values, storage_bucket: bucket, storage_path: path });
  if (error) {
    await auth.server.storage.from(bucket).remove([path]);
    return json({ error: "음악 등록에 실패했어요. DB 변경 SQL 적용 여부를 확인해 주세요." }, 500);
  }
  return json({ ok: true }, 201);
}
export async function PATCH(request) {
  const auth = await admin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const input = await request.json().catch(() => null);
  const values = fields(input);
  if (!uuid.test(input?.id || "") || !values) return json({ error: "수정할 정보를 확인해 주세요." }, 400);
  const { data, error } = await auth.server.from("bgm_tracks").update(values).eq("id", input.id).select("id").maybeSingle();
  if (error || !data) return json({ error: "음악 수정에 실패했어요." }, 500);
  return json({ ok: true });
}
export async function DELETE(request) {
  const auth = await admin(request);
  if (auth.error) return json({ error: auth.error }, auth.status);
  const input = await request.json().catch(() => null);
  if (!uuid.test(input?.id || "")) return json({ error: "음악을 선택해 주세요." }, 400);
  const { data: track, error: readError } = await auth.server.from("bgm_tracks").select("*").eq("id", input.id).maybeSingle();
  if (readError || !track) return json({ error: "음악을 찾을 수 없어요." }, 404);
  // Never delete an asset referenced by an invitation, including drafts and suspended invitations.
  const { count, error: usageError } = await auth.server.from("events").select("id", { count: "exact", head: true })
    .contains("settings", { userBgmTrackId: input.id });
  if (usageError) return json({ error: "사용 중 여부를 확인할 수 없어 삭제를 중단했어요." }, 503);
  if (count > 0) return json({ error: `이 음악을 사용하는 초대장이 ${count}개 있어요. 삭제 대신 숨기기를 이용해 주세요.` }, 409);
  // Legacy files can also be used by templates; only catalog-owned uploads may be physically removed.
  if (track.storage_bucket !== bucket || !/^bgm-catalog\/[0-9a-f-]{36}\.mp3$/.test(track.storage_path)) {
    return json({ error: "기존 공용 파일은 다른 템플릿에서도 사용할 수 있어 완전 삭제를 제한했어요. 숨기기를 이용해 주세요." }, 409);
  }
  const { error: storageError } = await auth.server.storage.from(bucket).remove([track.storage_path]);
  if (storageError) return json({ error: "Storage 파일 삭제에 실패했어요. 다시 시도해 주세요." }, 503);
  const { error: deleteError } = await auth.server.from("bgm_tracks").delete().eq("id", input.id);
  if (deleteError) return json({ error: "파일은 삭제됐지만 목록 정리에 실패했어요. 관리자에게 확인이 필요합니다." }, 500);
  return json({ ok: true });
}
