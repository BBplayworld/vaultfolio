import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const b = await launch(); const res = {};
const ctx = await b.newContext({ viewport: { width: 639, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "dark" });
const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 120)));
await enterDemo(p, { stocks: DIV_STOCKS });
await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(800);
await p.getByText("배당", { exact: true }).first().click(); await p.waitForSelector('[data-testid="dividend-stock-row"]'); await p.waitForTimeout(1200);
await p.evaluate(() => { window.__n = [...document.querySelectorAll('[data-testid="dividend-table"] *')]; window.__n.forEach((e, i) => (e.__qa = i)); });
const snap = () => p.evaluate(() => { const all = [...document.querySelectorAll('[data-testid="dividend-table"] *')]; const rows = [...document.querySelectorAll('[data-testid="dividend-stock-row"]')]; const fill = document.querySelector('[data-testid="dividend-cell-paid"] > p[aria-hidden]'); return { w: innerWidth, same: all.length === window.__n.length && all.every((e, i) => e === window.__n[i] && e.__qa === i), nodes: all.length, rows: rows.length, cols: getComputedStyle(rows[0]).gridTemplateColumns.split(" ").length, fill: fill && getComputedStyle(fill).display, txt: [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => t.textContent).join("|").length, txtHash: [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => t.textContent).join("|"), hs: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
const seq = []; let base = null;
for (const w of [639, 640, 639, 641, 320, 640, 639]) { await p.setViewportSize({ width: w, height: 1000 }); await p.waitForTimeout(500); const s = await snap(); if (!base) base = s.txtHash; s.txtSame = s.txtHash === base; delete s.txtHash; seq.push(s); }
console.log(JSON.stringify(seq)); console.log("errs", errs.length);
await ctx.close();
// 배당 차트 막대(조정자 추가 확인 ②): 주입 픽스처와 기본 데모
for (const mode of ["fixture", "demo"]) {
  const c = await b.newContext({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: "dark" });
  const q = await c.newPage(); const api = []; q.on("response", async (r) => { if (r.url().includes("/api/finance/dividend")) api.push(r.status()); });
  if (mode === "fixture") await enterDemo(q, { stocks: DIV_STOCKS });
  else { await q.clock.setFixedTime(new Date("2026-11-26T03:00:00Z")); await q.goto(process.env.BASE + "/", { waitUntil: "networkidle" }).catch(() => {}); await q.click('[data-testid="welcome-trial-link"]'); await q.waitForTimeout(2500); }
  await q.getByRole("radio", { name: "성과" }).first().click(); await q.waitForTimeout(800);
  await q.getByText("배당", { exact: true }).first().click(); await q.waitForTimeout(4000);
  const info = await q.evaluate(() => { const bars = [...document.querySelectorAll(".recharts-bar-rectangle path, .recharts-bar-rectangle rect")].map((e) => e.getBoundingClientRect()); const wrap = document.querySelector(".recharts-wrapper")?.getBoundingClientRect(); return { bars: bars.length, nonZero: bars.filter((r) => r.height > 0.5).length, maxH: Math.max(0, ...bars.map((r) => Math.round(r.height))), wrap: wrap ? [Math.round(wrap.width), Math.round(wrap.height)] : null, rows: document.querySelectorAll('[data-testid="dividend-stock-row"]').length, text: (document.querySelector("main")?.innerText ?? "").replace(/\s+/g, " ").slice(0, 260) }; });
  console.log(mode, JSON.stringify(info), "api", JSON.stringify(api.reduce((a, s) => ((a[s] = (a[s] || 0) + 1), a), {})));
  await q.screenshot({ path: `${process.env.SHOTS}/${process.env.TAG}-divpage-${mode}-390.png`, fullPage: true, animations: "disabled" });
  await c.close();
}
await b.close();
