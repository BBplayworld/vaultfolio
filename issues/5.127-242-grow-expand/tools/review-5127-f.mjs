import { chromium, proxy, open, toReport } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy });
for (const [W, how, closeHow] of [[390, "tap", "esc"], [390, "tap", "x"], [1280, "click", "x"], [1280, "click", "esc"], [1280, "click", "outside"]]) {
  const { ctx, p } = await open(br, W, "dark"); await toReport(p);
  await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(700); await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  const e = p.locator('[data-testid="grow-value-edit"]'); if (how === "tap") await e.tap(); else await e.click(); await p.waitForTimeout(1500);
  const before = await p.evaluate(() => !!document.querySelector('[role="dialog"]'));
  if (closeHow === "esc") await p.keyboard.press("Escape"); else if (closeHow === "x") { const c = p.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] [data-slot="dialog-close"]').first(); if (how === "tap") await c.tap(); else await c.click(); } else await p.mouse.click(5, 5);
  await p.waitForTimeout(1200);
  console.log(W, how, closeHow, before, JSON.stringify(await p.evaluate(() => ({ dialog: !!document.querySelector('[role="dialog"]'), active: document.activeElement?.dataset?.testid ?? document.activeElement?.tagName, open: document.querySelector('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded"), scrollY: Math.round(scrollY) }))));
  await ctx.close();
}
await br.close();
