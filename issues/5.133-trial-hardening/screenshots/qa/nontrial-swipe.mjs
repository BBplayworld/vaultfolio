import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = process.argv[2] || "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const p = await c.newPage();
await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1500);
await p.goto(U + "/?demo=1"); await p.waitForTimeout(6000);
await p.screenshot({ path: "n0.png" });
async function swipe(dir, y) {
  const s = await c.newCDPSession(p);
  const x0 = dir < 0 ? 320 : 70, x1 = dir < 0 ? 70 : 320;
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 5; i++) { await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 5, y }] }); await p.waitForTimeout(20); }
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(1300);
}
for (const y of [150, 260, 300, 500, 700]) {
  const tgt = await p.evaluate((y) => { const e = document.elementFromPoint(320, y); return e ? e.tagName + "." + (e.className || "").toString().slice(0, 50) : null; }, y);
  await swipe(-1, y); console.log(y, tgt, await p.evaluate(() => location.hash));
}
await b.close();
