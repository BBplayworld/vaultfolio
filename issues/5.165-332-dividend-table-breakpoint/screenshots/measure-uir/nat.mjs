import { launch, enterDemo } from "./lib2.mjs";
const S = process.env.S + "/shots"; const b = await launch();
const st = (o) => ({ category: "domestic", currency: "KRW", averagePrice: 10000, currentPrice: 12000, purchaseDate: "2024-09-03", broker: "데모증권", ...o });
const ST = [ st({ id: "r1", name: "삼성전자", ticker: "R1", quantity: 120, averagePrice: 68000, currentPrice: 74000 }), st({ id: "r2", name: "TIGER 미국배당다우존스", ticker: "R2", quantity: 350 }), st({ id: "r3", name: "KT&G", ticker: "R3", quantity: 30, averagePrice: 90000, currentPrice: 110000 }),
  st({ id: "r4", name: "Apple", ticker: "R4", category: "foreign", currency: "USD", quantity: 15, averagePrice: 180, currentPrice: 230, purchaseExchangeRate: 1300 }), st({ id: "r5", name: "JEPI", ticker: "R5", category: "foreign", currency: "USD", quantity: 40, averagePrice: 55, currentPrice: 58, purchaseExchangeRate: 1300 }) ];
for (const [w, theme] of [[375, "dark"], [375, "light"], [390, "light"], [430, "dark"], [639, "light"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: theme });
  if (theme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", url: "http://localhost:3479" }]);
  const p = await ctx.newPage(); await enterDemo(p, { stocks: ST });
  await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(800); await p.getByText("배당", { exact: true }).first().click(); await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 15000 }); await p.waitForTimeout(1200);
  console.log(w, theme, await p.evaluate(() => [...document.querySelectorAll('[data-testid="dividend-stock-row"]')].map((r) => Math.round(r.getBoundingClientRect().height)).join(",")));
  await p.screenshot({ path: `${S}/uir-nat-${w}-${theme}.png`, fullPage: true });
  await ctx.close();
}
await b.close();
