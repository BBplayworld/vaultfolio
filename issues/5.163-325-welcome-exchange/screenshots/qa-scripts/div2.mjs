import { launch, enterDemo, DIV_STOCKS, HEAD, MAIN, blockExternal, setTheme, st } from "./lib.mjs";
const SH = process.argv[2]; const b = await launch(); const out = {};
const open = async (w, base, { stocks = DIV_STOCKS, clock = "2026-12-28T03:00:00Z", theme = "dark" } = {}) => {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await blockExternal(ctx); await ctx.route("**/api/finance**", (r) => /dividend/.test(r.request().url()) ? r.fallback() : r.abort()); await setTheme(ctx, base, theme);
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource|Failed to fetch/.test(m.text()) && errs.push(m.text().slice(0, 160))); p.on("pageerror", (e) => errs.push("PE " + e.message.slice(0, 160)));
  await enterDemo(p, base, { stocks, clock });
  await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(800); await p.getByText("배당", { exact: true }).first().click();
  await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 15000 }); await p.waitForTimeout(1200);
  await p.addStyleTag({ content: "[data-sonner-toaster]{display:none!important}" });
  return { ctx, p, errs };
};
const grid = (p) => p.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="dividend-stock-row"]')]; const head = document.querySelector('[data-testid="dividend-table"] [role="row"]');
  return { tracks: getComputedStyle(rows[0]).gridTemplateColumns.split(" ").length, headTracks: getComputedStyle(head).gridTemplateColumns.split(" ").length, n: rows.length, texts: rows.map((r) => r.innerText.replace(/\s+/g, " ")).join("||"), headTexts: [...head.children].map((c) => c.textContent).join("|"), monthsHdr: (() => { const r = document.querySelector('[data-testid="dividend-col-months"]').getBoundingClientRect(); return [r.width, r.height]; })(), filler: [...document.querySelectorAll('[data-testid="dividend-cell-paid"] p[aria-hidden]')].map((x) => getComputedStyle(x).display), hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, firstRowNode: rows[0] }; });
// 1) 경계 359↔360 리사이즈(같은 페이지)
{ const { ctx, p, errs } = await open(359, HEAD);
  await p.evaluate(() => { window.__row0 = document.querySelector('[data-testid="dividend-stock-row"]'); });
  const a = await grid(p); await p.setViewportSize({ width: 360, height: 1000 }); await p.waitForTimeout(400); const c = await grid(p);
  const sameNode360 = await p.evaluate(() => window.__row0 === document.querySelector('[data-testid="dividend-stock-row"]'));
  await p.setViewportSize({ width: 359, height: 1000 }); await p.waitForTimeout(400); const d = await grid(p);
  await p.setViewportSize({ width: 358, height: 1000 }); await p.waitForTimeout(300); const e = await grid(p);
  await p.setViewportSize({ width: 361, height: 1000 }); await p.waitForTimeout(300); const f = await grid(p);
  out.boundary = { w359: [a.tracks, a.headTracks, a.monthsHdr, a.filler], w360: [c.tracks, c.headTracks, c.monthsHdr, c.filler], back359: [d.tracks, d.headTracks], w358: e.tracks, w361: f.tracks, sameNode360, rowsSame: a.n === c.n && c.n === d.n, textSame: a.texts === c.texts && c.texts === d.texts, headTextSame: a.headTexts === c.headTexts, head: a.headTexts, hScroll: [a.hScroll, c.hScroll, d.hScroll], errs };
  await ctx.close(); }
