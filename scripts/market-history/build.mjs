// 투자 탭(#263) 데이터 생성 스크립트. 정본은 data/market-history/*.csv이고, 이 스크립트가 CSV를 읽어
// src/lib/invest/data/market-history.generated.json 을 만든다. 생성물은 수동으로 고치지 않는다(드리프트 테스트가 막음).
// 사용: node scripts/market-history/build.mjs          생성물을 다시 쓴다
//       node scripts/market-history/build.mjs --check  커밋된 생성물이 CSV와 같은지 확인한다(다르면 종료 코드 1)
// 갱신 절차: docs/ops/market-history-refresh.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseCsv, toCsv } from "./csv.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CSV_DIR = path.join(root, "data/market-history");
export const OUT_JSON = path.join(root, "src/lib/invest/data/market-history.generated.json");
export const PUBLIC_DIR = path.join(root, "public/datasets/market-history");
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

  // R4: 사건 10건(연준 자산 매입·보유 축소 결정, 결과와 무관한 규칙) — 행 펼침·연도별 표 전용, 첫 화면 점 0
  const eventsExtra = csv("events-extra.csv").map((r) => ({
    id: r.id, name: r.name, date: r.date_display, pm: r.point_month, cat: r.category, fact: r.fact,
    urls: r.source_urls.split(" ; ").filter(Boolean), idx: [...EVENT_INDEX],
  }));
  // R4: 금리차 월평균(연준 H.15) — 월 단위가 정본. 값이 없는 달은 null
  const sp = csv("spread-monthly.csv").filter((r) => r.month <= `${last}-12`);
  const spread = { from: sp[0].month, a: sp.map((r) => num(r.spread_10y2y_avg)), b: sp.map((r) => num(r.spread_10y3m_avg)) };
  sp.forEach((r, i) => { if (monthIdx(r.month) !== monthIdx(sp[0].month) + i) throw new Error(`금리차 월 계열이 끊겼어요: ${r.month}`); });
  // 해별 경제 이슈(1990~2026): 해마다 읽기 줄·격자·연도별 표·오른 해 펼침이 같은 출처(yearIssues)에서 읽는다. 첫 화면 점은 늘리지 않는다
  const eventsYear = csv("events-year.csv").map((r) => ({
    y: +r.year, id: r.id, name: r.name, date: r.date_display, cat: r.category, fact: r.fact, region: r.region,
    urls: r.source_urls.split(" ; ").filter(Boolean), m: +r.order_month, wip: r.status === "진행 중", ref: r.rule === "A" ? r.linked_id : "",
  }));
  // R2: 미국 CPI-U·실업률 연평균(BLS 원자료, FRED 경유 월값의 12개월 평균). 값이 없는 해(2025: 10월 미공표)는 null
  const bls = csv("macro-us-bls.csv").filter((r) => +r.year <= last).map((r) => ({ y: +r.year, cpi: num(r.cpi_u_yoy_pct), un: num(r.unemployment_avg_pct) }));
  const out = { last, idx, rate, ovl, rec, usYear, krYear, events, eventsExtra, spread, eventsYear, bls };
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
  if (d.eventsExtra.length !== 10) throw new Error(`추가 사건은 10건이어야 해요: ${d.eventsExtra.length}`);
  d.eventsExtra.forEach((e) => {
    if ([...e.name].length > 18) throw new Error(`표시명 18자 이하: ${e.id}`);
    if ([...e.fact].length > 40 || !e.fact.endsWith("요.")) throw new Error(`사실 1줄: ${e.id}`);
    if (e.cat !== "금리·통화 정책" || !e.urls.every((u) => u.startsWith("https://www.federalreserve.gov/"))) throw new Error(`추가 사건 분류·출처: ${e.id}`);
  });
  // 해별 이슈: 54행, 2006 비움, 연준 1차 출처만, 기존 정본(A)은 이름·사실 그대로
  if (d.eventsYear.length !== 54) throw new Error(`해별 이슈는 54행이어야 해요: ${d.eventsYear.length}`);
  const allEv = new Map([...d.events, ...d.eventsExtra].map((e) => [e.id, e]));
  d.eventsYear.forEach((e) => {
    if ([...e.fact].length > 40 || !e.fact.endsWith("요.")) throw new Error(`해별 이슈 사실 1줄: ${e.id}`);
    if (!CATEGORIES.includes(e.cat)) throw new Error(`해별 이슈 분류: ${e.id}`);
    if (!e.urls.length || e.urls.some((u) => !u.startsWith("https://www.federalreserve.gov/"))) throw new Error(`해별 이슈 1차 출처: ${e.id}`);
    if (e.ref) { const o = allEv.get(e.ref.replace(/^Y-/, "")); if (!o || o.name !== e.name || o.fact !== e.fact) throw new Error(`기존 정본과 다름: ${e.id}`); }
  });
  for (let y = 1990; y <= 2025; y++) if (y !== 2006 && !d.eventsYear.some((e) => e.y === y)) throw new Error(`해별 이슈가 비었어요: ${y}`);
  const usM = (m) => (monthIdx(m) >= monthIdx(d.ovl.us.from) ? d.ovl.us.v[monthIdx(m) - monthIdx(d.ovl.us.from)] : undefined);
  d.usYear.forEach((r) => { const m = usM(`${r.y}-12`); if (r.y10 != null && Math.abs(m - r.y10) > 0.005) throw new Error(`10년물 12월 월말 ≠ 연말: ${r.y}`); });
  d.usYear.forEach((r) => {
    let n = 0;
    d.rec.forEach((x) => { for (let mi = monthIdx(x.s); mi <= monthIdx(x.e); mi++) if (Math.floor(mi / 12) === r.y) n++; });
    if (n !== r.rec) throw new Error(`침체 월 수 불일치: ${r.y} ${n} vs ${r.rec}`);
  });
  bls_check(d);
  d.rec.forEach((x) => { if (monthIdx(x.e) - monthIdx(x.s) + 1 !== x.n) throw new Error(`침체 구간 월 수: ${x.s}`); });
  const krM = (m) => d.rate.kr.v[monthIdx(m) - monthIdx(d.rate.kr.from)];
  d.krYear.forEach((r) => { if (r.base != null && Math.abs(krM(`${r.y}-12`) - r.base) > 0.005) throw new Error(`한국 기준금리 연말 ≠ 월 12월: ${r.y}`); });
}

