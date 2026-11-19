// developer — #247 약속한 날 재차례(390) + 투입 대비 성과 ⓘ 셋째 문단 줄 갈림 실측(320·390·1280), preview 체험
import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app";
const OUT = "/home/user/vaultfolio/.memory/issues/5.126-241-morning-push/screenshots/247";
const br = await chromium.launch({ proxy }); const out = {};
for (const W of [320, 390, 1280]) {
  const touch = W < 1100;
  const ctx = await br.newContext({ viewport: { width: W, height: touch ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: W < 700, hasTouch: touch });
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e).slice(0, 120)));
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 40000 }); await p.waitForTimeout(3000);
  await p.click('[data-testid="report-tab-grade"]'); await p.waitForTimeout(2500);
  const hb = p.locator('xpath=//*[normalize-space(text())="투입 대비 성과"]/ancestor::*[.//button[@aria-label="설명 보기"]][1]//button[@aria-label="설명 보기"]').first();
  await hb.scrollIntoViewIfNeeded(); if (!touch) await hb.hover(); else await hb.tap(); await p.waitForTimeout(900);
  out[`hint-${W}`] = await p.evaluate(() => { const c = document.querySelector('[data-slot="popover-content"]'); if (!c) return null; const broken = []; const lines = [];
    for (const pEl of c.querySelectorAll("p")) { const rg = document.createRange(); const nodes = []; const w = document.createTreeWalker(pEl, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) nodes.push(n); const chars = []; for (const nd of nodes) for (let i = 0; i < nd.textContent.length; i++) { const ch = nd.textContent[i]; if (ch === " " || ch === "\n") { chars.push({ ch: " " }); continue; } rg.setStart(nd, i); rg.setEnd(nd, i + 1); chars.push({ ch, top: Math.round(rg.getBoundingClientRect().top) }); }
      let word = "", tops = new Set(); const flush = () => { if (word && tops.size > 1) { const a = [...tops]; if (Math.max(...a) - Math.min(...a) > 6) broken.push(word); } word = ""; tops = new Set(); }; for (const x of chars) { if (x.ch === " ") flush(); else { word += x.ch; tops.add(x.top); } } flush();
      let cur = "", top = null; for (const x of chars) { if (x.ch !== " " && top !== null && Math.abs(x.top - top) > 6) { lines.push(cur.trim()); cur = ""; } if (x.ch !== " ") top = x.top; cur += x.ch; } lines.push(cur.trim()); }
    const r = c.getBoundingClientRect(); return { broken, lineHeads: lines.filter((l) => /^[·)]/.test(l)), third: lines.filter((l) => /코인/.test(l)), left: Math.round(r.left), right: Math.round(r.right), vw: innerWidth, docW: document.documentElement.scrollWidth }; });
  await p.screenshot({ path: `${OUT}/hint-${W}-dark.png` });
  out[`errs-${W}`] = errs; await ctx.close();
}
{ // 약속한 날 재차례
  const ctx = await br.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "dark", isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { const R = Date; window.__qaOff = window.__qaOff ?? 0; class D extends R { constructor(...a) { if (a.length === 0) super(R.now() + window.__qaOff); else super(...a); } static now() { return R.now() + window.__qaOff; } } window.Date = D; });
  const p = await ctx.newPage(); const T = "000660"; const sel = `[data-testid="grow-row"][data-ticker="${T}"]`;
  await p.goto(`${PV}/?trial=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  const go = async () => { await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(2500); const hub = await p.evaluate(() => document.body.innerText.match(/점검 차례[^\n]*/g) ?? []); await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3000); if (!(await p.$(`${sel} [data-testid="grow-sheet"]`))) { await p.click(`${sel} [data-testid="grow-row-toggle"]`); await p.waitForTimeout(700); } return hub; };
  const st = () => p.evaluate(([sel, t]) => { const r = document.querySelector(sel); const q = (s) => r?.querySelector(`[data-testid="${s}"]`)?.textContent ?? null; const L = JSON.parse(localStorage.getItem("secretasset.stock_labels") ?? "{}"); return { due: r?.dataset.due, reason: q("grow-sheet-reason"), same: q("grow-choice-same"), next: q("grow-choice-next"), hits: (L.reviews ?? []).filter((x) => x.t === t).map((x) => x.hit ?? "-") }; }, [sel, T]);
  await go(); await p.click(`${sel} [data-testid="grow-choice-same"]`); await p.waitForTimeout(900); out.d0 = await st();
  for (const d of [91, 92]) { await p.evaluate((ms) => { window.__qaOff = ms; }, d * 86400000); out[`d${d}_hub`] = await go(); out[`d${d}`] = await st(); out[`d${d}_date`] = await p.evaluate(() => new Date().toISOString().slice(0, 10)); if (d === 92) { await p.locator(sel).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${OUT}/30-d92-redue-390.png` }); await p.click(`${sel} [data-testid="grow-choice-same"]`); await p.waitForTimeout(900); out.d92_after = await st(); } }
}
console.log(JSON.stringify(out, null, 1)); await br.close();
