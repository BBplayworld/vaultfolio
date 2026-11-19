// #242 v5.127 COO 되돌림 확인(developer, C140) — 오늘 날짜로 직접 `그대로 두기` 기록을 만들어 이력 줄 날짜 ↔ 낱말 간격 실측. node dev-5127-date.mjs <OUT>
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5127-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
for (const W of [320, 360, 390, 1280]) {
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 }); const p = await ctx.newPage();
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500);
  const row = '[data-testid="grow-row"][data-ticker="AAPL"]';
  await p.click(`${row} [data-testid="grow-row-toggle"]`); await p.waitForTimeout(600);
  await p.click(`${row} [data-testid="grow-choice-same"]`); await p.waitForTimeout(900); // 오늘 날짜 기록 생성
  out[W] = await p.evaluate((sel) => ({ built: !!document.querySelector('[data-testid="grow-history-date"]'), docW: document.documentElement.scrollWidth, rows: [...document.querySelectorAll(`${sel} [data-testid="grow-history-row"]`)].map((e) => { const d = e.querySelector('[data-testid="grow-history-date"]'); const c = e.querySelector('[data-testid="grow-history-choice"]'); const a = e.querySelector('[data-testid="grow-history-after"]'); const r = (x) => x.getBoundingClientRect(); const tw = (x) => { const g = document.createRange(); g.selectNodeContents(x); return Math.round(g.getBoundingClientRect().width * 10) / 10; }; return d ? { text: e.textContent, dateBox: Math.round(r(d).width), dateText: tw(d), gap: Math.round((r(c).left - (r(d).left + Math.max(tw(d), 0))) * 10) / 10, boxGap: Math.round(r(c).left - r(d).right), h: Math.round(r(e).height), afterLine: a ? Math.round(r(a).top - r(c).top) : null, choiceOk: c.scrollWidth <= c.clientWidth + 1 } : null; }) }), row);
  await p.locator(row).screenshot({ path: `${OUT}/d7-date-history-${W}.png` });
  await ctx.close();
}
console.log(JSON.stringify(out)); await br.close();
