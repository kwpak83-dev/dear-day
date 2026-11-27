import { createClient } from "@supabase/supabase-js";

const options = { auth: { autoRefreshToken: false, persistSession: false } };
export const inquiryJson = (body, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function authenticateInquiry(request, { admin = false } = {}) {
  const token = /^Bearer\s+(\S+)$/i.exec(request.headers.get("authorization") || "")?.[1];
  if (!token) return { error: "로그인이 필요해요.", status: 401 };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !service || (admin && !publicKey)) return { error: "문의 서비스를 준비하지 못했어요.", status: 503 };
  const db = createClient(url, service, options);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data?.user) return { error: "로그인이 만료되었어요.", status: 401 };
  if (admin) {
    const ids = (process.env.DEARDAY_SUPER_ADMIN_IDS || "").split(",").map(id => id.trim());
    if (!ids.includes(data.user.id)) return { error: "접근 권한이 없어요.", status: 403 };
    const userDb = createClient(url, publicKey, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
    const result = await userDb.rpc("is_admin");
    if (result.error || result.data !== true) return { error: "접근 권한이 없어요.", status: 403 };
  }
  return { db, user: data.user };
}
