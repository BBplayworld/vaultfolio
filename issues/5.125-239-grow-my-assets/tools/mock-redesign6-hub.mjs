// 재설계 6차 — 성과 허브 셋째 카드 목업(메뉴 통합: 성적 등급 + 점검 차례). preview 데모 허브 카드 글자만 바꿔 찍는다. 코드 수정 0, 데모 값만.
// node mock-redesign6-hub.mjs <OUT>
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const [W, H] of [[390, 844], [320, 844]]) {
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true }); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
  const r = await p.evaluate(() => { const c = document.querySelector('[data-testid="hub-card-report"]'); const pr = c.querySelector('[data-testid="hub-report-primary"]'); const se = c.querySelector('[data-testid="hub-report-secondary"]'); const h0 = c.firstElementChild.getBoundingClientRect().height;
    const tt = [...c.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent.trim() === "내 자산 불리기"); if (tt) tt.textContent = "자산 성적표·불리기";
    const dd = [...c.querySelectorAll("*")].find((e) => e.childElementCount === 0 && e.textContent.includes("내 기준으로")); if (dd) dd.textContent = "종합 등급과 종목 점검을 한곳에서";
    pr.innerHTML = '<span style="color:oklch(0.82 0.15 85)">골드</span> 3.5점'; se.innerHTML = '점검 차례 <span class="font-semibold" style="color:oklch(0.87 0.065 274)">3종목</span>';
    const sr = se.getBoundingClientRect(), cr = se.parentElement.getBoundingClientRect(); return { h0: Math.round(h0), h1: Math.round(c.firstElementChild.getBoundingClientRect().height), secOver: Math.round(sr.right - cr.right), div: Math.round(document.querySelector('[data-testid="hub-card-dividend"]').firstElementChild.getBoundingClientRect().height) }; });
  console.log(`HUB ${W}`, JSON.stringify(r));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/redesign6-hub-${W}.png` }); await ctx.close();
}
await b.close();
