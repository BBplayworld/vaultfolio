// 허브 셋째 카드 실측 — node dev-r3-hub.mjs <출력 폴더> <URL> <태그>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV, TAG] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
for (const W of [390, 320]) {
  const ctx = await b.newContext({ ...ctxOpt(W, "dark"), deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1`, { waitUntil: "load", timeout: 90000 }).catch(() => {});
  await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(5000);
  const card = p.locator('[data-testid="hub-card-report"]');
  const sec = p.locator('[data-testid="hub-report-secondary"]');
  const info = await card.evaluate((e) => ({ h: Math.round(e.getBoundingClientRect().height), text: e.innerText.replace(/\s+/g, " ") }));
  const s = await sec.evaluate((e) => ({ kind: e.dataset.kind, profit: e.dataset.profit, over: e.scrollWidth > e.clientWidth, color: getComputedStyle(e.querySelector("span") ?? e).color })).catch(() => null);
  console.log(`== ${TAG} ${W}`, JSON.stringify(info), JSON.stringify(s));
  await card.screenshot({ path: `${OUT}/r3-hub-${TAG}-${W}-dark.png` });
  await ctx.close();
}
await b.close();
