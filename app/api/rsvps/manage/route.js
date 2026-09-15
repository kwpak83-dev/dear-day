import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getInvitationTitle } from "../../../../lib/invitation-title";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const filters = new Set(["all", "attending", "not_attending"]);
const json = (body, status = 200) => NextResponse.json(body, { status });

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "하객 관리 서비스를 준비하지 못했어요." }, 503);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "로그인 정보를 찾지 못했어요." }, 401);

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "로그인이 만료되었어요. 다시 로그인해 주세요." }, 401);

  const query = new URL(request.url).searchParams;
  const requestedSlug = query.get("slug")?.trim() || "";
  const filter = query.get("filter") || "all";
  if ((requestedSlug && !slugPattern.test(requestedSlug)) || !filters.has(filter)) return json({ error: "조회 조건이 올바르지 않아요." }, 400);

  const { data: ownedEvents, error: eventError } = await supabase.from("events")
    .select("id,slug,title,kind,status,starts_at,settings,updated_at").eq("owner_id", user.id).eq("status", "published").order("updated_at", { ascending: false });
  if (eventError) return json({ error: "초대장 목록을 불러오지 못했어요." }, 500);
  const events = (ownedEvents || []).map((event) => ({
    slug: event.slug,
    title: getInvitationTitle(event.settings || {}, event.kind) || event.title,
    kind: event.kind,
    startsAt: event.starts_at,
    rsvpEnabled: event.settings?.rsvpEnabled === true,
  }));
  if (!events.length) return json({ events: [], selectedSlug: "", summary: { total: 0, attending: 0, notAttending: 0, partySize: 0 }, rsvps: [], filteredCount: 0 });

  const selectedSlug = requestedSlug || events[0].slug;
  const selectedEvent = (ownedEvents || []).find((event) => event.slug === selectedSlug);
  if (!selectedEvent) return json({ error: "관리할 수 있는 초대장을 찾지 못했어요." }, 404);

  const { data: rows, error: rsvpError } = await supabase.from("rsvps")
    .select("id,guest_name,status,party_size,phone,message,created_at,updated_at").eq("event_id", selectedEvent.id)
    .order("updated_at", { ascending: false }).order("created_at", { ascending: false });
  if (rsvpError) return json({ error: "참석 여부 목록을 불러오지 못했어요." }, 500);
  const allRows = rows || [];
  const visibleRows = filter === "all" ? allRows : allRows.filter((row) => row.status === filter);
  const summary = {
    total: allRows.length,
    attending: allRows.filter((row) => row.status === "attending").length,
    notAttending: allRows.filter((row) => row.status === "not_attending").length,
    partySize: allRows.filter((row) => row.status === "attending").reduce((sum, row) => sum + (Number(row.party_size) || 0), 0),
  };
  return json({ events, selectedSlug, summary, filteredCount: visibleRows.length, rsvps: visibleRows.map((row) => ({ id: row.id, guestName: row.guest_name, status: row.status, partySize: row.party_size, phone: row.phone || "", message: row.message || "", createdAt: row.created_at, updatedAt: row.updated_at || row.created_at })) });
}