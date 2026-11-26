import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
export const HEAD = "http://localhost:4163", MAIN = "http://localhost:3964";
export async function launch() {
  try { return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }
  catch { return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium/chrome-linux/chrome" }); }
}
export function payoutsFor(ticker) {
  const mk = (m, per, foreign, est, freq) => ({ payoutDate: `2026-${String(m).padStart(2, "0")}-05`, amountPerShare: per, ...(foreign ? { amountForeign: foreign, currency: "USD" } : {}), frequency: freq, isEstimated: est });
  const all = Array.from({ length: 12 }, (_, i) => i + 1);
  if (ticker === "AAAAA1") return all.map((m) => mk(m, 9999, 0, false, "monthly"));
  if (ticker === "AAAAA2") return all.map((m) => mk(m, m === 1 ? 99999 : 81818.27, 0, m !== 1, "monthly"));
  if (ticker === "AAAAA3") return [3, 6, 9, 12].map((m) => mk(m, 25, 0, false, "quarterly"));
  if (ticker === "USDQ") return [3, 6, 9, 12].map((m) => mk(m, 69.92, 69.92, m === 12, "quarterly"));
  if (ticker === "USDEST") return all.map((m) => mk(m, 99.9999, 99.9999, true, "monthly"));
  if (ticker === "QLONG") return [3, 6, 9, 12].map((m) => mk(m, 99999, 0, false, "quarterly"));
  return [];
}
export const st = (o) => ({ category: "domestic", currency: "KRW", averagePrice: 10000, currentPrice: 12000, purchaseDate: "2024-09-03", broker: "데모증권", ...o });
export const DIV_STOCKS = [
  st({ id: "f1", name: "TIGER 미국S&P500", ticker: "AAAAA1", quantity: 83.34 }),
  st({ id: "f2", name: "TIGER 미국배당다우존스타겟커버드콜2호", ticker: "AAAAA2", quantity: 100 }),
  st({ id: "f3", name: "삼성전자", ticker: "AAAAA3", quantity: 99999, purchaseDate: "2026-01-02" }),
  st({ id: "f4", name: "Schwab US Dividend Equity ETF", ticker: "USDQ", category: "foreign", currency: "USD", quantity: 249, averagePrice: 70, currentPrice: 80, purchaseExchangeRate: 1300 }),
  st({ id: "f5", name: "JPMorgan Equity Premium Income", ticker: "USDEST", category: "foreign", currency: "USD", quantity: 59.5, averagePrice: 50, currentPrice: 55, purchaseExchangeRate: 1300 }),
];
export const co = (o) => ({ name: "코인", averagePrice: 1000, currentPrice: 1000, purchaseDate: "2025-01-01", ...o });
export async function blockExternal(ctx, log) {
  await ctx.route((u) => !/^(http:\/\/localhost|data:|blob:)/.test(u.href), (r) => { log?.push(r.request().method() + " " + r.request().url().slice(0, 120)); r.abort(); });
}
/** 데모 진입 후 자산을 바꿔 넣는다 */
export async function enterDemo(page, base, { crypto, stocks, clock } = {}) {
  await page.route("**/api/finance/dividend**", (route) => {
    const t = new URL(route.request().url()).searchParams.get("ticker");
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payoutsFor(t) }) });
  });
  if (clock) await page.clock.setFixedTime(new Date(clock));
  await page.goto(base + "/", { waitUntil: "networkidle" }).catch(() => {});
  await page.click('[data-testid="welcome-trial-link"]');
  await page.waitForFunction(() => !!localStorage.getItem("secretasset_asset_data"), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  if (crypto || stocks) await inject(page, { crypto, stocks });
}
export async function inject(page, { crypto, stocks }) {
  await page.evaluate(({ crypto, stocks }) => {
    const d = JSON.parse(localStorage.getItem("secretasset_asset_data"));
    if (crypto) { d.crypto = crypto; d.cryptoTransactions = []; }
    if (stocks) { d.stocks = stocks; d.transactions = []; }
    localStorage.setItem("secretasset_asset_data", JSON.stringify(d));
    window.dispatchEvent(new Event("storage"));
  }, { crypto, stocks });
  await page.waitForTimeout(800);
}
export async function setTheme(ctx, base, mode) { await ctx.addCookies([{ name: "theme_mode", value: mode, url: base }]); }
