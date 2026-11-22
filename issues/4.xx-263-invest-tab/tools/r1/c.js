/* C안 '사건 카드 중심' — 위: 미니 타임라인(지도), 아래: 크게 빠진 때 카드 스택(이야기 순서). 한 번에 1장 펼침 */
const FFC = {...FF, 2026: 3.75};
let OPEN = Q.get('open') || (WIDE ? 'e07' : null);
const epS = e => e.s[0] + (e.s[1] - 1) / 12, epTt = e => e.t[0] + (e.t[1] - 1) / 12;
function timelineC() {
  const W = WIDE ? 1000 : 326, T1_ = 2026, X = t => (t - Y0) / (T1_ - Y0) * W, S = W / (T1_ - Y0), sel = EP.find(e => e.id === OPEN);
  let s = `<svg id="tlC" viewBox="0 0 ${W} 84" width="100%" style="display:block" role="img" aria-label="1985년부터 올해까지 해마다 등락(회색)과 크게 빠진 때 다섯 곳(파랑)을 한 줄로 보여 주는 지도">`;
  if (sel) { const a = X(epS(sel)) - 5, b = X(Math.min(epS(sel) + sel.rec / 12, T1_)) + 5; s += `<rect x="${a}" y="0" width="${b - a}" height="62" rx="8" fill="var(--brandsoft)"/>`; }
  for (let y = Y0; y <= 2025; y++) { const v = SPX[y], h = Math.max(1, Math.abs(v) * .5); s += `<rect x="${(X(y) + S * .2).toFixed(1)}" y="${v >= 0 ? 26 - h : 26}" width="${(S * .6).toFixed(1)}" height="${h.toFixed(1)}" rx="1" fill="var(--ink3)"/>`; }
  s += `<line x1="0" x2="${W}" y1="26" y2="26" stroke="var(--ink3)"/>`;
  EP.forEach(e => { const a = X(epS(e)), w = Math.max(8, X(epTt(e)) - a), rw = X(Math.min(epS(e) + e.rec / 12, T1_)) - a, on = OPEN === e.id;
    s += `<rect x="${a}" y="42" width="${Math.max(w, rw)}" height="12" rx="6" fill="var(--loss)" opacity=".22"/><rect x="${a}" y="42" width="${w}" height="12" rx="6" fill="var(--loss)" ${on ? 'stroke="var(--brand)" stroke-width="2"' : ''}/>`; });
  s += `<text x="0" y="80" font-size="11" fill="var(--mf)">${Y0}</text><text x="${W}" y="80" text-anchor="end" font-size="11" fill="var(--mf)">올해</text>`;
  return s + '</svg>';
}
function miniChart(e) {
  const a0 = epS(e) - .5, b0 = Math.max(epS(e) + e.rec / 12, epTt(e)) + .5, W = WIDE ? 440 : 326, H = 96, H2 = 34, X = t => (t - a0) / (b0 - a0) * W;
  const i0 = Math.max(0, Math.floor((a0 - Y0) * 12)), i1 = Math.min(NM - 1, Math.ceil((b0 - Y0) * 12));
  let mn = Infinity, mxx = 0; for (let i = i0; i <= i1; i++) { mn = Math.min(mn, MI[i]); mxx = Math.max(mxx, MI[i]); }
  const Yy = v => 24 + (1 - (Math.log(v) - Math.log(mn * .96)) / (Math.log(mxx * 1.04) - Math.log(mn * .96))) * (H - 44), ix = i => X(Y0 + (i + .5) / 12);
  let d = ''; for (let i = i0; i <= i1; i++) d += (i === i0 ? 'M' : 'L') + `${ix(i).toFixed(1)},${Yy(MI[i]).toFixed(1)}`;
  const si = (e.s[0] - Y0) * 12 + e.s[1] - 1, ti = (e.t[0] - Y0) * 12 + e.t[1] - 1, ri = Math.min(NM - 1, si + e.rec), pk = MI[si];
  let seg = ''; for (let i = si; i <= ti; i++) seg += (i === si ? 'M' : 'L') + `${ix(i).toFixed(1)},${Yy(MI[i]).toFixed(1)}`;
  let r = '', yrs = []; for (let y = Math.floor(a0); y <= Math.ceil(b0); y++) yrs.push(y);
  const RY = v => H + 22 + H2 - v / 9 * H2; yrs.forEach((y, k) => { const xa = Math.max(0, X(y)), xb = Math.min(W, X(y + 1)); if (xb <= 0 || xa >= W) return; r += (r ? 'L' : 'M') + `${xa.toFixed(1)},${RY(FFC[y]).toFixed(1)}L${xb.toFixed(1)},${RY(FFC[y]).toFixed(1)}`; });
  return `<svg viewBox="0 0 ${W} ${H + H2 + 30}" width="100%" role="img" aria-label="${e.ev} 구간의 지수와 기준금리" style="display:block;margin-top:10px">
  <text x="0" y="9" font-size="11" fill="var(--mf)">지수</text>
  <line x1="${ix(si)}" x2="${Math.min(W, ix(ri))}" y1="${Yy(pk)}" y2="${Yy(pk)}" stroke="var(--ink3)" stroke-dasharray="3 3"/>
  <path d="${d}" fill="none" stroke="var(--fg)" stroke-opacity=".75" stroke-width="1.6" stroke-linejoin="round"/><path d="${seg}" fill="none" stroke="var(--loss)" stroke-width="3.2" stroke-linecap="round"/>
  <circle cx="${ix(si)}" cy="${Yy(pk)}" r="4" fill="var(--card)" stroke="var(--fg)" stroke-width="1.6"/><circle cx="${ix(ti)}" cy="${Yy(MI[ti])}" r="4.5" fill="var(--loss)" stroke="var(--card)" stroke-width="2"/>${ri < NM ? `<circle cx="${Math.min(W - 4, ix(ri))}" cy="${Yy(MI[ri])}" r="4" fill="var(--card)" stroke="var(--fg)" stroke-width="1.6"/>` : ''}
  <text x="${Math.min(Math.max(ix(si), 14), W - 30)}" y="${Yy(pk) - 8}" text-anchor="middle" font-size="11" fill="var(--mf)">고점</text><text x="${Math.min(Math.max(ix(ti), 14), W - 14)}" y="${Yy(MI[ti]) + 17}" text-anchor="middle" font-size="11" fill="var(--mf)">바닥</text><text x="${Math.min(ix(ri), W - 4)}" y="${Yy(MI[ri]) - 8}" text-anchor="end" font-size="11" fill="var(--mf)">전고점 되찾음</text>
  <text x="0" y="${H + 14}" font-size="11" fill="var(--mf)">미국 기준금리</text><path d="${r}" fill="none" stroke="var(--fg)" stroke-opacity=".78" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
}
function detail(e) {
  return `<div class="fadein"><div class="stats"><div><div class="t2xs mf">낙폭</div><div class="tlg b dn">${fp(e.d)}</div></div><div><div class="t2xs mf">바닥까지</div><div class="tlg b">${e.toT}개월</div></div><div><div class="t2xs mf">전고점까지</div><div class="tlg b">${e.rec}개월</div></div></div>
  <div class="txs mf" style="margin-top:4px">${e.s[0]}.${String(e.s[1]).padStart(2, '0')} 고점 ~ ${e.t[0]}.${String(e.t[1]).padStart(2, '0')} 바닥</div>${miniChart(e)}
  <div style="display:flex;align-items:center;gap:8px;margin-top:10px" class="tsm"><span class="mf txs">그때 금리</span><i class="sw ${e.dir > 0 ? 'up' : 'dn'}-s"></i><b class="sb">${EPDIR(e)}</b><span class="txs mf">${fmtR(e.rf)}에서 ${fmtR(e.rt)}로</span></div>
  <div class="txs pre" style="margin-top:8px"><span class="mf">같은 시기 사건 </span>${e.fact}</div></div>`;
}
function stack() {
  return EP.map(e => { const on = OPEN === e.id;
    return `<div class="ec card ${on ? 'open' : ''}" data-testid="drop-card"><button class="eh" data-open="${e.id}" aria-expanded="${on}" aria-controls="d-${e.id}"><span class="en sb">${e.ev}</span><span class="bar" aria-hidden="true"><i style="width:${Math.abs(e.d) / 60 * 100}%"></i></span><span class="er"><i class="sw ${e.dir > 0 ? 'up' : 'dn'}-s"></i>${e.dir > 0 ? '올리던 중' : '내리던 중'}</span><span class="cv" aria-hidden="true">${on ? '⌃' : '⌄'}</span></button>${on && !WIDE ? `<div id="d-${e.id}" class="ed">${detail(e)}</div>` : ''}</div>`; }).join('');
}
function render() {
  $('#tlbox').innerHTML = timelineC(); $('#stack').innerHTML = stack();
  if (WIDE) { const e = EP.find(x => x.id === OPEN); $('#pane').innerHTML = e ? `<div class="tbase b" style="font-size:16px;margin-bottom:2px">${e.ev}</div>${detail(e)}` : ''; }
  document.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { OPEN = OPEN === b.dataset.open && !WIDE ? null : b.dataset.open; render(); });
  $('#tlC').onpointerdown = ev => { const r = $('#tlC').getBoundingClientRect(), t = Y0 + (ev.clientX - r.left) / r.width * (2026 - Y0); let best = null, bd = 1e9; EP.forEach(e => { const dd = Math.abs(t - (epS(e) + epTt(e)) / 2); if (dd < bd) { bd = dd; best = e; } }); if (bd < 1.6) { OPEN = best.id; render(); } };
}
const st = document.createElement('style'); st.textContent = `.stack{display:flex;flex-direction:column;gap:8px}.ec{padding:0;overflow:hidden}.eh{width:100%;min-height:56px;display:grid;grid-template-columns:1fr 64px auto 16px;gap:12px;align-items:center;padding:8px 16px;text-align:left}.en{font-size:14px;line-height:1.3}
.bar{height:8px;border-radius:4px;background:var(--sec);display:block;overflow:hidden}.bar i{display:block;height:100%;background:var(--loss);border-radius:4px}
.er{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--mf);white-space:nowrap}.cv{color:var(--mf);font-size:14px}.ed{padding:0 16px 16px}.ec.open .eh{padding-bottom:4px}
.stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px}
${WIDE ? '.wide .head1{font-size:20px}.wide .stack{gap:8px}.wide .eh{grid-template-columns:1fr 120px auto 16px}.ec.open{box-shadow:0 0 0 2px var(--brand)}.pane{background:var(--card);border-radius:20px;padding:20px;box-shadow:var(--shadow);position:sticky;top:8px}.dark .pane{box-shadow:none}' : ''}`; document.head.appendChild(st);
mount(m => {
  const hd = document.createElement('div'); hd.innerHTML = IDXSEL() + HEAD({ base: false }); const [h1, h2] = [...hd.children];
  const s1 = document.createElement('section'); s1.id = 'sec1'; s1.dataset.testid = 'invest-sec1';
  s1.innerHTML = `<div class="card"><div class="sec-t">시장 흐름 <small>회색은 해마다 등락, 파랑은 크게 빠진 때</small></div><div id="tlbox"></div><div class="txs mf" style="margin-top:6px">옅은 파랑은 바닥에서 전고점을 되찾기까지예요.</div></div>`;
  const s2 = document.createElement('section'); s2.id = 'sec2'; s2.dataset.testid = 'invest-sec2';
  s2.innerHTML = `<div class="sec-t" style="padding:0 4px">크게 빠진 때 <small>눌러서 펼쳐 보세요</small></div>${WIDE ? '<div style="display:grid;grid-template-columns:1fr 480px;gap:24px;align-items:start"><div><div class="stack" id="stack"></div>' : '<div class="stack" id="stack"></div><div style="padding:0 4px">'}${LEGEND()}<p class="txs mf" style="margin-top:10px">같은 기간 금리를 내리던 때는 ${NDN}년, 올리던 때는 ${NUP}년이었어요.</p>${SEC2NOTE}<p class="note">'바닥까지'·'전고점까지'는 고점 달부터 센 기간이에요. '그때 금리'는 고점 달부터 바닥 달까지 기준금리가 오른 쪽인지 내린 쪽인지예요.</p>${WIDE ? '</div><div class="pane" id="pane"></div></div>' : '</div>'}`;
  m.append(h1, h2, s1, s2);
  if (WIDE) { m.querySelector('#sec2 .sec-t'); }
  m.append(sec3('C')); const f = document.createElement('div'); f.innerHTML = FOOT(); m.append(...f.children); render();
});
