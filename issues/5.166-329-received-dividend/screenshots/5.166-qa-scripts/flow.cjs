// 공용 조작 헬퍼
const { BASE, YEAR, mockDividend } = require("./lib.cjs");
const fs = require("fs");
const DUMP = JSON.parse(fs.readFileSync(__dirname + "/../trial-dump.json", "utf8"));
const TAGKEY = "secretasset.cash_tx_tags";
async function newSeeded(browser, { width = 390, height = 844, theme = "light", seed = DUMP, mock = true, extra = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, acceptDownloads: true });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("PAGEERR " + String(e).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); });
  const reqs = [];
  page.on("request", (r) => { const u = r.url(); if (!u.includes("/_next/") && r.method() !== "GET") reqs.push({ m: r.method(), u: u.replace(BASE, ""), body: (r.postData() || "").slice(0, 2000) }); else if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) reqs.push({ m: "GA", u: u.slice(0, 300) }); });
  if (mock) await mockDividend(page);
  await page.goto(BASE + "/robots.txt");
  await page.evaluate(({ seed, extra }) => { for (const [k, v] of Object.entries({ ...seed, ...extra })) localStorage.setItem(k, v); }, { seed, extra });
  return { ctx, page, errs, reqs };
}
async function gotoDividend(page) {
  await page.goto(BASE + "/#activity/dividend");
  await page.waitForSelector('[data-testid="dividend-conclusion"], [data-testid="dividend-received-solo"]', { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(900);
}
const store = (page) => page.evaluate((K) => ({ tags: localStorage.getItem(K), ad: JSON.parse(localStorage.getItem("secretasset_asset_data") || "null") }), TAGKEY);
const themeOf = (page) => page.evaluate(() => ({ cls: document.documentElement.className, bg: getComputedStyle(document.body).backgroundColor }));
async function conclusion(page) {
  return page.evaluate(() => {
    const row = document.querySelector('[data-testid="dividend-conclusion"]');
    const chip = document.querySelector('[data-testid="dividend-received"]');
    const solo = document.querySelector('[data-testid="dividend-received-solo"]');
    const hero = document.querySelector('[data-testid="dividend-hero-label"]')?.parentElement?.parentElement;
    const cr = chip?.getBoundingClientRect();
    let hit = 0;
    if (cr) { const x = cr.left + cr.width / 2; for (let y = cr.top - 30; y < cr.bottom + 30; y += 1) { const el = document.elementFromPoint(x, y); if (el && (el === chip || chip.contains(el))) hit++; } }
    const frags = row ? [...row.children].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.testid, top: Math.round(r.top), left: Math.round(r.left), right: Math.round(r.right), text: c.textContent.trim() }; }) : [];
    return {
      rowText: row?.textContent, rowH: row ? Math.round(row.getBoundingClientRect().height * 10) / 10 : null, paid: row?.dataset.paid, expected: row?.dataset.expected, frags,
      chipText: chip?.textContent, chipState: chip?.dataset.state, chipReceived: chip?.dataset.received, chipAria: chip?.getAttribute("aria-label"), chipH: cr ? Math.round(cr.height * 10) / 10 : null, hit,
      next: document.querySelector('[data-testid="dividend-conclusion-next"]')?.textContent ?? null, solo: !!solo,
      yield: document.querySelector('[data-testid="dividend-yield"]')?.textContent ?? null,
      heroText: hero?.textContent?.slice(0, 80) ?? null, scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
}
async function openChip(page, testId = "dividend-received") {
  await page.click(`[data-testid="${testId}"]`);
  await page.waitForSelector('[data-testid="cash-tx-kind-group"]');
  await page.waitForTimeout(400);
}
async function formState(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const rect = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { top: Math.round(r.top * 10) / 10, h: Math.round(r.height * 10) / 10, w: Math.round(r.width) }; };
    const group = q('[data-testid="cash-tx-kind-group"]');
    const dlg = q('[role="dialog"]');
    if (!group) return { group: false, buttons: [...dlg.querySelectorAll("button")].map((b) => b.textContent).filter(Boolean) };
    const [recBox, divBox] = group.children;
    const btn = (t) => [...dlg.querySelectorAll("button")].find((b) => b.textContent === t);
    return {
      group: true, dividend: q('[data-testid="cash-tx-dividend-check"]').getAttribute("data-state"),
      recDisabled: q('[data-testid="cash-tx-recurring-check"]').disabled, rec: q('[data-testid="cash-tx-recurring-check"]').getAttribute("data-state"),
      recHelp: q('#cash-tx-recurring-help').textContent, recBox: rect(recBox), divBox: rect(divBox),
      stock: rect(q('[data-testid="cash-tx-dividend-stock"]')), stockInert: !!q('[data-testid="cash-tx-dividend-stock"]')?.closest("[inert]"), stockValue: q('[data-testid="cash-tx-dividend-stock"]')?.textContent,
      depositBrand: /brand/.test(btn("입금")?.className || ""), withdrawBrand: /brand/.test(btn("출금")?.className || ""),
      submit: dlg.querySelector('button[type="submit"]')?.textContent, dlgOverflowX: dlg.scrollWidth - dlg.clientWidth,
    };
  });
}
async function pickAccount(page, name) {
  const dlg = page.locator('[role="dialog"]');
  const combo = dlg.locator('button[role="combobox"]').first();
  if ((await combo.getAttribute("data-testid")) === "cash-tx-dividend-stock") return false; // 계좌 고정
  await combo.click();
  await page.locator('[role="option"]', { hasText: name }).first().click();
  await page.waitForTimeout(150);
  return true;
}
async function pickStock(page, nth) {
  await page.click('[data-testid="cash-tx-dividend-stock"]');
  await page.waitForTimeout(200);
  const names = await page.locator('[role="option"]').allTextContents();
  await page.locator('[role="option"]').nth(nth).click();
  await page.waitForTimeout(150);
  return names;
}
async function fill(page, { amount, date, memo }) {
  const dlg = page.locator('[role="dialog"]');
  if (amount !== undefined) await dlg.locator("input[inputmode]").first().fill(String(amount));
  if (date) await dlg.locator('input[type="date"]').fill(date);
  if (memo) await dlg.locator("textarea").fill(memo);
  await page.waitForTimeout(200);
}
async function setReflected(page, want) {
  const cb = page.locator('[role="dialog"] button[role="checkbox"]').last();
  const cur = (await cb.getAttribute("data-state")) === "checked";
  if (cur !== want) await cb.click();
  await page.waitForTimeout(150);
}
async function submit(page) {
  await page.locator('[role="dialog"] button[type="submit"]').click();
  await page.waitForTimeout(900);
  return { toast: await page.locator("[data-sonner-toast]").allTextContents(), focus: await page.evaluate(() => document.activeElement?.getAttribute("data-testid") || document.activeElement?.tagName), dialogOpen: await page.locator('[role="dialog"]').count() };
}
async function clickMonth(page, m) {
  const pos = await page.evaluate((m) => { const g = document.querySelector(".recharts-cartesian-grid").getBoundingClientRect(); return { x: g.left + ((m - 0.5) / 12) * g.width, y: g.top + g.height / 2 }; }, m);
  await page.mouse.click(pos.x, pos.y);
  await page.waitForTimeout(400);
  return page.evaluate(() => { const c = document.querySelector('[data-testid="dividend-received-month"]'); const row = document.querySelector('[data-testid="dividend-conclusion"]'); return { badge: document.querySelector('[data-testid="dividend-month-badge"]')?.textContent ?? null, chip: c?.textContent ?? null, received: c?.dataset.received ?? null, cellH: Math.round(row.parentElement.getBoundingClientRect().height * 10) / 10, annualInert: row.inert, annualOpacity: getComputedStyle(row).opacity, chartTop: Math.round(document.querySelector(".recharts-cartesian-grid").getBoundingClientRect().top * 10) / 10 }; });
}
module.exports = { BASE, YEAR, DUMP, TAGKEY, newSeeded, gotoDividend, store, themeOf, conclusion, openChip, formState, pickAccount, pickStock, fill, setReflected, submit, clickMonth };
