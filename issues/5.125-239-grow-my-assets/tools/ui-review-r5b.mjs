// 5b 수정(edafc3e) 재검수 — 조건 폼 미저장 입력: 화면 이탈·접기·한 장 닫기·범위 보정. 코드 수정 0. node ui-review-r5b.mjs <OUT>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy }); const ctx = await b.newContext(ctxOpt(390, "dark")); const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
const log = (k, v) => console.log(k, JSON.stringify(v));
await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
const plan = () => p.evaluate(() => JSON.parse(localStorage.getItem("secretasset.stock_labels")).items.AAPL.plan ?? null);
const report = async () => { await p.evaluate(() => { location.hash = "#activity/report"; }); for (let i = 0; i < 12; i++) { await p.waitForTimeout(1500); if (await p.locator('[data-testid="grow-block"]').count()) break; } await p.waitForTimeout(1500); };
const openForm = async () => { const row = p.locator('[data-testid="grow-row"][data-ticker="AAPL"]'); if ((await row.locator('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded")) !== "true") { await row.locator('[data-testid="grow-row-toggle"]').click(); await p.waitForTimeout(600); } if (await p.locator('[data-testid="grow-plan-summary"]').count()) { await p.locator('[data-testid="grow-plan-summary"]').click(); await p.waitForTimeout(500); } };
await report(); await openForm();
// ① 입력 중(포커스 유지) 화면 이탈
await p.locator('[data-testid="grow-plan-memo"]').fill("이탈 전 입력"); await p.locator('[data-testid="grow-plan-down"]').fill("12"); await p.locator('[data-testid="grow-plan-down"]').focus();
await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(1500); const s1 = await plan(); await report();
log("LEAVE", { saved: s1, summaryAfterBack: await p.locator('[data-testid="grow-row"][data-ticker="AAPL"]').innerText().then((t) => t.replace(/\n+/g, " ")) });
// ② 접기
await openForm(); await p.locator('[data-testid="grow-plan-memo"]').fill("접기 전 입력"); await p.locator('[data-testid="grow-plan-memo"]').focus();
await p.evaluate(() => document.querySelector('[data-testid="grow-plan-form"] > button').click()); await p.waitForTimeout(500);
log("COLLAPSE", { saved: (await plan())?.memo, summary: await p.locator('[data-testid="grow-plan-summary"]').innerText().catch(() => null) });
// ③ 한 장 닫기(행 다시 누름) — 포커스 유지한 채 프로그램 클릭
await p.locator('[data-testid="grow-plan-summary"]').click(); await p.waitForTimeout(400); await p.locator('[data-testid="grow-plan-up"]').fill("40"); await p.locator('[data-testid="grow-plan-up"]').focus();
await p.evaluate(() => document.querySelector('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]').click()); await p.waitForTimeout(800);
log("CLOSE-SHEET", { saved: await plan(), expanded: await p.locator('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]').getAttribute("aria-expanded") });
// ④ 범위 밖 → 끝값(하한 1~90, 상한 1~500), 이탈 경로에서도
await openForm(); await p.locator('[data-testid="grow-plan-down"]').fill("150"); await p.locator('[data-testid="grow-plan-up"]').fill("9999"); await p.locator('[data-testid="grow-plan-up"]').focus();
await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(1500); const s4 = await plan(); await report(); await openForm();
log("CLAMP-LEAVE", { saved: s4, fields: [await p.locator('[data-testid="grow-plan-down"]').inputValue(), await p.locator('[data-testid="grow-plan-up"]').inputValue()] });
await p.locator('[data-testid="grow-plan-down"]').fill("0"); await p.keyboard.press("Enter"); await p.waitForTimeout(400); log("CLAMP-ZERO", { field: await p.locator('[data-testid="grow-plan-down"]').inputValue(), saved: (await plan())?.down });
await p.locator('[data-testid="grow-sheet"]').screenshot({ path: `${OUT}/r5b-form-after-390.png` }); log("ERR", errs); await b.close();
