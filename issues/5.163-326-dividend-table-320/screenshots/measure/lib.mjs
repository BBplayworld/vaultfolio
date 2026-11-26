import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
export const BASE = "http://localhost:3863";
export async function launch() {
  try { return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }); }
  catch { return await chromium.launch({ executablePath: "/opt/pw-browsers/chromium/chrome-linux/chrome" }); }
}
export const y = new Date().getFullYear();
// 배당 픽스처: ticker → payouts
export function payoutsFor(ticker) {
  const mk = (m, per, foreign, est, freq) => ({ payoutDate: `2026-${String(m).padStart(2, "0")}-05`, amountPerShare: per, ...(foreign ? { amountForeign: foreign, currency: "USD" } : {}), frequency: freq, isEstimated: est });
  const all = Array.from({ length: 12 }, (_, i) => i + 1);
  if (ticker === "AAAAA1") return all.map((m) => mk(m, 9999, 0, false, "monthly"));
  if (ticker === "AAAAA2") return all.map((m) => mk(m, m === 1 ? 99999 : 81818.27, 0, m !== 1, "monthly"));
  if (ticker === "AAAAA3") return [3, 6, 9, 12].map((m) => mk(m, 25, 0, false, "quarterly"));
  if (ticker === "USDQ") return [3, 6, 9, 12].map((m) => mk(m, 69.92, 69.92, m === 12, "quarterly"));
  if (ticker === "USDEST") return all.map((m) => mk(m, 99.9999, 99.9999, true, "monthly"));
  return [];
}
const st = (o) => ({ category: "domestic", currency: "KRW", averagePrice: 10000, currentPrice: 12000, purchaseDate: "2024-09-03", broker: "데모증권", ...o });
export const DIV_STOCKS = [
  st({ id: "f1", name: "TIGER 미국S&P500", ticker: "AAAAA1", quantity: 83.34 }),
  st({ id: "f2", name: "TIGER 미국배당다우존스타겟커버드콜2호", ticker: "AAAAA2", quantity: 100 }),
  st({ id: "f3", name: "삼성전자", ticker: "AAAAA3", quantity: 99999, purchaseDate: "2026-01-02" }),
  st({ id: "f4", name: "Schwab US Dividend Equity ETF", ticker: "USDQ", category: "foreign", currency: "USD", quantity: 249, averagePrice: 70, currentPrice: 80, purchaseExchangeRate: 1300 }),
  st({ id: "f5", name: "JPMorgan Equity Premium Income", ticker: "USDEST", category: "foreign", currency: "USD", quantity: 59.5, averagePrice: 50, currentPrice: 55, purchaseExchangeRate: 1300 }),
];
const co = (o) => ({ name: "코인", averagePrice: 1000, currentPrice: 1000, purchaseDate: "2025-01-01", ...o });
export const CRYPTOS = [
  co({ id: "x1", name: "가상코인A", symbol: "ZZA", exchange: "코인베이스", quantity: 1, averagePrice: 1111111111, currentPrice: 9999999999 }),
  co({ id: "x2", name: "가상코인B", symbol: "ZZB", exchange: "바이낸스 선물 지갑 USDT 마진 계정", quantity: 1, averagePrice: 9876543210, currentPrice: 8641975320 }),
  co({ id: "x3", name: "가상코인C", symbol: "ZZC", exchange: "Crypto.com Exchange", quantity: 1, averagePrice: 100000, currentPrice: 7777777777 }),
  co({ id: "x4", name: "가상코인D", symbol: "ZZD", exchange: "하드웨어지갑레저나노엑스콜드월렛보관분", quantity: 1, averagePrice: 5000000000, currentPrice: 6666666666 }),
  co({ id: "x7", name: "가상코인G", symbol: "ZZG", exchange: "빗썸", quantity: 1, averagePrice: 111111111, currentPrice: 999999999 }),
  co({ id: "x5", name: "가상코인E", symbol: "ZZE", exchange: "업비트", quantity: 3, averagePrice: 1234567, currentPrice: 0.0001 }),
  co({ id: "x6", name: "가상코인F", symbol: "ZZF", exchange: "", quantity: 1, averagePrice: 2222222222, currentPrice: 5555555555 }),
];
/** 데모 진입 후 자산을 바꿔 넣는다(메모리 저장소 + storage 이벤트) */
export async function enterDemo(page, { crypto, stocks } = {}) {
  await page.route("**/api/finance/dividend**", (route) => {
    const t = new URL(route.request().url()).searchParams.get("ticker");
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payoutsFor(t) }) });
  });
  if (stocks) await page.clock.setFixedTime(new Date("2026-12-28T03:00:00Z"));
  await page.goto(BASE + "/", { waitUntil: "networkidle" }).catch(() => {});
  await page.click('[data-testid="welcome-trial-link"]');
  await page.waitForFunction(() => !!localStorage.getItem("secretasset_asset_data"), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  await page.evaluate(({ crypto, stocks }) => {
    const d = JSON.parse(localStorage.getItem("secretasset_asset_data"));
    if (crypto) { d.crypto = crypto; d.cryptoTransactions = []; }
    if (stocks) { d.stocks = stocks; d.transactions = []; }
    localStorage.setItem("secretasset_asset_data", JSON.stringify(d));
    window.dispatchEvent(new Event("storage"));
  }, { crypto, stocks });
  await page.waitForTimeout(800);
}
