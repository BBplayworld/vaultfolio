// C130 — 점수 기준 줄 폭·줄 수 실측(320·360·390), 체험 등급 시드 0건 확인
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
for (const [q, W] of [["demo", 320], ["demo", 360], ["demo", 390], ["trial", 390]]) {
  const ctx = await b.newContext({ ...ctxOpt(W), deviceScaleFactor: 2 }); const p = await ctx.newPage();
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(3000);
  const hub = (await p.locator('[data-testid="hub-card-report"]').innerText()).replace(/\s+/g, " ");
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(6000);
  const m = await p.locator('[data-testid="grow-score-caption"]').evaluate((e) => { const r = e.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(e).lineHeight); return { w: Math.round(r.width), sw: e.scrollWidth, cw: e.clientWidth, h: Math.round(r.height), lines: Math.round(r.height / lh) }; });
  const hero = (await p.locator('[data-testid="report-panel-grade"]').innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 60);
  console.log(q, W, JSON.stringify(m), "| hub:", hub, "| hero(hidden):", hero);
  if (q === "demo" && W === 320) await p.locator('[data-testid="grow-list"]').screenshot({ path: `${OUT}/r6-score-caption-320.png` });
  await ctx.close();
}
await b.close();
