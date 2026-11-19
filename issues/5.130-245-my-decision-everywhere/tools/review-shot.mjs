// #245(5.130) ui-review 실측·캡처 — preview issue-5130. node review-shot.mjs <scene> <scheme> W...
// scene: main(홈·상세·진입·도착·머리·타일) | heads(조건 절 머리만) | trial
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5130-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.130-245-my-decision-everywhere/screenshots/review/";
const [scene, scheme, ...ws] = process.argv.slice(2);
const WIDTHS = ws.map(Number).filter(Boolean);
const br = await chromium.launch({ proxy });
const log = (n, o) => console.log(n, JSON.stringify(o));
const tag = (W) => `rv-${W}-${scheme === "light" ? "L" : "D"}`;

const LIB = () => {
  window.m = {
    r: (e) => { const b = e.getBoundingClientRect(); return { x: +b.left.toFixed(1), y: +(b.top + scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; },
    // 글자 단위 줄 나눔(C114) — 보이는 글자만, 줄마다 문자열
    linesOf: (el) => { const out = new Map(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const rg = document.createRange(); const clip = el.closest('[class*="clip-path"]') ?? el.querySelector('[class*="clip-path"]'); 
      while ((n = w.nextNode())) { const pe = n.parentElement; if (getComputedStyle(pe).display === "none" || pe.getBoundingClientRect().width === 0) continue; for (let i = 0; i < n.data.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const r = rg.getClientRects()[0]; if (!r || r.width === 0) continue; const c = pe.closest('[class*="clip-path"]'); if (c && r.right <= c.getBoundingClientRect().left + 8.5) continue; const k = Math.round((r.top + r.height / 2) / 8); out.set(k, (out.get(k) ?? "") + n.data[i]); } }
      return [...out.entries()].sort((a, b) => a[0] - b[0]).map((x) => x[1].trim()); },
    rows: () => [...document.querySelectorAll('[data-testid="stock-row-left"]')].map((l) => { const btn = l.closest("button"); const d = l.querySelector('[data-testid="stock-row-decision"]'); const shown = d && getComputedStyle(d).display !== "none";
      return { name: l.querySelector("span").textContent.slice(0, 12), h: +btn.getBoundingClientRect().height.toFixed(1), kind: d?.dataset.kind ?? null, shown: !!shown, meta: m.linesOf(l.lastElementChild), color: shown ? getComputedStyle(d).color : "", fw: shown ? getComputedStyle(d).fontWeight : "" }; }),
    tiles: () => { const g = document.querySelector('[data-testid="stock-tools"]'); if (!g) return null; return { group: m.r(g), cols: getComputedStyle(g).gridTemplateColumns, listTop: m.r(document.querySelector('[data-testid="detail-list-box-stocks"]')).y, tiles: [...g.children].map((b) => ({ id: b.dataset.testid, ...m.r(b), lines: m.linesOf(b) })) }; },
    head: () => { const h = document.querySelector('[data-testid="stock-page-head"]'); const d = h.querySelector('[data-testid="stock-page-decision"]'); const e = h.querySelector('[data-testid="decision-entry"]'); const profit = h.querySelector('[data-testid="stock-page-profit"]').parentElement.getBoundingClientRect(); const el = d ?? e;
      if (!el) return { headH: +h.getBoundingClientRect().height.toFixed(1), none: true }; const er = el.getBoundingClientRect();
      return { headH: +h.getBoundingClientRect().height.toFixed(1), kind: d ? "sentence" : "entry", gap: +(er.top - profit.bottom).toFixed(1), h: +er.height.toFixed(1), lines: m.linesOf(el), profit: m.linesOf(h.querySelector('[data-testid="stock-page-profit"]').parentElement) }; },
    lum: (c) => { const cv = document.createElement("canvas"); cv.width = cv.height = 1; const x = cv.getContext("2d"); x.fillStyle = c; x.fillRect(0, 0, 1, 1); return [...x.getImageData(0, 0, 1, 1).data]; },
  };
};
async function fresh(W, q = "demo=1") {
  const H = W < 700 ? 844 : 900;
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 700 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?${q}&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForFunction(() => document.documentElement.dataset.demoReady === "1", null, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(5000);
  await theme(p); await p.evaluate(LIB);
  return p;
}
const theme = async (p) => { if (scheme === "light") await p.evaluate(() => document.documentElement.classList.remove("dark")); else await p.evaluate(() => document.documentElement.classList.add("dark")); };
const go = async (p, hash, ms = 2500) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); await theme(p); };
const reload = async (p) => { await p.goto(`${PV}/?t=${Date.now()}`, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(5000); await theme(p); await p.evaluate(LIB); };
const collapseAll = async (p) => { for (let i = 0; i < 6; i++) { const t = p.locator('[data-testid="detail-list-box-stocks"] [data-slot="collapsible-trigger"][aria-expanded="true"]').first(); if (!(await t.count())) break; await t.click(); await p.waitForTimeout(500); } };
const openStockPage = async (p, name) => {
  await go(p, "#detail/stocks");
  const card = p.locator('[data-testid="detail-list-box-stocks"] > div', { has: p.locator(`[data-testid="stock-row-left"] span:text-is("${name}")`) }).first();
  if (!(await card.locator('[data-testid="stock-page-entry"]').count())) { await card.locator('[data-slot="collapsible-trigger"]').click(); await p.waitForTimeout(700); }
  await card.locator('[data-testid="stock-page-entry"]').click(); await p.waitForSelector('[data-testid="stock-page-head"]'); await p.waitForTimeout(1500); await theme(p);
};
const prices = (p) => p.evaluate(() => { const a = JSON.parse(localStorage.getItem("secretasset-asset-data") ?? localStorage.getItem("secretasset_asset_data")); const f = (t) => a.stocks.find((s) => s.ticker === t)?.currentPrice; return { NVDA: f("NVDA"), K: f("069500"), S: f("005930") }; });
// 실측용 이름표: NVDA ±% 둘 다 미도달(-6.3%), KODEX 200 어제 정함 + 12개월(연도 든 날짜), 삼성전자 정한 날 가격 = 지금 가격(0.0%)
const inject = (p, pr, zero) => p.evaluate(({ pr, zero }) => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const d = (n) => new Date(Date.now() - n * 864e5).toISOString();
  v.items.NVDA = { label: "check", labeledAt: d(30), at: d(30), base: { qty: 8, price: pr.NVDA / (1 - 0.063) }, plan: { down: 15, up: 25, at: d(30) } };
  v.items["069500"] = { label: "check", labeledAt: d(1), at: d(1), base: { qty: 40, price: pr.K / 1.028 }, plan: { months: 12, at: d(1) } };
  if (zero) v.items["005930"] = { label: "keep", labeledAt: d(30), at: d(30), base: { qty: 65, price: pr.S } };
  localStorage.setItem(k, JSON.stringify(v)); }, { pr, zero });

for (const W of WIDTHS) {
  const T = tag(W);
  if (scene === "trial") {
    const p = await fresh(W, "trial=1");
    log(`${W} trial home`, await p.evaluate(() => ({ tip: document.querySelector('[data-testid="home-tip"]')?.dataset.kind ?? null, tipTitle: document.querySelector('[data-testid="home-tip-title"]')?.textContent ?? null, docH: document.documentElement.scrollHeight })));
    await p.screenshot({ path: `${OUT}${T}-trial-01-home.png`, fullPage: true });
    await go(p, "#detail/stocks", 3500); await collapseAll(p);
    log(`${W} trial tiles`, await p.evaluate(() => m.tiles())); log(`${W} trial rows`, await p.evaluate(() => m.rows()));
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}${T}-trial-02-stocks.png`, fullPage: true });
    await p.context().close(); continue;
  }
  const p = await fresh(W);
  if (scene === "main") {
    // ① 홈
    log(`${W} home-tip`, await p.evaluate(() => { const t = document.querySelector('[data-testid="home-tip"]'); if (!t) return null; const b = t.getBoundingClientRect(); return { kind: t.dataset.kind, lines: m.linesOf(t), top: +(b.top + scrollY).toFixed(1), bottom: +(b.bottom + scrollY).toFixed(1), w: +b.width.toFixed(1), h: +b.height.toFixed(1), vh: innerHeight, above: [...t.parentElement.parentElement.children].map((c) => ({ t: c.dataset.testid ?? c.className.slice(0, 30), y: +(c.getBoundingClientRect().top + scrollY).toFixed(0), h: +c.getBoundingClientRect().height.toFixed(0) })) }; }));
    await p.screenshot({ path: `${OUT}${T}-01-home-first.png` });
    await p.screenshot({ path: `${OUT}${T}-01a-home-full.png`, fullPage: true });
    if (await p.locator('[data-testid="home-tip"]').count()) { await p.evaluate(() => document.querySelector('[data-testid="home-tip"]').scrollIntoView({ block: "center" })); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}${T}-01b-home-tip-view.png` }); }
    // ② 상세·주식
    await go(p, "#detail/stocks", 3500); await collapseAll(p);
    log(`${W} tiles`, await p.evaluate(() => m.tiles())); log(`${W} rows`, await p.evaluate(() => m.rows()));
    await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}${T}-02-stocks-first.png` }); await p.screenshot({ path: `${OUT}${T}-02a-stocks-full.png`, fullPage: true });
    await p.locator('[data-testid="stock-tools"]').screenshot({ path: `${OUT}${T}-02b-tiles-due.png` });
    // ③ 차례 행 펼침·진입
    const due = p.locator('[data-testid="detail-list-box-stocks"] > div', { has: p.locator('[data-testid="stock-row-decision"][data-kind="due"]') }).filter({ hasText: "SK하이닉스" }).first();
    await due.locator('[data-slot="collapsible-trigger"]').click(); await p.waitForTimeout(900);
    const entry = due.locator('[data-testid="decision-entry"]');
    log(`${W} row-entry`, await entry.evaluate((e) => { const b = e.getBoundingClientRect(); const t = e.querySelector("span"); const a = e.querySelector("svg").getBoundingClientRect(); const face = e.closest('[data-slot="collapsible-content"]');
      let bgEl = e.parentElement; let pbg = "rgba(0, 0, 0, 0)"; while (bgEl && (pbg = getComputedStyle(bgEl).backgroundColor) && m.lum(pbg)[3] === 0) bgEl = bgEl.parentElement;
      return { lines: m.linesOf(t), w: +b.width.toFixed(1), h: +b.height.toFixed(1), overlap: t.getBoundingClientRect().right > a.left + 0.5, textRGBA: m.lum(getComputedStyle(t).color), faceRGBA: m.lum(getComputedStyle(e).backgroundColor), parentRGBA: m.lum(pbg), chevrons: face.querySelectorAll("svg.lucide-chevron-right").length }; }));
    await due.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}${T}-03-row-entry.png` });
    await entry.click(); await p.waitForTimeout(3000); await theme(p);
    log(`${W} arrival`, await p.evaluate(() => { const open = [...document.querySelectorAll('[data-testid="grow-row"]')].filter((r) => r.querySelector('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded") === "true"); const back = [...document.querySelectorAll("button")].find((b) => /뒤로|성과/.test(b.textContent) && b.getBoundingClientRect().top < 80);
      return { openTickers: open.map((r) => r.dataset.ticker), rowTop: open[0] ? +open[0].getBoundingClientRect().top.toFixed(1) : null, reason: open[0] ? m.linesOf(open[0].querySelector('[data-testid="grow-sheet-reason"]')) : null, back: back?.textContent.trim() ?? null }; }));
    await p.screenshot({ path: `${OUT}${T}-04-arrival.png` });
  }
  // ④ 머리
  const pr = await prices(p); await inject(p, pr, true);
  const names = scene === "heads" ? ["엔비디아"] : ["삼성전자", "엔비디아", "KODEX 200", "SK하이닉스", "TIGER 미국S&P500", "애플"];
  for (const name of names) { await openStockPage(p, name); log(`${W} head ${name}`, await p.evaluate(() => m.head())); await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="stock-page-head"]').screenshot({ path: `${OUT}${T}-05-head-${name.replace(/[^가-힣A-Za-z0-9]/g, "")}.png` }); }
  if (scene === "main") {
    // 0.0% 정본 대조 — 불리기 주식 보기 삼성전자 행
    await go(p, "#detail/stocks", 3000); await collapseAll(p);
    log(`${W} rows-injected`, await p.evaluate(() => m.rows()));
    await p.evaluate(() => scrollTo(0, 0)); await p.screenshot({ path: `${OUT}${T}-06-stocks-injected.png`, fullPage: true });
    await p.locator('[data-testid="stock-tool-grow"]').click(); await p.waitForTimeout(3000); await theme(p);
    log(`${W} grow rows(정본)`, await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((r) => ({ t: r.dataset.ticker, lines: m.linesOf(r) }))));
    await p.screenshot({ path: `${OUT}${T}-07-grow-canon.png`, fullPage: true });
    // ⑤ 타일 처음·정함
    await p.evaluate(() => localStorage.setItem("secretasset.stock_labels", JSON.stringify({ v: 1, cycle: { months: null, at: "" }, items: {} })));
    await go(p, "#detail/stocks", 3000); await collapseAll(p);
    log(`${W} first`, await p.evaluate(() => ({ t: m.tiles(), decisions: document.querySelectorAll('[data-testid="stock-row-decision"]').length })));
    await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="stock-tools"]').screenshot({ path: `${OUT}${T}-08-tiles-first.png` }); await p.screenshot({ path: `${OUT}${T}-08a-stocks-first-state.png` });
    await p.evaluate((pr) => { const d = (n) => new Date(Date.now() - n * 864e5).toISOString(); localStorage.setItem("secretasset.stock_labels", JSON.stringify({ v: 1, cycle: { months: null, at: "" }, items: { "005930": { label: "keep", labeledAt: d(30), at: d(30), base: { qty: 65, price: pr.S / 1.12 } }, NVDA: { label: "check", labeledAt: d(30), at: d(30), base: { qty: 8, price: pr.NVDA / (1 - 0.063) }, plan: { down: 15, up: 25, at: d(30) } } } })); }, pr);
    await go(p, "#activity", 800); await go(p, "#detail/stocks", 3000); await collapseAll(p);
    log(`${W} labeled`, await p.evaluate(() => m.tiles()));
    await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="stock-tools"]').screenshot({ path: `${OUT}${T}-09-tiles-labeled.png` });
    await reload(p); log(`${W} labeled home-tip`, await p.evaluate(() => document.querySelector('[data-testid="home-tip"]')?.dataset.kind ?? null));
  }
  await p.context().close();
}
await br.close();
