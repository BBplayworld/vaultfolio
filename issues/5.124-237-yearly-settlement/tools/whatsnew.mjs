import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
import { readFileSync } from "node:fs";
const [, , SEEDS, OUT, BASE] = process.argv; const s = JSON.parse(readFileSync(SEEDS, "utf8"))["s2-mixed"];
const b = await chromium.launch({ proxy });
for (const W of [320, 360, 390]) {
  const ctx = await b.newContext(ctxOpt(W)); await ctx.clock.setFixedTime(new Date(`${s.clock}T03:00:00Z`));
  await ctx.route("**/*", (r) => { const u = r.request().url(); if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) return r.fulfill({ status: 204, body: "" }); if (/\/api\//.test(u)) return r.abort(); return r.continue(); });
  await ctx.addInitScript(({ s }) => { if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1"); localStorage.setItem("secretasset_asset_data", JSON.stringify(s.data)); localStorage.setItem("secretasset_monthly_snapshots", JSON.stringify(s.monthly)); localStorage.setItem("secretasset_daily_snapshots", JSON.stringify(s.daily)); localStorage.setItem("secretasset_exchange_rate", JSON.stringify(s.rates)); localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "skipped", 2: "skipped", 3: "skipped", 4: "skipped", 5: "skipped" })); }, { s });
  const p = await ctx.newPage(); await p.goto(BASE + "/", { waitUntil: "domcontentloaded" }).catch(() => {}); await p.waitForTimeout(5000);
  await p.screenshot({ path: `${OUT}/whatsnew-home-${W}-dark.png` });
  const tip = await p.evaluate(() => [...document.querySelectorAll("button,div,p")].filter((e) => e.children.length < 4 && /올해 결산이 생겼어요/.test(e.textContent)).slice(-1).map((e) => e.textContent.slice(0, 80))[0] ?? null);
  await p.evaluate(() => { location.hash = "#more"; }); await p.waitForTimeout(2500);
  await p.getByRole("button", { name: /앱 가이드/ }).first().click().catch((e) => console.log("guide", e.message)); await p.waitForTimeout(800);
  await p.locator('[data-testid="more-whats-new"]').click().catch((e) => console.log("wn", e.message)); await p.waitForTimeout(1500);
  const m = await p.evaluate(() => { const el = [...document.querySelectorAll("li, div")].filter((e) => /올해 결산이 생겼어요/.test(e.textContent) && /나눠 보여드려요/.test(e.textContent)).at(-1); if (!el) return null; const out = []; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = tw.nextNode())) { const t = n.textContent; if (t.trim().length < 4) continue; const rg = document.createRange(); let prev = null, line = ""; const ls = []; for (let i = 0; i < t.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const rc = rg.getClientRects()[0]; if (!rc) { line += t[i]; continue; } const top = Math.round(rc.top); if (prev !== null && top > prev + 4) { ls.push(line); line = ""; } line += t[i]; prev = top; } ls.push(line); out.push(ls); } return out; });
  console.log(W, "homeTip:", tip, "sheet lines:", JSON.stringify(m));
  await p.screenshot({ path: `${OUT}/whatsnew-sheet-${W}-dark.png` }); await ctx.close();
}
await b.close();
