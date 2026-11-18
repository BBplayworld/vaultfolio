// #242 자산 불리기 확장 — 시각 목업 주입 라이브러리(ui-designer, 2026-11-18). 코드 수정 0.
// 운영(v5.125, main 712d283) 체험 화면의 실제 DOM·실제 클래스 위에 새 요소만 덧붙인다. mock-g7-shot.mjs 가 page.addScriptTag 로 넣고 window.g7(opts)를 부른다.
// 새 요소 스타일은 .g7-* (앱 CSS 변수만 사용). 글자 크기·색은 운영 DOM에 이미 있는 Tailwind 클래스를 그대로 쓴다.
(() => {
  const CSS = `
  .g7-kinds{display:flex;gap:4px;margin-top:-8px!important;margin-bottom:8px!important}
  .g7-kind{all:unset;box-sizing:border-box;position:relative;display:inline-flex;flex:0 1 auto;min-width:min-content;flex-wrap:wrap;align-items:center;justify-content:center;column-gap:4px;min-height:32px;padding:2px 8px;border-radius:16px;color:var(--muted-foreground);white-space:nowrap;cursor:pointer}
  .g7-kind::after{content:"";position:absolute;inset:-4px 0}
  .g7-kind[aria-selected=true]{background:var(--muted);color:var(--foreground);font-weight:600}
  @media (min-width:640px){.g7-kind{padding:2px 12px}}
  .g7-kinds.two{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(0,1fr)}
  .g7-kinds.two .g7-kind{flex-direction:column;flex-wrap:nowrap;gap:0;height:40px;padding:0 4px;border-radius:12px}
  .g7-pick{all:unset;box-sizing:border-box;position:relative;display:flex;width:100%;align-items:flex-start;justify-content:space-between;gap:8px;cursor:pointer;word-break:keep-all;text-wrap:balance}
  .g7-pick::after{content:"";position:absolute;inset:-10px -8px -10px -76px}
  .g7-pick svg{width:16px;height:16px;flex-shrink:0;margin-top:2px;color:var(--muted-foreground)}
  .g7-pick[aria-expanded=true] svg{transform:rotate(180deg)}
  .g7-panel{border-radius:12px;background:color-mix(in oklab,var(--foreground) 6%,transparent);padding:4px 12px 6px}
  .g7-ph{display:flex;align-items:center;gap:6px;min-height:32px}
  .g7-pr{all:unset;box-sizing:border-box;display:grid;grid-template-columns:7rem minmax(0,1fr) 4.5rem;column-gap:8px;align-items:center;min-height:40px;width:calc(100% + 16px);margin:0 -8px;padding:0 8px;border-radius:8px;cursor:pointer}
  .g7-pr[aria-pressed=true]{background:color-mix(in oklab,var(--foreground) 9%,transparent)}
  .g7-pr .l{display:flex;align-items:baseline;gap:6px;min-width:0;white-space:nowrap}
  .g7-pr .v{text-align:right;white-space:nowrap}
  .g7-tally{display:flex;gap:2px;height:8px;min-width:0}
  .g7-tally i{flex:0 0 auto;height:8px;border-radius:2px;background:color-mix(in oklab,var(--foreground) 14%,transparent)}
  .g7-tally i.on{background:color-mix(in oklab,var(--foreground) 60%,transparent)}
  .g7-rail{position:relative}
  .g7-rail::before{content:"";position:absolute;left:-7px;top:10px;bottom:9px;width:2px;border-radius:2px;background:color-mix(in oklab,var(--foreground) 22%,transparent)}
  .g7-sub{all:unset;box-sizing:border-box;display:flex;flex-wrap:wrap;column-gap:4px;padding:6px 0;width:100%;font-size:12px;line-height:16px;font-variant-numeric:tabular-nums;word-break:keep-all;color:var(--muted-foreground);cursor:pointer;position:relative}
  .g7-sub::after{content:"";position:absolute;inset:-6px 0}
  .g7-sub b{color:var(--foreground);font-weight:600}
  .g7-sub span{white-space:nowrap}
  .g7-late{padding:2px 0 6px}
  .g7-next{margin-top:6px;display:flex;flex-wrap:wrap;column-gap:4px}
  .g7-next span{white-space:nowrap}
  .g7-div{height:1px;margin:6px 0 2px;background:var(--border)}
  .g7-pr.buy{min-height:48px}
  .g7-pr.buy .l{display:block;white-space:nowrap}
  .g7-empty{min-height:36px;display:flex;align-items:center}
  @media (max-width:359px){.g7-pr{grid-template-columns:7rem minmax(0,1fr) 4rem;column-gap:6px}}
  .g7-val{border-radius:12px;background:var(--background);box-shadow:inset 0 0 0 1px color-mix(in oklab,var(--foreground) 14%,transparent);padding:10px 12px;display:flex;flex-direction:column;gap:6px}
  .g7-val .r1{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .g7-val .est{display:flex;flex-wrap:wrap;column-gap:6px}
  .g7-val .est span{white-space:nowrap}
  .g7-edit{all:unset;box-sizing:border-box;display:inline-flex;align-items:center;gap:2px;min-height:40px;padding:0 10px 0 12px;border-radius:12px;background:var(--muted);white-space:nowrap;cursor:pointer}
  .g7-edit svg{width:14px;height:14px;color:var(--muted-foreground)}
  .g7-down{color:oklch(70.7% .165 254.624)!important}.g7-downbg{background:oklch(70.7% .165 254.624)!important}
  .g7-note{font-size:10px;line-height:14px;color:oklch(0.8 0.12 85);letter-spacing:0}
  `;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const H = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  const UP = "text-rose-600 dark:text-rose-400", DUE = "text-indigo-600 dark:text-indigo-200";
  const CHEV_D = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  const CHEV_R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>';
  const fp = (v) => `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(1)}%`;
  const tone = (v) => (v > 0 ? UP : v < 0 ? "g7-down" : "text-muted-foreground");
  const infoBtn = () => { const b = $('[data-testid="grow-score-hint"]') ?? $('[data-testid="grow-hint"]'); return b ? b.outerHTML.replace(/data-testid="[^"]*"/, "") : ""; };

  // ── 세그먼트 칸 이름·둘째 줄
  function seg(name, subHtml) { const g = $('[data-testid="report-tab-grow"]'); if (!g) return; if (name) g.children[0].textContent = name; if (subHtml) g.children[1].innerHTML = subHtml; }

  // ── 종류 줄. kinds = [{name, due}], sel = 이름. two = 2줄 칸 비교안
  function kinds(list, sel, two) {
    $(".g7-kinds")?.remove(); if (!list) return;
    const el = H(`<div data-testid="grow-kinds" role="tablist" aria-label="자산 종류" class="g7-kinds${two ? " two" : ""}">${list.map((k) => `<button type="button" role="tab" data-testid="grow-kind" aria-selected="${k.name === sel}" class="g7-kind"><span class="text-sm">${k.name}</span>${k.due && k.name !== sel ? `<span class="text-2xs font-semibold ${DUE}">${typeof k.due === "string" ? k.due : "점검 차례"}</span>` : ""}</button>`).join("")}</div>`);
    $('[data-testid="report-tabs"]').after(el);
  }

  // ── 내 선택 결론 줄. html = 문장, open = 화살표 방향, noPanel = 화살표 없음(muted)
  function pick(html, { open = false, noPanel = false } = {}) {
    const dl = $('[data-testid="grow-summary"]'); $$(".g7-pk", dl).forEach((e) => e.remove()); if (!html) return;
    dl.append(H(`<dt class="g7-pk text-xs text-muted-foreground">내 선택</dt>`));
    dl.append(H(noPanel ? `<dd data-testid="grow-pick" data-state="wait" class="g7-pk min-w-0 tabular-nums break-keep text-muted-foreground" style="text-wrap:balance">${html}</dd>` : `<dd data-testid="grow-pick" class="g7-pk min-w-0 tabular-nums break-keep"><button type="button" data-testid="grow-pick-toggle" aria-expanded="${open}" class="g7-pick"><span>${html}</span>${CHEV_D}</button></dd>`));
  }

  // ── 칸 막대: 칸 1개 = 기록 1번, 채운 칸 = 오름. scale = 한 줄에 들어가는 칸 수(패널 안 최대 N, 최소 8)
  // 칸 폭이 4px 아래로 내려가면(기록이 많거나 화면이 좁을 때) 같은 자리에 이어진 막대로 바꾼다: 길이 = 번 수, 채움 = 오름
  const trackW = () => (innerWidth < 360 ? innerWidth - 272 : Math.min(innerWidth, 640) - 280);
  const tally = (n, up, scale) => ((trackW() - (scale - 1) * 2) / scale < 4
    ? `<span class="g7-tally" aria-hidden="true"><i style="width:${(n / scale) * 100}%;position:relative;overflow:hidden"><i class="on" style="position:absolute;inset:0 auto 0 0;width:${(up / n) * 100}%;border-radius:2px"></i></i></span>`
    : `<span class="g7-tally" aria-hidden="true">${Array.from({ length: n }, (_, i) => `<i class="${i < up ? "on" : ""}" style="width:calc((100% - ${(scale - 1) * 2}px) / ${scale})"></i>`).join("")}</span>`);
  const upText = (n, up, unit = "번") => (up === 0 ? "오름 없음" : up === n && n > 1 ? "모두 오름" : `오름 <b class="font-bold">${up}${unit}</b>`);
  const prow = (r, scale, pressed) => `<button type="button" data-testid="grow-pick-row" aria-pressed="${pressed === r.label}" class="g7-pr"><span class="l"><span class="text-sm font-semibold">${r.label}</span><span class="text-xs text-muted-foreground tabular-nums">${r.n}번</span></span>${tally(r.n, r.up, scale)}<span class="v text-sm tabular-nums">${upText(r.n, r.up)}</span></button>`;

  // ── 내 선택 패널. p = {head, rows:[{label,n,up}], hit:{n,up}(주석 줄), late:K(30일 안 된 기록 수), buy:{n,up}, pressed, fact}
  function panel(p) {
    $(".g7-panel")?.remove(); $(".g7-fact")?.remove(); if (!p) return;
    const rows = (p.rows ?? []).filter((r) => r.n > 0); const scale = Math.max(8, ...rows.map((r) => r.n));
    const h = p.hit; const sub = h && h.n > 0 ? `<span>위 두 가지 중 내 조건에 닿아 점검 <b>${h.n}번</b></span><span aria-hidden="true">·</span><span>${h.up === 0 ? "오름 없음" : `오름 <b>${h.up}번</b>`}</span>` : "";
    const first = rows.filter((r) => r.label === "정함"), rest = rows.filter((r) => r.label !== "정함");
    const top = rows.length === 0 ? `<p data-testid="grow-pick-empty" class="g7-empty text-sm text-muted-foreground break-keep">30일이 지난 기록이 3번 되면 보여요</p>`
      : `${first.map((r) => prow(r, scale, p.pressed)).join("")}${rest.length ? `<div class="${sub ? "g7-rail" : ""}">${rest.map((r) => prow(r, scale, p.pressed)).join("")}${sub ? `<button type="button" data-testid="grow-pick-hit" class="g7-sub text-xs tabular-nums">${sub}</button>` : ""}</div>` : ""}${p.late && rows.length ? `<p data-testid="grow-pick-late" class="g7-late text-xs text-muted-foreground tabular-nums break-keep">30일이 안 된 기록 ${p.late}번은 아직 넣지 않았어요</p>` : ""}`;
    const b = p.buy; const bs = b ? Math.max(8, b.n) : 0;
    const buy = b ? `<div class="g7-div"></div><button type="button" data-testid="grow-pick-buy" aria-pressed="false" class="g7-pr buy"><span class="l"><span class="block text-xs text-muted-foreground">이 앱에 기록한</span><span class="block"><span class="text-sm font-semibold">매수</span> <span class="text-xs text-muted-foreground tabular-nums">${b.n}건</span></span></span>${tally(b.n, b.up, bs)}<span class="v text-sm tabular-nums">${upText(b.n, b.up, "건")}</span></button>` : "";
    const el = H(`<div data-testid="grow-pick-panel" class="g7-panel"><div class="g7-ph"><span class="text-xs font-semibold text-muted-foreground">${p.head ?? "선택한 날 가격보다 오른 횟수"}</span>${infoBtn()}</div>${top}${buy}</div>`);
    $('[data-testid="grow-summary"]').after(el);
    if (p.fact) (($('[data-testid="grow-axes"]') ?? el)).after(H(`<p data-testid="grow-filter-fact" class="g7-fact text-sm tabular-nums text-pretty break-keep">${p.fact}</p>`));
  }

  // ── 주식 행 값 고치기(손실·혼합 주입). edits = {ticker:{rate, since:[라벨, %]|null}}
  function rows(edits) {
    for (const [t, e] of Object.entries(edits)) { const li = $(`[data-testid="grow-row"][data-ticker="${t}"]`); if (!li) continue;
      const r = $('[data-testid="grow-row-rate"]', li); r.dataset.rate = fp(e.rate); r.textContent = fp(e.rate); r.className = r.className.replace(UP, "").trim() + " " + tone(e.rate);
      if (e.since !== undefined) { const s = $('[data-testid="grow-row-since"]', li); if (s) s.innerHTML = `${e.since[0]} <b class="font-semibold text-foreground">${fp(e.since[1])}</b>`; }
      if (e.due === false) { $('[data-testid="grow-row-due"]', li)?.remove(); const m = $("span.flex.min-w-0", li); m.className = m.className.replace("col-span-2", "col-span-3"); } }
    rescale();
  }
  // 행 막대 눈금 다시 잡기(운영 규칙: 10% 단위로 넓힘, 음수가 있으면 0 위치에서 좌우로)
  function rescale() {
    const rs = $$('[data-testid="grow-row-rate"]').map((e) => parseFloat(e.dataset.rate.replace("−", "-"))).filter((v) => !Number.isNaN(v)); if (!rs.length) return;
    const lo = Math.min(0, Math.floor(Math.min(...rs) / 10) * 10), hi = Math.max(10, Math.ceil(Math.max(...rs) / 10) * 10); const X = (v) => ((v - lo) / (hi - lo)) * 100;
    $$('[data-testid="grow-row"]').forEach((li) => { const v = parseFloat($('[data-testid="grow-row-rate"]', li).dataset.rate.replace("−", "-")); const b = $("button > span[aria-hidden] > span", li); if (!b || Number.isNaN(v)) return;
      b.style.left = X(Math.min(0, v)) + "%"; b.style.width = Math.max(X(Math.max(0, v)) - X(Math.min(0, v)), 1.5) + "%"; b.classList.toggle("g7-downbg", v < 0); });
  }
  // ── 종합 카드 숫자·라벨 행
  function card({ label, total, rate, keep, check, noDividend, noAxes } = {}) {
    const c = $('[data-testid="grow-total-card"]');
    if (label) c.firstElementChild.firstElementChild.textContent = label;
    if (total) { const p = $('[data-testid="grow-total"]'); p.children[0].textContent = total; p.children[1].textContent = fp(rate); p.className = p.className.replace(UP, "").trim() + " " + tone(rate); }
    if (keep) $('[data-testid="grow-summary-keep"]').innerHTML = keep; if (check) $('[data-testid="grow-summary-check"]').innerHTML = check;
    if (noDividend) { const d = $('[data-testid="grow-next-dividend"]'); d.previousElementSibling.remove(); d.remove(); }
    if (noAxes) $('[data-testid="grow-axes"]').remove();
  }
  // ── 처음 쓰는 사람: 전부 정하지 않음, 안내 1줄, 라벨 행은 배당만
  function first() {
    const none = $('[data-bucket="none"] ul'); const order = ["360750", "005930", "069500", "000660", "AAPL", "NVDA"];
    order.forEach((t) => { const li = $(`[data-testid="grow-row"][data-ticker="${t}"]`); $('[data-testid="grow-row-due"]', li)?.remove(); const m = $("span.flex.min-w-0", li); m.className = m.className.replace("col-span-2", "col-span-3"); [...m.children].slice(2).forEach((x) => x.remove()); none.append(li); });
    $$('[data-bucket="keep"],[data-bucket="check"]').forEach((b) => b.remove());
    $('[data-bucket="none"] h3 span').textContent = "6 · 눌러서 정해요";
    const dl = $('[data-testid="grow-summary"]'); ["grow-summary-keep", "grow-summary-check"].forEach((id) => { const d = $(`[data-testid="${id}"]`); d.previousElementSibling.remove(); d.remove(); });
    dl.before(H(`<p data-testid="grow-guide" class="text-sm text-pretty break-keep">종목을 누르면 장기 보유·점검 대상을 정할 수 있어요</p>`));
  }

  // ── 목록 새로 그리기(코인·부동산·실물 보기). 운영 행 클래스 그대로
  const ROW = "-mx-2 grid w-[calc(100%+1rem)] grid-cols-[minmax(0,1fr)_4.5rem_3.625rem_0.875rem] items-center gap-x-2 gap-y-0.5 px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150 max-[359px]:grid-cols-[minmax(0,1fr)_3rem_3.625rem_0.875rem] rounded-lg hover:bg-muted/40";
  const DOT = { keep: "bg-foreground/80", check: "bg-foreground/45", none: "ring-[1.5px] ring-foreground/45 ring-inset" };
  const NAME = { keep: "장기 보유", check: "점검 대상", none: "정하지 않음" };
  function rowHtml(r) {
    const chev = $('[data-testid="grow-row-toggle"] svg').outerHTML;
    const meta = r.meta.map((m, i) => `<span class="contents">${i ? '<span aria-hidden="true">·</span>' : ""}<span class="whitespace-nowrap">${m}</span></span>`).join("");
    const bar = r.bar === false ? "" : `<span aria-hidden="true" class="relative block overflow-hidden rounded-full bg-foreground/7 h-2"><span class="absolute inset-y-0 rounded-full bg-rose-500 dark:bg-rose-400" style="left:0%;width:${(r.rate / 40) * 100}%"></span></span>`;
    const rate = r.rate === null ? `<span data-testid="grow-row-rate" data-rate="" class="text-right"></span>` : `<span data-testid="grow-row-rate" data-rate="${fp(r.rate)}" class="text-right text-base font-bold tabular-nums ${tone(r.rate)}">${fp(r.rate)}</span>`;
    return `<li data-testid="grow-row" data-key="${r.key}" data-due="${!!r.due}"><button type="button" data-testid="grow-row-toggle" aria-expanded="${!!r.open}" class="${ROW}${r.open ? " bg-foreground/6 rounded-b-none" : ""}"><span class="min-w-0 text-sm font-semibold text-foreground text-pretty break-keep${r.bar === false ? " col-span-2" : ""}">${r.name}</span>${bar}${rate}${r.open ? chev.replace('class="', 'style="transform:rotate(90deg)" class="') : chev}<span class="flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground tabular-nums ${r.due ? "col-span-2" : "col-span-3"}">${meta}</span>${r.due ? `<span data-testid="grow-row-due" class="whitespace-nowrap text-right text-xs font-semibold ${DUE}">점검 차례</span>` : ""}</button>${r.open ? `<div class="-mx-2"><div class="mb-2 rounded-b-[10px] bg-foreground/6 px-3 pb-3" data-g7="sheet-host"></div></div>` : ""}</li>`;
  }
  function list({ title, cap, caption, buckets, firstUser }) {
    const sec = $('[data-testid="grow-list"]'); const head = sec.firstElementChild; $("span.text-base", head).textContent = title; head.lastElementChild.textContent = cap;
    const c = $('[data-testid="grow-score-caption"]'); if (caption === null) c?.remove();
    $('[data-testid="grow-buckets"]').innerHTML = buckets.filter((b) => b.rows.length).map((b) => `<div data-testid="grow-bucket" data-bucket="${b.k}"><h3 class="flex min-h-7 items-center gap-1.5 text-xs font-semibold text-muted-foreground"><i aria-hidden="true" class="inline-block size-2 rounded-full ${DOT[b.k]}"></i>${NAME[b.k]}<span class="font-medium tabular-nums">${b.rows.length}${b.k === "none" && firstUser ? " · 눌러서 정해요" : ""}</span></h3><ul data-testid="grow-rows">${b.rows.map(rowHtml).join("")}</ul></div>`).join("");
  }
  // ── 부동산·실물 점검 한 장. sheetHtml = 운영 주식 한 장(장기 보유 행)에서 떠 온 DOM
  function reSheet(sheetHtml, v) {
    const host = $('[data-g7="sheet-host"]'); host.innerHTML = sheetHtml; const sh = $('[data-testid="grow-sheet"]', host);
    $('[data-testid="grow-sheet-reason"]', sh).textContent = v.reason;
    const val = H(`<div data-testid="grow-value" class="g7-val"><div class="r1"><span class="min-w-0"><span class="block text-xs text-muted-foreground">${v.label}</span><span data-testid="grow-value-mine" class="block text-base font-bold tabular-nums">${v.value}</span></span><button type="button" data-testid="grow-value-edit" class="g7-edit text-sm font-semibold">${v.edit}${CHEV_R}</button></div>${v.est ? `<p data-testid="grow-value-estimate" class="est text-xs text-muted-foreground tabular-nums"><span>실거래 추정 ${v.est[0]}</span><span aria-hidden="true">·</span><span>${v.est[1]} 기준</span></p>` : ""}</div>`);
    $('[data-testid="grow-sheet-reason"]', sh).after(val);
    const nx = $('[data-testid="grow-choice-next"]', sh); if (nx) { const grid = nx.closest("button").parentElement; nx.remove(); grid.after(H(`<p data-testid="grow-choice-next" class="g7-next text-2xs font-medium text-muted-foreground tabular-nums"><span>그대로 두면 다음 점검은</span><span>${v.next}</span></p>`)); }
    if (v.note) $('[data-testid="grow-value"]', sh).after(H(`<p class="g7-note">${v.note}</p>`));
    const ps = $('[data-testid="grow-plan-summary"]', sh); if (ps) ps.children[1].textContent = v.plan;
    if (!v.keepWarn) $('[data-testid="grow-plan-warn"]', sh)?.remove();
    const hist = $('[data-testid="grow-history"]', sh); if (hist) hist.innerHTML = v.history.length ? `<p class="mb-1 text-xs text-muted-foreground tabular-nums">최근 기록 · 점검 ${v.history.length}번 · 그대로 ${v.history.length}번</p>${v.history.map((h) => `<p data-testid="grow-history-row" class="grid min-h-7 grid-cols-[0.875rem_4rem_minmax(0,1fr)_auto] items-center gap-x-1.5 text-sm"><span aria-hidden="true" class="size-[7px] justify-self-center rounded-full bg-foreground/45"></span><span class="whitespace-nowrap text-muted-foreground tabular-nums">${h[0]}</span><span class="truncate">${h[1]}</span><span></span></p>`).join("")}` : `<p class="text-xs text-muted-foreground">아직 점검 기록이 없어요</p>`;
    sh.lastElementChild.matches("div.flex.min-h-8") && sh.lastElementChild.remove();
    $$("button[aria-label]", sh).forEach((b) => b.setAttribute("aria-label", b.getAttribute("aria-label").replace(/^\S+( \S+)*? (그대로|점검|정하지|장기)/, `${v.name} $2`)));
  }
  // ── 주식 한 장 이력 줄 값(그때 수익률 → 지금까지 / 다음 점검까지)
  function history(vals) { $$('[data-testid="grow-history-row"]').forEach((p, i) => { const s = p.lastElementChild; if (!vals[i]) { s.innerHTML = ""; return; } s.innerHTML = `${vals[i][0]} <b class="text-sm font-bold ${tone(vals[i][1])}">${fp(vals[i][1])}</b>`; }); }

  const measure = () => { const b = (s) => { const e = $(s); return e ? Math.round(e.getBoundingClientRect().bottom) : null; };
    const over = $$('[data-testid="report-tabs"] *, .g7-kinds *, [data-testid="grow-block"] *').filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== "visible" && !e.matches("span[aria-hidden]")).map((e) => (e.dataset.testid ?? e.className.slice(0, 24)) + ":" + e.textContent.slice(0, 16));
    const kr = $(".g7-kinds"); const kinds = kr ? { h: Math.round(kr.getBoundingClientRect().height), w: Math.round(kr.getBoundingClientRect().width), need: $$(".g7-kind", kr).reduce((a, e) => a + Math.ceil(e.getBoundingClientRect().width), 0) + 4 * ($$(".g7-kind", kr).length - 1), right: Math.round(Math.max(...$$(".g7-kind", kr).map((e) => e.getBoundingClientRect().right))) } : null;
    const pk = $('[data-testid="grow-pick"]'); const pickW = pk && $('.g7-pick span', pk) ? [Math.round($('.g7-pick span', pk).getBoundingClientRect().width), Math.round(pk.getBoundingClientRect().width)] : null; const pickLines = pk ? Math.round(pk.getBoundingClientRect().height / 20) : 0;
    const numLines = $$('[data-testid="grow-total-card"] dd, [data-testid="grow-total"], [data-testid="grow-total-card"] > div:first-child').filter((e) => /\d/.test(e.textContent)).length;
    return { vh: innerHeight, docW: document.documentElement.scrollWidth, tabs: b('[data-testid="report-tabs"]'), kinds, card: b('[data-testid="grow-total-card"]'), rowsBottom: $$('[data-testid="grow-row-toggle"]').slice(0, 4).map((e) => Math.round(e.getBoundingClientRect().bottom)), pickLines, pickW, numLines, over, pickL: linesOf(pk), pickArea: pk ? pk.clientWidth : null, head: linesOf($('.g7-ph span')), headW: [textW($('.g7-ph span')), $('.g7-ph') ? $('.g7-ph').clientWidth : null], sub: linesOf($('.g7-sub')), late: linesOf($('.g7-late')), empty: linesOf($('.g7-empty')), next: linesOf($('.g7-next')), panelH: b('.g7-panel') && Math.round($('.g7-panel').getBoundingClientRect().height), sameBtn: (() => { const e = $('[data-g7="sheet-host"] [data-testid="grow-choice-same"]'); return e ? [linesOf(e), Math.round(e.getBoundingClientRect().height)] : null; })() }; };

  // 요소 안 글자를 줄 단위 낱말 배열로(줄바꿈 자리 판정용)
  const linesOf = (el) => { if (!el) return null; const out = new Map(); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const re = /\S+/g; let m; while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); const b = r.getBoundingClientRect(); if (!b.width) continue; const k = Math.round(b.top / 6); out.set(k, [...(out.get(k) ?? []), m[0]]); } } return [...out.entries()].sort((a, b) => a[0] - b[0]).map((e) => e[1].join(" ")); };
  const textW = (el) => { if (!el) return null; const r = document.createRange(); r.selectNodeContents(el); return Math.round(r.getBoundingClientRect().width * 10) / 10; };
  window.g7 = { linesOf, textW, CSS, seg, kinds, pick, panel, rows, rescale, card, first, list, reSheet, history, measure, H, $, $$ };
  const st = document.createElement("style"); st.id = "g7-style"; st.textContent = CSS; document.head.appendChild(st);
})();
