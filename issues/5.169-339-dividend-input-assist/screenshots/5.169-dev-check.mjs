import { createRequire } from "node:module";
import fs from "node:fs";
const require = createRequire("/opt/node22/lib/node_modules/noop.js");
let pw; try { pw = require("playwright"); } catch { pw = require("playwright-core"); }
const DIR = process.argv[2];
const BASE = "http://localhost:43169";
const SHOTS = `${DIR}/shots`;
const YEAR = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 4);
const store = JSON.parse(fs.readFileSync(`${DIR}/trial-store.json`, "utf8"));
const ad = JSON.parse(store.secretasset_asset_data);
for (const s of ad.stocks) {
  if (s.id === "demo_st_samsung" || s.id === "demo_st_aapl") s.broker = "키움증권";
  if (s.id === "demo_st_hynix") s.broker = "미래에셋증권";
}
ad.cash.push(
  { id: "kw_krw", name: "키움 CMA", type: "cma", balance: 1500000, currency: "KRW", institution: "키움증권" },
  { id: "kw_usd", name: "키움 달러 예수금", type: "cma", balance: 1200, currency: "USD", institution: "키움증권" },
);
store.secretasset_asset_data = JSON.stringify(ad);
const browser = await pw.chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const DIV = {
  "005930": [ // 확정 2(과거) + 추정 1(과거 날짜) + 미래 확정 1
    { payoutDate: `${YEAR}-04-18`, amountPerShare: 361, currency: "KRW" },
    { payoutDate: `${YEAR}-02-10`, amountPerShare: 361, currency: "KRW", isEstimated: false },
    { payoutDate: `${YEAR}-08-15`, amountPerShare: 361, currency: "KRW", isEstimated: true },
    { payoutDate: `${YEAR}-12-28`, amountPerShare: 361, currency: "KRW" },
  ],
  "000660": [{ payoutDate: `${YEAR}-03-15`, amountPerShare: 361, currency: "KRW", isEstimated: true }], // 추정만
  "360750": [{ payoutDate: `${YEAR}-12-28`, amountPerShare: 50, currency: "KRW" }],
  "069500": [{ payoutDate: `${YEAR}-10-31`, amountPerShare: 50, currency: "KRW" }],
};
const R = [];
async function open(width, theme) {
  const ctx = await browser.newContext({ viewport: { width, height: 800 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: "theme_mode", value: theme, url: BASE }]);
  const page = await ctx.newPage();
  const reqs = [];
  await page.route(/googletagmanager|google-analytics/, (r) => r.abort());
  await page.route("**/api/finance/dividend**", (route) => {
    const u = new URL(route.request().url()); reqs.push(u.search);
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: DIV[u.searchParams.get("ticker")] ?? [] }) });
  });
  await page.addInitScript((st) => {
    if (!sessionStorage.getItem("__s")) { for (const [k, v] of Object.entries(st)) localStorage.setItem(k, v); sessionStorage.setItem("__s", "1"); }
    window.__ga = [];
    Object.defineProperty(window, "gtag", { configurable: true, get: () => (...a) => window.__ga.push(a), set: () => {} });
  }, store);
  await page.goto(`${BASE}/`); await page.waitForTimeout(3000);
  return { ctx, page, reqs };
}
const openForm = async (page, detail = {}) => {
  await page.evaluate((d) => window.dispatchEvent(new CustomEvent("trigger-add-cash-tx", { detail: d })), detail);
  await page.waitForSelector('[role="dialog"] [data-testid="cash-tx-kind-group"]'); await page.waitForTimeout(300);
};
const pickStock = async (page, name) => {
  await page.click('[data-testid="cash-tx-dividend-stock"]');
  await page.locator('[role="option"]', { hasText: name }).first().click(); await page.waitForTimeout(400);
};
const M = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const rr = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { t: +b.top.toFixed(1), b: +b.bottom.toFixed(1), h: +b.height.toFixed(1), w: +b.width.toFixed(1), l: +b.left.toFixed(1), r: +b.right.toFixed(1) }; };
  const dateIn = q('[role="dialog"] input[type="date"]'); const item = dateIn.closest('[data-slot="form-item"]');
  const label = item.querySelector("label"); const btn = q('[data-testid="cash-tx-dividend-date-btn"]');
  let hit = 0, hitTop = null, hitBot = null;
  if (btn) { const b = btn.getBoundingClientRect(); const x = b.left + b.width / 2; for (let y = b.top - 30; y < b.bottom + 30; y += 0.5) { const e = document.elementFromPoint(x, y); if (e && (e === btn || btn.contains(e))) { hit += 0.5; hitTop ??= y; hitBot = y; } } }
  const di = dateIn.getBoundingClientRect(); const below = document.elementFromPoint(di.left + di.width / 2, di.top + 1);
  const acct = q('[data-testid="cash-tx-account"]'); const block = q('[data-testid="cash-tx-account-block"]');
  const dlg = q('[role="dialog"]');
  return {
    itemH: rr(item).h, label: rr(label), btn: rr(btn), btnText: btn?.textContent, state: btn?.dataset.state, aria: btn?.getAttribute("aria-label"), ariaDis: btn?.getAttribute("aria-disabled"),
    btnBg: btn && getComputedStyle(btn).backgroundColor, btnColor: btn && getComputedStyle(btn).color, btnClass: btn?.className,
    hit, hitTop, hitBot, dateIn: rr(dateIn), belowIsDate: below === dateIn, dateVal: dateIn.value,
    overlap: btn ? btn.getBoundingClientRect().bottom > di.top : null,
    sameLine: btn ? Math.abs((btn.getBoundingClientRect().top + btn.getBoundingClientRect().height / 2) - (label.getBoundingClientRect().top + label.getBoundingClientRect().height / 2)) < 2 : null,
    autofill: acct?.dataset.autofill ?? null, acctText: acct?.textContent ?? null, blockH: rr(block).h, summary: q('[data-testid="cash-tx-account-summary"]')?.textContent ?? null,
    amountLabel: [...dlg.querySelectorAll("label")].find((l) => l.textContent.startsWith("금액"))?.textContent,
    status: q('[data-testid="cash-tx-dividend-date-status"]')?.textContent, past: !!dlg.textContent.includes("이미 잔액에") , dlgOvf: dlg.scrollWidth - dlg.clientWidth,
    focus: document.activeElement?.dataset?.testid, dlgH: rr(dlg).h,
  };
});
const ga = (page) => page.evaluate(() => window.__ga.filter((a) => a[0] === "event" && a[1] === "feature_use").map((a) => JSON.stringify(a[2])));
for (const [w, t] of [[320, "light"], [320, "dark"], [375, "light"], [375, "dark"], [390, "light"], [390, "dark"], [1280, "light"], [1280, "dark"]]) {
  const tag = `${w}-${t}`; const { ctx, page, reqs } = await open(w, t);
  await openForm(page);
  const m0 = await M(page);
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(350);
  const m0b = await M(page);
  await pickStock(page, "삼성전자");
  const m1 = await M(page);
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-1-ready.png` });
  await page.locator('[data-testid="cash-tx-dividend-date-btn"]').focus();
  await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  const m2 = await M(page);
  await page.locator('[role="dialog"]').screenshot({ path: `${SHOTS}/${tag}-2-applied.png` });
  await page.click('[data-testid="cash-tx-dividend-date-btn"]', { force: true }); await page.waitForTimeout(200);
  const m3 = await M(page); const ga1 = await ga(page);
  // 해외 USD(키움증권, KRW·USD 계좌) — 버튼 0, 금액 0이면 USD 계좌로 교체
  await pickStock(page, "Apple"); const mA = await M(page);
  // 추정만(하이닉스, 미래에셋 현금 없음) — 버튼 0, 규칙 값 → 빈칸
  await pickStock(page, "하이닉스"); const mH = await M(page);
  // 통화 가드: 금액 입력 후 삼성(KRW 후보 → 빈칸(원)과 같은 통화 → 채움) → Apple(USD 후보, 금액>0 → 불변)
  await page.locator('[role="dialog"] input[inputmode]').first().fill("398200"); await page.waitForTimeout(150);
  await pickStock(page, "삼성전자"); const mG1 = await M(page);
  await pickStock(page, "Apple"); const mG2 = await M(page);
  // 사용자 직접 선택 → 불변
  await page.locator('[data-testid="cash-tx-account"]').click(); await page.locator('[role="option"]', { hasText: "생활비" }).click(); await page.waitForTimeout(400);
  const mU0 = await M(page);
  await pickStock(page, "삼성전자"); const mU1 = await M(page);
  await page.keyboard.press("Escape"); await page.waitForTimeout(400);
  // 계좌 고정 진입(현금 탭 칩과 같은 이벤트)
  await openForm(page, { cashId: "demo_cash_bank" });
  await page.click('[data-testid="cash-tx-dividend-check"]'); await page.waitForTimeout(350);
  await pickStock(page, "삼성전자"); const mL = await M(page);
  await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const r = { tag, m0, m0b, m1, m2, m3, ga1, mA: { btn: mA.btn, autofill: mA.autofill, acct: mA.acctText, itemH: mA.itemH, amt: mA.amountLabel }, mH: { btn: mH.btn, autofill: mH.autofill, acct: mH.acctText, blockH: mH.blockH }, mG1: { autofill: mG1.autofill, acct: mG1.acctText, amt: mG1.amountLabel }, mG2: { autofill: mG2.autofill, acct: mG2.acctText, amt: mG2.amountLabel }, mU0: { autofill: mU0.autofill, acct: mU0.acctText }, mU1: { autofill: mU1.autofill, acct: mU1.acctText }, mL: { autofill: mL.autofill, summary: mL.summary, blockH: mL.blockH, btn: !!mL.btn }, reqs: [...new Set(reqs)] };
  R.push(r);
  console.log(JSON.stringify(r));
  await ctx.close();
}
fs.writeFileSync(`${DIR}/result.json`, JSON.stringify(R, null, 1));
await browser.close();
