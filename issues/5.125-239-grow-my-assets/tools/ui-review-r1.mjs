// R-1 재검수 — InfoHint 2개를 열어 문단 class와 어절 끊김을 잰다
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
for (const [W, scheme] of [[320, "dark"], [390, "dark"], [390, "light"]]) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: new URL(PV).hostname, path: "/" }]);
  const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(`${PV}/?trial=1`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000);
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500);
  const btns = [["plus", p.locator('[data-testid="grow-plus-hint"] button')], ["section", p.locator('[data-testid="report-section-title"]').locator("xpath=ancestor::div[1]").locator('button[aria-label="설명 보기"]')]];
  for (const [nm, btn] of btns) {
    await btn.first().scrollIntoViewIfNeeded().catch(() => {}); await btn.first().click({ timeout: 5000 }).catch((e) => console.log("click", e.message)); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!pop) return null;
      const out = [...pop.querySelectorAll("p")].map((el) => { const split = []; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; const full = el.textContent;
        // 어절(공백 구분)마다 줄 수를 잰다 — 문단 전체 텍스트 기준 오프셋으로 Range를 만든다
        const nodes = []; while ((n = w.nextNode())) nodes.push(n); let pos = 0; const map = nodes.map((t) => { const s = pos; pos += t.textContent.length; return { t, s, e: pos }; });
        const at = (i) => { const m = map.find((x) => i >= x.s && i <= x.e); return [m.t, i - m.s]; };
        for (const m of full.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(...at(m.index)); rg.setEnd(...at(m.index + m[0].length)); const tops = new Set([...rg.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))); if (tops.size > 1) split.push(m[0]); }
        return { cls: el.className, wb: getComputedStyle(el).wordBreak, split, text: full.slice(0, 30) }; });
      return { w: Math.round(pop.getBoundingClientRect().width), ps: out }; });
    console.log(`HINT ${nm} ${W} ${scheme}`, JSON.stringify(r));
    await p.screenshot({ path: `${OUT}/r1-hint-${nm}-${W}-${scheme}.png` }); await p.keyboard.press("Escape"); await p.mouse.click(5, 5).catch(() => {}); await p.waitForTimeout(400);
  }
  console.log("ERR", W, JSON.stringify(errs)); await ctx.close();
}
await b.close();
