// preview 데모(?demo=1)·체험(?trial=1) 연 탭 기본 상태 확인 — 조작 없음
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [, , OUT, BASE] = process.argv;
const b = await chromium.launch({ proxy });
for (const q of ["demo", "trial"]) {
  const ctx = await b.newContext(ctxOpt(390, "dark"));
  await ctx.route(/google-analytics|googletagmanager/, (r) => r.fulfill({ status: 204, body: "" }));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/?${q}=1`, { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(q === "demo" ? 25000 : 8000); // 데모는 시세 동기화·스냅샷 저장을 기다린다
  const home = await p.evaluate(() => document.querySelector('[data-testid="home-net-asset"]')?.textContent ?? document.body.innerText.match(/[\d,]{9,}원/)?.[0] ?? null);
  await p.evaluate(() => { location.hash = "#activity/change"; });
  await p.waitForSelector('[data-testid="change-period-year"]', { timeout: 30000 }).catch(() => {});
  await p.locator('[data-testid="change-period-year"]').first().click({ timeout: 8000 }).catch((e) => console.log(q, "click", e.message));
  await p.waitForTimeout(3000);
  const m = await p.evaluate(() => {
    const blk = document.querySelector('[data-testid="year-settle"]');
    const a = JSON.parse(localStorage.getItem("secretasset_asset_data") || "{}");
    const mo = JSON.parse(localStorage.getItem("secretasset_monthly_snapshots") || "[]");
    return { state: blk?.dataset.state ?? null, text: blk?.innerText.replace(/\n+/g, " | ") ?? null, hero: document.querySelector('[data-testid="change-hero"]')?.innerText.replace(/\n+/g, " | "), yearly: a.yearlyNetAssets, monthly: mo.map((x) => [x.month, x.date, Math.round(x.netAsset), !!(x.breakdown && x.fx && x.fxBase && x.cost)]) };
  });
  console.log(q, JSON.stringify({ home, ...m }));
  await p.screenshot({ path: `${OUT}/demo-${q}-year-390-dark.png`, fullPage: true });
  await ctx.close();
}
await b.close();
