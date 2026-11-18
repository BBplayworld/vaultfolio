// 재설계 5차 개선판(5b) — 성과 허브 셋째 카드 목업(사업: '점검 차례 N종목' 유지). preview 데모 허브 카드 글자만 바꿔 찍는다. 코드 수정 0, 데모 값만.
// node mock-redesign5b-hub.mjs <OUT>
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const [W, H] of [[390, 844], [320, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { const c = document.querySelector('[data-testid="hub-card-report"]'); const pr = c.querySelector('[data-testid="hub-report-primary"]'); const se = c.querySelector('[data-testid="hub-report-secondary"]'); const h0 = c.firstElementChild.getBoundingClientRect().height;
    pr.innerHTML = '점검 차례 <span style="color:oklch(0.87 0.065 274)">3종목</span>'; se.innerHTML = (innerWidth < 360 ? '산 날부터 ' : '산 날부터 지금까지 ') + '<span class="font-semibold" style="color:oklch(71.2% 0.194 13.428)">+231만원 (+19.1%)</span>';
    const sr = se.getBoundingClientRect(), cr = se.parentElement.getBoundingClientRect(); return { h0: Math.round(h0), h1: Math.round(c.firstElementChild.getBoundingClientRect().height), secOver: Math.round(sr.right - cr.right), div: Math.round(document.querySelector('[data-testid="hub-card-dividend"]').firstElementChild.getBoundingClientRect().height) }; });
  console.log(`HUB ${W}`, JSON.stringify(r));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/redesign5b-hub-${W}.png` }); await ctx.close();
}
await b.close();
