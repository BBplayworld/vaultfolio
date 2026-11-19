// #249 2단 준비 — 웰컴 첫 화면 A/B/C 시각 목업 주입 라이브러리(ui-designer, 2026-11-19). 코드 수정 0.
// preview(issue-5.131) 웰컴의 실제 DOM·토큰 위에서 순서 바꾸기·합치기만 한다(새 버튼 0). window.s2 로 노출.
(() => {
  const css = document.createElement("style");
  css.textContent = `[data-testid="preview-badge"],.s2-hide{display:none!important}`;
  document.head.append(css);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const f = (n) => Math.round(n); return { y: f(r.y), b: f(r.bottom), h: f(r.height), x: f(r.x), w: f(r.width) }; };
  const ICO = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="size-4">${d}</svg>`;
  // lucide Compass — 1단 체험 공통 표시와 같은 아이콘(체험 = 나침반)
  const COMPASS = ICO('<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>');
  function hideGate() { const b = $('[data-testid="preview-demo-btn"]'); if (!b) return false; let e = b; while (e.parentElement && getComputedStyle(e).position !== "fixed") e = e.parentElement; e.classList.add("s2-hide"); return true; }
  const parts = () => {
    const net = $('[data-testid="welcome-preview-net"]'); const box = net.children[1];
    return { root: net.parentElement, net, label: net.children[0], chip: $('[data-testid="welcome-trial-link"]'), box, card: box.children[0], donut: box.children[1],
      slot: $('[data-testid="welcome-cta-slot"]'), wiz: $('[data-testid="welcome-cta-wizard"]'), more: $('[data-testid="welcome-cta-more"]'), stock: $('[data-testid="welcome-preview-stock"]') };
  };
  const setLabel = (btn, iconHtml, text, keepArrow) => {
    const svgs = $$("svg", btn); const arrow = keepArrow && svgs.length > 1 ? svgs[svgs.length - 1].outerHTML : "";
    btn.innerHTML = `${iconHtml}${text}${arrow}`;
  };

  // 낱말 통일안(A·B만, C는 현행 그대로): 미리보기 배지 '예시 데이터' → '예시 자산'(1단 체험 공통 표시와 같은 낱말)
  const unify = () => { for (const b of $$("span")) if (b.childElementCount === 0 && b.textContent.trim() === "예시 데이터") b.textContent = "예시 자산"; };
  // A — 둘러보기를 첫 행동으로: 칩(직접 둘러보기)을 순자산 카드 바로 아래 가로 전체 brand 버튼으로 옮긴다(같은 문구, 진입 1개).
  //     등록 칸은 그대로 두되 스크린샷 버튼을 secondary로(한 화면 brand 1개). 도넛은 등록 칸 아래로 이동.
  function A() {
    const p = parts(); const src = p.wiz || $('[data-testid="welcome-cta-inapp"]'); const ARROW = ICO('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');
    p.chip.classList.add("s2-hide");
    const btn = document.createElement("button"); btn.type = "button"; btn.className = src.className; btn.dataset.testid = "s2-trial-primary";
    btn.innerHTML = `${COMPASS}직접 둘러보기${ARROW}`; btn.style.width = "100%";
    p.box.insertBefore(btn, p.donut);
    p.root.insertBefore(p.donut, p.stock);
    if (p.wiz) p.wiz.className = p.more.className; // secondary
    else if (src) src.className = src.className.replace(/\S*bg-brand\S*/g, '').replace(/\btext-white\b/g, '') + ' bg-secondary text-secondary-foreground'; // 인앱: 외부 이동 버튼을 secondary로(한 화면 brand 1개)
    unify();
    return measure();
  }
  // B — 종목 1개 직접 입력을 첫 행동으로: 등록 칸을 신뢰 줄 바로 아래로 올리고, 두 버튼을 [주식 직접 입력(brand)] [다른 자산 · 스크린샷(secondary·팝오버)]로 합친다.
  //     스크린샷 등록은 팝오버 첫 행으로 들어가고 팝오버의 '주식' 행은 빠진다(같은 기능 진입 1개).
  function B() {
    const p = parts(); p.root.insertBefore(p.slot, p.net);
    if (!p.wiz) { unify(); return measure(); } // 인앱: 등록 칸 = 외부 이동 안내가 위로 올라올 뿐
    const PENCIL = $("svg", p.more).outerHTML; const IMG = $("svg", p.wiz).outerHTML; keepIcons();
    const h = $("h2", p.slot), d = $("h2 + p", p.slot); h.textContent = "주식부터 추가해보세요"; d.textContent = "종목·수량·평단가만 넣으면 돼요.";
    setLabel(p.wiz, PENCIL, "주식 직접 입력", true);
    setLabel(p.more, IMG, "다른 자산 · 스크린샷", false);
    p.slot.style.minHeight = "auto"; // 설명 1줄 → 예약 높이 216 대신 내용 높이(구현 시 pending 예약값을 B 내용 높이로 다시 잼)
    unify();
    return measure();
  }
  // B 팝오버 재구성(열린 뒤 호출): 첫 행 = 스크린샷으로 자산 등록, 직접 입력 행에서 주식 제거
  function Bpop() {
    const imp = $('[data-testid="welcome-import"]'); if (!imp) return null; const grp = $('[role="group"][aria-labelledby="welcome-manual-label"]');
    const row = imp.cloneNode(true); row.dataset.testid = "s2-pop-wizard";
    $("svg", row).replaceWith(Object.assign(document.createElement("span"), { innerHTML: IMGICON }).firstElementChild);
    const ps = $$("p", row); ps[0].textContent = "스크린샷으로 자산 등록"; ps[1].textContent = "캡처한 보유 화면으로 한 번에";
    const sep = document.createElement("div"); sep.setAttribute("role", "separator"); sep.className = "mx-3 my-1.5 h-px bg-border/40";
    grp.before(row); grp.before(sep);
    $('[data-testid="welcome-manual-stock"]')?.classList.add("s2-hide");
    return $$('[role="dialog"] button, [data-radix-popper-content-wrapper] button').filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\n/g, " / "));
  }
  let IMGICON = "";
  function keepIcons() { const w = $('[data-testid="welcome-cta-wizard"]'); IMGICON = $("svg", w).outerHTML.replace('class="', 'class="text-muted-foreground shrink-0 '); }

  // 첫 화면 측정: 뷰포트 안에 보이는 누를 것(버튼·링크) 목록과 주요 요소 y
  function measure() {
    const vh = innerHeight; const vis = $$("button, a[href]").filter((e) => { const r = e.getBoundingClientRect(); return e.offsetParent && r.height > 0 && r.top >= 0 && r.bottom <= vh && !e.closest(".s2-hide") && getComputedStyle(e).visibility !== "hidden"; });
    const pick = (s) => R($(s));
    return { vh, tappable: vis.map((e) => (e.innerText || e.getAttribute("aria-label") || e.dataset.testid || "").trim().replace(/\s+/g, " ")),
      trialPrimary: pick('[data-testid="s2-trial-primary"]'), chip: pick('[data-testid="welcome-trial-link"]'), wiz: pick('[data-testid="welcome-cta-wizard"]'), more: pick('[data-testid="welcome-cta-more"]'),
      slot: pick('[data-testid="welcome-cta-slot"]'), card: R(parts().card), h: document.documentElement.scrollHeight };
  }
  window.s2 = { hideGate, A, B, Bpop, keepIcons, measure, R, $, $$ };
})();
