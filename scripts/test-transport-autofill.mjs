// Offline tests: no real API keys, network requests, Event or DB writes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
const root = new URL("../", import.meta.url);
const source = file => fs.readFile(new URL(file, root), "utf8");
const moduleUrl = code => "data:text/javascript;base64," + Buffer.from(code).toString("base64");
const model = await import(moduleUrl(await source("lib/transport-autofill.js")));
const tago = await import(moduleUrl(await source("lib/tago-transport.js")));
const stationData = JSON.parse(await source("lib/data/subway-stations.json"));
const subwayUrl = moduleUrl((await source("lib/tago-subway.js")).replace('import stationData from "./data/subway-stations.json";', 'const stationData = ' + JSON.stringify(stationData) + ';'));
const subway = await import(subwayUrl);
const page = await source("app/create/page.js");
const payload = item => ({ response: { header: { resultCode: "00" }, body: { items: { item } } } });
const response = item => new Response(JSON.stringify(payload(item)));
const stop = { nodeid: "DJB123", nodenm: "시청", citycode: 25, gpslati: 36.35, gpslong: 127.38 };

test("coordinates and server key validation prevent invalid upstream requests", async () => {
  for (const pair of [[NaN, 127], [0, 0], [37, 0], ["37", 127]]) assert.equal(tago.validTransportCoordinates(...pair), false);
  assert.equal(tago.validTransportCoordinates(36.35, 127.38), true);
  assert.equal((await tago.lookupTagoTransport(36.35, 127.38)).status, "unconfigured");
});
test("official stop/route parameters, singleton lists, route deduplication and distance filter", async () => {
  const calls = [];
  const result = await tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "secret%2Bkey", fetcher: async url => {
    calls.push(new URL(url));
    return url.pathname.endsWith("getCrdntPrxmtSttnList") ? response([stop, stop, { ...stop, nodeid: "far", gpslati: 38 }, { nodenm: "invalid" }]) : response([{ routeno: "100" }, { routeno: "100" }, { routeno: "2" }]);
  } });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].searchParams.get("serviceKey"), "secret+key");
  assert.equal(calls[0].searchParams.get("gpsLati"), "36.35");
  assert.equal(calls[1].searchParams.get("cityCode"), "25");
  assert.equal(calls[1].searchParams.get("nodeid"), "DJB123");
  assert.equal(result.status, "ok"); assert.match(result.transportPublic, /2, 100번/);
  const single = await tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "key", fetcher: async url => url.pathname.endsWith("getCrdntPrxmtSttnList") ? response(stop) : response({ routeno: 7 }) });
  assert.match(single.transportPublic, /7번/);
});
test("same-name stop with subset routes is shown once; distinct route sets remain", async () => {
  const second = { ...stop, nodeid: "DJB124", gpslong: 127.3801 };
  const run = async (firstRoutes, secondRoutes) => tago.lookupTagoTransport(36.35, 127.38, {
    serviceKey: "key", fetcher: async url => url.pathname.endsWith("getCrdntPrxmtSttnList")
      ? response([stop, second])
      : response((url.searchParams.get("nodeid") === stop.nodeid ? firstRoutes : secondRoutes).map(routeno => ({ routeno })))
  });
  const duplicate = await run(["232-1", "413", "509"], ["509"]);
  assert.equal(duplicate.transportPublic, "버스:\\n시청 · 232-1, 413, 509번");
  const distinct = await run(["232-1", "413"], ["509"]);
  assert.equal(distinct.transportPublic.split("\\n").length, 3);
});

