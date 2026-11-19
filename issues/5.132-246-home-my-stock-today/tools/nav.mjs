import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const br = await chromium.launch({ proxy });
for (const base of ["5131", "5132"]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => {
    window.__ys = []; const t0 = performance.now();
    const tick = () => { const d = document.querySelector('[data-testid="home-donut"]'); const s = document.querySelector('[data-testid="home-my-stock-slot"]');
      if (d) { const y = Math.round(d.getBoundingClientRect().top); const st = s ? s.dataset.state : "none"; const last = window.__ys[window.__ys.length - 1]; if (!last || last[1] !== y || last[2] !== st) window.__ys.push([Math.round(performance.now() - t0), y, st]); }
      if (performance.now() - t0 < 15000) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  const p = await ctx.newPage(); let n = 0; const log = [];
  p.on("request", (r) => { if (r.url().includes("/api/finance/profit")) { n++; log.push(r.url().split("?")[1].slice(0, 30)); } });
  await p.goto(`https://secretasset-git-issue-${base}-bbplayworlds-projects.vercel.app/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  const first = n; const frames = await p.evaluate(() => window.__ys);
  // 앱 안 이동: 상세·주식 → 홈
  await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForTimeout(5000); const afterStocks = n;
  await p.evaluate(() => { location.hash = ""; }); await p.waitForTimeout(5000);
  const homeAgain = n; const txt = await p.evaluate(() => document.querySelector('[data-testid="home-my-stock"]')?.innerText.replace(/\s+/g, " "));
  console.log(base, JSON.stringify({ first, afterStocks: afterStocks - first, homeAgain: homeAgain - afterStocks, txt, frames }));
  await ctx.close();
}
await br.close();
