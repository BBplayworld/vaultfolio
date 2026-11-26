import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const S = process.env.S + "/shots"; const b = await launch();
const go = async (p) => { await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(800); await p.getByText("배당", { exact: true }).first().click(); await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 15000 }); await p.waitForTimeout(1200); };
// 1) 639↔640 리사이즈
{
  const ctx = await b.newContext({ viewport: { width: 639, height: 1000 }, colorScheme: "dark" }); const p = await ctx.newPage();
  await enterDemo(p, { stocks: DIV_STOCKS }); await go(p);
  await p.evaluate(() => { window.__rows = [...document.querySelectorAll('[data-testid="dividend-stock-row"]')]; window.__rows.forEach((r, i) => (r.__mark = i)); });
  const snap = () => p.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="dividend-stock-row"]')]; const head = document.querySelector('[data-testid="dividend-table"] [role="row"]'); return { w: innerWidth, same: rows.length === window.__rows.length && rows.every((r, i) => r === window.__rows[i] && r.__mark === i), n: rows.length, text: rows.map((r) => r.textContent).join("|").length, cols: getComputedStyle(head).gridTemplateColumns.split(" ").length, filler: [...new Set([...document.querySelectorAll('[data-testid="dividend-cell-paid"] > p[aria-hidden]')].map((e) => getComputedStyle(e).display))], tables: document.querySelectorAll('[role="table"]').length, ch: document.querySelectorAll('[role="columnheader"]').length, cells: rows.map((r) => r.querySelectorAll('[role="cell"]').length).join(""), hs: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
  const seq = [];
  for (const w of [639, 640, 639, 640, 500, 641, 639]) { await p.setViewportSize({ width: w, height: 1000 }); await p.waitForTimeout(250); seq.push(await snap()); }
  console.log(JSON.stringify(seq));
  await ctx.close();
}
// 2) 데모 기본 데이터(픽스처 없음) 자연 상태
for (const [w, theme] of [[375, "dark"], [375, "light"], [390, "dark"], [430, "dark"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: theme });
  if (theme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", url: "http://localhost:3479" }]);
  const p = await ctx.newPage(); await enterDemo(p, {});
  try { await go(p); const info = await p.evaluate(() => [...document.querySelectorAll('[data-testid="dividend-stock-row"]')].map((r) => Math.round(r.getBoundingClientRect().height)).join(",")); console.log(w, theme, "rows", info);
    await p.locator('[data-testid="dividend-table"]').first().scrollIntoViewIfNeeded(); await p.screenshot({ path: `${S}/uir-demo-${w}-${theme}.png`, fullPage: true }); } catch (e) { console.log(w, theme, "ERR", e.message.slice(0, 120)); await p.screenshot({ path: `${S}/uir-demo-${w}-${theme}.png`, fullPage: true }); }
  await ctx.close();
}
await b.close();
