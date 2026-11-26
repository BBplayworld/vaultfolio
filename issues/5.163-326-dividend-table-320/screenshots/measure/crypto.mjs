import { launch, enterDemo, CRYPTOS } from "./lib.mjs";
const b = await launch();
const out = {};
for (const w of [320, 375, 390]) {
  const ctx = await b.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("console", (m) => m.type() === "error" && errs.push(m.text().slice(0, 160)));
  await enterDemo(p, { crypto: CRYPTOS });
  await p.getByRole('radio', { name: '상세' }).first().click();
  await p.waitForTimeout(800);
  await p.getByText("암호화폐", { exact: true }).first().click();
  await p.waitForSelector('[data-testid="exchange-totals"]', { timeout: 8000 });
  const closed = await p.evaluate(() => { const t = document.querySelector('[data-testid="exchange-totals-toggle"]'); const r = t.getBoundingClientRect(); return { expanded: t.getAttribute("aria-expanded"), text: t.innerText.replace(/\n/g, " "), h: r.height, buttons: document.querySelectorAll('[data-testid="exchange-totals"] button').length }; });
  await p.click('[data-testid="exchange-totals-toggle"]');
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => {
    const range = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
    const q = (root, id) => root.querySelector(`[data-testid="${id}"]`);
    const lines = (el) => Math.round(el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight));
    const sec = document.querySelector('[data-testid="exchange-totals"]');
    const rows = [...sec.querySelectorAll('[data-testid="broker-row"]')].map((row) => {
      const name = q(row, "broker-row-name"), val = q(row, "broker-row-value"), prof = q(row, "broker-row-profit"), cnt = q(row, "broker-row-count"), sh = q(row, "broker-row-share");
      const rr = row.getBoundingClientRect(), nr = range(name), vr = range(val), pr = prof.getBoundingClientRect();
      const meta = cnt.parentElement;
      const rightLeft = Math.min(vr.left, ...[...prof.children].map((c) => range(c).left));
      return {
        name: name.textContent, nameLines: lines(name), nameClipped: name.scrollHeight > name.clientHeight + 1,
        value: val.textContent, valueLines: lines(val), profit: prof.textContent, profitH: Math.round(pr.height),
        sameLine: Math.abs(nr.top - vr.top) < 30 && vr.top < rr.bottom, // 금액이 이름과 같은 행 줄에 있는지(다음 줄로 밀리지 않음)
        gapNameToAmount: +(rightLeft - Math.max(nr.right, range(meta).right)).toFixed(1),
        metaLines: lines(meta), metaText: meta.textContent,
        rightEdgeOver: +(Math.max(vr.right, pr.right) - rr.right).toFixed(1),
        rowW: Math.round(rr.width), rowH: Math.round(rr.height), rowOverflow: row.scrollWidth - row.clientWidth,
      };
    });
    const de = document.documentElement;
    const hdr = [...document.querySelectorAll("p")].find((x) => x.textContent === "총 암호화폐 평가금액");
    return { rows, hScroll: de.scrollWidth - de.clientWidth, secW: Math.round(sec.getBoundingClientRect().width), note: sec.querySelector('[data-testid="exchange-totals-note"]')?.textContent, header: hdr?.parentElement?.parentElement?.innerText.replace(/\n/g, " | ") };
  });
  const num = (s) => Number(s.replace(/[^0-9-]/g, ""));
  m.sumValue = m.rows.reduce((a, r) => a + num(r.value), 0);
  m.sumProfit = m.rows.reduce((a, r) => a + num(r.profit.split("원")[0]), 0);
  m.sumShare = +m.rows.reduce((a, r) => a + Number(r.metaText.match(/([\d.]+)%/)[1]), 0).toFixed(1);
  m.keys = await p.evaluate(() => Object.keys(localStorage).sort().join(","));
  await p.locator('[data-testid="exchange-totals"]').screenshot({ path: new URL(`./crypto-${w}.png`, import.meta.url).pathname });
  out[w] = { closed, ...m, errs };
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1));
await b.close();
