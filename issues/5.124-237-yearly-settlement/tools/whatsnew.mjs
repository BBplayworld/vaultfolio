import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
import { readFileSync } from "node:fs";
const [, , SEEDS, OUT, BASE] = process.argv; const s = JSON.parse(readFileSync(SEEDS, "utf8"))["s2-mixed"];
const b = await chromium.launch({ proxy });
for (const W of [320, 360, 390]) {
  const ctx = await b.newContext(ctxOpt(W)); await ctx.clock.setFixedTime(new Date(`${s.clock}T03:00:00Z`));
  await ctx.route("**/*", (r) => { const u = r.request().url(); if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) return r.fulfill({ status: 204, body: "" }); if (/\/api\//.test(u)) return r.abort(); return r.continue(); });
  await ctx.addInitScript(({ s }) => { if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1"); localStorage.setItem("secretasset_asset_data", JSON.stringify(s.data)); localStorage.setItem("secretasset_monthly_snapshots", JSON.stringify(s.monthly)); localStorage.setItem("secretasset_daily_snapshots", JSON.stringify(s.daily)); localStorage.setItem("secretasset_exchange_rate", JSON.stringify(s.rates)); localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "skipped", 2: "skipped", 3: "skipped", 4: "skipped", 5: "skipped" })); }, { s });
  const p = await ctx.newPage(); await p.goto(BASE + "/", { waitUntil: "domcontentloaded" }).catch(() => {}); await p.waitForTimeout(5000);
  await p.screenshot({ path: `${OUT}/r2-whatsnew-home-${W}-dark.png` });
  const LINES = (re) => p.evaluate((src) => { const re = new RegExp(src); const els = [...document.querySelectorAll("body *")].filter((e) => re.test(e.textContent)); const el = els.at(-1); if (!el) return null; const host = el.closest("button, li, [role=button]") ?? el.parentElement ?? el; const out = []; const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const t = n.textContent; if (t.trim().length < 2) continue; const rg = document.createRange(); let prev = null, line = ""; const ls = []; for (let i = 0; i < t.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const rc = rg.getClientRects()[0]; if (!rc || rc.width === 0) { line += t[i]; continue; } const top = Math.round(rc.top); if (prev !== null && top > prev + 4) { ls.push(line); line = ""; } line += t[i]; prev = top; } ls.push(line); out.push(ls); } const r = host.getBoundingClientRect(); return { out, w: Math.round(r.width), h: Math.round(r.height), over: host.scrollWidth - host.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth }; }, re);
  const tip = await LINES("올해 결산이 생겼어요");
  await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(2500);
  await p.getByRole("button", { name: /앱 가이드/ }).first().click().catch((e) => console.log("guide", e.message)); await p.waitForTimeout(800);
  await p.locator('[data-testid="more-whats-new"]').click().catch((e) => console.log("wn", e.message)); await p.waitForTimeout(1500);
  const m = await LINES("나눠 보여드려요");
  console.log(W, "homeTip:", JSON.stringify(tip), "\n   sheet:", JSON.stringify(m));
  await p.screenshot({ path: `${OUT}/r2-whatsnew-sheet-${W}-dark.png` }); await ctx.close();
}
await b.close();
