import { launch, HEAD, MAIN, blockExternal, setTheme, enterDemo, st } from "./lib.mjs";
import { createHash } from "node:crypto";
const SH = process.argv[2]; const b = await launch(); const out = {};
const STOCKS = [
  st({ id: "s1", name: "삼성전자", ticker: "005930", broker: "키움증권", quantity: 99999, averagePrice: 70000, currentPrice: 99999 }),
  st({ id: "s2", name: "SK하이닉스", ticker: "000660", broker: "미래에셋증권 연금저축 계좌 2호", quantity: 5000, averagePrice: 150000, currentPrice: 190000 }),
  st({ id: "s3", name: "KODEX 200", ticker: "069500", broker: "토스증권", quantity: 10, averagePrice: 35000, currentPrice: 41000 }),
  st({ id: "s4", name: "NAVER", ticker: "035420", broker: "", quantity: 30, averagePrice: 210000, currentPrice: 180000 }),
  st({ id: "s5", name: "카카오", ticker: "035720", broker: "한국투자증권ISA중개형계좌가나다라마바사", quantity: 100, averagePrice: 60000, currentPrice: 45000 }),
];
for (const w of [320, 359, 360, 375, 1280]) { const res = {};
  for (const [tag, base] of [["head", HEAD], ["main", MAIN]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 } }); await blockExternal(ctx); await ctx.route("**/api/finance**", (r) => /dividend/.test(r.request().url()) ? r.fallback() : r.abort()); await setTheme(ctx, base, "dark");
    const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && !/ERR_FAILED|Failed to load resource|Failed to fetch/.test(m.text()) && errs.push(m.text().slice(0, 160)));
    await enterDemo(p, base, { stocks: STOCKS });
    await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(700); await p.getByText("주식", { exact: true }).first().click(); await p.waitForTimeout(1200);
    await p.click('[data-testid="broker-totals-toggle"]'); await p.waitForTimeout(700);
    const m = await p.evaluate(() => { const sec = document.querySelector('[data-testid="broker-totals"]'); const s0 = sec.getBoundingClientRect();
      return { secH: Math.round(s0.height), text: sec.innerText.replace(/\n+/g, "|"), rows: [...sec.querySelectorAll('[data-testid="broker-row"]')].map((row) => ({ cls: row.className, kids: [...row.children].map((c) => { const r = c.getBoundingClientRect(); return [c.className, +(r.left - s0.left).toFixed(1), +(r.top - s0.top).toFixed(1), +r.width.toFixed(1), +r.height.toFixed(1)].join(","); }) })), resync: sec.querySelectorAll('[data-testid="broker-row-resync"]').length, hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    const png = await p.locator('[data-testid="broker-totals"]').screenshot({ path: `${SH}/stock-broker-${tag}-${w}.png`, animations: "disabled" });
    res[tag] = { m, hash: createHash("sha1").update(png).digest("hex"), errs }; await ctx.close();
  }
  out[w] = { sameGeom: JSON.stringify(res.head.m) === JSON.stringify(res.main.m), samePng: res.head.hash === res.main.hash, resync: res.head.m.resync, rows: res.head.m.rows.length, hScroll: res.head.m.hScroll, errs: res.head.errs, secH: [res.head.m.secH, res.main.m.secH] };
  if (!out[w].sameGeom) out[w].diff = [JSON.stringify(res.head.m).slice(0, 600), JSON.stringify(res.main.m).slice(0, 600)];
}
console.log(JSON.stringify(out, null, 0)); await b.close();
