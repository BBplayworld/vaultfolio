// 홈 새 소식 팁 줄바꿈 확인 — 시드 + 시계 2026-11-20 + 읽음 기록(-01까지 읽음, 8일 전)
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
import { readFileSync } from "node:fs";
const [, , SEEDS, OUT, BASE] = process.argv; const s = JSON.parse(readFileSync(SEEDS, "utf8"))["s2-mixed"];
const NOW = new Date("2026-12-15T03:00:00Z");
const b = await chromium.launch({ proxy });
for (const W of [320, 360, 390, 1280]) {
  const ctx = await b.newContext(ctxOpt(W)); await ctx.clock.setFixedTime(NOW);
  await ctx.route("**/*", (r) => { const u = r.request().url(); if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) return r.fulfill({ status: 204, body: "" }); if (/\/api\//.test(u)) return r.abort(); return r.continue(); });
  await ctx.addInitScript(({ s, now }) => { if (sessionStorage.getItem("__s")) return; sessionStorage.setItem("__s", "1"); const L = (k, v) => localStorage.setItem(k, JSON.stringify(v));
    L("secretasset_asset_data", s.data); L("secretasset_monthly_snapshots", s.monthly); L("secretasset_daily_snapshots", s.daily); L("secretasset_exchange_rate", s.rates);
    L("secretasset_tutorial_status", { 1: "skipped", 2: "skipped", 3: "skipped", 4: "skipped", 5: "skipped" });
    L("secretasset_backup", { lastBackupAt: new Date(now - 864e5).toISOString() }); L("secretasset_notice_seen", { id: "20261116-01", seenAt: now - 8 * 864e5, expiresAt: now + 300 * 864e5 }); }, { s, now: NOW.getTime() });
  const p = await ctx.newPage(); p.on("pageerror", (e) => console.log("ERR", e.message.slice(0, 200))); await p.goto(BASE + "/", { waitUntil: "domcontentloaded" }).catch(() => {}); await p.waitForTimeout(6000);
  await p.evaluate(() => { for (const e of document.querySelectorAll("body *")) if (e.children.length === 0 && /^PREVIEW\s*·/.test(e.textContent.trim())) (e.closest("[class*=fixed]") ?? e).style.display = "none"; });
  const m = await p.evaluate(() => { const box = document.querySelector('[data-testid="home-tip"]'); if (!box) return { found: false }; box.scrollIntoView({ block: "center" });
    const out = {}; for (const el of box.querySelectorAll("p")) { const n = el.firstChild; if (!n || n.nodeType !== 3) continue; const t = n.textContent, rg = document.createRange(); let prev = null, line = ""; const ls = []; for (let i = 0; i < t.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const rc = rg.getClientRects()[0]; if (!rc || rc.width === 0) { line += t[i]; continue; } const top = Math.round(rc.top); if (prev !== null && top > prev + 4) { ls.push(line); line = ""; } line += t[i]; prev = top; } ls.push(line); out[el.dataset.testid ?? "desc"] = ls; }
    const r = box.getBoundingClientRect(); return { found: true, kind: box.dataset.kind, lines: out, box: [Math.round(r.width), Math.round(r.height)], over: box.scrollWidth - box.clientWidth, docOver: document.documentElement.scrollWidth - innerWidth }; });
  console.log(W, JSON.stringify(m)); await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/r2-hometip-${W}-dark.png` }); await ctx.close();
}
await b.close();
