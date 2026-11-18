// cb36907 점수 ⓘ 390×600 — 팝오버 안을 끝까지 스크롤해 마지막 문장이 보이는지. 코드 수정 0
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy }); const o = ctxOpt(390, "dark"); o.viewport.height = 600; const ctx = await b.newContext(o); const p = await ctx.newPage();
await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(5000);
const t = p.locator('[data-testid="grow-score-hint"] button'); await t.scrollIntoViewIfNeeded(); await t.click(); await p.waitForTimeout(800);
// 터치 스와이프 대신 팝오버 스크롤 위치를 끝으로 옮겨 마지막 문장이 닿는지 본다(마우스 이동은 트리거 pointerleave로 닫힘)
await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); pop.scrollTop = pop.scrollHeight; }); await p.waitForTimeout(400);
console.log(JSON.stringify(await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!pop) return { open: false }; const last = [...pop.querySelectorAll("p")].pop(); const pr = pop.getBoundingClientRect(), lr = last.getBoundingClientRect(); return { open: true, scrollTop: pop.scrollTop, max: pop.scrollHeight - pop.clientHeight, lastBottom: Math.round(lr.bottom), popBottom: Math.round(pr.bottom), lastText: last.textContent.slice(-20) }; })));
await p.screenshot({ path: `${OUT}/r3x4-score-390x600-scrolled.png` }); await b.close();
