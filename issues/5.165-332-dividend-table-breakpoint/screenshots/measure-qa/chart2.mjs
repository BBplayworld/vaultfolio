import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const b = await launch();
for (const fixed of [true, false]) {
const c = await b.newContext({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1, reducedMotion: process.env.RM || "reduce", colorScheme: "dark" });
const q = await c.newPage();
if (fixed) await enterDemo(q, { stocks: DIV_STOCKS });
else { // 시계 고정 없이 같은 픽스처
  await q.route("**/api/finance/dividend**", async (route) => { const { payoutsFor } = await import("./lib.mjs"); const t = new URL(route.request().url()).searchParams.get("ticker"); route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: payoutsFor(t) }) }); });
  await q.goto(process.env.BASE + "/", { waitUntil: "networkidle" }).catch(() => {}); await q.click('[data-testid="welcome-trial-link"]'); await q.waitForTimeout(2500);
  await q.evaluate((stocks) => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); d.stocks = stocks; d.transactions = []; localStorage.setItem("secretasset_asset_data", JSON.stringify(d)); window.dispatchEvent(new Event("storage")); }, DIV_STOCKS); await q.waitForTimeout(800);
}
await q.getByRole("radio", { name: "성과" }).first().click(); await q.waitForTimeout(800);
await q.getByText("배당", { exact: true }).first().click(); await q.waitForTimeout(4000);
console.log(fixed ? "시계 고정" : "실시계", JSON.stringify(await q.evaluate(() => { const els = [...document.querySelectorAll(".recharts-bar-rectangle path, .recharts-bar-rectangle rect")]; const e = els.find((x) => x.getBoundingClientRect().height > 20) || els[0]; if (!e) return null; const chain = []; for (let n = e; n && n !== document.body; n = n.parentElement) { const s = getComputedStyle(n); if (s.opacity !== "1" || s.visibility !== "visible" || s.clipPath !== "none" || s.transform !== "none" || n.getAttribute("clip-path")) chain.push((n.tagName + "." + (n.getAttribute("class") || "").slice(0, 40)) + " op=" + s.opacity + " vis=" + s.visibility + " clip=" + s.clipPath.slice(0, 30) + " tf=" + s.transform.slice(0, 40)); } const r = e.getBoundingClientRect(); const cp = document.querySelector("clipPath rect"); return { fill: e.getAttribute("fill"), fo: e.getAttribute("fill-opacity"), d: (e.getAttribute("d") || "").slice(0, 50), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], chain, clipRect: cp ? cp.outerHTML.slice(0, 120) : null, wrappers: [...document.querySelectorAll(".recharts-wrapper")].map((w) => { const r = w.getBoundingClientRect(); return [Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }) }; })));
const box = await q.locator(".recharts-bar-rectangle").first().evaluate((e) => { const r = e.closest("svg").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
await q.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG}-chartsvg-${fixed ? "fixed" : "real"}.png`, clip: box });
await c.close(); }
await b.close();
