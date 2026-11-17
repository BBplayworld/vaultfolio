import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const log = (...a) => console.log(...a);
for (const [W, scheme, q] of [[390, "dark", "demo"], [1280, "dark", "demo"], [390, "light", "trial"], [320, "dark", "demo"]]) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  const p = await ctx.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => log("goto", e.message));
  await p.waitForTimeout(8000);
  const tag = `${q}-${W}-${scheme}`;
  log("==", tag, "version:", await p.locator("text=/PREVIEW · v/").first().textContent().catch(() => "없음"));
  await p.evaluate(() => { location.hash = "#activity"; });
  await p.waitForTimeout(2500);
  const card = p.locator('[data-testid="hub-card-report"]');
  log("hub:", (await card.innerText().catch(() => "없음")).replace(/\n/g, " | "));
  await card.screenshot({ path: `${OUT}/hub-${tag}.png` }).catch(() => {});
  await card.locator("h3").click().catch((e) => log("click", e.message));
  await p.waitForTimeout(3500);
  log("hash:", await p.evaluate(() => location.hash));
  log("title:", await p.locator('[data-testid="grow-title"]').innerText().catch(() => "없음"));
  log("summary:", (await p.locator('[data-testid="grow-summary"]').innerText().catch(() => "없음")).replace(/\n/g, " "));
  const rows = await p.locator('[data-testid="grow-row"]').evaluateAll((els) => els.map((e) => ({
    t: e.dataset.ticker, l: e.dataset.label, o: e.dataset.overdue, h: Math.round(e.getBoundingClientRect().height),
    fact: e.querySelector('[data-testid="grow-row-fact"]').innerText.replace(/\n/g, " / "),
    lf: e.querySelector('[data-testid="grow-row-label-fact"]').innerText.replace(/\n/g, " / "),
    factH: Math.round(e.querySelector('[data-testid="grow-row-fact"]').getBoundingClientRect().height),
    trunc: [...e.querySelectorAll('[role=radio]')].some((x) => x.scrollWidth > x.clientWidth),
    hidden: !!e.closest("[inert]"),
  })));
  for (const r of rows) log(" row", JSON.stringify(r));
  log("more:", await p.locator('[data-testid="grow-more"]').innerText().catch(() => "없음"), "| plus:", await p.locator("text=/^Plus$/").count());
  log("section:", await p.locator('[data-testid="report-section-title"]').innerText().catch(() => "없음"));
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/block-${tag}.png` }).catch(() => {});
  await p.screenshot({ path: `${OUT}/page-${tag}.png`, fullPage: true }).catch(() => {});
  if (W === 390 && q === "demo") {
    // 조작: 삼성전자에 점검할 자산 → 오늘 점검했어요 → 새로고침 뒤 유지, 순서 불변
    const row = p.locator('[data-testid="grow-row"][data-ticker="005930"]');
    await row.locator('[data-testid="grow-label-check"]').click();
    await p.waitForTimeout(500);
    log("after label:", await row.getAttribute("data-label"), "|", (await row.locator('[data-testid="grow-row-label-fact"]').innerText()).trim());
    await row.locator('[data-testid="grow-check"]').click();
    await p.waitForTimeout(500);
    log("after check:", await row.locator('[data-testid="grow-check"]').getAttribute("data-state"), "|", (await row.locator('[data-testid="grow-check"]').innerText()).trim(), "|", (await row.locator('[data-testid="grow-row-label-fact"]').innerText()).trim());
    log("order:", (await p.locator('[data-testid="grow-row"]').evaluateAll((e) => e.map((x) => x.dataset.ticker))).join(","));
    log("summary2:", (await p.locator('[data-testid="grow-summary"]').innerText()).replace(/\n/g, " "));
    log("stored:", await p.evaluate(() => localStorage.getItem("secretasset.stock_labels")));
    await p.locator('[data-testid="grow-more"]').click();
    await p.waitForTimeout(600);
    await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/block-expanded-${tag}.png` });
    await row.locator('[data-testid="grow-row-open"]').click();
    await p.waitForTimeout(2500);
    log("stock page hash:", await p.evaluate(() => location.hash));
    await p.goBack(); await p.waitForTimeout(2500);
    log("back hash:", await p.evaluate(() => location.hash), "| expanded:", await p.locator('[data-testid="grow-more"]').getAttribute("aria-expanded").catch(() => "없음"));
    log("order after return:", (await p.locator('[data-testid="grow-row"]').evaluateAll((e) => e.map((x) => x.dataset.ticker))).join(","));
    await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(4000);
    log("after reload label:", await p.locator('[data-testid="grow-row"][data-ticker="005930"]').getAttribute("data-label").catch(() => "없음"));
    // 축 링크
    await p.locator('button[aria-controls="axis-panel-diversification"]').click().catch(() => {});
    await p.waitForTimeout(500);
    log("axis:", (await p.locator("#axis-panel-diversification").innerText().catch(() => "없음")).replace(/\n/g, " | "));
    await p.locator("#axis-panel-diversification").screenshot({ path: `${OUT}/axis-${tag}.png` }).catch(() => {});
  }
  log("pageerrors:", errs.length, errs.slice(0, 2).join(" // "));
  await ctx.close();
}
await b.close();
