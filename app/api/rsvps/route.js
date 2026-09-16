import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { isPublicPeriodExpired } from "../../../lib/invitation-retention";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const statuses = new Set(["attending", "not_attending"]);
const requestsByIp = new Map();

function json(body, status = 200) { return NextResponse.json(body, { status }); }
function isRateLimited(request) {
  const key = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (requestsByIp.get(key) || []).filter((time) => now - time < 60_000);
  recent.push(now); requestsByIp.set(key, recent);
  return recent.length > 5;
}
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}
function tokenHash(token) { return createHash("sha256").update(token).digest("hex"); }
function readFields(body) {
  return {
    guestName: typeof body?.guestName === "string" ? body.guestName.trim() : "",
    status: body?.status,
    phone: typeof body?.phone === "string" ? body.phone.trim() : "",
    message: typeof body?.message === "string" ? body.message.trim() : "",
    partySize: body?.partySize === "" || body?.partySize == null ? 1 : Number(body.partySize),
  };
}
function validateFields(fields) {
  if (!fields.guestName || fields.guestName.length > 50) return "이름을 50자 이내로 입력해 주세요.";
  if (!statuses.has(fields.status)) return "참석 여부를 선택해 주세요.";
  if (!Number.isInteger(fields.partySize) || fields.partySize < 1 || fields.partySize > 20) return "참석 인원은 1명부터 20명까지 입력해 주세요.";
  if (fields.phone.length > 30) return "연락처를 30자 이내로 입력해 주세요.";
  if (fields.message.length > 200) return "전달사항은 200자 이내로 입력해 주세요.";
  return "";
}
async function getEvent(supabase, slug) {
  const { data, error } = await supabase.from("events").select("id,status,starts_at,service_expires_at,grace_ends_at,settings").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return { error: "초대장을 확인하지 못했어요.", status: 500 };
  if (!data) return { error: "공개된 초대장을 찾지 못했어요.", status: 404 };
  if (isPublicPeriodExpired(data)) return { error: "초대장 이용기간이 종료되어 참석 여부를 처리할 수 없어요.", status: 410 };
  if (data.settings?.rsvpEnabled !== true) return { error: "현재 RSVP 접수가 비활성화되어 있어요.", status: 403 };
  const startsAt = data.starts_at ? new Date(data.starts_at).getTime() : NaN;
  if (!Number.isFinite(startsAt)) return { error: "행사 시간을 확인할 수 없어 참석 여부를 처리할 수 없어요.", status: 409 };
  if (startsAt <= Date.now()) return { error: "행사가 시작되어 참석 여부 접수가 마감되었습니다.", status: 409 };
  return { event: data };
}
async function getRsvp(supabase, eventId, token) {
  const { data, error } = await supabase.from("rsvps").select("id,guest_name,status,party_size,phone,message").eq("event_id", eventId).eq("edit_token_hash", tokenHash(token)).maybeSingle();
  if (error) return { error: "참석 여부를 확인하지 못했어요.", status: 500 };
  if (!data) return { error: "유효하지 않은 RSVP 수정 링크예요.", status: 404 };
  return { rsvp: data };
}

export async function POST(request) {
  if (isRateLimited(request)) return json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const fields = readFields(body);
  if (!slugPattern.test(slug)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  const validationError = validateFields(fields);
  if (validationError) return json({ error: validationError }, 400);
  const supabase = getClient();
  if (!supabase) return json({ error: "참석 여부 접수 서비스를 준비하지 못했어요." }, 503);
  const context = await getEvent(supabase, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const editToken = randomBytes(32).toString("base64url");
  const { error } = await supabase.from("rsvps").insert({ event_id: context.event.id, guest_name: fields.guestName, status: fields.status, party_size: fields.partySize, phone: fields.phone || null, message: fields.message || null, edit_token_hash: tokenHash(editToken) });
  if (error) { console.error("RSVP insert failed:", error.code, error.message); return json({ error: "참석 여부를 전달하지 못했어요. 다시 시도해 주세요." }, 500); }
  return json({ submitted: true, editToken }, 201);
}

export async function GET(request) {
  if (isRateLimited(request)) return json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  const query = new URL(request.url).searchParams;
  const slug = query.get("slug")?.trim() || "";
  const token = query.get("token")?.trim() || "";
  if (!slugPattern.test(slug) || !tokenPattern.test(token)) return json({ error: "유효하지 않은 RSVP 수정 링크예요." }, 400);
  const supabase = getClient();
  if (!supabase) return json({ error: "참석 여부 접수 서비스를 준비하지 못했어요." }, 503);
  const context = await getEvent(supabase, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const result = await getRsvp(supabase, context.event.id, token);
  if (result.error) return json({ error: result.error }, result.status);
  return json({ rsvp: { guestName: result.rsvp.guest_name, status: result.rsvp.status, partySize: result.rsvp.party_size, phone: result.rsvp.phone || "", message: result.rsvp.message || "" } });
}

export async function PATCH(request) {
  if (isRateLimited(request)) return json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const fields = readFields(body);
  if (!slugPattern.test(slug) || !tokenPattern.test(token)) return json({ error: "유효하지 않은 RSVP 수정 링크예요." }, 400);
  const validationError = validateFields(fields);
  if (validationError) return json({ error: validationError }, 400);
  const supabase = getClient();
  if (!supabase) return json({ error: "참석 여부 접수 서비스를 준비하지 못했어요." }, 503);
  const context = await getEvent(supabase, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const current = await getRsvp(supabase, context.event.id, token);
  if (current.error) return json({ error: current.error }, current.status);
  const { data, error } = await supabase.from("rsvps").update({ guest_name: fields.guestName, status: fields.status, party_size: fields.partySize, phone: fields.phone || null, message: fields.message || null }).eq("id", current.rsvp.id).eq("event_id", context.event.id).eq("edit_token_hash", tokenHash(token)).select("id").maybeSingle();
  if (error) { console.error("RSVP update failed:", error.code, error.message); return json({ error: "참석 여부를 수정하지 못했어요. 다시 시도해 주세요." }, 500); }
  if (!data) return json({ error: "유효하지 않은 RSVP 수정 링크예요." }, 404);
  return json({ updated: true });
}