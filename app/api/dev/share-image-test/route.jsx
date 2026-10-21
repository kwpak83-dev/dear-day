import { chromium } from "playwright-core";
import { captureShareImage } from "../../../../lib/share-image-capture";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const url = new URL(request.url);
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL ||
      !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    return new Response("Not found", { status: 404 });
  }
  const slug = url.searchParams.get("slug") || "";
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(slug)) return Response.json({ error: "유효한 초대장 slug를 입력해 주세요." }, { status: 400 });
  return captureShareImage(request, {
    slug,
    origin: `http://127.0.0.1:${url.port || "3000"}`,
    launchBrowser: () => chromium.launch({ channel: "chrome", headless: true, timeout: 20000 }),
  });
}
