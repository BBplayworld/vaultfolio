/* A안 '하나의 타임라인' — 같은 연도축에 등락 막대·사건 점·금리 계단을 쌓고 세로 커서로 그해 카드 */
const YE = 2026, NYC = YE - Y0 + 1; // 올해(2026) 빗금 칸 포함
const SP = {...SPX, 2026: 11.2}, FFA = {...FF, 2026: 3.75};
let SEL = Q.get('sel') ? +Q.get('sel') : null;
const sw = (k) => `<i class="sw ${k}-s"></i>`;
function chartA() {
  const W = WIDE ? 612 : 326, X = y => (y - Y0) / NYC * W, S = W / NYC, bw = Math.max(4, S * .62);
  const T1 = 20, B0 = T1 + 54, S1 = 1.38, T2 = 144, T3 = 190, H3 = 48, AX = 262, BOT = T3 + H3 + 4;
  let s = `<svg id="chA" viewBox="0 0 ${W} ${AX + 6}" width="100%" style="display:block;touch-action:pan-y;user-select:none" role="img" aria-label="해마다 지수 등락, 사건, 미국 기준금리를 같은 연도축에 쌓은 그림">
  <defs><pattern id="hat" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="var(--mf)" opacity=".55"/></pattern></defs>
  <text x="0" y="11" font-size="11" fill="var(--mf)">해마다 등락</text><text x="0" y="${T2 - 8}" font-size="11" fill="var(--mf)">사건</text><text x="0" y="${T3 - 8}" font-size="11" fill="var(--mf)">미국 기준금리</text>`;
  if (SEL) s += `<rect x="${X(SEL) - 1}" y="${T1 - 2}" width="${S + 2}" height="${BOT - T1 + 4}" rx="4" fill="var(--brandsoft)"/><line x1="${X(SEL) + S / 2}" x2="${X(SEL) + S / 2}" y1="${T1 - 2}" y2="${BOT + 2}" stroke="var(--brand)" stroke-width="1.5"/>`;
  s += `<line x1="0" x2="${W}" y1="${B0}" y2="${B0}" stroke="var(--ink3)"/>`;
  for (let y = Y0; y <= YE; y++) {
    const v = SP[y], h = Math.max(1, Math.abs(v) * S1), x = X(y) + (S - bw) / 2, ytop = v >= 0 ? B0 - h : B0, dim = SEL && SEL !== y ? .42 : .92, part = y === YE;
    s += `<rect x="${x.toFixed(1)}" y="${ytop.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${part ? 'url(#hat)' : (v >= 0 ? 'var(--profit)' : 'var(--loss)')}" ${part ? `stroke="${v >= 0 ? 'var(--profit)' : 'var(--loss)'}" stroke-dasharray="2 2"` : ''} opacity="${dim}"/>`;
  }
  s += `<line x1="0" x2="${W}" y1="${T2 + 12}" y2="${T2 + 12}" stroke="var(--hair)"/>`;
  EV.forEach(e => { const cx = X(e.y + (e.m - .5) / 12), on = SEL === e.y; s += `<circle cx="${cx.toFixed(1)}" cy="${T2 + 12}" r="${on ? 5.5 : 4}" fill="${on ? 'var(--fg)' : 'var(--card)'}" stroke="var(--fg)" stroke-width="1.6" opacity="${SEL && !on ? .45 : 1}"><title>${e.n}</title></circle>`; });
  let d = ''; for (let y = Y0; y <= YE; y++) { const a = X(y), b = X(y + 1), vy = (T3 + H3 - FFA[y] / 9 * H3).toFixed(1); d += (y === Y0 ? `M${a.toFixed(1)},${vy}` : `L${a.toFixed(1)},${vy}`) + `L${b.toFixed(1)},${vy}`; }
  s += `<path d="${d}L${W},${T3 + H3}L0,${T3 + H3}Z" fill="var(--fg)" opacity=".06"/><path d="${d}" fill="none" stroke="var(--fg)" stroke-opacity=".78" stroke-width="1.8" stroke-linejoin="round"/>`;
  if (SEL) { const vy = T3 + H3 - FFA[SEL] / 9 * H3; s += `<circle cx="${(X(SEL) + S / 2).toFixed(1)}" cy="${vy.toFixed(1)}" r="4" fill="var(--brand)" stroke="var(--card)" stroke-width="2"/>`; }
  s += `<text x="0" y="${AX}" font-size="11" fill="var(--mf)">${Y0}</text><text x="${W}" y="${AX}" text-anchor="end" font-size="11" fill="var(--mf)">올해</text>`;
  for (let y = Y0; y <= YE; y += 5) s += `<line x1="${X(y) + S / 2}" x2="${X(y) + S / 2}" y1="${AX - 14}" y2="${AX - 10}" stroke="var(--ink3)"/>`;
  return s + '</svg>';
}
function cardA() {
  if (!SEL) return `<div class="yc"><div style="display:flex;align-items:center;gap:8px"><div class="txs mf pre" style="flex:1">연도를 누르거나 좌우로 끌어 보세요. 그해 등락·금리·사건이 여기에 떠요.</div><button class="btn40" data-d="-1" aria-label="이전 해" disabled style="opacity:.4">‹</button><button class="btn40" data-d="1" aria-label="다음 해">›</button></div></div>`;
  const y = SEL, ev = evOf(y), part = y === YE, v = SP[y];
  return `<div class="yc fadein" data-testid="year-card"><div style="display:flex;align-items:center;gap:8px"><div class="tlg b" style="flex:1">${y}년 ${part ? '<span class="chip" style="margin-left:6px">올해 · 11/21까지</span>' : ''}</div><button class="btn40" data-d="-1" aria-label="이전 해">‹</button><button class="btn40" data-d="1" aria-label="다음 해">›</button></div>
  <div class="t2xl b ${v >= 0 ? 'up' : 'dn'}" style="margin:6px 0 10px">${fp(v)}</div>
  <div class="rowk"><span class="mf">기준금리</span><span>${fmtR(FFA[y - 1])}에서 ${fmtR(FFA[y])}로 <span class="mf">· ${ydTxt(y)}</span></span></div>
  <div class="rowk"><span class="mf">사건</span><span class="pre">${ev.length ? ev.map(e => `<b class="sb">${e.n}</b><br><span class="mf txs">${e.f}</span>`).join('<br>') : '<span class="mf">표시한 사건이 없어요</span>'}</span></div>
  ${part ? `<div class="rowk"><span class="mf"></span><span class="txs mf">올해는 진행 중이라 위 집계에서 빼요 · <span style="color:var(--brand);font-weight:600">내 종목과 비교 ›</span></span></div>` : ''}</div>`;
}
function sec2A() {
  const rows = EP.map(e => `<div class="tr" data-testid="drop-row"><div class="g5"><div class="sb">${String(e.s[0]).slice(2)}.${String(e.s[1]).padStart(2,'0')}<span class="mf">~${e.t[0] !== e.s[0] ? String(e.t[0]).slice(2) + '.' : ''}${String(e.t[1]).padStart(2,'0')}</span></div><div class="b dn">${fp(e.d)}</div><div>${e.toT}개월</div><div>${e.rec}개월</div><div style="display:flex;align-items:center;gap:5px">${sw(e.dir > 0 ? 'up' : 'dn')}<span>${e.dir > 0 ? '올림' : '내림'}</span></div></div><div class="txs mf pre" style="margin-top:4px"><b class="sb" style="color:var(--fg)">${e.ev}</b> · ${e.fact}</div></div>`).join('');
  return `<section id="sec2" data-testid="invest-sec2"><div class="card"><div class="sec-t">크게 빠진 때 <small>빠진 때를 전부 보여 드려요</small></div>
  <div class="g5 th txs mf"><div>기간</div><div>낙폭</div><div>바닥까지</div><div>전고점까지</div><div>그때 금리</div></div>${rows}${LEGEND()}${SEC2NOTE}<p class="note">'바닥까지'·'전고점까지'는 고점 달부터 센 기간이에요. '그때 금리'는 고점 달부터 바닥 달까지 기준금리가 오른 쪽인지 내린 쪽인지예요.</p></div></section>`;
}
function render() {
  $('#chartbox').innerHTML = chartA(); $('#ycbox').innerHTML = cardA();
  $('#chartbox svg').addEventListener('pointerdown', pick); $('#chartbox svg').addEventListener('pointermove', e => { if (e.buttons) pick(e); });
  document.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { SEL = Math.min(YE, Math.max(Y0, (SEL || 2007) + +b.dataset.d)); render(); });
}
function pick(e) { const r = $('#chA').getBoundingClientRect(); const y = Y0 + Math.floor((e.clientX - r.left) / r.width * NYC); SEL = Math.min(YE, Math.max(Y0, y)); render(); }
const st = document.createElement('style'); st.textContent = `.yc{margin-top:12px;background:var(--sec);border-radius:16px;padding:12px 12px 14px}.rowk{display:grid;grid-template-columns:56px 1fr;gap:8px;font-size:14px;margin-top:8px;line-height:1.4}
.g5{display:grid;grid-template-columns:${WIDE ? '120px 90px 90px 110px 1fr' : '74px 52px 44px 58px 1fr'};gap:6px;align-items:center;font-size:12px}.th{padding-bottom:8px;box-shadow:0 1px 0 var(--hair);font-size:11px}.tr{padding:11px 0;box-shadow:0 1px 0 var(--hair)}.tr:last-of-type{box-shadow:none}.tr .g5{font-size:${WIDE ? 14 : 12}px}${WIDE ? '.g2{display:grid;grid-template-columns:1fr 360px;gap:24px;align-items:start}.wide .yc{margin-top:0;position:sticky;top:8px}.wide .head1{font-size:20px}' : ''}`; document.head.appendChild(st);
mount(m => {
  const hd = document.createElement('div'); hd.innerHTML = IDXSEL() + HEAD(); const [h1, h2] = [...hd.children];
  const s1 = document.createElement('section'); s1.id = 'sec1'; s1.dataset.testid = 'invest-sec1';
  s1.innerHTML = WIDE ? `<div class="card"><div class="sec-t">시장 흐름 <small>해마다 · 같은 연도축</small></div><div class="g2"><div id="chartbox"></div><div id="ycbox"></div></div></div>` : `<div class="card"><div class="sec-t">시장 흐름 <small>해마다 · 같은 연도축</small></div><div id="chartbox"></div><div id="ycbox"></div></div>`;
  m.append(h1, h2, s1); // 선택기, 머리
  const s2 = document.createElement('div'); s2.innerHTML = sec2A();
  if (WIDE) { const g = document.createElement('div'); g.className = 'g2'; g.style.gridTemplateColumns = '1fr 400px'; g.append(s2.firstChild, sec3('A')); m.append(g); } else m.append(s2.firstChild, sec3('A'));
  const f = document.createElement('div'); f.innerHTML = FOOT(); m.append(...f.children);
  render();
});
