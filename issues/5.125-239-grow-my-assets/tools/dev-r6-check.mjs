// 재설계 6차 구현 실측(세그먼트·성적표 칸·패널 내 주식 전체 행 포함) — node dev-r6-check.mjs <출력 폴더> <URL>
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const [OUT, PV] = process.argv.slice(2);
const b = await chromium.launch({ proxy });
const open = async (q, W, scheme) => {
  const ctx = await b.newContext({ ...ctxOpt(W, scheme), deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "load", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(15000);
  await p.evaluate(() => { location.hash = "#activity/report"; });
  await p.waitForTimeout(5000);
  return { ctx, p, errs };
};
const info = (p) => p.evaluate(() => {
  const t = (s) => document.querySelector(`[data-testid="${s}"]`);
  const box = (s) => { const e = t(s); return e ? Math.round(e.getBoundingClientRect().bottom + scrollY) : null; };
  const rows = [...document.querySelectorAll('[data-testid="grow-row"]')].map((r) => `${r.innerText.replace(/\s+/g, " ")} [${r.dataset.label}${r.dataset.due === "true" ? " due" : ""}] @${Math.round(r.getBoundingClientRect().bottom + scrollY)}`);
  const over = [...document.querySelectorAll('[data-testid="grow-block"] *')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "hidden" && !e.className.toString().includes("truncate") && e.tagName !== "SELECT").length;
  const text = document.querySelector('[data-testid="grow-block"]')?.innerText ?? "";
  return { tabs: t("report-tabs")?.innerText.replace(/\s+/g, " "), total: t("grow-total")?.innerText.replace(/\s+/g, " "), summary: t("grow-summary")?.innerText.replace(/\s+/g, " "), guide: t("grow-guide")?.innerText, rows, over, nameTag: text.includes("이름표"), cardBottom: box("grow-total-card") };
});
for (const [q, W, scheme] of [["demo", 390, "dark"], ["demo", 320, "dark"], ["demo", 1280, "dark"], ["trial", 390, "dark"], ["trial", 390, "light"]]) {
  const { ctx, p, errs } = await open(q, W, scheme);
  const tag = `${q}-${W}-${scheme}`;
  console.log(`== ${tag}`, JSON.stringify(await info(p)));
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.screenshot({ path: `${OUT}/r6-${tag}-first.png` });
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/r6-${tag}-block.png` });
  if (q === "demo" && W === 390) {
    // 점검 한 장(Apple) → 조건 폼 열기
    await p.locator('[data-testid="grow-row"][data-ticker="AAPL"] [data-testid="grow-row-toggle"]').click(); await p.waitForTimeout(600);
    console.log("   sheet:", (await p.locator('[data-testid="grow-sheet"]').innerText()).replace(/\s+/g, " "));
    await p.locator('[data-testid="grow-list"]').screenshot({ path: `${OUT}/r6-${tag}-sheet.png` });
    await p.locator('[data-testid="grow-plan-summary"]').click(); await p.waitForTimeout(500);
    await p.locator('[data-testid="grow-sheet"]').screenshot({ path: `${OUT}/r6-${tag}-sheet-plan-open.png` });
    const hide = await p.locator('[data-testid="grow-plan-memo"]').evaluate((e) => !!e.closest("[data-screenshot-hide]"));
    console.log("   memo in screenshot-hide:", hide);
    // 기준 4칸 → 보유 기간 패널 → 묶음 거르기 → 해제
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('[data-testid="grow-axis-hold"]').click(); await p.waitForTimeout(500);
    await p.locator('[data-testid="grow-total-card"]').screenshot({ path: `${OUT}/r6-${tag}-panel.png` });
    console.log("   panel:", (await p.locator('[data-testid="grow-groups"]').innerText()).replace(/\s+/g, " "), "ticks", await p.locator('[data-testid="grow-zero-tick"]').count());
    await p.locator('[data-testid="grow-group"]').first().click(); await p.waitForTimeout(500);
    console.log("   filter:", await p.locator('[data-testid="grow-filter-fact"]').innerText().catch(() => "-"), "rows", await p.locator('[data-testid="grow-row"]').count());
    await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/r6-${tag}-filter.png` });
    await p.locator('[data-testid="grow-axis-hold"]').click(); await p.waitForTimeout(300);
    console.log("   unfilter rows", await p.locator('[data-testid="grow-row"]').count());
    // 성적표 칸
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.locator('[data-testid="report-tab-grade"]').click(); await p.waitForTimeout(800);
    await p.screenshot({ path: `${OUT}/r6-${tag}-grade-tab.png` });
    await p.locator('[data-testid="report-tab-grow"]').click(); await p.waitForTimeout(300);
    // 허브 셋째 카드
    await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
    console.log("   hub:", (await p.locator('[data-testid="hub-card-report"]').innerText()).replace(/\s+/g, " "), "h", await p.locator('[data-testid="hub-card-report"]').evaluate((e) => Math.round(e.getBoundingClientRect().height)), "/ div h", await p.locator('[data-testid="hub-card-dividend"]').evaluate((e) => Math.round(e.getBoundingClientRect().height)));
    await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/r6-hub-390.png` });
  }
  if (q === "demo" && W === 320) {
    await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(4000);
    await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/r6-hub-320.png` });
  }
  if (q === "trial" && scheme === "dark") {
    // 첫 사용자 상태 — 저장소 키를 지우고 다시 연다(체험 메모리 저장소)
    await p.evaluate(() => { localStorage.removeItem("secretasset.stock_labels"); location.hash = "#activity"; }); await p.waitForTimeout(1500);
    await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(3000);
    console.log("   first-user:", JSON.stringify(await info(p)));
    await p.evaluate(() => window.scrollTo(0, 0));
    await p.screenshot({ path: `${OUT}/r6-${tag}-first-user.png` });
  }
  console.log(`   pageerrors ${errs.length} ${errs.slice(0, 1).join("")}`);
  await ctx.close();
}
await b.close();
