import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const BR = process.argv[2] ?? "5130";
const PV = `https://secretasset-git-issue-${BR}-bbplayworlds-projects.vercel.app`;
const mode = process.argv[3] ?? "rows";
const WIDTHS = process.argv.slice(4).map(Number);
const br = await chromium.launch({ proxy });
const SHOT = "/home/user/vaultfolio/.memory/issues/5.130-245-my-decision-everywhere/screenshots/dev/";
async function fresh(W, fixed) {
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 700 });
  const p = await ctx.newPage();
  if (fixed) await p.clock.setFixedTime(new Date(fixed));
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForFunction(() => document.documentElement.dataset.demoReady === "1", null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(4000);
  return p;
}
const go = async (p, h) => { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(3000); };
const LINES = (el) => { const out = new Map(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const rg = document.createRange();
  while ((n = w.nextNode())) { const pe = n.parentElement; if (getComputedStyle(pe).display === "none" || pe.getBoundingClientRect().width === 0) continue; for (let i = 0; i < n.data.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; if (!r || r.width === 0) continue; const k = Math.round((r.top + r.height / 2) / 8); const o = out.get(k) ?? { s: "", x: r.left }; o.s += n.data[i]; o.x = Math.min(o.x, r.left); out.set(k, o); } }
  return [...out.entries()].sort((a, b) => a[0] - b[0]).map((x) => ({ t: x[1].s.trim(), x: +x[1].x.toFixed(1) })); };
for (const W of WIDTHS) {
  if (mode === "rows") {
    const p = await fresh(W); await go(p, "#detail/stocks");
    // 이름표 읽기 전후 밀림: 첫 렌더 직후와 4초 뒤 비교는 fresh 대기로 대체 — 높이만 기록
    const r = await p.evaluate(() => [...document.querySelectorAll('[data-testid="stock-row-left"]')].map((l) => { const b = l.closest("button"); const d = l.querySelector('[data-testid="stock-row-decision"]'); return `${l.querySelector("span").textContent.slice(0, 10)}:${b.getBoundingClientRect().height.toFixed(1)}${d ? (getComputedStyle(d).display === "none" ? `(${d.dataset.kind} 숨김)` : `(${d.dataset.kind} 보임)`) : ""}`; }));
    console.log(BR, W, r.join(" | "));
    await p.context().close();
  } else if (mode === "tiles") {
    const fixed = process.env.FIXED;
    const p = await fresh(W, fixed); await go(p, "#detail/stocks");
    const t = await p.evaluate((LS) => { const LINES = eval(LS); const g = document.querySelector('[data-testid="stock-tools"]'); return { cols: getComputedStyle(g).gridTemplateColumns, h: +g.getBoundingClientRect().height.toFixed(1), tiles: [...g.children].map((b) => `${b.dataset.testid}:${b.getBoundingClientRect().height.toFixed(1)} ${JSON.stringify(LINES(b).map((l) => l.t))}`) }; }, LINES.toString());
    console.log(W, fixed ?? "now", JSON.stringify(t, null, 0));
    await p.locator('[data-testid="stock-tools"]').screenshot({ path: `${SHOT}dv-${W}-tiles${fixed ? "-oct" : ""}.png` });
    await p.context().close();
  } else if (mode === "head") {
    const p = await fresh(W); await go(p, "#detail/stocks");
    const pr = await p.evaluate(() => { const a = JSON.parse(localStorage.getItem("secretasset-asset-data") ?? localStorage.getItem("secretasset_asset_data")); return a.stocks.find((s) => s.ticker === "NVDA")?.currentPrice; });
    await p.evaluate((pr) => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const d = (n) => new Date(Date.now() - n * 864e5).toISOString();
      v.items.NVDA = { label: "check", labeledAt: d(30), at: d(30), base: { qty: 8, price: pr / (1 - 0.063) }, plan: { down: 15, up: 25, at: d(30) } }; localStorage.setItem(k, JSON.stringify(v)); }, pr);
    await p.goto(`${PV}/?t=${Date.now()}#detail/stocks`, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(5000);
    const name = "엔비디아";
    const card = p.locator('[data-testid="detail-list-box-stocks"] > div', { has: p.locator(`[data-testid="stock-row-left"] span:text-is("${name}")`) }).first();
    if (!(await card.locator('[data-testid="stock-page-entry"]').count())) { await card.locator('[data-slot="collapsible-trigger"]').click(); await p.waitForTimeout(700); }
    await card.locator('[data-testid="stock-page-entry"]').click(); await p.waitForSelector('[data-testid="stock-page-head"]'); await p.waitForTimeout(1500);
    const h = await p.evaluate((LS) => { const LINES = eval(LS); const d = document.querySelector('[data-testid="stock-page-decision"]'); if (!d) return null; const clip = d.getBoundingClientRect().left + 8;
      return { visibleLeft: +clip.toFixed(1), headH: +document.querySelector('[data-testid="stock-page-head"]').getBoundingClientRect().height.toFixed(1), lines: LINES(d).filter((l) => !(l.t === "·" && l.x < clip)) }; }, LINES.toString());
    console.log(W, JSON.stringify(h));
    await p.locator('[data-testid="stock-page-head"]').screenshot({ path: `${SHOT}dv-${W}-head-nvda.png` });
    await p.context().close();
  } else if (mode === "wn") {
    const p = await fresh(W); 
    await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } })));
    let ok = await p.locator('[data-testid="whats-new-sheet"]').count();
    if (!ok) { // 더보기 메뉴 열기
      const btns = p.locator('button[aria-label*="더보기"], [data-testid="tool-menu-trigger"]'); if (await btns.count()) { await btns.first().click(); await p.waitForTimeout(800); await p.locator('[data-testid="more-whats-new"]').first().click().catch(() => {}); }
    }
    await p.waitForTimeout(1200);
    const it = await p.evaluate((LS) => { const LINES = eval(LS); const li = [...document.querySelectorAll('[data-testid="whats-new-item"]')].find((x) => x.textContent.includes("펼치면")); if (!li) return null; return LINES(li).map((l) => l.t); }, LINES.toString());
    console.log(W, JSON.stringify(it));
    const li = p.locator('[data-testid="whats-new-item"]', { hasText: "펼치면" }); if (await li.count()) await li.first().screenshot({ path: `${SHOT}dv-${W}-whatsnew.png` });
    await p.context().close();
  }
}
await br.close();
