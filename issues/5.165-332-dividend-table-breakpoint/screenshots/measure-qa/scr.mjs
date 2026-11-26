// 사용: BASE=.. TAG=br|main node scr.mjs <widths> <variant: demo|stress>
import { launch, enter, sig } from "./h.mjs";
import fs from "fs";
const BASE = process.env.BASE, TAG = process.env.TAG, SH = process.env.SHOTS;
const [ws, variant] = process.argv.slice(2);
const b = await launch(); const out = {};
const stress = (p) => p.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("secretasset_asset_data"));
  const s = d.stocks.find((x) => x.id === "demo_st_samsung"); s.quantity = 20000; // 데모증권 합계 10자리
  d.crypto[0].quantity = 50; d.crypto[0].exchange = "바이낸스 선물 지갑 USDT 마진 계정";
  const base = { reflected: true, reflectedAt: "2026-11-20", createdAt: "2026-11-20", date: "2026-11-20" };
  d.cashTransactions.push({ ...base, id: "qa_c1", cashId: "demo_cash_bank", type: "withdrawal", amount: 123456789, currency: "KRW", memo: "전세 보증금 잔금 이체와 중개 수수료 정산 메모가 길어지는 경우" });
  d.cryptoTransactions.push({ ...base, id: "qa_x1", cryptoId: "demo_cr_btc", symbol: "BTC", name: "비트코인", type: "sell", quantity: 0.12345678, price: 143210000, memo: "분할 매도 3차 — 목표가 도달분 일부 정리" });
  d.loanTransactions.push({ ...base, id: "qa_l1", loanId: "demo_loan_credit", type: "repay", amount: 123456789, memo: "중도 상환 수수료 포함 일부 상환 메모가 길어지는 경우" });
  localStorage.setItem("secretasset_asset_data", JSON.stringify(d));
  localStorage.setItem("secretasset.physical_assets", JSON.stringify([{ id: "qa_ph1", type: "other", name: "롤렉스 서브마리너 데이트 스틸 블랙 다이얼", currentValue: 1234567890, purchasePrice: 987654321, purchaseDate: "2024-01-01" }, { id: "qa_ph2", type: "other", name: "금", currentValue: 5000000, purchasePrice: 4000000, purchaseDate: "2024-01-01" }]));
  window.dispatchEvent(new Event("storage"));
});
const go = async (p, h) => { await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(1500); };
const shot = async (p, name, w) => { await p.evaluate(() => window.scrollTo(0, 0)); await p.screenshot({ path: `${SH}/${TAG}-${variant}-${name}-${w}.png`, fullPage: true, animations: "disabled" }); };
const rec = async (p, o, name, w, extra) => { const s = await sig(p); o[name] = { hScroll: s.hScroll, n: s.n, items: s.items, ...(extra ? await p.evaluate(extra) : {}) }; await shot(p, name, w); };
const expandAll = (p) => p.evaluate(() => { let n = 0; for (const e of document.querySelectorAll('button[data-state="closed"][aria-expanded="false"]')) { if (e.getClientRects().length) { e.click(); n++; } } return n; });
const clickText = (p, t) => p.evaluate((t) => { const e = [...document.querySelectorAll("button")].find((x) => x.getClientRects().length && x.innerText.replace(/\s+/g, " ").includes(t)); if (e) e.click(); return !!e; }, t);
const tryClick = async (loc) => { try { await loc.first().click({ timeout: 4000 }); return true; } catch { return false; } };
for (const w of ws.split(",").map(Number)) {
  const o = (out[w] = {});
  const { ctx, p, errs } = await enter(b, BASE, w);
  if (variant === "stress") { await stress(p); await p.waitForTimeout(1500); }
  o.trial = await p.evaluate(() => !!document.querySelector('[data-testid="trial-start-btn"]'));
  // 1 주식
  await go(p, "#detail/stocks");
  if (await p.evaluate(() => { const r = document.querySelector('[data-testid="broker-row-resync"]'); return !r || !r.getClientRects().length; })) await tryClick(p.getByTestId("broker-totals-toggle"));
  await p.waitForTimeout(700);
  await rec(p, o, "stocks", w, () => {
    const f = (n) => +n.toFixed(1);
    const rights = [...document.querySelectorAll('[data-testid="stock-row-right"]')].map((e) => { const row = e.parentElement.getBoundingClientRect(); const r = e.getBoundingClientRect(); return { mw: getComputedStyle(e).maxWidth, ratio: f(r.width / row.width * 100), w: f(r.width), rowW: f(row.width) }; });
    const brokers = [...document.querySelectorAll('[data-testid="broker-row-resync"]')].filter((e) => e.getClientRects().length).map((e) => { const row = e.parentElement; const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); const inR = rr.right - parseFloat(cs.paddingRight); const r = e.getBoundingClientRect(); const sib = [...row.children].filter((c) => c !== e).map((c) => c.getBoundingClientRect()); return { txt: row.innerText.replace(/\s+/g, " ").slice(0, 50), wrapped: sib.length ? r.top >= Math.max(...sib.map((s) => s.bottom)) - 1 : null, rightGap: f(inR - r.right), overRow: f(r.right - rr.right), rowScroll: row.scrollWidth - row.clientWidth, btn: [f(r.width), f(r.height)], rowH: f(rr.height), rowCls: row.className.slice(0, 160), sibOver: f(Math.max(...sib.map((s) => s.right)) - r.left) }; });
    const icons = [...document.querySelectorAll('[data-testid="stock-tools"] svg')].map((e) => getComputedStyle(e).display).join(",");
    return { rights, brokers, icons };
  });
  // 2 코인 3 실물
  await go(p, "#detail/crypto"); await rec(p, o, "crypto", w);
  await go(p, "#detail/physical"); await rec(p, o, "physical", w);
  // 4 현금 거래
  await go(p, "#detail/cash"); await expandAll(p); await p.waitForTimeout(600); o.cashNav = await clickText(p, "입출금 내역"); await p.waitForTimeout(1200); await rec(p, o, "cashtx", w);
  await go(p, "#detail/crypto"); await expandAll(p); await p.waitForTimeout(600); await expandAll(p); await p.waitForTimeout(600); o.cryptoNav = await clickText(p, "매수/매도 내역"); await p.waitForTimeout(1200); await rec(p, o, "cryptotx", w);
  await go(p, "#detail/loans"); await expandAll(p); await p.waitForTimeout(600); o.loanNav = await clickText(p, "상환·대출 내역"); await p.waitForTimeout(1200); await rec(p, o, "loantx", w);
  // 7 성적표·점검
  await go(p, "#activity/report"); await p.waitForTimeout(800); await tryClick(p.getByTestId("grow-axis-hold")); await p.waitForTimeout(700); await rec(p, o, "report", w); await tryClick(p.getByTestId("grow-row-toggle")); await p.waitForTimeout(700); await rec(p, o, "report2", w);
  o.errs = [...new Set(errs)].length; o.errSample = [...new Set(errs.map((e) => e.slice(0, 70)))].slice(0, 4);
  // 9 가이드(투자 화면)
  for (const [nm, path] of [["guide", "/guide/market-history"], ["guidek", "/guide/kospi-by-year"]]) {
    const g = await ctx.newPage(); const ge = []; g.on("console", (m) => m.type() === "error" && ge.push(m.text().slice(0, 100))); g.on("pageerror", (e) => ge.push("PE " + String(e).slice(0, 100)));
    await g.clock.setFixedTime(new Date("2026-11-26T03:00:00Z"));
    await g.goto(BASE + path, { waitUntil: "networkidle" }).catch(() => {}); await g.waitForTimeout(2500);
    const hh = () => g.evaluate(() => Object.fromEntries(["invest-readout", "invest-readout-grid", "a1-selected", "invest-drop-recovery"].map((id) => { const e = document.querySelector(`[data-testid="${id}"]`); return [id, e ? [+e.getBoundingClientRect().height.toFixed(1), getComputedStyle(e).minHeight, getComputedStyle(e).display, e.scrollHeight - e.clientHeight] : null]; })));
    const s0 = await sig(g); const h0 = await hh();
    await g.evaluate(() => window.scrollTo(0, 0)); await g.screenshot({ path: `${SH}/${TAG}-${variant}-${nm}-${w}.png`, fullPage: true, animations: "disabled" });
    const cells = g.getByTestId("year-cell"); const n = await cells.count(); const hs = [h0];
    for (const i of [5, Math.floor(n / 2), n - 2]) { if (i < n && i >= 0) { await cells.nth(i).click({ timeout: 4000 }).catch(() => {}); await g.waitForTimeout(500); hs.push(await hh()); } }
    // 차트 해 이동(읽기 줄)
    for (const id of ["year-prev", "year-prev", "year-next"]) { await g.getByTestId(id).first().click({ timeout: 3000 }).catch(() => {}); await g.waitForTimeout(400); hs.push(await hh()); }
    const s1 = await sig(g);
    let three = null;
    if (await tryClick(g.getByTestId("invest-index-three"))) { await g.waitForTimeout(1500); const s3 = await sig(g); const a = [await hh()]; const yc = g.locator('[data-testid^="a1-row-"]'); const m = await yc.count(); for (const i of [0, 1, 2]) if (i < m) { await yc.nth(i).click({ timeout: 3000 }).catch(() => {}); await g.waitForTimeout(500); a.push(await hh()); } three = { items: s3.items, hScroll: s3.hScroll, hs: a }; await g.evaluate(() => window.scrollTo(0, 0)); await g.screenshot({ path: `${SH}/${TAG}-${variant}-${nm}3-${w}.png`, fullPage: true, animations: "disabled" }); }
    o[nm] = { hScroll: s0.hScroll, n: s0.n, items: s0.items, itemsAfter: s1.items, hs, three, errs: ge.length };
    await g.close(); if (variant === "stress") break;
  }
  const ls = await p.evaluate(() => { const o = {}; for (const k of Object.keys(localStorage)) o[k] = localStorage.getItem(k); return o; });
  await ctx.close();
  // 10 거래 입력 신규 자산 2칸(일반 세션)
  if (variant === "demo") {
    const c2 = await b.newContext({ viewport: { width: w, height: 1000 }, colorScheme: "dark", reducedMotion: "reduce", deviceScaleFactor: 1 });
    await c2.addCookies([{ name: "theme_mode", value: "dark", url: BASE }]);
    await c2.addInitScript((d) => { if (!localStorage.getItem("secretasset_asset_data")) for (const k in d) localStorage.setItem(k, d[k]); }, ls);
    const q = await c2.newPage(); const posts = []; q.on("request", (r) => { if (r.method() !== "GET") posts.push(r.method() + " " + r.url().replace(BASE, "").slice(0, 60)); });
    await q.clock.setFixedTime(new Date("2026-11-26T03:00:00Z"));
    await q.goto(BASE + "/", { waitUntil: "networkidle" }).catch(() => {}); await q.waitForTimeout(2000);
    const steps = [q.locator('[aria-label="자산 업데이트"]').last(), q.getByRole("button", { name: "매수/매도 거래 기록" }), q.getByRole("button", { name: "주식 매수·매도 기록" }), q.getByRole("button", { name: "직접 입력" }), q.getByRole("combobox").filter({ hasText: "종목 선택" }), q.getByRole("option").first(), q.getByRole("button", { name: "신규 자산 등록" })];
    const ok = []; for (const s of steps) { ok.push(await tryClick(s)); await q.waitForTimeout(700); }
    const s = await sig(q);
    o.picker = { ok: ok.map(Number).join(""), items: s.items, hScroll: s.hScroll, posts, grid: await q.evaluate(() => { const g = [...document.querySelectorAll('[class*="max-[360px]:grid-cols-1"],[class*="max-[359px]:grid-cols-1"]')][0]; if (!g) return null; const r = [...g.children].map((c) => c.getBoundingClientRect()); return { cols: getComputedStyle(g).gridTemplateColumns, tops: r.map((x) => Math.round(x.top)), ws: r.map((x) => Math.round(x.width)), hs: r.map((x) => Math.round(x.height)) }; }) };
    const dlg = q.locator('[role="dialog"]').last(); await dlg.screenshot({ path: `${SH}/${TAG}-${variant}-picker-${w}.png`, animations: "disabled" }).catch(() => {});
    await c2.close();
  }
}
fs.writeFileSync(`${process.env.OUT}/scr-${TAG}-${variant}.json`, JSON.stringify(out));
await b.close();
