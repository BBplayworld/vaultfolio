// 재설계 3차 ui-review(c43d375) — preview 실측. 코드 수정 0. node ui-review-r3x.mjs <OUT> <widths|hints|hub|states>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const MODE = process.argv[3];
const b = await chromium.launch({ proxy }); const log = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
async function open(W, scheme = "dark", q = "demo=1", H, seed) { const o = ctxOpt(W, scheme); if (H) o.viewport.height = H; const ctx = await b.newContext(o);
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  if (seed) { await p.evaluate(seed); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(7000); }
  return { ctx, p }; }
const report = async (p) => { await p.evaluate(() => { location.hash = "#activity/report"; }); for (let i = 0; i < 15; i++) { await p.waitForTimeout(1500); if (await p.locator('[data-testid="grow-block"]').count()) break; } await p.waitForTimeout(2500); };
const M = (p) => p.evaluate(() => {
  const R = (x) => Math.round(x * 10) / 10; const box = (e) => e.getBoundingClientRect(); const q = (s, r = document) => r.querySelector(`[data-testid="${s}"]`);
  const blk = q("grow-block"); if (!blk) return null;
  const rng = (el) => { const rg = document.createRange(); rg.selectNodeContents(el); const rs = [...rg.getClientRects()].filter((x) => x.width > 0); return rs.length ? { r: Math.max(...rs.map((x) => x.right)), l: Math.min(...rs.map((x) => x.left)), lines: new Set(rs.map((x) => Math.round(x.bottom))).size } : null; };
  // nowrap 조각: 가장 가까운 '영역'(overflow 아닌 블록 조상 중 grid 칸/버튼) 오른쪽 끝과 비교
  const area = (e) => { let a = e.parentElement; while (a && getComputedStyle(a).display === "inline") a = a.parentElement; return a; };
  const pieces = [...blk.querySelectorAll("*")].filter((e) => getComputedStyle(e).whiteSpace === "nowrap" && box(e).width > 0 && !e.closest("[inert]") && !e.closest('[aria-hidden="true"]')).map((e) => { const rr = rng(e); const a = box(area(e)); return { t: e.textContent.trim().slice(0, 30), over: rr ? R(rr.r - a.right) : 0, overL: rr ? R(a.left - rr.l) : 0 }; });
  const worst = pieces.sort((x, y) => y.over - x.over).slice(0, 3);
  const trunc = [...blk.querySelectorAll("*")].filter((e) => e.scrollWidth > e.clientWidth + 1 && /hidden|clip/.test(getComputedStyle(e).overflowX) && box(e).width > 0 && !e.closest("[inert]")).map((e) => e.textContent.trim().slice(0, 24));
  const colorCls = [...blk.querySelectorAll("[class*='rose-'],[class*='blue-'],[class*='orange'],[class*='amber'],[class*='important']")].map((e) => e.dataset.testid || e.parentElement?.dataset.testid || e.className.split(" ").find((c) => /rose|blue|orange|amber|important/.test(c)));
  const hit = (s) => [...blk.querySelectorAll(s)].filter((e) => box(e).height > 0 && !e.closest("[inert]")).map((e) => { const a = getComputedStyle(e, "::after"); const extra = a.content !== "none" && a.position === "absolute" ? -parseFloat(a.top || 0) - parseFloat(a.bottom || 0) : 0; return R(box(e).height + (extra > 0 ? extra : 0)); });
  const mn = (a) => (a.length ? Math.min(...a) : null);
  const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].filter((r) => !r.closest("[inert]")).map((r) => ({ t: r.dataset.ticker ?? r.dataset.key, h: Math.round(box(r).height), txt: r.innerText.replace(/\n+/g, " | ").slice(0, 90) }));
  const groups = [...blk.querySelectorAll('[data-testid="grow-group"]')].map((g) => ({ txt: g.innerText.replace(/\n+/g, " ¦ "), h: Math.round(box(g).height) }));
  const yb = (s) => { const e = q(s); return e ? Math.round(box(e).bottom + scrollY) : null; };
  return { vw: innerWidth, docW: document.documentElement.scrollWidth, total: q("grow-total-card")?.innerText.replace(/\n+/g, " ¦ "), y: { card: yb("grow-total-card"), axes: yb("grow-axes"), list: yb("grow-list") }, rowTops: [...blk.querySelectorAll('[data-testid="grow-row"]')].slice(0, 4).map((r) => Math.round(box(r).bottom + scrollY)), groups, rows, worst, trunc, colorCls: [...new Set(colorCls)], hit: { tabs: mn(hit('[data-testid="grow-axes"] [role="tab"], [data-testid="grow-axes"] [role="radio"], [data-testid="grow-axes"] button:not([data-testid])')), group: mn(hit('[data-testid="grow-group"]')), chip: mn(hit('[data-testid="grow-chip"]')), open: mn(hit('[data-testid="grow-row-open"]')), cycle: mn(hit('[data-testid="grow-cycle-row"]')), more: mn(hit('[data-testid="grow-more"]')) } };
});
const shot = (p, n, sel) => (sel ? p.locator(sel).screenshot({ path: `${OUT}/r3x-${n}.png` }) : p.screenshot({ path: `${OUT}/r3x-${n}.png` })).catch((e) => console.log("shot", n, e.message.slice(0, 80)));

