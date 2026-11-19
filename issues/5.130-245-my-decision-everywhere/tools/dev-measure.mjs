// #245(5.130) development 자체 실측 — preview issue-5130, ?demo=1(비체험 데모), 다크. node measure.mjs [W...]
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5130-bbplayworlds-projects.vercel.app";
const OUT = new URL("./shots/", import.meta.url).pathname;
const WIDTHS = process.argv.slice(2).map(Number).filter(Boolean);
const br = await chromium.launch({ proxy });
const log = (n, o) => console.log(n, JSON.stringify(o));

const LIB = () => {
  window.m = {
    r: (e) => { const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +(b.top + scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; },
    lines: (e) => { const rs = [...e.querySelectorAll("*")].filter((n) => !n.children.length || n.childNodes.length > n.children.length).flatMap((n) => [...n.getClientRects()]).filter((r) => r.width > 0); return new Set(rs.map((r) => Math.round(r.top / 6))).size; },
    // 가운뎃점: 같은 줄에 이어지면 보이고, 줄 머리에 오면 잘려 안 보여야 한다
    dots: (root) => [...root.querySelectorAll('span[aria-hidden="true"]')].filter((d) => d.textContent.trim() === "·" && d.className.includes("inline-block")).map((d) => {
      const piece = d.parentElement; const rowEl = piece.closest('[class*="clip-path"]'); let prev = (piece.closest("[data-testid='stock-page-decision-plan']") ?? piece).previousElementSibling; while (prev && prev.getBoundingClientRect().width === 0) prev = prev.previousElementSibling;
      const dr = d.getBoundingClientRect(); const rr = rowEl.getBoundingClientRect(); const pr = prev?.getBoundingClientRect();
      const sameLine = !!pr && pr.width > 0 && Math.abs(pr.top - piece.getBoundingClientRect().top) < 6;
      const visible = dr.width > 0 && dr.right > rr.left + 8 + 0.5 && dr.left >= rr.left + 8 - 0.5;
      const hidden = dr.width === 0 || dr.right <= rr.left + 8 + 0.5;
      return { sameLine, visible, hidden, ok: dr.width === 0 ? true : sameLine ? visible : hidden };
    }),
    rows: () => [...document.querySelectorAll('[data-testid="stock-row-left"]')].map((l) => {
      const btn = l.closest("button"); const d = l.querySelector('[data-testid="stock-row-decision"]'); const meta = l.lastElementChild;
      const shown = d && getComputedStyle(d).display !== "none";
      return { name: l.querySelector("span").textContent.slice(0, 12), h: +btn.getBoundingClientRect().height.toFixed(1), leftW: +l.getBoundingClientRect().width.toFixed(1), decision: d ? d.getAttribute("data-kind") : null, shown: !!shown,
        metaH: +meta.getBoundingClientRect().height.toFixed(1), dw: shown ? +d.getBoundingClientRect().width.toFixed(1) : 0, dots: m.dots(l).filter((x) => !x.ok).length, color: shown ? getComputedStyle(d).color : "" };
    }),
    tiles: () => { const g = document.querySelector('[data-testid="stock-tools"]'); if (!g) return null; return { group: m.r(g), listTop: m.r(document.querySelector('[data-testid="detail-list-box-stocks"]')).y,
      tiles: [...g.children].map((b) => { const v = b.lastElementChild; const inner = v.firstElementChild ?? v; return { id: b.dataset.testid, ...m.r(b), text: v.textContent, valueW: +v.getBoundingClientRect().width.toFixed(1), valueH: +v.getBoundingClientRect().height.toFixed(1), contentW: +[...inner.children].reduce((s, c) => s + c.getBoundingClientRect().width, 0).toFixed(1), badDots: m.dots(b).filter((x) => !x.ok).length, dotStates: m.dots(b).map((x) => (x.sameLine ? "same" : "wrapped")) }; }) }; },
    head: () => { const h = document.querySelector('[data-testid="stock-page-head"]'); const d = h.querySelector('[data-testid="stock-page-decision"]'); const e = h.querySelector('[data-testid="decision-entry"]'); const profit = h.querySelector('[data-testid="stock-page-profit"]').parentElement.getBoundingClientRect();
      const el = d ?? e; if (!el) return { headH: +h.getBoundingClientRect().height.toFixed(1), none: true };
      const er = el.getBoundingClientRect(); const plan = h.querySelector('[data-testid="stock-page-decision-plan"]');
      return { headH: +h.getBoundingClientRect().height.toFixed(1), kind: d ? "sentence" : "entry", text: el.textContent, gap: +(er.top - profit.bottom).toFixed(1), h: +er.height.toFixed(1), w: +er.width.toFixed(1), areaW: +(h.getBoundingClientRect().width - 32).toFixed(1),
        lines: d ? Math.round(er.height / 20) : Math.round(el.querySelector("span").getBoundingClientRect().height / 20), planW: plan ? +plan.getBoundingClientRect().width.toFixed(1) : null, planShown: plan ? getComputedStyle(plan).display !== "none" : null,
        planPieces: plan ? [...plan.children].map((c) => +c.getBoundingClientRect().width.toFixed(1)) : null, planLines: plan && getComputedStyle(plan).display !== "none" ? new Set([...plan.children].map((c) => Math.round(c.getBoundingClientRect().top))).size : null,
        badDots: d ? m.dots(d).filter((x) => !x.ok).length : 0, dotStates: d ? m.dots(d).map((x) => (x.hidden && !x.sameLine ? "wrapped-hidden" : x.sameLine && x.visible ? "same-visible" : "BAD")) : [],
        overlap: e ? (() => { const t = e.querySelector("span").getBoundingClientRect(); const a = e.querySelector("svg").getBoundingClientRect(); return t.right > a.left + 0.5; })() : null };
    },
  };
};

async function fresh(W) {
  const H = W < 700 ? 844 : 900;
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 700 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForFunction(() => document.documentElement.dataset.demoReady === "1", null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(5000);
  await p.evaluate(LIB);
  return p;
}
const go = async (p, hash, ms = 2500) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); };
const openStockPage = async (p, name) => {
  await go(p, "#detail/stocks");
  const card = p.locator('[data-testid="detail-list-box-stocks"] > div', { has: p.locator(`[data-testid="stock-row-left"] span:text-is("${name}")`) }).first();
  if (!(await card.locator('[data-testid="stock-page-entry"]').count())) { await card.locator('[data-slot="collapsible-trigger"]').click(); await p.waitForTimeout(700); }
  await card.locator('[data-testid="stock-page-entry"]').click(); await p.waitForSelector('[data-testid="stock-page-head"]'); await p.waitForTimeout(1500);
};

