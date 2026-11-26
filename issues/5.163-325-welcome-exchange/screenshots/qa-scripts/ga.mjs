import { launch, HEAD, blockExternal, setTheme, enterDemo, co } from "./lib.mjs";
const SH = process.argv[2]; const b = await launch(); const out = {};
const REAL = [
  co({ id: "r1", name: "비트코인", symbol: "BTC", exchange: "업비트", quantity: 1.2345, averagePrice: 98000000, currentPrice: 135790000 }),
  co({ id: "r2", name: "이더리움", symbol: "ETH", exchange: "빗썸", quantity: 12.5, averagePrice: 4300000, currentPrice: 3980000 }),
];
const c0 = await b.newContext({ viewport: { width: 375, height: 900 } }); await blockExternal(c0); const p0 = await c0.newPage(); await enterDemo(p0, HEAD, { crypto: REAL });
const data = await p0.evaluate(() => localStorage.getItem("secretasset_asset_data")); await c0.close();
const ctx = await b.newContext({ viewport: { width: 375, height: 900 }, timezoneId: "Asia/Seoul" }); await blockExternal(ctx); await setTheme(ctx, HEAD, "dark");
await ctx.route("**/api/**", (r) => r.abort());
await ctx.addInitScript((d) => { if (!localStorage.getItem("secretasset_asset_data")) localStorage.setItem("secretasset_asset_data", d); window.__ga = []; window.gtag = function () { window.__ga.push(Array.from(arguments)); }; }, data);
const p = await ctx.newPage();
await p.goto(HEAD + "/", { waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(2500);
out.homeTip = await p.evaluate(() => [...document.querySelectorAll("*")].filter((x) => x.children.length === 0 && /새 소식/.test(x.textContent)).map((x) => x.textContent.slice(0, 40)));
await p.screenshot({ path: `${SH}/home-nontrial-375-dark.png` });
await p.getByRole("radio", { name: "상세" }).first().click(); await p.waitForTimeout(700); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(900);
const ev = () => p.evaluate(() => window.__ga.filter((a) => a[0] === "event").map((a) => ({ n: a[1], p: JSON.parse(JSON.stringify(a[2] ?? {})) })));
await p.waitForTimeout(5000); const all0 = await p.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())); const keys0 = await p.evaluate(() => Object.keys(localStorage).sort()); const snap0 = await p.evaluate(() => localStorage.getItem("secretasset_asset_data"));
out.before = (await ev()).filter((e) => e.p?.page_title === "상세·암호화폐·거래소별 열기").length;
const t = p.locator('[data-testid="exchange-totals-toggle"]');
await t.click(); await p.waitForTimeout(400); out.after1 = (await ev()).filter((e) => e.p?.page_title === "상세·암호화폐·거래소별 열기").length;
await t.click(); await p.waitForTimeout(400); await t.click(); await p.waitForTimeout(400);
const all1 = await p.evaluate(() => JSON.stringify(Object.entries(localStorage).sort())); out.toggleOnlyStorageSame = all0 === all1; out.sessKeys = await p.evaluate(() => Object.keys(sessionStorage));
await p.getByRole("button", { name: "뒤로가기" }).first().click(); await p.waitForTimeout(600); await p.getByText("암호화폐", { exact: true }).first().click(); await p.waitForTimeout(800);
await p.locator('[data-testid="exchange-totals-toggle"]').click(); await p.waitForTimeout(500);
const evs = await ev(); const mine = evs.filter((e) => e.p?.page_title === "상세·암호화폐·거래소별 열기");
out.count = mine.length; out.payload = mine[0]; out.payloadKeys = Object.keys(mine[0]?.p ?? {}); out.totalEvents = evs.length; out.names = [...new Set(evs.map((e) => e.n + ":" + (e.p.category ?? e.p.page_title ?? "")))].slice(0, 20);
const keys1 = await p.evaluate(() => Object.keys(localStorage).sort()); const snap1 = await p.evaluate(() => localStorage.getItem("secretasset_asset_data"));
out.storage = { keysAdded: keys1.filter((k) => !keys0.includes(k)), keysRemoved: keys0.filter((k) => !keys1.includes(k)), dataUnchanged: snap0 === snap1 };
console.log(JSON.stringify(out, null, 1)); await b.close();
