// 체험 데모에 올해 항목이 생기면 성적표가 달라지는지 실측 — 체험 메모리 안에서만 조작(실데이터 없음)
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [, , OUT, BASE] = process.argv;
const b = await chromium.launch({ proxy });
const ctx = await b.newContext(ctxOpt(390, "dark"));
await ctx.route(/google-analytics|googletagmanager/, (r) => r.fulfill({ status: 204, body: "" }));
const p = await ctx.newPage();
p.on("dialog", (d) => d.accept());
await p.goto(`${BASE}/?trial=1`, { waitUntil: "domcontentloaded", timeout: 90000 });
await p.waitForTimeout(8000);
const report = async (tag) => {
  await p.evaluate(() => { location.hash = "#activity/report"; });
  await p.waitForTimeout(9000);
  const t = await p.evaluate(() => document.querySelector("main")?.innerText.replace(/\n+/g, " | ").slice(0, 1400) ?? document.body.innerText.replace(/\n+/g, " | ").slice(0, 1400));
  console.log(tag, t);
  await p.screenshot({ path: `${OUT}/trial-report-${tag}.png`, fullPage: true });
};
await report("before");
await p.evaluate(() => { location.hash = "#activity/change"; });
await p.waitForSelector('[data-testid="change-period-year"]', { timeout: 30000 });
await p.locator('[data-testid="change-period-year"]').first().click();
await p.waitForTimeout(2000);
await p.locator('button[aria-label="순자산 삭제"]').first().click(); await p.waitForTimeout(1500);
const add = async (y, v) => {
  await p.locator('[data-testid="yearly-add-link"]').first().click(); await p.waitForTimeout(1000);
  const dlg = p.getByRole("dialog").filter({ hasText: "년도별 순자산 추가" });
  const inputs = dlg.locator("input");
  await inputs.nth(0).fill(String(y)); await inputs.nth(1).fill(String(v)); await p.waitForTimeout(300);
  await dlg.getByRole("button", { name: "추가", exact: true }).click(); await p.waitForTimeout(2000);
};
await add(2026, 551303200); await add(2025, 505840000);
await p.waitForTimeout(2000);
const blk = await p.evaluate(() => ({ text: document.querySelector('[data-testid="year-settle"]')?.innerText.replace(/\n+/g, " | ") ?? null, hero: document.querySelector('[data-testid="change-hero"]')?.innerText.replace(/\n+/g, " | "), yearly: JSON.parse(localStorage.getItem("secretasset_asset_data")).yearlyNetAssets }));
console.log("year", JSON.stringify(blk));
await p.evaluate(() => document.querySelectorAll("[data-sonner-toaster]").forEach((e) => { e.style.display = "none"; }));
await p.screenshot({ path: `${OUT}/trial-year-with-current-item.png`, fullPage: true });
await report("after");
await b.close();
