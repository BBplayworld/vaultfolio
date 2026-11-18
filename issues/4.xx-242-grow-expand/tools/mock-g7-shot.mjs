// #242 자산 불리기 확장 — 시각 목업 캡처(ui-designer, 2026-11-18). 코드 수정 0.
// 운영 체험 화면(https://www.secretasset.xyz/?trial=1, v5.125 main 712d283)에 mock-g7-lib.js 를 넣고 장면별로 DOM을 덧붙여 찍는다. 다크, deviceScaleFactor 2.
// node mock-g7-shot.mjs <OUT> [장면 이름 일부]
import { readFileSync } from "node:fs";
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PROD = "https://www.secretasset.xyz"; const OUT = process.argv[2]; const ONLY = process.argv[3];
const lib = readFileSync(new URL("./mock-g7-lib.js", import.meta.url), "utf8");
const SEG = "내 자산 점검"; // 칸 이름 추천안(B). 3안 비교는 mock-g7-name.mjs
const K3 = (stock, coin, re) => [{ name: "주식", due: stock }, { name: "코인", due: coin }, { name: "부동산·실물", due: re }];
const due = (n, unit = "개") => `점검 차례 <span class="tabular-nums">${n}${unit}</span>`;
const b = (t) => `<b class="font-bold">${t}</b>`;
const S_NORMAL = `6번 중 ${b("5번")}은 그때보다 오름`;
const P_DEMO = { rows: [{ label: "정함", n: 3, up: 3 }, { label: "그대로 두기", n: 2, up: 2 }, { label: "옮기기", n: 1, up: 0 }], buy: { n: 5, up: 5 } };
const P_FULL = { rows: [{ label: "정함", n: 4, up: 3 }, { label: "그대로 두기", n: 5, up: 3 }, { label: "옮기기", n: 2, up: 2 }], sub: `그중 조건에 닿아 점검 <b>3번</b> · 오름 <b>2번</b>`, buy: { n: 12, up: 9 } };
const RE_ROWS = (open) => [{ k: "keep", rows: [{ key: "r:demo_re_1", name: "데모 아파트", rate: 7.2, bar: false, meta: ["3년", "내가 넣은 시세 기준"], due: true, open }] }, { k: "none", rows: [{ key: "p:ex1", name: "골드바 100g", rate: 38.2, bar: false, meta: ["3년 1개월", "내가 넣은 평가액 기준"] }, { key: "p:ex2", name: "손목시계", rate: null, bar: false, meta: ["2년 4개월", "매입가를 넣으면 보여요"] }] }];

