import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
const U = "https://secretasset-git-issue-5133-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.133-trial-hardening/screenshots/review/";
const b = await chromium.launch();
async function ctx(w, h, mobile, theme) {
  const c = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  await c.addCookies([{ name: "theme_mode", value: theme, url: U }]);
  const p = await c.newPage();
  await p.goto(U + "/?ga-optout=1"); await p.waitForTimeout(1200);
  return p;
}
const mode = process.argv[2];
if (mode === "cause") {
  for (const theme of ["dark", "light"]) for (const w of [1280, 1160, 1100, 520]) {
    const m = w < 769;
    const p = await ctx(w, m ? 844 : 900, m, theme);
    await p.goto(U + "/?demo=1"); await p.waitForTimeout(7000);
    const info = await p.evaluate(() => {
      const l = document.querySelector('[data-testid="home-cause-line"]');
      const mk = document.querySelector('[data-testid="home-cause-market"]');
      const r = l.getBoundingClientRect();
      const lab = l.querySelector(".truncate");
      return { dark: document.documentElement.classList.contains("dark"), text: l.innerText.replace(/\s+/g, " "), aria: l.getAttribute("aria-label"), h: Math.round(r.height), w: Math.round(r.width), mkVis: mk ? getComputedStyle(mk).display : "none", trunc: lab ? lab.scrollWidth > lab.clientWidth : null, docOver: document.documentElement.scrollWidth > innerWidth, idx: document.querySelector('[data-testid="home-market-today"]')?.getAttribute("aria-label") ?? null };
    });
    console.log(theme, w, JSON.stringify(info));
    const box = await p.locator('[data-testid="home-cause-line"]').boundingBox();
    const y0 = Math.max(0, box.y - 200);
    await p.screenshot({ path: `${OUT}cause-${w}-${theme}.png`, clip: { x: 0, y: y0, width: w, height: Math.min(360, box.y + box.height + 40 - y0) } });
    if (w === 1280 || w === 520 || w === 1100) {
      await p.locator('[data-testid="home-cause-line"]').click(); await p.waitForTimeout(900);
      const panel = await p.evaluate(() => document.querySelector('[data-testid="home-cause-panel"]')?.innerText.replace(/\n+/g, " | "));
      console.log("  패널", panel);
      const pb = await p.locator('[data-testid="home-cause-panel"]').boundingBox();
      const yy = Math.max(0, box.y - 120);
      await p.screenshot({ path: `${OUT}open-${w}-${theme}.png`, clip: { x: 0, y: yy, width: w, height: Math.min(700, pb.y + pb.height + 20 - yy) } });
    }
    await p.context().close();
  }
}
if (mode === "welcome") {
  for (const theme of ["dark", "light"]) for (const w of [320, 375]) {
    const p = await ctx(w, 740, true, theme);
    await p.goto(U + "/?trial=1"); await p.waitForTimeout(5000);
    await p.evaluate(() => { location.hash = "#detail/cash"; }); await p.waitForTimeout(2000);
    await p.locator('[data-testid="trial-start-btn"]').first().click(); await p.waitForTimeout(5000);
    const desc = p.locator('text=/방금 본 화면이 내/').first();
    const info = await desc.evaluate((el) => { const r = document.createRange(); r.selectNodeContents(el); const rects = [...r.getClientRects()]; const tops = [...new Set(rects.map((x) => Math.round(x.top)))]; return { text: el.textContent, lines: tops.length, wb: getComputedStyle(el).wordBreak, over: document.documentElement.scrollWidth > innerWidth }; });
    // 줄별 글자
    const perLine = await desc.evaluate((el) => { const t = el.firstChild; const out = {}; if (!t || t.nodeType !== 3) return null; for (let i = 0; i < t.length; i++) { const r = document.createRange(); r.setStart(t, i); r.setEnd(t, i + 1); const top = Math.round(r.getBoundingClientRect().top); out[top] = (out[top] || "") + t.data[i]; } return Object.values(out); });
    console.log(theme, w, JSON.stringify(info), JSON.stringify(perLine));
    await desc.evaluate((el) => el.scrollIntoView({ block: "start" })); await p.evaluate(() => scrollBy(0, -120)); await p.waitForTimeout(400);
    await p.screenshot({ path: `${OUT}welcome-cash-${w}-${theme}.png` });
    await p.context().close();
  }
}
if (mode === "swipe") {
  const p = await ctx(390, 844, true, "dark");
  await p.goto(U + "/?trial=1"); await p.waitForTimeout(5000);
  const s = await p.context().newCDPSession(p);
  async function swipe(dir, tag) {
    const y = 260, x0 = dir < 0 ? 320 : 70, x1 = dir < 0 ? 70 : 320;
    const before = await p.evaluate(() => ({ h: location.hash, sx: scrollX, sy: Math.round(scrollY) }));
    await s.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: x0, y }] });
    for (let i = 1; i <= 5; i++) { await s.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x0 + (x1 - x0) * i / 5, y }] }); await p.waitForTimeout(20); }
    const mid = await p.evaluate(() => { const m = document.querySelector("main"); return { mainTf: m ? getComputedStyle(m).transform : null, sx: scrollX }; });
    await s.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    // 직후 프레임들: 슬라이드 애니메이션 클래스 감지
    const frames = [];
    for (let k = 0; k < 5; k++) { await p.waitForTimeout(60); frames.push(await p.evaluate(() => { const els = [...document.querySelectorAll("main *")].slice(0, 400).filter((e) => { const a = getComputedStyle(e).animationName; return a && a !== "none"; }).map((e) => getComputedStyle(e).animationName); return [...new Set(els)].slice(0, 4).join(","); })); }
    await p.waitForTimeout(900);
    const after = await p.evaluate(() => ({ h: location.hash, sx: scrollX, sy: Math.round(scrollY), hist: history.length, over: document.documentElement.scrollWidth > innerWidth }));
    console.log(tag, JSON.stringify({ before, mid, frames, after }));
    await p.screenshot({ path: `${OUT}swipe-${tag}.png` });
  }
  await swipe(1, "home-right-edge");
  await swipe(-1, "home-to-detail");
  await swipe(-1, "detail-to-activity");
  await swipe(-1, "activity-left-edge");
  await swipe(-1, "activity-left-edge2");
  await swipe(1, "activity-to-detail");
}
await b.close();
