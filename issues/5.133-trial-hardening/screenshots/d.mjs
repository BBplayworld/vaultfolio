import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const b = await chromium.launch();
async function ctx(w, h = 844, mobile = true) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const p = await c.newPage();
  const ga = []; p.on("request", (r) => { if (/google-analytics\.com\/.*collect/.test(r.url())) ga.push(r.url()); });
  p.__ga = ga;
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1500);
  return p;
}
async function swipe(p, dir, y = 260) {
  const s = await p.context().newCDPSession(p);
  const x0 = dir < 0 ? 320 : 70, x1 = dir < 0 ? 70 : 320;
  await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
  for (let i = 1; i <= 5; i++) { await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 5, y }] }); await p.waitForTimeout(20); }
  await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await p.waitForTimeout(1200);
}
const h = (p) => p.evaluate(() => location.hash);
const mode = process.argv[2];
if (mode === "nav") {
  let p = await ctx(390);
  await p.goto(U + "/?trial=1"); await p.waitForTimeout(5000);
  console.log("T 시작 trial-tag", await p.locator('[data-testid="trial-tag"]').count(), JSON.stringify(await h(p)));
  await swipe(p, -1); console.log("T 홈→← ", await h(p));
  await swipe(p, -1); console.log("T 상세→← ", await h(p));
  await swipe(p, -1); console.log("T 성과→← ", await h(p));
  await p.screenshot({ path: "T-activity-swipe.png" });
  await swipe(p, 1); console.log("T 성과→→ ", await h(p));
  await swipe(p, -1);
  await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(1200);
  console.log("T #more 입력 →", JSON.stringify(await h(p)), "url", p.url(), "trial-tag", await p.locator('[data-testid="trial-tag"]').count(), "hero", await p.locator("text=순자산").count() > 0);
  await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1200);
  console.log("T #settings 입력 →", JSON.stringify(await h(p)), "url", p.url());
  await p.screenshot({ path: "T-hash-settings.png" });
  await p.goBack(); await p.waitForTimeout(1200); console.log("T 뒤로 →", JSON.stringify(await h(p)));
  console.log("T GA collect", p.__ga.length);
  p = await ctx(390);
  await p.goto(U + "/?trial=1#settings"); await p.waitForTimeout(5000);
  console.log("T 초기 ?trial=1#settings →", JSON.stringify(await h(p)), "url", p.url(), "trial-tag", await p.locator('[data-testid="trial-tag"]').count());
  p = await ctx(390);
  await p.goto(U + "/?demo=1"); await p.waitForTimeout(5000);
  console.log("N trial-tag", await p.locator('[data-testid="trial-tag"]').count());
  await swipe(p, -1); console.log("N 홈→← ", await h(p));
  await swipe(p, -1); console.log("N 상세→← ", await h(p));
  await swipe(p, -1); console.log("N 성과→← ", await h(p));
  await p.evaluate(() => { location.hash = "#settings"; }); await p.waitForTimeout(1500);
  console.log("N #settings →", await h(p));
}
if (mode === "welcome") {
  for (const w of [320, 375]) {
    const p = await ctx(w);
    await p.goto(U + "/?trial=1"); await p.waitForTimeout(5000);
    await p.evaluate(() => { location.hash = "#detail/cash"; }); await p.waitForTimeout(2000);
    console.log(w, "현금 화면", await h(p));
    await p.locator('[data-testid="trial-start-btn"]').first().click();
    await p.waitForTimeout(5000);
    const cta = p.locator('text=현금성 자산부터 추가해보세요').first();
    console.log(w, "복귀 url", p.url(), "제목", await cta.count());
    const desc = p.locator('text=/방금 본 화면이 내/').first();
    if (await desc.count()) {
      const info = await desc.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const rects = [...r.getClientRects()]; const tops = [...new Set(rects.map((x) => Math.round(x.top)))]; return { text: el.textContent, lines: tops.length, w: Math.round(el.getBoundingClientRect().width) }; });
      console.log(w, JSON.stringify(info), "nbsp", info.text.includes(" "));
      await desc.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await p.screenshot({ path: `welcome-cash-${w}.png` });
    }
  }
}
if (mode === "cause") {
  for (const [w, hgt, m] of [[375, 812, true], [1280, 900, false]]) {
    const p = await ctx(w, hgt, m);
    await p.goto(U + "/?demo=1"); await p.waitForTimeout(7000);
    const line = p.locator('[data-testid="home-cause-line"]').first();
    const mk = p.locator('[data-testid="home-cause-market"]').first();
    const idx = p.locator('[data-testid="home-market-today"]').first();
    console.log(w, "cause-line", await line.count() ? JSON.stringify(await line.innerText()) : "없음",
      "| cause-market", await mk.count() ? JSON.stringify({ t: await mk.innerText(), vis: await mk.isVisible() }) : "없음",
      "| 지수줄", await idx.count() ? JSON.stringify(await idx.getAttribute("aria-label")) : "없음");
    if (await line.count()) {
      const ov = await line.evaluate((el) => [...el.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible").map((e) => e.className.slice(0, 40)));
      console.log(w, "말줄임/넘침", JSON.stringify(ov), "aria", await p.locator('[aria-label^="변동 원인 펼치기"]').first().getAttribute("aria-label").catch(() => null));
    }
    await p.screenshot({ path: `cause-${w}.png` });
  }
}
await b.close();
