// #239 ui 설계 목업 — 운영 체험 화면(#activity/report, #activity)에 DOM을 주입해 실제 토큰 값으로 폭·높이를 잰다. 코드 수정 0.
import { chromium, PROD, proxy, ctxOpt } from "/home/user/vaultfolio/.memory/issues/5.114-typography-scale/tools/lib.mjs";
const OUT = process.argv[2];
const jobs = JSON.parse(process.argv[3] ?? '[[360,"dark"],[390,"dark"],[430,"dark"],[768,"dark"],[1280,"dark"],[390,"light"]]');
const b = await chromium.launch({ proxy });
const LONG = "KODEX 미국S&P500배당귀족커버드콜(합성 H)";
const ROWS = [
  { name: LONG, share: "100.0%", rate: "+1,234.5%", label: "check", fact: ["마지막 점검 11개월 전", "내가 정한 주기 12개월이 지났어요"], btn: "todo" },
  { name: "삼성전자", share: "34.0%", rate: "−18.0%", label: "keep", fact: ["오래 두기로 한 지 11년 11개월"] },
  { name: "TIGER 미국필라델피아반도체레버리지(합성)", share: "12.4%", rate: "+52.3%", label: "check", fact: ["마지막 점검 오늘"], btn: "done" },
  { name: "NVIDIA", share: "8.1%", rate: "+312.7%", label: "none" },
  { name: "Apple", share: "0.4%", rate: "—", label: null },
];
for (const [W, scheme] of jobs) {
  const ctx = await b.newContext(ctxOpt(W, scheme));
  if (scheme === "light") await ctx.addCookies([{ name: "theme_mode", value: "light", domain: "www.secretasset.xyz", path: "/" }]);
  const p = await ctx.newPage();
  await p.goto(PROD + "/?trial=1", { waitUntil: "networkidle", timeout: 90000 }).catch((e) => console.log("goto", e.message));
  await p.waitForTimeout(4000);
  const tag = `${W}-${scheme}`;
  // ── 허브 현황 + 셋째 카드 목업
  await p.evaluate(() => { location.hash = "#activity"; }); await p.waitForTimeout(3500);
  await p.screenshot({ path: `${OUT}/prod-hub-${tag}.png`, fullPage: true });
  const hub = await p.evaluate(() => {
    const card = document.querySelector('[data-testid="hub-card-report"]'); if (!card) return null;
    const r = (e) => { const q = e.getBoundingClientRect(); return { w: Math.round(q.width), h: Math.round(q.height) }; };
    const before = r(card.firstElementChild);
    const h3 = card.querySelector("h3"); const ps = card.querySelectorAll("p"); const sec = card.querySelector("p + p + div, p.tabular-nums + div");
    const badge = h3.querySelector("span span")?.outerHTML ?? "";
    h3.innerHTML = `<span class="inline-flex items-center gap-1.5">내 자산 불리기${badge}</span>`;
    ps[0].textContent = "내 기준으로 지키고, 내가 점검해요";
    const prim = ps[1]; prim.className = prim.className.replace(/text-(rose|blue)-\d+|dark:text-(rose|blue)-\d+/g, "") + " text-foreground";
    const out = { before, states: {} };
    const sdiv = prim.nextElementSibling;
    const set = (k, primary, secondary) => {
      prim.innerHTML = `<span data-m="prim" style="white-space:nowrap">${primary}</span>`;
      if (sdiv) { sdiv.style.display = secondary ? "" : "none"; sdiv.innerHTML = secondary ? `<span class="text-muted-foreground tabular-nums">${secondary}</span>` : ""; }
      const m = prim.querySelector("[data-m]").getBoundingClientRect(), a = prim.getBoundingClientRect();
      out.states[k] = { primW: Math.round(m.width), availW: Math.round(a.width), cardH: r(card.firstElementChild).h, title: Math.round(h3.firstElementChild.getBoundingClientRect().width), titleAvail: Math.round(h3.getBoundingClientRect().width), desc: ps[0].getBoundingClientRect().height };
    };
    set("max", "오래 둘 99 · 점검할 99", "마지막 점검 11개월 전");
    set("zero", "이름표 붙이기", "");
    set("nostock", "성적표 보기", "");
    set("labeled", "오래 둘 6 · 점검할 3", "마지막 점검 4개월 전");
    return out;
  });
  console.log("HUB", tag, JSON.stringify(hub));
  await p.locator('[data-testid="hub-card-report"]').scrollIntoViewIfNeeded().catch(() => {});
  await p.screenshot({ path: `${OUT}/mock-hub-labeled-${tag}.png`, fullPage: true });
  // ── 불리기 화면 현황 + 블록 목업
  await p.evaluate(() => { location.hash = "#activity/report"; }); await p.waitForTimeout(5000);
  await p.screenshot({ path: `${OUT}/prod-report-${tag}.png`, fullPage: true });
  for (const state of ["labeled", "zero"]) {
    const res = await p.evaluate(({ ROWS, state }) => {
      document.querySelector("[data-mock]")?.remove();
      const hero = [...document.querySelectorAll("div.rounded-xl.bg-card")].find((e) => e.className.includes("text-center"));
      const content = hero.parentElement;
      const md = innerWidth >= 768;
      const mu = "var(--muted-foreground)", fg = "var(--foreground)";
      const chev = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:${mu};flex-shrink:0"><path d="m9 18 6-6-6-6"/></svg>`;
      const check = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
      const tagIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-primary" style="flex-shrink:0"><path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r=".5" fill="currentColor"/></svg>`;
      const sel = (opts, idx, w) => `<div role="radiogroup" data-m="sel" class="relative grid rounded-lg bg-muted/70 dark:bg-muted/50 p-0.5" style="grid-template-columns:repeat(${opts.length},minmax(0,1fr));${w ? `width:${w}px;flex-shrink:0` : ""}">${idx >= 0 ? `<span class="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md bg-card dark:bg-foreground/15 shadow-sm" style="width:calc((100% - 0.25rem) / ${opts.length});transform:translateX(${idx * 100}%)"></span>` : ""}${opts.map((o, i) => `<button type="button" class="relative min-h-10 min-w-0 truncate rounded-md px-2 text-sm ${i === idx ? "text-foreground font-semibold" : "text-muted-foreground"}"><span data-m="cell">${o}</span></button>`).join("")}</div>`;
      const v = (t) => `<span style="font-weight:600;color:${fg}">${t}</span>`;
      const nw = (t, m) => `<span data-m="${m}" style="white-space:nowrap">${t}</span>`;
      const zero = state === "zero";
      let h = `<div class="flex flex-wrap items-center gap-2">${tagIcon}<h3 class="text-base font-bold text-foreground">내 주식 이름표</h3></div>`;
      h += `<p data-m="cap" class="text-sm text-muted-foreground" style="line-height:1.625;word-break:keep-all;text-wrap:pretty">이름표는 내가 붙여요. 앱은 내 기록의 숫자만 보여 줘요.</p>`;
      if (!zero) h += `<p data-m="sum" class="text-sm text-muted-foreground tabular-nums" style="display:flex;flex-wrap:wrap;column-gap:6px">${nw(`오래 둘 ${v(99)}`, "sum1")}<span aria-hidden>·</span>${nw(`점검할 ${v(99)}`, "sum2")}<span aria-hidden>·</span>${nw(`정하지 않음 ${v(99)}`, "sum3")}</p>`;
      h += `<div data-m="cycle"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:40px"><span data-m="cyl" class="text-sm font-semibold text-foreground" style="white-space:nowrap">점검 주기</span>${sel(["3개월", "6개월", "12개월"], zero ? -1 : 0, 204)}</div><p data-m="cycap" class="text-sm text-muted-foreground" style="margin-top:4px;line-height:1.625;word-break:keep-all;text-wrap:pretty">점검할 자산은 내가 정한 주기가 지나면 목록 위쪽에 보여요.</p></div>`;
      h += `<ul data-m="list" style="border-top:1px solid var(--border)">`;
      ROWS.forEach((r0, i) => {
        const r = zero ? { ...r0, label: null, fact: null, btn: null } : r0;
        const idx = r.label === "keep" ? 0 : r.label === "check" ? 1 : r.label === "none" ? 2 : -1;
        let left = `<div data-m="btn" style="min-height:40px;display:flex;flex-direction:column;justify-content:center;min-width:0"><div style="display:flex;align-items:center;gap:8px"><span data-m="name" class="${md ? "text-base" : "text-sm"} font-bold text-foreground truncate" style="min-width:0;flex:1">${r.name}</span>${chev}</div>`;
        left += `<p data-m="fact" class="text-sm text-muted-foreground tabular-nums" style="margin-top:2px;display:flex;flex-wrap:wrap;column-gap:6px">${nw(`내 주식의 ${v(r.share)}`, "f1")}<span data-m="dot" aria-hidden>·</span>${nw(`내 매입가 대비 ${v(r.rate)}`, "f2")}</p>`;
        if (r.fact) left += `<p data-m="lfact" class="text-sm text-muted-foreground tabular-nums" style="display:flex;flex-wrap:wrap;column-gap:6px">${nw(r.fact[0], "l1")}${r.fact[1] ? `<span aria-hidden>·</span>${nw(r.fact[1], "l2")}` : ""}</p>`;
        left += `</div>`;
        let right = `<div data-m="right" style="${md ? "width:20rem;flex-shrink:0" : "margin-top:8px"}">${sel(["오래 둘 자산", "점검할 자산", "정하지 않음"], idx)}`;
        if (r.btn === "todo") right += `<button type="button" data-m="chk" class="text-sm font-medium text-foreground rounded-lg" style="margin-top:8px;width:100%;height:40px;background:var(--secondary)">오늘 점검했어요</button>`;
        if (r.btn === "done") right += `<div data-m="chk" class="text-sm font-medium text-muted-foreground" style="margin-top:8px;width:100%;height:40px;display:flex;align-items:center;justify-content:center;gap:6px">${check}오늘 점검함</div>`;
        right += `</div>`;
        h += `<li data-m="row" data-i="${i}" style="padding:12px 0;${i ? "border-top:1px solid var(--border);" : ""}${md ? "display:flex;gap:16px;align-items:flex-start" : ""}"><div style="flex:1;min-width:0">${left}</div>${right}</li>`;
      });
      h += `</ul><button type="button" class="text-sm font-medium text-primary" style="width:100%;min-height:40px;display:flex;align-items:center;justify-content:center;gap:4px;margin-bottom:-8px">전체 보기</button>`;
      const box = document.createElement("div"); box.dataset.mock = "1"; box.className = "rounded-xl bg-card p-4 space-y-3 dark:shadow-sm"; box.innerHTML = h;
      content.insertBefore(box, hero);
      const q = (e) => { const c = e.getBoundingClientRect(); return { w: Math.round(c.width * 10) / 10, h: Math.round(c.height), y: Math.round(c.top + scrollY) }; };
      const rows = [...box.querySelectorAll('[data-m="row"]')].map((row) => {
        const g = (m) => row.querySelector(`[data-m="${m}"]`);
        const cells = [...g("sel").querySelectorAll("button")].map((bt) => ({ cellW: q(bt).w, textW: q(bt.querySelector('[data-m="cell"]')).w, h: q(bt).h, clipped: bt.scrollWidth > bt.clientWidth }));
        return { i: row.dataset.i, rowH: q(row).h, btnW: q(g("btn")).w, btnH: q(g("btn")).h, nameClip: g("name").scrollWidth > g("name").clientWidth, f1: q(g("f1")).w, f2: q(g("f2")).w, factH: q(g("fact")).h, l1: g("l1") ? q(g("l1")).w : null, l2: g("l2") ? q(g("l2")).w : null, lfactH: g("lfact") ? q(g("lfact")).h : null, cells };
      });
      const g = (m) => box.querySelector(`[data-m="${m}"]`);
      return { state, box: q(box), heroY: q(hero).y, capH: q(g("cap")).h, sum: g("sum") ? { w: ["sum1", "sum2", "sum3"].map((m) => q(g(m)).w), h: q(g("sum")).h } : null, cycle: { labelW: q(g("cyl")).w, capH: q(g("cycap")).h, cells: [...g("cycle").querySelectorAll("button")].map((bt) => ({ cellW: q(bt).w, textW: q(bt.querySelector('[data-m="cell"]')).w })) }, rows, vh: innerHeight };
    }, { ROWS, state });
    console.log("BLOCK", tag, JSON.stringify(res));
    await p.screenshot({ path: `${OUT}/mock-block-${state}-${tag}.png`, fullPage: true });
  }
  await ctx.close();
}
await b.close();
