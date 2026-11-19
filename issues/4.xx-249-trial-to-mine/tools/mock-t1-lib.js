// #249 체험 공통 표시(상단 sticky 1줄) + 복귀 등록 칸 상태 — 시각 목업 주입 라이브러리(ui-designer, 2026-11-19). 코드 수정 0.
// preview(issue-5.126) `/?trial=1` 의 실제 DOM·토큰 위에 새 표시만 덧붙인다. window.t1 로 노출.
(() => {
  const css = document.createElement("style");
  css.textContent = `
  /* 바깥 = sticky 가림 면(본문 좌우 여백까지, 위아래 4px). 레이아웃 높이는 카드 48px 그대로(-4px 마진) */
  .t1-wrap{position:sticky;top:0;z-index:20;margin:-4px calc(-1 * var(--t1-px));padding:4px var(--t1-px);background:color-mix(in oklab,var(--background) 95%,transparent);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
  .t1-card{box-sizing:border-box;display:flex;align-items:center;gap:8px;min-height:48px;padding:6px 6px 6px 10px;border-radius:12px}
  .t1-row{display:flex;align-items:center;gap:8px;width:100%;min-width:0}
  .t1-card.t1-col{flex-direction:column;align-items:stretch;gap:0}
  .t1-ico{flex:none;display:flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px}
  .t1-ico svg{width:16px;height:16px}
  .t1-text{flex:1 1 0;min-width:0;display:flex;flex-wrap:wrap;align-items:baseline;column-gap:6px;row-gap:0;margin:0;word-break:keep-all}
  .t1-tag{white-space:nowrap;line-height:20px}
  .t1-sub{white-space:nowrap;line-height:16px}
  .t1-btn{position:relative;flex:none;display:inline-flex;align-items:center;justify-content:center;gap:6px;height:36px;padding:0 12px;border-radius:8px;white-space:nowrap;cursor:pointer}
  .t1-btn::after{content:"";position:absolute;inset:-6px 0}
  .t1-btn svg{width:16px;height:16px;flex:none}
  .t1-guide{display:grid;grid-template-rows:1fr}
  .t1-guide>div{min-height:0;overflow:hidden}
  .t1-guide-in{max-height:calc(100dvh - 7.5rem);overflow-y:auto;overscroll-behavior:contain;padding:10px 4px 2px}
  .t1-hit{position:fixed;pointer-events:none;z-index:99;box-sizing:border-box;border:1px dashed}
  .t1-old{display:none!important}
  [data-testid="preview-badge"],.t1-hide{display:none!important}
  /* 등록 칸 팝오버 '짚는 표시' = hover·focus-visible 과 같은 면(bg-accent) + 라벨 굵기 */
  .t1-pick{background:var(--accent)!important}
  .t1-pick span{font-weight:600!important}
  .t1-pick svg{color:var(--foreground)!important}
  `;
  document.head.append(css);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const H = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const R = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); const f = (n) => Math.round(n * 10) / 10; return { x: f(r.x), y: f(r.y), w: f(r.width), h: f(r.height), b: f(r.bottom), r: f(r.right) }; };
  const ICO = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
  const COMPASS = ICO('<path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z"/><circle cx="12" cy="12" r="10"/>');
  const ARROW = ICO('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>');
  const page = () => $("[data-content-area] > div");
  const GUIDE = `<div class="t1-guide" data-testid="trial-inapp-guide"><div><div class="t1-guide-in">
    <div class="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-3.5 py-3 text-sm font-medium text-amber-600 dark:text-amber-400 leading-relaxed"><svg class="size-4 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg><p class="text-sm font-semibold">주소가 복사됐어요. 브라우저에 붙여넣어 주세요.</p></div>
    <ol class="space-y-3.5 py-1 mt-4">${["화면 우측 상단 또는 하단의 <b class='font-semibold text-foreground'>메뉴 ···</b> 를 누릅니다.", "<b class='font-semibold text-foreground'>“다른 브라우저로 열기”</b>(또는 Safari/Chrome으로 열기)를 선택합니다.", "이동한 브라우저에서 주소로 접속하면 이어집니다."].map((t, i) => `<li class="flex items-start gap-3.5 text-sm leading-relaxed"><span class="shrink-0 size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">${i + 1}</span><span>${t}</span></li>`).join("")}</ol>
    <div class="rounded-lg bg-muted/40 p-2.5 text-sm text-muted-foreground mt-4">메뉴에 위 항목이 보이지 않는다면, 복사된 주소를 복사하여 스마트폰의 기본 브라우저(Safari 또는 크롬) 주소창에 직접 붙여넣어 접속해 주세요.</div>
    <div class="flex justify-end pt-2"><button type="button" data-testid="trial-inapp-guide-close" class="h-10 px-3 rounded-lg text-sm font-medium text-muted-foreground">닫기</button></div>
  </div></div></div>`;

  // opt = { variant: "sticky"(확정) | "flow"(비교: in-flow) , guide: true(인앱 iOS 안내 펼침), busy }
  function bar(opt = {}) {
    for (const e of $$(".t1-wrap")) e.remove();
    const old = $('[data-testid="trial-banner"]'); if (old) old.classList.add("t1-old");
    if (opt === false) { if (old) old.classList.remove("t1-old"); stickyOffset(0); return; }
    const pg = page(); if (!pg) return;
    const px = getComputedStyle($("[data-content-area]")).paddingLeft; document.documentElement.style.setProperty("--t1-px", px);
    const el = H(`<div class="t1-wrap" data-testid="trial-bar"><section class="t1-card bg-card dark:shadow-xs${opt.guide ? " t1-col" : ""}" aria-label="체험 안내">
      <div class="t1-row"><span class="t1-ico bg-orange-500/15 text-orange-600 dark:text-orange-400">${COMPASS}</span>
      <p class="t1-text"><span class="t1-tag text-sm font-semibold text-foreground" data-testid="trial-tag">예시 자산</span><span class="t1-sub text-xs text-muted-foreground" data-testid="trial-note">저장되지 않아요</span></p>
      <button type="button" class="t1-btn bg-brand text-white text-sm font-medium dark:shadow-xs" data-testid="trial-start-btn">내 자산으로 시작${ARROW}</button></div>
      ${opt.guide ? GUIDE : ""}</section></div>`);
    if (opt.variant === "flow") el.style.position = "static";
    pg.prepend(el);
    stickyOffset(opt.variant === "flow" ? 0 : 56);
    return measure();
  }
  // 세금 관리의 자체 sticky 2곳(top-0 / top-28)을 표시 높이만큼 내린다 = top-[var(--trial-bar-h,0px)] 대응
  function stickyOffset(h) { for (const e of $$("[data-content-area] .sticky")) { if (e.classList.contains("t1-wrap")) continue; const base = e.classList.contains("top-28") ? 112 : 0; e.style.top = `${base + h}px`; } }
  const lines = (e) => { if (!e) return 0; let n = 0, lastB = -1e9; for (const c of e.children) { const r = c.getBoundingClientRect(); if (r.top >= lastB - 2) n++; lastB = Math.max(lastB, r.bottom); } return n; };
  const inter = (a, b) => !!a && !!b && a.x < b.r && b.x < a.r && a.y < b.b && b.y < a.b;
  function measure(keySel) {
    const w = $(".t1-wrap"), c = $(".t1-card"), b = $(".t1-btn"), t = $(".t1-text");
    const vis = (e) => { if (!e) return false; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.display !== "none" && cs.visibility !== "hidden" && r.width > 0 && r.height > 0; };
    const nav = $('[data-testid="bottom-nav"]'), top = $('[data-testid="scroll-to-top"]') || $$("button").find((x) => /맨 위/.test(x.getAttribute("aria-label") || "")), toast = $("[data-sonner-toast]");
    const stickies = $$("[data-content-area] .sticky").filter((e) => !e.classList.contains("t1-wrap") && vis(e)).map(R);
    const wr = R(w), key = keySel ? keyRect(keySel) : null;
    const hitEl = b ? document.elementFromPoint(b.getBoundingClientRect().x + 20, b.getBoundingClientRect().y - 4) : null;
    return { vw: innerWidth, vh: innerHeight, scrollY: Math.round(scrollY), wrap: wr, card: R(c), btn: R(b), btnHit: b ? { w: R(b).w, h: R(b).h + 12, topEdgeHits: hitEl === b } : null, textLines: lines(t), btnLines: b ? Math.round(b.getBoundingClientRect().height / 36) : 0,
      tagCount: $$('[data-testid="trial-tag"]').filter(vis).length, btnCount: $$('[data-testid="trial-start-btn"]').filter(vis).length,
      overlap: { nav: vis(nav) && inter(wr, R(nav)), toTop: vis(top) && inter(wr, R(top)), toast: vis(toast) && inter(wr, R(toast)), sticky: stickies.some((s) => inter(wr, s)) }, navRect: vis(nav) ? R(nav) : null, stickies, key };
  }
  // 첫 핵심 값: 글자에 pattern 이 들어간 가장 큰 글자 요소
  function keyRect(pattern) { const re = new RegExp(pattern); let best = null, size = 0; for (const e of $$("[data-content-area] *")) { if (e.closest(".t1-wrap") || e.children.length > 2) continue; const tx = (e.innerText || "").trim(); if (!tx || tx.length > 40 || !re.test(tx)) continue; const fs = parseFloat(getComputedStyle(e).fontSize); const r = e.getBoundingClientRect(); if (r.width && fs > size) { size = fs; best = e; } } return best ? { text: best.innerText.trim().replace(/\s+/g, " "), fs: size, ...R(best), inFirst: best.getBoundingClientRect().bottom <= innerHeight } : null; }
  function showHits(on = true) { for (const e of $$(".t1-hit")) e.remove(); if (!on) return; const b = $(".t1-btn").getBoundingClientRect(); const d = document.createElement("div"); d.className = "t1-hit"; d.style.cssText += `left:${b.x}px;top:${b.y - 6}px;width:${b.width}px;height:${b.height + 12}px;border-color:#ffd84d;background:#ffd84d22`; document.body.append(d); }

  // ── 복귀한 웰컴 등록 칸 상태. kind = null(현행) | stocks | crypto | cash | loans | real-estate
  const CTA = { stocks: ["주식부터 추가해보세요", "방금 본 화면이 내 주식으로 채워져요."], crypto: ["암호화폐부터 추가해보세요", "방금 본 화면이 내 암호화폐로 채워져요."], cash: ["현금성 자산부터 추가해보세요", "방금 본 화면이 내 현금성 자산으로 채워져요."], loans: ["대출부터 추가해보세요", "방금 본 화면이 내 대출로 채워져요."], "real-estate": ["부동산부터 추가해보세요", "부동산은 직접 입력으로 넣어요."] };
  const ROW = { stocks: "stock", crypto: "crypto", cash: "cash", loans: "loan", "real-estate": "real-estate" };
  let orig = null;
  function cta(kind) {
    const wiz = $('[data-testid="welcome-cta-wizard"]'), more = $('[data-testid="welcome-cta-more"]'); if (!wiz) return null;
    const box = wiz.closest(".space-y-5"), h = $("h2", box), p = $("p", box);
    orig ??= { h: h.textContent, p: p.textContent, wiz: wiz.className, more: more.className };
    h.textContent = kind ? CTA[kind][0] : orig.h; p.textContent = kind ? CTA[kind][1] : orig.p;
    const swap = kind === "real-estate"; wiz.className = swap ? orig.more : orig.wiz; more.className = swap ? orig.wiz : orig.more;
    (swap ? more : wiz).focus({ focusVisible: true });
    return { h: R(h), p: R(p), pLines: Math.round(p.getBoundingClientRect().height / parseFloat(getComputedStyle(p).lineHeight)), hLines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)), wiz: R(wiz), more: R(more) };
  }
  function hideGate() { const b = $('[data-testid="preview-demo-btn"]'); if (!b) return false; let e = b; while (e.parentElement && getComputedStyle(e).position !== "fixed") e = e.parentElement; e.classList.add("t1-hide"); return true; }
  function pick(kind) { for (const e of $$(".t1-pick")) e.classList.remove("t1-pick"); const rows = $$('[data-testid^="welcome-manual-"]').filter((e) => e.tagName === "BUTTON"); const row = rows.find((e) => e.dataset.testid === `welcome-manual-${ROW[kind]}`) || null; if (row) { row.classList.add("t1-pick"); row.focus(); } return { rows: rows.map((e) => [e.dataset.testid, e.innerText.trim()]), picked: row ? row.innerText.trim() : null, rect: R(row) }; }
  window.t1 = { hideGate, bar, measure, keyRect, showHits, stickyOffset, cta, pick, R, $, $$ };
})();