test("missing routes and upstream failures never fabricate transit directions", async () => {
  const empty = await tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "key", fetcher: async () => response("") });
  assert.deepEqual(empty, { transportPublic: "", status: "empty" });
  const partial = await tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "key", fetcher: async url => url.pathname.endsWith("getCrdntPrxmtSttnList") ? response(stop) : new Response("failure", { status: 503 }) });
  assert.equal(partial.status, "partial"); assert.equal(partial.transportPublic, "");
  assert.doesNotMatch(partial.transportPublic, /출구|도보|지하철/);
  await assert.rejects(tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "key", fetcher: async () => new Response("<xml>error</xml>") }));
});
test("upstream timeout is bounded", async () => {
  await assert.rejects(tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "key", timeoutMs: 10,
    fetcher: (url, { signal }) => new Promise((resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true })) }));
});
test("manual edits and edit-then-erase remain protected", () => {
  const base = { transportPublic: "", transportCar: "" }, v = { transportPublic: 0, transportCar: 0 };
  assert.deepEqual(model.transportSuggestionPatch({ ...base, transportPublic: "manual" }, base, v, v, { transportPublic: "auto" }), {});
  assert.deepEqual(model.transportSuggestionPatch(base, base, { ...v, transportPublic: 2 }, v, { transportPublic: "auto" }), {});
  assert.deepEqual(model.transportSuggestionPatch(base, base, v, v, { transportCar: "car", transportParking: "must not write" }), { transportCar: "car" });
});
test("provenance survives save/reopen; new place clears only automatic text", () => {
  const place = { venue: "장소 A", address: "주소 A", eventKind: "wedding" };
  const initial = { ...place, venueAddress: place.address, transportPublic: "", transportCar: "", transportPublicEnabled: false, transportCarEnabled: false, transportParking: "manual parking" };
  const generated = model.applyAutomaticTransport(initial, { transportPublic: "auto bus", transportCar: "auto car" }, place);
  const reopened = JSON.parse(JSON.stringify(generated));
  const manual = model.editTransportField(reopened, "transportPublic", "manual bus");
  const cleared = model.clearAutomaticTransport(manual, model.getAutomaticTransport(manual));
  assert.equal(cleared.transportPublic, "manual bus"); assert.equal(cleared.transportCar, "");
  assert.equal(cleared.transportParking, "manual parking"); assert.equal(cleared.transportCarEnabled, false);
  assert.equal(cleared.transportAutoSource, undefined);
  const legacy = { transportPublic: "legacy manual" };
  assert.equal(model.clearAutomaticTransport(legacy, model.getAutomaticTransport(legacy)), legacy);
});

