import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5134-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
for (const W of [320, 360, 375, 390, 1280]) {
  const ctx = await br.newContext({ viewport: { width: W, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 }); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000);
  const measure = () => p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].filter((b) => b.offsetParent).map((b) => { const r = b.querySelector('[data-testid="grow-row-rate"]'); const tr = document.createRange(); tr.selectNodeContents(r); const t = tr.getBoundingClientRect(); const c = b.querySelector("svg.lucide-chevron-right").getBoundingClientRect(); const bb = b.getBoundingClientRect(); return { t: r.textContent, gap: Math.round((c.left - t.right) * 10) / 10, rowH: Math.round(bb.height) }; }));
  const base = await measure(); await p.screenshot({ path: `${OUT}/254-base-${W}.png` });
  const res = {};
  for (const txt of ["+645.3%", "-99.9%", "+1,234.5%"]) {
    await p.evaluate((x) => document.querySelectorAll('[data-testid="grow-row-rate"]').forEach((e) => { if (e.offsetParent && e.textContent.trim()) e.textContent = x; }), txt);
    res[txt] = await measure(); if (txt === "+1,234.5%") await p.screenshot({ path: `${OUT}/254-inject-${W}.png` });
  }
  out[W] = { baseH: base.map((x) => x.rowH), minGap: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, Math.min(...v.map((x) => x.gap))])), injH: Object.fromEntries(Object.entries(res).map(([k, v]) => [k, v.map((x) => x.rowH)])) };
  await ctx.close();
}
console.log(JSON.stringify(out)); await br.close();
