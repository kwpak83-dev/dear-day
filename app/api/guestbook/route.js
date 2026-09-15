import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const slugPattern = /^[a-z0-9-]{4,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const requestsByIp = new Map();
const json = (body, status = 200) => NextResponse.json(body, { status });
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
}
function isRateLimited(request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const recent = (requestsByIp.get(ip) || []).filter((time) => now - time < 60_000);
  recent.push(now); requestsByIp.set(ip, recent);
  return recent.length > 8;
}
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString("hex")}`;
}
function passwordMatches(password, stored) {
  const [algorithm, salt, expected] = (stored || "").split("$");
  if (algorithm !== "scrypt" || !salt || !/^[0-9a-f]{64}$/.test(expected || "")) return false;
  return timingSafeEqual(scryptSync(password, salt, 32), Buffer.from(expected, "hex"));
}
async function getEvent(supabase, slug) {
  const { data, error } = await supabase.from("events").select("id,starts_at,ends_at,settings").eq("slug", slug).eq("status", "published").maybeSingle();
  if (error) return { error: "초대장을 확인하지 못했어요.", status: 500 };
  if (!data) return { error: "공개된 초대장을 찾지 못했어요.", status: 404 };
  if (data.settings?.guestbookEnabled === false) return { error: "현재 방명록이 비활성화되어 있어요.", status: 403 };
  const fallbackEnd = data.starts_at ? new Date(data.starts_at).getTime() + 14 * 24 * 60 * 60 * 1000 : NaN;
  const activeUntil = data.ends_at ? new Date(data.ends_at).getTime() : fallbackEnd;
  if (!Number.isFinite(activeUntil) || activeUntil <= Date.now()) return { error: "초대장 이용기간이 종료되어 방명록을 이용할 수 없어요.", status: 410 };
  return { event: data };
}
function validate(body) {
  const authorName = typeof body?.authorName === "string" ? body.authorName.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!authorName || authorName.length > 20) return { error: "이름을 20자 이내로 입력해 주세요." };
  if (!message || message.length > 200) return { error: "메시지를 200자 이내로 입력해 주세요." };
  if (!/^\d{4}$/.test(password)) return { error: "삭제 비밀번호는 숫자 4자리로 입력해 주세요." };
  return { authorName, message, password };
}

export async function GET(request) {
  const slug = new URL(request.url).searchParams.get("slug")?.trim() || "";
  if (!slugPattern.test(slug)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  const supabase = getClient();
  if (!supabase) return json({ error: "방명록 서비스를 준비하지 못했어요." }, 503);
  const context = await getEvent(supabase, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const { data, error } = await supabase.from("guestbook_entries").select("id,author_name,message,created_at").eq("event_id", context.event.id).eq("is_approved", true).order("created_at", { ascending: false }).limit(100);
  if (error) return json({ error: "방명록을 불러오지 못했어요." }, 500);
  return json({ entries: (data || []).map((entry) => ({ id: entry.id, authorName: entry.author_name, message: entry.message, createdAt: entry.created_at })) });
}

export async function POST(request) {
  if (isRateLimited(request)) return json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  if (!slugPattern.test(slug)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);
  const fields = validate(body);
  if (fields.error) return json({ error: fields.error }, 400);
  const supabase = getClient();
  if (!supabase) return json({ error: "방명록 서비스를 준비하지 못했어요." }, 503);
  const context = await getEvent(supabase, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const { data, error } = await supabase.from("guestbook_entries").insert({ event_id: context.event.id, author_name: fields.authorName, message: fields.message, password_hash: hashPassword(fields.password) }).select("id,author_name,message,created_at").single();
  if (error) { console.error("Guestbook insert failed:", error.code, error.message); return json({ error: "방명록을 남기지 못했어요." }, 500); }
  return json({ entry: { id: data.id, authorName: data.author_name, message: data.message, createdAt: data.created_at } }, 201);
}

export async function DELETE(request) {
  if (isRateLimited(request)) return json({ error: "요청이 너무 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  const body = await request.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug.trim() : "";
  const entryId = typeof body?.entryId === "string" ? body.entryId : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!slugPattern.test(slug) || !uuidPattern.test(entryId) || !/^\d{4}$/.test(password)) return json({ error: "삭제 정보를 확인해 주세요." }, 400);
  const supabase = getClient();
  if (!supabase) return json({ error: "방명록 서비스를 준비하지 못했어요." }, 503);
  const context = await getEvent(supabase, slug);
  if (context.error) return json({ error: context.error }, context.status);
  const { data: entry, error } = await supabase.from("guestbook_entries").select("id,password_hash").eq("id", entryId).eq("event_id", context.event.id).maybeSingle();
  if (error) return json({ error: "방명록을 확인하지 못했어요." }, 500);
  if (!entry) return json({ error: "방명록을 찾지 못했어요." }, 404);
  if (!passwordMatches(password, entry.password_hash)) return json({ error: "삭제 비밀번호가 올바르지 않아요." }, 403);
  const { error: deleteError } = await supabase.from("guestbook_entries").delete().eq("id", entry.id).eq("event_id", context.event.id);
  if (deleteError) return json({ error: "방명록을 삭제하지 못했어요." }, 500);
  return json({ deleted: true });
}