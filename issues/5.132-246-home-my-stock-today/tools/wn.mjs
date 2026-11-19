import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const br = await chromium.launch({ proxy });
for (const W of [320, 360, 375, 390, 430, 1280]) {
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 });
  const p = await ctx.newPage();
  await p.goto(`https://secretasset-git-issue-5132-bbplayworlds-projects.vercel.app/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(6000);
  await p.evaluate(() => window.dispatchEvent(new CustomEvent("open-whats-new", { detail: { source: "more" } })));
  await p.waitForSelector('[data-testid="whats-new-item"]'); await p.waitForTimeout(800);
  const r = await p.evaluate(() => {
    const li = document.querySelector('[data-testid="whats-new-item"]');
    const lines = (el) => { const out = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { if (n.parentElement.closest('[data-testid="whats-new-item-new"]')) continue; for (let i = 0; i < n.length; i++) { const rg = document.createRange(); rg.setStart(n, i); rg.setEnd(n, i + 1); const b = rg.getClientRects()[0]; if (!b) continue; const y = Math.round(b.top); let L = out.find((l) => Math.abs(l.y - y) < 4); if (!L) out.push(L = { y, t: "" }); L.t += n.data[i]; } } return out.map((l) => l.t.trim()); };
    const ps = li.querySelectorAll("p");
    return { title: lines(ps[0]), body: lines(ps[1]) };
  });
  console.log(W, JSON.stringify(r));
  await p.locator('[data-testid="whats-new-item"]').first().screenshot({ path: `${OUT}/wn-${W}.png` });
  await ctx.close();
}
await br.close();
