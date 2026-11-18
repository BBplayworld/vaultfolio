import { chromium, proxy, open, toReport, lines, OUT } from "./review-5127-lib.mjs";
const br = await chromium.launch({ proxy }); const out = {};
const snap = async (p) => ({ card: (await lines(p, '[data-testid="grow-total-card"]')).slice(0, 10), rows: await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].map((e) => e.dataset.ticker + " " + e.querySelector('[data-testid="grow-row-rate"]')?.textContent + " | " + (e.querySelector('[data-testid="grow-row-since"]')?.textContent ?? ""))) });
const inject = (p, avgMul, lab) => p.evaluate(([avgMul, lab]) => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); for (const s of d.stocks) { if (s.ticker === "NVDA") s.id = "x_nvda"; } for (const s of d.stocks) if (avgMul[s.ticker]) s.averagePrice = Math.round(s.averagePrice * avgMul[s.ticker]); localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); const l = JSON.parse(localStorage.getItem("secretasset.stock_labels")); new Function("l", lab)(l); localStorage.setItem("secretasset.stock_labels", JSON.stringify(l)); window.dispatchEvent(new Event("storage")); }, [avgMul, lab]);
for (const [name, mul, lab] of [
  ["02-stock-loss", { "005930": 1.4, "000660": 1.5, AAPL: 1.45, NVDA: 1.4, "360750": 1.4, "069500": 1.2 }, 'l.items["360750"].base.price=30000; l.items["005930"].base.price=90000; l.reviews.find(r=>r.t==="AAPL"&&r.price===205).price=150; l.reviews.find(r=>r.t==="NVDA").price=200;'],
  ["03-stock-mixed", { "005930": 1.4, NVDA: 1.4, "360750": 1.4 }, 'l.items["005930"].base.price=90000; l.reviews.find(r=>r.t==="NVDA").price=200;'],
]) {
  const { ctx, p } = await open(br, 390, "dark"); await toReport(p);
  await inject(p, mul, lab); await p.waitForTimeout(2000);
  out[name] = await snap(p); await p.screenshot({ path: `${OUT}/r7-${name}-390-dark.png` }); await p.screenshot({ path: `${OUT}/r7-${name}-full-390-dark.png`, fullPage: true });
  if (await p.locator('[data-testid="grow-pick-toggle"]').count()) { await p.click('[data-testid="grow-pick-toggle"]'); await p.waitForTimeout(600); out[name + "-panel"] = await lines(p, '[data-testid="grow-pick-panel"]'); await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/r7-${name}-panel-390-dark.png` }); }
  await ctx.close();
}
console.log(JSON.stringify(out)); await br.close();
