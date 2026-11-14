// ui-review 추가 실측: 배당 표(C103)·시장 비교 표·세금 높이·주식 범례·라이트 390
import { chromium, PV, PROD, proxy, ctxOpt } from "./lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const open = async (base, W, scheme = "dark") => { const ctx = await b.newContext(ctxOpt(W, scheme)); const p = await ctx.newPage(); await p.goto(base + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(3500); return { ctx, p }; };
const hash = async (p, h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(2500); };
const lines = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const tops = []; for (const q of rg.getClientRects()) if (q.width > 0.5 && !tops.some((t) => Math.abs(t - q.top) < q.height * 0.6)) tops.push(q.top); return tops.length; };
// 1. 배당 표
for (const W of [360, 374, 375, 390, 430, 768, 1280]) {
  for (const [nm, base] of [["prod", PROD], ["pv", PV]]) {
    const { ctx, p } = await open(base, W); await hash(p, "#activity/dividend");
    const r = await p.evaluate((linesSrc) => { const lines = eval("(" + linesSrc + ")"); const rows = [...document.querySelectorAll("div.grid")].filter((e) => /3\.25rem/.test(e.className) && /items-center/.test(e.className)); return rows.map((e) => { const rr = e.getBoundingClientRect(); const name = e.querySelector(".truncate,.line-clamp-2,.line-clamp-1"); const hold = [...e.querySelectorAll("p")].find((x) => /^보유/.test(x.textContent)); const cols = [...e.children].map((c) => { const cr = c.getBoundingClientRect(); return [Math.round(cr.left), Math.round(cr.right), c.scrollWidth > c.clientWidth + 1]; }); return { h: Math.round(rr.height * 10) / 10, name: name ? name.textContent.slice(0, 12) : "", clip: name ? name.scrollWidth > name.clientWidth + 1 : null, hold: hold ? hold.textContent + "/" + lines(hold) + "줄" + (hold.scrollWidth > hold.clientWidth + 1 ? "/넘침" : "") : "", over: cols.filter((c) => c[2]).length }; }); }, lines.toString());
    console.log("배당", W, nm, JSON.stringify(r));
    if (nm === "pv") { const t = p.locator("div.grid").filter({ hasText: "보유" }).first(); await p.screenshot({ path: `${OUT}/x-dividend-${W}.png`, fullPage: true }); }
    await ctx.close();
  }
}
// 2. 시장 비교 표
for (const W of [390, 639, 640, 768, 1023, 1024, 1280]) {
  for (const [nm, base] of [["prod", PROD], ["pv", PV]]) {
    const { ctx, p } = await open(base, W); await hash(p, "#activity/change-market");
    const r = await p.evaluate((linesSrc) => { const lines = eval("(" + linesSrc + ")"); const hs = [...document.querySelectorAll('[role="columnheader"]')].filter((e) => e.getBoundingClientRect().width > 0); const g = hs[0]?.closest(".grid"); const cells = g ? [...g.querySelectorAll('[role="cell"],[role="rowheader"],[role="columnheader"]')] : []; let minGap = 999; const byRow = {}; for (const c of cells) { const rg = document.createRange(); rg.selectNodeContents(c); const q = rg.getBoundingClientRect(); if (q.width < 1) continue; const k = Math.round(c.getBoundingClientRect().top / 6); (byRow[k] ||= []).push([q.left, q.right, c.textContent.slice(0, 8)]); } const gaps = []; for (const k in byRow) { const a = byRow[k].sort((x, y) => x[0] - y[0]); for (let i = 1; i < a.length; i++) { const gp = Math.round(a[i][0] - a[i - 1][1]); if (gp < minGap) minGap = gp; if (gp < 8) gaps.push(a[i - 1][2] + "|" + a[i][2] + "=" + gp); } } return { gw: g ? Math.round(g.getBoundingClientRect().width) : 0, heads: hs.map((h) => h.textContent + ":" + getComputedStyle(h).fontSize + ":" + lines(h) + "줄:x" + Math.round(h.getBoundingClientRect().left) + "~" + Math.round(h.getBoundingClientRect().right)), minGap, gaps: gaps.slice(0, 6), cols: g ? getComputedStyle(g).gridTemplateColumns : "" }; }, lines.toString());
    console.log("시장", W, nm, JSON.stringify(r));
    if (nm === "pv") await p.screenshot({ path: `${OUT}/x-market-${W}.png`, fullPage: true });
    await ctx.close();
  }
}
// 3. 세금 높이·블록
for (const W of [360, 390, 430]) {
  const res = {};
  for (const [nm, base] of [["prod", PROD], ["pv", PV]]) {
    const { ctx, p } = await open(base, W); await hash(p, "#tax");
    res[nm] = await p.evaluate(() => ({ H: document.documentElement.scrollHeight, cards: [...document.querySelectorAll("p")].filter((e) => /text-(xs|sm) text-muted-foreground( break-keep)?$/.test(e.className) && e.getBoundingClientRect().height > 0).length }));
    if (nm === "pv") await p.screenshot({ path: `${OUT}/x-tax-${W}.png`, fullPage: true });
    await ctx.close();
  }
  console.log("세금", W, JSON.stringify(res));
}
// 4. 주식 범례
for (const W of [768, 1024, 1279, 1280]) {
  for (const [nm, base] of [["prod", PROD], ["pv", PV]]) {
    const { ctx, p } = await open(base, W); await hash(p, "#detail/stocks");
    const r = await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll("span")) { if (!/%$/.test(el.textContent.trim()) || !/font-bold text-muted-foreground shrink-0/.test(el.className)) continue; const row = el.parentElement; const name = row.querySelector(".truncate") || row.firstElementChild; out.push(name.textContent.slice(0, 14) + ":" + getComputedStyle(name).fontSize + (name.scrollWidth > name.clientWidth + 1 ? ":말줄임" : "")); } return out.slice(0, 8); });
    console.log("범례", W, nm, JSON.stringify(r)); await ctx.close();
  }
}
// 5. 라이트 390·1280
for (const W of [390, 1280]) { const { ctx, p } = await open(PV, W, "light"); for (const [n, h] of [["home", ""], ["detail-stocks", "#detail/stocks"], ["perf-change", "#activity/change"], ["more", "#more"]]) { if (h) await hash(p, h); await p.screenshot({ path: `${OUT}/pv-${n}-${W}-light.png`, fullPage: true }); } await ctx.close(); }
await b.close();
