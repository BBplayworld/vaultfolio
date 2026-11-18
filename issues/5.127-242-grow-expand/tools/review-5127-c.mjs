import { chromium, proxy, open, toReport, lines, box, OUT } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy }); const out = {};
const snap = async (p) => ({ card: await lines(p, '[data-testid="grow-total-card"]'), pick: await p.evaluate(() => { const e = document.querySelector('[data-testid="grow-pick"]'); return e ? [e.dataset.state, e.dataset.n, e.dataset.up, e.textContent] : null; }), rows: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.dataset.ticker + " " + e.querySelector('[data-testid="grow-row-rate"]')?.textContent)), docW: await p.evaluate(() => document.documentElement.scrollWidth) });
const setPrices = (p, m) => p.evaluate((m) => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); for (const s of d.stocks) if (m[s.ticker]) s.currentPrice = m[s.ticker]; localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); window.dispatchEvent(new Event("storage")); }, m);
const setLabels = (p, fnSrc) => p.evaluate((src) => { const l = JSON.parse(localStorage.getItem("secretasset.stock_labels")); const r = new Function("l", src)(l) ?? l; localStorage.setItem("secretasset.stock_labels", JSON.stringify(r)); window.dispatchEvent(new Event("storage")); }, fnSrc);
// 1) 손실(g7-02) · 혼합(g7-03) — 390 다크, 저장 시세 주입
{ const { ctx, p } = await open(br, 390, "dark"); await toReport(p);
  await setPrices(p, { "005930": 52000, "000660": 128000, AAPL: 150, NVDA: 96, "360750": 15000, "069500": 31000 }); await p.waitForTimeout(1500);
  out.loss = await snap(p); await p.screenshot({ path: `${OUT}/r7-02-stock-loss-390-dark.png` });
  if (await p.locator('[data-testid="grow-pick-toggle"]').count()) { await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(600); out.lossPanel = await lines(p, '[data-testid="grow-pick-panel"]'); await p.screenshot({ path: `${OUT}/r7-02b-stock-loss-panel-390-dark.png` }); await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(400); }
  await setPrices(p, { "005930": 70000, "000660": 128000, AAPL: 225, NVDA: 96, "360750": 15000, "069500": 37000 }); await p.waitForTimeout(1500);
  out.mixed = await snap(p); await p.screenshot({ path: `${OUT}/r7-03-stock-mixed-390-dark.png` }); await p.screenshot({ path: `${OUT}/r7-03f-stock-mixed-full-390-dark.png`, fullPage: true });
  await ctx.close(); }
// 2) 320 닫힘(g7-06)은 a.mjs r7-01-stock-320. 320 매수 문장(g7-06c): 이름표를 30일 안 된 1건만 남김
for (const W of [320, 390]) { const { ctx, p } = await open(br, W, "dark"); await toReport(p);
  await setLabels(p, 'l.items = { "000660": l.items["000660"] }; l.reviews = [];'); await p.waitForTimeout(1500);
  out["buy" + W] = await snap(p); out["buyLines" + W] = await lines(p, '[data-testid="grow-pick"]'); await p.screenshot({ path: `${OUT}/r7-06c-buy-sentence-${W}-dark.png` });
  if (await p.locator('[data-testid="grow-pick-toggle"]').count()) { await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(600); out["buyPanel" + W] = await lines(p, '[data-testid="grow-pick-panel"]'); await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/r7-05b-buy-panel-${W}-dark.png` }); }
  // wait 상태(매수 3건 미만): 거래 제거
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); d.transactions = []; localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); window.dispatchEvent(new Event("storage")); }); await p.waitForTimeout(1500);
  out["wait" + W] = await snap(p); out["waitLines" + W] = await lines(p, '[data-testid="grow-pick"]'); await p.screenshot({ path: `${OUT}/r7-05-wait-${W}-dark.png` });
  // 처음 쓰는 사람
  await setLabels(p, 'l.items = {}; l.reviews = [];'); await p.waitForTimeout(1500);
  out["first" + W] = await snap(p); await p.screenshot({ path: `${OUT}/r7-04-first-${W}-dark.png` });
  for (const k of ["crypto", "real"]) { await p.click(`[data-testid="grow-kind"][data-kind="${k}"]`); await p.waitForTimeout(700); out[`first-${k}-${W}`] = (await lines(p, '[data-testid="grow-view"]')).slice(0, 8); await p.screenshot({ path: `${OUT}/r7-04-first-${k}-${W}-dark.png` }); }
  await ctx.close(); }
// 3) 이어진 막대(g7-06b): 기록 다수 주입 320·390
for (const W of [320, 390]) { const { ctx, p } = await open(br, W, "dark"); await toReport(p);
  await setLabels(p, 'const mk=(t,i,price)=>({t,at:new Date(Date.UTC(2025,0,5+i*20)).toISOString().slice(0,10),from:"check",choice:"same",price,rate:1}); const a=[]; for(let i=0;i<11;i++) a.push(mk("AAPL",i,i%3===0?260:150+i)); const b=[]; for(let i=0;i<12;i++) b.push(mk("000660",i,i%4===0?250000:120000+i*1000)); l.items["000660"].labeledAt="2024-12-01"; l.items["000660"].base.priceAt="2024-12-01"; l.items["AAPL"].labeledAt="2024-12-01"; l.items["AAPL"].base.priceAt="2024-12-01"; l.reviews=[...a,...b,...l.reviews.filter(r=>r.t==="NVDA")];'); await p.waitForTimeout(1500);
  out["dense" + W] = await snap(p);
  if (await p.locator('[data-testid="grow-pick-toggle"]').count()) { await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(700); out["densePanel" + W] = await lines(p, '[data-testid="grow-pick-panel"]'); out["denseTally" + W] = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-pick-tally"]')].map((e) => [e.dataset.dense, Math.round(e.getBoundingClientRect().width), e.children.length, Math.round(e.firstElementChild.getBoundingClientRect().width * 10) / 10])); out["denseRowOverflow" + W] = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-pick-row"]')].map((e) => { const l = e.children[0], t = e.children[1]; return Math.round(t.getBoundingClientRect().left - l.lastElementChild.getBoundingClientRect().right); })); await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/r7-06b-dense-panel-${W}-dark.png` }); }
  await ctx.close(); }
console.log(JSON.stringify(out)); await br.close();
