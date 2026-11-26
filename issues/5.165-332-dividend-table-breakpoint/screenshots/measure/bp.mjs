// 사용: node bp.mjs <tag> <widths> <candidateN|0> [chip] [light]
import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const [tag, ws, candS, ...flags] = process.argv.slice(2);
const widths = ws.split(",").map(Number); const cand = Number(candS); const chip = flags.includes("chip"); const light = flags.includes("light");
const SHOTS = process.env.SHOTS;
const b = await launch(); const out = {};
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce", colorScheme: light ? "light" : "dark" });
  if (light) await ctx.addCookies([{ name: "theme_mode", value: "light", url: "http://localhost:3477" }]);
  const p = await ctx.newPage();
  const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  await enterDemo(p, { stocks: DIV_STOCKS });
  await p.getByRole("radio", { name: "성과" }).first().click();
  await p.waitForTimeout(800);
  await p.getByText("배당", { exact: true }).first().click();
  await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 15000 });
  await p.waitForTimeout(1200);
  let injected = null;
  if (cand) {
    injected = await p.evaluate(({ N, chip }) => {
      const parts = []; let nMax = 0;
      const walk = (rules, wrap) => {
        for (const r of rules) {
          if (r instanceof CSSMediaRule) {
            const c = r.conditionText.replace(/\s/g, "");
            if (c === "notalland(min-width:360px)" || c === "(width<360px)" || c === "(max-width:359.98px)") {
              nMax += r.cssRules.length;
              parts.push(wrap(`@media (width < ${N}px){${[...r.cssRules].map((x) => x.cssText).join("\n")}}`));
            } else walk(r.cssRules, (t) => wrap(`@media ${r.conditionText}{${t}}`));
          } else if (r instanceof CSSStyleRule && r.cssRules?.length) walk(r.cssRules, (t) => wrap(`${r.selectorText}{${t}}`));
          else if (r.cssRules) walk(r.cssRules, wrap); // @layer 등은 벗겨 낸다(뒤에 주입 → 우선)
        }
      };
      for (const s of document.styleSheets) { try { walk(s.cssRules, (t) => t); } catch {} }
      parts.push(`@media (width < ${N}px){[data-testid="dividend-cell-paid"] > p[aria-hidden]{display:block !important}}`);
      parts.push(`@media (width >= ${N}px){[data-testid="dividend-cell-paid"] > p[aria-hidden]{display:none !important}}`);
      if (chip) parts.push(`@media (width < ${N}px){[data-testid="dividend-stock-months"] > *{padding-inline:8px !important;font-size:12px !important;letter-spacing:normal !important}}`);
      const st = document.createElement("style"); st.textContent = parts.join("\n"); document.head.appendChild(st);
      return nMax;
    }, { N: cand, chip });
    await p.waitForTimeout(300);
  }
  const root = p.locator('xpath=(//*[@data-testid="dividend-stock-row"])[1]/ancestor::div[contains(@class,"space-y-3")][1]');
  await root.screenshot({ path: `${SHOTS}/${tag}-${w}-${light ? "light" : "dark"}.png`, animations: "disabled" });
  out[w] = await p.evaluate(() => {
    const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const q = (root, id) => root.querySelector(`[data-testid="${id}"]`);
    const f = (n) => +n.toFixed(1);
    const de = document.documentElement;
    const tables = [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => {
      const head = t.querySelector('[role="row"]');
      const hs = [...head.children].map((e) => { const r = e.getBoundingClientRect(); const g = range(e); return { right: f(r.right), tl: f(g.left), tr: f(g.right), w: f(r.width), h: f(r.height) }; });
      const vis = hs.filter((h) => h.w > 2).sort((a, b) => a.tl - b.tl);
      let headMinGap = 999; for (let i = 1; i < vis.length; i++) headMinGap = Math.min(headMinGap, f(vis[i].tl - vis[i - 1].tr));
      return {
        cat: t.dataset.category, tableW: f(t.getBoundingClientRect().width), headH: f(head.getBoundingClientRect().height), headMinGap, cols: getComputedStyle(head).gridTemplateColumns,
        rows: [...t.querySelectorAll('[data-testid="dividend-stock-row"]')].map((row) => {
          const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row);
          const inL = rr.left + parseFloat(cs.paddingLeft), inR = rr.right - parseFloat(cs.paddingRight);
          const name = q(row, "dividend-stock-name"), pur = q(row, "dividend-stock-purchase"), months = q(row, "dividend-stock-months"), per = q(row, "dividend-stock-pershare"), paid = q(row, "dividend-cell-paid"), total = q(row, "dividend-cell-total");
          const txt = (cell) => { const ps = [...cell.querySelectorAll("p")].filter((x) => x.getClientRects().length && x.textContent.trim()); const rs = ps.map(range); return { left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)), lines: ps.map((x) => Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight))), tops: ps.map((x) => f(x.getBoundingClientRect().top)) }; };
          const tp = txt(per), ta = txt(paid), tt = txt(total);
          const chips = [...months.children].map((c) => c.getBoundingClientRect());
          const mr = months.getBoundingClientRect();
          const nameLH = parseFloat(getComputedStyle(name).lineHeight);
          return {
            name: name.textContent.slice(0, 12), inner: f(inR - inL), nameW: f(name.getBoundingClientRect().width), nameTextW: f(range(name).width), nameLines: Math.round(name.getBoundingClientRect().height / nameLH), nameClipped: name.scrollHeight > name.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1,
            purH: pur ? f(pur.getBoundingClientRect().height) : null,
            chips: { n: chips.length, rows: new Set(chips.map((c) => Math.round(c.top))).size, rightOver: f(Math.max(...chips.map((c) => c.right)) - inR), chipRight: f(Math.max(...chips.map((c) => c.right))), wMax: f(Math.max(...chips.map((c) => c.width))) },
            colW: { months: f(mr.width), per: f(per.getBoundingClientRect().width), paid: f(paid.getBoundingClientRect().width), total: f(total.getBoundingClientRect().width) },
            textW: { per: f(tp.right - tp.left), paid: f(ta.right - ta.left), total: f(tt.right - tt.left) },
            gap: { chipToPer: f(tp.left - Math.max(...chips.map((c) => c.right))), perToPaid: f(ta.left - tp.right), paidToTotal: f(tt.left - ta.right), sameRowAsChips: Math.abs(mr.top - per.getBoundingClientRect().top) < 40 && mr.left > inL + 20 },
            lines: { per: tp.lines, paid: ta.lines, total: tt.lines }, totalVsInner: f(tt.right - inR), krwY: [ta.tops.at(-1), tt.tops.at(-1)],
            rowH: f(rr.height), rowOverflow: row.scrollWidth - row.clientWidth,
          };
        }),
      };
    });
    return { hScroll: de.scrollWidth - de.clientWidth, tables };
  });
  out[w].errs = errs.length; out[w].injected = injected;
  await ctx.close();
}
console.log(JSON.stringify(out));
await b.close();
