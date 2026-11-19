// #242 v5.127 수정 라운드 자체 확인(developer) — R-1 이력 줄(320·360·375), R-6, R-2 포커스, R-3 1280, D2 실시세 데모 코인. node dev-5127-fix.mjs <OUT>
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5127-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
const open = async (W, q) => { const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 }); const p = await ctx.newPage();
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500); return { ctx, p }; };
for (const W of [320, 360, 375]) {
  const { ctx, p } = await open(W, "trial=1");
  await p.click('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  out[`hist${W}`] = await p.evaluate(() => ({ built: !!document.querySelector('[data-testid="grow-history-choice"]'), rows: [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-history-row"]')].map((e) => { const c = e.querySelector('[data-testid="grow-history-choice"]'); const a = e.querySelector('[data-testid="grow-history-after"]'); return c ? [e.textContent, Math.round(e.getBoundingClientRect().height), c.scrollWidth <= c.clientWidth + 1, Math.round(a.getBoundingClientRect().top - c.getBoundingClientRect().top), Math.round(e.getBoundingClientRect().right - a.getBoundingClientRect().right)] : null; }), foot: [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-sheet"] > div:last-child span.whitespace-nowrap')].map((e) => [e.textContent, Math.round(e.getBoundingClientRect().top)]), docW: document.documentElement.scrollWidth }));
  await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').screenshot({ path: `${OUT}/d7-fix-history-${W}.png` });
  if (W === 375) { // R-6 차례 아닌 코인 한 장, R-2 포커스
    await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(600); await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(600);
    out.coinTrial = await p.evaluate(() => ({ reason: document.querySelector('[data-testid="grow-sheet-reason"]')?.textContent, next: document.querySelector('[data-testid="grow-choice-next"]')?.textContent ?? null }));
    await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(600); await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(600);
    out.focus = {};
    for (const how of ["x", "outside", "esc"]) { await p.click('[data-testid="grow-value-edit"]'); await p.waitForSelector('[role="dialog"]'); await p.waitForTimeout(600);
      if (how === "x") await p.locator('[role="dialog"] button:has(svg.lucide-x), [role="dialog"] [data-slot="dialog-close"]').first().click(); else if (how === "outside") await p.mouse.click(5, 5); else await p.keyboard.press("Escape");
      await p.waitForTimeout(900); out.focus[how] = await p.evaluate(() => [!!document.querySelector('[role="dialog"]'), document.activeElement?.dataset?.testid ?? document.activeElement?.tagName, document.querySelector('[data-testid="grow-row-toggle"]')?.getAttribute("aria-expanded")]); }
  }
  await ctx.close();
}
{ const { ctx, p } = await open(1280, "trial=1"); await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(600);
  out.own1280 = await p.evaluate(() => { const b = document.querySelector('[data-testid="grow-list"]').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.width)]; });
  await p.click('[data-testid="grow-kind"][data-kind="stock"]'); await p.waitForTimeout(600);
  out.stock1280 = await p.evaluate(() => { const b = document.querySelector('[data-testid="grow-list"]').getBoundingClientRect(); return [Math.round(b.left), Math.round(b.width)]; });
  await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(400); await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}/d7-fix-own-1280.png` }); await ctx.close(); }
{ const { ctx, p } = await open(375, "demo=1"); // D2 실시세 데모
  await p.waitForTimeout(6000);
  out.demoSeg = await p.evaluate(() => document.querySelector('[data-testid="report-tab-grow"]')?.textContent);
  await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(800);
  out.demoCoin = await p.evaluate(() => ({ total: document.querySelector('[data-testid="grow-total"]')?.textContent, check: document.querySelector('[data-testid="grow-summary-check"]')?.textContent, row: document.querySelector('[data-testid="grow-row"]')?.textContent, pick: document.querySelector('[data-testid="grow-pick"]')?.textContent }));
  await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  out.demoCoin.reason = await p.evaluate(() => document.querySelector('[data-testid="grow-sheet-reason"]')?.textContent);
  await p.screenshot({ path: `${OUT}/d7-fix-demo-coin-375.png`, fullPage: true });
  await p.evaluate(() => { location.hash = "#home"; }); await p.waitForTimeout(3000); out.demoHome = await p.evaluate(() => document.body.innerText.match(/기록 안 된 변화[^\n]*/g)); await ctx.close(); }
console.log(JSON.stringify(out)); await br.close();
