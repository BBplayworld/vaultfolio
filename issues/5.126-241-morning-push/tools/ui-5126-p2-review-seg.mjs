import { chromium, proxy } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5126-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const br = await chromium.launch({ proxy }); const out = {};
for (const W of (process.env.WS||"320,390,1280").split(",").map(Number)) {
  const o = (out[W] = {});
  const ctx = await br.newContext({ viewport: { width: W, height: W < 700 ? 844 : 900 }, deviceScaleFactor: 2, colorScheme: process.env.SCHEME, isMobile: W < 700, hasTouch: W < 1100 }); await ctx.addCookies([{ name: "theme_mode", value: process.env.SCHEME, url: PV }]); const p = await ctx.newPage();
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(8000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForSelector('[data-testid="grow-row"]', { timeout: 30000 }); await p.waitForTimeout(3500);
  o.steps = [];
  for (const kind of ["stock", "crypto", "real"]) {
    const kb = p.locator(`[data-testid="grow-kind"][data-kind="${kind}"]`); if (await kb.count()) { await kb.click(); await p.waitForTimeout(900); }
    for (let i = 0; i < 6; i++) {
      const row = p.locator('[data-testid="grow-row"][data-due="true"]:visible').first(); if (!(await row.count())) break;
      await row.locator('[data-testid="grow-row-toggle"]').click(); await p.waitForTimeout(600);
      const same = row.locator('[data-testid="grow-choice-same"]'); if (!(await same.count())) { const exp = await row.locator('[data-testid="grow-row-toggle"]').getAttribute("aria-expanded"); if (exp === "false") { await row.locator('[data-testid="grow-row-toggle"]').click(); await p.waitForTimeout(700); } if (!(await same.count())) { o.steps.push(kind + ":no-same:" + (await row.evaluate((e) => [...e.querySelectorAll("[data-testid]")].map((x) => x.dataset.testid).join(",")))); break; } }
      if ((await same.getAttribute("aria-disabled")) === "true") { const ids = await row.evaluate((e) => [...e.querySelectorAll("button[data-testid^='grow-choice']")].map((x) => x.dataset.testid + "|" + x.innerText.replace(/\n/g, " ")).join(",")); const k = row.locator('[data-testid="grow-choice-keep"]'); if (!(await k.count())) { o.steps.push(kind + ":stuck:" + ids); break; } await k.click(); await p.waitForTimeout(900); const ok = p.locator('[role="dialog"] button:has-text("바꾸기"), [role="alertdialog"] button:has-text("바꾸기")'); if (await ok.count()) { await ok.first().click(); await p.waitForTimeout(900); } o.steps.push(kind + ":keep"); continue; }
      await same.click(); await p.waitForTimeout(900); o.steps.push(kind + ":same");
    }
  }
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(500);
  o.seg = await p.evaluate(() => { const b = document.querySelector('[data-testid="report-tab-grow"]'); const sp = [...b.querySelectorAll("span.whitespace-nowrap")]; const r = b.getBoundingClientRect(); return { kind: b.dataset.kind, text: b.innerText.replace(/\n/g, " / "), h: Math.round(r.height), parts: sp.map((s) => { const q = s.getBoundingClientRect(); return { t: s.textContent, w: Math.round(q.width * 10) / 10, top: Math.round(q.top), h: Math.round(q.height), inside: q.left >= r.left && q.right <= r.right }; }), docW: document.documentElement.scrollWidth }; });
  await p.locator('[data-testid="report-tabs"]').screenshot({ path: `${OUT}/pv-${W}-${process.env.SCHEME}-seg.png` });
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(3500);
  o.hub = await p.evaluate(() => { const c = document.querySelector('[data-testid="hub-card-report"]'); const s = c?.querySelector('[data-testid="hub-report-secondary"]'); const cr = c?.getBoundingClientRect(); const sr = s?.getBoundingClientRect(); return s ? { text: s.innerText, h: Math.round(sr.height), inside: sr.right <= cr.right + 0.5 } : null; });
  await ctx.close();
}
console.log(JSON.stringify(out)); await br.close();
