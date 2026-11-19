import { chromium, proxy, open, toReport, lines, box, OUT } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy }); const out = {};
const setLabels = (p, src) => p.evaluate((src) => { const l = JSON.parse(localStorage.getItem("secretasset.stock_labels")); new Function("l", src)(l); localStorage.setItem("secretasset.stock_labels", JSON.stringify(l)); window.dispatchEvent(new Event("storage")); }, src);
const hist = (p) => p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-history-row"]')].map((r) => { const c = r.querySelector('[data-testid="grow-history-choice"]'), a = r.querySelector('[data-testid="grow-history-after"]'); const cb = c?.getBoundingClientRect(), ab = a?.getBoundingClientRect(), rb = r.getBoundingClientRect(); return { cls: r.className.slice(0, 60), h: Math.round(rb.height), choice: c?.textContent, cw: [c?.clientWidth, c?.scrollWidth], sameLine: ab && cb ? Math.abs(ab.top - cb.top) < 10 : null, afterRight: ab ? Math.round(rb.right - ab.right) : null, after: a?.textContent, over: Math.round(Math.max(cb?.right ?? 0, ab?.right ?? 0) - rb.right) }; }));
for (const [W, scheme] of [[320, "dark"], [360, "dark"], [375, "dark"], [390, "light"], [320, "light"], [1280, "dark"]]) {
  const tag = `${W}-${scheme}`; const o = (out[tag] = {}); const { ctx, p } = await open(br, W, scheme); await toReport(p);
  o.rowB = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().bottom)));
  await p.click('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.hist = await hist(p); o.aaplNext = await lines(p, '[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-choice-next"]'); o.foot = await lines(p, '[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-sheet"] > :last-child');
  await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').screenshot({ path: `${OUT}/r8-11-history-${tag}.png` });
  if (W <= 360) { // 최장 조합: 점검 대상으로 + 다음 점검까지 +123.4%
    await setLabels(p, 'const a=l.reviews.find(r=>r.t==="AAPL"&&r.price===166); a.price=91.8; a.from="keep"; a.choice="check";'); await p.waitForTimeout(1500);
    const t = p.locator('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]'); if ((await t.getAttribute("aria-expanded")) !== "true") { await t.click(); await p.waitForTimeout(700); }
    o.histLong = await hist(p); await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').screenshot({ path: `${OUT}/r8-11b-history-long-${tag}.png` }); }
  // 삼성전자(차례 아님·장기 보유) 한 장
  await p.click('[data-testid="grow-row"][data-ticker="005930"] [data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.samsung = await p.evaluate(() => document.querySelector('[data-testid="grow-row"][data-ticker="005930"] [data-testid="grow-sheet"]').innerText.split("\n").filter(Boolean).slice(0, 8));
  o.samsungBtnDesc = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"][data-ticker="005930"] button[data-testid^="grow-choice-"]')].map((e) => [e.textContent, Math.round(e.getBoundingClientRect().height), e.getAttribute("aria-describedby"), e.getAttribute("aria-describedby") ? !!document.getElementById(e.getAttribute("aria-describedby")) : null]));
  await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(800); await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.coin = await p.evaluate(() => document.querySelector('[data-testid="grow-sheet"]').innerText.split("\n").filter(Boolean)); o.coinFoot = await lines(p, '[data-testid="grow-sheet"] > :last-child'); o.coinNext = await p.locator('[data-testid="grow-choice-next"]').count();
  await p.screenshot({ path: `${OUT}/r8-08b-coin-sheet-${tag}.png`, fullPage: true });
  await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(800);
  o.ownList = await box(p, '[data-testid="grow-list"]'); await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
  o.ownSheet = await p.evaluate(() => document.querySelector('[data-testid="grow-sheet"]').innerText.split("\n").filter(Boolean)); o.value = await box(p, '[data-testid="grow-value"]');
  await p.screenshot({ path: `${OUT}/r8-07b-own-sheet-${tag}.png`, fullPage: W < 700 });
  if (W === 320 || W === 1280) for (const how of ["x", "outside", "esc", "save"]) {
    const e = p.locator('[data-testid="grow-value-edit"]'); if (W < 700) await e.tap(); else await e.click(); await p.waitForTimeout(1500);
    if (how === "esc") await p.keyboard.press("Escape"); else if (how === "x") { const c = p.locator('[role="dialog"] button:has-text("Close"), [role="dialog"] [data-slot="dialog-close"]').first(); if (W < 700) await c.tap(); else await c.click(); } else if (how === "outside") await p.mouse.click(5, 5); else { const s = p.locator('[role="dialog"] button[type="submit"]').first(); await s.scrollIntoViewIfNeeded(); if (W < 700) await s.tap(); else await s.click(); }
    await p.waitForTimeout(1500);
    (o.focus ??= {})[how] = await p.evaluate(() => ({ dialog: !!document.querySelector('[role="dialog"]'), active: document.activeElement?.dataset?.testid ?? document.activeElement?.tagName, open: document.querySelector('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded") })); }
  if (W === 1280) { await p.click('[data-testid="grow-kind"][data-kind="stock"]'); await p.waitForTimeout(800); o.stockList = await box(p, '[data-testid="grow-list"]'); o.stockCard = await box(p, '[data-testid="grow-total-card"]'); await p.screenshot({ path: `${OUT}/r8-01-stock-${tag}.png` }); }
  o.docW = await p.evaluate(() => document.documentElement.scrollWidth); o.errs = p.errs; await ctx.close();
}
// R-4 이어진 막대 320
{ const { ctx, p } = await open(br, 320, "dark"); await toReport(p);
  await setLabels(p, 'const mk=(t,i,price)=>({t,at:new Date(Date.UTC(2025,0,5+i*20)).toISOString().slice(0,10),from:"check",choice:"same",price,rate:1}); const a=[]; for(let i=0;i<11;i++) a.push(mk("AAPL",i,i%3===0?260:150+i)); const b=[]; for(let i=0;i<12;i++) b.push(mk("000660",i,i%4===0?250000:120000+i*1000)); l.items["000660"].labeledAt="2024-12-01"; l.items["000660"].base.priceAt="2024-12-01"; l.items["AAPL"].labeledAt="2024-12-01"; l.items["AAPL"].base.priceAt="2024-12-01"; l.reviews=[...a,...b,...l.reviews.filter(r=>r.t==="NVDA")];'); await p.waitForTimeout(1500);
  await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(700);
  out.dense = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-pick-tally"]')].map((e) => [e.dataset.dense, Math.round(e.getBoundingClientRect().width), Math.round(e.firstElementChild.getBoundingClientRect().width * 10) / 10, Math.round((e.firstElementChild.firstElementChild?.getBoundingClientRect().width ?? 0) * 10) / 10]));
  out.densePick = await lines(p, '[data-testid="grow-pick-panel"]'); await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/r8-06b-dense-panel-320-dark.png` }); await ctx.close(); }
console.log(JSON.stringify(out)); await br.close();
