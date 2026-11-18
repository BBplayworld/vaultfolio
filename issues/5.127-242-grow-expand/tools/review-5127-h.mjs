import { chromium, proxy, open, toReport } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy });
for (const W of [320, 360, 375, 390]) { const { ctx, p } = await open(br, W, "dark"); await toReport(p);
  await p.click('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  console.log(W, JSON.stringify(await p.evaluate(() => ({ hist: [...document.querySelectorAll('[data-testid="grow-history-row"]')].map((r) => [...r.children].map((c) => [c.textContent.slice(0, 14), c.clientWidth, c.scrollWidth])), btn: [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] button[data-testid^="grow-choice-"]')].map((e) => { const r = document.createRange(); r.selectNodeContents(e); return [Math.round(e.getBoundingClientRect().width), Math.round(r.getBoundingClientRect().width)]; }) }))));
  await ctx.close(); }
await br.close();
