// #250 홈 '지금 순자산은 무엇을 더한 값인지' — 시각 목업 주입 라이브러리(ui-designer, 2026-11-20). 코드 수정 0.
// preview(issue-5.132) 홈의 실제 DOM 위에서 필터(InlineSelector)를 숨기고 같은 자리에 사실 1줄 + 버튼 2를 넣는다. window.c250 으로 노출.
// 색·글자는 앱에 이미 컴파일된 클래스(text-sm·text-muted-foreground·font-medium·text-brand·dark:text-indigo-300 = 허브 0건 카드 `추가하기`)를 그대로 쓰고,
// 배치만 아래 CSS로 흉내 낸다(구현 클래스는 ui.md 2절).
(() => {
  const css = document.createElement("style");
  css.textContent = `
  /* 확정안 A: 2줄 가운데. 위 간격 12(space-y-4 16 + -mt-1), 글줄 20 + 버튼 줄 20 = 52(지금 필터 36 + 간격 16과 같음) */
  .c250{display:flex;flex-direction:column;align-items:center;text-align:center;margin-top:-4px}
  .c250-text{margin:0;line-height:20px;word-break:keep-all;text-wrap:balance;max-width:100%}
  .c250-acts{display:flex;align-items:center;justify-content:center;height:20px}
  .c250-btn{position:relative;line-height:20px;padding:0 2px;border-radius:4px;white-space:nowrap;transition:color .15s,scale .15s;cursor:pointer;background:none}
  /* 히트 40: 위 6(문장 글자 아래 여백) · 아래 14(도넛 조각 위 2px 남김) · 좌우 8 */
  .c250-btn::after{content:"";position:absolute;inset:-6px -8px -14px}
  .c250-btn:active{scale:.96}
  .c250-dot{margin:0 8px;opacity:.6;line-height:20px}
  /* 비교안 B: 가운뎃점 없이 간격 16 */
  .c250[data-v="b"] .c250-dot{display:none}.c250[data-v="b"] .c250-acts{gap:16px}
  /* 비교안 C: secondary 알약 버튼(h-8) — 높이 +12 */
  .c250[data-v="c"] .c250-acts{height:32px;gap:8px;margin-top:4px}.c250[data-v="c"] .c250-dot{display:none}
  .c250[data-v="c"] .c250-btn{height:32px;padding:0 12px;border-radius:999px;background:var(--secondary)}
  /* 비교안 D: 넓은 폭 1줄(문장 + 버튼) */
  .c250[data-v="d"]{flex-direction:row;flex-wrap:wrap;justify-content:center;column-gap:12px}
  .c250-hit{position:absolute;pointer-events:none;z-index:99;box-sizing:border-box;border:1px dashed}
  `;
  document.head.append(css);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const H = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const seg = () => $('[aria-label="자산 분포 필터"]');
  const heroCard = () => ($('[data-testid="home-cause-line"]') || $('[data-testid="home-market-today"]') || $('[data-testid="home-my-stock"]'))?.closest(".rounded-lg") ?? $(".space-y-4 > .relative.rounded-lg");
  const KIND = { stocks: "주식", crypto: "암호화폐" };
  function block(kind = "stocks", v = "a") {
    unblock();
    const s = seg(); const holder = s ? s.parentElement : null; // 필터 래퍼(flex justify-center) 자리
    const el = H(`<div class="c250" data-v="${v}" data-testid="home-compose" data-kind="${kind}" data-screenshot-hide>
      <p data-testid="home-compose-text" class="c250-text text-sm text-muted-foreground">지금 순자산은 ${KIND[kind]}만 더한 값이에요</p>
      <div class="c250-acts">
        <button type="button" data-testid="home-compose-cash" class="c250-btn text-sm font-medium text-brand dark:text-indigo-300">현금 추가하기</button>
        <span aria-hidden="true" class="c250-dot text-sm text-muted-foreground">·</span>
        <button type="button" data-testid="home-compose-loan" class="c250-btn text-sm font-medium text-brand dark:text-indigo-300">대출 추가하기</button>
      </div></div>`);
    if (holder) { holder.style.display = "none"; holder.dataset.c250Hidden = "1"; holder.after(el); }
    else heroCard().after(el);
    for (const [id, cat] of [["home-compose-cash", "cash"], ["home-compose-loan", "loan"]]) $(`[data-testid="${id}"]`).addEventListener("click", () => window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category: cat } })));
  }
  function unblock() { for (const e of $$(".c250")) e.remove(); for (const h of $$("[data-c250-hidden]")) { h.style.display = ""; delete h.dataset.c250Hidden; } }
  const R = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); const f = (n) => Math.round(n * 10) / 10; return { x: f(b.left), y: f(b.top + scrollY), w: f(b.width), h: f(b.height), b: f(b.bottom + scrollY), r: f(b.right) }; };
  const hitOf = (btn) => { const r = R(btn), cs = getComputedStyle(btn, "::after"); const t = -parseFloat(cs.top), bt = -parseFloat(cs.bottom), l = -parseFloat(cs.left); return { x: r.x - l, y: r.y - t, w: r.w + 2 * l, h: r.h + t + bt, b: r.b + bt, r: r.r + l }; };
  function measure() {
    const hc = R(heroCard()), dn = R($('[data-testid="home-donut"]')), wk = R($('[data-testid="home-week-card"]'));
    const t = $('[data-testid="home-compose-text"]'); const lines = t ? Math.round(t.getBoundingClientRect().height / 20) : null;
    const cash = $('[data-testid="home-compose-cash"]'), loan = $('[data-testid="home-compose-loan"]');
    const pie = $('[data-testid="home-donut"] .recharts-pie');
    return { heroBottom: hc?.b, seg: R(seg()), block: R($(".c250")), textLines: lines, text: R(t), donutTop: dn?.y, gapHeroToDonut: hc && dn ? Math.round((dn.y - hc.b) * 10) / 10 : null, weekTop: wk?.y,
      cash: cash ? { box: R(cash), hit: hitOf(cash) } : null, loan: loan ? { box: R(loan), hit: hitOf(loan) } : null, pieTop: R(pie)?.y,
      tabs: seg() ? $$('[role="radio"]', seg()).map((b) => b.innerText) : null, scrollW: document.documentElement.scrollWidth, vw: innerWidth };
  }
  function showHits(on = true) {
    for (const e of $$(".c250-hit")) e.remove(); if (!on) return;
    for (const [id, col] of [["home-compose-cash", "#ffd166"], ["home-compose-loan", "#ffd166"]]) { const b = $(`[data-testid="${id}"]`); if (!b) continue; const r = hitOf(b); document.body.append(H(`<div class="c250-hit" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;border-color:${col};background:${col}22"></div>`)); }
    const p = $('[data-testid="home-donut"] .recharts-pie'); if (p) { const r = R(p); document.body.append(H(`<div class="c250-hit" style="left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;border-color:#7bdff2"></div>`)); }
  }
  window.c250 = { block, unblock, measure, showHits, heroCard, R };
})();
