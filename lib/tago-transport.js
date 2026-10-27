// Server use only. Official BusSttnInfoInqireService: nearby stops (500m)
// and getSttnThrghRouteList. No guessed subway exits or walking directions.
const BASE = "https://apis.data.go.kr/1613000/BusSttnInfoInqireService/";
const text = (value, max = 80) => typeof value === "string" || typeof value === "number" ? String(value).replace(/[<>\r\n]/g, " ").trim().slice(0, max) : "";
export function validTransportCoordinates(lat, lng) {
  return typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && lat >= 32 && lat <= 39.5 && lng >= 124 && lng <= 132;
}
function items(payload) {
  const response = payload?.response;
  if (String(response?.header?.resultCode) !== "00") throw new Error("TAGO_RESPONSE");
  const item = response.body?.items?.item;
  if (!item) return [];
  if (Array.isArray(item)) return item.slice(0, 100);
  return typeof item === "object" ? [item] : [];
}
function distance(lat, lng, item) {
  const radians = n => n * Math.PI / 180;
  const dy = radians(Number(item.gpslati) - lat), dx = radians(Number(item.gpslong) - lng);
  const a = Math.sin(dy / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(Number(item.gpslati))) * Math.sin(dx / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export async function lookupTagoTransport(lat, lng, { serviceKey, fetcher = fetch, timeoutMs = 5000 } = {}) {
  if (!validTransportCoordinates(lat, lng)) throw new Error("INVALID_COORDINATES");
  if (!serviceKey) return { transportPublic: "", status: "unconfigured" };
  // Use the decoding key. Accept an encoded key too, without double encoding.
  try { serviceKey = decodeURIComponent(serviceKey); } catch { /* raw key */ }
  const query = async (operation, params) => {
    const url = new URL(operation, BASE);
    url.search = new URLSearchParams({ serviceKey, _type: "json", pageNo: "1", numOfRows: "100", ...params });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const result = await fetcher(url, { cache: "no-store", signal: controller.signal });
      if (!result.ok) throw new Error("TAGO_HTTP");
      if (Number(result.headers?.get("content-length")) > 256000) throw new Error("TAGO_SIZE");
      const raw = await result.text();
      if (raw.length > 256000) throw new Error("TAGO_SIZE");
      return items(JSON.parse(raw));
    } finally { clearTimeout(timer); }
  };
  const nearby = await query("getCrdntPrxmtSttnList", { gpsLati: String(lat), gpsLong: String(lng) });
  const seen = new Set();
  const stops = nearby.filter(item => item && /^[a-z0-9_-]{1,40}$/i.test(text(item.nodeid)) && /^\d{1,5}$/.test(text(item.citycode)) && text(item.nodenm) && validTransportCoordinates(Number(item.gpslati), Number(item.gpslong)))
    .map(item => ({ ...item, meters: distance(lat, lng, item) })).filter(item => item.meters <= 500)
    .sort((a, b) => a.meters - b.meters).filter(item => { const key = item.citycode + ":" + item.nodeid; if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, 2);
  let partial = false;
  const entries = await Promise.all(stops.map(async stop => {
    try {
      const routes = await query("getSttnThrghRouteList", { cityCode: text(stop.citycode), nodeid: text(stop.nodeid) });
      const names = [...new Set(routes.map(route => text(route.routeno, 30).replace(/번$/, "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ko", { numeric: true })).slice(0, 12);
      return names.length ? { stop: text(stop.nodenm).replace(/\s*정류장$/, ""), names } : null;
    } catch { partial = true; return null; }
  }));
  const confirmed = [];
  for (const entry of entries.filter(Boolean)) {
    const duplicate = confirmed.find(existing => existing.stop === entry.stop &&
      entry.names.every(name => existing.names.includes(name)));
    if (duplicate) continue;
    const superseded = confirmed.findIndex(existing => existing.stop === entry.stop &&
      existing.names.every(name => entry.names.includes(name)));
    if (superseded >= 0) confirmed.splice(superseded, 1);
    confirmed.push(entry);
  }
  // Only remove redundant route subsets for the same stop name. Different
  // route sets can represent distinct platforms/directions and stay separate.
  const lines = confirmed.map(({ stop, names }) => `${stop} · ${names.join(", ")}번`);
  return { transportPublic: lines.length ? "버스:\n" + lines.join("\n") : "", status: partial ? "partial" : lines.length ? "ok" : "empty" };
}
