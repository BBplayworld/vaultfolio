import { chromium, PV, PROD, proxy, ctxOpt } from "./lib.mjs";
const OUT = process.argv[2];
const b = await chromium.launch({ proxy });
const open = async (base, W, scheme = "dark", url = "/?trial=1", extra = {}) => { const ctx = await b.newContext({ ...ctxOpt(W, scheme), ...extra }); const p = await ctx.newPage(); await p.goto(base + url, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {}); await p.waitForTimeout(3500); return { ctx, p }; };
const hash = async (p, h) => { await p.evaluate((x) => { location.hash = x; }, h); await p.waitForTimeout(2200); };
// 1. 경계 computed
for (const W of [767, 768, 1279, 1280]) {
  const { ctx, p } = await open(PV, W);
  const r = await p.evaluate(() => { const pick = (re) => { for (const el of document.querySelectorAll("[class]")) { const c = el.getAttribute("class"); if (re.test(c) && el.getBoundingClientRect().width > 0 && [...el.childNodes].some((n) => n.nodeType === 3 && n.nodeValue.trim())) return getComputedStyle(el).fontSize; } return null; }; return { sm: pick(/(^|\s)text-sm(\s|$)(?!.*md:text)/), xs: pick(/(^|\s)text-xs(\s|$)/), base: pick(/(^|\s)text-base(\s|$)/), display: pick(/text-2xl md:text-3xl/), nav: pick(/text-lg md:text-xl/), docOver: document.documentElement.scrollWidth > innerWidth }; });
  console.log("경계", W, JSON.stringify(r)); await ctx.close();
}
// 2. 큰 금액 주입(홈 Display·홈 3총액·상세 요약 Hero·허브 카드 Hero)
for (const W of [360, 768, 1024, 1280]) {
  const { ctx, p } = await open(PV, W);
  const inject = async (tag) => { const r = await p.evaluate(() => { const out = []; for (const el of document.querySelectorAll("p,span")) { const c = el.getAttribute("class") || ""; if (!/(text-2xl|text-xl md:text-2xl|text-2xl md:text-3xl)/.test(c) || !/tabular-nums|font-bold/.test(c)) continue; if (!/[0-9]원/.test(el.textContent)) continue; const tn = [...el.childNodes].find((n) => n.nodeType === 3 && /[0-9]/.test(n.nodeValue)); if (!tn) continue; tn.nodeValue = (/^[+\-−]/.test(tn.nodeValue.trim()) ? "+" : "") + "12,345,678,900원"; const r = el.getBoundingClientRect(); let card = el.parentElement; while (card && !/rounded|bg-card/.test(card.getAttribute("class") || "")) card = card.parentElement; const cr = (card || document.body).getBoundingClientRect(); out.push({ fs: getComputedStyle(el).fontSize, lines: Math.round(r.height / parseFloat(getComputedStyle(el).lineHeight)), out: r.right > cr.right + 1 || r.right > innerWidth + 1, w: Math.round(r.width), cw: Math.round(cr.width) }); } return { out, docOver: document.documentElement.scrollWidth > innerWidth }; }); console.log("큰금액", W, tag, JSON.stringify(r)); await p.screenshot({ path: `${OUT}/big-${tag}-${W}.png` }); };
  await inject("home"); await hash(p, "#detail"); await inject("detail-hub"); await hash(p, "#detail/stocks"); await inject("detail-stocks"); await hash(p, "#activity"); await inject("perf-hub"); await hash(p, "#activity/change"); await inject("perf-change");
  await ctx.close();
}
// 3. 상세 주식 행 높이 374·375·360·390 (main 대조)
for (const W of [360, 374, 375, 390]) {
  const res = {};
  for (const [nm, base] of [["prod", PROD], ["pv", PV]]) {
    const { ctx, p } = await open(base, W); await hash(p, "#detail/stocks");
    res[nm] = await p.evaluate(() => [...document.querySelectorAll('[data-testid="detail-list-box-stocks"] [data-testid^="stock-row-"]')].map((e) => { const r = e.getBoundingClientRect(); const name = e.querySelector(".line-clamp-2,.truncate"); return [Math.round(r.height * 10) / 10, name ? (name.scrollWidth > name.clientWidth + 1 || name.scrollHeight > name.clientHeight + 1) : null, [...e.querySelectorAll('[data-slot="badge"]')].map((bd) => Math.round(bd.getBoundingClientRect().top - r.top))]; }));
    await ctx.close();
  }
  const diff = res.prod.map((x, i) => (res.pv[i] ? Math.round((res.pv[i][0] - x[0]) * 10) / 10 : "?"));
  console.log("행높이", W, "prod", JSON.stringify(res.prod.map((x) => x[0])), "pv", JSON.stringify(res.pv.map((x) => x[0])), "차", JSON.stringify(diff), "말줄임 prod/pv", JSON.stringify(res.prod.map((x) => x[1])), JSON.stringify(res.pv.map((x) => x[1])));
}
// 4. 일 달력 셀 (큰 값 주입 포함)
for (const W of [360, 390, 768, 1024, 1280]) {
  const { ctx, p } = await open(PV, W); await hash(p, "#activity/change"); const l = p.locator('[data-testid="change-period-day"]'); if (await l.count()) { await l.first().click(); await p.waitForTimeout(2000); }
  const r = await p.evaluate(() => { const cells = [...document.querySelectorAll('[data-testid="day-cell-diff"]')]; let bad = 0, n = 0, fs = ""; for (const el of cells) { const tn = [...el.childNodes].find((x) => x.nodeType === 3) || el.firstChild; if (el.firstChild) { el.textContent = "+1,077만원"; } const r = el.getBoundingClientRect(); const rg = document.createRange(); rg.selectNodeContents(el); const tr = rg.getBoundingClientRect(); const cell = el.parentElement.parentElement.getBoundingClientRect(); const cs = getComputedStyle(el); fs = cs.fontSize; n++; if (tr.width > cell.width + 0.5 || tr.height > parseFloat(cs.fontSize) * 1.6) bad++; } return { n, bad, fs }; });
  console.log("달력셀", W, JSON.stringify(r)); await p.screenshot({ path: `${OUT}/cal-${W}.png` }); await ctx.close();
}
// 5. 어절 줄바꿈(C25) — 설치 안내·연결 모달·인앱 게이트 320·375
const kb = () => [...document.querySelectorAll('[role="dialog"] p, [role="dialog"] [data-slot="dialog-description"], main p, body p')].filter((e) => /세션|이 기기로/.test(e.textContent) && e.getBoundingClientRect().width > 0).map((e) => { const rg = document.createRange(); const tn = [...e.childNodes].filter((n) => n.nodeType === 3); const lines = []; for (const t of tn) { let last = null, cur = ""; for (let i = 0; i < t.nodeValue.length; i++) { rg.setStart(t, i); rg.setEnd(t, i + 1); const rc = rg.getClientRects()[0]; if (!rc) continue; if (last !== null && Math.abs(rc.top - last) > 3) { lines.push(cur); cur = ""; } cur += t.nodeValue[i]; last = rc.top; } lines.push(cur); } const mid = lines.slice(0, -1).filter((ln, i) => /[가-힣A-Za-z0-9]$/.test(ln) && /^[가-힣A-Za-z0-9]/.test(lines[i + 1] || "")); return { wb: getComputedStyle(e).wordBreak, mid, t: e.textContent.trim().slice(0, 18) }; });
for (const W of [320, 375]) {
  { const { ctx, p } = await open(PV, W, "dark", "/"); const d = p.locator('[data-testid="preview-demo-btn"]'); if (await d.count()) { await d.click(); await p.waitForTimeout(3000); } const i = p.getByRole("button", { name: "앱 설치" }); if (await i.count()) { await i.first().click(); await p.waitForTimeout(1500); } console.log("C25 설치", W, JSON.stringify(await p.evaluate(kb))); await p.screenshot({ path: `${OUT}/c25-install-${W}.png` }); await ctx.close(); }
  { const { ctx, p } = await open(PV, W, "dark", "/#sync=abcdefghijklmnopqrstuv"); const d = p.locator('[data-testid="preview-demo-btn"]'); if (await d.count()) { await d.click(); await p.waitForTimeout(3000); } console.log("C25 연결", W, JSON.stringify(await p.evaluate(kb))); await p.screenshot({ path: `${OUT}/c25-sync-${W}.png` }); await ctx.close(); }
  { const { ctx, p } = await open(PV, W, "dark", "/", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 KAKAOTALK 10.4.5" }); console.log("C25 인앱", W, JSON.stringify(await p.evaluate(kb))); await p.screenshot({ path: `${OUT}/c25-inapp-${W}.png` }); await ctx.close(); }
}
await b.close();
