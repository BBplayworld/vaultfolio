import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/qa/";
const b = await chromium.launch();
for (const w of [1100, 520, 1150]) {
  const m = w < 769;
  const c = await b.newContext({ viewport: { width: w, height: 800 }, hasTouch: m, isMobile: m });
  const p = await c.newPage();
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(800);
  await p.goto(U + "/?demo=1"); await p.waitForTimeout(7000);
  const line = await p.evaluate(() => { const l = document.querySelector('[data-testid="home-cause-line"]'); return { t: l.innerText.replace(/\s+/g, " "), aria: l.getAttribute("aria-label") }; });
  await p.screenshot({ path: `${OUT}qa2-${w}-dark-home.png`, clip: { x: 0, y: 0, width: w, height: 320 } });
  await p.locator('[data-testid="home-cause-line"]').click(); await p.waitForTimeout(800);
  const panel = await p.evaluate(() => document.querySelector('[data-testid="home-cause-panel"]').innerText.replace(/\n+/g, " | "));
  console.log(w, JSON.stringify(line), "패널:", panel);
  await c.close();
}
await b.close();
