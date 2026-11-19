// #245 내 종목 화면이 내 결정을 안다 — 시각 목업 캡처(ui-designer, 2026-11-19). 코드 수정 0.
// preview(issue-5.126, #247 포함) 체험 화면에 mock-d1-lib.js 를 넣고 장면별로 새 요소만 덧붙여 찍는다. 다크, deviceScaleFactor 2.
// node mock-d1-shot.mjs <OUT> [장면 이름 일부]
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const ONLY = process.argv[3];
const lib = readFileSync(new URL("./mock-d1-lib.js", import.meta.url), "utf8");
const br = await chromium.launch({ proxy });
const want = (n) => !ONLY || n.includes(ONLY);
const log = (n, o) => console.log(n, JSON.stringify(o));

async function open(W, H, hash) {
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6000);
  if (hash) { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(4000); }
  await p.addScriptTag({ content: lib });
  return p;
}
const stocks = async (W, H, { collapse = true } = {}) => { const p = await open(W, H, "#detail/stocks"); await p.waitForSelector('[data-testid="stock-row-left"]');
  if (collapse) { const t = p.locator('[data-slot="collapsible-trigger"][aria-expanded="true"]').first(); if (await t.count()) { await t.click(); await p.waitForTimeout(600); } } return p; };
const stockPage = async (W, H) => { const p = await open(W, H, "#detail/stocks"); await p.locator('[data-testid="stock-page-entry"]').first().click(); await p.waitForSelector('[data-testid="stock-page-head"]'); await p.waitForTimeout(3500); await p.addScriptTag({ content: lib }); return p; };
const top = (p) => p.evaluate(() => { scrollTo(0, 0); document.querySelectorAll("*").forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); });
const shot = (p, name, sel) => (sel === "FULL" ? p.screenshot({ path: `${OUT}/d1-${name}.png`, fullPage: true }) : sel ? p.locator(sel).first().screenshot({ path: `${OUT}/d1-${name}.png` }) : p.screenshot({ path: `${OUT}/d1-${name}.png` }));
// 여러 조각을 한 장으로: items = [{ cap, buf, w }], cols = 열 수
async function compose(name, title, items, cols = 1) {
  const ctx = await br.newContext({ viewport: { width: 100, height: 100 }, deviceScaleFactor: 2, colorScheme: "dark" }); const p = await ctx.newPage();
  const maxW = Math.max(...items.map((i) => i.w));
  await p.setContent(`<body style="margin:0;background:#0b0c11;font-family:system-ui,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#9aa0aa;width:${cols * (maxW + 24) + 24}px"><div style="padding:16px 24px 4px;font-size:13px;font-weight:700;color:#e6c35c">${title}</div><div style="display:grid;grid-template-columns:repeat(${cols},${maxW}px);gap:20px 24px;padding:12px 24px 24px;align-items:start">${items.map((i) => `<div><div style="font-size:12px;line-height:16px;margin-bottom:6px;color:#e6c35c">${i.cap}</div><img src="data:image/png;base64,${i.buf.toString("base64")}" style="width:${i.w}px;display:block"></div>`).join("")}</div></body>`);
  await p.waitForTimeout(300); const b = await p.locator("body").boundingBox(); await p.setViewportSize({ width: Math.ceil(b.width), height: Math.ceil(b.height) });
  await p.screenshot({ path: `${OUT}/d1-${name}.png`, fullPage: true }); await ctx.close();
}
const MIX = { "삼성전자": "장기 보유", "Apple": "점검 대상", "TIGER 미국S&P500": "장기 보유", "SK하이닉스": "점검 차례" }; // NVIDIA·KODEX 200 = 미정
const REAL = { "삼성전자": "장기 보유", "Apple": "점검 차례", "TIGER 미국S&P500": "점검 차례", "SK하이닉스": "점검 차례" }; // preview 데모의 실제 이름표 상태
const R_DOWN = "평단 대비 −15% 이하에 닿았어요", R_UP = "평단 대비 +25% 이상에 닿았어요", R_KEEP = "장기 보유로 정한 지 12개월이 지났어요";

