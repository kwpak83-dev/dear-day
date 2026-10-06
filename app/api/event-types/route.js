import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return NextResponse.json({ types: [] });

  const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await supabase.from("event_type_configs")
    .select("kind,label,fields")
    .order("sort_order");
  if (error) {
    console.error("Event type config query failed:", error.code);
    return NextResponse.json({ types: [] });
  }
  return NextResponse.json({ types: data || [] });
}
