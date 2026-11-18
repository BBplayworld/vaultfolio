// #242 v5.127 development 자체 점검(developer) — preview 체험 화면의 핵심 경로 1회 + 실측(spec 16절). node dev-5127-shot.mjs <OUT>
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5127-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy });
const out = {};
const lines = (p, sel) => p.evaluate((s) => { const el = document.querySelector(s); if (!el) return null; const m = new Map(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const re = /\S+/g; let x; while ((x = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, x.index); r.setEnd(n, x.index + x[0].length); const b = r.getBoundingClientRect(); if (!b.width) continue; const k = Math.round(b.top / 6); m.set(k, [...(m.get(k) ?? []), x[0]]); } } return [...m.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1].join(" ")); }, sel);
const box = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom), Math.round(b.width), Math.round(b.height)]; }, sel);
for (const [W, scheme] of [[390, "dark"], [320, "dark"], [390, "light"], [1280, "dark"]]) {
  const tag = `${W}${scheme === "light" ? "-light" : ""}`; const o = (out[tag] = {});
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  if (W === 390 && scheme === "dark") {
    await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500);
    o.hub = { desc: await lines(p, '[data-testid="hub-card-report"]'), box: await box(p, '[data-testid="hub-card-report"]'), div: await box(p, '[data-testid="hub-card-dividend"]') };
    await p.screenshot({ path: `${OUT}/d7-hub-${tag}.png` });
  }
  if (W === 320) {
    await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500);
    o.hub = { desc: await lines(p, '[data-testid="hub-card-report"]'), box: await box(p, '[data-testid="hub-card-report"]'), div: await box(p, '[data-testid="hub-card-dividend"]') };
    await p.screenshot({ path: `${OUT}/d7-hub-${tag}.png` });
  }
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500);
  o.seg = await lines(p, '[data-testid="report-tab-grow"]');
  o.kinds = { text: await lines(p, '[data-testid="grow-kinds"]'), box: await box(p, '[data-testid="grow-kinds"]') };
  o.pick = { text: await lines(p, '[data-testid="grow-pick"]'), state: await p.getAttribute('[data-testid="grow-pick"]', "data-state") };
  o.rows = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().bottom)));
  o.numLines = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-total-card"] dd, [data-testid="grow-total"], [data-testid="grow-total-card"] > div:first-child')].filter((e) => /\d/.test(e.textContent)).length);
  o.docW = await p.evaluate(() => document.documentElement.scrollWidth);
  await p.screenshot({ path: `${OUT}/d7-01-stock-${tag}.png` });
  // 패널 열기
  await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(600);
  o.panel = { head: await lines(p, '[data-testid="grow-pick-panel"] > div'), hit: await lines(p, '[data-testid="grow-pick-hit"]'), late: await lines(p, '[data-testid="grow-pick-late"]'), h: (await box(p, '[data-testid="grow-pick-panel"]'))?.[3],
    rows: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-pick-row"],[data-testid="grow-pick-buy"]')].map((e) => [e.dataset.kind ?? "buy", e.dataset.n, e.dataset.up, e.querySelectorAll('i[data-on]').length, e.querySelectorAll('i[data-on="true"]').length, e.querySelector('[data-testid="grow-pick-tally"]').dataset.dense, e.textContent, Math.round(e.getBoundingClientRect().height)])) };
  await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/d7-09-panel-${tag}.png` });
  // 패널 행 거름
  await p.click('[data-testid="grow-pick-row"][data-kind="same"]'); await p.waitForTimeout(400);
  o.filter = { fact: await lines(p, '[data-testid="grow-filter-fact"]'), rows: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.dataset.ticker)) };
  // 패널 ⓘ 열림(320 줄바꿈 확인)
  if (W === 320) { await p.click('[data-testid="grow-pick-hint"] button'); await p.waitForTimeout(500); o.hint = await p.evaluate(() => [...document.querySelectorAll('[role="dialog"] p, [data-radix-popper-content-wrapper] p')].map((e) => e.textContent.slice(0, 30))); await p.screenshot({ path: `${OUT}/d7-hint-pick-${tag}.png` }); await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
  await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(500);
  o.afterClose = await p.evaluate(() => document.querySelectorAll('[data-testid="grow-row"]').length);
  // 주식 한 장(AAPL) — 이력 줄·다음 점검 줄
  await p.click('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.aapl = { next: await lines(p, '[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-choice-next"]'), hist: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-history-row"]')].map((e) => e.textContent)), btn: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid^="grow-choice-"]')].filter((e) => e.tagName === "BUTTON").map((e) => Math.round(e.getBoundingClientRect().height))) };
  await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').screenshot({ path: `${OUT}/d7-11-history-${tag}.png` });
  // 코인 보기
  await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(700);
  o.coin = { kinds: await lines(p, '[data-testid="grow-kinds"]'), pick: await lines(p, '[data-testid="grow-pick"]'), toggle: await p.locator('[data-testid="grow-pick-toggle"]').count(), row: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.textContent)), total: await p.evaluate(() => document.querySelector('[data-testid="grow-total"]')?.textContent) };
  await p.screenshot({ path: `${OUT}/d7-08-coin-${tag}.png` });
  // 부동산·실물 보기 + 한 장
  await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(700);
  o.own = { kinds: await lines(p, '[data-testid="grow-kinds"]'), card: await p.locator('[data-testid="grow-total-card"]').count(), row: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.textContent)) };
  await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.own.sheet = { reason: await lines(p, '[data-testid="grow-sheet-reason"]'), value: await lines(p, '[data-testid="grow-value"]'), next: await lines(p, '[data-testid="grow-choice-next"]'), btn: await p.evaluate(() => [...document.querySelectorAll('button[data-testid^="grow-choice-"]')].map((e) => [e.textContent, Math.round(e.getBoundingClientRect().height)])), edit: (await box(p, '[data-testid="grow-value-edit"]'))?.[3] };
  await p.screenshot({ path: `${OUT}/d7-07b-own-sheet-${tag}.png`, fullPage: true });
  if (W === 390 && scheme === "dark") { await p.click('[data-testid="grow-value-edit"]'); await p.waitForTimeout(1200); o.own.editDialog = await p.evaluate(() => document.querySelector('[role="dialog"]')?.textContent.slice(0, 60) ?? null); await p.screenshot({ path: `${OUT}/d7-07d-own-edit-${tag}.png` }); }
  o.errs = errs;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await br.close();
