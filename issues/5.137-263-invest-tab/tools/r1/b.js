/* B안 '국면 띠' — 위: 지수 흐름, 가운데: 크게 빠진 구간(낙폭 막대 + 회복 막대), 아래: 금리 국면 별도 띠. 관계를 '구간'으로 읽게 */
const T0 = Y0, T1 = 2026, SPAN = T1 - T0;
let EPSEL = Q.get('ep') || null;
const epT = e => ({ s: e.s[0] + (e.s[1] - 1) / 12, t: e.t[0] + (e.t[1] - 1) / 12 });
const epR = e => epT(e).s + e.rec / 12;
const sw2 = k => `<i class="sw ${k}-s"></i>`;
function chartB() {
  const W = WIDE ? 984 : 326, tx = t => (t - T0) / SPAN * W, LO = Math.log(150), HI = Math.log(7300);
  const R1 = 18, H1 = 104, R2 = 150, H2 = 40, R3 = 214, H3 = 16, AX = R3 + H3 + 16;
  const ly = v => R1 + H1 - (Math.log(v) - LO) / (HI - LO) * H1, ix = i => tx(T0 + (i + .5) / 12);
  const seg = (a, b) => { let d = ''; for (let i = a; i <= Math.min(b, NM - 1); i++) d += (i === a ? 'M' : 'L') + `${ix(i).toFixed(1)},${ly(MI[i]).toFixed(1)}`; return d; };
  const sel = EP.find(e => e.id === EPSEL);
  let s = `<svg id="chB" viewBox="0 0 ${W} ${AX + 6}" width="100%" style="display:block;touch-action:pan-y;user-select:none" role="img" aria-label="지수 흐름, 크게 빠진 구간, 금리 국면을 세 줄로 나눈 그림">
  <defs><pattern id="hb" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="var(--fg)" opacity=".5"/></pattern></defs>
  <text x="0" y="11" font-size="11" fill="var(--mf)">지수 흐름</text><text x="0" y="${R2 - 8}" font-size="11" fill="var(--mf)">크게 빠진 구간</text><text x="0" y="${R3 - 8}" font-size="11" fill="var(--mf)">기준금리 국면</text>`;
  if (sel) { const a = tx(epT(sel).s) - 4, b = tx(Math.min(epR(sel), T1)) + 4; s += `<rect x="${a}" y="${R1 - 4}" width="${b - a}" height="${R3 + H3 - R1 + 8}" rx="6" fill="var(--brandsoft)"/><rect x="${a}" y="${R1 - 4}" width="${b - a}" height="2" rx="1" fill="var(--brand)"/>`; }
  const all = seg(0, NM - 1);
  s += `<path d="${all}L${ix(NM - 1)},${R1 + H1}L${ix(0)},${R1 + H1}Z" fill="var(--fg)" opacity=".05"/><path d="${all}" fill="none" stroke="var(--fg)" stroke-opacity=".8" stroke-width="1.6" stroke-linejoin="round"/>`;
  EP.forEach(e => { const si = (e.s[0] - Y0) * 12 + e.s[1] - 1, ti = (e.t[0] - Y0) * 12 + e.t[1] - 1, ri = Math.min(NM - 1, si + e.rec); const on = !sel || sel.id === e.id;
    s += `<path d="${seg(ti, ri)}" fill="none" stroke="var(--loss)" stroke-width="1.8" stroke-dasharray="3 2.5" opacity="${on ? .75 : .3}"/><path d="${seg(si, ti)}" fill="none" stroke="var(--loss)" stroke-width="3.2" stroke-linecap="round" opacity="${on ? 1 : .35}"/>`;
    const a = tx(epT(e).s), tw = Math.max(6, tx(epT(e).t) - a), rw = tx(Math.min(epR(e), T1)) - tx(epT(e).t), h = Math.abs(e.d) / 60 * H2;
    s += `<rect x="${a}" y="${R2}" width="${tw}" height="${h}" rx="2" fill="var(--loss)" opacity="${on ? 1 : .35}"/><rect x="${a + tw}" y="${R2}" width="${Math.max(2, rw - (tw - (tx(epT(e).t) - a)))}" height="${h}" rx="2" fill="var(--loss)" opacity="${on ? .28 : .12}"/>`; });
  s += `<line x1="0" x2="${W}" y1="${R2 - .5}" y2="${R2 - .5}" stroke="var(--ink3)"/>`;
  PH.forEach(p => { const a = tx(p.a), b = tx(Math.min(p.b, T1)); const f = p.k === 'U' ? 'var(--ink2)' : p.k === 'F' ? 'var(--ink3)' : 'url(#hb)';
    s += `<rect x="${a.toFixed(1)}" y="${R3}" width="${(b - a).toFixed(1)}" height="${H3}" fill="${f}" ${p.k === 'D' ? 'stroke="var(--ink3)"' : ''} stroke-width="1"/>`; });
  s += `<rect x="0" y="${R3}" width="${W}" height="${H3}" rx="4" fill="none"/><text x="0" y="${AX}" font-size="11" fill="var(--mf)">${Y0}</text><text x="${tx(2005)}" y="${AX}" text-anchor="middle" font-size="11" fill="var(--mf)">2005</text><text x="${W}" y="${AX}" text-anchor="end" font-size="11" fill="var(--mf)">올해</text>`; for (let y = 1990; y <= 2020; y += 5) s += `<line x1="${tx(y)}" x2="${tx(y)}" y1="${R3 + H3 + 2}" y2="${R3 + H3 + 6}" stroke="var(--ink3)"/>`;
  return s + '</svg>';
}
function chipsB() { return `<div class="chips" role="tablist" aria-label="크게 빠진 구간 고르기">${EP.map(e => `<button class="ch ${EPSEL === e.id ? 'on' : ''}" role="tab" aria-selected="${EPSEL === e.id}" data-ep="${e.id}">${e.short}</button>`).join('')}</div>`; }
function zoomBand(e) { const a = epT(e).s, b = epT(e).t + 1 / 12, W = 100, ps = PH.filter(p => p.b > a && p.a < b);
  return `<svg viewBox="0 0 100 14" width="100%" height="14" preserveAspectRatio="none" role="img" aria-label="그때 금리 국면" style="display:block"><defs><pattern id="hz" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="var(--fg)" opacity=".5"/></pattern></defs>${ps.map(p => { const x1 = (Math.max(p.a, a) - a) / (b - a) * W, x2 = (Math.min(p.b, b) - a) / (b - a) * W; return `<rect x="${x1}" y="0" width="${x2 - x1}" height="14" fill="${p.k === 'U' ? 'var(--ink2)' : p.k === 'F' ? 'var(--ink3)' : 'url(#hz)'}"/>`; }).join('')}</svg>`; }
