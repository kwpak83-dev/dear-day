// Run manually when KRIC publishes an update: node scripts/update-subway-stations.mjs
// Official national urban/metropolitan rail dataset; no API key or runtime download.
import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
const source = "https://data.kric.go.kr/rips/M_01_01/detail.do?id=32";
const download = "https://data.kric.go.kr/rips/dataset/download.file?type=filedata&id=32&operation=1";
const response = await fetch(download, { signal: AbortSignal.timeout(15000) });
if (!response.ok) throw new Error("KRIC download failed");
const bytes = Buffer.from(await response.arrayBuffer());
if (bytes.length > 5000000) throw new Error("KRIC file too large");
const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(bytes);
const sheet = workbook.worksheets[0];
const headers = sheet.getRow(1).values;
const index = name => { const i = headers.indexOf(name); if (i < 1) throw new Error("KRIC column missing: " + name); return i; };
const columns = Object.fromEntries(["역사명", "노선명", "역위도", "역경도", "운영기관명", "데이터기준일자"].map(name => [name, index(name)]));
const stations = [], dates = new Set();
sheet.eachRow((row, number) => {
  if (number === 1) return;
  const value = name => row.getCell(columns[name]).value;
  const latitude = Number(value("역위도")), longitude = Number(value("역경도"));
  if (!(latitude >= 32 && latitude <= 39.5 && longitude >= 124 && longitude <= 132)) return;
  const name = value("역사명"), route = value("노선명");
  if (typeof name !== "string" || typeof route !== "string" || !name.trim() || !route.trim()) return;
  const date = value("데이터기준일자");
  if (date instanceof Date) dates.add(date.toISOString().slice(0, 10));
  else if (date) dates.add(String(date).slice(0, 10));
  stations.push({ name: name.trim(), route: route.trim(), latitude, longitude, operator: String(value("운영기관명") || "") });
});
if (stations.length < 900 || stations.length > 3000) throw new Error("Unexpected station coverage; review source before updating");
await fs.writeFile(new URL("../lib/data/subway-stations.json", import.meta.url), JSON.stringify({ source, download, portal: "https://www.data.go.kr/data/15013205/standard.do", retrievedAt: new Date().toISOString().slice(0, 10), sourceSha256: createHash("sha256").update(bytes).digest("hex"), dataDates: [...dates].sort(), stations }) + "\n");
console.log("Saved", stations.length, "official station rows");
