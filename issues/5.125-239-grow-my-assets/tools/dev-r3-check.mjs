// 재설계 3차 구현 실측 — node dev-r3-check.mjs <출력 폴더> <URL>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
const reqs = [];
for (const [q, W, scheme] of [["demo", 390, "dark"], ["demo", 320, "dark"], ["demo", 1280, "dark"], ["trial", 390, "dark"], ["trial", 390, "light"]]) {
  const ctx = await b.newContext({ ...ctxOpt(W, scheme), deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "load", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity/report"; });
  await p.waitForTimeout(5000);
  const net = []; p.on("request", (r) => { if (r.url().includes("/api/")) net.push(r.url().replace(/^https?:\/\/[^/]+/, "").slice(0, 60)); });
  const tag = `${q}-${W}-${scheme}`;
  const info = await p.evaluate(() => {
    const t = (s) => document.querySelector(`[data-testid="${s}"]`);
    const total = t("grow-total");
    const groups = [...document.querySelectorAll('[data-testid="grow-group"]')].map((g) => `${g.dataset.key}:${g.dataset.rate}:${g.dataset.profit}`);
    const rows = [...document.querySelectorAll('[data-testid="grow-row"]')].map((r) => `${r.querySelector('[data-testid="grow-row-open"]').innerText.replace(/\s+/g, " ")} ${r.querySelector('[data-testid="grow-row-rate"]').dataset.rate} ${r.querySelector('[data-testid="grow-row-profit"]')?.dataset.profit ?? ""} [${r.dataset.label}]`);
    const over = [...document.querySelectorAll('[data-testid="grow-block"] *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "hidden" && !e.className.toString().includes("truncate")).length;
    const box = (s) => { const e = t(s); return e ? Math.round(e.getBoundingClientRect().bottom + scrollY) : null; };
    return { total: total ? `${total.dataset.profit} ${total.dataset.rate} | ${total.innerText}` : null, div: t("grow-next-dividend")?.innerText, chk: t("grow-next-check")?.innerText, groups, rows, over, bottoms: { card: box("grow-total-card"), axes: box("grow-axes"), list: box("grow-list") } };
  });
  console.log(`== ${tag}`, JSON.stringify(info));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${OUT}/r3-${tag}-first.png` });
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/r3-${tag}-block.png` });
  if (q === "demo" && W === 390) {
    // 묶음 누르기 → 거르기, 핵심 분야·시가총액 탭, 칩 펼침
    await p.locator('[data-testid="grow-group"]').first().click(); await p.waitForTimeout(500);
    console.log("   filter:", await p.locator('[data-testid="grow-filter-chip"]').innerText().catch(() => "-"), "rows", await p.locator('[data-testid="grow-row"]').count());
    await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/r3-${tag}-filter.png` });
    await p.locator('[data-testid="grow-filter-chip"]').click(); await p.waitForTimeout(300);
    for (const ax of ["sector", "cap", "etf"]) {
      await p.locator(`[data-testid="grow-axis-${ax}"]`).click(); await p.waitForTimeout(400);
      console.log(`   ${ax}:`, (await p.locator('[data-testid="grow-group"]').evaluateAll((els) => els.map((g) => `${g.innerText.replace(/\s+/g, " ")}`))).join(" | "));
      if (ax !== "etf") await p.locator('[data-testid="grow-axes"]').screenshot({ path: `${OUT}/r3-${tag}-axis-${ax}.png` });
    }
    await p.locator('[data-testid="grow-chip"]').nth(4).click(); await p.waitForTimeout(500);
    console.log("   panel:", await p.locator('[data-testid="grow-panel-caption"]').nth(4).innerText());
    await p.locator('[data-testid="grow-list"]').screenshot({ path: `${OUT}/r3-${tag}-chip.png` });
    await p.locator('[data-testid="grow-score-hint"] button').click(); await p.waitForTimeout(500);
    console.log("   score hint:", (await p.locator("[data-radix-popper-content-wrapper]").first().innerText()).replace(/\n+/g, " / "));
    await p.screenshot({ path: `${OUT}/r3-${tag}-score-hint.png` });
  }
  console.log(`   api requests after report open: ${net.join(", ") || 0} | pageerrors ${errs.length} ${errs.slice(0, 1).join("")}`);
  await ctx.close();
}
await b.close();
