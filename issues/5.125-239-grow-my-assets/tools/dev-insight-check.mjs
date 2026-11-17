import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const log = (...a) => console.log(...a);
const open = async (W, scheme, q) => {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?${q}=1`, { waitUntil: "networkidle", timeout: 90000 }).catch((e) => log("goto", e.message));
  await p.waitForTimeout(8000);
  return { ctx, p, errs };
};
// 새 배포 대기 — 무게 줄 막대가 나올 때까지
for (let i = 0; i < 14; i++) {
  const { ctx, p } = await open(390, "dark", "demo");
  await p.evaluate(() => { location.hash = "#activity/report"; });
  await p.waitForTimeout(4000);
  const ok = await p.locator('[data-testid="grow-weight-bar"]').count();
  await ctx.close();
  if (ok) { log("배포 확인, 시도", i + 1); break; }
  if (i === 13) { log("새 배포가 보이지 않음"); await b.close(); process.exit(1); }
  await new Promise((r) => setTimeout(r, 30000));
}
for (const [W, scheme, q] of [[390, "dark", "demo"], [320, "dark", "demo"], [1280, "dark", "demo"], [390, "light", "trial"]]) {
  const { ctx, p, errs } = await open(W, scheme, q);
  const tag = `${q}-${W}-${scheme}`;
  await p.evaluate(() => { location.hash = "#activity"; });
  await p.waitForTimeout(2500);
  const card = p.locator('[data-testid="hub-card-report"]');
  log("==", tag, "| hub:", (await card.innerText()).replace(/\s*\n\s*/g, " | "));
  const sec = p.locator('[data-testid="hub-report-secondary"]');
  log("hub secondary:", await sec.getAttribute("data-kind"), await sec.getAttribute("data-pct"));
  await card.screenshot({ path: `${OUT}/hub-${tag}.png` });
  await card.locator("h3").click();
  await p.waitForTimeout(3500);
  const legend = await p.locator('[data-testid^="grow-weight-"]:not([data-testid*="seg"]):not([data-testid$="bar"])').evaluateAll((els) => els.map((e) => `${e.innerText.replace(/\s+/g, " ")} [${e.dataset.pct}] h${Math.round(e.getBoundingClientRect().height)} y${Math.round(e.getBoundingClientRect().top)}`));
  log("legend:", legend.join(" || "));
  const segs = await p.locator('[data-testid^="grow-weight-seg-"]').evaluateAll((els) => els.map((e) => `${Math.round(e.getBoundingClientRect().width)}px ${getComputedStyle(e).backgroundColor}`));
  log("segs:", segs.join(" | "));
  log("caption hidden:", await p.locator('[data-testid="grow-cycle-caption"]').evaluate((e) => e.closest("[aria-hidden]") !== null && e.parentElement.getBoundingClientRect().height === 0));
  const rows = await p.locator('[data-testid="grow-row"]').evaluateAll((els) => els.map((e) => {
    const q = e.querySelector('[data-testid="grow-row-qty"]'); const btn = e.querySelector('[data-testid="grow-row-open"]');
    return { t: e.dataset.ticker, l: e.dataset.label, h: Math.round(e.getBoundingClientRect().height), lf: e.querySelector('[data-testid="grow-row-label-fact"]').innerText.replace(/\n/g, " / "), qty: q ? `${q.dataset.state}:${getComputedStyle(q).color}:${getComputedStyle(q).fontWeight}` : null, overflow: btn.scrollWidth > btn.clientWidth, hidden: !!e.closest("[inert]") };
  }));
  for (const r of rows) log(" row", JSON.stringify(r));
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/block-${tag}.png` });
  if (q === "demo" && W === 390) {
    // 이름표를 바꾸면 무게 줄이 즉시 바뀌고 그 행은 당일 상태(수량 조각 없음), base가 저장된다
    const row = p.locator('[data-testid="grow-row"][data-ticker="000660"]');
    await row.locator('[data-testid="grow-label-keep"]').click();
    await p.waitForTimeout(700);
    log("after label legend:", (await p.locator('[data-testid="grow-weight-keep"]').innerText()).replace(/\s+/g, " "));
    log("row fact:", (await row.locator('[data-testid="grow-row-label-fact"]').innerText()).trim(), "| qty piece:", await row.locator('[data-testid="grow-row-qty"]').count());
    log("stored base:", await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("secretasset.stock_labels")).items["000660"])));
    await row.locator('[data-testid="grow-label-none"]').click();
    await p.waitForTimeout(500);
    log("none stored:", await p.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem("secretasset.stock_labels")).items["000660"])));
  }
  if (W === 320 || (W === 390 && q === "trial")) {
    // C128: 도움말을 연 상태로 캡처하고 끊긴 어절이 없는지 본다
    await p.locator('[data-testid="grow-hint"] button').first().click();
    await p.waitForTimeout(700);
    const pop = p.locator('[data-radix-popper-content-wrapper]').first();
    log("hint:", (await pop.innerText()).replace(/\n+/g, " / "));
    log("hint break-keep:", await pop.locator("p").evaluateAll((els) => els.map((e) => getComputedStyle(e).wordBreak)));
    await p.screenshot({ path: `${OUT}/hint-open-${tag}.png` });
    await p.keyboard.press("Escape");
  }
  log("pageerrors:", errs.length, errs.slice(0, 2).join(" // "));
  await ctx.close();
}
// 이름표 0개 상태(320): 저장소에서 이름표만 비우고 다시 연다
{
  const { ctx, p } = await open(320, "dark", "demo");
  await p.evaluate(() => { localStorage.removeItem("secretasset.stock_labels"); location.hash = "#activity"; });
  await p.reload({ waitUntil: "networkidle" }); await p.waitForTimeout(5000);
  log("== zero | hub:", (await p.locator('[data-testid="hub-card-report"]').innerText()).replace(/\s*\n\s*/g, " | "), "| secondary:", await p.locator('[data-testid="hub-report-secondary"]').count());
  await p.locator('[data-testid="hub-card-report"] h3').click(); await p.waitForTimeout(3500);
  log("summary:", (await p.locator('[data-testid="grow-summary"]').innerText()).replace(/\n/g, " / "), "| bar:", await p.locator('[data-testid="grow-weight-bar"]').count(), "| caption shown:", await p.locator('[data-testid="grow-cycle-caption"]').isVisible());
  await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/block-zero-320-dark.png` });
  await ctx.close();
}
await b.close();
