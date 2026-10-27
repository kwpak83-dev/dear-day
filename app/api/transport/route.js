import { lookupTagoTransport, validTransportCoordinates } from "../../../lib/tago-transport";
import { lookupSubwayTransport } from "../../../lib/tago-subway";

export const dynamic = "force-dynamic";
const cache = new Map(), clients = new Map();
let windowStart = 0, total = 0, active = 0;
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  const mode = params.get("mode") || "bus";
  const venue = params.get("venue")?.trim() || "";
  if (!["bus", "subway"].includes(mode) || (mode === "subway" && (!venue || venue.length > 200))) return json({ error: "교통정보 조회 조건이 올바르지 않아요." }, 400);
  if (!params.get("lat") || !params.get("lng") || !validTransportCoordinates(lat, lng)) return json({ error: "장소 좌표가 올바르지 않아요." }, 400);
  if (!process.env.TAGO_SERVICE_KEY) return json({ transportPublic: "", status: "unconfigured" });
  const now = Date.now();
  // Bounded, per-process safeguards; no DB/IP persistence or secret logging.
  if (now - windowStart > 600000) { windowStart = now; total = 0; clients.clear(); }
  const ip = (request.headers.get("x-forwarded-for")?.split(",")[0] || "local").trim().slice(0, 64);
  const count = clients.get(ip) || 0;
  if (count >= 20 || total >= 200 || (!clients.has(ip) && clients.size >= 1000)) return json({ error: "잠시 후 교통정보를 다시 조회해 주세요." }, 429);
  clients.set(ip, count + 1); total++;
  const key = mode + ":" + lat.toFixed(5) + ":" + lng.toFixed(5) + (mode === "subway" ? ":" + venue : "");
  const saved = cache.get(key);
  if (saved && now - saved.at < 300000) return json(saved.value);
  if (active >= 8) return json({ error: "교통정보 조회가 많아요. 잠시 후 다시 시도해 주세요." }, 429);
  active++;
  try {
    const value = mode === "subway"
      ? await lookupSubwayTransport(lat, lng, venue, { serviceKey: process.env.TAGO_SERVICE_KEY })
      : await lookupTagoTransport(lat, lng, { serviceKey: process.env.TAGO_SERVICE_KEY });
    if (value.status !== "partial") {
      if (cache.size >= 200) cache.delete(cache.keys().next().value);
      cache.set(key, { at: now, value });
    }
    return json(value);
  } catch {
    // Upstream URLs contain the server key: never log or return raw errors.
    return json({ error: "교통정보를 불러오지 못했어요. 교통안내를 직접 입력할 수 있어요." }, 502);
  } finally { active--; }
}