for (const W of WIDTHS) {
  const p = await fresh(W);
  // ① 홈 팁
  const home = await p.evaluate(() => { const t = document.querySelector('[data-testid="home-tip"]'); if (!t) return null; const b = t.getBoundingClientRect();
    return { kind: t.dataset.kind, badge: t.querySelector("span.rounded")?.textContent, title: t.querySelector('[data-testid="home-tip-title"]').textContent, desc: t.querySelectorAll("p")[1].textContent, top: +(b.top + scrollY).toFixed(1), bottom: +(b.bottom + scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), vh: innerHeight,
      titleLines: Math.round(t.querySelector('[data-testid="home-tip-title"]').getBoundingClientRect().height / 20), descLines: Math.round(t.querySelectorAll("p")[1].getBoundingClientRect().height / 20) }; });
  log(`${W} home-tip`, home);
  await p.screenshot({ path: `${OUT}dev-${W}-01-home.png`, fullPage: true });
  if (home) { await p.evaluate(() => document.querySelector('[data-testid="home-tip"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(300); await p.locator('[data-testid="home-tip"]').screenshot({ path: `${OUT}dev-${W}-01b-home-tip.png` }); }
  // 허브 카드 수(같은 값)
  await go(p, "#activity"); 
  log(`${W} hub`, await p.evaluate(() => { const s = document.querySelector('[data-testid="hub-report-secondary"]'); return s ? { kind: s.dataset.kind, due: s.dataset.due, text: s.textContent } : null; }));
  // 홈 팁 누름 → 도착
  if (home?.kind === "due") { await go(p, ""); await p.evaluate(() => { history.replaceState(null, "", location.pathname); }); await p.goto(`${PV}/?t=${Date.now()}`, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(5000); await p.evaluate(LIB);
    await p.locator('[data-testid="home-tip"]').click(); await p.waitForTimeout(2500);
    log(`${W} tip-arrival`, await p.evaluate(() => ({ hash: location.hash, view: document.querySelector('[data-testid="grow-block"]')?.dataset.view, back: document.querySelector("header button, [data-testid='top-back']")?.textContent ?? null, open: [...document.querySelectorAll('[data-testid="grow-row-toggle"][aria-expanded="true"]')].length }))); }
  // ② 상세·주식
  await go(p, "#detail/stocks", 3500);
  const t = p.locator('[data-slot="collapsible-trigger"][aria-expanded="true"]').first(); if (await t.count()) { await t.click(); await p.waitForTimeout(600); }
  log(`${W} tiles`, await p.evaluate(() => m.tiles()));
  log(`${W} rows`, await p.evaluate(() => m.rows()));
  await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}dev-${W}-02-stocks.png`, fullPage: true });
  // ③ 차례 행 펼침 → 진입 → 도착 → 뒤로
  const due = p.locator('[data-testid="detail-list-box-stocks"] > div', { has: p.locator('[data-testid="stock-row-decision"][data-kind="due"]') }).filter({ hasText: "SK하이닉스" }).first();
  await due.locator('[data-slot="collapsible-trigger"]').click(); await p.waitForTimeout(900);
  const entry = due.locator('[data-testid="decision-entry"]');
  log(`${W} row-entry`, await entry.evaluate((e) => { const b = e.getBoundingClientRect(); const t = e.querySelector("span").getBoundingClientRect(); const a = e.querySelector("svg").getBoundingClientRect(); const pe = e.closest('[data-slot="collapsible-content"]').querySelector('[data-testid="stock-page-entry"]').getBoundingClientRect();
    return { text: e.textContent, aria: e.getAttribute("aria-label"), w: +b.width.toFixed(1), h: +b.height.toFixed(1), lines: Math.round(t.height / 20), overlap: t.right > a.left + 0.5, aboveNameEntry: b.bottom <= pe.top + 0.5, color: getComputedStyle(e.querySelector("span")).color, bg: getComputedStyle(e).backgroundColor }; }));
  await due.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}dev-${W}-03-row-entry.png` });
  const scrollBefore = await p.evaluate(() => scrollY);
  await entry.click(); await p.waitForTimeout(3000);
  log(`${W} arrival`, await p.evaluate(() => { const open = [...document.querySelectorAll('[data-testid="grow-row"]')].filter((r) => r.querySelector('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded") === "true");
    const back = [...document.querySelectorAll("button")].find((b) => /뒤로|성과/.test(b.textContent) && b.getBoundingClientRect().top < 80);
    return { hash: location.hash, view: document.querySelector('[data-testid="grow-block"]')?.dataset.view, openTickers: open.map((r) => r.dataset.ticker), rowTop: open[0] ? +open[0].getBoundingClientRect().top.toFixed(1) : null, vh: innerHeight, reason: open[0]?.querySelector('[data-testid="grow-sheet-reason"]')?.textContent, backLabel: back?.textContent.trim() ?? null }; }));
  await p.screenshot({ path: `${OUT}dev-${W}-04-arrival.png` });
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /뒤로/.test(x.textContent) && x.getBoundingClientRect().top < 80); b?.click(); }); await p.waitForTimeout(2500);
  log(`${W} back-from-row-entry`, await p.evaluate((sb) => ({ hash: location.hash, scrollY, scrollBefore: sb }), scrollBefore));
  // 타일 → 주식 보기 → 뒤로
  await go(p, "#detail/stocks"); await p.locator('[data-testid="stock-tool-grow"]').click(); await p.waitForTimeout(2500);
  log(`${W} tile-arrival`, await p.evaluate(() => ({ hash: location.hash, view: document.querySelector('[data-testid="grow-block"]')?.dataset.view, open: document.querySelectorAll('[data-testid="grow-row-toggle"][aria-expanded="true"]').length, dueRows: document.querySelectorAll('[data-testid="grow-row"][data-due="true"]').length })));
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /뒤로/.test(x.textContent) && x.getBoundingClientRect().top < 80); b?.click(); }); await p.waitForTimeout(2000);
  log(`${W} back-from-tile`, await p.evaluate(() => location.hash));
  // ④ 종목 한 장 머리 — 이름표를 실측용 상태로 바꾼다(NVIDIA: ±% 둘 다·미도달, KODEX 200: 어제 정함 + 12개월 = 연도 든 날짜, C140)
  await p.evaluate(() => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const d = (n) => new Date(Date.now() - n * 864e5).toISOString();
    v.items.NVDA = { label: "check", labeledAt: d(30), at: d(30), base: { qty: 8, price: 1 }, plan: { down: 15, up: 25, at: d(30) } };
    v.items["069500"] = { label: "check", labeledAt: d(1), at: d(1), base: { qty: 40, price: 1 }, plan: { months: 12, at: d(1) } };
    localStorage.setItem(k, JSON.stringify(v)); });
  // 기준 가격을 지금 시세에서 역산해 -6.3%·+2.8%가 나오게 한다
  await go(p, "#detail/stocks");
  const prices = await p.evaluate(() => { const a = JSON.parse(localStorage.getItem("secretasset-asset-data") ?? localStorage.getItem("secretasset_asset_data")); const f = (t) => a.stocks.find((s) => s.ticker === t)?.currentPrice; return { NVDA: f("NVDA"), K: f("069500") }; }).catch(() => null);
  log(`${W} prices`, prices);
  if (prices?.NVDA) await p.evaluate((pr) => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); v.items.NVDA.base.price = pr.NVDA / (1 - 0.063); v.items["069500"].base.price = pr.K / 1.028; localStorage.setItem(k, JSON.stringify(v)); }, prices);
  for (const name of ["삼성전자", "엔비디아", "KODEX 200", "SK하이닉스", "TIGER 미국S&P500"]) {
    await openStockPage(p, name);
    log(`${W} head ${name}`, await p.evaluate(() => m.head()));
    await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="stock-page-head"]').screenshot({ path: `${OUT}dev-${W}-05-head-${name.replace(/[^가-힣A-Za-z0-9]/g, "")}.png` });
  }
  // 머리 진입 → 도착 → 뒤로 = 종목 한 장
  await openStockPage(p, "SK하이닉스"); await p.locator('[data-testid="stock-page-head"] [data-testid="decision-entry"]').click(); await p.waitForTimeout(3000);
  log(`${W} head-arrival`, await p.evaluate(() => { const open = [...document.querySelectorAll('[data-testid="grow-row"]')].filter((r) => r.querySelector('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded") === "true"); return { hash: location.hash, openTickers: open.map((r) => r.dataset.ticker), rowTop: open[0] ? +open[0].getBoundingClientRect().top.toFixed(1) : null }; }));
  await p.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /뒤로/.test(x.textContent) && x.getBoundingClientRect().top < 80); b?.click(); }); await p.waitForTimeout(2500);
  log(`${W} back-from-head-entry`, await p.evaluate(() => ({ hash: location.hash, head: !!document.querySelector('[data-testid="stock-page-head"]'), name: document.querySelector('[data-testid="stock-page-head"] h2')?.textContent })));
  // 상세·주식 다시(바꾼 이름표 반영 — 정함 상태 타일은 아님, 행 표시 2개 추가)
  await go(p, "#detail/stocks", 3000);
  log(`${W} rows-after`, await p.evaluate(() => m.rows()));
  log(`${W} tiles-after`, await p.evaluate(() => m.tiles()?.tiles.find((x) => x.id === "stock-tool-grow")));
  await p.context().close();
}
await br.close();
