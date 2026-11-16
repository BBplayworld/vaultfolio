// 5.124 ui-review — 가짜 시드 + 시계 고정 + GA·/api 차단. 사용: node ui-review.mjs <seeds> <out> <base> <jobs.json> [prefix]
import { chromium, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
import { readFileSync } from "node:fs";
const [, , SEEDS, OUT, BASE, JOBS, PREFIX = ""] = process.argv;
const seeds = JSON.parse(readFileSync(SEEDS, "utf8"));
const jobs = JSON.parse(JOBS); // [[name, W, scheme, opts]]
const host = new URL(BASE).hostname;
const b = await chromium.launch({ proxy });
for (const [name, W, scheme, opt = {}] of jobs) {
  const s = seeds[name];
  const ctx = await b.newContext({ ...ctxOpt(W, scheme), ...(opt.reduced ? { reducedMotion: "reduce" } : {}) });
  if (opt.noclock) {} else if (opt.flow) await ctx.clock.install({ time: new Date(`${s.clock}T03:00:00Z`) }); else await ctx.clock.setFixedTime(new Date(`${s.clock}T03:00:00Z`));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: host, path: "/" }]);
  await ctx.route("**/*", (route) => {
    const u = route.request().url();
    if (/google-analytics|googletagmanager|\/g\/collect/.test(u)) return route.fulfill({ status: 204, body: "" });
    if (/\/api\/finance/.test(u)) return route.fulfill({ status: 503, headers: { "X-KIS-Unavailable": "1", "content-type": "application/json" }, body: JSON.stringify({ error: "차단" }) });
    if (/\/api\//.test(u)) return route.abort();
    return route.continue();
  });
  await ctx.addInitScript(({ s }) => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.setItem("secretasset_asset_data", JSON.stringify(s.data));
    localStorage.setItem("secretasset_monthly_snapshots", JSON.stringify(s.monthly));
    localStorage.setItem("secretasset_daily_snapshots", JSON.stringify(s.daily));
    localStorage.setItem("secretasset_exchange_rate", JSON.stringify(s.rates));
    localStorage.setItem("secretasset_exchange_last_sync_date", s.clock);
    localStorage.setItem("secretasset_tutorial_status", JSON.stringify({ 1: "skipped", 2: "skipped", 3: "skipped", 4: "skipped", 5: "skipped" }));
  }, { s });
  const p = await ctx.newPage();
  const errs = []; p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(BASE + "/#activity/change", { waitUntil: "domcontentloaded", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForSelector('[data-testid="change-period-year"]', { timeout: 30000 }).catch(() => {});
  await p.locator(`[data-testid="change-period-${opt.period ?? "year"}"]`).first().click({ timeout: 8000 }).catch((e) => console.log(name, "year click", e.message));
  if (opt.wait) await p.waitForTimeout(opt.wait);
  await p.waitForTimeout(2500);
  // 토스트·PREVIEW 배지 숨김(캡처용)
  await p.evaluate(() => {
    document.querySelectorAll("[data-sonner-toaster]").forEach((e) => { e.style.display = "none"; });
    for (const e of document.querySelectorAll("body *")) if (e.children.length === 0 && /^PREVIEW\s*·/.test(e.textContent.trim())) { (e.closest("[class*=fixed]") ?? e).style.display = "none"; }
  });
  const tag = `${PREFIX}${name}-${W}-${scheme}${opt.reduced ? "-reduced" : ""}`;
  const measure = (rootSel) => p.evaluate((rootSel) => {
    const q = (id) => document.querySelector(`[data-testid="${id}"]`);
    const r = (e) => { if (!e) return null; const x = e.getBoundingClientRect(); return { y: Math.round(x.top + scrollY), h: Math.round(x.height * 10) / 10 }; };
    const blk = q("year-settle") ?? document.querySelector('[data-testid="cause-block"]');
    // 글자 단위 줄바꿈 검사 — 어절 중간 끊김, 줄 첫 글자 · , )
    const breaks = (root) => { const bad = []; if (!root) return bad; const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
      while ((n = tw.nextNode())) { const t = n.textContent; if (t.trim().length < 2) continue; const rg = document.createRange(); let prevTop = null;
        for (let i = 0; i < t.length; i++) { if (/\s/.test(t[i])) continue; rg.setStart(n, i); rg.setEnd(n, i + 1); const rc = rg.getClientRects()[0]; if (!rc || rc.width === 0) continue; const top = Math.round(rc.top);
          if (prevTop !== null && top > prevTop + 4) { const before = t[i - 1] ?? ""; if (!/\s/.test(before) && before !== "") bad.push(`어절끊김:"${t.slice(Math.max(0, i - 6), i)}|${t.slice(i, i + 6)}"`); if (/[·,)]/.test(t[i])) bad.push(`줄머리부호:"${t.slice(i, i + 8)}"`); }
          prevTop = top; } }
      return bad; };
    const lines = (e) => { if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top / 4))).size; };
    const amtRight = blk ? [...blk.querySelectorAll('[data-testid^="year-settle-group-"], [data-testid^="cause-row-"], [data-testid="year-settle-period-row"]')].map((e) => { const spans = [...e.querySelectorAll("span")].filter((x) => /^[+\-−]?[\d,]+원$/.test(x.textContent.trim()) && x.children.length === 0); const last = spans.at(-1); return last ? [e.dataset.testid, Math.round(last.getBoundingClientRect().right * 10) / 10, getComputedStyle(last).fontSize] : null; }).filter(Boolean) : [];
    const heroDelta = q("change-hero-delta")?.dataset.value ?? null;
    const values = blk ? [...blk.querySelectorAll("[data-value]")].map((e) => [e.dataset.testid, e.dataset.value]) : [];
    // 히트 영역 — 중심에서 위·아래로 elementFromPoint가 대상(또는 그 자손)인 구간 높이
    const hit = (e) => { const x = e.getBoundingClientRect(); const cx = x.left + Math.min(x.width / 2, 20), cy = x.top + x.height / 2; let up = 0, dn = 0; const on = (yy) => { const t = document.elementFromPoint(cx, yy); return !!t && (t === e || e.contains(t)); };
      while (up < 40 && on(cy - up - 1)) up++; while (dn < 40 && on(cy + dn + 1)) dn++; let l = 0, rr = 0; const onx = (xx) => { const t = document.elementFromPoint(xx, cy); return !!t && (t === e || e.contains(t)); }; const mx = x.left + x.width / 2; while (l < 40 && onx(mx - l - 1)) l++; while (rr < 40 && onx(mx + rr + 1)) rr++; return { h: up + dn + 1, w: l + rr + 1 }; };
    const hits = blk ? [...blk.querySelectorAll("button")].map((e) => [e.dataset.testid ?? e.closest("[data-testid]")?.dataset.testid + ">" + (e.getAttribute("aria-label") ?? ""), hit(e)]) : [];
    const gaps = blk ? [...blk.querySelectorAll('[data-testid^="year-settle-group-"]')].map((e) => { const row = e.querySelector('[data-testid="year-settle-grow-toggle"]') ?? (e.firstElementChild?.tagName === "SPAN" ? e : e.firstElementChild); const a = row.firstElementChild.getBoundingClientRect(), c = row.lastElementChild.getBoundingClientRect(); return Math.round(c.left - a.right); }) : [];
    const fs = (id) => { const e = q(id); return e ? getComputedStyle(e).fontSize : null; };
    return { state: blk?.dataset.state ?? null, split: blk?.dataset.split ?? null, block: r(blk), text: blk?.innerText.replace(/\n+/g, " | ") ?? null, hero: q("change-hero")?.innerText.replace(/\n+/g, " | "), heroDelta,
      dup: values.filter(([k, v]) => v === heroDelta && k !== "year-settle-head-delta").map(([k]) => k), values, amtRight, gaps, hits,
      conclLines: lines(q("year-settle-conclusion")), noteLines: lines(q("year-settle-period-note")), dateLines: lines(q("year-settle-period-date")),
      breaks: breaks(rootSel ? document.querySelector(rootSel) : blk), heroBreaks: breaks(q("change-hero")), period: r(q("year-settle-period-row")), head: r(q("year-settle-head")),
      fonts: { heroDelta: fs("change-hero-delta"), head: fs("year-settle-head-delta"), title: fs("year-settle-title") },
      overflowX: document.documentElement.scrollWidth - innerWidth, next: r(blk?.nextElementSibling), badge: !!blk?.querySelector('[data-testid="cause-estimated-badge"]'),
      bg: (() => { const pr = q("year-settle-period-row"); return pr ? [getComputedStyle(pr).backgroundColor, getComputedStyle(blk).backgroundColor, getComputedStyle(pr).borderTopWidth, getComputedStyle(pr).boxShadow] : null; })() };
  }, rootSel);
  if (opt.chart) { for (let k = 0; k < 20; k++) { const ok = await p.evaluate(() => { const c = document.querySelector('.recharts-area-curve'); if (!c) return false; const len = c.getTotalLength?.() ?? 0; const da = getComputedStyle(c).strokeDasharray; const first = parseFloat(da); return len > 100 && (da === 'none' || first >= len - 1); }); if (ok) break;  await p.waitForTimeout(400); } }
  const m = await measure(); m.errs = errs; m.chart = await p.evaluate(() => { const c = document.querySelector('.recharts-area-curve'); return c ? [Math.round(c.getTotalLength()), getComputedStyle(c).strokeDasharray] : null; });
  await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
  const toggle = p.locator('[data-testid="year-settle-grow-toggle"]');
  if (opt.open && await toggle.count()) {
    if (opt.keyboard) { await toggle.focus(); await p.keyboard.press("Enter"); } else await toggle.click();
    await p.waitForTimeout(opt.reduced ? 30 : 450);
    const o = await measure(); m.open = { h: o.block.h, expanded: await toggle.getAttribute("aria-expanded"), amtRight: o.amtRight, breaks: o.breaks };
    await p.screenshot({ path: `${OUT}/${tag}-open.png`, fullPage: true });
    if (opt.keyboard) { await p.keyboard.press("Space"); await p.waitForTimeout(450); m.open.afterSpace = await toggle.getAttribute("aria-expanded"); await p.keyboard.press("Enter"); await p.waitForTimeout(450); }
    if (opt.rapid) { for (let k = 0; k < 5; k++) { await toggle.click(); await p.waitForTimeout(60); } await p.waitForTimeout(500); const z = await measure(); m.rapid = { expanded: await toggle.getAttribute("aria-expanded"), h: z.block.h }; }
  }
  if (opt.hints) { // 팝오버 전부 열어 캡처
    m.popovers = [];
    const btns = p.locator('[data-testid="year-settle"] button[aria-label="설명 보기"]');
    const n = await btns.count();
    for (let k = 0; k < n; k++) {
      const hb = btns.nth(k);
      await hb.scrollIntoViewIfNeeded(); await hb.tap().catch(() => hb.click());
      await p.waitForTimeout(600);
      const pm = await measure("[data-radix-popper-content-wrapper]");
      const txt = await p.evaluate(() => { const w = document.querySelector("[data-radix-popper-content-wrapper]"); if (!w) return null; const x = w.getBoundingClientRect(); return { t: w.innerText.replace(/\n+/g, " | "), left: Math.round(x.left), right: Math.round(x.right), vw: innerWidth }; });
      m.popovers.push({ k, txt, breaks: pm.breaks });
      await p.screenshot({ path: `${OUT}/${tag}-hint${k}.png` });
      await p.keyboard.press("Escape"); await p.mouse.click(5, 5).catch(() => {}); await p.waitForTimeout(350);
    }
  }
  if (opt.link) { const l = p.locator('[data-testid="year-settle-cash-link"]'); m.linkCount = await l.count(); if (m.linkCount) { await l.click(); await p.waitForTimeout(1500); m.linkHash = await p.evaluate(() => location.hash); await p.screenshot({ path: `${OUT}/${tag}-after-link.png` }); } }
  console.log(tag, JSON.stringify(m));
  await ctx.close();
}
await b.close();
