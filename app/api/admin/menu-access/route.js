import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ canManage: false }, { headers: { "Cache-Control": "no-store" } });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !serviceKey || !publishableKey) return NextResponse.json({ canManage: false }, { headers: { "Cache-Control": "no-store" } });
  const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user }, error } = await db.auth.getUser(token);
  if (error || !user) return NextResponse.json({ canManage: false }, { headers: { "Cache-Control": "no-store" } });
  const allowed = (process.env.DEARDAY_SUPER_ADMIN_IDS || "").split(",").map(id => id.trim()).filter(Boolean);
  if (!allowed.includes(user.id)) return NextResponse.json({ canManage: false }, { headers: { "Cache-Control": "no-store" } });
  const adminDb = createClient(url, publishableKey, { global: { headers: { Authorization: "Bearer " + token } }, auth: { persistSession: false, autoRefreshToken: false } });
  const { data: isAdmin, error: adminError } = await adminDb.rpc("is_admin");
  return NextResponse.json({ canManage: !adminError && isAdmin === true }, { headers: { "Cache-Control": "no-store" } });
}
