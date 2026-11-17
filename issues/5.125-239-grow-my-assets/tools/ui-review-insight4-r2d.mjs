// R2 재판정 보조 — 데모 홈 Hero '전일 대비' 원인 펼침 전후 비교(390). 코드 수정 0
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const [tag, PV] of [["after", "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"], ["before", "https://secretasset-4s5q8al1a-bbplayworlds-projects.vercel.app"]]) {
  const ctx = await b.newContext(ctxOpt(390, "dark")); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(15000);
  const t = p.getByText(/^외 \d개$/).first(); if (await t.count()) { await t.click(); await p.waitForTimeout(1200); }
  const L = (await p.locator("main").innerText()).split("\n").map((x) => x.trim()).filter(Boolean); const i = L.findIndex((x) => /순자산$/.test(x));
  console.log(tag, L.slice(i, i + 16).join(" ¦ "));
  await p.screenshot({ path: `${OUT}/i4-r2b-${tag}-demo-390-home-cause-dark.png` }); await ctx.close();
}
await b.close();
