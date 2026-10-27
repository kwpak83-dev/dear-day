import stationData from "./data/subway-stations.json";

const normalize = value => String(value || "").replace(/<[^>]*>/g, "").replace(/[^가-힣a-zA-Z0-9]/g, "").toLowerCase();
export const stationName = value => String(value || "").split(/[（(]/)[0].trim().replace(/역$/, "");
const lineKey = value => normalize(String(value || "").match(/\d+호선/)?.[0] || value);
const nameKey = value => normalize(stationName(value));
function meters(lat, lng, station) {
  const rad = n => n * Math.PI / 180;
  const a = Math.sin(rad(station.latitude - lat) / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(station.latitude)) * Math.sin(rad(station.longitude - lng) / 2) ** 2;
  return 12742000 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
export function nearbySubwayStation(lat, lng, stations = stationData.stations) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return stations.map(station => ({ ...station, distance: meters(lat, lng, station) }))
    .filter(station => Number.isFinite(station.distance) && station.distance <= 1500)
    .sort((a, b) => a.distance - b.distance)[0] || null;
}
const cache = new Map();
export async function lookupSubwayTransport(lat, lng, venue, { serviceKey, fetcher = fetch, timeoutMs = 2000, stations = stationData.stations } = {}) {
  const station = nearbySubwayStation(lat, lng, stations);
  if (!station) return { transportPublic: "", status: "empty" };
  const routeLabel = station.route.replace(/(?:경량도시철도|도시철도|광역철도|지하철)\s*(?=\d+호선)/g, "").replace(/([가-힣])(?=\d+호선)/g, "$1 ").replace(/\s+/g, " ").trim();
  const label = routeLabel + " " + stationName(station.name) + "역";
  let exit = "", partial = false;
  const query = async (operation, params) => {
    const cacheKey = operation + JSON.stringify(params);
    const saved = cache.get(cacheKey);
    if (fetcher === fetch && saved && Date.now() - saved.at < 86400000) return saved.items;
    let key = serviceKey; try { key = decodeURIComponent(key); } catch { /* decoding key */ }
    const url = new URL(operation, "https://apis.data.go.kr/1613000/SubwayInfo/");
    url.search = new URLSearchParams({ serviceKey: key, _type: "json", numOfRows: "100", pageNo: "1", ...params });
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetcher(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error("SUBWAY_HTTP");
      const raw = await response.text(); if (raw.length > 256000) throw new Error("SUBWAY_SIZE");
      const body = JSON.parse(raw)?.response;
      if (String(body?.header?.resultCode) !== "00") throw new Error("SUBWAY_RESPONSE");
      // Truncated station/facility lists cannot establish an unambiguous match.
      if (Number(body.body?.totalCount) > 100) throw new Error("SUBWAY_TRUNCATED");
      const item = body.body?.items?.item;
      const items = Array.isArray(item) ? item.slice(0, 100) : item && typeof item === "object" ? [item] : [];
      if (fetcher === fetch) { if (cache.size >= 200) cache.delete(cache.keys().next().value); cache.set(cacheKey, { at: Date.now(), items }); }
      return items;
    } finally { clearTimeout(timer); }
  };
  // Generic line labels (e.g. 1호선) do not identify a city. If this name/line
  // exists in multiple locations, show only the geographically selected official
  // station; never attach exits from an ambiguous TAGO station ID.
  const same = stations.filter(item => nameKey(item.name) === nameKey(station.name) && lineKey(item.route) === lineKey(station.route));
  if (serviceKey && same.length === 1) {
    try {
      const found = await query("GetKwrdFndSubwaySttnList", { subwayStationName: stationName(station.name) });
      const matches = found.filter(item => nameKey(item.subwayStationName) === nameKey(station.name) && lineKey(item.subwayRouteName) === lineKey(station.route) && /^[a-z0-9_-]{1,40}$/i.test(item.subwayStationId || ""));
      if (matches.length === 1 && normalize(venue).length >= 4) {
        const facilities = await query("GetSubwaySttnExitAcctoCfrFcltyList", { subwayStationId: matches[0].subwayStationId });
        const exits = [...new Set(facilities.filter(item => normalize(item.dirDesc) === normalize(venue) && /^\d{1,3}$/.test(String(item.exitNo)) && Number(item.exitNo) > 0).map(item => String(Number(item.exitNo))))];
        if (exits.length === 1) exit = " " + exits[0] + "번 출구";
      }
    } catch { partial = true; }
  }
  return { transportPublic: "지하철:\n" + label + exit, status: partial ? "partial" : "ok" };
}
