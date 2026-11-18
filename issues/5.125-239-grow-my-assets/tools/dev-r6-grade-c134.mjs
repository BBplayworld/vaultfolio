// C134(6차 ui-review ④) — 등급 기록 시드가 닿는 화면(홈 미니 트로피·허브 셋째 카드·성적표 Hero 변화 줄)을 직전 배포와 같은 시각에 대조
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, ...URLS] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
const clean = (t) => t.replace(/\s+/g, " ").trim();
for (const [i, PV] of URLS.entries()) for (const q of ["demo", "trial"]) {
  const ctx = await b.newContext(ctxOpt(390)); const p = await ctx.newPage();
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(16000);
  const tag = `${["prev", "seed"][i]}-${q}`;
  const out = {};
  out.home = clean(await p.locator("main").innerText()).slice(0, 120);
  await p.screenshot({ path: `${OUT}/r6-grade-${tag}-home.png` });
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
  out.hub = clean(await p.locator('[data-testid="hub-card-report"]').innerText().catch(() => "-"));
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(7000);
  await p.locator('[data-testid="report-tab-grade"]').click().catch(() => {}); await p.waitForTimeout(1500);
  out.hero = clean(await p.locator('[data-testid="report-panel-grade"]').innerText().catch(() => "-")).slice(0, 160);
  console.log(`== ${tag}`); for (const [k, v] of Object.entries(out)) console.log(`   ${k}: ${v}`);
  await ctx.close();
}
await b.close();
