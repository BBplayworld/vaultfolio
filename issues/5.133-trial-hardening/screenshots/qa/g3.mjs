import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/qa/";
const b = await chromium.launch();
async function ctx(w = 390, h = 844) {
  const m = w < 769;
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: m, isMobile: m });
  await c.addCookies([{ name: "theme_mode", value: "dark", url: U }]);
  const p = await c.newPage(); p.__ga = 0; p.__post = []; p.__err = [];
  p.on("request", (r) => { if (/google-analytics|googletagmanager/.test(r.url())) p.__ga++; if (r.method() !== "GET" && /\/api\//.test(r.url())) p.__post.push(r.method() + " " + r.url()); });
  p.on("pageerror", (e) => p.__err.push(e.message.slice(0, 100)));
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1200);
  return p;
}
async function swipe(p, dir, y) {
  const s = await p.context().newCDPSession(p);
  const x0 = dir < 0 ? 320 : 70, x1 = dir < 0 ? 70 : 320;
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 5; i++) { await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 5, y }] }); await p.waitForTimeout(20); }
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(1300);
}
const st = (p) => p.evaluate(() => ({ url: location.pathname + location.search + location.hash, settings: [...document.querySelectorAll("p")].some((e) => e.textContent === "화면"), moreRow: !!document.querySelector('[data-testid="more-row-settings"]'), banner: document.querySelectorAll('[data-testid="trial-banner"]').length, bannerVis: (() => { const e = document.querySelector('[data-testid="trial-banner"]'); if (!e) return null; const r = e.getBoundingClientRect(); return r.height > 0 && r.top < 200; })(), tag: document.querySelectorAll('[data-testid="trial-tag"]').length, ver: (document.body.innerText.match(/PREVIEW · v[\d.]+/) || [])[0] }));
const L = async (p, t) => console.log(t, JSON.stringify(await st(p)));
// 체험
let p = await ctx();
await p.goto(U + "/?trial=1"); await p.waitForTimeout(6000);
await L(p, "T0");
await swipe(p, -1, 300); await L(p, "T1 ←");
await swipe(p, -1, 300); await L(p, "T2 ←");
await swipe(p, -1, 300); await L(p, "T3 성과 ←");
await p.screenshot({ path: OUT + "g3-390-trial-activity.png" });
await p.evaluate(() => window.scrollTo(0, 1500)); await p.waitForTimeout(500); await L(p, "T3s 스크롤 후 배너");
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500); await L(p, "T4 #settings");
await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(1500); await L(p, "T5 #more");
await p.evaluate(() => { history.pushState(null, "", "#settings"); history.pushState(null, "", "#detail"); history.back(); }); await p.waitForTimeout(1500); await L(p, "T6 popstate");
console.log("  T ga", p.__ga, "post", JSON.stringify(p.__post), "err", JSON.stringify(p.__err));
p = await ctx(); await p.goto(U + "/?trial=1#settings"); await p.waitForTimeout(6000); await L(p, "TF 첫로드 #settings");
await p.screenshot({ path: OUT + "g3-390-trial-firstload.png" });
// 비체험
p = await ctx(); await p.goto(U + "/?demo=1"); await p.waitForTimeout(6000);
await L(p, "N0");
for (const t of ["N1", "N2", "N3(#more)"]) { await swipe(p, -1, 150); await L(p, t); }
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500); await L(p, "N4 #settings");
console.log("  N ga", p.__ga, "post", JSON.stringify(p.__post), "err", JSON.stringify(p.__err));
// 원인 줄
for (const w of [520, 1100, 1160, 1280]) {
  p = await ctx(w, 900); await p.goto(U + "/?demo=1"); await p.waitForTimeout(7000);
  const r = await p.evaluate(() => { const l = document.querySelector('[data-testid="home-cause-line"]'); const m = l?.querySelector('[data-testid="home-cause-market"]'); const lab = l?.children[0]; return { t: l?.innerText.replace(/\s+/g, " "), W: l && Math.round(l.getBoundingClientRect().width), mk: m ? getComputedStyle(m).display !== "none" : null, trunc: lab ? lab.scrollWidth > lab.clientWidth + 1 : null, idx: document.querySelector('[data-testid="home-market-today"]')?.getAttribute("aria-label"), x: document.documentElement.scrollWidth > innerWidth }; });
  console.log("C", w, JSON.stringify(r), "err", p.__err.length);
  if (w === 1160 || w === 1280) await p.screenshot({ path: `${OUT}g3-${w}-dark-home.png`, clip: { x: 0, y: 0, width: w, height: 320 } });
}
// 체험 + 원인 줄(1280) 배너 공존
p = await ctx(1280, 900); await p.goto(U + "/?trial=1"); await p.waitForTimeout(7000);
await L(p, "T1280");
console.log("  T1280 cause", await p.evaluate(() => document.querySelector('[data-testid="home-cause-line"]')?.innerText.replace(/\s+/g, " ")));
await p.screenshot({ path: OUT + "g3-1280-trial-home.png", clip: { x: 0, y: 0, width: 1280, height: 360 } });
await b.close();
