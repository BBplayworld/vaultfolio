// 최장 수량 시드에서 수량 조각 글자의 실제 오른쪽 끝과 글자 영역 오른쪽 끝 차이(양수 = 잘림)
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2]; const LK = "secretasset.stock_labels", AK = "secretasset_asset_data";
const b = await chromium.launch({ proxy });
for (const W of [320, 336, 337, 360, 1024, 1280]) { const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(6500);
  await p.evaluate(({ LK, AK, old }) => { const a = JSON.parse(localStorage.getItem(AK)); const l = JSON.parse(localStorage.getItem(LK)); l.cycle = { months: 12, at: new Date().toISOString() };
    const set = (t, label, q, base, checked) => { a.stocks.filter((s) => s.ticker === t).forEach((s) => { s.quantity = q; }); l.items[t] = { label, labeledAt: old, ...(checked ? { checkedAt: old } : {}), base: { qty: base }, at: old }; };
    set("AAPL", "check", 12345.6789, 1234.5678, true); set("005930", "keep", 12345.6789, 1234.5678, false); set("360750", "keep", 12345, 1234, false); set("NVDA", "check", 123.456, 12.345, true);
    localStorage.setItem(AK, JSON.stringify(a)); localStorage.setItem(LK, JSON.stringify(l)); }, { LK, AK, old: new Date(Date.now() - 4352 * 86400000).toISOString() });
  await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(5500); await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500); await p.locator('[data-testid="grow-more"]').click().catch(() => {}); await p.waitForTimeout(600);
  console.log(W, JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row"]')].filter((r) => r.querySelector('[data-testid="grow-row-qty"]')).map((r) => { const op = r.querySelector('[data-testid="grow-row-open"]').getBoundingClientRect(); const q = r.querySelector('[data-testid="grow-row-qty"]'); const rg = document.createRange(); rg.selectNodeContents(q); const t = rg.getBoundingClientRect(); return { t: r.dataset.ticker, text: q.innerText, textW: Math.round(t.width * 10) / 10, cont: Math.round(op.width), over: Math.round((t.right - op.right) * 10) / 10 }; }))));
  if (W === 320 || W === 1024) await p.locator('[data-testid="grow-block"]').screenshot({ path: `${OUT}/insight-long-frac-block-${W}-dark.png` });
  await ctx.close(); }
await b.close();