function editorHarness(restored = {}, { deferSubway = false } = {}) {
  let current = { eventKind: "wedding", venue: "", venueAddress: "", transportPublic: "", transportCar: "", transportPublicEnabled: false, transportCarEnabled: false, transportParkingEnabled: false, ...restored };
  const pending = [], subwayPending = [], notices = [];
  const context = { invitation: current, transportRequest: { current: null }, transportAutomatic: { current: {} }, transportRevisions: { current: { transportPublic: 0, transportCar: 0 } }, transportPlace: { current: null }, transportAllowed: { current: true }, transportLatest: { current },
    setInvitation(update) { current = typeof update === "function" ? update(current) : update; context.transportLatest.current = current; },
    setTransportNotice(value) { notices.push(value); }, setVenueBuildingAuto() {}, setPlaceResults() {}, focusMap() {}, window: {},
    fetch(url) {
      if (String(url).includes("mode=subway")) return deferSubway ? new Promise((resolve, reject) => subwayPending.push({ resolve, reject })) : Promise.resolve(new Response(JSON.stringify({ status: "empty", transportPublic: "" })));
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    }, ...model };
  const start = page.indexOf("  const selectPlace = (place) => {");
  const end = page.indexOf("  // Recover completed-template thumbnails", start);
  const make = () => new Function(...Object.keys(context), page.slice(start, end) + "; return selectPlace;")(...Object.values({ ...context, invitation: current }));
  return { select(place) { make()(place); }, get current() { return current; }, context, pending, subwayPending, notices };
}
const placeA = { title: "장소 A", roadAddress: "주소 A", mapx: 1273800000, mapy: 363500000 };
const placeB = { ...placeA, title: "장소 B", roadAddress: "주소 B" };
const tick = () => new Promise(resolve => setTimeout(resolve, 0));
test("actual editor handler: rapid A to B ignores late A and keeps checkboxes off", async () => {
  const editor = editorHarness(); editor.select(placeA); editor.select(placeB);
  editor.pending[1].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "B bus" }))); await tick();
  editor.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "A bus" }))); await tick();
  assert.equal(editor.current.venue, "장소 B"); assert.equal(editor.current.transportPublic, "B bus");
  assert.match(editor.current.transportCar, /장소 B/);
  assert.equal(editor.current.transportPublicEnabled, false); assert.equal(editor.current.transportCarEnabled, false);
});
test("actual editor handler: manual typing during lookup wins, errors keep venue/car", async () => {
  const editor = editorHarness(); editor.select(placeA);
  editor.context.transportRevisions.current.transportPublic++;
  editor.context.setInvitation(current => model.editTransportField(current, "transportPublic", "my directions"));
  editor.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "auto" }))); await tick();
  assert.equal(editor.current.transportPublic, "my directions");
  editor.select(placeB); editor.pending[1].reject(new Error("network")); await tick();
  assert.equal(editor.current.venueAddress, "주소 B"); assert.match(editor.current.transportCar, /장소 B/);
  assert.equal(editor.current.transportPublic, "");
});
test("actual editor handler: disabled event matrix makes no API request", () => {
  const editor = editorHarness(); editor.context.transportAllowed.current = false; editor.select(placeA);
  assert.equal(editor.pending.length, 0); assert.equal(editor.current.transportCar, "");
});
test("API validates, caches and limits queries without exposing service keys", async () => {
  const fakeUrl = moduleUrl(`export const validTransportCoordinates = ${tago.validTransportCoordinates.toString()}; export let calls = 0; export async function lookupTagoTransport() { calls++; return { status: "ok", transportPublic: "mock" }; }`);
  const code = (await source("app/api/transport/route.js")).replace('"../../../lib/tago-transport"', JSON.stringify(fakeUrl)).replaceAll("process.env.TAGO_SERVICE_KEY", '"mock-secret"').replace('"../../../lib/tago-subway"', JSON.stringify(subwayUrl));
  const api = await import(moduleUrl(code));
  const request = url => new Request("http://local/api/transport" + url, { headers: { "x-forwarded-for": "test" } });
  assert.equal((await api.GET(request("?lat=bad&lng=127"))).status, 400);
  for (let i = 0; i < 20; i++) assert.equal((await api.GET(request("?lat=36.35&lng=127.38"))).status, 200);
  assert.equal((await import(fakeUrl)).calls, 1);
  const limited = await api.GET(request("?lat=36.35&lng=127.38")); assert.equal(limited.status, 429);
  assert.doesNotMatch(await limited.text(), /mock-secret/);
});

test("repro: edited transport saved and reopened is replaced when selecting a different venue", async () => {
  const original = editorHarness(); original.select(placeA);
  original.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "A bus" }))); await tick();
  let edited = model.editTransportField(original.current, "transportPublic", "A bus with my changes");
  edited = model.editTransportField(edited, "transportCar", "A car with my changes");
  edited = { ...edited, transportPublicEnabled: true, transportCarEnabled: true, transportParkingEnabled: true, transportParking: "keep this parking", transportGuideEnabled: true };
  assert.deepEqual(edited.transportAutoSource.values, {});
  const editor = editorHarness(JSON.parse(JSON.stringify(edited)));
  // The search text changes before the user selects a search result.
  editor.context.setInvitation(current => ({ ...current, venue: "검색어 B" }));
  editor.select(placeB);
  assert.equal(editor.current.transportPublic, "");
  assert.match(editor.current.transportCar, /장소 B/);
  assert.doesNotMatch(editor.current.transportCar, /my changes/);
  for (const key of ["transportPublicEnabled", "transportCarEnabled", "transportParkingEnabled", "transportGuideEnabled"]) assert.equal(editor.current[key], true);
  assert.equal(editor.current.transportParking, "keep this parking");
  editor.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "B bus" }))); await tick();
  assert.equal(editor.current.transportPublic, "B bus");
  const reopened = JSON.parse(JSON.stringify(editor.current));
  assert.equal(reopened.transportPublic, "B bus"); assert.equal(reopened.transportAutoSource.venue, "장소 B");
});
test("new venue bus failure leaves no previous manual bus text", async () => {
  const editor = editorHarness({ venue: "장소 A", venueAddress: "주소 A", transportPublic: "legacy A bus", transportCar: "legacy A car", transportParking: "parking" });
  editor.select(placeB);
  assert.equal(editor.current.transportPublic, "");
  editor.pending[0].resolve(new Response(JSON.stringify({ error: "TAGO unavailable" }), { status: 502 })); await tick();
  assert.equal(editor.current.transportPublic, ""); assert.match(editor.current.transportCar, /장소 B/);
  assert.equal(editor.current.transportParking, "parking");
});
test("selecting the same venue preserves manual text after reopening", async () => {
  const editor = editorHarness({ venue: "장소 A", venueAddress: "주소 A", transportPublic: "manual A bus", transportCar: "manual A car", transportAutoSource: { venue: "장소 A", address: "주소 A", eventKind: "wedding", values: {} } });
  editor.select(placeA);
  editor.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "auto A bus" }))); await tick();
  assert.equal(editor.current.transportPublic, "manual A bus"); assert.equal(editor.current.transportCar, "manual A car");
  assert.equal(JSON.parse(JSON.stringify(editor.current)).transportAutoSource.venue, "장소 A");
});
test("different venue at the same address is recognized using the saved selection", () => {
  const oldPlace = { venue: "A홀", address: "공통주소", eventKind: "wedding" };
  const current = { venue: "새 검색어", venueAddress: "공통주소", transportPublic: "old bus", transportCar: "old car", transportParking: "keep" };
  const result = model.prepareTransportPlaceSelection(current, { ...oldPlace, venue: "B홀" }, oldPlace);
  assert.equal(result.transportPublic, ""); assert.equal(result.transportCar, ""); assert.equal(result.transportParking, "keep");
});

