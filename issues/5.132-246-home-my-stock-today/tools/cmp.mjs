import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const br = await chromium.launch({ proxy });
async function visit(ctx, base, close) {
  const p = await ctx.newPage(); let n = 0;
  p.on("request", (r) => { if (r.url().includes("/api/finance/profit")) n++; });
  await p.goto(`https://secretasset-git-issue-${base}-bbplayworlds-projects.vercel.app/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(8000);
  const before = await p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("secretasset_profit:")).length);
  if (close) await p.close();
  return { n, keys: before };
}
for (const mode of ["keepOpen", "close"]) for (const base of ["5131", "5132", "5131", "5132"]) {
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 } });
  const a = await visit(ctx, base, mode === "close"); const b = await visit(ctx, base, mode === "close"); const c = await visit(ctx, base, mode === "close");
  console.log(mode, base, JSON.stringify([a, b, c]));
  await ctx.close();
}
await br.close();
