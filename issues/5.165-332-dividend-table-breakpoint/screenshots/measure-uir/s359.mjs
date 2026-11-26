import { launch, enterDemo, DIV_STOCKS, CRYPTOS } from "./lib.mjs";
const S = process.env.S + "/shots";
const b = await launch(); const out = {};
const STOCKS = DIV_STOCKS.map((s, i) => ({ ...s, broker: ["한국투자증권 연금저축계좌", "데모증권", "데모증권", "Interactive Brokers LLC", ""][i], currentPrice: s.currentPrice * (i % 2 ? 0.8 : 1.3) }));
for (const [w, theme] of [[358, "dark"], [359, "dark"], [359, "light"], [360, "dark"]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, reducedMotion: "reduce", colorScheme: theme });
  if (theme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", url: "http://localhost:3479" }]);
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 120)));
  await enterDemo(p, { stocks: STOCKS, crypto: CRYPTOS });
  const r = out[`${w}-${theme}`] = {};
  await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(800);
  await p.getByText("주식", { exact: true }).first().click(); await p.waitForTimeout(1500);
  const tg = p.locator('[data-testid="broker-totals-toggle"]');
  if (await tg.count()) { if ((await tg.getAttribute("aria-expanded")) !== "true") await tg.click(); await p.waitForTimeout(500); }
  r.stock = await p.evaluate(() => {
    const f = (n) => +n.toFixed(1);
    const rows = [...document.querySelectorAll('[data-testid="stock-row-right"]')].map((e) => { const pr = e.parentElement.getBoundingClientRect(); const er = e.getBoundingClientRect(); return { mw: getComputedStyle(e).maxWidth, ratio: f(er.width / pr.width * 100), over: e.scrollWidth - e.clientWidth, rightGap: f(pr.right - er.right) }; });
    const brokers = [...document.querySelectorAll('[data-testid="broker-row"]')].map((row) => { const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); const btn = row.querySelector('[data-testid="broker-row-resync"]'); const br = btn?.getBoundingClientRect(); const val = row.querySelector('[data-testid="broker-row-value"]').getBoundingClientRect(); return { name: row.dataset.broker.slice(0, 10), wrap: cs.flexWrap, h: f(rr.height), btn: btn ? { w: f(br.width), h: f(br.height), rightDiff: f(rr.right - parseFloat(cs.paddingRight) - br.right), below: br.top > val.bottom - 4 } : null, valRightDiff: f(rr.right - parseFloat(cs.paddingRight) - val.right) }; });
    return { hs: document.documentElement.scrollWidth - document.documentElement.clientWidth, rows, brokers };
  });
  await p.screenshot({ path: `${S}/uir-stock-${w}-${theme}.png`, fullPage: true });
  await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(800);
  await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(1500);
  r.crypto = await p.evaluate(() => {
    const box = document.querySelector('[data-testid="detail-list-box-crypto"]'); if (!box) return null;
    const dots = [...box.querySelectorAll("span")].filter((s) => s.textContent === "·" && /max-\[360px\]:hidden/.test(s.className)).map((s) => getComputedStyle(s).display);
    const rights = [...box.querySelectorAll('[class*="max-[360px]:max-w-[45%]"]')].map((e) => ({ mw: getComputedStyle(e).maxWidth, over: e.scrollWidth - e.clientWidth }));
    return { hs: document.documentElement.scrollWidth - document.documentElement.clientWidth, dots: [...new Set(dots)], rights };
  });
  await p.screenshot({ path: `${S}/uir-crypto-${w}-${theme}.png`, fullPage: true });
  await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(800);
  await p.getByText("현금", { exact: true }).first().click(); await p.waitForTimeout(1500);
  r.cashButtons = await p.evaluate(() => [...document.querySelectorAll("button,a")].map((e) => (e.getAttribute("aria-label") || e.textContent.trim()).slice(0, 14)).filter(Boolean).slice(0, 40).join(" | "));
  await p.screenshot({ path: `${S}/uir-cash-${w}-${theme}.png`, fullPage: true });
  r.errs = errs;
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