if (MODE === "widths") for (const [W, sc, q] of [[320, "dark", "demo=1"], [360, "dark", "demo=1"], [390, "dark", "demo=1"], [430, "dark", "demo=1"], [768, "dark", "demo=1"], [1024, "dark", "demo=1"], [1280, "dark", "demo=1"], [390, "light", "trial=1"], [390, "dark", "trial=1"], [320, "dark", "trial=1"]]) {
  const { ctx, p } = await open(W, sc, q); await report(p); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  const tag = `${q.slice(0, -2)}-${W}-${sc}`; await shot(p, `first-${tag}`);
  const m = await M(p); log(`W ${tag}`, m); log(`ERR ${tag}`, p.errs); await shot(p, `block-${tag}`, '[data-testid="grow-block"]'); await ctx.close();
}
if (MODE === "hints") for (const [W, H] of [[320, 844], [390, 600], [1280, 900]]) {
  const { ctx, p } = await open(W, "dark", "demo=1", H); await report(p);
  const n = await p.locator('[data-testid="grow-block"] [data-slot="popover-trigger"], [data-testid="grow-block"] button:has(svg.lucide-info)').count(); log(`HINTS ${W}x${H} count`, n);
  for (let i = 0; i < n; i++) { const t = p.locator('[data-testid="grow-block"] [data-slot="popover-trigger"], [data-testid="grow-block"] button:has(svg.lucide-info)').nth(i); await t.scrollIntoViewIfNeeded(); await p.waitForTimeout(300); await t.click(); await p.waitForTimeout(800);
    log(`HINT ${W}x${H} #${i}`, await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!pop) return null; const split = []; pop.querySelectorAll("p").forEach((el) => { const t = el.firstChild; if (!t || t.nodeType !== 3) return; for (const m of el.textContent.matchAll(/\S+/g)) { if (m.index + m[0].length > t.length) break; const rg = document.createRange(); rg.setStart(t, m.index); rg.setEnd(t, m.index + m[0].length); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); } }); const r = pop.getBoundingClientRect(); return { split, top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), vh: innerHeight, vw: innerWidth, ps: [...pop.querySelectorAll("p")].map((e) => getComputedStyle(e).wordBreak).join(","), text: pop.innerText.replace(/\n+/g, " / ") }; }));
    await shot(p, `hint${i}-${W}x${H}`); await p.keyboard.press("Escape"); await p.waitForTimeout(400); }
  const tr = await p.locator('[data-testid="grow-block"] button').evaluateAll((bs) => bs.filter((x) => x.querySelector("svg.lucide-info")).map((x) => { const r = x.getBoundingClientRect(); const a = getComputedStyle(x, "::after"); return `${Math.round(r.width)}x${Math.round(r.height)} after:${a.top}`; })); log(`HINT-HIT ${W}`, tr);
  await ctx.close();
}
if (MODE === "hub") {
  const hubM = (p) => p.evaluate(() => { const h = (id) => { const e = document.querySelector(`[data-testid="${id}"]`); return e ? Math.round(e.firstElementChild.getBoundingClientRect().height * 10) / 10 : null; }; const s = document.querySelector('[data-testid="hub-report-secondary"]'); const rg = s && document.createRange(); if (rg) rg.selectNodeContents(s); const rs = rg ? [...rg.getClientRects()].filter((x) => x.width > 0) : []; return { report: h("hub-card-report"), dividend: h("hub-card-dividend"), change: h("hub-card-change"), sec: s?.innerText ?? null, secLines: new Set(rs.map((x) => Math.round(x.bottom))).size, secOver: s ? Math.round(Math.max(...rs.map((x) => x.right)) - s.parentElement.getBoundingClientRect().right) : null, prim: document.querySelector('[data-testid="hub-report-primary"]')?.innerText }; });
  for (const [W, sc, q, zero] of [[320, "dark", "demo=1"], [359, "dark", "demo=1"], [360, "dark", "demo=1"], [390, "dark", "demo=1"], [1024, "dark", "demo=1"], [1280, "dark", "demo=1"], [390, "light", "trial=1"], [320, "dark", "demo=1", true], [390, "dark", "demo=1", true]]) {
    const { ctx, p } = await open(W, sc, q, undefined, zero ? () => localStorage.removeItem("secretasset.stock_labels") : undefined);
    await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4500);
    const tag = `${q.slice(0, -2)}-${W}-${sc}${zero ? "-zero" : ""}`; log(`HUB ${tag}`, await hubM(p)); await shot(p, `hub-${tag}`, '[data-testid="hub-card-report"]'); await ctx.close(); }
}
if (MODE === "states") {
  const { ctx, p } = await open(390); await report(p);
  for (const tab of ["ETF·개별", "핵심 분야", "시가총액", "보유 기간"]) { await p.locator('[data-testid="grow-axes"]').getByText(tab, { exact: true }).first().click(); await p.waitForTimeout(700); const m = await M(p); log(`TAB ${tab}`, m.groups); await shot(p, `tab-${tab.replace("·", "")}-390`, '[data-testid="grow-axes"]'); }
  await p.locator('[data-testid="grow-group"]').first().click(); await p.waitForTimeout(700);
  log("FILTER", { chip: await p.locator('[data-testid="grow-filter-chip"]').innerText().catch(() => null), pressed: await p.locator('[data-testid="grow-group"]').first().getAttribute("aria-pressed"), rows: (await M(p)).rows.map((r) => r.t) }); await shot(p, "filter-390", '[data-testid="grow-block"]');
  await p.locator('[data-testid="grow-filter-chip"]').click(); await p.waitForTimeout(600); log("FILTER-X", { rows: (await M(p)).rows.length, chip: await p.locator('[data-testid="grow-filter-chip"]').count() });
  await p.locator('[data-testid="grow-chip"]').nth(1).click(); await p.waitForTimeout(700); log("CHIP", await p.locator('[data-testid="grow-panel"]').first().innerText().catch(() => null)); await shot(p, "chip-390", '[data-testid="grow-list"]');
  log("ERR", p.errs); await ctx.close();
  // 그 밖 N개 + 미분류: 종목 3개 추가(분류 2개 주입, 1개 미분류)
  const seed = () => { const AK = "secretasset_asset_data"; const a = JSON.parse(localStorage.getItem(AK)); const add = (id, name, ticker, q, avg, cur) => a.stocks.push({ id, category: "foreign", name, ticker, quantity: q, averagePrice: avg, currentPrice: cur, currency: "USD", purchaseDate: "2025-03-02", purchaseExchangeRate: 1350, broker: "데모증권" });
    add("seed_bio", "가상바이오", "ZZBIO", 10, 50, 46); add("seed_fin", "가상핀테크", "ZZFIN", 10, 40, 52); add("seed_unc", "가상미분류", "ZZUNC", 5, 20, 21); localStorage.setItem(AK, JSON.stringify(a));
    const K = "secretasset_stock_classification"; const c = JSON.parse(localStorage.getItem(K) ?? '{"version":1,"updatedAt":"","data":{}}'); c.data.ZZBIO = { sector: "바이오 및 헬스케어", marketCapTier: "mid" }; c.data.ZZFIN = { sector: "금융 및 핀테크", marketCapTier: "small" }; localStorage.setItem(K, JSON.stringify(c)); };
  for (const W of [390, 320]) { const o = await open(W, "dark", "demo=1", undefined, seed); await report(o.p);
    for (const tab of ["핵심 분야", "시가총액"]) { await o.p.locator('[data-testid="grow-axes"]').getByText(tab, { exact: true }).first().click(); await o.p.waitForTimeout(700); const m = await M(o.p); log(`MORE ${W} ${tab}`, { groups: m.groups, more: await o.p.locator('[data-testid="grow-groups-more"]').innerText().catch(() => null), unc: await o.p.locator('[data-testid="grow-unclassified-caption"]').innerText().catch(() => null), worst: m.worst, trunc: m.trunc }); await shot(o.p, `more-${tab.replace(" ", "")}-${W}`, '[data-testid="grow-axes"]'); }
    if (await o.p.locator('[data-testid="grow-groups-more"]').count()) { await o.p.locator('[data-testid="grow-groups-more"]').click(); await o.p.waitForTimeout(600); log(`MORE-OPEN ${W}`, (await M(o.p)).groups.map((g) => g.txt.split(" ¦ ")[0])); await shot(o.p, `more-open-${W}`, '[data-testid="grow-axes"]'); }
    log(`ERR more ${W}`, o.p.errs); await o.ctx.close(); }
}
await b.close();
