import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const bucket = "invitation-photos";
const maxBytes = 3 * 1024 * 1024;
const fail = (error, status) => Response.json({ error }, { status });

export async function POST(request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return fail("사진 저장 서비스를 준비하지 못했어요.", 503);
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return fail("로그인 후 사진을 첨부할 수 있어요.", 401);
    const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return fail("다시 로그인한 후 사진을 첨부해 주세요.", 401);
    if (request.headers.get("content-type") !== "image/jpeg") return fail("JPG 사진만 업로드할 수 있어요.", 415);
    if (Number(request.headers.get("content-length")) > maxBytes) return fail("사진 용량이 너무 커요.", 413);
    const reader = request.body?.getReader();
    if (!reader) return fail("사진을 선택해 주세요.", 400);
    const chunks = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); return fail("사진 용량이 너무 커요.", 413); }
      chunks.push(Buffer.from(value));
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return fail("올바른 사진 파일을 선택해 주세요.", 400);
    // Only this authenticated server route writes objects; no public write policy.
    const { data: existingBucket } = await supabase.storage.getBucket(bucket);
    if (!existingBucket) {
      const { error: createError } = await supabase.storage.createBucket(bucket, { public: true, fileSizeLimit: maxBytes, allowedMimeTypes: ["image/jpeg"] });
      if (createError) {
        const { data: racedBucket } = await supabase.storage.getBucket(bucket);
        if (!racedBucket) return fail("사진 저장 공간을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.", 503);
      }
    }
    const path = `${user.id}/${randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage.from(bucket).upload(path, bytes, { contentType: "image/jpeg", upsert: false });
    if (uploadError) return fail("사진 업로드에 실패했어요. 다시 시도해 주세요.", 500);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return Response.json({ url: data.publicUrl });
  } catch {
    return fail("사진 업로드 중 연결이 끊겼어요. 다시 시도해 주세요.", 500);
  }
}
