import { launch, HEAD, blockExternal, enterDemo } from "./lib.mjs";
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 900 } }); await blockExternal(ctx); const p = await ctx.newPage(); await enterDemo(p, HEAD);
await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(700); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(900);
console.log(p.url(), JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('button,a,[role=radio]')].filter((x) => x.getClientRects().length).map((x) => (x.getAttribute("aria-label") || x.innerText).replace(/\n/g, " ").slice(0, 14)))));
await p.screenshot({ path: process.argv[2] + `/dbg-crypto.png` }); await ctx.close();
await b.close();
