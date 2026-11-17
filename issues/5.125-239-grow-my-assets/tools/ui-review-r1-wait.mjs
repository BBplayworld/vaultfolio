// preview가 R-1 수정 빌드로 바뀔 때까지 기다린다(문단 class로 판정)
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app";
const b = await chromium.launch({ proxy });
for (let i = 0; i < 16; i++) {
  const ctx = await b.newContext(ctxOpt(390, "dark")); const p = await ctx.newPage();
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4000);
  await p.locator('[data-testid="grow-plus-hint"] button').first().click({ timeout: 5000 }).catch(() => {}); await p.waitForTimeout(700);
  const cls = await p.evaluate(() => [...document.querySelectorAll('[data-slot="popover-content"]')].pop()?.querySelectorAll("p")[1]?.className ?? null);
  console.log(new Date().toISOString(), "class:", JSON.stringify(cls)); await ctx.close();
  if (cls && cls.includes("break-keep")) { console.log("READY"); break; }
  await new Promise((r) => setTimeout(r, 25000));
}
await b.close();
