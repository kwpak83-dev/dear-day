import ExcelJS from "exceljs";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getInvitationTitle } from "../../../../lib/invitation-title";

export const runtime = "nodejs";
const slugPattern = /^[a-z0-9-]{4,80}$/;
const json = (body, status = 200) => NextResponse.json(body, { status });
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "";
const safeFilename = (value) => (value || "초대장").replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, "_").replace(/^_+|_+$/g, "").slice(0, 60) || "초대장";

export async function GET(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return json({ error: "Excel 다운로드 서비스를 준비하지 못했어요." }, 503);
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "로그인 정보를 찾지 못했어요." }, 401);
  const slug = new URL(request.url).searchParams.get("slug")?.trim() || "";
  if (!slugPattern.test(slug)) return json({ error: "초대장 정보가 올바르지 않아요." }, 400);

  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return json({ error: "로그인이 만료되었어요. 다시 로그인해 주세요." }, 401);
  const { data: event, error: eventError } = await supabase.from("events").select("id,title,kind,settings").eq("slug", slug).eq("owner_id", user.id).eq("status", "published").maybeSingle();
  if (eventError) return json({ error: "초대장을 확인하지 못했어요." }, 500);
  if (!event) return json({ error: "다운로드할 수 있는 초대장을 찾지 못했어요." }, 404);
  const { data: rows, error: rsvpError } = await supabase.from("rsvps").select("guest_name,status,party_size,phone,message,created_at,updated_at").eq("event_id", event.id).order("updated_at", { ascending: false }).order("created_at", { ascending: false });
  if (rsvpError) return json({ error: "참석 여부 목록을 불러오지 못했어요." }, 500);
  if (!rows?.length) return json({ error: "다운로드할 참석 여부가 없습니다." }, 404);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "DearDay";
  workbook.created = new Date();
  const sheet = workbook.addWorksheet("RSVP 명단", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "이름", key: "name", width: 18 }, { header: "참석 여부", key: "status", width: 12 },
    { header: "참석 인원", key: "partySize", width: 12 }, { header: "연락처", key: "phone", width: 20 },
    { header: "전달사항", key: "message", width: 42 }, { header: "제출 시각", key: "createdAt", width: 22 },
    { header: "최근 수정 시각", key: "updatedAt", width: 22 },
  ];
  rows.forEach((row) => sheet.addRow({ name: row.guest_name, status: row.status === "attending" ? "참석" : "불참", partySize: row.status === "attending" ? row.party_size : "", phone: row.phone || "", message: row.message || "", createdAt: formatDateTime(row.created_at), updatedAt: formatDateTime(row.updated_at || row.created_at) }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEF786C" } };
  sheet.getRow(1).alignment = { vertical: "middle", horizontal: "center" };
  sheet.getColumn("phone").numFmt = "@";
  sheet.eachRow((row, index) => { row.alignment = { vertical: "top", wrapText: true, ...(index === 1 ? { horizontal: "center" } : {}) }; });
  const buffer = await workbook.xlsx.writeBuffer();
  const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" }).replaceAll("-", "");
  const title = getInvitationTitle(event.settings || {}, event.kind) || event.title;
  const filename = `DearDay_${safeFilename(title)}_RSVP_${date}.xlsx`;
  return new NextResponse(buffer, { status: 200, headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="DearDay_RSVP_${date}.xlsx"; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store" } });
}