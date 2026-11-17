// 데모 원인 분해 전후 실측 — node dev-demo-cause-check.mjs <출력 폴더> <태그> <URL1> [<URL2> …] (같은 시점에 차례로 연다)
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, TAG, ...URLS] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
const rowsOf = (p) => p.locator('[data-testid^="cause-row-"]').evaluateAll((els) => els.filter((e) => e.offsetParent).map((e) => `${e.innerText.replace(/\s+/g, " ")}`));
for (const [i, PV] of URLS.entries()) {
  const ctx = await b.newContext(ctxOpt(390, "dark"));
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1`, { waitUntil: "load", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(20000);
  const name = `${TAG}-${i}`;
  const homeLine = await p.locator('[data-testid="home-cause-line"]').first().innerText().catch(() => "-");
  console.log(`== ${name} ${PV}\n   홈 원인: ${homeLine.replace(/\s+/g, " ")}`);
  await p.screenshot({ path: `${OUT}/insight4-cause-${name}-home-390-dark.png` });
  await p.evaluate(() => { location.hash = "#activity/netasset"; }); await p.waitForTimeout(6000);
  console.log(`   연: ${(await rowsOf(p)).join(" | ")}`);
  await p.screenshot({ path: `${OUT}/insight4-cause-${name}-year-390-dark.png`, fullPage: true });
  const chip = p.getByRole("radio", { name: "월" }).or(p.getByRole("tab", { name: "월" })).or(p.getByRole("button", { name: "월", exact: true }));
  await chip.first().click().catch((e) => console.log("월 칩", e.message.slice(0, 80)));
  await p.waitForTimeout(4000);
  console.log(`   월: ${(await rowsOf(p)).join(" | ")}`);
  await p.screenshot({ path: `${OUT}/insight4-cause-${name}-month-390-dark.png`, fullPage: true });
  await ctx.close();
}
await b.close();
