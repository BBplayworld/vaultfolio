const { launch } = require("./lib.cjs");
const F = require("./flow.cjs");
const SH = __dirname + "/../shots/";
const L = (k, v) => console.log(k, typeof v === "string" ? v : JSON.stringify(v));
(async () => {
  const b = await launch();
  const { page, errs, reqs } = await F.newSeeded(b, { width: 390, theme: "light" });
  await F.gotoDividend(page);
  L("theme", await F.themeOf(page));
  const c0 = await F.conclusion(page);
  L("C0", c0);
  const s0 = await F.store(page);
  const cardText0 = await page.evaluate(() => document.querySelector('[data-testid="dividend-conclusion"]').closest('[data-slot="card"]')?.innerText ?? null);
  // 1) 칩 → 폼
  await F.openChip(page);
  L("F1 open", await F.formState(page));
  await page.locator('[role="dialog"]').getByRole("button", { name: "출금", exact: true }).click(); await page.waitForTimeout(250);
  L("F2 withdrawal", await F.formState(page));
  await page.locator('[role="dialog"]').getByRole("button", { name: "입금", exact: true }).click(); await page.waitForTimeout(250);
  L("F3 back-deposit", await F.formState(page));
  await page.click('[data-testid="cash-tx-recurring-check"]'); await page.waitForTimeout(200);
  L("F4 rec on", await F.formState(page));
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(350);
  L("F5 div on after rec", await F.formState(page));
  // 비활성 정기 클릭 시도(라벨)
  await page.locator('label[for="cash-tx-recurring"]').click({ force: true }); await page.waitForTimeout(200);
  L("F6 click disabled rec label", await F.formState(page));
  await F.pickAccount(page, "생활비 통장");
  const names = await F.pickStock(page, 1);
  L("stocks", names);
  await F.fill(page, { amount: 398200 });
  L("R1 submit", await F.submit(page));
  const s1 = await F.store(page);
  const t1 = s1.ad.cashTransactions.slice(-1)[0];
  L("tx1", t1); L("tags1", s1.tags);
  L("balance 생활비", [s0.ad.cash[0].balance, s1.ad.cash[0].balance]);
  L("C1", await F.conclusion(page));
  // 2) 기록만 · 다른 달 · 종목 없음 (기록 있는 칩으로 진입)
  await F.openChip(page);
  L("F7 open from sum chip", await F.formState(page));
  await F.pickAccount(page, "생활비 통장");
  await F.fill(page, { amount: 12345, date: `${F.YEAR}-03-10` });
  L("past-q", await page.locator('[data-testid="past-date-question"]').count());
  await F.setReflected(page, false);
  L("R2 submit", await F.submit(page));
  const s2 = await F.store(page);
  const t2 = s2.ad.cashTransactions.slice(-1)[0];
  L("tx2", t2); L("tags2", s2.tags);
  L("balance 생활비 after record-only", s2.ad.cash[0].balance);
  // 3) 외화(USD) 배당 · 소수
  await F.openChip(page);
  await F.pickAccount(page, "달러 통장");
  await F.fill(page, { amount: 12.34, date: `${F.YEAR}-03-20` });
  await F.setReflected(page, true);
  L("R3 submit", await F.submit(page));
  const s3 = await F.store(page);
  L("tx3", s3.ad.cashTransactions.slice(-1)[0]); L("tags3", s3.tags);
  // 4) 일반 입금(배당 끔) — 레코드 키 비교용
  await F.openChip(page);
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(300);
  await F.pickAccount(page, "생활비 통장");
  await F.fill(page, { amount: 777 });
  L("R4 submit(plain)", await F.submit(page));
  const s4 = await F.store(page);
  const t4 = s4.ad.cashTransactions.slice(-1)[0];
  L("tx4 plain", t4); L("tags4", s4.tags);
  L("keyset", { div: Object.keys(t1).sort().join(","), plain: Object.keys(t4).sort().join(","), rec: Object.keys(t2).sort().join(",") });
  // 5) 중복 → 새로 추가
  await F.openChip(page);
  await F.pickAccount(page, "생활비 통장");
  await F.fill(page, { amount: 398200 });
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await page.waitForSelector('[data-testid="cash-tx-dup-summary"]');
  L("dup", await page.evaluate(() => { const p = document.querySelector('[data-testid="cash-tx-dup-summary"]'); return { text: p.textContent, tops: [...p.children].map((c) => Math.round(c.getBoundingClientRect().top)) }; }));
  await page.locator('[role="dialog"]').screenshot({ path: SH + "qa-390-light-dup.png" });
  await page.getByRole("button", { name: "새로 추가" }).click(); await page.waitForTimeout(800);
  const s5 = await F.store(page);
  L("tags5", s5.tags);
  L("toast5", await page.locator("[data-sonner-toast]").allTextContents());
  const c5 = await F.conclusion(page);
  L("C5", c5);
  await page.screenshot({ path: SH + "qa-390-light-conclusion-sum.png" });
  // 6) 달 칩 12개
  const months = [];
  for (let m = 1; m <= 12; m++) { const r = await F.clickMonth(page, m); months.push({ m, ...r }); if (r.badge) { await page.click('[data-testid="dividend-month-badge"]'); await page.waitForTimeout(250); } }
  L("months", months);
  await F.clickMonth(page, 3); await page.screenshot({ path: SH + "qa-390-light-month3.png" });
  await page.click('[data-testid="dividend-month-badge"]'); await page.waitForTimeout(250);
  // 7) 계산값 불변
  const cardText1 = await page.evaluate(() => document.querySelector('[data-testid="dividend-conclusion"]').closest('[data-slot="card"]')?.innerText ?? null);
  L("cardText diff", { before: cardText0?.replace(/\s+/g, " ").slice(0, 400), after: cardText1?.replace(/\s+/g, " ").slice(0, 400) });
  require("fs").writeFileSync(__dirname + "/../card0.txt", cardText0 || ""); require("fs").writeFileSync(__dirname + "/../card1.txt", cardText1 || "");
  require("fs").writeFileSync(__dirname + "/../state-after-s2.json", JSON.stringify(await page.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; })));
  L("errs", errs); L("reqs", reqs.filter((r) => r.m !== "GA")); L("ga", reqs.filter((r) => r.m === "GA").map((r) => r.u));
  await b.close();
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