// ① 상세·주식 목록 — 정한 행·차례 행·미정 행 섞임
if (want("01-list")) for (const [W, H] of [[390, 844], [1280, 900]]) {
  const p = await stocks(W, H); const before = await p.evaluate(() => d1.measureRows());
  await p.evaluate((a) => { d1.tags(a.MIX); d1.tile(d1.V.due(1)); }, { MIX }); await top(p); await p.waitForTimeout(300);
  log(`01-list-${W} before`, before); log(`01-list-${W} after`, await p.evaluate(() => d1.measureRows())); log(`01-list-${W} tiles`, await p.evaluate(() => d1.measureTiles()));
  await shot(p, `01-list-mixed-${W}`, "FULL"); if (W === 390) await shot(p, `01a-list-first-screen-390`);
  if (W === 390) { await p.evaluate((a) => { d1.tags(a.REAL); d1.tile(d1.V.due(3)); }, { REAL }); await shot(p, `01b-list-demo-real-390`, '[data-testid="detail-list-box-stocks"]'); }
  await p.context().close();
}
// ② 차례 행 펼침 안 진입 (손실 대입: Apple −15.6%)
if (want("02-entry")) for (const W of [390, 320]) {
  const p = await stocks(W, 844);
  await p.evaluate((a) => { const m = { ...a.MIX, Apple: "점검 차례", "SK하이닉스": "점검 대상" }; d1.tags(innerWidth < 360 ? { Apple: "점검 차례" } : m); d1.tile(d1.V.due(1)); d1.rowProfit("Apple", "2,497,200원", "-466,500원", "-15.7%"); }, { MIX });
  await p.evaluate(() => d1.rowOf("Apple").querySelector('[data-slot="collapsible-trigger"]').click()); await p.waitForTimeout(900);
  await p.evaluate((r) => { d1.rowEntry("Apple", r); d1.rowOf("Apple").scrollIntoView({ block: "start" }); scrollBy(0, -70); }, R_DOWN); await p.waitForTimeout(400);
  log(`02-entry-${W}`, await p.evaluate(() => ({ entry: d1.box(".d1-entry"), lines: Math.round(document.querySelector(".d1-entry .t").getBoundingClientRect().height / 20) })));
  await shot(p, `02-entry-row-open-${W}`); await p.context().close();
}
// ②-도착: 불리기 › 내 자산 점검 › 주식 보기에서 그 종목 한 장이 열린 상태(preview 실제 화면, 주입 없음)
if (want("02c-arrival")) { const p = await open(390, 844, "#activity/report"); await p.waitForSelector('[data-testid="grow-row"]');
  const tg = p.locator('[data-testid="grow-row"][data-ticker="000660"] [data-testid="grow-row-toggle"]'); await tg.click(); await p.waitForTimeout(800);
  await p.evaluate(() => { document.querySelector('[data-testid="grow-row"][data-ticker="000660"]').scrollIntoView({ block: "start" }); scrollBy(0, -80); }); await p.waitForTimeout(400);
  log("02c back", await p.evaluate(() => d1.backLabel("뒤로"))); await shot(p, "02c-arrival-sheet-390"); await top(p); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/d1-02e-arrival-back-label-390.png`, clip: { x: 0, y: 0, width: 390, height: 200 } }); await p.context().close(); }
// ②-한계: 카테고리 탭(예: ISA)에서 행 %(그 계좌 몫)와 차례 기준(티커 전체·원화 평단)이 달라 보이는 경우
if (want("02d-partial")) { const p = await stocks(390, 844);
  await p.evaluate((a) => { d1.tags({ Apple: "점검 차례" }); d1.rowProfit("Apple", "1,248,600원", "-170,300원", "-12.0%"); }, {});
  await p.evaluate(() => d1.rowOf("Apple").querySelector('[data-slot="collapsible-trigger"]').click()); await p.waitForTimeout(900);
  await p.evaluate((r) => { d1.rowEntry("Apple", r); }, R_DOWN); await p.waitForTimeout(300);
  const box = await p.evaluate(() => { const r = d1.rowOf("Apple").getBoundingClientRect(); return { x: 0, y: r.y + scrollY, width: innerWidth, height: 190 }; });
  await p.screenshot({ path: `${OUT}/d1-02d-partial-view-mismatch-390.png`, fullPage: true, clip: box }); await p.context().close(); }
// ③ 종목 한 장 머리 — 상태 3·4·6·7·10·12·14 (+8·13)
const HEADS = (w) => [
  ["상태 1·14 — 정하지 않음 / 코인·부동산만 차례 (변화 없음)", null, null],
  ["상태 3 — 장기 보유 · 손실", (d) => ({ parts: ["<b>장기 보유</b>", d.since("정한 날 대비", -8.4)] }), ["-214,500원", "-5.4%", true]],
  ["상태 4 — 오늘 정함", () => ({ parts: ["<b>장기 보유</b>", "오늘 정함"] }), null],
  ["상태 6 — 점검 대상 · 조건 없음 · 주기 없음", (d) => ({ parts: ["<b>점검 대상</b>", d.since("정한 날 대비", -2.1)] }), ["-91,000원", "-2.3%", true]],
  ...(w < 360 ? [["비교(탈락) 상태 7 — 조건 절을 그대로 두면 3줄", (d) => ({ parts: ["<b>점검 대상</b>", d.since("정한 날 대비", -6.3), ...d.condSplit(15, 25)] }), ["-285,500원", "-7.2%", true]], ["상태 7′ — 조건이 한쪽뿐이면 360 미만에서도 보인다(2줄)", (d) => ({ parts: ["<b>점검 대상</b>", d.since("정한 날 대비", -6.3), d.cond(15, null)] }), ["-285,500원", "-7.2%", true]]] : []),
  [w < 360 ? "상태 7 — 360 미만 · 하한·상한 둘 다면 조건 절 생략(확정)" : "상태 7 — 점검 대상 · ±% 미도달 · 손실", w < 360 ? (d) => ({ parts: ["<b>점검 대상</b>", d.since("정한 날 대비", -6.3)] }) : (d) => ({ parts: ["<b>점검 대상</b>", d.since("정한 날 대비", -6.3), d.cond(15, 25)] }), ["-285,500원", "-7.2%", true]],
  ["상태 8 — 점검 대상 · 기간만", (d) => ({ parts: ["<b>점검 대상</b>", d.since("정한 날 대비", 3.0), "다음 점검 <span class='v'>2월 18일</span>"] }), null],
  ["상태 10 — 점검 차례 · 하한(손실)", () => ({ entry: "평단 대비 −15% 이하에 닿았어요" }), ["-610,000원", "-15.4%", true]],
  ["상태 12 — 그대로 둔 당일", w < 360 ? (d) => ({ parts: ["<b>점검 대상</b>", "오늘 점검함"] }) : (d) => ({ parts: ["<b>점검 대상</b>", "오늘 점검함", d.cond(15, 25)] }), ["-610,000원", "-15.4%", true]],
  ["상태 12 — 그대로 둔 다음 날부터", w < 360 ? (d) => ({ parts: ["<b>점검 대상</b>", d.since("점검일 대비", -1.0)] }) : (d) => ({ parts: ["<b>점검 대상</b>", d.since("점검일 대비", -1.0), d.cond(15, 25)] }), ["-642,000원", "-16.2%", true]],
  ["상태 13 — 점검 차례 · 기간(가장 긴 이유)", () => ({ entry: "장기 보유로 정한 지 12개월이 지났어요" }), null],
];
if (want("03-head")) for (const W of [390, 320, 1280]) {
  const p = await stockPage(W, W > 1000 ? 900 : 844); const items = [];
  for (const [cap, fn, profit] of HEADS(W)) {
    await p.evaluate(`d1.head(${fn ? `(${fn.toString()})(d1)` : "null"}, ${JSON.stringify(profit)})`); await top(p); await p.waitForTimeout(250);
    log(`03-head-${W} ${cap.slice(0, 8)}`, await p.evaluate(() => d1.measureHead()));
    items.push({ cap, buf: await p.locator('[data-testid="stock-page-head"]').screenshot(), w: (await p.locator('[data-testid="stock-page-head"]').boundingBox()).width });
    if (W === 390 && cap.startsWith("상태 7")) await shot(p, "03a-head-state7-full-390");
    if (W === 390 && cap.startsWith("상태 10")) await shot(p, "03b-head-state10-full-390");
    if (W === 1280 && cap.startsWith("상태 7")) await shot(p, "03c-head-state7-full-1280");
  }
  await compose(`03-head-states-${W}`, `종목 한 장 머리 — 상태별 (${W}px, 다크)`, items, W === 1280 ? 1 : 2); await p.context().close();
}
// ④ 홈 팁 3경우 + 상태 14 + 팁 없는 홈
const TIPS = [
  ["N=1", { badge: "내 자산", title: "점검 차례 <span class='tabular-nums'>1종목</span>", desc: R_DOWN }],
  ["N≥2 · 이유가 모두 같음", { badge: "내 자산", title: "점검 차례 <span class='tabular-nums'>2종목</span>", desc: R_DOWN }],
  ["N≥2 · ±% 이유가 서로 다름", { badge: "내 자산", title: "점검 차례 <span class='tabular-nums'>3종목</span>", desc: "내가 정한 조건에 닿았어요" }],
  ["N≥2 · 기간 이유가 섞임(부동산 포함 → 개)", { badge: "내 자산", title: "점검 차례 <span class='tabular-nums'>3개</span>", desc: "내가 정한 조건·기간에 닿았어요" }],
  ["상태 14 — 부동산만 차례", { badge: "내 자산", title: "점검 차례 <span class='tabular-nums'>1개</span>", desc: "정한 기간 6개월이 지났어요" }],
  ["N=1 · 가장 긴 이유", { badge: "내 자산", title: "점검 차례 <span class='tabular-nums'>1종목</span>", desc: R_KEEP }],
  ["비교(탈락) — 배지 `점검`", { badge: "점검", title: "점검 차례 <span class='tabular-nums'>1종목</span>", desc: R_DOWN }],
];
if (want("04-tip")) for (const W of [390, 320]) {
  const p = await open(W, 844); await p.waitForSelector('[data-testid="home-tip"]'); const items = [];
  if (W === 390) await shot(p, "04c-home-tip-before-tax-390", '[data-testid="home-tip"]');
  for (const [cap, spec] of TIPS) { await p.evaluate((s) => d1.tip(s), spec); await p.waitForTimeout(200); log(`04-tip-${W} ${cap}`, await p.evaluate(() => d1.measureTip()));
    items.push({ cap, buf: await p.locator('[data-testid="home-tip"]').screenshot(), w: (await p.locator('[data-testid="home-tip"]').boundingBox()).width }); }
  await compose(`04-tip-cases-${W}`, `홈 팁 — 점검 차례 (${W}px, 다크)`, items, W === 390 ? 2 : 2);
  if (W === 390) { await p.evaluate((s) => d1.tip(s), TIPS[0][1]); await top(p); await shot(p, "04a-home-with-tip-390", "FULL"); await p.evaluate(() => d1.tip(null)); await p.waitForTimeout(300); await shot(p, "04b-home-no-tip-390", "FULL"); }
  await p.context().close();
}
// ⑤ 내 주식 도구 타일 값 줄 3상태 (+ 읽기 전, 세금 타일 없는 달)
const TILES = [["차례 있음", "d1.V.due(2)"], ["정한 것 있음 · 차례 0", "d1.V.labeled(3, 2)"], ["정한 것 0(처음)", "d1.V.first(6)"], ["두 자리 수", "d1.V.labeled(12, 11)"], ["두 자리 수 · 처음", "d1.V.first(12)"], ["이름표 읽기 전(값 줄만 비움)", "d1.V.loading()"],
  ["비교(탈락) 범위 낱말 없음 — 차례", "d1.V.due(2, '')"], ["비교(탈락) 범위 낱말 없음 — 정함", "d1.V.labeled(3, 2, '')"], ["비교(탈락) 범위 낱말 없음 — 처음", "d1.V.first(6, '')"]];
if (want("05-tile")) for (const W of [390, 320, 1280]) {
  const p = await stocks(W, W > 1000 ? 900 : 844); const items = []; log(`05-tile-${W} before`, await p.evaluate(() => d1.measureTiles()));
  for (const [cap, v] of TILES) { await p.evaluate(`d1.tile(${v})`); await p.waitForTimeout(200); log(`05-tile-${W} ${cap}`, await p.evaluate(() => d1.measureTiles()));
    items.push({ cap: `타일 4개(11~12월) — ${cap}`, buf: await p.locator('[data-testid="stock-tools"]').screenshot(), w: (await p.locator('[data-testid="stock-tools"]').boundingBox()).width }); }
  for (const [cap, v] of TILES.slice(0, 3)) { const q = await stocks(W, W > 1000 ? 900 : 844); await q.evaluate(`d1.tile(${v}, { noTax: true })`); await q.waitForTimeout(200); log(`05-tile-${W} noTax ${cap}`, await q.evaluate(() => d1.measureTiles()));
    items.push({ cap: `타일 3개(1~10월) — ${cap}`, buf: await q.locator('[data-testid="stock-tools"]').screenshot(), w: (await q.locator('[data-testid="stock-tools"]').boundingBox()).width });
    if (W === 390 && cap === "차례 있음") { await q.evaluate((a) => d1.tags(a.MIX), { MIX }); await top(q); await shot(q, "05b-list-3tiles-first-screen-390"); } await q.context().close(); }
  await compose(`05-tile-states-${W}`, `내 주식 도구 — '내 자산 점검' 타일 (${W}px, 다크)`, items, W === 1280 ? 1 : 2); await p.context().close();
}
// ⑥ 320 행 줄 수 — 표시 전·후 나란히. 360 미만은 차례 행에만 표시(spec 2-1-4 축소 규칙)
const dueOnly = (m) => Object.fromEntries(Object.entries(m).filter(([, v]) => v === "점검 차례"));
if (want("06-rows")) for (const W of [320, 390]) {
  const p = await stocks(W, 844); const sel = '[data-testid="detail-list-box-stocks"]'; const b0 = await p.locator(sel).screenshot(); const w = (await p.locator(sel).boundingBox()).width; const m0 = await p.evaluate(() => d1.measureRows());
  const ALL = { ...REAL, "KODEX 200": "점검 대상", NVIDIA: "점검 차례" };
  await p.evaluate((a) => d1.tags(a), ALL); await p.waitForTimeout(200); const m1 = await p.evaluate(() => d1.measureRows()); const b1 = await p.locator(sel).screenshot();
  log(`06-rows-${W} all`, m0.map((r, i) => ({ name: r.name, leftW: r.leftW, rowH: [r.rowH, m1[i].rowH], leftH: [r.leftH, m1[i].leftH], metaLines: [r.metaLines, m1[i].metaLines], metaW: m1[i].metaW, tag: m1[i].tag })));
  const items = [{ cap: "지금(preview 5.126)", buf: b0, w }, { cap: W < 360 ? "비교(탈락) — 전 행 표시: 왼쪽 칸이 1줄씩 늘어난다" : "표시 뒤(전 행에 표시를 붙인 최악 조합)", buf: b1, w }];
  if (W < 360) { await p.evaluate((a) => d1.tags(a), dueOnly(ALL)); await p.waitForTimeout(200); const m2 = await p.evaluate(() => d1.measureRows());
    log(`06-rows-${W} dueOnly`, m0.map((r, i) => ({ name: r.name, rowH: [r.rowH, m2[i].rowH], leftH: [r.leftH, m2[i].leftH], tag: m2[i].tag }))); items.push({ cap: "확정 — 360 미만은 점검 차례 행에만", buf: await p.locator(sel).screenshot(), w }); }
  await compose(`06-rows-compare-${W}`, `상세·주식 행 줄 수 — 표시 전·후 (${W}px)`, items, items.length); await p.context().close();
}
// ⑥-b 최악 대입: 금액이 길어 왼쪽 칸이 좁아진 행 + 오늘 등락 칩이 없는 행(장중 미확정)
if (want("06b-worst")) for (const W of [390, 320]) {
  const p = await stocks(W, 844); const sel = '[data-testid="detail-list-box-stocks"]';
  await p.evaluate(() => { d1.rowProfit("삼성전자", "124,550,000원", "+18,585,000원", "+14.8%", true); d1.rowProfit("TIGER 미국S&P500", "32,205,000원", "+4,315,000원", "+16.7%", true); d1.noChip("Apple"); d1.noChip("TIGER 미국S&P500"); d1.noChip("SK하이닉스"); });
  await p.waitForTimeout(200); const b0 = await p.locator(sel).screenshot(); const w = (await p.locator(sel).boundingBox()).width; const m0 = await p.evaluate(() => d1.measureRows());
  await p.evaluate((a) => d1.tags({ ...a.MIX, Apple: "점검 차례" }), { MIX }); await p.waitForTimeout(200); const m1 = await p.evaluate(() => d1.measureRows());
  log(`06b-worst-${W}`, m0.map((r, i) => ({ name: r.name, leftW: r.leftW, rowH: [r.rowH, m1[i].rowH], leftH: [r.leftH, m1[i].leftH], tag: m1[i].tag })));
  await compose(`06b-rows-worst-${W}`, `행 최악 대입 (${W}px) — 삼성전자·TIGER 금액 8~9자리, Apple·TIGER·SK하이닉스 오늘 등락 칩 없음`, [{ cap: "지금", buf: b0, w }, { cap: "표시 뒤", buf: await p.locator(sel).screenshot(), w }], 2); await p.context().close();
}
// ⑦ 미정 기기 — 변화는 타일 1개뿐
if (want("07-undecided")) { const p = await stocks(390, 844); await top(p); const b0 = await p.screenshot();
  await p.evaluate(() => d1.tile(d1.V.first(6))); await p.waitForTimeout(200); const b1 = await p.screenshot(); await shot(p, "07a-undecided-new-390", "FULL");
  await compose("07-undecided-compare-390", "미정 기기(이름표 0개) 상세·주식 — 달라지는 것은 타일 1개(11~12월 기준 높이 +0)", [{ cap: "지금(preview 5.126)", buf: b0, w: 390 }, { cap: "새 화면 — 행·펼침·종목 한 장·홈 변화 없음", buf: b1, w: 390 }], 2);
  const q = await stocks(390, 844); await q.evaluate(() => document.querySelector('[data-testid="stock-tool-tax"]').remove()); await top(q); const c0 = await q.screenshot(); await q.evaluate(() => { const g = document.querySelector('[data-testid="stock-tools"]'); }); 
  const r = await stocks(390, 844); await r.evaluate(() => d1.tile(d1.V.first(6), { noTax: true })); await top(r); const c1 = await r.screenshot();
  await compose("07b-undecided-compare-notax-390", "미정 기기 · 세금 타일이 없는 달(1~10월) — 타일 줄이 1줄 늘어 목록이 아래로 내려간다", [{ cap: "지금(세금 타일 제거로 재현)", buf: c0, w: 390 }, { cap: "새 화면", buf: c1, w: 390 }], 2);
  log("07 listTop", { before: await q.evaluate(() => d1.box('[data-testid="detail-list-box-stocks"]')), after: await r.evaluate(() => d1.box('[data-testid="detail-list-box-stocks"]')) });
  await p.context().close(); await q.context().close(); await r.context().close(); }
await br.close();
