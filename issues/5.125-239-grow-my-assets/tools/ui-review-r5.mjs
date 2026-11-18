// 5b ui-review(fb0192d) — preview 실측. 코드 수정 0. node ui-review-r5.mjs <OUT> <widths|flows|hints|hub>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const MODE = process.argv[3];
const b = await chromium.launch({ proxy }); const log = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
async function open(W, q = "demo=1", H, seed, scheme = "dark") { const o = ctxOpt(W, scheme); if (H) o.viewport.height = H; const ctx = await b.newContext(o);
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  if (seed) { await p.evaluate(seed); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(7000); }
  return { ctx, p }; }
const report = async (p) => { await p.evaluate(() => { location.hash = "#activity/report"; }); for (let i = 0; i < 15; i++) { await p.waitForTimeout(1500); if (await p.locator('[data-testid="grow-block"]').count()) break; } await p.waitForTimeout(2500); };
const shot = (p, n, sel) => (sel ? p.locator(sel).first().screenshot({ path: `${OUT}/r5-${n}.png` }) : p.screenshot({ path: `${OUT}/r5-${n}.png` })).catch((e) => console.log("shot", n, e.message.slice(0, 80)));
const M = (p) => p.evaluate(() => {
  const R = (x) => Math.round(x * 10) / 10; const box = (e) => e.getBoundingClientRect(); const q = (s) => document.querySelector(`[data-testid="${s}"]`);
  const blk = q("grow-block"); if (!blk) return null;
  const rng = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); return rs.length ? Math.max(...rs.map((x) => x.right)) : null; };
  // nowrap 조각: 가장 가까운 block/grid/flex 조상(자기 자신 제외, display contents 건너뜀)의 오른쪽 끝과 비교
  const area = (e) => { let a = e.parentElement; while (a && ["inline", "contents", "inline-flex"].includes(getComputedStyle(a).display)) a = a.parentElement; return a; };
  const over = [...blk.querySelectorAll("*")].filter((e) => getComputedStyle(e).whiteSpace === "nowrap" && box(e).width > 0 && !e.closest("[inert]")).map((e) => { const r = rng(e); return { t: e.textContent.trim().slice(0, 28), o: r === null ? -99 : R(r - box(area(e)).right) }; }).sort((a, c) => c.o - a.o).slice(0, 3);
  const trunc = [...blk.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(getComputedStyle(e).overflowX) && box(e).width > 0 && !e.closest("[inert]") && !e.closest("[data-testid='grow-axes']")).map((e) => e.textContent.trim().slice(0, 24));
  const axTrunc = [...blk.querySelectorAll("[data-testid^='grow-axis-'] span")].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent);
  const hit = (s) => { const a = [...blk.querySelectorAll(s)].filter((e) => box(e).height > 0 && !e.closest("[inert]")).map((e) => { const af = getComputedStyle(e, "::after"); const ex = af.content !== "none" && af.position === "absolute" ? Math.max(0, -parseFloat(af.top || 0)) + Math.max(0, -parseFloat(af.bottom || 0)) : 0; return R(box(e).height + ex); }); return a.length ? Math.min(...a) : null; };
  const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].map((r) => { const t = r.querySelector('[data-testid="grow-row-toggle"]'); return `${r.dataset.ticker || r.dataset.key}:${Math.round(box(t).height)}:${Math.round(box(t).bottom + scrollY)}`; });
  const yb = (s) => { const e = q(s); return e ? Math.round(box(e).bottom + scrollY) : null; };
  const txt = document.body.innerText; const colorBad = [...blk.querySelectorAll("[class*='orange'],[class*='amber'],[class*='important']")].length;
  return { docW: document.documentElement.scrollWidth, card: yb("grow-total-card"), summary: q("grow-summary")?.innerText.replace(/\n+/g, " ¦ "), guide: q("grow-guide")?.innerText ?? null, buckets: [...blk.querySelectorAll('[data-testid="grow-bucket"]')].map((x) => x.firstElementChild?.innerText.replace(/\n+/g, " ")), rows, over, trunc, axTrunc, nametag: (txt.match(/이름표/g) || []).length, colorBad,
    hit: { axis: hit("[data-testid^='grow-axis-']"), row: hit('[data-testid="grow-row-toggle"]'), choice: hit("[data-testid^='grow-choice-']"), plan: hit('[data-testid="grow-plan-summary"]'), open: hit('[data-testid="grow-row-open"]'), cycle: hit('[data-testid="grow-cycle-row"]') } };
});
if (MODE === "widths") for (const [W, q, sc] of [[320, "demo=1"], [360, "demo=1"], [390, "demo=1"], [430, "demo=1"], [768, "demo=1"], [1024, "demo=1"], [1280, "demo=1"], [390, "trial=1"], [390, "trial=1", "light"], [320, "trial=1"]]) {
  const { ctx, p } = await open(W, q, undefined, undefined, sc ?? "dark"); await report(p); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  const tag = `${q.slice(0, -2)}-${W}-${sc ?? "dark"}`; await shot(p, `first-${tag}`); log(`W ${tag}`, await M(p)); log(`ERR ${tag}`, p.errs); await shot(p, `block-${tag}`, '[data-testid="grow-block"]'); await ctx.close();
}
if (MODE === "flows") {
  const { ctx, p } = await open(390); await report(p);
  // 점검 한 장(Apple)
  const apple = p.locator('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); await apple.click(); await p.waitForTimeout(800);
  const sheetInfo = () => p.evaluate(() => { const s = document.querySelector('[data-testid="grow-sheet"]'); if (!s) return null; return { sections: [...s.children].filter((c) => c.getBoundingClientRect().height > 0).map((c) => (c.dataset.testid || c.tagName) + ":" + c.innerText.replace(/\n+/g, " ¦ ").slice(0, 70)), h: Math.round(s.getBoundingClientRect().height), hideMemo: !!s.querySelector('[data-screenshot-hide] [data-testid="grow-plan-memo"]') }; });
  log("SHEET", await sheetInfo()); await shot(p, "sheet-390", '[data-testid="grow-list"]');
  await p.locator('[data-testid="grow-plan-summary"]').click(); await p.waitForTimeout(600); log("FORM", await sheetInfo()); await shot(p, "sheet-form-390", '[data-testid="grow-sheet"]');
  // 자동 저장: 상한 입력 → Enter → 요약
  await p.locator('[data-testid="grow-plan-up"]').fill("30"); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  log("AFTER-ENTER", await p.evaluate(() => { const l = JSON.parse(localStorage.getItem("secretasset.stock_labels")); return l.items.AAPL.plan; }));
  // 범위 밖 → 끝값
  await p.locator('[data-testid="grow-plan-up"]').fill("900"); await p.locator('[data-testid="grow-plan-memo"]').click(); await p.waitForTimeout(500);
  log("CLAMP", { field: await p.locator('[data-testid="grow-plan-up"]').inputValue(), saved: await p.evaluate(() => JSON.parse(localStorage.getItem("secretasset.stock_labels")).items.AAPL.plan) });
  // 입력 중(blur 전) 접기 버튼 → 저장되나
  await p.locator('[data-testid="grow-plan-memo"]').fill("메모 바꿈 테스트"); await p.locator('[data-testid="grow-plan-form"] > button').click(); await p.waitForTimeout(500);
  log("COLLAPSE-SAVE", { memo: await p.evaluate(() => JSON.parse(localStorage.getItem("secretasset.stock_labels")).items.AAPL.plan?.memo), summary: await p.locator('[data-testid="grow-plan-summary"]').innerText().catch(() => null) });
  // 입력 중 화면 이탈(뒤로) → 저장되나
  await p.locator('[data-testid="grow-plan-summary"]').click(); await p.waitForTimeout(400); await p.locator('[data-testid="grow-plan-memo"]').fill("이탈 전 입력"); await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(1500);
  log("LEAVE-SAVE", await p.evaluate(() => JSON.parse(localStorage.getItem("secretasset.stock_labels")).items.AAPL.plan?.memo));
  await report(p); await p.locator('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]').click(); await p.waitForTimeout(600);
  // 그대로 둠 → 오늘 점검함
  await p.locator('[data-testid="grow-choice-same"]').click(); await p.waitForTimeout(800);
  log("SAME", { reason: await p.locator('[data-testid="grow-sheet-reason"]').innerText().catch(() => null), btn: await p.locator('[data-testid="grow-choice-same"]').innerText(), aria: await p.locator('[data-testid="grow-choice-same"]').getAttribute("aria-disabled"), dis: await p.locator('[data-testid="grow-choice-same"]').isDisabled(), due: await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').getAttribute("data-due"), hist: await p.locator('[data-testid="grow-history-row"]').count(), card: await p.locator('[data-testid="grow-summary"]').innerText() });
  await shot(p, "sheet-done-390", '[data-testid="grow-sheet"]');
  // 거르기
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="grow-axis-hold"]').click(); await p.waitForTimeout(600); await shot(p, "panel-390", '[data-testid="grow-total-card"]');
  await p.locator('[data-testid="grow-group"]').first().click(); await p.waitForTimeout(700);
  log("FILTER", { axis: await p.locator('[data-testid="grow-axis-hold"]').innerText(), aria: await p.locator('[data-testid="grow-axis-hold"]').getAttribute("aria-label"), fact: await p.locator('[data-testid="grow-filter-fact"]').innerText().catch(() => null), buckets: await p.locator('[data-testid="grow-bucket"]').evaluateAll((bs) => bs.map((x) => x.firstElementChild.innerText.replace(/\n/g, " "))), rows: await p.locator('[data-testid="grow-row"]').count() });
  await shot(p, "filter-390"); await p.locator('[data-testid="grow-axis-hold"]').click(); await p.waitForTimeout(600); log("UNFILTER", { rows: await p.locator('[data-testid="grow-row"]').count(), axis: await p.locator('[data-testid="grow-axis-hold"]').innerText() });
  log("ERR flows", p.errs); await ctx.close();
  // 첫 사용자
  for (const [W, q] of [[390, "demo=1"], [320, "trial=1"]]) { const o = await open(W, q, undefined, () => localStorage.removeItem("secretasset.stock_labels")); await report(o.p); await o.p.evaluate(() => scrollTo(0, 0)); log(`FIRST-USER ${W} ${q}`, await M(o.p)); await shot(o.p, `first-user-${q.slice(0, -2)}-${W}`); log("ERR", o.p.errs); await o.ctx.close(); }
}
if (MODE === "hints") for (const [W, H] of [[320, 844], [390, 600], [1280, 900]]) {
  const { ctx, p } = await open(W, "demo=1", H); await report(p);
  const tr = p.locator('[data-testid="grow-block"] button:has(svg.lucide-info)'); const n = await tr.count(); log(`HINTS ${W}x${H}`, n);
  for (let i = 0; i < n; i++) { await tr.nth(i).scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await tr.nth(i).click(); await p.waitForTimeout(800);
    log(`HINT ${W}x${H} #${i}`, await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!pop) return null; const split = []; pop.querySelectorAll("p, li, span").forEach((el) => { for (const nd of el.childNodes) { if (nd.nodeType !== 3) continue; for (const m of nd.textContent.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(nd, m.index); rg.setEnd(nd, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); } } }); const r = pop.getBoundingClientRect(); return { split: [...new Set(split)], top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, scroll: pop.scrollHeight > pop.clientHeight + 1, text: pop.innerText.replace(/\n+/g, " / ").slice(0, 300) }; }));
    await shot(p, `hint${i}-${W}x${H}`); await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  await ctx.close();
}
if (MODE === "hub") for (const [W, sc, q, zero] of [[320, "dark", "demo=1"], [359, "dark", "demo=1"], [390, "dark", "demo=1"], [1024, "dark", "demo=1"], [1280, "dark", "demo=1"], [390, "dark", "trial=1"], [390, "dark", "demo=1", true]]) {
  const { ctx, p } = await open(W, q, undefined, zero ? () => localStorage.removeItem("secretasset.stock_labels") : undefined, sc);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4500);
  log(`HUB ${q}-${W}${zero ? "-zero" : ""}`, await p.evaluate(() => { const h = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e ? Math.round(e.firstElementChild.getBoundingClientRect().height * 10) / 10 : null; }; const pr = document.querySelector('[data-testid="hub-report-primary"]'), s = document.querySelector('[data-testid="hub-report-secondary"]'); const rr = (e) => { const rg = document.createRange(); rg.selectNodeContents(e); return Math.round(Math.max(...[...rg.getClientRects()].map((x) => x.right)) - e.parentElement.getBoundingClientRect().right); }; return { report: h("hub-card-report"), dividend: h("hub-card-dividend"), prim: pr?.innerText, primOver: pr ? rr(pr) : null, sec: s?.innerText, secOver: s ? rr(s) : null, nametag: (document.body.innerText.match(/이름표/g) || []).length }; }));
  await shot(p, `hub-${q.slice(0, -2)}-${W}${zero ? "-zero" : ""}`, '[data-testid="hub-card-report"]'); await ctx.close();
}
await b.close();
