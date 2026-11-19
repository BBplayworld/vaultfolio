// developer — qa 3차 D-5 수정 확인: 체험 390, SK하이닉스 그대로 두기 → 같은 날 메모 입력 → 차례 아님 유지 / ±% 값 수정 → 다시 차례
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.126-241-morning-push/screenshots/247";
const br = await chromium.launch({ proxy }); const out = {};
const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
const writes = []; p.on("request", (r) => { if (r.method() !== "GET") writes.push(r.method() + " " + new URL(r.url()).pathname); });
const T = "000660"; const sel = `[data-testid="grow-row"][data-ticker="${T}"]`;
await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
out.version = await p.evaluate(() => (document.body.innerText.match(/v?5\.\d{3}/) || [null])[0]);
const hubN = async () => { await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500); const h = await p.evaluate(() => document.body.innerText.match(/점검 차례[^\n]*/g) ?? []); await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000); if (!(await p.$(`${sel} [data-testid="grow-sheet"]`))) { await p.click(`${sel} [data-testid="grow-row-toggle"]`); await p.waitForTimeout(700); } return h; };
const st = () => p.evaluate(([sel, t]) => { const r = document.querySelector(sel); const q = (s) => r?.querySelector(`[data-testid="${s}"]`)?.textContent ?? null; const L = JSON.parse(localStorage.getItem("secretasset.stock_labels") ?? "{}"); return { due: r?.dataset.due, rowDue: q("grow-row-due"), reason: q("grow-sheet-reason"), same: q("grow-choice-same"), card: document.querySelector('[data-testid="grow-summary-check"]')?.textContent ?? null, plan: L.items?.[t]?.plan, itemAt: L.items?.[t]?.at, hits: (L.reviews ?? []).filter((x) => x.t === t).map((x) => x.hit ?? "-") }; }, [sel, T]);
out.hub0 = await hubN(); out.before = await st();
await p.click(`${sel} [data-testid="grow-choice-same"]`); await p.waitForTimeout(900); out.afterSame = await st();
if (!(await p.$(`${sel} [data-testid="grow-plan-form"]`))) { await p.click(`${sel} [data-testid="grow-plan-summary"]`); await p.waitForTimeout(600); }
await p.fill(`${sel} [data-testid="grow-plan-memo"]`, "실적 발표 뒤 다시 보기"); await p.locator(`${sel} [data-testid="grow-plan-memo"]`).blur(); await p.waitForTimeout(900);
out.afterMemo = await st(); await p.locator(sel).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/31-d5-after-memo-390.png` });
out.hubAfterMemo = await hubN(); out.afterMemoReenter = await st();
if (!(await p.$(`${sel} [data-testid="grow-plan-form"]`))) { await p.click(`${sel} [data-testid="grow-plan-summary"]`); await p.waitForTimeout(600); }
await p.fill(`${sel} [data-testid="grow-plan-up"]`, "20"); await p.locator(`${sel} [data-testid="grow-plan-up"]`).blur(); await p.waitForTimeout(900);
out.afterPctEdit = await st(); await p.screenshot({ path: `${OUT}/32-d5-after-pct-edit-390.png` });
out.errs = errs; out.writes = [...new Set(writes)];
console.log(JSON.stringify(out, null, 1)); await br.close();
