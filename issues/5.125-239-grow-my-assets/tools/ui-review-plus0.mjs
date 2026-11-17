// Plus 제거 증분(a2fb703) 재검수 — 허브 카드 제목·불리기 제목 줄 정렬, InfoHint 열림
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const PV = "https://secretasset-git-issue-5125-bbplayworlds-projects.vercel.app"; const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const load = async (W) => { const ctx = await b.newContext(ctxOpt(W, "dark")); const p = await ctx.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message));
  await p.goto(`${PV}/?demo=1&t=${Date.now()}`, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(7000); return { ctx, p }; };
for (let i = 0; i < 16; i++) { const { ctx, p } = await load(390); await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4000);
  const ok = await p.locator('[data-testid="grow-hint"]').count(); console.log(new Date().toISOString(), "grow-hint:", ok); await ctx.close(); if (ok) break; await new Promise((r) => setTimeout(r, 25000)); }
for (const W of [320, 390, 1280]) {
  const { ctx, p } = await load(W);
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(3500);
  console.log(`HUB ${W}`, JSON.stringify(await p.evaluate(() => { const q = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top * 10) / 10, w: Math.round(r.width), h: Math.round(r.height * 10) / 10 }; };
    const plus = [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Plus" && s.children.length === 0).length;
    return { plus, cards: ["hub-card-change", "hub-card-dividend", "hub-card-report"].map((id) => { const c = document.querySelector(`[data-testid="${id}"]`); const h3 = c.querySelector("h3"), ic = c.querySelector("svg"), ch = h3.parentElement.querySelector("svg"), desc = c.querySelector("p"); return { id, h3: q(h3), h3Text: h3.innerText, icon: q(ic), chevron: q(ch), descY: q(desc).y, cardH: q(c.firstElementChild).h }; }) }; })));
  await p.locator('[data-testid="hub-card-report"]').screenshot({ path: `${OUT}/plus0-hub-card-${W}-dark.png` }); await p.screenshot({ path: `${OUT}/plus0-hub-${W}-dark.png`, fullPage: true });
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(4500);
  console.log(`TITLE ${W}`, JSON.stringify(await p.evaluate(() => { const q = (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left * 10) / 10, y: Math.round(r.top * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10, cy: Math.round((r.top + r.height / 2) * 10) / 10 }; };
    const t = document.querySelector('[data-testid="grow-title"]'), row = t.parentElement, ic = row.querySelector("svg"), hb = document.querySelector('[data-testid="grow-hint"] button'), hs = hb.querySelector("svg");
    const sec = document.querySelector('[data-testid="report-section-title"]'), srow = sec.closest("div"), sic = srow.querySelector("svg"), shb = srow.querySelector('button[aria-label="설명 보기"]');
    const g = (a, b2) => Math.round((b2.getBoundingClientRect().left - a.getBoundingClientRect().right) * 10) / 10;
    return { plus: [...document.querySelectorAll("span")].filter((s) => s.textContent.trim() === "Plus" && s.children.length === 0).length, row: q(row), icon: q(ic), title: q(t), hint: q(hs), gapIconTitle: g(ic, t), gapTitleHint: g(t, hs), secIcon: q(sic), secTitle: q(sec), secGapIconTitle: g(sic, sec), secGapTitleHint: shb ? g(sec, shb.querySelector("svg")) : null, coarse: matchMedia("(pointer: coarse)").matches,
      hit: (() => { const r = hb.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2; const at = (dx, dy) => { const e = document.elementFromPoint(cx + dx, cy + dy); return !!e && (e === hb || hb.contains(e)); }; let u = 0, d = 0, l = 0, rr = 0; while (u < 40 && at(0, -(u + 1))) u++; while (d < 40 && at(0, d + 1)) d++; while (l < 40 && at(-(l + 1), 0)) l++; while (rr < 40 && at(rr + 1, 0)) rr++; return [l + rr + 1, u + d + 1]; })() }; })));
  await p.screenshot({ path: `${OUT}/plus0-title-${W}-dark.png` });
  await p.locator('[data-testid="grow-hint"] button').click(); await p.waitForTimeout(800);
  console.log(`HINT ${W}`, JSON.stringify(await p.evaluate(() => { const pop = [...document.querySelectorAll('[data-slot="popover-content"]')].pop(); if (!pop) return null;
    return { box: (() => { const r = pop.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)]; })(), vw: innerWidth, ps: [...pop.querySelectorAll("p")].map((el) => { const full = el.textContent; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const nodes = []; let n, pos = 0; while ((n = w.nextNode())) nodes.push(n); const map = nodes.map((t) => { const s = pos; pos += t.textContent.length; return { t, s, e: pos }; }); const at = (i) => { const m = map.find((x) => i >= x.s && i <= x.e); return [m.t, i - m.s]; }; const split = [];
      for (const m of full.matchAll(/\S+/g)) { const rg = document.createRange(); rg.setStart(...at(m.index)); rg.setEnd(...at(m.index + m[0].length)); if (new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top))).size > 1) split.push(m[0]); }
      const lines = new Set(); const rg = document.createRange(); rg.selectNodeContents(el); [...rg.getClientRects()].forEach((x) => lines.add(Math.round(x.top))); return { text: full, cls: el.className, split, lines: lines.size }; }) }; })));
  await p.screenshot({ path: `${OUT}/plus0-hint-open-${W}-dark.png` });
  console.log(`ERR ${W}`, JSON.stringify(p.errs)); await ctx.close();
}
await b.close();
