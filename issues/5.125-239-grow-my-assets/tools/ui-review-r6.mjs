// 6차 ui-review(32bf4aa) — 보이는 표기 전수 수집(C139)·폭·흐름. 코드 수정 0. node ui-review-r6.mjs <OUT> <inventory|widths|states>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const MODE = process.argv[3];
const b = await chromium.launch({ proxy }); const log = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
async function open(W, q = "demo=1", H, seed, scheme = "dark") { const o = ctxOpt(W, scheme); if (H) o.viewport.height = H; const ctx = await b.newContext(o);
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  if (seed) { await p.evaluate(seed); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(7000); }
  return { ctx, p }; }
const go = async (p, h, ms = 5000) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(ms); };
const shot = (p, n, sel) => (sel ? p.locator(sel).first().screenshot({ path: `${OUT}/r6-${n}.png` }) : p.screenshot({ path: `${OUT}/r6-${n}.png` })).catch((e) => console.log("shot", n, e.message.slice(0, 80)));
const lines = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; return [...new Set(e.innerText.split("\n").map((x) => x.trim()).filter(Boolean))]; }, sel);
const pop = (p) => p.evaluate(() => { const x = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!x) return null; const split = []; x.querySelectorAll("p, li, span, div").forEach((el) => { for (const nd of el.childNodes) { if (nd.nodeType !== 3) continue; for (const m of nd.textContent.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(nd, m.index); rg.setEnd(nd, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((r) => r.width > 0).map((r) => Math.round(r.top))).size > 1) split.push(m[0]); } } }); const r = x.getBoundingClientRect(); return { text: x.innerText.replace(/\n+/g, " / "), split: [...new Set(split)], top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight }; });
if (MODE === "inventory") {
  const { ctx, p } = await open(390);
  await go(p, "#activity", 4000); log("HUB(첫 진입)", await lines(p, '[data-testid="hub-card-report"]')); await shot(p, "hub-first-390", '[data-testid="hub-card-report"]');
  await go(p, "#activity/report", 7000); log("TITLE", await lines(p, '[data-testid="grow-title"]')); log("SEG", await lines(p, '[data-testid="report-tabs"]'));
  log("CARD", await lines(p, '[data-testid="grow-total-card"]')); await p.evaluate(() => scrollTo(0, 0)); await shot(p, "first-390");
  for (const ax of ["hold", "etf", "sector", "cap"]) { await p.locator(`[data-testid="grow-axis-${ax}"]`).click(); await p.waitForTimeout(700); log(`PANEL ${ax}`, await lines(p, '[data-testid="grow-groups"]')); await shot(p, `panel-${ax}-390`, '[data-testid="grow-total-card"]'); }
  await p.locator('[data-testid="grow-axis-cap"]').click(); await p.waitForTimeout(500);
  log("LIST", await lines(p, '[data-testid="grow-list"]'));
  for (const t of ["AAPL", "360750", "069500"]) { const tg = p.locator(`[data-testid="grow-row"][data-ticker="${t}"] [data-testid="grow-row-toggle"]`); await tg.click(); await p.waitForTimeout(700); log(`SHEET ${t}`, await lines(p, '[data-testid="grow-sheet"]')); await shot(p, `sheet-${t}-390`, `[data-testid="grow-row"][data-ticker="${t}"]`); if (t === "AAPL") { await p.locator('[data-testid="grow-plan-summary"]').click(); await p.waitForTimeout(500); log("FORM", await lines(p, '[data-testid="grow-plan-form"]')); await shot(p, "form-390", '[data-testid="grow-sheet"]'); } await tg.click(); await p.waitForTimeout(500); }
  // ⓘ 전부(종목 점검 칸)
  const hints = p.locator('[data-testid="report-panel-grow"] button:has(svg.lucide-info), [data-testid="grow-title"] ~ * button:has(svg.lucide-info)'); const n = await hints.count();
  for (let i = 0; i < n; i++) { await hints.nth(i).scrollIntoViewIfNeeded(); await hints.nth(i).click(); await p.waitForTimeout(700); log(`HINT grow#${i}`, await pop(p)); await shot(p, `hint-grow${i}-390`); await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
  // 성적표 칸
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="report-tab-grade"]').click(); await p.waitForTimeout(1500); await shot(p, "grade-tab-390");
  log("GRADE", await lines(p, '[data-testid="report-panel-grade"]'));
  const gh = p.locator('[data-testid="report-panel-grade"] button:has(svg.lucide-info)'); const gn = await gh.count(); log("GRADE hints", gn);
  for (let i = 0; i < gn; i++) { await gh.nth(i).scrollIntoViewIfNeeded(); await gh.nth(i).click(); await p.waitForTimeout(700); log(`HINT grade#${i}`, await pop(p)); await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
  await go(p, "#activity", 4000); log("HUB(성적표 연 뒤)", await lines(p, '[data-testid="hub-card-report"]')); await shot(p, "hub-after-390", '[data-testid="hub-card-report"]');
  log("ERR", p.errs); await ctx.close();
}
if (MODE === "widths") for (const [W, q, sc] of [[320, "demo=1"], [360, "demo=1"], [390, "demo=1"], [430, "demo=1"], [768, "demo=1"], [1024, "demo=1"], [1280, "demo=1"], [390, "trial=1"], [390, "trial=1", "light"]]) {
  const { ctx, p } = await open(W, q, undefined, undefined, sc ?? "dark"); await go(p, "#activity/report", 7000); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  const tag = `${q.slice(0, -2)}-${W}-${sc ?? "dark"}`; await shot(p, `first-${tag}`);
  log(`W ${tag}`, await p.evaluate(() => { const box = (e) => e.getBoundingClientRect(); const blk = document.querySelector('[data-testid="report-panel-grow"]');
    const trunc = [...document.querySelectorAll('[data-testid="report-tabs"] *, [data-testid="report-panel-grow"] *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(getComputedStyle(e).overflowX) && box(e).width > 0).map((e) => e.textContent.trim().slice(0, 24));
    const hit = (s) => { const a = [...document.querySelectorAll(s)].filter((e) => box(e).height > 0).map((e) => { const af = getComputedStyle(e, "::after"); const ex = af.content !== "none" && af.position === "absolute" ? Math.max(0, -parseFloat(af.top || 0)) + Math.max(0, -parseFloat(af.bottom || 0)) : 0; return Math.round(box(e).height + ex); }); return a.length ? Math.min(...a) : null; };
    const rows = [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].map((e) => Math.round(box(e).height));
    const bg = getComputedStyle(document.body).backgroundColor;
    return { docW: document.documentElement.scrollWidth, segB: Math.round(box(document.querySelector('[data-testid="report-tabs"]')).bottom), cardB: Math.round(box(document.querySelector('[data-testid="grow-total-card"]')).bottom), rowBottoms: [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].slice(0, 4).map((e) => Math.round(box(e).bottom)), rows, trunc, hit: { tab: hit('[data-testid^="report-tab-"]'), axis: hit('[data-testid^="grow-axis-"]'), row: hit('[data-testid="grow-row-toggle"]'), cycle: hit('[data-testid="grow-cycle-row"]') }, bg }; }));
  log(`ERR ${tag}`, p.errs); await ctx.close();
}
if (MODE === "states") {
  // 첫 사용자(데모 저장 키 삭제)
  for (const W of [390, 320]) { const { ctx, p } = await open(W, "demo=1", undefined, () => localStorage.removeItem("secretasset.stock_labels")); await go(p, "#activity/report", 7000); await p.evaluate(() => scrollTo(0, 0));
    log(`FIRST-USER ${W}`, { seg: await lines(p, '[data-testid="report-tabs"]'), card: await lines(p, '[data-testid="grow-total-card"]'), list: (await lines(p, '[data-testid="grow-list"]'))?.slice(0, 12) }); await shot(p, `first-user-${W}`); 
    if (W === 390) { // 오늘 정함: 삼성전자를 장기 보유로
      await p.locator('[data-testid="grow-row"][data-ticker="005930"] [data-testid="grow-row-toggle"]').click(); await p.waitForTimeout(600); log("SHEET none", await lines(p, '[data-testid="grow-sheet"]'));
      await p.locator('[data-testid="grow-sheet"] button', { hasText: "장기 보유" }).first().click(); await p.waitForTimeout(900);
      log("TODAY", { row: await p.locator('[data-testid="grow-row"][data-ticker="005930"]').innerText().then((t) => t.replace(/\n+/g, " | ")), seg: await lines(p, '[data-testid="report-tabs"]'), card: await lines(p, '[data-testid="grow-total-card"]') }); await shot(p, "today-390", '[data-testid="grow-list"]');
      await go(p, "#activity", 4000); log("HUB first-user", await lines(p, '[data-testid="hub-card-report"]')); }
    log("ERR", p.errs); await ctx.close(); }
  // 체험 라이트 — 앱 설정 키로 라이트
  { const { ctx, p } = await open(390, "trial=1", undefined, () => { for (const k of Object.keys(localStorage)) if (/theme/i.test(k)) console.log(k); localStorage.setItem("theme_mode", "light"); document.cookie = "theme_mode=light; path=/"; }, "light"); await go(p, "#activity/report", 7000); await p.evaluate(() => scrollTo(0, 0));
    log("TRIAL-LIGHT", await p.evaluate(() => ({ bg: getComputedStyle(document.body).backgroundColor, dark: document.documentElement.classList.contains("dark"), keys: Object.keys(localStorage).filter((k) => /theme|mode/i.test(k)) }))); await shot(p, "trial-light-390"); await ctx.close(); }
  // ⓘ 320·390×600·1280
  for (const [W, H] of [[320, 844], [390, 600], [1280, 900]]) { const { ctx, p } = await open(W, "demo=1", H); await go(p, "#activity/report", 7000);
    const hs = p.locator('[data-testid="report-panel-grow"] button:has(svg.lucide-info)'); const n = await hs.count();
    for (let i = 0; i < n; i++) { await hs.nth(i).scrollIntoViewIfNeeded(); await hs.nth(i).click(); await p.waitForTimeout(700); const r = await pop(p); log(`HINT ${W}x${H} #${i}`, r && { split: r.split, top: r.top, bottom: r.bottom, vh: r.vh }); await p.keyboard.press("Escape"); await p.waitForTimeout(300); }
    await ctx.close(); }
}
await b.close();
