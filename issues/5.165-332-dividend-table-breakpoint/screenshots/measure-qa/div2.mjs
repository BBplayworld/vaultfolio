// 수용 기준 5·6·7·11·12·13 보강 측정. 사용: BASE=.. node div2.mjs <tag> <widths> [light]
import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const [tag, ws, ...flags] = process.argv.slice(2); const light = flags.includes("light");
const b = await launch(); const out = {};
const open = async (w) => {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: light ? "light" : "dark" });
  await ctx.addCookies([{ name: "theme_mode", value: light ? "light" : "dark", url: process.env.BASE }]);
  const p = await ctx.newPage(); const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 200))); p.on("pageerror", (e) => errs.push("PE " + String(e).slice(0, 200)));
  await enterDemo(p, { stocks: DIV_STOCKS });
  await p.getByRole("radio", { name: "성과" }).first().click(); await p.waitForTimeout(800);
  await p.getByText("배당", { exact: true }).first().click();
  await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 15000 }); await p.waitForTimeout(1200);
  return { ctx, p, errs };
};
const measure = (p) => p.evaluate(() => {
  const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const f = (n) => +n.toFixed(1);
  const html = document.documentElement;
  const tables = [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => {
    const head = t.querySelector('[role="row"]'); const hc = [...head.children];
    const hinfo = hc.map((e) => { const r = e.getBoundingClientRect(); const g = range(e); return { t: e.textContent, w: f(r.width), h: f(r.height), right: f(g.right), left: f(g.left), top: f(r.top), lines: Math.round(g.height / parseFloat(getComputedStyle(e).lineHeight)), disp: getComputedStyle(e).display }; });
    const rows = [...t.querySelectorAll('[data-testid="dividend-stock-row"]')];
    const hr = (id) => hinfo[hc.findIndex((e) => e.dataset.testid === id)]?.right;
    return {
      roles: { table: t.getAttribute("role"), colh: head.querySelectorAll('[role="columnheader"]').length, rows: rows.length, cellsPerRow: rows.map((r) => r.querySelectorAll(':scope > [role="cell"]').length).join("") },
      head: hinfo,
      order: rows.map((r) => [...r.querySelectorAll("[data-testid]")].map((e) => e.dataset.testid.replace("dividend-", "")).join(">"))[0],
      rows: rows.map((row) => {
        const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row); const inL = rr.left + parseFloat(cs.paddingLeft);
        const q = (id) => row.querySelector(`[data-testid="${id}"]`);
        const tr = (cell) => Math.max(...[...cell.querySelectorAll("p")].filter((x) => x.getClientRects().length && x.textContent.trim()).map((x) => range(x).right));
        const months = q("dividend-stock-months"); const chips = [...months.children];
        const cr = chips.map((c) => c.getBoundingClientRect());
        let overlap = 0; for (let i = 0; i < cr.length; i++) for (let j = i + 1; j < cr.length; j++) { const a = cr[i], b2 = cr[j]; if (a.left < b2.right - 0.5 && b2.left < a.right - 0.5 && a.top < b2.bottom - 0.5 && b2.top < a.bottom - 0.5) overlap++; }
        const fill = row.querySelector('[data-testid="dividend-cell-paid"] > p[aria-hidden]');
        const paidP = q("dividend-paid-amount"), totP = q("dividend-est-amount");
        return {
          dPer: f(tr(q("dividend-stock-pershare")) - hr("dividend-col-pershare")), dPaid: f(tr(q("dividend-cell-paid")) - hr("dividend-col-paid")), dTot: f(tr(q("dividend-cell-total")) - hr("dividend-col-total")),
          chipLeft: f(Math.min(...cr.map((c) => c.left)) - inL), overlap,
          chipCss: [...new Set(chips.map((c) => { const s = getComputedStyle(c); return [s.fontSize, s.paddingLeft, s.letterSpacing, s.height].join("|"); }))].join(" ; "),
          fill: fill ? getComputedStyle(fill).display : null, paidTxt: paidP.textContent, yDiff: f(paidP.getBoundingClientRect().top - totP.getBoundingClientRect().top),
          nameFull: q("dividend-stock-name").scrollHeight <= q("dividend-stock-name").clientHeight + 1 && q("dividend-stock-name").scrollWidth <= q("dividend-stock-name").clientWidth + 1,
          metaLines: (() => { const m = q("dividend-stock-purchase"); return m ? Math.round(m.getBoundingClientRect().height / parseFloat(getComputedStyle(m).lineHeight)) : null; })(),
          fonts: [...new Set([...row.querySelectorAll("p,span")].map((e) => getComputedStyle(e).fontSize))].join(","),
        };
      }),
    };
  });
  const txt = [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => t.innerText.replace(/\s+/g, " ")).join(" || ");
  return { theme: html.className.match(/dark|light/g)?.join("+") ?? "", bg: getComputedStyle(document.body).backgroundColor, hScroll: html.scrollWidth - html.clientWidth, tables, txt };
});
for (const w of ws.split(",").map(Number)) {
  const { ctx, p, errs } = await open(w);
  const base = await measure(p);
  // 월 선택: 12월 막대
  let sel = null;
  try {
    const bars = p.locator(".recharts-bar-rectangle"); const n = await bars.count();
    const boxes = []; for (let i = 0; i < n; i++) { const bb = await bars.nth(i).boundingBox(); if (bb) boxes.push(bb); }
    const mx = Math.max(...boxes.map((x) => x.x)); const tgt = boxes.find((x) => x.x === mx);
    const wrap = await p.locator(".recharts-wrapper").first().boundingBox();
    await p.mouse.click(tgt.x + tgt.width / 2, wrap.y + wrap.height / 2); await p.waitForTimeout(700);
    const m2 = await measure(p);
    sel = { heads: m2.tables.map((t) => t.head.map((h) => `${h.t}(${h.lines}줄,w${h.w})`).join(" ")), dAlign: m2.tables.flatMap((t) => t.rows.map((r) => [r.dPer, r.dPaid, r.dTot].join("/"))), hScroll: m2.hScroll, rows: m2.tables.map((t) => t.roles.rows).join("+") };
    const root = p.locator('xpath=(//*[@data-testid="dividend-stock-row"])[1]/ancestor::div[contains(@class,"space-y-3")][1]');
    await root.screenshot({ path: `${process.env.SHOTS}/${tag}-month12-${w}-${light ? "light" : "dark"}.png`, animations: "disabled" });
  } catch (e) { sel = { error: String(e).slice(0, 200) }; }
  out[w] = { ...base, sel, errs };
  await ctx.close();
}
console.log(JSON.stringify(out));
await b.close();
