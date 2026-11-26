import sharp from "sharp";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-static";

export async function GET() {
  const logo = await readFile(path.join(process.cwd(), "public", "dearday-logo-black.png"));
  const resized = await sharp(logo).flatten({ background: "#ffffff" }).trim({ background: "#ffffff", threshold: 10 }).resize({ width: 840, height: 420, fit: "inside" }).png().toBuffer();
  const image = await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#ffffff" } })
    .composite([{ input: resized, gravity: "centre" }]).png().toBuffer();
  return new Response(new Uint8Array(image), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400" },
  });
}
