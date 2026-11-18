// #242 v5.127 — 320 부동산 한 장 줄바꿈 재확인(금액·이유 줄) + 코인 보기. node dev-5127-own320.mjs <OUT>
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5127-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy });
const ctx = await br.newContext({ viewport: { width: 320, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
const p = await ctx.newPage();
await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000);
await p.click('[data-testid="grow-kind"][data-kind="real"]'); await p.waitForTimeout(700);
await p.click('[data-testid="grow-row-toggle"]'); await p.waitForTimeout(700);
const h = (s) => p.evaluate((x) => { const e = document.querySelector(x); return e ? [Math.round(e.getBoundingClientRect().height), e.textContent, getComputedStyle(e).whiteSpace] : null; }, s);
console.log(JSON.stringify({ mine: await h('[data-testid="grow-value-mine"]'), reason: await h('[data-testid="grow-sheet-reason"]'), box: await h('[data-testid="grow-value"]'), built: await p.evaluate(() => document.querySelector('[data-testid="grow-value-mine"]')?.className) }));
await p.screenshot({ path: `${OUT}/d7-07b-own-sheet-320.png`, fullPage: true });
await br.close();
