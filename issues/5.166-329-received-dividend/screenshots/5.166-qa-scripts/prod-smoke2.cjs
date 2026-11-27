// v5.164 운영 스모크 보충 1회: 1280 차트 막대(전체 페이지 캡처 재생성 의심 확인) + 상세 주식 360·359
const path = require("path"); const { execSync } = require("child_process");
const { chromium } = require(path.join(execSync("npm root -g", { encoding: "utf8" }).trim(), "playwright"));
const BASE = "https://www.secretasset.xyz"; const SEED = process.argv[2];
const OUT = "/home/user/vaultfolio/.memory/issues/5.166-329-received-dividend/screenshots/5.166-qa-prod-";
const kst = () => new Date(Date.now() + 9 * 3600e3).toISOString().replace("T", " ").slice(0, 19);
const L = (k, v) => console.log(`[${kst()}]`, k, typeof v === "string" ? v : JSON.stringify(v));
const W = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", proxy: process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined });
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: "dark", url: BASE }]);
  const p = await ctx.newPage(); const errs = [], blocked = [], nonGet = []; let docs = 0, ga = 0;
  p.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 200))); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 160)); });
  p.on("request", (r) => { if (r.resourceType() === "document") docs++; if (/\/g\/collect/.test(r.url())) ga++; if (r.method() !== "GET") nonGet.push(r.method() + " " + r.url().slice(0, 90)); });
  p.on("response", (r) => { if (r.status() === 403 || r.headers()["x-vercel-mitigated"]) blocked.push(r.status() + " " + r.url().slice(0, 90)); });
  const r0 = await p.goto(BASE + "/?ga-optout=1", { waitUntil: "domcontentloaded", timeout: 60000 }); L("status", r0.status()); if (r0.status() === 403) { L("STOP", blocked); process.exit(2); }
  await W(3500); await p.locator('input[type="file"][accept="application/json"]').first().setInputFiles(SEED); await W(3500);
  const bars = () => p.evaluate(() => { const rs = [...document.querySelectorAll(".recharts-bar-rectangle path, .recharts-rectangle")]; return { n: rs.length, nonzero: rs.filter((e) => e.getBoundingClientRect().height > 0.5).length }; });
  await p.evaluate(() => { location.hash = "#activity/dividend"; }); await p.waitForSelector('[data-testid="dividend-conclusion"]', { timeout: 30000 }).catch(() => {}); await W(3500);
  L("1280 bars(viewport)", await bars()); await p.screenshot({ path: OUT + "1280-dark-6b-dividend-viewport.png" });
  for (const w of [360, 359]) {
    await p.setViewportSize({ width: w, height: 844 }); await p.evaluate(() => { location.hash = "#detail/stocks"; }); await W(2500);
    L("stock " + w, await p.evaluate(() => { const cw = document.documentElement.clientWidth; const rr = [...document.querySelectorAll('[data-testid="stock-row-right"]')]; const btn = [...document.querySelectorAll("button")].filter((x) => x.textContent.trim() === "맞추기"); return { hash: location.hash, rows: rr.length, ox: document.documentElement.scrollWidth - cw, rightOver: rr.filter((e) => e.getBoundingClientRect().right > cw + 0.5).length, clipped: rr.filter((e) => e.scrollWidth > e.clientWidth + 1).length, rightEdges: [...new Set(rr.map((e) => Math.round(e.getBoundingClientRect().right)))], reconcileBtnOver: btn.filter((x) => x.getBoundingClientRect().right > cw + 0.5).length }; }));
    await p.screenshot({ path: OUT + w + "-dark-8b-detail-stocks.png" });
  }
  L("docs", docs); L("nonGET", nonGet); L("GA collect", ga); L("blocked", blocked); L("errs", [...new Set(errs)]);
  await b.close();
})().catch((e) => { console.error("FAIL", String(e).slice(0, 400)); process.exit(1); });