const caladium = { lat: 35.8710769, lng: 128.7322567, venue: "칼라디움 웨딩홀" };
const ansimApi = { subwayStationId: "MTRDG10146", subwayStationName: "안심(혁신도시.첨복단지)", subwayRouteName: "1호선" };
test("official coordinate snapshot locates Ansim and a different-region station", () => {
  assert.match(stationData.source, /^https:\/\/data.kric.go.kr/);
  assert.ok(stationData.stations.length > 1000);
  const station = subway.nearbySubwayStation(caladium.lat, caladium.lng);
  assert.equal(subway.stationName(station.name), "안심"); assert.equal(station.route, "대구 도시철도 1호선");
  const gangnam = stationData.stations.find(item => subway.stationName(item.name) === "강남");
  assert.equal(subway.stationName(subway.nearbySubwayStation(gangnam.latitude, gangnam.longitude).name), "강남");
  assert.equal(subway.nearbySubwayStation(33.4, 126.5), null);
});
test("Caladium facility match confirms Ansim line 1 exit 2 using real response shapes", async () => {
  const calls = [];
  const result = await subway.lookupSubwayTransport(caladium.lat, caladium.lng, caladium.venue, { serviceKey: "key", fetcher: async url => {
    calls.push(new URL(url));
    return url.pathname.endsWith("GetKwrdFndSubwaySttnList") ? response(ansimApi) : response([{ exitNo: "1", dirDesc: "다른 시설" }, { exitNo: "2", dirDesc: "칼라디움웨딩홀" }]);
  } });
  assert.match(result.transportPublic, /대구 1호선 안심역 2번 출구/);
  assert.equal(calls[1].searchParams.get("subwayStationId"), "MTRDG10146");
  assert.equal(calls[0].searchParams.get("subwayStationName"), "안심");
});
test("ambiguous cities/lines and uncertain venue facilities never produce a guessed exit", async () => {
  const duplicate = [{ name: "시청", route: "1호선", latitude: 37.56, longitude: 126.97 }, { name: "시청", route: "1호선", latitude: 35.17, longitude: 129.07 }];
  let calls = 0;
  const result = await subway.lookupSubwayTransport(35.17, 129.07, "행사장", { serviceKey: "key", stations: duplicate, fetcher: async () => { calls++; throw Error("must not resolve another city's exits"); } });
  assert.equal(calls, 0); assert.equal(subway.nearbySubwayStation(35.17, 129.07, duplicate).latitude, 35.17);
  assert.doesNotMatch(result.transportPublic, /번 출구/);
  for (const facilities of [[{ exitNo: "2", dirDesc: "칼라디움 다른 지점" }], [{ exitNo: "1", dirDesc: "칼라디움웨딩홀" }, { exitNo: "2", dirDesc: "칼라디움웨딩홀" }]]) {
    const value = await subway.lookupSubwayTransport(caladium.lat, caladium.lng, caladium.venue, { serviceKey: "key", fetcher: async url => url.pathname.endsWith("GetKwrdFndSubwaySttnList") ? response(ansimApi) : response(facilities) });
    assert.doesNotMatch(value.transportPublic, /번 출구/);
  }
});
test("far stations use no external request; subway API failures retain the verified coordinate candidate only", async () => {
  let calls = 0;
  const far = await subway.lookupSubwayTransport(33.4, 126.5, "제주 행사장", { serviceKey: "key", fetcher: async () => { calls++; } });
  assert.equal(calls, 0); assert.equal(far.transportPublic, "");
  const failed = await subway.lookupSubwayTransport(caladium.lat, caladium.lng, caladium.venue, { serviceKey: "key", fetcher: async () => new Response("denied", { status: 403 }) });
  assert.equal(failed.status, "partial"); assert.match(failed.transportPublic, /안심역/); assert.doesNotMatch(failed.transportPublic, /번 출구/);
});
test("slow/failed subway request does not delay or remove bus text", async () => {
  const editor = editorHarness({}, { deferSubway: true }); editor.select(placeA);
  editor.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "bus ready now" }))); await tick();
  assert.equal(editor.current.transportPublic, "bus ready now");
  editor.subwayPending[0].reject(new Error("subway failed")); await tick();
  assert.equal(editor.current.transportPublic, "bus ready now");
});
test("bus failure still accepts subway; merged text survives save and respects checkboxes", async () => {
  const editor = editorHarness({}, { deferSubway: true }); editor.select(placeA);
  editor.pending[0].resolve(new Response(JSON.stringify({ error: "bus failed" }), { status: 502 })); await tick();
  editor.subwayPending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "subway ready" }))); await tick();
  assert.equal(editor.current.transportPublic, "subway ready"); assert.equal(editor.current.transportPublicEnabled, false);
  const restored = JSON.parse(JSON.stringify(editor.current));
  assert.equal(model.getAutomaticTransport(restored).transportPublic, "subway ready");
});
test("late subway after manual edit is ignored; new place excludes old subway", async () => {
  const editor = editorHarness({}, { deferSubway: true }); editor.select(placeA);
  editor.pending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "A bus" }))); await tick();
  editor.context.transportRevisions.current.transportPublic++;
  editor.context.setInvitation(current => model.editTransportField(current, "transportPublic", "manual directions"));
  editor.subwayPending[0].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "A subway" }))); await tick();
  assert.equal(editor.current.transportPublic, "manual directions");
  editor.select(placeB); assert.equal(editor.current.transportPublic, "");
  editor.pending[1].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "B bus" })));
  editor.subwayPending[1].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: "B subway" }))); await tick();
  assert.equal(editor.current.transportPublic, "B subway\n\nB bus");
});
test("rapid selection ignores both old bus and old subway responses", async () => {
  const editor = editorHarness({}, { deferSubway: true }); editor.select(placeA); editor.select(placeB);
  for (const index of [1, 0]) {
    editor.pending[index].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: index ? "B bus" : "A bus" })));
    editor.subwayPending[index].resolve(new Response(JSON.stringify({ status: "ok", transportPublic: index ? "B subway" : "A subway" })));
    await tick();
  }
  assert.equal(editor.current.transportPublic, "B subway\n\nB bus");
});