// 2) ARIA (320·375)
for (const w of [320, 375]) { const { ctx, p } = await open(w, HEAD);
  out["aria" + w] = await p.evaluate(() => [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => ({ role: t.getAttribute("role"), label: t.getAttribute("aria-label"), cat: t.dataset.category, directKids: [...t.children].map((c) => c.getAttribute("role")), headers: [...t.querySelectorAll('[role="columnheader"]')].map((h) => h.textContent), headersInRow: t.querySelectorAll(':scope > [role="row"] > [role="columnheader"]').length, rows: t.querySelectorAll('[role="rowgroup"] > [role="row"]').length, cellsPerRow: [...new Set([...t.querySelectorAll('[role="rowgroup"] > [role="row"]')].map((r) => r.querySelectorAll(':scope > [role="cell"]').length))], cellOrder: [...t.querySelector('[role="rowgroup"] > [role="row"]').children].map((c) => c.dataset.testid || "name"), monthsHdrDisplay: getComputedStyle(t.querySelector('[data-testid="dividend-col-months"]')).display, titleInside: !!t.querySelector(".font-semibold.text-muted-foreground.text-sm") && t.contains([...document.querySelectorAll("span")].find((s) => s.textContent === "국내주식")) })));
  out["ariaTree" + w] = { tables: await p.getByRole("table").count(), names: await p.getByRole("table").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label"))), colheaders: await p.getByRole("table").first().getByRole("columnheader").count(), rowsFirst: await p.getByRole("table").first().getByRole("row").count(), cellsFirst: await p.getByRole("table").first().getByRole("cell").count() };
  await ctx.close(); }
// 3) 월 선택 머리글 (320·359)
for (const w of [320, 359]) { const { ctx, p } = await open(w, HEAD);
  const box = await p.locator(".recharts-wrapper").first().boundingBox();
  await p.locator(".recharts-wrapper").first().scrollIntoViewIfNeeded();
  const bb = await p.locator(".recharts-wrapper").first().boundingBox();
  await p.mouse.click(bb.x + bb.width - 22, bb.y + bb.height * 0.6); await p.waitForTimeout(600);
  out["month" + w] = await p.evaluate(() => { const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); }; const t = document.querySelector('[data-testid="dividend-table"]'); if (!t) return { noTable: true, badge: document.querySelector('[data-testid="dividend-month-badge"]')?.innerText }; const head = t.querySelector('[role="row"]'); const hs = [...head.children].filter((c) => c.getBoundingClientRect().width > 2); const rs = hs.map(range); let ov = 0; rs.forEach((a, i) => rs.forEach((b2, j) => { if (j > i && a.left < b2.right - 0.5 && b2.left < a.right - 0.5) ov++; }));
    const row = t.querySelector('[data-testid="dividend-stock-row"]'); const q = (id) => row.querySelector(`[data-testid="${id}"]`); const tr = (cell) => Math.max(...[...cell.querySelectorAll("p")].filter((x) => x.textContent.trim()).map((x) => range(x).right));
    return { head: hs.map((h) => h.textContent), headH: head.getBoundingClientRect().height, overlap: ov, minGap: Math.min(...rs.slice(1).map((r, i) => r.left - rs[i].right)), align: { paid: +(tr(q("dividend-cell-paid")) - q("dividend-cell-paid").getBoundingClientRect().right).toFixed(1), paidVsHead: +(tr(q("dividend-cell-paid")) - head.querySelector('[data-testid="dividend-col-paid"]').getBoundingClientRect().right).toFixed(1), totalVsHead: +(tr(q("dividend-cell-total")) - head.querySelector('[data-testid="dividend-col-total"]').getBoundingClientRect().right).toFixed(1) }, rows: document.querySelectorAll('[data-testid="dividend-stock-row"]').length, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  await p.screenshot({ path: `${SH}/div-month-${w}-dark.png`, fullPage: true }); await ctx.close(); }
// 4) 추가 상태: 3줄 넘는 이름·공백 없는 긴 영문·주기 없음/매수일 없음, 오늘 시계(11지급+12월 예정)
{ const EXTRA = [
    st({ id: "e1", name: "KODEX 미국배당프리미엄액티브 TIGER 미국배당다우존스타겟커버드콜2호 ACE 미국30년국채액티브(H) 합성 레버리지", ticker: "AAAAA1", quantity: 10 }),
    st({ id: "e2", name: "SupercalifragilisticexpialidociousIncomeFundETFSeriesTrustClassA", ticker: "AAAAA3", quantity: 3, purchaseDate: "" }),
    st({ id: "e3", name: "삼성전자우", ticker: "QLONG", quantity: 99, purchaseDate: "" }),
    st({ id: "e4", name: "배당없음주식", ticker: "NONE", quantity: 5 }),
  ];
  for (const w of [320, 359]) { const { ctx, p, errs } = await open(w, HEAD, { stocks: EXTRA, clock: "2026-11-27T01:00:00Z" });
    out["extra" + w] = await p.evaluate(() => { const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); }; return { hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, rows: [...document.querySelectorAll('[data-testid="dividend-stock-row"]')].map((row) => { const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); const inR = rr.right - parseFloat(cs.paddingRight); const name = row.querySelector('[data-testid="dividend-stock-name"]'); const lh = parseFloat(getComputedStyle(name).lineHeight); const meta = row.querySelector('[data-testid="dividend-stock-meta"]'); const pur = row.querySelector('[data-testid="dividend-stock-purchase"]'); const months = row.querySelector('[data-testid="dividend-stock-months"]'); const chips = [...months.children]; const last = chips.at(-1);
      return { name: name.textContent.slice(0, 12), lines: Math.round(name.getBoundingClientRect().height / lh), clipped: name.scrollHeight > name.clientHeight + 1, nameRightOver: +(name.getBoundingClientRect().right - inR).toFixed(1), meta: !!meta, pur: pur?.textContent ?? null, chips: chips.map((c) => c.textContent).join(","), chipRightOver: chips.length ? +(Math.max(...chips.map((c) => c.getBoundingClientRect().right)) - inR).toFixed(1) : null, monthsTopGap: chips.length ? +(months.getBoundingClientRect().top - (pur ?? meta ?? name).getBoundingClientRect().bottom).toFixed(1) : null, h: Math.round(rr.height), ov: row.scrollWidth - row.clientWidth, texts: [...row.querySelectorAll('[data-testid="dividend-stock-pershare"] p, [data-testid="dividend-cell-paid"] p, [data-testid="dividend-cell-total"] p')].map((x) => x.textContent.trim()).filter(Boolean).join(" ") }; }) }; });
    out["extra" + w].errs = errs;
    await p.locator('xpath=(//*[@data-testid="dividend-stock-row"])[1]/ancestor::div[contains(@class,"space-y-3")][1]').screenshot({ path: `${SH}/div-extra-${w}-dark.png` }); await ctx.close(); }
}
// 5) 데모 기본 상태(주입 없음, 오늘) 320·359·375·1280 전체 화면
for (const w of [320, 359, 375, 1280]) { const ctx = await b.newContext({ viewport: { width: w, height: 1000 } }); await blockExternal(ctx); await setTheme(ctx, HEAD, "dark"); const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource|Failed to fetch/.test(m.text()) && errs.push(m.text().slice(0, 160)));
  await ctx.unroute("**/*").catch(() => {}); await blockExternal(ctx);
  await p.goto(HEAD + "/", { waitUntil: "networkidle" }).catch(() => {}); await p.click('[data-testid="welcome-trial-link"]'); await p.waitForFunction(() => !!localStorage.getItem("secretasset_asset_data")); await p.waitForTimeout(1500);
  await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(800); await p.getByText("배당", { exact: true }).first().click(); await p.waitForTimeout(6000);
  out["demo" + w] = { rows: await p.locator('[data-testid="dividend-stock-row"]').count(), hScroll: await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), errs, empty: await p.evaluate(() => document.body.innerText.match(/배당[^\n]{0,30}(없|불러오)[^\n]{0,30}/)?.[0] ?? null) };
  await p.screenshot({ path: `${SH}/div-demo-${w}-dark.png`, fullPage: true }); await ctx.close(); }
console.log(JSON.stringify(out, null, 1)); await b.close();
