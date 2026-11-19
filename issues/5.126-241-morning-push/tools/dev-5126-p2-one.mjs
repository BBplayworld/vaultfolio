import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
for (const W of [320, 390, 1280]) {
  const o = (out[W] = {});
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 }); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  const open = async () => { await p.goto(`${PV}/#activity/report`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500); };
  // ① 코인 BTC(점검 대상 1종목)를 차례로
  o.raw = await p.evaluate(() => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const old = new Date(Date.now() - 200 * 864e5).toISOString(); const it = v.items["c:BTC"]; const before = JSON.stringify(it).slice(0, 200); it.at = old; it.labeledAt = old; localStorage.setItem(k, JSON.stringify(v)); return before; });
  await open();
  await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(1200);
  o.one = await p.evaluate(() => ({ check: [...document.querySelectorAll('[data-testid="grow-summary-check"]')].filter((e) => e.offsetParent).map((e) => e.innerText), due: [...document.querySelectorAll('[data-testid="grow-row"]')].filter((e) => e.offsetParent).map((e) => e.dataset.ticker + ":" + e.dataset.due), docW: document.documentElement.scrollWidth }));
  await p.screenshot({ path: `${OUT}/p2-one-${W}.png` });
  // ② 전부 오늘 점검한 것으로 → 차례 0(정한 것만) — 세그먼트 둘째 줄
  await p.evaluate(() => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const now = new Date().toISOString(); for (const it of Object.values(v.items)) { if (!it.label) continue; it.at = now; delete it.plan; } localStorage.setItem(k, JSON.stringify(v)); });
  await open();
  o.seg = await p.evaluate(() => { const b = document.querySelector('[data-testid="report-tab-grow"]'); const sp = [...b.querySelectorAll("span.whitespace-nowrap")]; const r = b.getBoundingClientRect(); return { kind: b.dataset.kind, text: b.innerText.replace(/\n/g, " / "), h: Math.round(r.height), parts: sp.map((s) => ({ t: s.textContent, w: Math.round(s.getBoundingClientRect().width * 10) / 10, top: Math.round(s.getBoundingClientRect().top), inside: s.getBoundingClientRect().left >= r.left && s.getBoundingClientRect().right <= r.right })), docW: document.documentElement.scrollWidth }; });
  await p.locator('[data-testid="report-tabs"]').screenshot({ path: `${OUT}/p2-seg-${W}.png` });
  await p.goto(`${PV}/#activity`, { waitUntil: "networkidle" }).catch(() => {}); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForTimeout(4000);
  o.hub = await p.evaluate(() => { const c = document.querySelector('[data-testid="hub-card-report"]'); const s = c?.querySelector('[data-testid="hub-report-secondary"]'); const cr = c?.getBoundingClientRect(); const sr = s?.getBoundingClientRect(); return s ? { text: s.innerText, h: Math.round(sr.height), inside: sr.right <= cr.right + 0.5 } : null; });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await br.close();
