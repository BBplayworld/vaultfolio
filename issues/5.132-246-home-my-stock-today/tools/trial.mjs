import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const br = await chromium.launch({ proxy });
for (const base of ["5131", "5132"]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } }); const p = await ctx.newPage(); const urls = [];
  p.on("request", (r) => { if (r.url().includes("/api/finance/profit")) urls.push(r.url().split("?")[1]); });
  await p.goto(`https://secretasset-git-issue-${base}-bbplayworlds-projects.vercel.app/?trial=1`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(9000);
  console.log(base, urls.length, JSON.stringify(urls), await p.evaluate(() => document.querySelector('[data-testid="home-my-stock"]')?.innerText.replace(/\s+/g, " ") ?? "줄 없음"));
  await ctx.close();
}
await br.close();
