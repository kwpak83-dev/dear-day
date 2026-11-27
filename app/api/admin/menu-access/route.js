import { authenticateInquiry, inquiryJson as json } from "../../../../lib/inquiry-auth.js";

export async function GET(request) {
  const auth = await authenticateInquiry(request, { admin: true });
  if (auth.error) return json({ canManage: false });
  if (new URL(request.url).searchParams.get("inquiries") !== "1") return json({ canManage: true });
  const result = await auth.db.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "pending");
  return json({ canManage: true, pendingInquiries: result.error ? null : result.count });
}
