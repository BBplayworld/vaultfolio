// ui-review 수정안 주입 검증: 배당 표 640~1023 열 폭, 시장 비교 표 640~1023 열 간격
import { chromium, PV, proxy, ctxOpt } from "./lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const open = async (W) => { const ctx = await b.newContext(ctxOpt(W)); const p = await ctx.newPage(); await p.goto(PV + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(3500); return { ctx, p }; };
const hash = async (p, h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(3000); };
for (const W of [640, 768, 1023, 1024]) {
  const { ctx, p } = await open(W); await hash(p, "#activity/dividend"); await p.waitForTimeout(2500);
  const m = async (tag) => console.log("배당", W, tag, JSON.stringify(await p.evaluate(() => { const rows = [...document.querySelectorAll("div.grid")].filter((e) => /3\.25rem/.test(e.className)); const hd = rows.find((e) => /bg-muted/.test(e.className)); return { cols: getComputedStyle(rows[0]).gridTemplateColumns, headOver: hd ? hd.scrollWidth - hd.clientWidth : null, rows: rows.filter((e) => /items-center/.test(e.className)).map((e) => { const n = e.querySelector(".truncate,.line-clamp-2,.line-clamp-1"); const c0 = e.children[0].getBoundingClientRect(); const c1 = e.children[1]; return Math.round(c0.width) + "/" + (n ? (n.scrollWidth > n.clientWidth + 1 ? "말줄임" : "ok") : "?") + "/h" + Math.round(e.getBoundingClientRect().height) + "/월" + Math.round(c1.getBoundingClientRect().height) + "/넘" + (e.scrollWidth - e.clientWidth); }) }; })));
  await m("현재");
  await p.addStyleTag({ content: `@media (min-width:640px) and (max-width:1023.98px){ div.grid[class*="3.25rem"]{ grid-template-columns: minmax(0,1fr) 11.5rem 4.75rem 5.5rem 5.5rem !important; column-gap: .5rem !important; } }` });
  await p.waitForTimeout(600); await m("수정안"); await p.screenshot({ path: `${OUT}/fix-dividend-${W}.png`, fullPage: true }); await ctx.close();
}
for (const W of [640, 768, 1023]) {
  const { ctx, p } = await open(W); await hash(p, "#activity/change-market"); await p.waitForTimeout(9000);
  const m = async (tag) => console.log("시장", W, tag, JSON.stringify(await p.evaluate(() => { const g = document.querySelector('[role="columnheader"]')?.closest(".grid"); if (!g) return null; const byRow = {}; for (const c of g.querySelectorAll("*")) { if (c.children.length) continue; const rg = document.createRange(); rg.selectNodeContents(c); const q = rg.getBoundingClientRect(); if (q.width < 1) continue; const k = Math.round(q.top / 10); (byRow[k] ||= []).push([q.left, q.right, c.textContent.slice(0, 9)]); } let min = 999, at = ""; for (const k in byRow) { const a = byRow[k].sort((x, y) => x[0] - y[0]); for (let i = 1; i < a.length; i++) { const gp = Math.round(a[i][0] - a[i - 1][1]); if (gp < min) { min = gp; at = a[i - 1][2] + "|" + a[i][2]; } } } return { cols: getComputedStyle(g).gridTemplateColumns, min, at, over: g.scrollWidth - g.clientWidth }; })));
  await m("현재"); await p.screenshot({ path: `${OUT}/x-market-loaded-${W}.png` });
  await p.addStyleTag({ content: `@media (min-width:640px) and (max-width:1023.98px){ .grid:has(> [role="row"] [role="columnheader"]), .grid:has([role="columnheader"]){ column-gap: 1rem !important; } }` });
  await p.waitForTimeout(600); await m("수정안"); await p.screenshot({ path: `${OUT}/fix-market-${W}.png` }); await ctx.close();
}
await b.close();