test("generated bus copy is compact with a single route suffix and no radius/bullets", async () => {
  const second = { ...stop, nodeid: "DJB124", nodenm: "송정삼거리3", gpslati: 36.351 };
  const result = await tago.lookupTagoTransport(36.35, 127.38, { serviceKey: "key", fetcher: async url => {
    if (url.pathname.endsWith("getCrdntPrxmtSttnList")) return response([{ ...stop, nodenm: "송정삼거리4" }, second]);
    return response(url.searchParams.get("nodeid") === "DJB123" ? [{ routeno: "55번" }, { routeno: "555" }] : [{ routeno: "802" }, { routeno: "814" }, { routeno: "동구4" }]);
  } });
  assert.equal(result.transportPublic, "버스:\n송정삼거리4 · 55, 555번\n송정삼거리3 · 802, 814, 동구4번");
  assert.doesNotMatch(result.transportPublic, /반경|정류장|•|번번/);
});
test("generated car copy uses only venue and address", () => {
  assert.equal(model.carDirections("칼라디움 웨딩홀", "대구광역시 동구 반야월로 400"), "내비게이션에서 '칼라디움 웨딩홀' 검색\n대구광역시 동구 반야월로 400");
  assert.equal(model.carDirections("", "주소"), "");
});
test("subway only, bus only, both and neither merge without empty headings", () => {
  const place = { venue: "행사장", address: "주소", eventKind: "wedding" };
  const initial = { transportPublic: "", transportPublicEnabled: false };
  const revisions = { transportPublic: 0 };
  const subwayText = "지하철:\n대구 1호선 안심역 2번 출구", busText = "버스:\n송정삼거리4 · 55, 555번";
  for (const [sections, expected] of [[{ subway: subwayText, bus: "" }, subwayText], [{ subway: "", bus: busText }, busText], [{ subway: subwayText, bus: busText }, subwayText + "\n\n" + busText], [{ subway: "", bus: "" }, ""]]) {
    const result = model.mergeTransportPublic(initial, initial, revisions, revisions, sections, place);
    assert.equal(result.transportPublic, expected); assert.equal(result.transportPublicEnabled, false);
  }
  const manual = { ...initial, transportPublic: "🚇 내가 직접 쓴 안내\n주변 버스정류장 (반경 500m)" };
  assert.equal(model.mergeTransportPublic(manual, manual, revisions, revisions, { subway: subwayText, bus: busText }, place), manual);
  assert.deepEqual(JSON.parse(JSON.stringify(manual)), manual);
});
test("actual common TransportGuide preserves manual copy and checkbox display rules", async () => {
  const { createRequire } = await import("node:module"); const require = createRequire(import.meta.url);
  const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
  const babel = require("next/dist/compiled/babel/core");
  const code = babel.transformSync(await source("components/invitation/transport-guide.js"), { configFile: false, babelrc: false,
    presets: [[require("next/dist/compiled/babel/preset-react"), { runtime: "classic" }]], plugins: [require("next/dist/compiled/babel/plugin-transform-modules-commonjs")] }).code;
  const exports = {}; new Function("React", "exports", code)(React, exports);
  const invitation = { transportGuideEnabled: true, transportPublicEnabled: true, transportPublic: "내가 쓴 문구 그대로\n둘째 줄", transportCarEnabled: false, transportCar: "숨긴 자가용", transportParkingEnabled: true, transportParking: "주차 수동 문구" };
  const html = renderToStaticMarkup(React.createElement(exports.default, { invitation }));
  assert.ok(html.includes(invitation.transportPublic)); assert.ok(html.includes("주차 수동 문구")); assert.ok(html.includes("대중교통"));
  assert.ok(!html.includes("숨긴 자가용"));
  assert.equal(renderToStaticMarkup(React.createElement(exports.default, { invitation: { ...invitation, transportGuideEnabled: false } })), "");
});
test("transport-only styles retain inherited fonts/theme and allow long mobile lines to wrap", async () => {
  const css = await source("app/globals.css");
  assert.ok(css.includes(".dd-transport-guide-item{min-width:0;text-align:left}"));
  assert.ok(css.includes(".dd-transport-guide-list{display:grid;gap:14px;text-align:left}"));
  assert.ok(css.includes("line-height:var(--dd-body-line-height,1.6);overflow-wrap:anywhere"));
  assert.ok(css.includes("white-space:pre-wrap"));
  const heading = css.match(/\.dd-transport-guide-item h4\{([^}]+)\}/)[1];
  assert.ok(heading.includes("margin:0 0 6px")); assert.ok(heading.includes("font:inherit")); assert.ok(!heading.includes("font-size:"));
});
