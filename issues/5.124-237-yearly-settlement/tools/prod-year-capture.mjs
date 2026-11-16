import { chromium, PROD, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const jobs = [[360,"dark"],[390,"dark"],[430,"dark"],[1280,"dark"],[390,"light"]];
for (const [W, scheme] of jobs) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  const p = await ctx.newPage();
  await p.goto(PROD + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(4000);
  const st = await p.evaluate(() => {
    const g = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const d = g("secretasset_daily_snapshots") || [], m = g("secretasset_monthly_snapshots") || [], a = g("secretasset_asset_data") || {};
    return { daily: d.length, lastDaily: d.at(-1), monthly: m.map((x) => [x.month, x.date, x.netAsset, !!(x.breakdown && x.fx && x.fxBase && x.cost)]), yearly: a.yearlyNetAssets, cash: (a.cash || []).length, loans: (a.loans || []).length, cashTx: (a.cashTransactions || []).length };
  });
  if (W === 360) console.log("STORE", JSON.stringify(st));
  const net = Math.round(st.lastDaily?.netAsset ?? 540000000);
  await p.evaluate(() => { location.hash = "#activity/change"; });
  await p.waitForTimeout(3000);
  await p.locator('[data-testid="change-period-year"]').first().click(); await p.waitForTimeout(2500);
  p.on("dialog", (d) => d.accept()); await p.locator('button[aria-label="순자산 삭제"]').first().click(); await p.waitForTimeout(800);
  const ad = p.getByRole("alertdialog");
  if (await ad.count()) await ad.getByRole("button", { name: /삭제/ }).click();
  await p.waitForTimeout(1500);
  const add = async (y, v) => {
    await p.locator('[data-testid="yearly-add-link"]').first().click(); await p.waitForTimeout(1000);
    const dlg = p.getByRole("dialog").filter({ hasText: "년도별 순자산 추가" });
    const inputs = dlg.locator("input");
    await inputs.nth(0).fill(String(y)); await inputs.nth(1).fill(String(v)); await p.waitForTimeout(300);
    await dlg.getByRole("button", { name: "추가", exact: true }).click(); await p.waitForTimeout(2000);
  };
  await add(2026, net); await add(2025, 505840000);
  await p.waitForTimeout(6000);
  await p.evaluate(() => document.querySelectorAll("[data-sonner-toaster]").forEach((e) => e.remove()));
  const tag = `prod-year-${W}-${scheme}`;
  await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  const m = await p.evaluate(() => {
    const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { y: Math.round(q.top + scrollY), h: Math.round(q.height), w: Math.round(q.width), x: Math.round(q.left) }; };
    const hero = document.querySelector('[data-testid="change-hero"]');
    const cb = document.querySelector('[data-testid="cause-block"]');
    const rows = cb ? [...cb.querySelectorAll('[data-testid^="cause-row-"]')].map((e) => ({ k: e.dataset.testid, v: e.dataset.value, t: e.innerText.replace(/\n/g, " | "), ...r(e) })) : [];
    return { vh: innerHeight, docH: document.documentElement.scrollHeight, hero: r(hero), heroText: hero?.innerText.replace(/\n/g, " | "), cause: r(cb), causeText: cb?.innerText.replace(/\n/g, " | "), rows, hint: r(document.querySelector('[data-testid="cause-unrecorded-hint"]')), next: r(cb?.nextElementSibling), toast: document.querySelector("[data-sonner-toast]")?.innerText };
  });
  console.log(JSON.stringify(m));
  if (W === 390 && scheme === "dark") {
    const cb = p.locator('[data-testid="cause-block"]');
    if (await cb.count()) await cb.screenshot({ path: `${OUT}/prod-year-390-dark-block.png` });
    const hint = cb.locator('button[aria-label="설명 보기"]').first();
    if (await hint.count()) { await hint.tap().catch(() => hint.click()); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/prod-year-390-dark-hint-open.png` }); }
  }
  await ctx.close();
}
await b.close();
