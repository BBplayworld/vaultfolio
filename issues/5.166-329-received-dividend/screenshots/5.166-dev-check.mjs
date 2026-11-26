import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
const globalRoot = process.env.NODE_PATH || execSync("npm root -g", { encoding: "utf8" }).trim();
const { chromium } = createRequire(path.join(globalRoot, "noop.js"))("playwright");
const BASE = "http://localhost:43166";
const SHOTS = path.resolve("shots");
const YEAR = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4);
const browser = await chromium.launch();
const out = [];
const log = (...a) => { console.log(...a); };

async function run(width, theme, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 200)); });
  await page.route("**/api/finance/dividend**", (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ data: [
      { payoutDate: `${YEAR}-02-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-05-15`, amountPerShare: 361, currency: "KRW" },
      { payoutDate: `${YEAR}-12-28`, amountPerShare: 361, currency: "KRW", isEstimated: true },
    ] }),
  }));
  await page.goto(`${BASE}/?trial=1#activity/dividend`);
  await page.waitForSelector('[data-testid="dividend-conclusion"]', { timeout: 30000 });
  await page.waitForTimeout(800);
  const tag = `${width}-${theme}`;
  const measure = async () => page.evaluate(() => {
    const row = document.querySelector('[data-testid="dividend-conclusion"]');
    const chip = document.querySelector('[data-testid="dividend-received"]');
    const frags = [...row.children].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.testid, top: Math.round(r.top), h: Math.round(r.height), text: c.textContent.trim() }; });
    const cr = chip?.getBoundingClientRect();
    // 히트영역: 칩 중앙에서 위·아래로 elementFromPoint가 칩인 구간
    let hit = 0;
    if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y += 1) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; } }
    return { rowH: Math.round(row.getBoundingClientRect().height * 10) / 10, lh: getComputedStyle(row).lineHeight, chipH: cr ? Math.round(cr.height * 10) / 10 : null, chipW: cr ? Math.round(cr.width) : null, hit, state: chip?.dataset.state, chipText: chip?.textContent, next: !!document.querySelector('[data-testid="dividend-conclusion-next"]'), frags, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth,
      chipColor: chip ? getComputedStyle(chip).color : null, chipBg: chip ? getComputedStyle(chip).backgroundColor : null };
  });
  const m0 = await measure();
  log(tag, "결론줄(기록 전)", JSON.stringify(m0));
  await page.locator('[data-testid="dividend-conclusion"]').locator("xpath=..").locator("xpath=..").screenshot({ path: `${SHOTS}/${tag}-1-conclusion-empty.png` });

  // 칩 클릭 → 폼
  await page.click('[data-testid="dividend-received"]');
  await page.waitForSelector('[data-testid="cash-tx-kind-group"]');
  await page.waitForTimeout(400);
  const form = await page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const rect = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width) }; };
    const group = q('[data-testid="cash-tx-kind-group"]');
    const [recBox, divBox] = group.children;
    const dlg = q('[role="dialog"]');
    return {
      dividendChecked: q('[data-testid="cash-tx-dividend-check"]').getAttribute("data-state"),
      recurringDisabled: q('[data-testid="cash-tx-recurring-check"]').disabled,
      recurringState: q('[data-testid="cash-tx-recurring-check"]').getAttribute("data-state"),
      recHelp: q('#cash-tx-recurring-help').textContent,
      rec: rect(recBox), div: rect(divBox), stock: q('[data-testid="cash-tx-dividend-stock"]') ? rect(q('[data-testid="cash-tx-dividend-stock"]')) : null,
      accountSelectShown: [...dlg.querySelectorAll("label")].some((l) => l.textContent === "계좌"),
      depositActive: [...dlg.querySelectorAll("button")].find((b) => b.textContent === "입금")?.className.includes("brand"),
      dlgScrollW: dlg.scrollWidth, dlgClientW: dlg.clientWidth,
      labelHit: rect(q('label[for="cash-tx-dividend"]')),
    };
  });
  log(tag, "폼(배당 켬)", JSON.stringify(form));
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-2-form-on.png` });
  // 배당 끄기 → 정기 다시 가능, 상자 위치 불변
  await page.click('[data-testid="cash-tx-dividend-check"]');
  await page.waitForTimeout(350);
  const off = await page.evaluate(() => {
    const group = document.querySelector('[data-testid="cash-tx-kind-group"]');
    const [recBox, divBox] = group.children;
    const r = (el) => { const b = el.getBoundingClientRect(); return { top: Math.round(b.top), h: Math.round(b.height) }; };
    return { rec: r(recBox), div: r(divBox), recurringDisabled: document.querySelector('[data-testid="cash-tx-recurring-check"]').disabled, recHelp: document.querySelector('#cash-tx-recurring-help').textContent };
  });
  log(tag, "폼(배당 끔)", JSON.stringify(off));
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-3-form-off.png` });
  await page.click('[data-testid="cash-tx-dividend-check"]');
  await page.waitForTimeout(350);

  // 종목 고르기(가장 긴 이름) + 계좌 + 금액
  if (form.accountSelectShown) {
    const dlg = page.locator('[role="dialog"]');
    await dlg.locator('button[role="combobox"]').first().click();
    await page.locator('[role="option"]').first().click();
  }
  await page.click('[data-testid="cash-tx-dividend-stock"]');
  const names = await page.locator('[role="option"]').allTextContents();
  log(tag, "종목 목록", names.slice(0, 6).join(" | "), `(${names.length})`);
  await page.locator('[role="option"]').nth(1).click();
  const amount = page.locator('[role="dialog"] input[inputmode]').first();
  await amount.fill(String(opts.amount ?? 398200));
  await page.waitForTimeout(200);
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-4-form-filled.png` });
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await page.waitForTimeout(900);
  const toast = await page.locator("[data-sonner-toast]").allTextContents();
  const focusBack = await page.evaluate(() => document.activeElement?.getAttribute("data-testid"));
  const m1 = await measure();
  log(tag, "토스트", toast.join("/"), "포커스", focusBack);
  log(tag, "결론줄(기록 후)", JSON.stringify(m1));
  await page.locator('[data-testid="dividend-conclusion"]').locator("xpath=..").locator("xpath=..").screenshot({ path: `${SHOTS}/${tag}-5-conclusion-sum.png` });
  const stored = await page.evaluate(() => ({ tags: localStorage.getItem("secretasset.cash_tx_tags"), last: JSON.parse(localStorage.getItem("secretasset_asset_data")).cashTransactions.slice(-1)[0] }));
  log(tag, "저장", JSON.stringify(stored));

  // 중복 저장 → 요약 줄
  await page.click('[data-testid="dividend-received"]');
  await page.waitForSelector('[data-testid="cash-tx-kind-group"]');
  if (form.accountSelectShown) {
    await page.locator('[role="dialog"] button[role="combobox"]').first().click();
    await page.locator('[role="option"]').first().click();
  }
  await page.locator('[role="dialog"] input[inputmode]').first().fill(String(opts.amount ?? 398200));
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await page.waitForSelector('[data-testid="cash-tx-dup-summary"]');
  const dup = await page.evaluate(() => { const p = document.querySelector('[data-testid="cash-tx-dup-summary"]'); return { text: p.textContent, tops: [...p.children].map((c) => Math.round(c.getBoundingClientRect().top)), parts: [...p.children].map((c) => c.textContent) }; });
  log(tag, "중복 요약", JSON.stringify(dup));
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-6-dup.png` });
  await page.getByRole("button", { name: "새로 추가" }).click();
  await page.waitForTimeout(700);
  const m2 = await measure();
  log(tag, "결론줄(중복 저장 후)", m2.chipText, "tags", await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("secretasset.cash_tx_tags"))).length - 1));

  // 월 선택 칩은 차트 클릭이 필요 — 생략(높이는 코드상 연간 줄이 정함). 거래내역 행으로 이동
  await page.evaluate(() => { location.hash = "#detail/cash"; });
  await page.waitForTimeout(1000);
  const acctName = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem("secretasset_asset_data")); const id = d.cashTransactions.slice(-1)[0].cashId; return d.cash.find((c) => c.id === id).name; });
  await page.locator("main button", { hasText: acctName }).first().click();
  await page.waitForTimeout(500);
  const btn = page.getByRole("button", { name: "입출금 내역" });
  log(tag, "내역 버튼 수", await btn.count());
  await btn.first().click();
  await page.waitForTimeout(900);
  const rowInfo = await page.evaluate(() => {
    const badge = document.querySelector('[data-testid="tx-dividend-badge"]');
    if (!badge) return null;
    const rows = [...document.querySelectorAll('[data-testid="tx-dividend-badge"]')].map((b) => b.closest(".py-2\\.5"));
    const all = [...rows[0].parentElement.children];
    const h = (el) => Math.round(el.getBoundingClientRect().height * 10) / 10;
    const plain = all.find((r) => !r.querySelector('[data-testid="tx-dividend-badge"]') && !r.querySelector('[data-testid="tx-memo"]') && r.textContent.includes("입금"));
    const br = badge.getBoundingClientRect();
    return { badge: { w: Math.round(br.width), h: Math.round(br.height), bg: getComputedStyle(badge).backgroundColor, color: getComputedStyle(badge).color }, dividendRows: rows.map((r) => ({ h: h(r), stock: r.querySelector('[data-testid="tx-dividend-stock"]')?.textContent ?? null })), plainH: plain ? h(plain) : null, scrollW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth };
  });
  log(tag, "거래 행", JSON.stringify(rowInfo));
  await page.screenshot({ path: `${SHOTS}/${tag}-7-tx-rows.png`, fullPage: false });
  log(tag, "콘솔 오류", errors.length, errors.slice(0, 3).join(" || "));
  await ctx.close();
}
const widths = process.argv.slice(2).map(Number);
for (const w of widths.length ? widths : [320, 375, 390]) {
  try { await run(w, "light"); } catch (e) { console.log(w, "ERR", String(e).slice(0, 600)); }
}
await browser.close();
