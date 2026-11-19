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

async function fresh(W, scheme = "dark") {
  const H = W < 700 ? 844 : 900;
  const ctx = await br.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 700 });
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


const setLabels = (p, fn) => p.evaluate(fn);
for (const W of WIDTHS) {
  const p = await fresh(W);
  const prices = await p.evaluate(() => { const a = JSON.parse(localStorage.getItem("secretasset-asset-data") ?? localStorage.getItem("secretasset_asset_data")); const f = (t) => a.stocks.find((s) => s.ticker === t)?.currentPrice; return { NVDA: f("NVDA"), S: f("005930") }; });
  // 처음(이름표 0개)
  await p.evaluate(() => localStorage.setItem("secretasset.stock_labels", JSON.stringify({ v: 1, cycle: { months: null, at: "" }, items: {} })));
  await go(p, "#detail/stocks", 3000);
  const t0 = p.locator('[data-slot="collapsible-trigger"][aria-expanded="true"]').first(); if (await t0.count()) { await t0.click(); await p.waitForTimeout(600); }
  const first = await p.evaluate(() => m.tiles());
  log(`${W} first tile`, { listTop: first.listTop, group: first.group, grow: first.tiles.find((x) => x.id === "stock-tool-grow") });
  log(`${W} first rows`, await p.evaluate(() => ({ decisions: document.querySelectorAll('[data-testid="stock-row-decision"]').length, entries: document.querySelectorAll('[data-testid="decision-entry"]').length, heights: m.rows().map((r) => r.h) })));
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="stock-tools"]').screenshot({ path: `${OUT}dev-${W}-06-tiles-first.png` });
  await go(p, "", 500); await p.goto(`${PV}/?t=${Date.now()}`, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(5000); await p.evaluate(LIB);
  log(`${W} first home-tip`, await p.evaluate(() => document.querySelector('[data-testid="home-tip"]')?.dataset.kind ?? null));
  // 정함(차례 0) — 삼성전자 장기 보유, 엔비디아 점검 대상
  await p.evaluate((pr) => { const d = (n) => new Date(Date.now() - n * 864e5).toISOString(); localStorage.setItem("secretasset.stock_labels", JSON.stringify({ v: 1, cycle: { months: null, at: "" }, items: {
    "005930": { label: "keep", labeledAt: d(30), at: d(30), base: { qty: 65, price: pr.S / 1.12 } }, NVDA: { label: "check", labeledAt: d(30), at: d(30), base: { qty: 8, price: pr.NVDA / (1 - 0.063) }, plan: { down: 15, up: 25, at: d(30) } } } })); }, prices);
  await go(p, "#detail/stocks", 3000);
  const lab = await p.evaluate(() => m.tiles());
  log(`${W} labeled tile`, { listTop: lab.listTop, grow: lab.tiles.find((x) => x.id === "stock-tool-grow") });
  await p.evaluate(() => scrollTo(0, 0)); await p.locator('[data-testid="stock-tools"]').screenshot({ path: `${OUT}dev-${W}-07-tiles-labeled.png` });
  await openStockPage(p, "엔비디아");
  log(`${W} head both`, await p.evaluate(() => m.head()));
  await p.context().close();
}
// 라이트 모드 — 차례 행 펼침 진입·머리 진입 색 대비
if (process.env.LIGHT) { const p = await fresh(390, "light");
  await p.evaluate(() => { document.documentElement.classList.remove("dark"); });
  await go(p, "#detail/stocks", 3000);
  log("light theme", await p.evaluate(() => ({ dark: document.documentElement.classList.contains("dark"), row: getComputedStyle(document.querySelector('[data-testid="stock-row-decision"][data-kind="due"]')).color })));
  const due = p.locator('[data-testid="detail-list-box-stocks"] > div', { has: p.locator('[data-testid="stock-row-decision"][data-kind="due"]') }).filter({ hasText: "SK하이닉스" }).first();
  if (!(await due.locator('[data-testid="decision-entry"]').count())) { await due.locator('[data-slot="collapsible-trigger"]').click(); await p.waitForTimeout(900); }
  log("light entry", await due.locator('[data-testid="decision-entry"]').evaluate((e) => ({ color: getComputedStyle(e.querySelector("span")).color, bg: getComputedStyle(e).backgroundColor, parentBg: getComputedStyle(e.closest('[data-slot="collapsible-content"]').firstElementChild).backgroundColor })));
  await due.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -80)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}dev-390-08-light-row-entry.png` });
  await p.context().close(); }
await br.close();
