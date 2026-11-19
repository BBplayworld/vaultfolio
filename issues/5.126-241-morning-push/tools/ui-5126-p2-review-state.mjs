// ui-designer p2 검수 — ② 1종목 문구 ⑤ 세그먼트 둘째 줄(데모 저장소 조작, 이 브라우저만)
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
for (const [W, scheme] of [[320, "dark"], [320, "light"], [390, "dark"], [1280, "dark"], [1280, "light"]]) {
  const id = `pv-${W}-${scheme}`; const o = (out[id] = {});
  try {
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: scheme, isMobile: W < 700, hasTouch: W < 1100 });
  await ctx.addCookies([{ name: "theme_mode", value: scheme, url: PV }]); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  const open = async () => { await p.goto(`${PV}/#activity/report`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.reload({ waitUntil: "networkidle" }).catch(() => {}); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500); };
  await p.evaluate(() => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const old = new Date(Date.now() - 200 * 864e5).toISOString(); const it = v.items["c:BTC"]; it.at = old; it.labeledAt = old; localStorage.setItem(k, JSON.stringify(v)); });
  await open(); await p.click('[data-testid="grow-kind"][data-kind="crypto"]'); await p.waitForTimeout(1200);
  o.one = await p.evaluate(() => { const e = [...document.querySelectorAll('[data-testid="grow-summary-check"]')].find((x) => x.offsetParent); const rg = document.createRange(); rg.selectNodeContents(e); return { text: e.innerText, lines: new Set([...rg.getClientRects()].map((r) => Math.round(r.top / 6))).size, docW: document.documentElement.scrollWidth, rows: [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].filter((b) => b.offsetParent).map((b) => { const m = (x) => { const r = x.getBoundingClientRect(); return (r.top + r.bottom) / 2; }; const rate = b.querySelector('[data-testid="grow-row-rate"]'); return b.querySelector("span").textContent.slice(0, 10) + "|" + rate.textContent + "|dy" + Math.round((m(b.querySelector("svg.lucide-chevron-right")) - m(rate)) * 10) / 10; }) }; });
  await p.screenshot({ path: `${OUT}/${id}-one.png` });
  // 부동산·실물(own 행 — 막대 없음)
  const own = p.locator('[data-testid="grow-kind"]').nth(2); await own.click(); await p.waitForTimeout(1200);
  o.own = await p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].filter((b) => b.offsetParent).map((b) => { const m = (x) => { const r = x.getBoundingClientRect(); return (r.top + r.bottom) / 2; }; const rate = b.querySelector('[data-testid="grow-row-rate"]'); const name = b.querySelector("span"); const lh = parseFloat(getComputedStyle(name).lineHeight); const n = name.getBoundingClientRect(); return name.textContent.slice(0, 14) + "|" + (rate.textContent || "(빈)") + "|L" + Math.round(n.height / lh) + "|dyRate" + Math.round((m(b.querySelector("svg.lucide-chevron-right")) - m(rate)) * 10) / 10 + "|H" + Math.round(b.getBoundingClientRect().height); }));
  await p.screenshot({ path: `${OUT}/${id}-own.png` });
  await p.evaluate(() => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k)); const now = new Date().toISOString(); for (const it of Object.values(v.items)) { if (!it.label) continue; it.at = now; delete it.plan; } localStorage.setItem(k, JSON.stringify(v)); });
  await open();
  o.seg = await p.evaluate(() => { const b = document.querySelector('[data-testid="report-tab-grow"]'); const g = document.querySelector('[data-testid="report-tab-grade"]'); const sp = [...b.querySelectorAll("span.whitespace-nowrap")]; const r = b.getBoundingClientRect(); return { text: b.innerText.replace(/\n/g, " / "), h: Math.round(r.height), gradeH: Math.round(g.getBoundingClientRect().height), parts: sp.map((s) => ({ t: s.textContent, top: Math.round(s.getBoundingClientRect().top), inside: s.getBoundingClientRect().left >= r.left && s.getBoundingClientRect().right <= r.right })), docW: document.documentElement.scrollWidth }; });
  await p.locator('[data-testid="report-tabs"]').screenshot({ path: `${OUT}/${id}-seg.png` });
  await ctx.close();
  } catch (e) { o.err = String(e).slice(0, 300); }
}
console.log(JSON.stringify(out)); await br.close();
