import { chromium, proxy, PROD } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = "/home/user/vaultfolio/.memory/issues/_discovery/screenshots/due-repeat";
const br = await chromium.launch({ proxy });
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
await ctx.addInitScript(() => {
  const R = Date; window.__qaOff = window.__qaOff ?? 0;
  class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + window.__qaOff); else super(...a); } static now() { return R.now() + window.__qaOff; } }
  window.Date = D;
});
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
const reqs = []; p.on("request", (r) => { if (["POST", "PUT", "PATCH"].includes(r.method())) reqs.push(r.method() + " " + new URL(r.url()).host + new URL(r.url()).pathname); });
await p.goto(`${PROD}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
const toReport = async () => { await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500); const hub = await p.evaluate(() => (document.body.innerText.match(/점검 차례[^\n]*/g) ?? [])); await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500); return hub; };
const rowSel = (t) => `[data-testid="grow-row"][data-ticker="${t}"]`;
const openRow = async (t) => { if (!(await p.$(`${rowSel(t)} [data-testid="grow-sheet"]`))) { await p.click(`${rowSel(t)} [data-testid="grow-row-toggle"]`); await p.waitForTimeout(700); } };
const state = (t) => p.evaluate(([sel, t]) => { const r = document.querySelector(sel); const q = (s) => r?.querySelector(`[data-testid="${s}"]`); const L = JSON.parse(localStorage.getItem("secretasset.stock_labels") ?? "{}"); const rv = (L.reviews ?? []).filter((x) => x.t === t);
  return { label: r?.dataset.label, due: r?.dataset.due, rate: q("grow-row-rate")?.dataset.rate, rowDue: q("grow-row-due")?.textContent ?? null, since: q("grow-row-since")?.textContent ?? null, reason: q("grow-sheet-reason")?.textContent ?? null, same: q("grow-choice-same")?.textContent ?? null, sameDisabled: q("grow-choice-same")?.getAttribute("aria-disabled") ?? null, next: q("grow-choice-next")?.textContent ?? null, history: q("grow-history")?.querySelector("p")?.textContent ?? null, historyRows: [...(r?.querySelectorAll('[data-testid="grow-history-row"]') ?? [])].map((e) => e.textContent), summaryCheck: document.querySelector('[data-testid="grow-summary-check"]')?.textContent ?? null, summaryKeep: document.querySelector('[data-testid="grow-summary-keep"]')?.textContent ?? null, kindTail: (document.querySelector('[data-testid="grow-block"]')?.innerText.match(/점검 차례/g) ?? []).length, pick: document.querySelector('[data-testid="grow-pick"]')?.textContent ?? null, item: L.items?.[t], cycle: L.cycle, nReviews: rv.length, nHit: rv.filter((x) => x.hit === "up" || x.hit === "down").length, reviews: rv.map((x) => `${x.at.slice(0, 16)} ${x.from}->${x.choice} hit=${x.hit ?? "-"}`) }; }, [rowSel(t), t]);
const shot = async (t, name) => { await p.locator(rowSel(t)).scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${name}-390.png` }); };
const log = {};
const setDay = async (d) => { await p.evaluate((ms) => { window.__qaOff = ms; }, d * 86400000); return toReport(); };

log.d0_hub = await toReport();
log.today = await p.evaluate(() => new Date().toISOString());
await openRow("AAPL"); log.d0_before = await state("AAPL"); await shot("AAPL", "01-d0-before");
await p.click(`${rowSel("AAPL")} [data-testid="grow-choice-same"]`); await p.waitForTimeout(1000);
log.d0_afterSame = await state("AAPL"); await shot("AAPL", "02-d0-after-same");
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/03-d0-after-same-top-390.png` });
// 같은 날 다시 눌러보기(막혀야 함)
await p.click(`${rowSel("AAPL")} [data-testid="grow-choice-same"]`).catch(() => {}); await p.waitForTimeout(600); log.d0_secondClick = (await state("AAPL")).nReviews;
// 000660 바꾸기(장기 보유로)
await openRow("000660"); log.d0_660_before = await state("000660"); await shot("000660", "04-d0-660-before");
await p.click(`${rowSel("000660")} [data-testid="grow-choice-keep"]`); await p.waitForTimeout(1000);
log.d0_660_afterKeep = await state("000660"); await shot("000660", "05-d0-660-after-keep");
log.d0_hubAfter = await toReport(); await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/06-d0-hub-after-390.png` });
for (const d of [1, 2]) {
  log[`d${d}_hub`] = await setDay(d); log[`d${d}_today`] = await p.evaluate(() => new Date().toISOString());
  await openRow("AAPL"); log[`d${d}_before`] = await state("AAPL"); await shot("AAPL", `0${5 + d * 2}-d${d}-before`);
  await p.click(`${rowSel("AAPL")} [data-testid="grow-choice-same"]`); await p.waitForTimeout(1000);
  log[`d${d}_afterSame`] = await state("AAPL"); await shot("AAPL", `0${6 + d * 2}-d${d}-after-same`);
}
// 35일 뒤 — 내 선택 패널
log.d37_hub = await setDay(37); await openRow("AAPL"); log.d37 = await state("AAPL");
const tg = await p.$('[data-testid="grow-pick-toggle"]'); if (tg) { await tg.click(); await p.waitForTimeout(800); log.d37_pickPanel = await p.evaluate(() => document.querySelector('[data-testid="grow-pick-panel"]')?.innerText ?? null); await p.locator('[data-testid="grow-pick-panel"]').scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/11-d37-pick-panel-390.png` }); }
log.errs = errs; log.writes = [...new Set(reqs)];
console.log(JSON.stringify(log, null, 1)); await br.close();
