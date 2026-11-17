// R2 재판정 보조 — 자산 변화 월 '변화 원인' 펼침 전후 비교(데모 390). 코드 수정 0
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const [tag, PV] of [["after", "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"], ["before", "https://secretasset-4s5q8al1a-bbplayworlds-projects.vercel.app"]]) {
  const ctx = await b.newContext(ctxOpt(390, "dark")); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity/netasset"; }); await p.waitForTimeout(5000);
  await p.locator('[data-testid="change-period-month"]').first().click(); await p.waitForTimeout(4000);
  const t = p.getByText(/^외 \d개$/).first(); if (await t.count()) { await t.click(); await p.waitForTimeout(1200); }
  const txt = await p.evaluate(() => { const h = [...document.querySelectorAll("h2,h3,span,p")].find((e) => e.textContent.trim() === "변화 원인"); let s = h; for (let i = 0; i < 6 && s && !/외|접기/.test(s.innerText ?? ""); i++) s = s.parentElement; return s ? s.innerText.replace(/\n+/g, " ¦ ") : null; });
  console.log(tag, txt);
  await p.screenshot({ path: `${OUT}/i4-r2b-${tag}-demo-390-change-month-cause-dark.png` }); await ctx.close();
}
await b.close();
