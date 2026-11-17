// #239 5.125 ui-review — preview 실측. 사용: node ui-review.mjs <OUT> <모드>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app";
const OUT = process.argv[2]; const MODE = process.argv[3] ?? "all";
const b = await chromium.launch({ proxy });
const log = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
const LK = "secretasset.stock_labels", AK = "secretasset_asset_data";
const iso = (d) => new Date(Date.now() - d * 86400000).toISOString();
async function open(W, scheme, q, { sunday = false } = {}) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  if (sunday) await ctx.addInitScript(() => { const off = new Date("2026-11-22T10:00:00+09:00").getTime() - Date.now(); const RD = Date; const now = () => RD.now() + off; class D extends RD { constructor(...a) { if (a.length === 0) super(now()); else super(...a); } static now() { return now(); } } window.Date = D; });
  const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`${PV}/?${q}`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => log("goto", e.message));
  await p.waitForTimeout(7000);
  return { ctx, p };
}
const go = async (p, hash, ms = 3000) => { await p.evaluate((h) => { location.hash = h; }, hash); await p.waitForTimeout(ms); };
const reseed = async (p, fn, arg) => { await p.evaluate(fn, arg); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(6000); };
const hubInfo = (p) => p.evaluate(() => {
  const c = document.querySelector('[data-testid="hub-card-report"]'); if (!c) return null;
  const pr = c.querySelector('[data-testid="hub-report-primary"]'), se = c.querySelector('[data-testid="hub-report-secondary"]');
  const fg = getComputedStyle(document.body).color;
  return { text: c.innerText.replace(/\n/g, " | "), primColor: pr ? getComputedStyle(pr).color : null, bodyFg: fg, primW: pr ? Math.round(pr.getBoundingClientRect().width) : null, primAvail: pr ? Math.round(pr.parentElement.getBoundingClientRect().width) : null, sec: se?.innerText ?? null, cardH: Math.round(c.firstElementChild.getBoundingClientRect().height), plus: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Plus" && s.children.length === 0).length, money: /원|%/.test(c.innerText) };
});
const blockInfo = (p) => p.evaluate(() => {
  const blk = document.querySelector('[data-testid="grow-block"]');
  const title = document.querySelector('[data-testid="grow-title"]'), sec = document.querySelector('[data-testid="report-section-title"]');
  const y = (e) => e ? Math.round(e.getBoundingClientRect().top + scrollY) : null;
  const base = { hash: location.hash, title: title?.innerText ?? null, plus: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Plus" && s.children.length === 0).length, sectionY: y(sec), vh: innerHeight, hasBlock: !!blk, docW: document.documentElement.scrollWidth, vw: innerWidth };
  if (!blk) return base;
  const lines = (e) => { const r = [...e.children].filter((c) => getComputedStyle(c).display !== "none" && c.getBoundingClientRect().height > 0).map((c) => Math.round(c.getBoundingClientRect().top)); return new Set(r).size; };
  const bad = []; // 손익색·주황 사용 검사: 글자색 채도가 높은 붉은·푸른·주황 계열
  blk.querySelectorAll("*").forEach((e) => { const cls = typeof e.className === "string" ? e.className : ""; if (/(^|\s)(dark:)?(text|bg)-(rose|blue|orange|red|amber)-\d/.test(cls)) bad.push(cls.slice(0, 80)); });
  const colors = new Set(); blk.querySelectorAll('[data-testid="grow-row"] *').forEach((e) => { if (e.childNodes.length && [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) colors.add(getComputedStyle(e).color); });
  const rows = [...blk.querySelectorAll('[data-testid="grow-row"]')].map((e) => {
    const f = e.querySelector('[data-testid="grow-row-fact"]'), lf = e.querySelector('[data-testid="grow-row-label-fact"]'), nm = e.querySelector('[data-testid="grow-row-open"] span span');
    const radios = [...e.querySelectorAll("[role=radio]")], chk = e.querySelector('[data-testid="grow-check"]'), op = e.querySelector('[data-testid="grow-row-open"]');
    return { t: e.dataset.ticker, l: e.dataset.label, o: e.dataset.overdue, folded: !!e.closest("[inert]"), h: Math.round(e.getBoundingClientRect().height), fact: f.innerText.replace(/\n/g, " / "), factLines: lines(f), lf: lf.innerText.replace(/\n/g, " / "), lfLines: lf.innerText.trim() ? lines(lf) : 0, nameClip: nm.scrollWidth > nm.clientWidth, openW: Math.round(op.getBoundingClientRect().width), openH: Math.round(op.getBoundingClientRect().height), cellW: Math.round(radios[0].getBoundingClientRect().width * 10) / 10, cellH: Math.round(radios[0].getBoundingClientRect().height), trunc: radios.some((x) => x.scrollWidth > x.clientWidth), cellFont: getComputedStyle(radios[0]).fontSize, checked: radios.filter((x) => x.getAttribute("aria-checked") === "true").length, chk: chk ? { st: chk.dataset.state, h: Math.round(chk.getBoundingClientRect().height), txt: chk.innerText.trim() } : null, cols: getComputedStyle(e).display };
  });
  const cyc = [...blk.querySelectorAll('[data-testid="grow-cycle"] [role=radio]')];
  const more = blk.querySelector('[data-testid="grow-more"]');
  return { ...base, blockY: y(blk), blockH: Math.round(blk.getBoundingClientRect().height), summary: blk.querySelector('[data-testid="grow-summary"]').innerText.replace(/\n/g, " "), sumState: blk.querySelector('[data-testid="grow-summary"]').dataset.state, sumH: Math.round(blk.querySelector('[data-testid="grow-summary"]').getBoundingClientRect().height), cycle: cyc.map((c) => ({ w: Math.round(c.getBoundingClientRect().width * 10) / 10, h: Math.round(c.getBoundingClientRect().height), on: c.getAttribute("aria-checked"), trunc: c.scrollWidth > c.clientWidth })), more: more ? { txt: more.innerText.trim(), h: Math.round(more.getBoundingClientRect().height), exp: more.getAttribute("aria-expanded") } : null, badColorClasses: bad, textColors: [...colors], rows };
});
// elementFromPoint 기준 히트영역: 요소 중심에서 위·아래로 20px 지점이 같은 요소(또는 자손)인지
const hit = (p, sel) => p.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => !e.closest("[inert]")).slice(0, 4).map((e) => { e.scrollIntoView({ block: "center" }); const r = e.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const at = (dx, dy) => { const t = document.elementFromPoint(cx + dx, cy + dy); return !!t && (t === e || e.contains(t)); }; let up = 0, dn = 0, lf = 0, rt = 0; while (up < 40 && at(0, -(up + 1))) up++; while (dn < 40 && at(0, dn + 1)) dn++; while (lf < 40 && at(-(lf + 1), 0)) lf++; while (rt < 40 && at(rt + 1, 0)) rt++; return { box: [Math.round(r.width), Math.round(r.height)], hitH: up + dn + 1, hitW: lf + rt + 1 }; }), sel);
const shot = (p, name, full = true) => p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }).catch((e) => log("shot fail", e.message));
const LONG = "KODEX 미국S&P500배당귀족커버드콜(합성 H)";

