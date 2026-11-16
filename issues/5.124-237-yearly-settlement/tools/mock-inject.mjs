import { chromium, PROD, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const STATES = JSON.parse(process.argv[3]);
const jobs = JSON.parse(process.argv[4]);
for (const [W, scheme] of jobs) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: "www.secretasset.xyz", path: "/" }]);
  const p = await ctx.newPage();
  await p.goto(PROD + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(4000);
  const st = await p.evaluate(() => {
    const g = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
    const d = g("secretasset_daily_snapshots") || [], m = g("secretasset_monthly_snapshots") || [], a = g("secretasset_asset_data") || {};
    return { daily: d.length, lastDaily: d.at(-1), monthly: m.map((x) => [x.month, x.date, x.netAsset, !!(x.breakdown && x.fx && x.fxBase && x.cost)]), yearly: a.yearlyNetAssets, cash: (a.cash || []).length, loans: (a.loans || []).length, cashTx: (a.cashTransactions || []).length };
  });
  if (W === 360) console.log("STORE", JSON.stringify(st));
  const net = Math.round(st.lastDaily?.netAsset ?? 540000000);
  await p.evaluate(() => { location.hash = "#activity/change"; });
  await p.waitForTimeout(3000);
  await p.locator('[data-testid="change-period-year"]').first().click(); await p.waitForTimeout(2500);
  p.on("dialog", (d) => d.accept()); await p.locator('button[aria-label="순자산 삭제"]').first().click(); await p.waitForTimeout(800);
  const ad = p.getByRole("alertdialog");
  if (await ad.count()) await ad.getByRole("button", { name: /삭제/ }).click();
  await p.waitForTimeout(1500);
  const add = async (y, v) => {
    await p.locator('[data-testid="yearly-add-link"]').first().click(); await p.waitForTimeout(1000);
    const dlg = p.getByRole("dialog").filter({ hasText: "년도별 순자산 추가" });
    const inputs = dlg.locator("input");
    await inputs.nth(0).fill(String(y)); await inputs.nth(1).fill(String(v)); await p.waitForTimeout(300);
    await dlg.getByRole("button", { name: "추가", exact: true }).click(); await p.waitForTimeout(2000);
  };
  await add(2026, net); await add(2025, 505840000);
  await p.waitForTimeout(6000);
  await p.evaluate(() => document.querySelectorAll("[data-sonner-toaster]").forEach((e) => e.remove()));

  for (const st of STATES) {
    const res = await p.evaluate((st) => {
      const sec = document.querySelector('[data-testid="cause-block"]');
      const dark = document.documentElement.classList.contains("dark");
      const md = innerWidth >= 768;
      const C = { up: dark ? "#fb7185" : "#e11d48", down: dark ? "#60a5fa" : "#2563eb", fg: "var(--foreground)", mu: "var(--muted-foreground)", link: dark ? "#a5b4fc" : "var(--brand)" };
      const T = { sm: "var(--text-sm, 0.875rem)", base: "var(--text-base, 1rem)", xl: md ? "var(--text-2xl, 1.5rem)" : "var(--text-xl, 1.25rem)", xs: "var(--text-xs, 0.75rem)" };
      const won = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toLocaleString("en-US")}원`;
      const col = (v) => (v >= 0 ? C.up : C.down);
      const info = sec.querySelector('button[aria-label="설명 보기"]')?.outerHTML ?? "";
      const icon = sec.querySelector("svg")?.outerHTML ?? "";
      const chev = (open) => `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${C.mu};flex-shrink:0;${open ? "transform:rotate(180deg)" : ""}"><path d="m6 9 6 6 6-6"/></svg>`;
      const nw = (t) => `<span style="white-space:nowrap">${t}</span>`;
      const b = (t) => `<span style="font-weight:600;font-variant-numeric:tabular-nums">${t}</span>`;
      let h = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px">${icon}<span data-m="title" style="font-size:${T.base};line-height:1.5;font-weight:700;color:${C.fg}">${st.title}</span>${info}</div>`;
      if (st.head) h += `<div data-m="head"><p style="font-size:${T.sm};line-height:1.43;color:${C.mu};font-variant-numeric:tabular-nums">${st.head[0]}</p><p style="margin-top:2px;font-size:${T.xl};line-height:1.25;font-weight:700;font-variant-numeric:tabular-nums;color:${col(st.head[1])}">${won(st.head[1])}</p></div>`;
      if (st.concl) h += `<p data-m="concl" style="font-size:${T.sm};line-height:1.625;font-weight:500;color:${C.fg};word-break:keep-all;text-wrap:pretty">${st.concl.replace(/\[\[(.+?)\]\]/g, (_, t) => nw(t)).replace(/\{\{(.+?)\}\}/g, (_, t) => b(t))}</p>`;
      if (st.note) h += `<p data-m="note" style="font-size:${T.sm};line-height:1.625;color:${C.mu};word-break:keep-all;text-wrap:pretty">${st.note}</p>`;
      if (st.groups || st.unrec !== undefined) {
        h += `<div data-m="list">`;
        for (const g of st.groups ?? []) {
          const exp = !!g.subs;
          h += `<div data-m="group" style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px;${exp ? `margin:0 -8px;padding:0 8px;border-radius:12px;${st.hover ? "background:color-mix(in oklab, var(--muted) 40%, transparent);" : ""}` : ""}"><span style="display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:${md ? T.base : T.sm};font-weight:700;color:${C.fg}">${g.name}${exp ? chev(st.open) : info}</span><span data-m="amt" style="flex-shrink:0;font-size:${T.base};line-height:1.5;font-weight:700;font-variant-numeric:tabular-nums;color:${col(g.v)}">${won(g.v)}</span></div>`;
          if (exp && st.open) h += `<div data-m="panel" style="margin-left:4px;padding:4px 0 4px 12px;margin-bottom:8px;border-left:1px solid var(--border);display:flex;flex-direction:column;gap:8px">${g.subs.map(([n, v]) => `<div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px"><span style="font-size:${T.sm};line-height:1.43;color:${C.mu}">${n}</span><span data-m="amt" style="font-size:${T.sm};line-height:1.43;font-weight:600;font-variant-numeric:tabular-nums;color:${col(v)}">${won(v)}</span></div>`).join("")}</div>`;
        }
        if (st.unrec !== undefined) h += `<div data-m="unrec" style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:32px"><span style="display:inline-flex;align-items:center;gap:6px;font-size:${T.sm};color:${C.mu}">기록 안 된 변화${info}</span><span data-m="amt" style="flex-shrink:0;font-size:${T.sm};font-weight:600;font-variant-numeric:tabular-nums;color:${col(st.unrec)}">${won(st.unrec)}</span></div>`;
        if (st.link) h += `<div data-m="link" style="display:flex;align-items:center;min-height:40px"><span style="font-size:${T.sm};font-weight:500;color:${C.link};text-decoration:underline;text-underline-offset:2px">입출금을 기록할 현금 계좌 고르기</span></div>`;
        h += `</div>`;
      }
      if (st.period) h += `<div data-m="period" style="margin:0 -8px;border-radius:12px;background:color-mix(in oklab, var(--muted) 30%, transparent);padding:10px 8px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px"><span data-m="plabel" style="display:inline-flex;align-items:center;gap:6px;min-width:0;font-size:${T.sm};line-height:1.43;font-weight:600;color:${C.fg};font-variant-numeric:tabular-nums;white-space:nowrap">${st.period[0]}${info}</span><span data-m="amt" style="flex-shrink:0;font-size:${T.sm};line-height:1.43;font-weight:600;font-variant-numeric:tabular-nums;color:${col(st.period[1])}">${won(st.period[1])}</span></div><p data-m="pcap" style="margin-top:2px;font-size:${T.sm};line-height:1.5;color:${C.mu};word-break:keep-all;font-variant-numeric:tabular-nums">${st.period[3] ?? "월 기록 전 기간 <span style=\"white-space:nowrap\">· "}${st.period[2]}${st.period[3] !== undefined ? "" : "</span>"}</p></div>`;
      sec.innerHTML = h;
      sec.style.animation = "none";
      if (st.heroTitle) { const t = document.querySelector('[data-testid="change-hero-title"]'); if (t) t.textContent = st.heroTitle; }
      const r = (e) => { if (!e) return null; const q = e.getBoundingClientRect(); return { y: Math.round(q.top + scrollY), h: Math.round(q.height * 10) / 10, w: Math.round(q.width) }; };
      const lines = (e) => { if (!e) return null; const rg = document.createRange(); rg.selectNodeContents(e); return new Set([...rg.getClientRects()].map((q) => Math.round(q.top))).size; };
      const amts = [...sec.querySelectorAll('[data-m="amt"]')].map((e) => Math.round(e.getBoundingClientRect().right * 10) / 10);
      const g0 = sec.querySelector('[data-m="group"]');
      return { W: innerWidth, block: r(sec), conclLines: lines(sec.querySelector('[data-m="concl"]')), noteLines: lines(sec.querySelector('[data-m="note"]')), pcapLines: lines(sec.querySelector('[data-m="pcap"]')), plabelLines: lines(sec.querySelector('[data-m="plabel"]')), period: r(sec.querySelector('[data-m="period"]')), list: r(sec.querySelector('[data-m="list"]')), head: r(sec.querySelector('[data-m="head"]')), amtRight: [...new Set(amts)], groupGap: g0 ? Math.round(g0.lastElementChild.getBoundingClientRect().left - g0.firstElementChild.getBoundingClientRect().right) : null, next: r(sec.nextElementSibling), docH: document.documentElement.scrollHeight, over: document.documentElement.scrollWidth - innerWidth };
    }, st);
    console.log(st.id, scheme, JSON.stringify(res));
    await p.waitForTimeout(300);
    const tag = `mock-${st.id}-${W}-${scheme}`;
    if (st.full) await p.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    else await p.locator('[data-testid="cause-block"]').screenshot({ path: `${OUT}/${tag}.png` });
  }
  await ctx.close();
}
await b.close();
