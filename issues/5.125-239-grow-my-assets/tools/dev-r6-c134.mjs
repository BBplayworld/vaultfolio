// C134(6차) — edafc3e 배포와 같은 시각 대조, 성적표 구획 렌더 텍스트 포함. 원래 설명: C134(5차) — 데모 시드(TIGER 정한 날·base, reviews·plan) 변경이 닿지 않는 화면이 cb36907 배포와 원 단위로 같은지, 같은 시각에 대조. node dev-r5-c134.mjs <출력 폴더> <URL1> <URL2>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, ...URLS] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
const clean = (t) => t.replace(/\s+/g, " ").trim();
for (const [i, PV] of URLS.entries()) {
  const ctx = await b.newContext(ctxOpt(390, "dark"));
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(18000);
  const tag = ["base", "r6"][i] ?? `u${i}`;
  const out = {};
  out.home = clean(await p.locator("main").innerText()).slice(0, 260);
  out.homeCause = await p.locator('[data-testid="home-cause-line"]').first().innerText().catch(() => "-");
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(5000);
  out.hubDividend = clean(await p.locator('[data-testid="hub-card-dividend"]').innerText().catch(() => "-"));
  out.hubChange = clean(await p.locator('[data-testid="hub-card-change"]').innerText().catch(() => "-"));
  out.hubReport = clean(await p.locator('[data-testid="hub-card-report"]').innerText().catch(() => "-"));
  await p.evaluate(() => { location.hash = "#activity/dividend"; }); await p.waitForTimeout(6000);
  out.dividendTab = clean(await p.locator("main").innerText()).slice(0, 400);
  await p.evaluate(() => { location.hash = "#activity/netasset"; }); await p.waitForTimeout(6000);
  out.year = (await p.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, " ")))).join(" | ");
  const chip = p.getByRole("radio", { name: "월" }).or(p.getByRole("button", { name: "월", exact: true }));
  await chip.first().click().catch(() => {}); await p.waitForTimeout(4000);
  out.month = (await p.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, " ")))).join(" | ");
  await p.evaluate(() => { location.hash = "#detail/stocks"; }); await p.waitForTimeout(5000);
  const st = clean(await p.locator("main").innerText());
  out.stocks = st.slice(0, 600);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(6000);
  out.growTotal = clean(await p.locator('[data-testid="grow-total"]').innerText().catch(() => "-"));
  out.growRows = (await p.locator('[data-testid="grow-row"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ")))).join(" | ");
  await p.locator('[data-testid="report-tab-grade"]').click().catch(() => {}); await p.waitForTimeout(1500);
  out.segment = clean(await p.locator('[data-testid="report-tabs"]').innerText().catch(() => "-"));
  out.gradeFull = await p.evaluate(() => {
    const t = document.querySelector('[data-testid="report-section-title"]');
    let el = t?.closest(".pt-1");
    const parts = [];
    while (el) { parts.push(el.innerText); el = el.nextElementSibling; }
    return parts.join("\n").replace(/\s+/g, " ").trim();
  });
  await p.screenshot({ path: `${OUT}/r6-c134-${tag}-report-390-dark.png`, fullPage: true });
  console.log(`   gradeFull-length: ${out.gradeFull.length}`);
  console.log(`== ${tag} ${PV}`);
  for (const [k, v] of Object.entries(out)) console.log(`   ${k}: ${v}`);
  await ctx.close();
}
await b.close();
