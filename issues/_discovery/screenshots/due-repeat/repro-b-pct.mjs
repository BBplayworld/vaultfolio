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


const T = "000660"; const slim = (o) => { const { item, cycle, summaryKeep, ...r } = o; return r; };
log.d0_hub = await toReport(); log.today = await p.evaluate(() => new Date().toISOString());
await openRow(T); log.d0_before = slim(await state(T)); await shot(T, "21-d0-pct-before");
await p.click(`${rowSel(T)} [data-testid="grow-choice-same"]`); await p.waitForTimeout(1000);
log.d0_afterSame = slim(await state(T)); await shot(T, "22-d0-pct-after-same");
await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/23-d0-pct-after-same-card-390.png` });
await p.click(`${rowSel(T)} [data-testid="grow-choice-same"]`).catch(() => {}); await p.waitForTimeout(600); log.d0_secondClick = (await state(T)).nReviews;
log.d0_hubAfter = await toReport(); await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/24-d0-pct-hub-after-390.png` });
for (const d of [1, 2, 3]) {
  log[`d${d}_hub`] = await setDay(d); log[`d${d}_today`] = await p.evaluate(() => new Date().toISOString());
  await openRow(T); log[`d${d}_before`] = slim(await state(T)); if (d === 1) await shot(T, "25-d1-pct-before");
  await p.click(`${rowSel(T)} [data-testid="grow-choice-same"]`); await p.waitForTimeout(1000);
  log[`d${d}_afterSame`] = slim(await state(T)); if (d !== 2) await shot(T, `2${d === 1 ? 6 : 7}-d${d}-pct-after-same`);
}
log.d40_hub = await setDay(40); await openRow(T); log.d40 = slim(await state(T));
const tg = await p.$('[data-testid="grow-pick-toggle"]'); if (tg) { await tg.click(); await p.waitForTimeout(800); log.d40_pickPanel = await p.evaluate(() => document.querySelector('[data-testid="grow-pick-panel"]')?.innerText ?? null); log.d40_hitN = await p.evaluate(() => document.querySelector('[data-testid="grow-pick-hit"]')?.textContent ?? null); await p.locator('[data-testid="grow-pick-panel"]').scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/28-d40-pct-pick-panel-390.png` }); }
log.errs = errs; log.writes = [...new Set(reqs)];
console.log(JSON.stringify(log, null, 1)); await br.close();
