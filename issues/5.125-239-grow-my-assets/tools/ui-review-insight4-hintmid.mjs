// 390×600에서 블록 도움말 ⓘ가 화면 가운데(y≈300)일 때 열어 넘침·스크롤 회복을 잰다. 코드 수정 0
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy }); const o = ctxOpt(390, "dark"); o.viewport.height = 600; const ctx = await b.newContext(o); const p = await ctx.newPage();
await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(8000);
const btn = p.locator('[data-testid="grow-block-hint"] button');
const m = () => p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); const t = document.querySelector('[data-testid="grow-block-hint"] button').getBoundingClientRect(); if (!pop) return { trig: Math.round(t.top), pop: null }; const r = pop.getBoundingClientRect(); return { trig: Math.round(t.top), top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, side: pop.dataset.side }; });
for (const target of [140, 300, 450]) {
  await p.evaluate((target) => { const t = document.querySelector('[data-testid="grow-block-hint"] button'); let e = t.parentElement; while (e && !(/(auto|scroll)/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight)) e = e.parentElement; (e || document.scrollingElement).scrollTop += t.getBoundingClientRect().top - target; }, target); await p.waitForTimeout(400);
  await btn.click({ force: true }); await p.waitForTimeout(700); const a = await m(); console.log(`MID trig@${target}`, JSON.stringify(a));
  await p.screenshot({ path: `${OUT}/i4-hint-390x600-trig${target}-dark.png` });
  await p.mouse.wheel(0, 150); await p.waitForTimeout(500); console.log(`  after wheel +150`, JSON.stringify(await m()));
  await p.keyboard.press("Escape"); await p.waitForTimeout(400);
}
await b.close();
