import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const statuses = new Set(["attending", "not_attending"]);
const requestsByIp = new Map();

function json(body, status = 200) { return NextResponse.json(body, { status }); }
function isRateLimited(request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (requestsByIp.get(key) || []).filter((time) => now - time < 60_000);
  recent.push(now);
  requestsByIp.set(key, recent);
  return recent.length > 5;
}

export async function POST(request) {
  if (isRateLimited(request)) return json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const guestName = typeof body?.guestName === "string" ? body.guestName.trim() : "";
  const status = body?.status;
  const phone = typeof body?.phone === "string" ? body.phone.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const partySize = body?.partySize === "" || body?.partySize == null ? 1 : Number(body.partySize);

  if (!slugPattern.test(slug)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  if (!guestName || guestName.length > 50) return json({ error: "이름을 50자 이내로 입력해 주세요." }, 400);
  if (!statuses.has(status)) return json({ error: "참석 여부를 선택해 주세요." }, 400);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 20) return json({ error: "참석 인원은 1명부터 20명까지 입력해 주세요." }, 400);
  if (phone.length > 30) return json({ error: "연락처를 30자 이내로 입력해 주세요." }, 400);
  if (message.length > 200) return json({ error: "전달사항은 200자 이내로 입력해 주세요." }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "참석 여부 접수 서비스를 준비하지 못했어요." }, 503);
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: event, error } = await supabase.from("events").select("id,starts_at,settings").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return json({ error: "초대장을 확인하지 못했어요." }, 500);
  if (!event) return json({ error: "공개된 초대장을 찾지 못했어요." }, 404);
  if (event.settings?.rsvpEnabled !== true) return json({ error: "참석 여부 접수를 사용하지 않는 초대장이에요." }, 403);
  const startsAt = event.starts_at ? new Date(event.starts_at).getTime() : NaN;
  if (!Number.isFinite(startsAt)) return json({ error: "행사 시간을 확인할 수 없어 참석 여부를 접수할 수 없어요." }, 409);
  if (startsAt <= Date.now()) return json({ error: "행사가 시작되어 참석 여부 접수가 마감되었습니다." }, 409);

  const { error: insertError } = await supabase.from("rsvps").insert({ event_id: event.id, guest_name: guestName, status, party_size: partySize, phone: phone || null, message: message || null });
  if (insertError) {
    console.error("RSVP insert failed:", insertError.code, insertError.message);
    return json({ error: "참석 여부를 전달하지 못했어요. 다시 시도해 주세요." }, 500);
  }
  return json({ submitted: true }, 201);
}