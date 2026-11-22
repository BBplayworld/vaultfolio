// 투자 탭(#263) 데이터 생성 스크립트. 정본은 data/market-history/*.csv이고, 이 스크립트가 CSV를 읽어
// src/lib/invest/data/market-history.generated.json 을 만든다. 생성물은 수동으로 고치지 않는다(드리프트 테스트가 막음).
// 사용: node scripts/market-history/build.mjs          생성물을 다시 쓴다
//       node scripts/market-history/build.mjs --check  커밋된 생성물이 CSV와 같은지 확인한다(다르면 종료 코드 1)
// 갱신 절차: docs/ops/market-history-refresh.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv } from "./csv.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CSV_DIR = path.join(root, "data/market-history");
export const OUT_JSON = path.join(root, "src/lib/invest/data/market-history.generated.json");
const csv = (f) => parseCsv(fs.readFileSync(path.join(CSV_DIR, f), "utf8"));
const num = (v) => (v === "" || v == null ? null : +v);

const INDEX_CODE = { spx: "SPX", ndx: "NDX", kospi: "KOSPI" };
const EVENT_INDEX = ["S&P", "나스닥", "코스피"];
export const CATEGORIES = ["금리·통화 정책", "금융위기", "시장 급락", "전쟁·지정학", "기술 거품", "팬데믹", "에너지"];

const monthIdx = (s) => +s.slice(0, 4) * 12 + (+s.slice(5) - 1);

/** 월 계열(연속 구간)을 {from, v[]}로 압축한다. 중간에 빈 달이 있으면 오류. */
function series(rows, col, last) {
  const pts = rows.filter((r) => r[col] !== "" && r.month <= `${last}-12`).map((r) => [r.month, +r[col]]);
  if (!pts.length) throw new Error(`${col} 값이 없어요`);
  const from = pts[0][0];
  pts.forEach(([m], i) => {
    if (monthIdx(m) !== monthIdx(from) + i) throw new Error(`${col} 월 계열이 끊겼어요: ${m}`);
  });
  return { from, v: pts.map((p) => p[1]) };
}

export function build() {
  const wiki = csv("index-annual.csv");
  const dam = Object.fromEntries(csv("spx-level-damodaran.csv").map((r) => [+r.year, +r.spx_close_damodaran]));
  const idx = {};
  for (const [k, code] of Object.entries(INDEX_CODE)) {
    const rows = wiki.filter((r) => r.index === code).map((r) => ({ y: +r.year, c: num(r.close), rev: r.rev_id, page: r.source_page }));
    if (k === "spx") {
      const ys = Object.keys(dam).map(Number).sort((a, b) => a - b);
      idx.spx = { start: ys[0], close: ys.map((y) => dam[y]), rev: rows[0].rev };
    } else {
      rows.forEach((r, i) => { if (r.c == null || r.y !== rows[0].y + i) throw new Error(`${k} 연말값이 끊겼어요: ${r.y}`); });
      idx[k] = { start: rows[0].y, close: rows.map((r) => r.c), rev: rows[0].rev };
    }
  }
  const last = Math.min(...Object.values(idx).map((x) => x.start + x.close.length - 1));
  for (const x of Object.values(idx)) x.close = x.close.slice(0, last - x.start + 1);

  const rm = csv("rates-monthly.csv");
  const rate = { us: series(rm, "fed_target_upper", last), kr: series(rm, "bok_base", last) };
  const ovl = { us: series(rm, "us10y_end", last), kr: series(rm, "kr10y_avg", last) };

  const rec = csv("recessions-us.csv")
    .filter((r) => r.recession_end_month >= "1961-01")
    .map((r) => ({ s: r.recession_start_month, e: r.recession_end_month, n: +r.contraction_months, peak: r.peak_month }));

  const usYear = csv("macro-us-annual.csv").filter((r) => +r.year <= last).map((r) => ({
    y: +r.year, y10: num(r.us10y_end), y10d: r.us10y_end_date, s2: num(r.spread_10y2y_end), s3: num(r.spread_10y3m_end), rec: +r.recession_months_nber,
  }));
  const krYear = csv("kr-annual.csv").filter((r) => +r.year <= last).map((r) => ({
    y: +r.year, base: num(r.bok_base_end), k3: num(r.kr3y_end), k10: num(r.kr10y_end), d: r.kr_bond_end_date,
  }));

  const events = csv("events.csv").map((r) => ({
    id: r.id, name: r.name, date: r.date_display, pm: r.point_month, cat: r.category, fact: r.fact,
    urls: r.source_urls.split(" ; ").filter(Boolean),
    idx: r.indexes === "세 지수" ? [...EVENT_INDEX] : r.indexes.split("·"),
  })).filter((e) => e.pm.slice(0, 4) <= String(last));

  const out = { last, idx, rate, ovl, rec, usYear, krYear, events };
  validate(out);
  return out;
}

