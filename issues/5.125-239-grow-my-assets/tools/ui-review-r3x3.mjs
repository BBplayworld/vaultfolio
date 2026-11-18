// 재설계 3차 3차 재검수(814847b) — 점수 ⓘ 구간표 2열 격자. 코드 수정 0. node ui-review-r3x3.mjs <OUT>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const [W, H] of [[320, 844], [390, 600], [1280, 900]]) {
  const o = ctxOpt(W, "dark"); o.viewport.height = H; const ctx = await b.newContext(o); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(5000);
  const t = p.locator('[data-testid="grow-score-hint"] button'); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await t.click(); await p.waitForTimeout(800);
  console.log(`${W}x${H}`, JSON.stringify(await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); const r = pop.getBoundingClientRect();
    const grid = [...pop.querySelectorAll("*")].find((e) => getComputedStyle(e).display === "grid"); const cells = grid ? [...grid.children].map((c) => { const cr = c.getBoundingClientRect(); return `${c.textContent}@${Math.round(cr.left - r.left)},${Math.round(cr.top - r.top)}`; }) : null;
    const split = []; pop.querySelectorAll("p, li, span").forEach((el) => { for (const n of el.childNodes) { if (n.nodeType !== 3) continue; for (const m of n.textContent.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(n, m.index); rg.setEnd(n, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); } } });
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height), vh: innerHeight, scroll: pop.scrollHeight > pop.clientHeight + 1, cells, split: [...new Set(split)] }; })), "ERR", errs.length);
  await p.screenshot({ path: `${OUT}/r3x3-score-${W}x${H}.png` }); await ctx.close();
}
await b.close();
