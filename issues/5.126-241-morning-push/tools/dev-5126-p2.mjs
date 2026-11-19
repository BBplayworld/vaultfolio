import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
for (const W of [320, 390, 1280]) {
  const o = (out[W] = { errors: [] });
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: W < 1100 }); const p = await ctx.newPage();
  p.on("pageerror", (e) => o.errors.push(String(e).slice(0, 120)));
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500);
  const chev = () => p.evaluate(() => [...document.querySelectorAll('[data-testid="grow-row-toggle"]')].filter((b) => b.offsetParent).map((b) => { const r = b.querySelector('[data-testid="grow-row-rate"]').getBoundingClientRect(); const c = b.querySelector("svg.lucide-chevron-right").getBoundingClientRect(); const bb = b.getBoundingClientRect(); return { dy: Math.round(((c.top + c.bottom) / 2 - (r.top + r.bottom) / 2) * 10) / 10, rowH: Math.round(bb.height), chevRight: Math.round(bb.right - c.right) }; }));
  o.chevStock = await chev();
  o.seg0 = await p.evaluate(() => document.querySelector('[data-testid="report-tab-grow"]').innerText.replace(/\n/g, " / "));
  o.check0 = await p.evaluate(() => document.querySelector('[data-testid="grow-summary-check"]')?.innerText);
  await p.screenshot({ path: `${OUT}/p2-rows-${W}.png` });
  // 성적표 칸
  await p.click('[data-testid="report-tab-grade"]'); await p.waitForTimeout(2500);
  o.grade = await p.evaluate(() => { const panel = document.querySelector('[data-testid="report-panel-grade"]'); const h = document.querySelector('[data-testid="report-grade-hint"]'); const hero = h?.parentElement; const hr = h?.getBoundingClientRect(); const er = hero?.getBoundingClientRect(); const btn = h?.querySelector("button"); const hit = btn ? getComputedStyle(btn, "::after") : null; const words = [...document.querySelectorAll("main *, body *")].filter((e) => e.children.length === 0 && e.offsetParent && e.textContent.trim() === "자산 성적표").length; return { sectionTitle: !!document.querySelector('[data-testid="report-section-title"]'), hint: hr ? { fromRight: Math.round(er.right - hr.right), fromTop: Math.round(hr.top - er.top), w: Math.round(hr.width), h: Math.round(hr.height) } : null, words, firstText: panel.innerText.slice(0, 30).replace(/\n+/g, " / "), docW: document.documentElement.scrollWidth }; });
  await p.screenshot({ path: `${OUT}/p2-grade-${W}.png` });
  // 5축 ⓘ 열림
  const hb = p.locator('[data-testid="report-grade-hint"] button'); if (W >= 1100) await hb.hover(); else await hb.tap(); await p.waitForTimeout(700);
  o.gradeHintOpen = await p.evaluate(() => { const c = document.querySelector('[data-slot="popover-content"], [role="dialog"]'); if (!c) return null; const r = c.getBoundingClientRect(); return { text: c.innerText.slice(0, 40), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth }; });
  await p.screenshot({ path: `${OUT}/p2-grade-hint-${W}.png` });
  if (W >= 1100) await p.mouse.move(5, 5); else await p.keyboard.press("Escape"); await p.waitForTimeout(500);
  // 투입 대비 성과 ⓘ
  const b2 = p.locator('[data-testid="report-panel-grade"] button[aria-label="설명 보기"]').nth(1); await b2.scrollIntoViewIfNeeded(); if (W >= 1100) await b2.hover(); else await b2.tap(); await p.waitForTimeout(700);
  o.paren = await p.evaluate(() => [...document.querySelectorAll("span.whitespace-nowrap")].filter((e) => /\((내|빌린) 돈\)/.test(e.textContent) && e.offsetParent).map((e) => ({ t: e.textContent, lines: new Set([...e.querySelectorAll("*"), e].flatMap((x) => [...x.getClientRects()].map((r) => Math.round(r.top / 4)))).size, rects: e.getClientRects().length })));
  await p.screenshot({ path: `${OUT}/p2-paren-${W}.png` });
  if (W >= 1100) await p.mouse.move(5, 5); else await p.keyboard.press("Escape"); await p.waitForTimeout(400);
  // 저장값 조작(이 브라우저의 데모 저장소만): 코인 BTC 점검 대상을 차례로 → 1종목 문구
  o.keys = await p.evaluate(() => { const k = "secretasset.stock_labels"; const v = JSON.parse(localStorage.getItem(k) || "null"); return v ? Object.entries(v.items).map(([a, b]) => `${a}:${b.label}`) : null; });
  await ctx.close();
}
console.log(JSON.stringify(out, null, 1)); await br.close();