if (MODE === "all" || MODE === "widths") {
  for (const W of [320, 360, 390, 430, 768, 1023, 1024, 1280]) {
    const { ctx, p } = await open(W, "dark", "demo=1");
    if (W === 390) log("VERSION", await p.locator("text=/PREVIEW · v/").first().textContent().catch(() => "없음"));
    await go(p, "#activity"); log(`HUB demo ${W}`, await hubInfo(p)); await shot(p, `s9-demo-hub-${W}-dark`);
    await go(p, "#activity/report", 4500); log(`BLOCK demo ${W}`, await blockInfo(p)); await shot(p, `s9-demo-report-${W}-dark`);
    if ([320, 390, 1024].includes(W)) for (const s of ['[data-testid="grow-label"] [role=radio]', '[data-testid="grow-cycle"] [role=radio]', '[data-testid="grow-check"]', '[data-testid="grow-more"]', '[data-testid="grow-row-open"]', '[data-testid="grow-plus-hint"] button', '[data-testid="axis-link-diversification"]']) log(`HIT ${W} ${s}`, await hit(p, s));
    // 최장 값 시드: 긴 종목명 + 11년 11개월 전 점검 + 주기 12개월 + 매입가 대비 큰 값
    await reseed(p, ({ LK, AK, LONG, old }) => { const a = JSON.parse(localStorage.getItem(AK)); const l = JSON.parse(localStorage.getItem(LK)); const s = a.stocks.find((x) => x.ticker === "AAPL") ?? a.stocks[0]; a.stocks.filter((x) => x.ticker === s.ticker).forEach((x) => { x.name = LONG; x.averagePrice = x.averagePrice / 14; }); l.cycle = { months: 12, at: new Date().toISOString() }; l.items[s.ticker] = { label: "check", labeledAt: old, checkedAt: old, at: old }; localStorage.setItem(AK, JSON.stringify(a)); localStorage.setItem(LK, JSON.stringify(l)); }, { LK, AK, LONG, old: iso(4352) });
    await go(p, "#activity/report", 4500); const bi = await blockInfo(p); log(`BLOCK long ${W}`, { rows: bi.rows?.map((r) => ({ t: r.t, h: r.h, fact: r.fact, factLines: r.factLines, lf: r.lf, lfLines: r.lfLines, nameClip: r.nameClip, trunc: r.trunc, cellW: r.cellW, cellFont: r.cellFont, openW: r.openW, cols: r.cols, folded: r.folded })), docW: bi.docW, vw: bi.vw });
    await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/long-block-${W}-dark.png` }).catch(() => {});
    log(`ERR ${W}`, p.errs); await ctx.close();
  }
}
if (MODE === "all" || MODE === "states") {
  const W = 390;
  { // 1 빈 데이터
    const { ctx, p } = await open(W, "dark", "demo=empty"); await go(p, "#activity"); log("S1 hub", await hubInfo(p)); await shot(p, "s1-empty-hub-390-dark");
    await go(p, "#activity/report", 4000); log("S1 report", await blockInfo(p)); log("S1 text", (await p.locator("main, body").first().innerText()).replace(/\n+/g, " | ").slice(0, 400)); await shot(p, "s1-empty-report-390-dark");
    log("S1 labels key", await p.evaluate((k) => localStorage.getItem(k), LK)); await ctx.close(); }
  const variants = [
    ["s2-nostock", ({ AK }) => { const a = JSON.parse(localStorage.getItem(AK)); a.stocks = []; localStorage.setItem(AK, JSON.stringify(a)); }],
    ["s3-stockonly", ({ AK }) => { const a = JSON.parse(localStorage.getItem(AK)); for (const k of Object.keys(a)) if (Array.isArray(a[k]) && k !== "stocks" && !/yearly|transaction|history/i.test(k)) a[k] = []; localStorage.setItem(AK, JSON.stringify(a)); }],
    ["s5-zero", ({ LK }) => { localStorage.removeItem(LK); }],
    ["s6-labeled-nocycle", ({ LK }) => { const l = JSON.parse(localStorage.getItem(LK)); l.cycle = { months: null, at: new Date().toISOString() }; localStorage.setItem(LK, JSON.stringify(l)); }],
    ["s7-overdue5", ({ LK, AK, old }) => { const a = JSON.parse(localStorage.getItem(AK)); const l = JSON.parse(localStorage.getItem(LK)); const ts = [...new Set(a.stocks.map((s) => s.ticker).filter(Boolean))].slice(-5); for (const t of ts) l.items[t] = { label: "check", labeledAt: old, checkedAt: old, at: old }; localStorage.setItem(LK, JSON.stringify(l)); }],
    ["s7b-alloverdue", ({ LK, AK, old }) => { const a = JSON.parse(localStorage.getItem(AK)); const l = JSON.parse(localStorage.getItem(LK)); for (const t of new Set(a.stocks.map((s) => s.ticker).filter(Boolean))) l.items[t] = { label: "check", labeledAt: old, checkedAt: old, at: old }; localStorage.setItem(LK, JSON.stringify(l)); }],
  ];
  for (const [name, fn] of variants) {
    const { ctx, p } = await open(W, "dark", "demo=1");
    if (name === "s3-stockonly") log("asset keys", await p.evaluate((AK) => Object.entries(JSON.parse(localStorage.getItem(AK))).map(([k, v]) => `${k}:${Array.isArray(v) ? v.length : typeof v}`).join(","), AK));
    await reseed(p, fn, { LK, AK, old: iso(200) });
    await go(p, "#activity"); log(`${name} hub`, await hubInfo(p)); await shot(p, `${name}-hub-390-dark`);
    await go(p, "#activity/report", 4500); const bi = await blockInfo(p);
    log(`${name} report`, { ...bi, rows: bi.rows?.map((r) => ({ t: r.t, l: r.l, o: r.o, folded: r.folded, h: r.h, lf: r.lf, checked: r.checked, chk: r.chk })) }); await shot(p, `${name}-report-390-dark`);
    if (name === "s7-overdue5") { // 4번째 이후 지난 행에서 점검 → 접히지 않음, 순서 불변 / 펼침 유지
      const rows = p.locator('[data-testid="grow-row"][data-overdue="true"]'); const n = await rows.count(); const last = rows.nth(n - 1); const t = await last.getAttribute("data-ticker");
      await last.locator('[data-testid="grow-check"]').click(); await p.waitForTimeout(600);
      const after = await blockInfo(p); log("s7 after check", { t, order: after.rows.map((r) => `${r.t}${r.folded ? "(접힘)" : ""}`), row: after.rows.find((r) => r.t === t) });
      log("s7 focus kept", await p.evaluate(() => document.activeElement?.dataset?.testid ?? document.activeElement?.tagName));
      await p.locator('[data-testid="grow-more"]').click(); await p.waitForTimeout(700); await shot(p, "s7-overdue5-expanded-390-dark");
      await p.locator('[data-testid="grow-row-open"]').first().click(); await p.waitForTimeout(2500); log("s7 stock page", await p.evaluate(() => location.hash)); await shot(p, "s7-stock-page-390-dark", false);
      await p.goBack(); await p.waitForTimeout(3000); const back = await blockInfo(p); log("s7 back", { hash: back.hash, more: back.more, order: back.rows?.map((r) => `${r.t}${r.folded ? "(접힘)" : ""}`) });
    }
    if (name === "s5-zero") { // 연타·같은 날 문구·정하지 않음 표시
      const row = p.locator('[data-testid="grow-row"]').first();
      await row.evaluate((e) => { window.__n = e; });
      await row.locator('[data-testid="grow-label-keep"]').click(); await p.waitForTimeout(80);
      await row.locator('[data-testid="grow-label-check"]').click(); await p.waitForTimeout(80);
      const mid = await row.evaluate((e) => Math.round(e.getBoundingClientRect().height));
      await row.locator('[data-testid="grow-label-none"]').click(); await p.waitForTimeout(600);
      log("s5 rapid", { sameNode: await row.evaluate((e) => window.__n === e), midH: mid, endH: await row.evaluate((e) => Math.round(e.getBoundingClientRect().height)), label: await row.getAttribute("data-label"), checked: await row.locator('[role=radio][aria-checked="true"]').count(), summary: await p.locator('[data-testid="grow-summary"]').innerText() });
      await row.locator('[data-testid="grow-label-keep"]').click(); await p.waitForTimeout(500); log("s5 sameday keep", await row.locator('[data-testid="grow-row-label-fact"]').innerText());
      await row.locator('[data-testid="grow-label-check"]').click(); await p.waitForTimeout(500); log("s5 sameday check", await row.locator('[data-testid="grow-row-label-fact"]').innerText());
      await row.locator('[data-testid="grow-check"]').click(); await p.waitForTimeout(500); log("s5 checked", { fact: await row.locator('[data-testid="grow-row-label-fact"]').innerText(), btn: await row.locator('[data-testid="grow-check"]').innerText(), focus: await p.evaluate(() => document.activeElement?.dataset?.testid) });
      await shot(p, "s5-zero-after-label-390-dark"); await go(p, "#activity"); log("s5 hub after", await hubInfo(p)); await shot(p, "s5-hub-sameday-390-dark");
    }
    log(`${name} ERR`, p.errs); await ctx.close();
  }
  { // 일요일
    const { ctx, p } = await open(W, "dark", "demo=1", { sunday: true }); log("SUN date", await p.evaluate(() => new Date().toString())); await go(p, "#activity"); log("SUN hub", await hubInfo(p)); await shot(p, "sunday-demo-hub-390-dark");
    await go(p, "#activity/report", 4500); const bi = await blockInfo(p); log("SUN report", { summary: bi.summary, rows: bi.rows?.map((r) => ({ t: r.t, o: r.o, lf: r.lf, folded: r.folded })) }); await shot(p, "sunday-demo-report-390-dark"); await ctx.close(); }
}
if (MODE === "all" || MODE === "trial") {
  for (const [W, scheme] of [[390, "light"], [390, "dark"], [1280, "light"], [320, "dark"]]) {
    const { ctx, p } = await open(W, scheme, "trial=1");
    await go(p, "#activity"); log(`TRIAL hub ${W} ${scheme}`, await hubInfo(p)); await shot(p, `s8-trial-hub-${W}-${scheme}`);
    await go(p, "#activity/report", 4500); const bi = await blockInfo(p); log(`TRIAL report ${W} ${scheme}`, { ...bi, rows: bi.rows?.map((r) => ({ t: r.t, l: r.l, o: r.o, folded: r.folded, fact: r.fact, lf: r.lf, factLines: r.factLines, trunc: r.trunc })) }); await shot(p, `s8-trial-report-${W}-${scheme}`);
    // InfoHint 2개 열기(C113)
    for (const [nm, sel] of [["plus", '[data-testid="grow-plus-hint"] button'], ["section", 'button[aria-label="설명 보기"] >> nth=1']]) {
      const btn = nm === "plus" ? p.locator(sel) : p.locator('[data-testid="report-section-title"]').locator("xpath=ancestor::div[1]").locator('button[aria-label="설명 보기"]');
      await btn.first().scrollIntoViewIfNeeded().catch(() => {}); await btn.first().click({ timeout: 5000 }).catch((e) => log("hint click", e.message)); await p.waitForTimeout(700);
      const pop = p.locator('[data-slot="popover-content"], [role="dialog"]').last();
      log(`HINT ${nm} ${W} ${scheme}`, { text: (await pop.innerText().catch(() => "없음")).replace(/\n/g, " / "), box: await pop.boundingBox().catch(() => null) });
      await shot(p, `hint-${nm}-${W}-${scheme}`, false); await p.keyboard.press("Escape"); await p.mouse.click(5, 5).catch(() => {}); await p.waitForTimeout(400);
    }
    // 분산 축 펼침 + 링크
    const ax = p.locator("button", { hasText: "분산" }).first(); await ax.scrollIntoViewIfNeeded().catch(() => {}); await ax.click().catch(() => {}); await p.waitForTimeout(600);
    log(`AXIS ${W}`, await p.evaluate(() => { const l = document.querySelector('[data-testid="axis-link-diversification"]'); if (!l) return null; const pnl = l.parentElement; return { link: l.innerText.trim(), panel: pnl.innerText.replace(/\n/g, " / "), linkH: Math.round(l.getBoundingClientRect().height) }; }));
    await shot(p, `axis-open-${W}-${scheme}`, false);
    // 새 소식
    await go(p, "#", 2000); await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } }))); await p.waitForTimeout(1500);
    log(`WHATSNEW ${W} ${scheme}`, await p.evaluate(() => { const s = document.querySelector('[data-testid="whats-new-sheet"]'); if (!s) return null; const it = s.querySelector('[data-testid="whats-new-item"]'); return { first: it?.innerText.replace(/\n/g, " / "), hasNew: !!it?.querySelector('[data-testid="whats-new-item-new"]'), go: !!it?.querySelector('[data-testid="whats-new-go"]') }; }));
    await shot(p, `whatsnew-${W}-${scheme}`, false);
    const goBtn = p.locator('[data-testid="whats-new-item"]').first().locator('[data-testid="whats-new-go"]'); if (await goBtn.count()) { await goBtn.click(); await p.waitForTimeout(3000); log(`WHATSNEW go ${W}`, await p.evaluate(() => ({ hash: location.hash, title: document.querySelector('[data-testid="grow-title"]')?.innerText ?? null }))); }
    log(`TRIAL ERR ${W}`, p.errs); await ctx.close();
  }
}
if (MODE === "all" || MODE === "plus") {
  const { ctx, p } = await open(390, "dark", "demo=1");
  await p.locator('[aria-label="더보기"]').first().click().catch((e) => log("more", e.message)); await p.waitForTimeout(1500);
  log("PLUS more menu", await p.evaluate(() => ({ plus: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Plus" && s.children.length === 0).length, sync: [...document.querySelectorAll("button, a, div")].filter((e) => /동기화/.test(e.innerText ?? "") && e.children.length < 6).slice(0, 3).map((e) => e.innerText.replace(/\n/g, " / ").slice(0, 120)) })));
  await shot(p, "plus-more-menu-390-dark", false);
  const sync = p.getByText(/동기화/).first(); await sync.click().catch(() => {}); await p.waitForTimeout(1500);
  log("PLUS sync dialog", await p.evaluate(() => ({ plus: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Plus" && s.children.length === 0).length, dialog: document.querySelector('[role="dialog"]')?.innerText.replace(/\n/g, " / ").slice(0, 200) ?? null })));
  await shot(p, "plus-sync-390-dark", false); await ctx.close();
  for (const W of [320, 390]) { const { ctx, p } = await open(W, "dark", "demo=1"); await go(p, "#activity/report", 4500);
    log(`COARSE ${W}`, await p.evaluate(() => matchMedia("(pointer: coarse)").matches));
    log(`HIT hints ${W}`, await hit(p, 'button[aria-label="설명 보기"]'));
    const ax = p.locator("button", { hasText: "분산" }).first(); await ax.click().catch(() => {}); await p.waitForTimeout(600);
    log(`HIT axis ${W}`, await hit(p, '[data-testid="axis-link-diversification"]')); await ctx.close(); }
}
if (MODE === "s1b") { // 빈 데이터 근사: 대출만 남김(자산 평가액 0) — 웰컴 없이 허브·불리기 화면 빈 상태
  const { ctx, p } = await open(390, "dark", "demo=1");
  await reseed(p, ({ AK }) => { const a = JSON.parse(localStorage.getItem(AK)); for (const k of ["stocks", "realEstate", "crypto"]) a[k] = []; a.cash = a.cash.slice(0, 1).map((c) => ({ ...c, balance: 0, amount: 0 })); a.loans = []; localStorage.setItem(AK, JSON.stringify(a)); }, { AK });
  await go(p, "#activity"); log("S1b hub", await hubInfo(p)); await shot(p, "s1b-zerovalue-hub-390-dark");
  await go(p, "#activity/report", 4000); log("S1b report", await blockInfo(p)); log("S1b text", (await p.locator("body").innerText()).replace(/\n+/g, " | ").slice(0, 300)); await shot(p, "s1b-zerovalue-report-390-dark"); await ctx.close(); }
await b.close();
