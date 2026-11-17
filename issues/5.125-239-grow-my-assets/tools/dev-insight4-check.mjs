// 인사이트 4종 developer 1회 확인 — node dev-insight4-check.mjs <출력 폴더> <preview URL> <태그(before|after)>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV, TAG] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
const log = (...a) => console.log(...a);
for (const W of [390, 320]) {
  const ctx = await b.newContext(ctxOpt(W, "dark"));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?demo=1`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => log("goto", e.message));
  await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; });
  // 배당·ytd 조회가 끝날 때까지(스켈레톤이 없어질 때까지) 최대 40초
  for (let i = 0; i < 20; i++) {
    await p.waitForTimeout(2000);
    if (await p.locator('[data-testid="grow-block"]').count() && !(await p.locator('[data-testid="grow-link-skeleton"]').count())) break;
  }
  await p.waitForTimeout(1500);
  log(`== ${TAG} ${W} dark`);
  log("links:", JSON.stringify(await p.locator('[data-testid="grow-link"] li').evaluateAll((els) => els.map((e) => ({ id: e.dataset.testid, state: e.dataset.state, pct: e.dataset.pct, ex: e.dataset.excluded, text: e.innerText.replace(/\s+/g, " "), h: Math.round(e.getBoundingClientRect().height) })))));
  const rows = await p.locator('[data-testid="grow-row"]').evaluateAll((els) => els.filter((e) => !e.closest("[inert]")).map((e) => {
    const t = (id) => e.querySelector(`[data-testid="${id}"]`);
    const price = t("grow-row-price"); const val = price?.querySelector("span");
    const btn = t("grow-row-open");
    return {
      t: e.dataset.ticker, l: e.dataset.label, h: Math.round(e.getBoundingClientRect().height),
      label: t("grow-row-label-fact")?.innerText.replace(/\n/g, " / "),
      since: t("grow-row-since")?.innerText.replace(/\n/g, " / ") ?? null,
      priceColor: val ? getComputedStyle(val).color : null,
      trades: t("grow-row-trades")?.innerText ?? null,
      overflow: btn ? btn.scrollWidth > btn.clientWidth : null,
    };
  }));
  for (const r of rows) log(" row", JSON.stringify(r));
  log("fg color:", await p.evaluate(() => getComputedStyle(document.body).color));
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight4-${TAG}-block-${W}-dark.png` });
  if (W === 390) {
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: `${OUT}/insight4-${TAG}-first-${W}-dark.png` });
    const hint = p.locator('[data-testid="grow-block-hint"] button');
    if (await hint.count()) {
      await hint.first().click(); await p.waitForTimeout(700);
      const pop = p.locator("[data-radix-popper-content-wrapper]").first();
      log("block hint:", (await pop.innerText()).replace(/\n+/g, " / "));
      await p.screenshot({ path: `${OUT}/insight4-${TAG}-hint-${W}-dark.png` });
      await p.keyboard.press("Escape");
    }
  }
  log("pageerrors:", errs.length, errs.slice(0, 2).join(" // "));
  await ctx.close();
}
await b.close();
