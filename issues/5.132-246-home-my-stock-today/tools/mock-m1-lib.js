// #246 홈 '내 종목 오늘' 1줄 — 시각 목업 주입 라이브러리(ui-designer, 2026-11-19). 코드 수정 0.
// preview(issue-5.126) 홈의 실제 DOM·클래스 위에 새 줄만 덧붙인다. window.m1 로 노출. 홈 팁 주입은 #245 mock-d1-lib.js 의 d1.tip 을 같이 쓴다.
(() => {
  const css = document.createElement("style");
  css.textContent = `
  /* 누름 상자 = 히트영역(40px, 카드 좌우 끝까지). 글줄 상자 20px. geo: c=확정(위 4·아래 16) a=위아래 10·카드 끝 6 b=위아래 10·카드 끝 0 */
  .m1-wrap{margin-top:10px}
  .m1-wrap.m1-open{margin-top:0}
  .m1-line{box-sizing:border-box;display:flex;align-items:center;gap:6px;width:calc(100% + 32px);height:40px;margin:0 -16px -16px;padding:4px 16px 16px;white-space:nowrap;text-align:left;border-radius:0 0 12px 12px;cursor:pointer}
  .m1-wrap[data-geo="a"] .m1-line{padding:10px 16px;margin-bottom:-10px}
  .m1-wrap[data-geo="b"] .m1-line{padding:10px 16px;margin-bottom:-16px}
  .m1-wrap[data-geo="row"] .m1-line{padding:10px 0;margin:0;width:100%}
  .m1-name{min-width:0;overflow:hidden;text-overflow:ellipsis}
  .m1-fix{flex:none}
  .m1-rate{flex:none;font-weight:600;font-variant-numeric:tabular-nums}
  .m1-down{color:var(--m1-down)}
  /* 꼬리 칸: 쉐브론이 DOM 첫째. row-reverse + wrap 이라 '외 N종목'이 안 들어가면 둘째 줄로 넘어가 잘린다(쉐브론은 남는다). JS 측정 0 */
  .m1-tail{display:flex;flex-direction:row-reverse;flex-wrap:wrap;justify-content:flex-end;align-content:flex-start;align-items:center;flex:1 1 0;min-width:16px;height:20px;overflow:hidden;margin-left:-4px}
  .m1-tail svg{width:16px;height:16px;margin:2px 0;flex:none}
  .m1-more{flex:none;line-height:20px;padding-right:2px}
  .m1-more i{font-style:normal;margin:0 6px 0 4px;opacity:.6}
  .m1-skel{display:inline-block;width:176px;height:16px;border-radius:4px;background:color-mix(in oklab,var(--foreground) 10%,transparent)}
  .m1-hit{position:absolute;pointer-events:none;z-index:99;box-sizing:border-box;border:1px dashed}
  `;
  document.head.append(css);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const H = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const drop = (sel) => { for (const e of $$(sel)) e.parentNode.removeChild(e); };
  const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const UP = "text-rose-600 dark:text-rose-400";
  const card = () => ($('[data-testid="home-cause-line"]') || $('[data-testid="home-market-today"]')).closest(".rounded-lg");
  // 내림 색 = 같은 카드 원인 줄 금액의 실제 색(손익색 토큰 그대로)
  const downColor = () => { const e = $$('[data-testid="home-cause-line"] span').find((s) => /font-semibold/.test(s.className)); return e ? getComputedStyle(e).color : "oklch(70.7% .165 254.624)"; };
  let DOWN = null;

  // spec = { name, label, rate: "+3.2%", n, order?: "date-first", noDot? } | "pending" | null.  opt = { geo: "c"|"a"|"b", where: "end"|"panel" }
  function lineHtml(spec, geo) {
    if (spec === "pending") return `<div class="m1-wrap" data-geo="${geo}" data-testid="home-my-stock-slot" data-state="pending" aria-hidden="true"><div class="m1-line text-sm" style="cursor:default"><span class="m1-skel"></span></div></div>`;
    const neg = /^[-−▼]/.test(spec.rate);
    const name = `<span class="m1-name text-foreground">${spec.name}</span>`, label = `<span class="m1-fix">${spec.label}</span>`;
    const more = spec.n > 0 ? `<span class="m1-more" data-testid="home-my-stock-more">${spec.noDot ? "" : '<i aria-hidden="true">·</i>'}외 ${spec.n}종목</span>` : "";
    return `<div class="m1-wrap" data-geo="${geo}" data-screenshot-hide><button type="button" data-testid="home-my-stock" data-state="on" class="m1-line text-sm text-muted-foreground" aria-label="내 종목 보기, ${spec.name} ${spec.label} ${spec.rate}${spec.n > 0 ? `, 외 ${spec.n}종목` : ""}">${spec.order === "date-first" ? label + name : name + label}<span class="m1-rate ${neg ? "m1-down" : UP}" data-testid="home-my-stock-rate">${spec.rate}</span><span class="m1-tail">${CHEV_R}${more}</span></button></div>`;
  }
  function line(spec, opt = {}) {
    DOWN ??= downColor(); document.documentElement.style.setProperty("--m1-down", DOWN);
    drop(".m1-wrap"); if (!spec) return;
    const c = card(); const geo = opt.geo || "c";
    if (opt.where === "panel") { const el = H(lineHtml(spec, "row")); el.style.marginTop = "0"; $('[data-testid="home-cause-collapse"]').before(el); return; } // 비교안: 패널 안 지수 줄 아래
    const el = H(lineHtml(spec, geo)); if ($('[data-testid="home-cause-line"]')?.getAttribute("aria-expanded") === "true" && !opt.keepGap) el.classList.add("m1-open");
    c.append(el);
  }
  // 원인 없는 날(변동 없음) — 원인 블록을 빼고 지수 줄을 카드 안 variant="card" 꼴로 둔다. marketHtml 로 지수 문장 교체 가능
  function noCause(marketHtml) {
    const c = card(); const mk = $('[data-testid="home-market-today"]'); const inner = mk.firstElementChild.cloneNode(true);
    const blk = $('[data-testid="home-cause-line"]').closest(".mt-1.w-full");
    const chg = $$("span", c).find((s) => /inline-flex flex-wrap gap-y-0\.5/.test(s.className));
    chg.replaceWith(H('<span class="text-sm font-medium text-muted-foreground">전일 대비 변동 없음</span>'));
    const row = H(`<div class="mt-1 w-full"><button type="button" data-testid="home-market-today" data-placement="card" class="@container relative flex w-full items-center text-left text-sm text-muted-foreground min-h-5 after:absolute after:-inset-x-4 after:-inset-y-2.5 after:content-['']"></button></div>`);
    row.firstElementChild.append(inner); if (marketHtml) inner.firstElementChild.innerHTML = marketHtml; blk.replaceWith(row);
  }
  const V = (t) => `<span class="font-medium text-foreground tabular-nums">${t}</span>`, DOT = '<span aria-hidden="true" class="mx-1.5 text-muted-foreground/60">·</span>';
  // 날짜가 다른 두 시장: 좁은 폭(컨테이너 380 이하)은 운영 규칙(HIDE_REST_DIFF_DATE)대로 첫 시장만
  const marketDiff = (kd, k, ud, u) => `${kd} 종가 코스피 ${V(k)}` + (card().clientWidth - 32 > 380 ? `${DOT}${ud} 종가 S&amp;P 500 ${V(u)}` : "");
  // ── 실측. 누름 상자(히트) rect: 원인 줄 = 버튼 rect(py-2.5 포함) + 좌우 카드 끝, 카드 안 지수 줄 = rect 위아래 10px 확장, 접기 = rect
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const f = (n) => Math.round(n * 10) / 10; return { x: f(b.left), y: f(b.top), w: f(b.width), h: f(b.height), b: f(b.bottom), r: f(b.right) }; };
  const inter = (a, b) => (!a || !b ? 0 : Math.max(0, Math.min(a.r, b.r) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.y, b.y)));
  function hits() {
    const c = card(), cr = R(c); const o = {};
    const cl = $('[data-testid="home-cause-line"]'); if (cl && cl.getAttribute("aria-expanded") !== "true") { o.cause = R(cl); o.cause.x = cr.x; o.cause.w = cr.w; o.cause.r = cr.r; }
    const mk = $('[data-testid="home-market-today"]'); if (mk && mk.getBoundingClientRect().height > 0 && !mk.closest("[inert]")) { const r = R(mk); o.market = mk.dataset.placement === "card" ? { x: cr.x, y: r.y - 10, w: cr.w, h: r.h + 20, b: r.b + 10, r: cr.r } : r; }
    const co = $('[data-testid="home-cause-collapse"]'); if (co && !co.closest("[inert]")) o.collapse = R(co);
    const g = $('button[aria-label^="자산 성적표 보기"]'); if (g) o.grade = R(g);
    const ch = $('button[aria-label="변동 원인 보기"]'); if (ch) o.chevron = R(ch);
    const my = $('[data-testid="home-my-stock"]'); if (my) o.my = R(my);
    return o;
  }
  function measure() {
    const c = card(), h = hits(); const my = $('[data-testid="home-my-stock"]');
    const others = Object.entries(h).filter(([k]) => k !== "my");
    return { card: R(c), seg: R($('[aria-label="자산 분포 필터"]')), donut: R($('[data-testid="home-donut"]')), hits: h,
      overlap: h.my ? Object.fromEntries(others.map(([k, r]) => [k, inter(h.my, r)])) : null,
      text: my ? { name: R($(".m1-name", my)), nameCut: $(".m1-name", my).scrollWidth > $(".m1-name", my).clientWidth, rate: R($(".m1-rate", my)), more: (() => { const m = $(".m1-more", my); if (!m) return null; const r = R(m), t = R($(".m1-tail", my)); return { ...r, visible: r.y < t.b - 1 }; })(), chev: R($("svg", my)) } : null,
      tip: R($('[data-testid="home-tip"]')), tipKind: $('[data-testid="home-tip"]')?.dataset.kind };
  }
  // 히트영역 점선 표시(검수용 캡처)
  function showHits(on = true) {
    drop(".m1-hit"); if (!on) return;
    const col = { my: "#ffd166", cause: "#7bdff2", market: "#7bdff2", collapse: "#b2f7ef", grade: "#f7a8b8", chevron: "#f7a8b8" };
    for (const [k, r] of Object.entries(hits())) document.body.append(H(`<div class="m1-hit" style="left:${r.x + scrollX}px;top:${r.y + scrollY}px;width:${r.w}px;height:${r.h}px;border-color:${col[k]};background:${col[k]}22"></div>`));
  }
  window.m1 = { line, noCause, marketDiff, measure, hits, showHits, card, R };
})();