/** 생성 단언(4-14): 위반하면 생성 자체를 막는다. 같은 단언을 테스트도 다시 돌린다. */
function validate(d) {
  if (d.events.length !== 31) throw new Error(`사건은 31건이어야 해요: ${d.events.length}`);
  const cats = new Set(d.events.map((e) => e.cat));
  if (cats.size !== 7 || CATEGORIES.some((c) => !cats.has(c))) throw new Error("사건 분류는 7종이어야 해요");
  d.events.forEach((e) => {
    if (!e.name || [...e.name].length > 12) throw new Error(`표시명 12자 이하: ${e.id}`);
    if ([...e.fact].length > 40) throw new Error(`사실 1줄 40자 이하: ${e.id}`);
    if (!e.urls.length || e.urls.some((u) => !u.startsWith("https://www.federalreserve.gov/"))) throw new Error(`1차 URL: ${e.id}`);
    if (e.idx.some((x) => !EVENT_INDEX.includes(x))) throw new Error(`사건 지수: ${e.id}`);
  });
  const usM = (m) => (monthIdx(m) >= monthIdx(d.ovl.us.from) ? d.ovl.us.v[monthIdx(m) - monthIdx(d.ovl.us.from)] : undefined);
  d.usYear.forEach((r) => { const m = usM(`${r.y}-12`); if (r.y10 != null && Math.abs(m - r.y10) > 0.005) throw new Error(`10년물 12월 월말 ≠ 연말: ${r.y}`); });
  d.usYear.forEach((r) => {
    let n = 0;
    d.rec.forEach((x) => { for (let mi = monthIdx(x.s); mi <= monthIdx(x.e); mi++) if (Math.floor(mi / 12) === r.y) n++; });
    if (n !== r.rec) throw new Error(`침체 월 수 불일치: ${r.y} ${n} vs ${r.rec}`);
  });
  d.rec.forEach((x) => { if (monthIdx(x.e) - monthIdx(x.s) + 1 !== x.n) throw new Error(`침체 구간 월 수: ${x.s}`); });
  const krM = (m) => d.rate.kr.v[monthIdx(m) - monthIdx(d.rate.kr.from)];
  d.krYear.forEach((r) => { if (r.base != null && Math.abs(krM(`${r.y}-12`) - r.base) > 0.005) throw new Error(`한국 기준금리 연말 ≠ 월 12월: ${r.y}`); });
}

export const serialize = (data) => JSON.stringify(data) + "\n";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = serialize(build());
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, "utf8") : "";
    if (cur !== text) { console.error("생성물이 CSV와 달라요. node scripts/market-history/build.mjs 를 다시 실행하세요."); process.exit(1); }
    console.log("생성물 = CSV 기준 결과");
  } else {
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, text);
    console.log(`생성: ${path.relative(root, OUT_JSON)} (${text.length} bytes)`);
  }
}
