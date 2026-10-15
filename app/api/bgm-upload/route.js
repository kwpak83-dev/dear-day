import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const bucket = "invitation-bgm";
const maxBytes = 10 * 1024 * 1024;
const fail = (error, status) => Response.json({ error }, { status });

const getClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
};

const getUser = async (request, supabase) => {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user } } = await supabase.auth.getUser(token);
  return user || null;
};

export async function POST(request) {
  try {
    const supabase = getClient();
    if (!supabase) return fail("음악 저장 서비스를 준비하지 못했어요.", 503);
    const user = await getUser(request, supabase);
    if (!user) return fail("로그인 후 음악을 첨부할 수 있어요.", 401);
    const type = (request.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!["audio/mpeg","audio/mp3"].includes(type)) return fail("MP3 파일만 업로드할 수 있어요.", 415);
    if (Number(request.headers.get("content-length")) > maxBytes) return fail("음악은 최대 10MB까지 업로드할 수 있어요.", 413);
    const reader = request.body?.getReader();
    if (!reader) return fail("음악 파일을 선택해 주세요.", 400);
    const chunks=[]; let size=0;
    while(true){ const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>maxBytes){await reader.cancel();return fail("음악은 최대 10MB까지 업로드할 수 있어요.",413);} chunks.push(Buffer.from(value)); }
    const bytes=Buffer.concat(chunks);
    if(bytes.length<3 || !((bytes[0]===0x49&&bytes[1]===0x44&&bytes[2]===0x33)||(bytes[0]===0xff&&(bytes[1]&0xe0)===0xe0))) return fail("올바른 MP3 파일을 선택해 주세요.",400);
    const {data:existing}=await supabase.storage.getBucket(bucket);
    if(!existing){ const {error}=await supabase.storage.createBucket(bucket,{public:true,fileSizeLimit:maxBytes,allowedMimeTypes:["audio/mpeg","audio/mp3"]}); if(error){const {data:raced}=await supabase.storage.getBucket(bucket);if(!raced)return fail("음악 저장 공간을 준비하지 못했어요.",503);} }
    const path=`${user.id}/${randomUUID()}.mp3`;
    const {error}=await supabase.storage.from(bucket).upload(path,bytes,{contentType:"audio/mpeg",upsert:false});
    if(error) return fail("음악 업로드에 실패했어요. 다시 시도해 주세요.",500);
    return Response.json({path,url:supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl});
  } catch { return fail("음악 업로드 중 연결이 끊겼어요. 다시 시도해 주세요.",500); }
}

export async function DELETE(request) {
  try {
    const supabase=getClient();
    if(!supabase) return fail("음악 저장 서비스를 준비하지 못했어요.",503);
    const user=await getUser(request,supabase);
    if(!user) return fail("다시 로그인해 주세요.",401);
    const {path}=await request.json().catch(()=>({}));
    if(typeof path!=="string" || !path.startsWith(user.id+"/") || !path.endsWith(".mp3")) return fail("삭제할 음악을 확인하지 못했어요.",400);
    const {error}=await supabase.storage.from(bucket).remove([path]);
    if(error) return fail("음악 삭제에 실패했어요.",500);
    return Response.json({ok:true});
  } catch { return fail("음악 삭제 중 연결이 끊겼어요.",500); }
}
