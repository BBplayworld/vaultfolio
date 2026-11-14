// ui-review: 성적표 5축 행 — 축 이름과 별점 사이 간격
import { chromium, PV, PROD, proxy, ctxOpt } from "./lib.mjs";
const b = await chromium.launch({ proxy });
for (const W of [360, 375, 390, 430]) for (const [nm, base] of [["prod", PROD], ["pv", PV]]) {
  const ctx = await b.newContext(ctxOpt(W)); const p = await ctx.newPage(); await p.goto(base + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(3500);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(3500);
  const r = await p.evaluate(() => [...document.querySelectorAll("span,p,h3,h4")].filter((e) => /^(장기 순자산 성장|수익의 질|레버리지 건전성)$/.test(e.textContent.trim()) && e.children.length === 0).map((e) => { const rg = document.createRange(); rg.selectNodeContents(e); const q = rg.getBoundingClientRect(); let row = e; while (row && !row.querySelector("svg.lucide-star, [class*=star]")) row = row.parentElement; const stars = row ? [...row.querySelectorAll("svg")].filter((s) => s.getBoundingClientRect().left > q.left + 10) : []; const sx = stars.length ? Math.min(...stars.map((s) => s.getBoundingClientRect().left)) : null; return e.textContent + " " + getComputedStyle(e).fontSize + " 글자끝" + Math.round(q.right) + " 별시작" + (sx ? Math.round(sx) : "?") + " 간격" + (sx ? Math.round(sx - q.right) : "?") + " cls:" + e.className.slice(0, 70) + " 부모:" + e.parentElement.className.slice(0, 80); }));
  console.log(W, nm, JSON.stringify(r, null, 0)); await ctx.close();
}
await b.close();
