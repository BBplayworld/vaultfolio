import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const b = await chromium.launch();
for (const w of [480, 496, 500, 520, 560, 768, 1024]) {
  const c = await b.newContext({ viewport: { width: w, height: 900 } });
  const p = await c.newPage();
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1000);
  await p.goto(U + "/?demo=1"); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const line = document.querySelector('[data-testid="home-cause-line"]');
    const mk = document.querySelector('[data-testid="home-cause-market"]');
    if (!line) return null;
    const trunc = [...line.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.slice(0, 30));
    const lr = line.getBoundingClientRect();
    return { lineW: Math.round(lr.width), h: Math.round(lr.height), mkVis: mk ? getComputedStyle(mk).display !== "none" : null, trunc };
  });
  console.log(w, JSON.stringify(r));
  if (w === 520) await p.screenshot({ path: "cause-520.png", clip: { x: 0, y: 0, width: 520, height: 400 } });
  await c.close();
}
await b.close();