// 장면: [파일 이름, 폭, 높이, 준비(page) → 캡처 대상 선택자|null, 페이지 안에서 실행할 함수, 인자]
const scenes = [
  ["01-stock-normal-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s); }, { k: K3(true, false, true), s: S_NORMAL }],
  ["02-stock-loss-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due3); g7.kinds(a.k, "주식");
      g7.rows({ "360750": { rate: -16.4, since: ["정한 날 대비", -12.4] }, "005930": { rate: -4.9, since: ["정한 날 대비", -8.2] }, "000660": { rate: 6.7, since: ["정한 날 대비", -3.5], due: false }, AAPL: { rate: -2.7, since: ["점검일 대비", -6.1] }, "069500": { rate: -1.5 }, NVDA: { rate: 4.1 } });
      g7.card({ total: "-50만원", rate: -4.1, keep: `2종목 수익률 <b class="font-bold g7-down">-8.6%</b><span aria-hidden="true" class="text-muted-foreground"> · </span><b class="font-bold">모두</b> 평단보다 낮음`, check: `2종목 중 <b class="font-bold">1종목</b> 점검 차례` }); g7.pick(a.s); }, { k: K3(true, false, true), s: `6번 중 ${b("1번")}은 그때보다 오름` }],
  ["02b-stock-loss-panel-390", 390, 844, '[data-testid="grow-total-card"]', (a) => { g7.seg(a.SEG, a.due3); g7.kinds(a.k, "주식");
      g7.card({ total: "-50만원", rate: -4.1, keep: `2종목 수익률 <b class="font-bold g7-down">-8.6%</b><span aria-hidden="true" class="text-muted-foreground"> · </span><b class="font-bold">모두</b> 평단보다 낮음`, check: `2종목 중 <b class="font-bold">1종목</b> 점검 차례` }); g7.pick(a.s, { open: true }); g7.panel(a.p); },
    { k: K3(true, false, true), s: `6번 중 ${b("1번")}은 그때보다 오름`, p: { rows: [{ label: "정함", n: 3, up: 0 }, { label: "그대로 두기", n: 2, up: 1 }, { label: "옮기기", n: 1, up: 0 }], buy: { n: 5, up: 1 } } }],
  ["03-stock-mixed-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.rows({ "360750": { rate: -16.4, since: ["정한 날 대비", -12.4] }, NVDA: { rate: -8.2 } });
      g7.card({ total: "+137만원", rate: 11.4, keep: `2종목 수익률 <b class="font-bold text-rose-600 dark:text-rose-400">+4.7%</b><span aria-hidden="true" class="text-muted-foreground"> · </span><b class="font-bold">1종목</b> 평단보다 낮음` }); g7.pick(a.s); }, { k: K3(true, false, true), s: `6번 중 ${b("4번")}은 그때보다 오름` }],
  ["04-first-user-390", 390, 844, null, (a) => { g7.seg(a.SEG, `<span class="tabular-nums">8개</span> · 정하기 전`); g7.kinds(a.k, "주식"); g7.first(); }, { k: K3(false, false, false) }],
  ["05-sparse-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s); }, { k: K3(true, false, true), s: `측정 중 · 기록 2번` }],
  ["05b-sparse-panel-390", 390, 844, '[data-testid="grow-total-card"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s, { open: true }); g7.panel({ rows: [], buy: { n: 2, up: 1 } }); }, { k: K3(true, false, true), s: `측정 중 · 기록 2번` }],
  ["06-stock-320", 320, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s); }, { k: K3(true, true, true), s: S_NORMAL }],
  ["06b-panel-320", 320, 844, '[data-testid="grow-total-card"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s, { open: true }); g7.panel(a.p); }, { k: K3(true, true, true), s: `11번 중 ${b("8번")}은 그때보다 오름`, p: { ...P_FULL, rows: [{ label: "정함", n: 4, up: 3 }, { label: "그대로 두기", n: 12, up: 8 }, { label: "옮기기", n: 2, up: 2 }], buy: { n: 12, up: 9 } } }],
  ["06c-buy-sentence-320", 320, 844, '[data-testid="grow-total-card"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s); }, { k: K3(true, true, true), s: `매수 12건 중 ${b("9건")}은 매수가보다 오름` }],
  ["07-realestate-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "부동산·실물"); g7.$('[data-testid="grow-total-card"]').remove(); g7.list({ title: "내 부동산·실물", cap: "매입가 대비", caption: null, buckets: a.re }); }, { k: K3(true, false, true), re: RE_ROWS(false) }],
  ["07b-realestate-sheet-390", 390, 844, "FULL", (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "부동산·실물"); g7.$('[data-testid="grow-total-card"]').remove(); g7.list({ title: "내 부동산·실물", cap: "매입가 대비", caption: null, buckets: a.re });
      g7.reSheet(a.sheet, { name: "데모 아파트", reason: "점검 차례 · 장기 보유로 정한 지 12개월이 지났어요", label: "내가 넣은 시세", value: "5억 3,584만원", edit: "시세 고치기", est: ["5억 2,900만원", "2026-09-14"], plan: "12개월 · 메모", history: [] }); }, { k: K3(true, false, true), re: RE_ROWS(true), needSheet: true }],
  ["07c-realestate-only-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due1); g7.$('[data-testid="grow-total-card"]').remove(); g7.list({ title: "내 부동산·실물", cap: "매입가 대비", caption: null, buckets: a.re });
      g7.reSheet(a.sheet, { name: "데모 아파트", reason: "점검 차례 · 정한 기간 6개월이 지났어요", label: "내가 넣은 시세", value: "5억 3,584만원", edit: "시세 고치기", est: null, plan: "6개월 · 메모", keepWarn: true, history: [["5월 16일", "그대로 두기"]] }); }, { re: [{ k: "check", rows: [{ key: "r:demo_re_1", name: "데모 아파트", rate: 7.2, bar: false, meta: ["3년", "내가 넣은 시세 기준"], due: true, open: true }] }], needSheet: "AAPL" }],
  ["08-coin-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "코인"); g7.card({ label: "평단 대비 수익 · 내 코인 1종목", total: "+100만원", rate: 16.7, keep: `<span class="text-muted-foreground">아직 없어요</span>`, check: "1종목 · 점검 차례 없음", noDividend: true, noAxes: true }); g7.pick(a.s);
      g7.list({ title: "내 코인", cap: "평단 대비 수익률", buckets: [{ k: "check", rows: [{ key: "c:BTC", name: "비트코인", rate: 16.7, meta: ["1년", "5점", `정한 날 대비 <b class="font-semibold text-foreground">+6.1%</b>`] }] }] }); }, { k: K3(true, false, true), s: "측정 중 · 기록 1번" }],
  ["09-panel-open-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s, { open: true }); g7.panel(a.p); }, { k: K3(true, false, true), s: S_NORMAL, p: P_DEMO }],
  ["09b-panel-full-390", 390, 844, '[data-testid="grow-total-card"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s, { open: true }); g7.panel(a.p); }, { k: K3(true, false, true), s: `11번 중 ${b("8번")}은 그때보다 오름`, p: { ...P_FULL, pressed: "그대로 두기", fact: `그대로 두기 기록이 있는 1종목 · 지금 가진 종목만 보여요` } }],
  ["09c-panel-words-alt-390", 390, 844, '[data-testid="grow-total-card"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s, { open: true }); g7.panel(a.p); }, { k: K3(true, false, true), s: `11번 중 ${b("8번")}은 그때보다 오름`, p: { ...P_FULL, head: "선택한 날 가격보다 오른 횟수", sub: `위 두 가지 중 내 조건에 닿아 점검 <b>3번</b> · 오름 <b>2번</b>` } }],
  ["11-history-390", 390, 844, '[data-testid="grow-row"][data-ticker="AAPL"]', (a) => { g7.history([["지금까지", 9.8], ["다음 점검까지", 5.1]]); }, { open: "AAPL" }],
  ["12-stock-1280", 1280, 900, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식"); g7.pick(a.s, { open: true }); g7.panel(a.p); }, { k: K3(true, false, true), s: S_NORMAL, p: P_DEMO }],
  ["10a-stock-only-5125-390", 390, 844, null, () => {}, {}],
  ["10b-stock-only-new-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due3j); g7.pick(a.s); }, { s: S_NORMAL }],
  ["10c-stock-only-new-first-390", 390, 844, null, (a) => { g7.seg(a.SEG, `<span class="tabular-nums">6종목</span> · 정하기 전`); g7.first(); }, {}],
  ["kind-alt-2line-390", 390, 844, null, (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "주식", true); g7.pick(a.s); }, { k: [{ name: "주식", due: "점검 차례 3종목" }, { name: "코인" }, { name: "부동산·실물", due: "점검 차례 1개" }], s: S_NORMAL }],
  ["kind-worst-390", 390, 844, '[data-testid="grow-kinds"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "부동산·실물"); }, { k: K3(true, true, true) }],
  ["kind-worst-375", 375, 812, '[data-testid="grow-kinds"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "부동산·실물"); }, { k: K3(true, true, true) }],
  ["kind-worst-320", 320, 844, '[data-testid="grow-kinds"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "부동산·실물"); }, { k: K3(true, true, true) }],
  ["kind-worst-360", 360, 800, '[data-testid="grow-kinds"]', (a) => { g7.seg(a.SEG, a.due4); g7.kinds(a.k, "부동산·실물"); }, { k: K3(true, true, true) }],
];
const br = await chromium.launch({ proxy });
let sheetHtml = null;
for (const [name, W, H, sel, fn, arg] of scenes) {
  if (ONLY && !name.includes(ONLY)) continue;
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto(`${PROD}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500);
  if (arg.needSheet) { // 운영 한 장(장기 보유 행 TIGER 또는 점검 대상 행 Apple)의 실제 DOM을 떠 온다
    const tk = arg.needSheet === true ? "360750" : arg.needSheet; const tg = p.locator(`[data-testid="grow-row"][data-ticker="${tk}"] [data-testid="grow-row-toggle"]`); await tg.click(); await p.waitForTimeout(700);
    sheetHtml = await p.locator(`[data-testid="grow-row"][data-ticker="${tk}"] [data-testid="grow-sheet"]`).evaluate((e) => e.outerHTML); await tg.click(); await p.waitForTimeout(400); }
  if (arg.open) { await p.locator(`[data-testid="grow-row"][data-ticker="${arg.open}"] [data-testid="grow-row-toggle"]`).click(); await p.waitForTimeout(700); }
  await p.addScriptTag({ content: lib });
  const a = { ...arg, SEG, sheet: sheetHtml, due4: due(4), due3: due(3), due1: due(1), due3j: due(3, "종목") };
  await p.evaluate(`(${fn.toString()})(${JSON.stringify(a)})`);
  await p.evaluate(() => { scrollTo(0, 0); document.querySelectorAll("*").forEach((e) => { if (e.scrollTop) e.scrollTop = 0; }); }); await p.waitForTimeout(400);
  console.log(name, JSON.stringify(await p.evaluate(() => g7.measure())));
  const path = `${OUT}/g7-${name}.png`;
  if (sel === "FULL") await p.screenshot({ path, fullPage: true }); else if (sel) await p.locator(sel).first().screenshot({ path }); else await p.screenshot({ path });
  await ctx.close();
}
await br.close();
