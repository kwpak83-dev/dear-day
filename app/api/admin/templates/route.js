import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const json = (body, status = 200) => NextResponse.json(body, { status });

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!url || !publishableKey || !serviceRoleKey) return json({ error: "관리자 서비스를 준비하지 못했어요." }, 503);
  if (!token) return json({ error: "로그인이 필요합니다." }, 401);

  const authClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) return json({ error: "로그인이 만료되었습니다." }, 401);

  const adminClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isAdmin, error: adminError } = await adminClient.rpc("is_admin");
  if (adminError) return json({ error: "관리자 권한을 확인하지 못했어요." }, 500);
  if (isAdmin !== true) return json({ error: "관리자만 접근할 수 있습니다." }, 403);

  const { data, error } = await adminClient.from("templates")
    .select("id,name,template_key,status,is_visible")
    .order("sort_order", { ascending: true });
  if (error) return json({ error: "템플릿 목록을 불러오지 못했어요." }, 500);
  return json({ templates: data || [] });
}
