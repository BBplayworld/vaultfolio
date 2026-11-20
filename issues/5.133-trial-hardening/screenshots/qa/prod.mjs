import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://www.secretasset.xyz";
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/qa/";
const b = await chromium.launch();
const tot = { collect: 0, gtm: 0, post: [], err: [] };
async function ctx(w = 390, h = 844) {
  const m = w < 769;
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: m, isMobile: m });
  await c.addCookies([{ name: "theme_mode", value: "dark", url: U }]);
  const p = await c.newPage();
  p.on("request", (r) => { const u = r.url(); if (/\/g\/collect|google-analytics\.com\/.*collect/.test(u)) tot.collect++; if (/googletagmanager/.test(u)) tot.gtm++; if (r.method() !== "GET" && /\/api\//.test(u)) tot.post.push(r.method() + " " + u); });
  p.on("pageerror", (e) => tot.err.push(w + " " + e.message.slice(0, 100)));
  p.on("console", (m) => { if (m.type() === "error") tot.err.push(w + " console " + m.text().slice(0, 100)); });
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1500);
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
const st = (p) => p.evaluate(() => ({ url: location.pathname + location.search + location.hash, settings: [...document.querySelectorAll("p")].some((e) => e.textContent === "화면"), moreRow: !!document.querySelector('[data-testid="more-row-settings"]'), banner: document.querySelectorAll('[data-testid="trial-banner"]').length, tag: document.querySelectorAll('[data-testid="trial-tag"]').length, ver: (document.body.innerText.match(/v5\.\d+/) || [])[0] || null, optout: localStorage.getItem("ga-optout") }));
const L = async (p, t) => console.log(t, JSON.stringify(await st(p)));
console.log("시작", new Date().toISOString());
let p = await ctx();
await p.goto(U + "/"); await p.waitForTimeout(5000);
await L(p, "P0 /");
const ver = await p.evaluate(() => { const m = document.documentElement.innerHTML.match(/5\.1\d\d/g); return m ? [...new Set(m)] : null; });
console.log("  버전 문자열(HTML)", JSON.stringify(ver));
await p.goto(U + "/?trial=1"); await p.waitForTimeout(6000);
await L(p, "T0");
await swipe(p, -1, 300); await L(p, "T1 ←");
await swipe(p, -1, 300); await L(p, "T2 ←");
await swipe(p, -1, 300); await L(p, "T3 성과 ←");
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500); await L(p, "T4 #settings");
await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(1500); await L(p, "T5 #more");
await p.evaluate(() => { history.pushState(null, "", "#settings"); history.pushState(null, "", "#detail"); history.back(); }); await p.waitForTimeout(1500); await L(p, "T6 popstate");
await p.screenshot({ path: OUT + "prod-390-trial-home.png" });
p = await ctx(); await p.goto(U + "/?trial=1#settings"); await p.waitForTimeout(6000); await L(p, "TF 첫로드 #settings");
// 비체험(빈 기기 웰컴): 해시 이동
p = await ctx(); await p.goto(U + "/"); await p.waitForTimeout(4000);
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500); await L(p, "N #settings");
await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(1500); await L(p, "N #more");
// 원인 줄(체험 데모 값)
for (const w of [520, 1100, 1160, 1280]) {
  p = await ctx(w, 900); await p.goto(U + "/?trial=1"); await p.waitForTimeout(7000);
  const r = await p.evaluate(() => { const l = document.querySelector('[data-testid="home-cause-line"]'); const m = l?.querySelector('[data-testid="home-cause-market"]'); const lab = l?.children[0]; return { t: l?.innerText.replace(/\s+/g, " "), W: l && Math.round(l.getBoundingClientRect().width), mk: m ? getComputedStyle(m).display !== "none" : null, trunc: lab ? lab.scrollWidth > lab.clientWidth + 1 : null, aria: l?.getAttribute("aria-label"), x: document.documentElement.scrollWidth > innerWidth, banner: document.querySelectorAll('[data-testid="trial-banner"]').length }; });
  if (r.W) { await p.locator('[data-testid="home-cause-line"]').click(); await p.waitForTimeout(800); r.idx = await p.evaluate(() => document.querySelector('[data-testid="home-market-today"]')?.innerText.replace(/\s+/g, " ")); }
  console.log("C", w, JSON.stringify(r));
  if (w >= 1160) { await p.locator('[data-testid="home-cause-collapse"]').click().catch(() => {}); await p.waitForTimeout(600); await p.screenshot({ path: `${OUT}prod-${w}-trial-home.png`, clip: { x: 0, y: 0, width: w, height: 340 } }); }
}
// 웰컴 복귀 현금 320
p = await ctx(320, 760); await p.goto(U + "/?trial=1"); await p.waitForTimeout(6000);
await p.evaluate(() => { location.hash = "#detail/cash"; }); await p.waitForTimeout(2000);
await p.locator('[data-testid="trial-start-btn"]').first().click(); await p.waitForTimeout(6000);
const desc = p.locator("text=/방금 본 화면이 내/").first();
if (await desc.count()) {
  const lines = await desc.evaluate((el) => { const out = {}; for (const n of [...el.childNodes].filter((n) => n.nodeType === 3)) for (let i = 0; i < n.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const t = Math.round(r.getBoundingClientRect().top); out[t] = (out[t] || "") + n.data[i]; } return Object.values(out); });
  console.log("W320 url", p.url().replace(U, ""), "제목", await p.locator("text=현금성 자산부터 추가해보세요").count(), JSON.stringify(lines));
  await desc.evaluate((el) => el.scrollIntoView({ block: "center" })); await p.screenshot({ path: OUT + "prod-320-welcome-cash.png" });
} else console.log("W320 설명 없음", p.url());
console.log("끝", new Date().toISOString(), "collect", tot.collect, "gtm", tot.gtm, "post", JSON.stringify(tot.post), "err", JSON.stringify(tot.err));
await b.close();
