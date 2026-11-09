import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}
async function authenticate(request, supabase) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: { user }, error } = await supabase.auth.getUser(token);
  return error ? null : user;
}
export async function GET(request) {
  const supabase = client();
  if (!supabase) return Response.json({ error: "Configuration missing" }, { status: 503 });
  const user = await authenticate(request, supabase);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.from("invitation_retention_notices")
    .select("id,event_id,notice_type,deletion_due_at,created_at,read_at,events!inner(slug,starts_at)")
    .eq("owner_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return Response.json({ error: "Notice lookup failed" }, { status: 500 });
  // Discard notices whose event date has changed since they were issued.
  const { eventDeletionTime } = await import("../../../../lib/invitation-retention");
  return Response.json({ notices: (data || []).filter(row =>
    eventDeletionTime(row.events?.starts_at) === new Date(row.deletion_due_at).getTime()
  ) }, { headers: { "Cache-Control": "no-store" } });
}
export async function PATCH(request) {
  const supabase = client();
  if (!supabase) return Response.json({ error: "Configuration missing" }, { status: 503 });
  const user = await authenticate(request, supabase);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!/^[0-9a-f-]{36}$/i.test(body?.id || "")) return Response.json({ error: "Invalid notice" }, { status: 400 });
  const { data, error } = await supabase.from("invitation_retention_notices")
    .update({ read_at: new Date().toISOString() }).eq("id", body.id).eq("owner_id", user.id)
    .select("id,read_at").maybeSingle();
  if (error) return Response.json({ error: "Notice update failed" }, { status: 500 });
  return Response.json({ notice: data });
}
