import { launch, HEAD, MAIN, blockExternal, setTheme, enterDemo, co } from "./lib.mjs";
import { createHash } from "node:crypto";
const SH = process.argv[2]; const b = await launch(); const out = {};
const ONE = [co({ id: "o1", name: "비트코인", symbol: "BTC", exchange: "업비트", quantity: 0.5, averagePrice: 98000000, currentPrice: 135790000 }), co({ id: "o2", name: "이더리움", symbol: "ETH", exchange: "업비트", quantity: 2, averagePrice: 4300000, currentPrice: 3980000 })];
for (const w of [375, 1280]) { const r = {};
  for (const [tag, base] of [["head", HEAD], ["main", MAIN]]) { const ctx = await b.newContext({ viewport: { width: w, height: 900 }, reducedMotion: "reduce" }); await blockExternal(ctx); await ctx.route("**/api/**", (x) => x.abort()); await setTheme(ctx, base, "dark"); const p = await ctx.newPage();
    await enterDemo(p, base, { crypto: ONE }); await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(700); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(1500);
    await p.addStyleTag({ content: "[data-sonner-toaster]{display:none!important}" });
    const card = p.locator("main").first(); const png = await p.screenshot({ path: `${SH}/crypto-oneex-${tag}-${w}.png`, animations: "disabled" });
    r[tag] = { hash: createHash("sha1").update(png).digest("hex"), text: await p.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 500)), block: await p.locator('[data-testid="exchange-totals"]').count() }; await ctx.close(); }
  out[w] = { samePng: r.head.hash === r.main.hash, sameText: r.head.text === r.main.text, block: r.head.block }; }
console.log(JSON.stringify(out)); await b.close();
