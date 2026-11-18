// 6차 재검수(4ce2a46) — 전수표 '수정' 4행 + 점수 기준 1줄. 320·390·1280, 데모·체험 허브. 코드 수정 0. node ui-review-r6b.mjs <OUT>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy }); const log = (k, v) => console.log(k, JSON.stringify(v));
const pop = (p) => p.evaluate(() => { const x = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!x) return null; const split = []; x.querySelectorAll("p, li, span, div").forEach((el) => { for (const nd of el.childNodes) { if (nd.nodeType !== 3) continue; for (const m of nd.textContent.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(nd, m.index); rg.setEnd(nd, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1) split.push(m[0]); } } }); const r = x.getBoundingClientRect(); return { split: [...new Set(split)], top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
for (const [W, q] of [[320, "demo=1"], [390, "demo=1"], [1280, "demo=1"], [390, "trial=1"], [320, "trial=1"]]) {
  const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  const tag = `${q.slice(0, -2)}-${W}`;
  log(`HOME ${tag}`, await p.evaluate(() => { const t = document.body.innerText; const i = t.search(/골드|브론즈|실버|플래티넘/); return { tier: i >= 0 ? t.slice(Math.max(0, i - 10), i + 20).replace(/\n/g, " ") : null, tri: /▲\s?0\.5|▲0\.5/.test(t) }; }));
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
  log(`HUB ${tag}`, await p.evaluate(() => { const c = document.querySelector('[data-testid="hub-card-report"]'); const pr = c.querySelector('[data-testid="hub-report-primary"]'); const rg = document.createRange(); rg.selectNodeContents(pr); return { text: c.innerText.replace(/\n+/g, " / "), tri: c.innerText.includes("▲"), primOver: Math.round(Math.max(...[...rg.getClientRects()].map((x) => x.right)) - pr.parentElement.getBoundingClientRect().right), h: Math.round(c.firstElementChild.getBoundingClientRect().height), div: Math.round(document.querySelector('[data-testid="hub-card-dividend"]').firstElementChild.getBoundingClientRect().height) }; }));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/r6b-hub-${tag}.png` });
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(7000);
  log(`CAPTION ${tag}`, await p.evaluate(() => { const e = document.querySelector('[data-testid="grow-score-caption"]'); if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); return { text: e.innerText, lines: new Set(rs.map((x) => Math.round(x.top))).size, over: Math.round(Math.max(...rs.map((x) => x.right)) - e.parentElement.getBoundingClientRect().right) }; }));
  const reasons = {};
  for (const t of ["360750", "AAPL", "000660"]) { const tg = p.locator(`[data-testid="grow-row"][data-ticker="${t}"] [data-testid="grow-row-toggle"]`); if (!(await tg.count())) continue; await tg.click(); await p.waitForTimeout(700);
    reasons[t] = { reason: await p.locator('[data-testid="grow-sheet-reason"]').innerText().catch(() => null), next: await p.locator('[data-testid="grow-choice-next"]').innerText().catch(() => null), hist: await p.locator('[data-testid="grow-history-row"]').evaluateAll((h) => h.map((x) => x.innerText.replace(/\n+/g, " "))) };
    if (W === 390 && q === "demo=1") await p.locator(`[data-testid="grow-row"][data-ticker="${t}"]`).screenshot({ path: `${OUT}/r6b-sheet-${t}-${tag}.png` });
    const nextOver = await p.evaluate(() => { const n = document.querySelector('[data-testid="grow-choice-next"]'); if (!n) return null; const r = n.getBoundingClientRect(), pr = n.parentElement.getBoundingClientRect(); return Math.round(r.right - pr.right); }); reasons[t].nextOver = nextOver;
    await tg.click(); await p.waitForTimeout(400); }
  log(`REASON ${tag}`, reasons);
  if (q === "demo=1") { await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="report-tab-grade"]').click(); await p.waitForTimeout(1200);
    const gh = p.locator('[data-testid="report-panel-grade"] button:has(svg.lucide-info)'); const gn = await gh.count();
    for (let i = 0; i < gn; i++) { await gh.nth(i).scrollIntoViewIfNeeded(); await gh.nth(i).click(); await p.waitForTimeout(700); log(`GRADE-HINT ${tag} #${i}`, await pop(p)); if (W === 390) await p.screenshot({ path: `${OUT}/r6b-grade-hint${i}-${tag}.png` }); await p.keyboard.press("Escape"); await p.waitForTimeout(300); } }
  if (W === 390) { await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="report-tab-grow"]').click().catch(() => {}); await p.waitForTimeout(500); await p.locator('[data-testid="grow-list"]').screenshot({ path: `${OUT}/r6b-list-${tag}.png` }); }
  log(`ERR ${tag}`, errs); await ctx.close();
}
await b.close();
