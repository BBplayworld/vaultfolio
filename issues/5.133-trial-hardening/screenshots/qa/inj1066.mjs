import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/qa/";
const b = await chromium.launch();
for (const v of ["5133", "5131"]) {
  const U = `https://secretasset-git-issue-${v}-bbplayworlds-projects.vercel.app`;
  const c = await b.newContext({ viewport: { width: 1066, height: 800 } });
  const p = await c.newPage();
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(800);
  await p.goto(U + "/?demo=1"); await p.waitForTimeout(7000);
  const box = await p.evaluate(() => { const l = document.querySelector('[data-testid="home-cause-line"]'); l.children[0].textContent = "주식 시세 하락"; l.children[1].textContent = "−1,096만원"; const m = l.querySelector('[data-testid="home-cause-more"]'); if (m) m.textContent = "외 2개"; const r = l.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; });
  await p.screenshot({ path: `${OUT}qa-1066-${v}-cause-inject.png`, clip: { x: Math.max(0, box.x - 16), y: Math.max(0, box.y - 60), width: box.w + 32, height: box.h + 80 } });
  await c.close();
}
await b.close();
