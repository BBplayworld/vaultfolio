// 데모·체험 '정한 날 가격 대비 %' 실측 — node dev-demo-price-check.mjs <출력 폴더> <preview URL> <태그>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV, TAG] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
for (const q of ["demo", "trial"]) {
  const ctx = await b.newContext(ctxOpt(390, "dark"));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(12000); // 실시간 시세 반영 대기
  await p.evaluate(() => { location.hash = "#activity/report"; });
  await p.waitForTimeout(6000);
  const rows = await p.locator('[data-testid="grow-row"]').evaluateAll((els) => els.map((e) => {
    const pr = e.querySelector('[data-testid="grow-row-price"]');
    return `${e.dataset.ticker}(${e.dataset.label}) ${pr ? pr.innerText.replace(/\s+/g, " ") : "-"}`;
  }));
  // 접힌 행까지 보려고 전체 보기
  const more = p.locator('[data-testid="grow-more"]');
  if (await more.count()) { await more.click().catch(() => {}); await p.waitForTimeout(800); }
  const all = await p.locator('[data-testid="grow-row-price"]').evaluateAll((els) => els.map((e) => `${e.closest('[data-testid="grow-row"]').dataset.ticker} ${e.innerText.replace(/\s+/g, " ")}`));
  console.log(`== ${TAG} ${q} 390 dark | 위 3행: ${rows.slice(0, 3).join(" | ")}`);
  console.log(`   가격 % 전체: ${all.join(" | ")} | pageerrors ${errs.length}`);
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight4-price-${TAG}-${q}-390-dark.png` });
  await ctx.close();
}
await b.close();
