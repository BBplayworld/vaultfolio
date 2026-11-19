// #245 내 종목 화면이 내 결정을 안다 — 시각 목업 주입 라이브러리(ui-designer, 2026-11-19). 코드 수정 0.
// preview(issue-5.126) 체험 화면의 실제 DOM·클래스 위에 새 요소만 덧붙인다. window.d1 로 노출.
(() => {
  const css = document.createElement("style");
  css.textContent = `
  .d1-due{font-weight:600;color:oklch(87% .065 274.039)}            /* dark:text-indigo-200 = DUE_TEXT */
  html:not(.dark) .d1-due{color:oklch(51.1% .262 276.966)}          /* text-indigo-600 */
  .d1-down{color:oklch(70.7% .165 254.624)!important}
  .d1-nw{white-space:nowrap}
  /* 모바일(<640): 가운뎃점은 표시 조각 왼쪽 여백 안에 두고, 메타 줄 왼쪽 12px를 잘라 줄 머리에 온 가운뎃점을 숨긴다 */
  @media (max-width:639px){
    .d1-meta{margin-left:-12px;clip-path:inset(0 0 0 12px);column-gap:0!important}
    .d1-meta>*{padding-left:12px}
    .d1-tag.d1-nw{position:relative}
    .d1-tag.d1-nw::before{content:"·";position:absolute;left:0;width:12px;text-align:center;font-weight:400;color:var(--muted-foreground)}
    .d1-dot{display:none}
  }
  .d1-entry{all:unset;box-sizing:border-box;display:flex;align-items:center;gap:4px;width:100%;min-height:40px;padding:8px 8px 8px 12px;border-radius:12px;background:color-mix(in oklab,var(--foreground) 6%,transparent);font-size:14px;line-height:20px;cursor:pointer}
  .d1-entry .t{min-width:0;flex:1;word-break:keep-all;text-wrap:pretty}
  .d1-entry svg{width:16px;height:16px;flex:none;color:var(--muted-foreground)}
  .d1-entry-wrap{padding:4px 16px 8px}
  .d1-head{margin-top:-8px;display:flex;flex-wrap:wrap;column-gap:4px;row-gap:2px;font-size:14px;line-height:20px;color:var(--muted-foreground);font-variant-numeric:tabular-nums}
  .d1-head b{font-weight:600;color:var(--foreground)}
  .d1-head .v{font-weight:500;color:var(--foreground)}
  .d1-head-entry{margin-top:-4px}
  .d1-val{display:flex;flex-wrap:wrap;column-gap:4px;min-height:19.25px}
  .d1-val b{font-weight:600;color:var(--foreground);font-variant-numeric:tabular-nums}
  @media (min-width:1024px){.d1-g4{grid-template-columns:repeat(4,minmax(0,1fr))!important}.d1-g4>*{grid-column:auto!important}}
  .d1-span2{grid-column:span 2 / span 2}
  @media (min-width:1024px){.d1-span2{grid-column:auto}}
  `;
  document.head.append(css);
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const H = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const LIST_CHECKS = '<path d="m3 17 2 2 4-4"></path><path d="m3 7 2 2 4-4"></path><path d="M13 6h8"></path><path d="M13 12h8"></path><path d="M13 18h8"></path>';
  const UP = "text-rose-600 dark:text-rose-400";
  const pct = (v) => `<span class="${v > 0 ? UP : v < 0 ? "d1-down" : ""}" style="font-weight:600">${v > 0 ? "+" : ""}${v.toFixed(1)}%</span>`;
  const rowOf = (name) => $$('[data-testid="stock-row-left"]').find((l) => l.firstElementChild.textContent.trim() === name)?.closest('[data-slot="collapsible"]');

  // ── 상세·주식 행 표시. map = { 이름: "장기 보유"|"점검 대상"|"점검 차례" }
  function tags(map) {
    $$(".d1-tag").forEach((e) => e.remove()); $$(".d1-meta").forEach((e) => e.classList.remove("d1-meta"));
    for (const [name, label] of Object.entries(map)) {
      const row = rowOf(name); if (!row) { console.warn("no row", name); continue; }
      const meta = $('[data-testid="stock-row-left"]', row).children[1];
      const anchor = [...meta.children].filter((c) => !c.className.includes("inline-flex")).pop(); // 오늘 등락 칩(PC) 앞, 수량·비중 뒤
      const due = label === "점검 차례";
      const lab = H(`<span data-testid="stock-row-decision" data-kind="${due ? "due" : label === "장기 보유" ? "keep" : "check"}" class="d1-tag d1-nw text-sm ${due ? "d1-due" : "text-muted-foreground"}">${label}</span>`);
      const dot = H(`<span aria-hidden="true" class="d1-tag d1-dot text-sm text-muted-foreground">·</span>`); meta.classList.add("d1-meta");
      anchor.after(dot, lab);
    }
  }
  // 행의 손익 숫자를 바꾼다(손실 상태 대입용)
  const noChip = (name) => $$(".sm\\:hidden", rowOf(name)).forEach((e) => { e.style.display = "none"; }); // 오늘 등락 칩이 없는 행(장중 미확정) 재현
  function rowProfit(name, amount, profit, rate, keepTone) {
    const row = rowOf(name); const r = $('[data-testid="stock-row-right"]', row);
    if (amount) r.children[0].textContent = amount;
    const [a, b] = $('[data-testid="profit-text"]', r).children; a.textContent = profit; b.textContent = `(${rate})`;
    if (!keepTone) for (const e of [a, b]) { e.className = e.className.replace(/text-rose-600|dark:text-rose-400/g, ""); e.classList.add("d1-down"); }
  }
  // ── 점검 한 장 진입(머리·차례 행 펼침 공용 1개)
  const entryHtml = (reason) => `<button type="button" data-testid="decision-entry" class="d1-entry" aria-label="점검 차례, ${reason}, 점검하러 가기"><span class="t d1-due">점검 차례 · ${reason}</span>${CHEV_R}</button>`;
  function rowEntry(name, reason) {
    $$(".d1-entry-wrap").forEach((e) => e.remove());
    const row = rowOf(name); const inner = $('[data-slot="collapsible-content"]', row)?.firstElementChild; if (!inner) return console.warn("row closed", name);
    inner.prepend(H(`<div class="d1-entry-wrap">${entryHtml(reason)}</div>`));
  }
  // ── 종목 한 장 머리. spec = null(없음) | { entry: 이유 } | { parts: [html…] }, profit = [금액, 율, 손실?]
  let headOrig = null;
  function head(spec, profit) {
    const h = $('[data-testid="stock-page-head"]'); $$(".d1-h", h).forEach((e) => e.remove());
    const p = $('[data-testid="stock-page-profit"]', h); headOrig ??= { text: p.textContent, cls: p.className };
    p.textContent = profit ? `${profit[0]} (${profit[1]})` : headOrig.text; p.className = headOrig.cls; p.classList.remove("d1-down");
    if (profit?.[2]) { p.className = p.className.replace(/text-rose-600|dark:text-rose-400/g, ""); p.classList.add("d1-down"); }
    if (!spec) return;
    if (spec.entry) return h.append(H(`<div class="d1-h d1-head-entry">${entryHtml(spec.entry)}</div>`));
    const n = spec.parts.length;
    h.append(H(`<p data-testid="stock-page-decision" class="d1-h d1-head">${spec.parts.map((t, i) => `<span class="d1-nw">${t}${i < n - 1 ? ' <span aria-hidden="true">·</span>' : ""}</span>`).join("")}</p>`));
  }
  const since = (label, v) => `${label} ${pct(v)}`;
  const cond = (down, up) => { const a = [down != null ? `−${down}% 이하` : null, up != null ? `+${up}% 이상` : null].filter(Boolean); return `다시 볼 조건 평단 대비 <span class="v">${a.join(" · ")}</span>`; };
  // 320처럼 조건 절이 한 줄에 안 들어가는 폭: 조건 절 안 가운뎃점에서 한 번 더 나눈다
  const condSplit = (down, up) => [`다시 볼 조건 평단 대비 <span class="v">−${down}% 이하</span>`, `<span class="v">+${up}% 이상</span>`];

  // ── 홈 팁. spec = null(상자 없음) | { badge, title, desc }
  function tip(spec) {
    const t = $('[data-testid="home-tip"]'); if (!t) return; if (!spec) return t.remove();
    t.dataset.kind = "due"; $("svg", t).innerHTML = LIST_CHECKS;
    const badge = $("span.rounded", t); badge.textContent = spec.badge;
    $('[data-testid="home-tip-title"]', t).innerHTML = spec.title; t.querySelector("p.mt-1").textContent = spec.desc;
  }
  // ── 내 주식 도구 타일. valueHtml = 값 줄, opt.noTax = 세금 타일 없는 달(1~10월), opt.name
  function tile(valueHtml, { noTax = false, name = "내 자산 점검" } = {}) {
    const g = $('[data-testid="stock-tools"]'); $('[data-testid="stock-tool-grow"]', g)?.remove();
    const x = $('[data-testid="stock-tool-xray"]', g), tax = $('[data-testid="stock-tool-tax"]', g);
    const t = x.cloneNode(true); t.dataset.testid = "stock-tool-grow";
    $("svg", t).innerHTML = LIST_CHECKS; t.children[0].children[1].textContent = name;
    t.children[1].innerHTML = `<span data-testid="stock-tool-grow-value" class="d1-val">${valueHtml}</span>`;
    x.after(t);
    if (noTax) { tax?.remove(); t.classList.add("d1-span2"); } // 3개: 마지막 타일이 모바일 2칸
    else { tax.className = tax.className.replace("col-span-2 lg:col-span-1", ""); g.classList.add("d1-g4"); if (innerWidth < 360) { t.classList.add("d1-span2"); tax.classList.add("d1-span2"); } } // 4개: 2×2, lg 4열. 360 미만은 아래 두 타일이 한 줄씩
  }
  // 값 줄. scope = 범위 낱말(확정안 "주식", 비교안 "")
  const sc = (scope) => (scope ? `${scope} ` : "");
  const V = {
    due: (n, scope = "주식") => `<span class="d1-nw">${sc(scope)}점검 차례 <span class="d1-due" style="font-variant-numeric:tabular-nums">${n}종목</span></span>`,
    labeled: (k, c, scope = "주식") => `<span class="d1-nw">${sc(scope)}장기 보유 <b>${k}</b> ·</span><span class="d1-nw">점검 대상 <b>${c}</b></span>`,
    first: (n, scope = "주식") => `<span class="d1-nw">${sc(scope)}<b>${n}종목</b> ·</span><span class="d1-nw">정하기 전</span>`,
    loading: () => `&nbsp;`,
  };

  // ── 실측
  const lines = (el) => { const cs = getComputedStyle(el); return Math.round(el.getBoundingClientRect().height / parseFloat(cs.lineHeight)); };
  function measureRows() {
    return $$('[data-testid="stock-row-left"]').map((l) => { const row = l.closest('[data-slot="collapsible"]'); const btn = $('[data-slot="collapsible-trigger"]', row); const meta = l.children[1];
      const kids = [...meta.children].filter((c) => c.getBoundingClientRect().width > 0); const tops = new Set(kids.map((c) => Math.round(c.getBoundingClientRect().top + c.getBoundingClientRect().height / 2)));
      return { name: l.firstElementChild.textContent.trim().slice(0, 12), rowH: Math.round(btn.getBoundingClientRect().height * 10) / 10, leftW: Math.round(l.getBoundingClientRect().width), leftH: Math.round(l.getBoundingClientRect().height), metaLines: tops.size, metaW: Math.round(kids.reduce((s, c) => s + c.getBoundingClientRect().width, 0) + (kids.length - 1) * 4), tag: $(".d1-tag.d1-nw", meta)?.textContent ?? "" }; });
  }
  const box = (sel) => { const e = $(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 }; };
  function measureHead() { const p = $(".d1-head"); if (!p && $(".d1-entry")) return { head: box('[data-testid="stock-page-head"]'), entryH: box(".d1-entry").h, entryLines: Math.round($(".d1-entry .t").getBoundingClientRect().height / 20) }; if (!p) return { head: box('[data-testid="stock-page-head"]') }; const tops = new Set([...p.children].map((c) => Math.round(c.getBoundingClientRect().top))); return { head: box('[data-testid="stock-page-head"]'), lines: tops.size, areaW: Math.round(p.getBoundingClientRect().width), parts: [...p.children].map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10), entryH: box(".d1-entry")?.h }; }
  function measureTiles() { return $$('[data-testid="stock-tools"] > button').map((b) => { const v = b.children[1]; const inner = v.firstElementChild; const r = document.createRange(); r.selectNodeContents(b.children[0].children[1]); return { id: b.dataset.testid, w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height), valAreaW: Math.round(v.getBoundingClientRect().width), valH: Math.round(v.getBoundingClientRect().height), nameW: Math.round(r.getBoundingClientRect().width * 10) / 10, parts: inner?.classList.contains("d1-val") ? [...inner.children].map((c) => Math.round(c.getBoundingClientRect().width * 10) / 10) : undefined }; }); }
  function measureTip() { const t = $('[data-testid="home-tip"]'); if (!t) return null; const ti = $('[data-testid="home-tip-title"]', t), d = t.querySelector("p.mt-1"); return { box: box('[data-testid="home-tip"]'), titleLines: lines(ti), descLines: lines(d), descW: (() => { const r = document.createRange(); r.selectNodeContents(d); return Math.round(r.getBoundingClientRect().width * 10) / 10; })(), descArea: Math.round(d.getBoundingClientRect().width) }; }
  function backLabel(t) { const tb = $('[data-testid="top-bar"]'); const w = document.createTreeWalker(tb, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) if (n.nodeValue.trim() === "성과") { n.nodeValue = t; return true; } return false; }
  window.d1 = { backLabel, noChip, tags, rowProfit, rowEntry, head, since, cond, condSplit, pct, tip, tile, V, measureRows, measureHead, measureTiles, measureTip, box, rowOf };
})();