function cardB() {
  const e = EP.find(x => x.id === EPSEL);
  if (!e) return `<div class="yc"><div class="txs mf pre">위 구간 이름을 눌러 보세요. 그 구간의 낙폭·회복·금리·사건이 여기에 떠요.</div></div>`;
  const seq = [...new Set(PH.filter(p => p.b > epT(e).s && p.a < epT(e).t + 1 / 12).map(p => p.k))].map(k => PHN[k]).join(', 이어서 ');
  return `<div class="yc fadein" data-testid="episode-card"><div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><div class="tlg b">${e.ev}</div><div class="txs mf">${e.s[0]}.${String(e.s[1]).padStart(2, '0')} ~ ${e.t[0]}.${String(e.t[1]).padStart(2, '0')}</div></div>
  <div class="t2xl b dn" style="margin:4px 0 10px">${fp(e.d)}</div>
  <div class="trio"><div><div class="t2xs mf">고점에서 바닥까지</div><div class="sb">${e.toT}개월</div></div><div><div class="t2xs mf">고점에서 전고점까지</div><div class="sb">${e.rec}개월</div></div><div><div class="t2xs mf">그때 금리</div><div class="sb">${e.dir > 0 ? '올림' : '내림'} <span class="txs mf">${fmtR(e.rf)}에서 ${fmtR(e.rt)}로</span></div></div></div>
  <div style="margin-top:12px" class="t2xs mf">고점에서 바닥까지 기준금리 국면</div><div style="margin-top:4px;border-radius:5px;overflow:hidden">${zoomBand(e)}</div><div class="txs mf" style="margin-top:4px">${seq}</div>
  <div style="margin-top:10px" class="txs pre"><span class="mf">사건 </span>${e.fact}</div></div>`;
}
function sec2B() {
  const rows = EP.map(e => `<div class="tr2" data-testid="drop-row"><div style="display:flex;align-items:baseline;gap:8px"><div class="sb" style="flex:1">${e.ev} <span class="mf txs" style="font-weight:400">${String(e.s[0]).slice(2)}.${String(e.s[1]).padStart(2, '0')}~${e.t[0] !== e.s[0] ? String(e.t[0]).slice(2) + '.' : ''}${String(e.t[1]).padStart(2, '0')}</span></div><div class="b dn">${fp(e.d)}</div></div>
  <div style="display:flex;height:10px;margin-top:8px;border-radius:5px;overflow:hidden;background:var(--sec)"><div style="width:${e.toT / 86 * 100}%;background:var(--loss);min-width:4px"></div><div style="width:${(e.rec - e.toT) / 86 * 100}%;background:var(--loss);opacity:.28"></div></div>
  <div class="txs mf" style="display:flex;justify-content:space-between;margin-top:4px"><span>바닥까지 ${e.toT}개월</span><span>전고점까지 ${e.rec}개월</span></div>
  <div style="display:flex;align-items:center;gap:6px;margin-top:6px" class="txs">${sw2(e.dir > 0 ? 'up' : 'dn')}<span>그때 금리 ${e.dir > 0 ? '올림' : '내림'}</span></div><div class="txs mf pre" style="margin-top:4px">${e.fact}</div></div>`).join('');
  return `<section id="sec2" data-testid="invest-sec2"><div class="card"><div class="sec-t">크게 빠진 때 <small>빠진 때를 전부 보여 드려요</small></div>${rows}
  <div class="txs mf" style="display:flex;gap:14px;margin-top:12px"><span style="display:inline-flex;gap:6px;align-items:center"><i class="sw" style="background:var(--loss)"></i>바닥까지</span><span style="display:inline-flex;gap:6px;align-items:center"><i class="sw" style="background:var(--loss);opacity:.28"></i>바닥에서 전고점까지</span></div>${LEGEND()}
  <p class="txs mf" style="margin-top:10px">같은 기간(${NTOT}년) 금리를 내리던 때는 ${NDN}년, 올리던 때는 ${NUP}년이었어요.</p>${SEC2NOTE}<p class="note">'바닥까지'·'전고점까지'는 고점 달부터 센 기간이에요. '그때 금리'는 고점 달부터 바닥 달까지 기준금리가 오른 쪽인지 내린 쪽인지예요.</p></div></section>`;
}
function render() {
  $('#chartbox').innerHTML = chartB(); $('#chipbox').innerHTML = chipsB(); $('#ycbox').innerHTML = cardB();
  document.querySelectorAll('[data-ep]').forEach(b => b.onclick = () => { EPSEL = EPSEL === b.dataset.ep ? null : b.dataset.ep; render(); });
  $('#chB').addEventListener('pointerdown', ev => { const r = $('#chB').getBoundingClientRect(), t = T0 + (ev.clientX - r.left) / r.width * SPAN; const e = EP.find(x => t >= epT(x).s - .6 && t <= epR(x) + .3); if (e) { EPSEL = e.id; render(); } });
}
const st = document.createElement('style'); st.textContent = `.chips{display:flex;gap:8px;overflow-x:auto;margin:12px -16px 0;padding:0 16px 2px;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,#000 92%,transparent)}.chips::-webkit-scrollbar{display:none}
.ch{flex:none;height:40px;padding:0 14px;border-radius:999px;background:var(--sec);font-size:13px;font-weight:600;color:var(--mf);transition:background-color .16s,color .16s}.ch:active{transform:scale(.96)}.ch.on{background:var(--brand);color:#fff}
.yc{margin-top:12px;background:var(--sec);border-radius:16px;padding:14px}.trio{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:10px}
.tr2{padding:12px 0;box-shadow:0 1px 0 var(--hair)}.tr2:first-of-type{padding-top:0}.tr2:last-of-type{box-shadow:none}
${WIDE ? '.wide .head1{font-size:20px}.wide .trio{grid-template-columns:repeat(3,1fr)}.wide .chips{margin:12px 0 0;padding:0;-webkit-mask-image:none}.wide .yc{display:grid;grid-template-columns:260px 1fr;gap:24px;align-items:start}' : ''}`; document.head.appendChild(st);
mount(m => {
  const hd = document.createElement('div'); hd.innerHTML = IDXSEL() + HEAD({ base: false }); const [h1, h2] = [...hd.children];
  const s1 = document.createElement('section'); s1.id = 'sec1'; s1.dataset.testid = 'invest-sec1';
  s1.innerHTML = `<div class="card"><div class="sec-t">시장 흐름 <small>구간으로 읽어요</small></div><div id="chartbox"></div>${LEGEND()}<div id="chipbox"></div><div id="ycbox"></div></div>`;
  const s2 = document.createElement('div'); s2.innerHTML = sec2B();
  m.append(h1, h2, s1);
  if (WIDE) { const g = document.createElement('div'); g.style.cssText = 'display:grid;grid-template-columns:1fr 420px;gap:24px;align-items:start'; g.append(s2.firstChild, sec3('B')); m.append(g); } else m.append(s2.firstChild, sec3('B'));
  const f = document.createElement('div'); f.innerHTML = FOOT(); m.append(...f.children); render();
});