function bls_check(d) {
  if (d.bls[0].y !== 1961) throw new Error("BLS 연평균은 1961부터예요");
  d.bls.forEach((r, i) => {
    if (i && r.y !== d.bls[i - 1].y + 1) throw new Error(`BLS 연도가 끊겼어요: ${r.y}`);
    if ((r.cpi == null) !== (r.un == null) && r.y !== d.last) throw new Error(`BLS 값 짝이 안 맞아요: ${r.y}`);
  });
}

export const serialize = (data) => JSON.stringify(data) + "\n";

// ---------- 공개 가공 데이터셋(CC BY-SA 4.0) ----------
// S&P 500 연말 지수 수준값(Damodaran 공개 자료)은 재배포 범위 밖이라 공개 파일에 넣지 않는다(spec 9절·AC8). S&P는 등락률만.
// verify_status 열과 시안 메모 열도 없다. 나스닥100·코스피 등락률은 종가로 다시 계산한 값(출처 문구와 같음).
const round2 = (x) => Math.round(x * 100) / 100;
export function buildPublic() {
  const last = build().last;
  const wiki = csv("index-annual.csv").filter((r) => +r.year <= last);
  const idxRows = wiki.map((r, i) => {
    let ret = r.ret_pct;
    if (r.index !== "SPX") {
      const prev = wiki.find((q) => q.index === r.index && +q.year === +r.year - 1);
      ret = prev ? round2((+r.close / +prev.close - 1) * 100).toFixed(2) : "";
    }
    return { year: r.year, index: r.index, close: r.index === "SPX" ? "" : r.close, ret_pct: ret, source_page: r.source_page, rev_id: r.rev_id };
  });
  const rates = csv("rates-monthly.csv").filter((r) => r.month <= `${last}-12`);
  const macro = csv("macro-us-annual.csv").filter((r) => +r.year <= last);
  const kr = csv("kr-annual.csv").filter((r) => +r.year <= last);
  const rec = csv("recessions-us.csv");
  const ev = csv("events.csv");
  const H = (rows) => Object.keys(rows[0]);
  const files = {
    "index-annual.csv": toCsv(H(idxRows), idxRows),
    "rates-monthly.csv": toCsv(H(rates), rates),
    "macro-us-annual.csv": toCsv(H(macro), macro),
    "kr-annual.csv": toCsv(["year", "bok_base_end", "bok_regime", "kr3y_end", "kr10y_end", "kr_bond_end_date"], kr),
    "recessions-us.csv": toCsv(H(rec), rec),
    "events.csv": toCsv(H(ev), ev),
    "events-year.csv": toCsv(H(csv("events-year.csv")), csv("events-year.csv")),
    "events-extra.csv": toCsv(H(csv("events-extra.csv")), csv("events-extra.csv")),
    "macro-us-bls.csv": toCsv(["year", "cpi_u_avg", "cpi_u_yoy_pct", "unemployment_avg_pct"], csv("macro-us-bls.csv").filter((r) => +r.year <= last)),
    "spread-monthly.csv": toCsv(["month", "spread_10y2y_avg", "spread_10y3m_avg"], csv("spread-monthly.csv").filter((r) => r.month <= `${last}-12`)),
  };
  const ccText = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "cc-by-sa-4.0.txt"), "utf8");
  files["LICENSE"] = `시크릿에셋 시장 역사 데이터셋 — Creative Commons Attribution-ShareAlike 4.0 International (CC BY-SA 4.0)

이 폴더의 가공 데이터(CSV)는 CC BY-SA 4.0 조건으로 공개합니다. 사용할 때는
  1) 출처를 "시크릿에셋(secretasset) 시장 역사 데이터셋, 기준일 ${last}.12.31"로 밝히고,
  2) 변경한 내용이 있으면 변경했다고 알리고,
  3) 같은 조건(CC BY-SA 4.0)으로 공개해 주세요.
원자료의 출처와 권리는 README.md의 '출처' 절에 있습니다. 위키백과 문서는 해당 문서의 CC BY-SA 4.0 조건을 따릅니다.
이 저장소의 나머지 코드는 저장소 최상위 LICENSE(MIT)를 따릅니다. 이 폴더만 아래 라이선스가 적용됩니다.

----------------------------------------------------------------------
${ccText}`;
  files["README.md"] = `# 시크릿에셋 시장 역사 데이터셋

S&P 500·나스닥100·코스피의 **연 단위 지수 값과 등락률**, 같은 기간의 **기준금리·국채 금리·미국 경기침체 기간·사건 ${ev.length}건**을 가공한 CSV예요. 과거 시장 사실이며 투자 권유가 아니에요. 기준일은 ${last}.12.31이고 매년 1월에 갱신해요.

라이선스: **CC BY-SA 4.0**(\`LICENSE\`). 출처 표기·변경 표시·같은 조건 공개가 필요해요.

## 파일
| 파일 | 내용 |
|---|---|
| \`index-annual.csv\` | 지수 연말 값(나스닥100 1985~, 코스피 1981~)·연간 등락률(%). **S&P 500은 연말 지수 값 없이 등락률만** 있어요. 나스닥100·코스피 등락률은 연말 값으로 다시 계산한 값이에요 |
| \`rates-monthly.csv\` | 월 단위: 연준 기준금리 목표(범위면 상·하단), 미 10년물 월말 값, 한국은행 기준금리(2008년 3월 전은 콜금리 목표), 국고채 10년 월평균 |
| \`macro-us-annual.csv\` | 미국 연 단위: 10년·2년·3개월물 연말 값과 연평균, 장단기 금리차(%p), 그해 경기침체 월 수 |
| \`macro-us-bls.csv\` | 미국 연 단위(1961~): 소비자물가지수(CPI-U, 전 품목, 비계절조정) 연평균·전년 대비(%)와 실업률(비계절조정) 연평균(%). 연평균은 월 12개의 단순 평균. 해당 해에 공표되지 않은 달이 있으면 빈 칸(2025: 10월 미공표) |
| \`kr-annual.csv\` | 한국 연 단위: 기준금리·국고채 3년·10년 연말 값과 기준일 |
| \`recessions-us.csv\` | NBER 경기순환 기준일(고점·저점)과 침체 구간(고점 다음 달 ~ 저점 월) |
| \`events.csv\` | 사건 ${ev.length}건: 표시명·날짜·분류·사실 1줄·1차 출처 URL·관련 지수 |
| \`events-extra.csv\` | 연준 자산 매입·보유 축소 결정 10건(표시명·날짜·사실 1줄·연준 보도자료 URL) |
| \`events-year.csv\` | 해별 경제 이슈 1990~2026(54행): 해·표시명·날짜·분류·지역·사실 1줄·연준 1차 출처 URL. 연준 공개 문서 기반이며 공개 문서는 출처 표기로 인용하고, 가공·정리한 이 표는 CC BY-SA 4.0 |

## 정의
- 가격 지수(배당 제외), 미국 지수는 달러 기준, 연말 종가 기준이에요.
- 연간 등락 = 그해 연말 값 ÷ 전년 연말 값 − 1.
- 사건의 날짜는 1차 출처가 확인해 주는 정밀도까지만 적었고, 사실 1줄은 일어난 일만 담았어요(원인·영향 해석 없음).

## 출처
- 지수: 위키백과 「S&P 500」(영문, 리비전 ${wiki.find((r) => r.index === "SPX").rev_id})·「Nasdaq-100」(영문, 리비전 ${wiki.find((r) => r.index === "NDX").rev_id})·「코스피」(한국어, 리비전 ${wiki.find((r) => r.index === "KOSPI").rev_id}), CC BY-SA 4.0.
- S&P 500: 이 폴더의 등락률은 위키 표 값이에요. 앱 화면은 Aswath Damodaran(NYU Stern) 공개 자료 「Historical Returns on Stocks, Bonds and Bills」(2026년 1월 갱신)의 연말 지수로 다시 계산한 값을 써서, 소수점 아래에서 이 파일과 차이가 날 수 있어요. Damodaran 값 자체는 이 폴더에 넣지 않아요.
- 나스닥100 2003·2004년 연말 값은 다른 공개 자료와 최대 0.6% 차이가 있어요(위키 값 사용).
- 금리: 미 연준 공개시장 표·H.15(미 정부 저작물, 출처 표기), 한국은행 ECOS(한국은행이 작성한 통계, 출처 표기).
- 물가·실업률: 미 노동통계국(BLS) 원자료 CPI-U(\`CUUR0000SA0\`)·실업률(\`LNU04000000\`)의 월값을 세인트루이스 연은 FRED(\`CPIAUCNS\`·\`UNRATENSA\`)에서 받아 연평균으로 가공했어요(2026-11-22 내려받음). 미 정부 저작물(17 U.S.C. §105)로 공공 영역이며 출처 표기만 해요. BLS·FRED 공식 발표 연평균 표와는 반올림 차이가 있을 수 있어요.
- 경기침체: NBER 경기순환 기준일(출처 표기 조건으로 복사 허용). NBER 로고·상표는 쓰지 않아요.
- 사건: 미 연준 공개 문서(1차 출처 URL은 \`events.csv\`·\`events-extra.csv\`·\`events-year.csv\`).
- S&P 500은 S&P Dow Jones Indices, Nasdaq-100은 Nasdaq, Inc., KOSPI는 한국거래소의 상표예요. 시크릿에셋은 이 기관들과 제휴 관계가 아니에요.

## 갱신
매년 1월에 정본 CSV를 갱신하고 생성 스크립트(\`scripts/market-history/build.mjs\`)로 다시 만들어요. 이 폴더의 파일은 직접 고치지 않아요.
`;
  return files;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = serialize(build());
  const pub = buildPublic();
  if (process.argv.includes("--check")) {
    const cur = fs.existsSync(OUT_JSON) ? fs.readFileSync(OUT_JSON, "utf8") : "";
    let bad = cur !== text;
    for (const [name, body] of Object.entries(pub)) {
      const p = path.join(PUBLIC_DIR, name);
      if (!fs.existsSync(p) || fs.readFileSync(p, "utf8") !== body) bad = true;
    }
    if (bad) { console.error("생성물이 CSV와 달라요. node scripts/market-history/build.mjs 를 다시 실행하세요."); process.exit(1); }
    console.log("생성물 = CSV 기준 결과");
  } else {
    fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
    fs.writeFileSync(OUT_JSON, text);
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    for (const [name, body] of Object.entries(pub)) fs.writeFileSync(path.join(PUBLIC_DIR, name), body);
    console.log(`생성: ${path.relative(root, OUT_JSON)} (${text.length} bytes) + ${path.relative(root, PUBLIC_DIR)}/ ${Object.keys(pub).length}개`);
  }
}
