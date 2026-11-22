window.R41=(function(){/* #263 R4.1 시안 — 연도별 등락 격자 + 기간 등락(③ 통합). 값은 ../r3/data.js(= data/*.csv) 계산, 하드코딩 0. 코드 아님, 시안용
   쿼리: w idx(spx|ndx|kospi) theme yr(격자 선택 연도) sy ey m(lump|yearly) cy(기간 그림 선택 연도) alt=b(대안 B 목업) full=1(전체 기간) */
const Q = new URLSearchParams(location.search);
const VW = +(Q.get('w') || 390), WIDE = VW >= 1000, DARK = Q.get('theme') === 'dark';
document.documentElement.className = (DARK ? 'dark ' : '') + (WIDE ? 'wide' : '') + (Q.get('alt') ? ' altb' : '');
const $ = (s, r = document) => r.querySelector(s);
const MINUS = '−';
const fp = (v, d = 1) => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + '%';
const f0 = v => { const r = Math.round(v); return r > 0 ? '+' + r : r < 0 ? MINUS + Math.abs(r) : '0'; };
const f1 = v => { const r = Math.round(v * 10) / 10; return r > 0 ? '+' + r.toFixed(1) : r < 0 ? MINUS + Math.abs(r).toFixed(1) : '0.0'; };
const PH = { down: '내려감', up: '올라감', flat: '거의 그대로', none: '자료 없음' };
const lvl = v => v >= 10 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
const IDX = Q.get('idx') || 'spx', d = DATA.idx[IDX], LAST = d.last;
const ST = { m: Q.get('m') || 'lump', sy: +(Q.get('sy') || LAST - 10), ey: +(Q.get('ey') || LAST), yr: Q.get('yr') ? +Q.get('yr') : null, cy: Q.get('cy') ? +Q.get('cy') : null };
if (Q.get('full')) { ST.sy = d.start; ST.ey = LAST; }
const first = d.start + 1; // 첫 등락이 있는 해
const retOf = Y => d.ret[Y - d.start];
const closeOf = Y => d.close[Y - d.start];
const fixSE = () => { ST.sy = Math.max(d.start, Math.min(ST.sy, LAST - 1)); ST.ey = Math.max(ST.sy + 1, Math.min(ST.ey, LAST)); };

/* ---------- 연도별 격자 ---------- */
const alpha = r => 0.10 + 0.50 * Math.min(Math.abs(r) / 40, 1);
function gridHTML() {
  const decs = []; for (let t = Math.floor(first / 10) * 10; t <= Math.floor(LAST / 10) * 10; t += 10) decs.push(t);
  const cols = `12px repeat(${decs.length}, minmax(0, 1fr))`;
  let h = `<div class="ggrid" role="grid" aria-label="${d.label} 연도별 등락률, 열은 연대·행은 끝자리" style="grid-template-columns:${cols}"><div class="gh"></div>${decs.map(t => `<div class="gh" role="columnheader">${t}</div>`).join('')}`;
  for (let k = 0; k < 10; k++) {
    h += `<div class="gy" role="rowheader">${k}</div>`;
    decs.forEach(t => {
      const Y = t + k, r = Y >= first && Y <= LAST ? retOf(Y) : null;
      if (r == null) { h += `<div class="gc e" role="gridcell" aria-hidden="true"></div>`; return; }
      const inP = Y > ST.sy && Y <= ST.ey, near0 = Math.abs(r) < 0.05;
      const bg = near0 ? '' : `background:${r > 0 ? 'rgba(' + (DARK ? '251,113,133' : '225,29,72') : 'rgba(' + (DARK ? '96,165,250' : '37,99,235')},${alpha(r).toFixed(3)})`;
      h += `<button class="gc ${near0 ? 'z' : ''} ${inP ? 'in' : ''} ${ST.yr === Y ? 'sel' : ''}" role="gridcell" data-y="${Y}" data-testid="year-cell" data-ret="${r}" aria-label="${Y}년 ${fp(r)}${ST.yr === Y ? ', 선택됨' : ''}" style="${bg}">${f1(r)}</button>`;
    });
  }
  return h + '</div>';
}
function readout(Y) {
  const row = d.tbl.find(x => x.y === Y); if (!row) return '';
  const rc = row.ret < 0 ? 'dn' : 'up', us = d.rate === 'us';
  const l1 = `<b>${Y}년 말</b> ${lvl(row.close)} · <b class="${rc}">${fp(row.ret)}</b> · 금리 ${PH[row.dir]}${us && row.rec > 0 ? ' · 경기침체' : ''}`;
  return `<div class="rd1">${l1}</div>`;
}
function gridCard() {
  const cap = `해마다 연말 기준 등락(%) · 가격 지수(배당 제외) · ${d.cur === '달러' ? '미국 달러 기준' : '포인트 기준'}`;
  return `<section class="card gridcard" data-testid="yearly-grid"><div class="sec-t" style="margin-bottom:4px">${d.label} 연도별 등락률</div>
  <p class="note">${cap}</p>
  <div class="gbleed" id="gbleed">${gridHTML()}</div>
  <div class="gleg"><span class="gbar" aria-hidden="true">${[40, 20, 5].map(v => `<i style="background:rgba(${DARK ? '96,165,250' : '37,99,235'},${alpha(v).toFixed(2)})"></i>`).join('')}${`<i style="background:var(--sec)"></i>`}${[5, 20, 40].map(v => `<i style="background:rgba(${DARK ? '251,113,133' : '225,29,72'},${alpha(v).toFixed(2)})"></i>`).join('')}</span><span>−40% 이하 ~ +40% 이상, 진할수록 많이 움직인 해</span></div>
  <div class="gleg" style="margin-top:6px"><span><i class="ul"></i>아래 기간 등락률에서 고른 기간</span></div>
  <div class="rd wrapok" data-testid="invest-readout" aria-live="polite" style="margin-top:6px">${ST.yr != null ? readout(ST.yr) : '<div class="rd1"><span class="hint">해를 누르거나 끌면 그해 말 값이 나와요</span></div>'}</div></section>`;
}

/* ---------- 기간 등락률(③ 통합): 같은 기간·같은 총액을 ① 처음에 한 번에 ② 해마다 나눠 넣기 비교. 총액 = 1(배수 기준) ---------- */
function series(sy, ey, mode) { // 연말 값만 사용. 매달 사기: 그해 12번 모두 '직전 연말값과 그해 연말값의 평균' 가격(mode 'avg') 또는 두 값 사이 직선 보간 월말 가격(mode 'lin', 비교용). 총액 = 1, 한 번에와 같은 기간
  const c = d.close, i0 = sy - d.start, n = ey - sy, L = [], D = [], P = []; let u = 0;
  for (let t = 0; t <= n; t++) { L.push(c[i0 + t] / c[i0]);
    if (t > 0) { const a = c[i0 + t - 1], b = c[i0 + t]; if ((mode || 'avg') === 'avg') u += (1 / n) / ((a + b) / 2); else for (let m = 1; m <= 12; m++) u += (1 / (12 * n)) / (a + (b - a) * m / 12); }
    D.push(u * c[i0 + t]); P.push(t / n); }
  return { L, D, P, n };
}
function irrM(V, n) { let a = -0.99, b = 10; for (let k = 0; k < 80; k++) { const m = (a + b) / 2; let s = 0; for (let j = 1; j <= 12 * n; j++) s += Math.pow(1 + m, n - j / 12) / (12 * n); if (s < V) a = m; else b = m; } return ((a + b) / 2) * 100; }
const stepAx = M => [0.5, 1, 2, 5, 10, 20, 50, 100, 200].find(s => M / s <= 4);
function periodSVG(W) {
  const sy = ST.sy, ey = ST.ey, S = series(sy, ey), n = S.n;
  const M = Math.max(...S.L, ...S.D, 1) * 1.08, H1 = 132, T1 = 28, yy = v => T1 + H1 - v / M * H1;
  const st = stepAx(M), ticks = []; for (let v = 0; v <= M; v += st) ticks.push(v);
  const tl = v => v === 0 ? '0' : (Math.round(v * 10) / 10) + '배';
  const G = Math.max(...ticks.map(v => tl(v).length)) * 6.4 + 8, PW = W - G, bw = PW / (n + 1), X = i => bw * (i + 0.5);
  const rets = []; for (let Y = sy + 1; Y <= ey; Y++) rets.push(retOf(Y));
  const showLbl = bw >= 20, mp = Math.max(0, ...rets), mn = Math.max(0, ...rets.map(r => -r)), pad = showLbl ? 14 : 3, T2 = T1 + H1 + 40, H2 = 92;
  const sc = (H2 - 2 * pad) / ((mp + mn) || 1), z = T2 + pad + mp * sc;
  const xs = [sy]; for (let Y = sy + 1; Y <= ey; Y++) { if ((Y - sy) % (bw >= 34 ? 1 : bw >= 17 ? 2 : bw >= 7 ? 5 : 10) === 0) xs.push(Y); }
  if (xs.at(-1) !== ey) { if (X(ey - sy) - X(xs.at(-1) - sy) < 36) xs.pop(); xs.push(ey); }
  const TH = T2 + H2 + 18, CL = 'var(--ink2)', CD = 'var(--brand)';
  let s = `<svg id="pc" width="${W}" height="${TH}" viewBox="0 0 ${W} ${TH}" role="img" aria-label="${sy}년 말부터 ${ey}년 말까지 같은 총액을 한 번에 넣은 경우 ${S.L.at(-1).toFixed(2)}배, 매달 나눠 넣은 경우 ${S.D.at(-1).toFixed(2)}배. 값은 아래 결과와 같아요" data-testid="period-chart">`;
  s += `<text class="cap" x="0" y="11">넣을 총액 = 1배 · 평가액과 넣은 돈</text>`;
  ticks.forEach(v => { const y = yy(v); s += `<line x1="0" x2="${PW}" y1="${y}" y2="${y}" stroke="var(--fg)" stroke-opacity="${v === 1 ? .30 : .10}" ${v === 1 ? 'stroke-dasharray="3 3"' : ''}/><text class="ax" x="${W}" y="${y + 4}" text-anchor="end">${tl(v)}</text>`; });
  if (!ticks.includes(1)) { const y = yy(1); s += `<line x1="0" x2="${PW}" y1="${y}" y2="${y}" stroke="var(--fg)" stroke-opacity=".30" stroke-dasharray="3 3"/>`; if (ticks.every(v => Math.abs(yy(v) - y) >= 14)) s += `<text class="ax" x="${W}" y="${y + 4}" text-anchor="end">1배</text>`; }
  if (ST.cy != null && ST.cy >= sy && ST.cy <= ey) s += `<line x1="${X(ST.cy - sy)}" x2="${X(ST.cy - sy)}" y1="${T1 - 4}" y2="${T2 + H2}" stroke="var(--brand)" stroke-width="1.5" stroke-opacity=".7"/>`;
  // 넣은 돈 계단(나눠 넣기): 연말마다 한 칸씩, 얇은 선. 한 번에의 넣은 돈은 1배 점선
  s += `<polyline points="${S.P.map((p, i) => X(i).toFixed(1) + ',' + yy(p).toFixed(1)).join(' ')}" fill="none" stroke="${CD}" stroke-opacity=".45" stroke-width="1.25" data-testid="principal-steps"/>`;
  const pl = (A, c, shape) => { let o = `<polyline fill="none" stroke="${c}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" points="${A.map((v, i) => X(i).toFixed(1) + ',' + yy(v).toFixed(1)).join(' ')}"/>`;
    if (bw >= 14) A.forEach((v, i) => { o += shape === 'c' ? `<circle cx="${X(i)}" cy="${yy(v)}" r="2.6" fill="var(--card)" stroke="${c}" stroke-width="1.5"/>` : `<rect x="${X(i) - 2.6}" y="${yy(v) - 2.6}" width="5.2" height="5.2" transform="rotate(45 ${X(i)} ${yy(v)})" fill="var(--card)" stroke="${c}" stroke-width="1.5"/>`; }); return o; };
  s += `<g data-testid="line-lump">${pl(S.L, CL, 'c')}</g><g data-testid="line-dca">${pl(S.D, CD, 'd')}</g>`;
  // 끝점 라벨 2개(같은 크기·굵기, 겹치면 위아래로 벌림)
  const ex = X(n), yl = yy(S.L.at(-1)), yd = yy(S.D.at(-1)); let a = Math.max(yl - 9, T1 + 2), b = Math.max(yd - 9, T1 + 2);
  if (Math.abs(a - b) < 14) { if (yl <= yd) b = a + 14; else a = b + 14; }
  [[a, S.L.at(-1), '한 번에', CL, yl], [b, S.D.at(-1), '매달', CD, yd]].forEach(([y, v, nm, c, py]) => { s += `<circle cx="${ex}" cy="${py}" r="3.6" fill="${c}" stroke="var(--card)" stroke-width="2"/><text class="svt" data-testid="end-${nm === '매달' ? 'dca' : 'lump'}" x="${ex - 8}" y="${y}" text-anchor="end" font-size="12" font-weight="600" fill="var(--fg)">${nm} ${v.toFixed(2)}배</text>`; });
  s += `<text class="cap" x="0" y="${T2 - 10}">연간 등락(%)</text><line x1="0" x2="${PW}" y1="${z}" y2="${z}" stroke="var(--fg)" stroke-opacity=".32"/>`;
  rets.forEach((r, k) => { const i = k + 1, h = Math.abs(r) * sc, w = Math.min(bw * 0.62, 20), c = r >= 0 ? 'profit' : 'loss';
    s += `<rect data-testid="period-bar" data-y="${sy + i}" x="${X(i) - w / 2}" y="${r >= 0 ? z - h : z}" width="${w}" height="${Math.max(h, 1)}" rx="${Math.min(2, w / 4)}" fill="var(--${c})"/>`;
    if (showLbl) s += `<text class="svt" x="${X(i)}" y="${r >= 0 ? z - h - 4 : z + h + 12}" text-anchor="middle" font-size="11" font-weight="600" fill="var(--fg)">${f0(r)}</text>`; });
  xs.forEach(Y => { const x = X(Y - sy); s += `<text class="ax" x="${x < 16 ? 0 : x}" y="${TH - 3}" text-anchor="${x < 16 ? 'start' : 'middle'}">${Y}</text>`; });
  s += `<rect id="phit" x="0" y="0" width="${PW}" height="${TH}" fill="transparent"/>`;
  return { svg: s + '</svg>', S };
}
function resRow(kind, sy, ey, n, V, cagr, extra) {
  const tot = (V - 1) * 100, sent = kind === 'L' ? `${sy}년 말에 총액을 한 번에 넣었다면, ${ey}년 말 ${d.label} 지수 기준 넣은 돈의` : `같은 총액을 ${sy}년 말부터 ${n}년 동안 매달 나눠 넣었다면(${12*n}번), ${ey}년 말 넣은 돈의`;
  const mk = kind === 'L' ? '<svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="var(--card)" stroke="var(--ink2)" stroke-width="2"/></svg>' : '<svg width="14" height="14" aria-hidden="true"><rect x="3" y="3" width="8" height="8" transform="rotate(45 7 7)" fill="var(--card)" stroke="var(--brand)" stroke-width="2"/></svg>';
  return `<div class="rrow" data-testid="calc-${kind === 'L' ? 'lump' : 'dca'}"><div class="tsm bal">${mk} ${sent}</div><div class="rbig"><span class="t2xl b" data-testid="calc-mult-${kind === 'L' ? 'lump' : 'dca'}">${V.toFixed(2)}배</span><span class="tbase sb ${tot < 0 ? 'dn' : 'up'}" data-testid="calc-total-${kind === 'L' ? 'lump' : 'dca'}">${fp(tot, 0)}</span></div><div class="txs mf">${extra}<b class="sb ${cagr < 0 ? 'dn' : 'up'}" data-testid="calc-cagr-${kind === 'L' ? 'lump' : 'dca'}">${fp(cagr, 2)}</b> ${cagr < 0 ? '내린' : '오른'} 셈이에요</div></div>`;
}
function periodCard() {
  fixSE(); const sy = ST.sy, ey = ST.ey, n = ey - sy, S = series(sy, ey), VL = S.L.at(-1), VD = S.D.at(-1), cL = (Math.pow(VL, 1 / n) - 1) * 100, cD = irrM(VD, n);
  const years = k => Array.from({ length: k }, (_, i) => i);
  const sOpts = years(LAST - d.start).map(i => d.start + i).map(Y => `<option value="${Y}" ${Y === sy ? 'selected' : ''}>${Y}년 말</option>`).join('');
  const eOpts = years(LAST - sy).map(i => sy + 1 + i).map(Y => `<option value="${Y}" ${Y === ey ? 'selected' : ''}>${Y}년 말</option>`).join('');
  const pre = [[5, '5년'], [10, '10년'], [20, '20년'], [LAST - d.start, '전체']].filter(p => LAST - p[0] >= d.start);
  const CW = WIDE ? 600 : VW - 64, pcs = periodSVG(CW);
  const ra = ST.cy != null ? (() => { const Y = ST.cy, i = Y - sy, rr = Y > sy ? retOf(Y) : null; return `<div class="rd1"><b>${Y}년 말</b>${rr != null ? ` · 그해 <b class="${rr < 0 ? 'dn' : 'up'}">${fp(rr)}</b>` : ''} · 한 번에 ${S.L[i].toFixed(2)}배 · 매달 ${S.D[i].toFixed(2)}배</div>`; })() : '<div class="rd1"><span class="hint">해를 누르면 그해 말 두 방식의 평가액이 나와요</span></div>';
  const lg = `<div class="gleg" style="margin-top:12px;gap:12px"><span><svg width="14" height="12" aria-hidden="true"><line x1="0" x2="14" y1="6" y2="6" stroke="var(--ink2)" stroke-width="2"/><circle cx="7" cy="6" r="2.6" fill="var(--card)" stroke="var(--ink2)" stroke-width="1.5"/></svg> 한 번에 넣기</span><span><svg width="14" height="12" aria-hidden="true"><line x1="0" x2="14" y1="6" y2="6" stroke="var(--brand)" stroke-width="2"/><rect x="4.4" y="3.4" width="5.2" height="5.2" transform="rotate(45 7 6)" fill="var(--card)" stroke="var(--brand)" stroke-width="1.5"/></svg> 매달 나눠 넣기</span><span><svg width="16" height="12" aria-hidden="true"><path d="M0 10 L4 10 L4 6 L9 6 L9 2 L16 2" fill="none" stroke="var(--brand)" stroke-opacity=".45" stroke-width="1.25"/></svg> 나눠 넣은 돈(매달 같은 금액)</span></div>`;
  return `<section class="card" id="sec3" data-testid="invest-sec3"><div class="sec-t">${d.label} 기간 등락률 <small>그해 말에 넣었다면</small></div>
  <div class="ctl" style="margin-top:0" role="group" aria-label="기간 길이" data-testid="period-presets">${pre.map(p => `<button data-p="${p[0]}" class="${ey === LAST && sy === LAST - p[0] ? 'on' : ''}" aria-pressed="${ey === LAST && sy === LAST - p[0]}">${p[1]}</button>`).join('')}</div>
  <div class="sel2"><label><small>시작</small><select id="sy" aria-label="시작 연도 말" data-testid="period-start">${sOpts}</select></label><label><small>끝</small><select id="ey" aria-label="끝 연도 말" data-testid="period-end">${eOpts}</select></label></div>
  <div class="res pfade" data-testid="calc-result" aria-live="polite">${resRow('L', sy, ey, n, VL, cL, '')}<div class="rsep"></div>${resRow('D', sy, ey, n, VD, cD, '넣은 시점을 반영해 ')}</div>
  <div class="honest"><p class="note pre" data-testid="period-honest">월 지수 값 대신 연말 값의 평균으로 매달 산 것으로 어림했어요</p><button class="ib" id="ib" aria-expanded="${Q.get('info')==='1'}" aria-controls="idef" aria-label="어림 방식 보기" data-testid="honest-info"><span class="ih">i</span></button></div><p id="idef" class="note pre idef ${Q.get('info')==='1'?'open':''}" data-testid="honest-def">그해 12번을 모두 ‘직전 연말 값과 그해 연말 값의 평균’ 가격으로 샀다고 봤어요. 실제 월별 값이 아니라서 한 해 안에서 오르내린 모양은 반영되지 않아요. 총액과 기간은 한 번에 넣기와 같아요.</p>
  ${lg}
  <div class="rd wrapok" data-testid="period-readout" aria-live="polite" style="margin-top:6px">${ra}</div>
  <div class="pcw pfade" id="pcw">${pcs.svg}</div>
  <div class="ci" style="margin:10px 0 0"><span class="chip">${d.cur === '달러' ? '달러 기준' : '포인트 기준'}</span><span class="chip">지수 값만(배당 빼고)</span></div>
  <p class="note pre" style="margin-top:10px">총액과 기간은 같고 넣는 방식만 달라요. 두 방식의 평가액은 같은 높이 눈금에 그렸어요.</p>
  <p class="note" style="margin-top:4px">배당을 다시 넣었다면 결과는 이보다 커요.</p><p class="note" style="margin-top:4px">과거 연말 지수 값으로 계산한 결과예요. 배당·세금·수수료는 빼고, 반올림하지 않은 값으로 계산해 마지막에 한 번만 반올림해요. 앞으로도 같다는 뜻은 아니에요.</p></section>`;
}

/* ---------- 대안 B: 막대 층에 값 라벨(전 기간 한 그림) ---------- */
function altB() {
  const W = VW - 64, ys = d.years.filter(Y => Y >= first), bw = W / ys.length, mx = Math.max(...ys.map(Y => Math.abs(retOf(Y)))), H = 150, z = 80;
  let s = `<svg width="${W}" height="${H + 40}" role="img" aria-label="대안 B">`;
  s += `<line x1="0" x2="${W}" y1="${z}" y2="${z}" stroke="var(--fg)" stroke-opacity=".3"/>`;
  ys.forEach((Y, i) => { const r = retOf(Y), h = Math.abs(r) / mx * 60, x = bw * (i + .5); s += `<rect x="${x - bw * .35}" y="${r >= 0 ? z - h : z}" width="${bw * .7}" height="${h}" fill="var(--${r >= 0 ? 'profit' : 'loss'})"/><text class="ax" font-size="11" transform="translate(${x + 4},${r >= 0 ? z - h - 3 : z + h + 3}) rotate(-90)" text-anchor="${r >= 0 ? 'start' : 'end'}">${f0(r)}</text>`; });
  return `<section class="card"><div class="sec-t">대안 B · 막대 층 값 라벨(전 기간 ${ys.length}개 막대, 막대당 ${bw.toFixed(1)}px)</div>${s}</svg></section>`;
}

function render() {
  fixSE();
  const idx = `<div class="seg hit" role="tablist" aria-label="지수 선택" data-testid="invest-index">${[['spx', 'S&amp;P 500'], ['ndx', '나스닥100'], ['kospi', '코스피']].map(([k, l]) => `<button class="${IDX === k ? 'on' : ''}" data-i="${k}" role="tab">${l}</button>`).join('')}</div>`;
  const top = `<div class="top"><div class="logo">S</div><div class="nav1"><span>상세</span><span>성과</span><span class="on">투자</span></div><div class="ico"><i></i></div></div>`;
  const stub = `<div class="stub">이 위에는 R3·R4 화면(지수 그림·크게 빠진 때·연도별 표)이 이어져요 — 이번 시안 범위 밖</div>`;
  let body;
  if (Q.get('alt')) body = `${idx}${stub}${altB()}`;
  else body = WIDE ? `${idx}${stub}<div class="two2"><div>${gridCard()}</div><div>${periodCard()}</div></div>` : `${idx}${stub}${gridCard()}${periodCard()}`;
  const src = `<div class="src" data-testid="invest-source"><p>가격 지수(배당 제외) · ${d.cur === '달러' ? '미국 지수는 달러 기준 · ' : ''}연말 종가 기준 · 기준일 ${LAST}.12.31 · 출처·고지는 기존 4줄 그대로</p></div>`;
  document.body.innerHTML = `<div class="app">${top}<main class="wrap" id="main" style="${WIDE ? 'max-width:1080px' : ''}">${body}${src}</main></div>`;
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const q = new URLSearchParams(location.search); q.set('idx', b.dataset.i); q.delete('sy'); q.delete('ey'); q.delete('yr'); location.search = q.toString(); });
  const gb = $('#gbleed'); if (gb) { const pick = ev => { const el = document.elementFromPoint(ev.clientX, ev.clientY); const c = el && el.closest('[data-y]'); if (c && +c.dataset.y !== ST.yr) { ST.yr = +c.dataset.y; render(); } }; gb.addEventListener('pointerdown', pick); gb.addEventListener('pointermove', ev => { if (ev.buttons || ev.pointerType === 'touch') pick(ev); }); }
    document.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { ST.sy = LAST - +b.dataset.p; ST.ey = LAST; ST.cy = null; render(); });
  const ib = $('#ib'); if (ib) ib.onclick = () => { const o = ib.getAttribute('aria-expanded') !== 'true'; ib.setAttribute('aria-expanded', o); $('#idef').classList.toggle('open', o); };
  const sy = $('#sy'), ey = $('#ey'); if (sy) { sy.onchange = () => { ST.sy = +sy.value; ST.cy = null; render(); }; ey.onchange = () => { ST.ey = +ey.value; ST.cy = null; render(); }; }
  const ph = $('#phit'); if (ph) ph.addEventListener('pointerdown', ev => { const r = $('#pc').getBoundingClientRect(), bw = (r.width - (parseFloat($('#pc').getAttribute('width')) - parseFloat(ph.getAttribute('width')))) / (ST.ey - ST.sy + 1); ST.cy = Math.max(ST.sy, Math.min(ST.ey, ST.sy + Math.floor((ev.clientX - r.left) / bw))); render(); });
}

return {ST,d,gridCard,periodCard,periodSVG,fixSE,Q,LAST};})();