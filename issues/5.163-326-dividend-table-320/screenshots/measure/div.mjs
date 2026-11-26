import { launch, enterDemo, DIV_STOCKS } from "./lib.mjs";
const tag = process.argv[2]; const widths = process.argv[3].split(",").map(Number); const measure = process.argv[4] === "m";
const b = await launch(); const out = {};
for (const w of widths) {
  const ctx = await b.newContext({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  await enterDemo(p, { stocks: DIV_STOCKS });
  await p.getByRole("radio", { name: "성과" }).first().click();
  await p.waitForTimeout(800);
  await p.getByText("배당", { exact: true }).first().click();
  await p.waitForSelector('[data-testid="dividend-stock-row"]', { timeout: 15000 });
  await p.waitForTimeout(1200);
  const root = p.locator('xpath=(//*[@data-testid="dividend-stock-row"])[1]/ancestor::div[contains(@class,"space-y-3")][1]');
  await root.screenshot({ path: new URL(`./div-${tag}-${w}.png`, import.meta.url).pathname, animations: "disabled" });
  if (measure) {
    out[w] = await p.evaluate(() => {
      const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
      const q = (root, id) => root.querySelector(`[data-testid="${id}"]`);
      const f = (n) => +n.toFixed(1);
      const de = document.documentElement;
      const tables = [...document.querySelectorAll('[data-testid="dividend-table"]')].map((t) => {
        const head = t.querySelector('[role="row"]');
        const hx = Object.fromEntries(["dividend-col-months", "dividend-col-pershare", "dividend-col-paid", "dividend-col-total"].map((id) => { const e = q(head, id); const r = e.getBoundingClientRect(); const g = range(e); return [id, { right: f(r.right), textLeft: f(g.left), w: f(r.width), h: f(r.height) }]; }));
        const hName = range(head.firstElementChild);
        return {
          cat: t.dataset.category, roles: { table: 1, colheaders: head.querySelectorAll('[role="columnheader"]').length },
          headH: f(head.getBoundingClientRect().height), headNameRight: f(hName.right), head: hx,
          rows: [...t.querySelectorAll('[data-testid="dividend-stock-row"]')].map((row) => {
            const rr = row.getBoundingClientRect(); const cs = getComputedStyle(row);
            const inL = rr.left + parseFloat(cs.paddingLeft), inR = rr.right - parseFloat(cs.paddingRight);
            const name = q(row, "dividend-stock-name"), pur = q(row, "dividend-stock-purchase"), meta = q(row, "dividend-stock-meta"), months = q(row, "dividend-stock-months"), per = q(row, "dividend-stock-pershare"), paid = q(row, "dividend-cell-paid"), total = q(row, "dividend-cell-total");
            const txt = (cell) => { const ps = [...cell.querySelectorAll("p")].filter((x) => x.getClientRects().length && x.textContent.trim()); const rs = ps.map(range); return { left: Math.min(...rs.map((r) => r.left)), right: Math.max(...rs.map((r) => r.right)), lines: ps.map((x) => Math.round(x.getBoundingClientRect().height / parseFloat(getComputedStyle(x).lineHeight))), texts: ps.map((x) => x.textContent), tops: ps.map((x) => f(x.getBoundingClientRect().top)) }; };
            const tp = txt(per), ta = txt(paid), tt = txt(total);
            const chips = [...months.children].map((c) => c.getBoundingClientRect());
            const chipRows = new Set(chips.map((c) => Math.round(c.top))).size;
            let chipOverlap = 0; chips.forEach((a, i) => chips.forEach((b2, j) => { if (j > i && a.left < b2.right - 0.5 && b2.left < a.right - 0.5 && a.top < b2.bottom - 0.5 && b2.top < a.bottom - 0.5) chipOverlap++; }));
            const nameLH = parseFloat(getComputedStyle(name).lineHeight);
            return {
              name: name.textContent, nameW: f(name.getBoundingClientRect().width), nameTextW: f(range(name).width), nameLines: Math.round(name.getBoundingClientRect().height / nameLH), nameClipped: name.scrollHeight > name.clientHeight + 1 || name.scrollWidth > name.clientWidth + 1,
              purchase: pur ? { text: pur.textContent, h: f(pur.getBoundingClientRect().height), rightOver: f(range(pur).right - inR), gapFromBadge: meta ? f(range(pur).left - meta.getBoundingClientRect().right) : null, sameLineAsBadge: meta ? Math.abs(pur.getBoundingClientRect().bottom - meta.getBoundingClientRect().bottom) < 6 : null } : null,
              chips: { n: chips.length, rows: chipRows, left: f(Math.min(...chips.map((c) => c.left)) - inL), rightOver: f(Math.max(...chips.map((c) => c.right)) - inR), overlap: chipOverlap, oneLineEach: chips.every((c) => c.height <= 25) },
              colW: { per: f(per.getBoundingClientRect().width), paid: f(paid.getBoundingClientRect().width), total: f(total.getBoundingClientRect().width) },
              textW: { per: f(tp.right - tp.left), paid: f(ta.right - ta.left), total: f(tt.right - tt.left) },
              gap: { perToPaid: f(ta.left - tp.right), paidToTotal: f(tt.left - ta.right) },
              lines: { per: tp.lines, paid: ta.lines, total: tt.lines }, texts: { per: tp.texts, paid: ta.texts, total: tt.texts },
              rightAlign: { per: f(tp.right - hx["dividend-col-pershare"].right), paid: f(ta.right - hx["dividend-col-paid"].right), total: f(tt.right - hx["dividend-col-total"].right), totalVsInner: f(tt.right - inR) },
              krwRowY: { paid: ta.tops.at(-1), total: tt.tops.at(-1) },
              cells: row.querySelectorAll(':scope > [role="cell"]').length, rowH: f(rr.height), rowOverflow: row.scrollWidth - row.clientWidth,
            };
          }),
        };
      });
      return { hScroll: de.scrollWidth - de.clientWidth, tables };
    });
    out[w].errs = errs;
  }
  await ctx.close();
}
if (measure) console.log(JSON.stringify(out));
await b.close();
