// 연준 H.15 XML(FRB_h15_xml.zip 안의 H15_data.xml)에서 10년물 월말 값을 직접 만들어
// data/market-history/rates-monthly.csv의 us10y_end(월말)와 macro-us-annual.csv의 연말 값을 전 월 대조한다.
// 사용: node scripts/market-history/verify-h15.mjs <H15_data.xml 경로> [끝 연월=2025-12]
// 갱신 절차는 docs/ops/market-history-refresh.md. 이 파일은 네트워크를 쓰지 않는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv } from "./csv.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const xmlPath = process.argv[2];
const END = process.argv[3] || "2025-12";
if (!xmlPath) { console.error("사용: node verify-h15.mjs <H15_data.xml> [끝 연월]"); process.exit(2); }

const xml = fs.readFileSync(xmlPath, "utf8");
const sPos = xml.indexOf('SERIES_NAME="RIFLGFCY10_N.B"');
if (sPos < 0) throw new Error("RIFLGFCY10_N.B 계열을 찾지 못했어요");
const sStart = xml.lastIndexOf("<kf:Series", sPos);
const sEnd = xml.indexOf("</kf:Series>", sPos);
const block = xml.slice(sStart, sEnd);
const monthEnd = {}; // 월 → [날짜, 값]
const yearEnd = {};
for (const m of block.matchAll(/<frb:Obs OBS_STATUS="(\w+)" OBS_VALUE="([^"]*)" TIME_PERIOD="(\d{4}-\d{2}-\d{2})"/g)) {
  if (m[1] === "ND" || m[2] === "" || m[2] === "ND") continue;
  const d = m[3], ym = d.slice(0, 7);
  if (!monthEnd[ym] || monthEnd[ym][0] < d) monthEnd[ym] = [d, +m[2]];
  if (!yearEnd[d.slice(0, 4)] || yearEnd[d.slice(0, 4)][0] < d) yearEnd[d.slice(0, 4)] = [d, +m[2]];
}
const rm = parseCsv(fs.readFileSync(path.join(root, "data/market-history/rates-monthly.csv"), "utf8"));
const mac = parseCsv(fs.readFileSync(path.join(root, "data/market-history/macro-us-annual.csv"), "utf8"));
let checked = 0, bad = 0, missing = 0;
for (const r of rm) {
  if (r.month > END || r.us10y_end === "") continue;
  const h = monthEnd[r.month];
  if (!h) { missing++; console.log("H.15에 없음", r.month); continue; }
  checked++;
  if (Math.abs(h[1] - +r.us10y_end) > 0.005) { bad++; console.log("월말 불일치", r.month, "csv", r.us10y_end, "h15", h[1], h[0]); }
}
let yChecked = 0, yBad = 0;
for (const r of mac) {
  if (r.us10y_end === "") continue;
  const h = yearEnd[r.year]; yChecked++;
  if (!h || Math.abs(h[1] - +r.us10y_end) > 0.005 || h[0] !== r.us10y_end_date) { yBad++; console.log("연말 불일치", r.year, r.us10y_end, r.us10y_end_date, h); }
}
console.log(`월말 ${checked}개 대조 · 불일치 ${bad} · H.15에 없음 ${missing} / 연말 ${yChecked}개 대조 · 불일치 ${yBad}`);
process.exit(bad || yBad || missing ? 1 : 0);
