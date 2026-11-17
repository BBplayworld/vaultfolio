// 시세 없는 종목 상태 시드 확인 — 기존 종목(SK하이닉스)의 현재가를 0으로 두는 방법과 가짜 티커 방법을 둘 다 본다
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const AK = "secretasset_asset_data";
const b = await chromium.launch({ proxy });
for (const kind of ["fake", "zero"]) {
  const ctx = await b.newContext(ctxOpt(390, "dark")); const p = await ctx.newPage();
  await p.route("**/api/finance/**", (r) => (kind === "zero" ? r.abort() : r.continue()));
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(({ AK, kind }) => { const a = JSON.parse(localStorage.getItem(AK)); if (kind === "fake") a.stocks.push({ ...a.stocks[0], id: "seed_noprice", name: "시세없는종목", ticker: "ZZ9999", quantity: 10, averagePrice: 1000, currentPrice: 0 }); else a.stocks.find((s) => s.ticker === "000660").currentPrice = 0; localStorage.setItem(AK, JSON.stringify(a)); }, { AK, kind });
  await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(6000);
  console.log(kind, "stored", await p.evaluate((AK) => JSON.parse(localStorage.getItem(AK)).stocks.map((s) => `${s.ticker}:${s.currentPrice}`).join(","), AK));
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(3000);
  console.log(kind, "hub", await p.evaluate(() => { const s = document.querySelector('[data-testid="hub-report-secondary"]'); return s ? `${s.innerText} | kind=${s.dataset.kind} pct=${s.dataset.pct} w=${Math.round(s.getBoundingClientRect().width)}` : null; }));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/insight-s7-noprice-${kind}-hub-card-390-dark.png` }).catch(() => {});
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500); await p.locator('[data-testid="grow-more"]').click().catch(() => {}); await p.waitForTimeout(600);
  console.log(kind, "block", await p.evaluate(() => { const blk = document.querySelector('[data-testid="grow-block"]'); return JSON.stringify({ bar: !!blk.querySelector('[data-testid="grow-weight-bar"]'), sum: blk.querySelector('[data-testid="grow-summary"]').innerText.replace(/\s+/g, " "), sumH: Math.round(blk.querySelector('[data-testid="grow-summary"]').getBoundingClientRect().height), rows: [...blk.querySelectorAll('[data-testid="grow-row"]')].map((r) => `${r.dataset.ticker}: ${r.querySelector('[data-testid="grow-row-fact"]').innerText.replace(/\n/g, " ")} | ${r.querySelector('[data-testid="grow-row-label-fact"]').innerText.replace(/\n/g, " / ")}`) }); }));
  await p.screenshot({ path: `${OUT}/insight-s7-noprice-${kind}-report-390-dark.png`, fullPage: true }); await ctx.close();
}
await b.close();
