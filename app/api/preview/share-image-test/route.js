import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import { captureShareImage } from "../../../../lib/share-image-capture";
import { launchServerlessBrowser } from "../../../../lib/share-image-browser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request) {
  // Disabled locally and in production regardless of tokens or request headers.
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "preview" ||
      process.env.SHARE_IMAGE_TEST_ENABLED !== "true") {
    return new Response("Not found", { status: 404 });
  }
  const token = process.env.SHARE_IMAGE_TEST_TOKEN || "";
  const allowedSlugs = (process.env.SHARE_IMAGE_TEST_SLUGS || "").split(",").map(value => value.trim()).filter(Boolean);
  const deploymentHost = process.env.VERCEL_URL || "";
  if (token.length < 32 || !allowedSlugs.length ||
      !/^[a-zA-Z0-9-]+\.vercel\.app$/.test(deploymentHost)) {
    return Response.json({ error: "TEST_CONFIGURATION_MISSING" }, { status: 503 });
  }
  const supplied = request.headers.get("authorization") || "";
  const expected = `Bearer ${token}`;
  if (Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
      !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  // Only a slug from an explicit server-side test allowlist; never accept a URL.
  const slug = new URL(request.url).searchParams.get("slug") || "";
  if (!/^[a-zA-Z0-9_-]{1,160}$/.test(slug) || !allowedSlugs.includes(slug)) {
    return Response.json({ error: "TEST_SLUG_NOT_ALLOWED" }, { status: 403 });
  }
  // A stored image/CSS URL must not turn Chromium into an unrestricted proxy.
  // Additional public asset hosts require an explicit server-side opt-in.
  const allowedOrigins = new Set([`https://${deploymentHost}`]);
  const assetOrigins = [process.env.NEXT_PUBLIC_SUPABASE_URL,
    ...(process.env.SHARE_IMAGE_TEST_ASSET_ORIGINS || "").split(",")].filter(value => value?.trim());
  try {
    for (const value of assetOrigins) {
      const asset = new URL(value.trim());
      if (asset.protocol !== "https:" || asset.username || asset.password || asset.port ||
          asset.pathname !== "/" || asset.search || asset.hash ||
          isIP(asset.hostname) || asset.hostname.includes(":") ||
          /(^|\.)(localhost|local|internal)$/.test(asset.hostname)) throw new Error();
      allowedOrigins.add(asset.origin);
    }
  } catch {
    return Response.json({ error: "TEST_ASSET_ORIGIN_INVALID" }, { status: 503 });
  }
  const response = await captureShareImage(request, {
    slug,
    origin: `https://${deploymentHost}`,
    launchBrowser: launchServerlessBrowser,
    protectionBypass: process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
    allowedOrigins,
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
