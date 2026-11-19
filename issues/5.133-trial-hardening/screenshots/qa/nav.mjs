import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/qa/";
const b = await chromium.launch();
async function ctx(w = 390, h = 844, mobile = true) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const p = await c.newPage();
  p.__ga = []; p.__err = [];
  p.on("request", (r) => { if (/google-analytics\.com|googletagmanager\.com/.test(r.url())) p.__ga.push(r.url().slice(0, 90)); if (r.method() !== "GET" && /\/api\//.test(r.url())) console.log("  [non-GET]", r.method(), r.url()); });
  p.on("console", (m) => { if (m.type() === "error") p.__err.push(m.text().slice(0, 120)); });
  p.on("pageerror", (e) => p.__err.push("PAGEERR " + e.message.slice(0, 120)));
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1500);
  return p;
}
async function swipe(p, dir, y = 300) {
  const s = await p.context().newCDPSession(p);
  const x0 = dir < 0 ? 320 : 70, x1 = dir < 0 ? 70 : 320;
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 5; i++) { await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 5, y }] }); await p.waitForTimeout(20); }
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(1300);
}
const st = (p) => p.evaluate(() => ({ url: location.pathname + location.search + location.hash, settingsLabel: [...document.querySelectorAll("p")].some((e) => e.textContent === "화면"), moreRow: !!document.querySelector('[data-testid="more-row-settings"]'), heroNet: !!document.querySelector('[data-testid="home-cause-line"], [data-testid="home-market-today"]') || document.body.innerText.includes("전일 대비"), trialTag: document.querySelectorAll('[data-testid="trial-tag"]').length, hist: history.length }));
const log = async (p, t) => console.log(t, JSON.stringify(await st(p)));

console.log("=== 체험 390 터치");
let p = await ctx();
await p.goto(U + "/?trial=1"); await p.waitForTimeout(6000);
await log(p, "T0 시작");
const navTabs = await p.evaluate(() => [...document.querySelectorAll("nav button, nav a")].map((e) => (e.textContent || "").trim()).filter(Boolean));
console.log("  하단탭", JSON.stringify(navTabs));
await swipe(p, -1); await log(p, "T1 홈→←");
await swipe(p, -1); await log(p, "T2 상세→←");
await swipe(p, -1); await log(p, "T3 성과→←(더보기 없어야)");
await p.screenshot({ path: OUT + "qa-390-trial-activity-swipe.png" });
await swipe(p, -1); await log(p, "T3b 성과→← 2회");
await swipe(p, 1); await log(p, "T4 성과→→");
await swipe(p, 1); await log(p, "T5 상세→→");
await swipe(p, 1); await log(p, "T5b 홈→→(변화 없음)");
await p.evaluate(() => { location.hash = "#detail"; }); await p.waitForTimeout(1200); await log(p, "T6 #detail 입력");
await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(1500); await log(p, "T7 #more 입력");
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500); await log(p, "T8 #settings 입력");
await p.screenshot({ path: OUT + "qa-390-trial-hash-settings.png" });
await p.goBack(); await p.waitForTimeout(1500); await log(p, "T9 뒤로");
await p.goForward(); await p.waitForTimeout(1500); await log(p, "T10 앞으로");
await p.evaluate(() => { history.pushState(null, "", "#settings"); history.pushState(null, "", "#detail"); history.back(); }); await p.waitForTimeout(1500); await log(p, "T11 popstate(back)→#settings");
console.log("  T ga요청", p.__ga.length, "콘솔오류", JSON.stringify(p.__err));
// 2중 방어: 가드를 우회해 설정을 강제로 렌더(React 상태 직접 dispatch) 후 '화면' 7회
const forced = await p.evaluate(() => {
  const el = document.querySelector("main") || document.body.firstElementChild;
  const key = Object.keys(el).find((k) => k.startsWith("__reactFiber"));
  let f = el[key];
  while (f) {
    let h = f.memoizedState;
    while (h && typeof h === "object" && "next" in h) {
      const v = h.memoizedState;
      if (h.queue && v && typeof v === "object" && v.type === "home") { h.queue.dispatch({ type: "settings" }); return "dispatched"; }
      h = h.next;
    }
    f = f.return;
  }
  return "not-found";
});
await p.waitForTimeout(1500);
console.log("  강제 설정 렌더", forced, JSON.stringify(await st(p)));
const before = await p.evaluate(() => ({ ls: localStorage.getItem("ga-optout"), dis: Object.entries(window).filter(([k]) => k.startsWith("ga-disable-")).map(([k, v]) => k.slice(0, 14) + "=" + v) }));
const lbl = p.locator("p", { hasText: /^화면$/ }).first();
if (await lbl.count()) { for (let i = 0; i < 7; i++) { await lbl.click(); await p.waitForTimeout(80); } }
await p.waitForTimeout(800);
const after = await p.evaluate(() => ({ ls: localStorage.getItem("ga-optout"), dis: Object.entries(window).filter(([k]) => k.startsWith("ga-disable-")).map(([k, v]) => k.slice(0, 14) + "=" + v), toast: document.body.innerText.match(/GA 수집 제외 O(N|FF)/g) }));
console.log("  체험 7탭 전", JSON.stringify(before), "후", JSON.stringify(after));

console.log("=== 체험 첫 로드 해시");
for (const hsh of ["#settings", "#more"]) {
  p = await ctx();
  await p.goto(U + "/?trial=1" + hsh); await p.waitForTimeout(6000);
  await log(p, "TF " + hsh);
  if (hsh === "#settings") await p.screenshot({ path: OUT + "qa-390-trial-firstload-settings.png" });
  console.log("  ga", p.__ga.length, "err", JSON.stringify(p.__err));
}

console.log("=== 비체험 데모 390 터치");
p = await ctx();
await p.goto(U + "/?demo=1"); await p.waitForTimeout(6000);
await log(p, "N0");
await swipe(p, -1); await log(p, "N1 홈→←");
await swipe(p, -1); await log(p, "N2 상세→←");
await swipe(p, -1); await log(p, "N3 성과→←(#more)");
await p.screenshot({ path: OUT + "qa-390-demo-swipe-more.png" });
await swipe(p, 1); await log(p, "N4 더보기→→");
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500); await log(p, "N5 #settings 입력");
await swipe(p, 1); await log(p, "N5b 설정→→(성과)");
await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(1500); await log(p, "N6 #more 입력");
await p.goBack(); await p.waitForTimeout(1500); await log(p, "N7 뒤로");
await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500);
const l2 = p.locator("p", { hasText: /^화면$/ }).first();
const b2 = await p.evaluate(() => localStorage.getItem("ga-optout"));
for (let i = 0; i < 7; i++) { await l2.click(); await p.waitForTimeout(80); }
await p.waitForTimeout(600);
const a2 = await p.evaluate(() => ({ ls: localStorage.getItem("ga-optout"), toast: document.body.innerText.match(/GA 수집 제외 O(N|FF)/g) }));
for (let i = 0; i < 7; i++) { await l2.click(); await p.waitForTimeout(80); }
await p.waitForTimeout(600);
const a3 = await p.evaluate(() => ({ ls: localStorage.getItem("ga-optout"), toast: document.body.innerText.match(/GA 수집 제외 O(N|FF)/g) }));
console.log("  비체험 7탭 전", b2, "1차", JSON.stringify(a2), "2차", JSON.stringify(a3));
console.log("  N ga", p.__ga.length, "err", JSON.stringify(p.__err));
p = await ctx();
await p.goto(U + "/?demo=1#settings"); await p.waitForTimeout(6000); await log(p, "NF 데모 첫 로드 #settings");
await b.close();
