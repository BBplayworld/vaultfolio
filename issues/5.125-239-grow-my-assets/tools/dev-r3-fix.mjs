// ui-review 재설계 3차 수정 확인 — node dev-r3-fix.mjs <출력 폴더> <URL>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
for (const [W, H] of [[1024, 900], [360, 800], [320, 800], [390, 600], [1280, 900]]) {
  const ctx = await b.newContext({ ...ctxOpt(W, "dark"), viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(5000);
  const more = p.locator('[data-testid="grow-more"]'); if (await more.count()) { await more.click(); await p.waitForTimeout(500); }
  const names = await p.locator('[data-testid="grow-row-open"] > span:first-child').evaluateAll((els) => els.map((e) => {
    const r = e.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(e).lineHeight);
    return `${e.innerText}:${Math.round(r.width)}px:${Math.round(r.height / lh)}줄${e.scrollWidth > e.clientWidth ? ":잘림" : ""}`;
  }));
  console.log(`== ${W}x${H} names:`, names.join(" | "));
  await p.locator('[data-testid="grow-list"]').screenshot({ path: `${OUT}/r3-fix-${W}-list.png` });
  if (W === 390 || W === 1280 || W === 320) {
    const btn = p.locator('[data-testid="grow-score-hint"] button');
    await btn.scrollIntoViewIfNeeded(); await p.evaluate(() => window.scrollBy(0, -80)); await p.waitForTimeout(300);
    await btn.click(); await p.waitForTimeout(600);
    const pop = p.locator("[data-radix-popper-content-wrapper] [data-slot='popover-content'], [data-radix-popper-content-wrapper] > div").first();
    const r = await pop.evaluate((e) => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), scroll: e.scrollHeight > e.clientHeight, text: e.innerText.replace(/\n+/g, " / ") }; });
    const trig = await btn.evaluate((e) => Math.round(e.getBoundingClientRect().bottom));
    console.log(`   hint trigger ${trig} pop`, JSON.stringify(r));
    await p.screenshot({ path: `${OUT}/r3-fix-${W}x${H}-score-hint.png` });
  }
  await ctx.close();
}
await b.close();
