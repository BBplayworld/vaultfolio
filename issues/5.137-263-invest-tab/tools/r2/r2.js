/* #263 R2 목업 — 값의 출처는 data.js(= data/*.csv). 지수 수준값만 가데이터(근사). 코드 아님, 시안용
   쿼리: w=390|320|1280 theme=dark idx=spx|ndx|kospi ep=<번호> yr=<연도> m=lump|month sy=<시작연도> */
const Q = new URLSearchParams(location.search);
const VW = +(Q.get('w') || 390), WIDE = VW >= 1000, DARK = Q.get('theme') === 'dark';
document.documentElement.className = (DARK ? 'dark ' : '') + (WIDE ? 'wide' : '');
const $ = (s, r = document) => r.querySelector(s);
const MINUS = '−';
const fp = (v, d = 1) => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(d) + '%';
const fr = v => (Math.round(v * 100) / 100).toString().replace(/(\.\d)0$/, '$1') + '%';
const lvl = v => Math.round(v).toLocaleString('en-US');
const END = DATA.end; // '2026-10'
const [EY, EM] = END.split('-').map(Number);
const ST = { idx: Q.get('idx') || 'spx', sel: Q.get('ep') != null ? +Q.get('ep') : null, yr: Q.get('yr') ? +Q.get('yr') : null, m: Q.get('m') || 'lump', sy: +(Q.get('sy') || EY - 10) };
const cur = () => DATA.idx[ST.idx];
const ymOfI = (d, i) => { const [by, bm] = d.start.split('-').map(Number); const t = by * 12 + bm - 1 + i; return [Math.floor(t / 12), t % 12 + 1]; };
const ymS = (d, i) => { const [y, m] = ymOfI(d, i); return `${y}.${String(m).padStart(2, '0')}`; };
const PHN = { D: '내리던 중', U: '올리던 중', flat: '거의 그대로', none: '금리 자료 없음' };
const DIRK = { down: 'D', up: 'U', flat: 'flat', none: 'none' };
let UID = 0;

/* ---------- 눈금 ---------- */
function logTicks(min, max, maxN) {
  for (const lad of [[1, 2, 5], [1, 3]]) {
    const t = []; for (let e = -1; e <= 7; e++) lad.forEach(m => t.push(m * Math.pow(10, e)));
    const lo = Math.max(...t.filter(x => x <= min)), hi = Math.min(...t.filter(x => x >= max));
    const tk = t.filter(x => x >= lo && x <= hi); if (tk.length <= maxN || lad.length === 2) return { lo, hi, tk };
  }
}
const lin = (a, b, f) => a + (b - a) * f;
function timeTicks(n, W, step) { // 월 인덱스 기준 연도 눈금: major(라벨)/minor
  return step;
}

/* ---------- 메인 차트(3패널) ---------- */
function mainChart(d, W, o = {}) {
  const uid = ++UID, n = d.v.length, GX = 44, RP = 8, PW = W - GX - RP, X = i => GX + i / n * PW, Xc = i => X(i + .5);
  const H1 = WIDE ? 190 : 112, H2 = WIDE ? 70 : 46, H3 = WIDE ? 64 : 42;
  const R = DATA.rates[d.rate], rOff = (() => { const [a, b] = d.start.split('-').map(Number), [c, e] = R.start.split('-').map(Number); return (a - c) * 12 + (b - e); })();
  const rv = i => { const k = i + rOff; return k >= 0 && k < R.v.length ? R.v[k] : null; };
  const min = Math.min(...d.v), max = Math.max(...d.v);
  const T = logTicks(min, max, WIDE ? 8 : 7), lnLo = Math.log(T.lo), lnHi = Math.log(T.hi);
  const cap1 = 11, P1 = 24, P1b = P1 + H1, cap2 = P1b + 19, P2 = P1b + 31, P2b = P2 + H2;
  // 이름 라벨 배치(행 0~2)
  const shortN = n => n.replace(' 버블 붕괴','').replace('글로벌 ','').replace(' 폭락','').replace(/(\d{4}년) 하락/,'$1');
  const cw = s => [...s].reduce((a, c) => a + (/[0-9a-zA-Z.%]/.test(c) ? 6.4 : c === ' ' ? 3.8 : 12.2), 0);
  const rows = [[], [], []], lab = d.eps.map(e => { const cx = X((e.p + e.t) / 2 + .5), w = cw(shortN(e.name)); let x0 = Math.max(GX, Math.min(W - w - 2, cx - w / 2)); let r = 0; while (r < 3 && rows[r].some(q => x0 < q.x1 + 8 && x0 + w > q.x0 - 8)) r++; rows[Math.min(r, 2)].push({ x0, x1: x0 + w }); return { e, x0, w, r: Math.min(r, 2) }; });
  const nr = Math.max(1, ...lab.map(l => l.r + 1)), LB = nr * 14 + 3;
  const cap3 = P2b + LB + 12, P3 = cap3 + 13, P3b = P3 + H3, AX = P3b + 15, H = AX + 3;
  const dmax = Math.max(...d.eps.map(e => -e.dd)) > 60 ? 80 : 60, dstep = dmax > 60 ? 40 : 20;
  const rmax = d.rate === 'us' ? 10 : 6, rstep = d.rate === 'us' ? 5 : 2;
  const Y1 = v => P1 + H1 - (Math.log(v) - lnLo) / (lnHi - lnLo) * H1, Y2 = p => P2 + (-p) / dmax * H2, Y3 = r => P3b - r / rmax * H3;
  let s = `<svg id="mc" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;touch-action:pan-y;user-select:none" role="img" aria-label="${d.label} 지수 흐름, 고점 대비 낙폭, ${R.label}를 같은 시간축에 세 줄로 나눈 그림">
<defs><pattern id="hz${uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="var(--fg)" opacity=".5"/></pattern></defs>`;
  // 선택 면(위 두 줄만) — 정의: 고점~바닥
  const ep = o.sel != null ? d.eps[o.sel] : null;
  if (ep) { const a = X(ep.p), b = X(ep.t + 1); s += `<rect x="${a}" y="${P1 - 2}" width="${b - a}" height="${H1 + 4}" rx="4" fill="var(--brandsoft)"/><rect x="${a}" y="${P2 - 2}" width="${b - a}" height="${H2 + 4}" rx="4" fill="var(--brandsoft)"/>`; }
  // ---- 캡션
  s += `<text class="cap" x="0" y="${cap1}">지수 흐름<tspan dx="5" data-ih="1">ⓘ</tspan></text>`;
  s += `<text id="readout" class="cap" data-testid="invest-readout" x="${W}" y="${cap1}" text-anchor="end" fill="var(--mf)">${o.yr != null ? readout(d, o.yr) : `${EM}월 말까지 · 눌러 보세요`}</text>`;
  // ---- 지수 패널: 눈금·격자
  T.tk.forEach(t => { const y = Y1(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="var(--hair)"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${lvl(t)}</text>`; });
  const path = (a, b) => { let q = ''; for (let i = a; i <= Math.min(b, n - 1); i++) q += (i === a ? 'M' : 'L') + Xc(i).toFixed(1) + ',' + Y1(d.v[i]).toFixed(1); return q; };
  const all = path(0, n - 1);
  s += `<path d="${all}L${Xc(n - 1)},${P1b}L${Xc(0)},${P1b}Z" fill="var(--fg)" opacity=".05"/><path d="${all}" fill="none" stroke="var(--fg)" stroke-opacity=".85" stroke-width="1.5" stroke-linejoin="round"/>`;
  d.eps.forEach((e, k) => { const on = o.sel == null || o.sel === k; s += `<path d="${path(e.p, e.t)}" fill="none" stroke="var(--loss)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="${on ? 1 : .4}"/>`; });
  const ly = Y1(d.v[n - 1]); s += `<circle cx="${Xc(n - 1)}" cy="${ly}" r="3.5" fill="var(--fg)" stroke="var(--card)" stroke-width="2"/>`;
  // ---- 낙폭 패널(고점 대비)
  s += `<text class="cap" x="0" y="${cap2}">고점 대비 낙폭</text>`;
  for (let t = 0; t >= -dmax; t -= dstep) { const y = Y2(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="${t === 0 ? 'var(--ink3)' : 'var(--hair)'}"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${t === 0 ? '0%' : fp(t, 0)}</text>`; }
  const DD = []; let pk = 0; d.v.forEach((v, i) => { pk = Math.max(pk, v); DD[i] = (v / pk - 1) * 100; });
  const dpath = (a, b) => { let q = ''; for (let i = a; i <= b; i++) q += (i === a ? 'M' : 'L') + Xc(i).toFixed(1) + ',' + Y2(Math.max(DD[i], -dmax)).toFixed(1); return q; };
  s += `<path d="${dpath(0, n - 1)}L${Xc(n - 1)},${P2}L${Xc(0)},${P2}Z" fill="var(--ink3)" opacity=".6"/>`;
  d.eps.forEach((e, k) => { const on = o.sel == null || o.sel === k; s += `<path d="${dpath(e.p, e.t)}L${Xc(e.t)},${P2}L${Xc(e.p)},${P2}Z" fill="var(--loss)" opacity="${on ? .95 : .4}"/>`; });
  s += `<path d="${dpath(0, n - 1)}" fill="none" stroke="var(--ink2)" stroke-width=".8" opacity=".6"/>`;
  // 이름 라벨
  lab.forEach(l => { const on = o.sel == null || o.sel === d.eps.indexOf(l.e); s += `<text class="nm-l" x="${l.x0}" y="${P2b + 11 + l.r * 14}" opacity="${on ? 1 : .55}" data-nm="${l.e.name}">${shortN(l.e.name)}</text>`; });
  // ---- 금리 패널(계단 + 국면 면)
  s += `<text class="cap" x="0" y="${cap3}">${R.label}</text>`;
  const lx = W - RP; let lgx = lx - 118; s += `<g class="cap"><rect x="${lgx}" y="${cap3 - 9}" width="12" height="9" rx="2" fill="var(--ink2)"/><text class="cap" x="${lgx + 16}" y="${cap3}">올림</text><rect x="${lgx + 52}" y="${cap3 - 9}" width="12" height="9" rx="2" fill="url(#hz${uid})" stroke="var(--ink3)"/><text class="cap" x="${lgx + 68}" y="${cap3}">내림</text></g>`;
  for (let t = 0; t <= rmax; t += rstep) { const y = Y3(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="${t === 0 ? 'var(--ink3)' : 'var(--hair)'}"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${t}%</text>`; }
  const step = (a, b, close) => { let q = ''; for (let i = a; i < b; i++) { const v = rv(i); if (v == null) continue; q += (q ? '' : `M${X(i).toFixed(1)},${close ? P3b : Y3(v)}${close ? `L${X(i).toFixed(1)},${Y3(v).toFixed(1)}` : ''}`) + `H${X(i + 1).toFixed(1)}`; const nv = i + 1 < b ? rv(i + 1) : null; if (nv != null && nv !== v) q += `V${Y3(nv).toFixed(1)}`; } return q; };
  R.ph.forEach(p => { const a = Math.max(0, p.a - rOff), b = Math.min(n, p.b - rOff); if (b <= a) return; const w = X(b) - X(a); if (w < 6) { const vmax = Math.max(...Array.from({ length: b - a }, (_, k) => rv(a + k) ?? 0)); s += `<rect x="${(X(a) + X(b)) / 2 - 3}" y="${Y3(vmax)}" width="6" height="${P3b - Y3(vmax)}" fill="none" stroke="var(--ink2)" stroke-width="1"/>`; return; }
    s += `<path d="${step(a, b, true)}L${X(b).toFixed(1)},${P3b}Z" fill="${p.k === 'U' ? 'var(--ink2)' : `url(#hz${uid})`}" ${p.k === 'D' ? 'stroke="var(--ink3)" stroke-width="1"' : ''}/>`; });
  const firstR = Math.max(0, -rOff); s += `<path d="${step(firstR, n, false)}" fill="none" stroke="var(--fg)" stroke-width="1.3" stroke-linejoin="round"/>`;
  if (firstR > 0) { const cx = (X(0) + X(firstR)) / 2; s += `<rect x="${X(0)}" y="${P3}" width="${X(firstR) - X(0)}" height="${H3}" fill="var(--sec)" opacity=".7"/><text class="ax" x="${cx}" y="${P3 + H3 / 2 - 2}" text-anchor="middle">자료</text><text class="ax" x="${cx}" y="${P3 + H3 / 2 + 13}" text-anchor="middle">없음</text>`; }
  // 선택 윤곽(금리 패널 위: brand 2px)
  if (ep) { const a = X(ep.p), b = X(ep.t + 1); s += `<rect x="${a}" y="${P3 - 1}" width="${b - a}" height="${H3 + 2}" rx="3" fill="none" stroke="var(--brand)" stroke-width="2"/>`; }
  // ---- 연도 커서(위 두 줄 hairline + 금리 패널 12개월 윤곽)
  if (o.yr != null) { const i0 = (o.yr - ymOfI(d, 0)[0]) * 12 - (ymOfI(d, 0)[1] - 1); const a = X(Math.max(0, i0)), b = X(Math.min(n, i0 + 12)); s += `<rect x="${a}" y="${P1}" width="${b - a}" height="${H1}" fill="var(--brandsoft)"/><rect x="${a}" y="${P2}" width="${b - a}" height="${H2}" fill="var(--brandsoft)"/><rect x="${a}" y="${P3 - 1}" width="${b - a}" height="${H3 + 2}" rx="2" fill="none" stroke="var(--brand)" stroke-width="2"/>`; }
  // ---- x축: 5년 minor, 10년(좁으면)/5년(넓으면) 라벨
  const [y0] = ymOfI(d, 0), lblStep = WIDE ? 5 : 10;
  for (let y = Math.ceil((y0 + 1) / 5) * 5; y <= EY; y += 5) { const i = (y - y0) * 12 - (ymOfI(d, 0)[1] - 1), x = X(i); const major = y % lblStep === 0; s += `<line x1="${x}" x2="${x}" y1="${P3b}" y2="${P3b + (major ? 5 : 3)}" stroke="var(--ink3)"/>${major ? `<text class="ax" x="${x}" y="${AX}" text-anchor="middle">${y}</text>` : ''}`; }
  s += `<rect class="hit" x="${GX}" y="0" width="${PW}" height="${P3b}" fill="transparent"/></svg>`;
  return { svg: s, geo: { GX, PW, n, y0, m0: ymOfI(d, 0)[1] } };
}
function readout(d, y) {
  const r = d.annual[y], a = DATA.annRate[d.rate][y]; const dir = a == null ? '' : Math.abs(a) < .25 ? '금리 거의 그대로' : a > 0 ? '금리 올리는 중' : '금리 내리는 중';
  return `${y}년 ${r == null ? '' : `<tspan fill="${r < 0 ? 'var(--loss)' : 'var(--profit)'}" font-weight="600">${fp(r)}</tspan>`}${dir ? ' · ' + dir : ''}`;
}

/* ---------- 구간 확대(고점 6개월 전부터) ---------- */
function zoomChart(d, e, W) {
  const uid = ++UID, GX = 44, RP = 10, PW = W - GX - RP, a = Math.max(0, e.p - 6), z = Math.min(d.v.length - 1, (e.r ?? d.v.length - 1) + 3), n = z - a + 1;
  const R = DATA.rates[d.rate], rOff = (() => { const [x, y] = d.start.split('-').map(Number), [c, f] = R.start.split('-').map(Number); return (x - c) * 12 + (y - f); })();
  const rv = i => { const k = i + rOff; return k >= 0 && k < R.v.length ? R.v[k] : null; };
  const X = i => GX + (i - a) / n * PW, Xc = i => X(i + .5);
  const seg = d.v.slice(a, z + 1), T = logTicks(Math.min(...seg), Math.max(...seg), 5), lnLo = Math.log(T.lo), lnHi = Math.log(T.hi);
  const H1 = WIDE ? 130 : 104, H3 = WIDE ? 54 : 46, P1 = 14, P1b = P1 + H1, cap3 = P1b + 26, P3 = cap3 + 14, P3b = P3 + H3, AX = P3b + 16, H = AX + 4;
  const rvs = Array.from({ length: n }, (_, k) => rv(a + k)).filter(v => v != null), rmax = d.rate === 'us' ? (Math.max(...rvs) > 6 ? 10 : Math.max(...rvs) > 4 ? 6 : 4) : (Math.max(...rvs) > 4 ? 6 : 4), rstep = rmax > 6 ? 5 : 2;
  const Y1 = v => P1 + H1 - (Math.log(v) - lnLo) / (lnHi - lnLo) * H1, Y3 = r => P3b - r / rmax * H3;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block" role="img" aria-label="${e.name} 구간 확대. 고점 6개월 전부터 지수와 ${R.label}">
<defs><pattern id="hz${uid}" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="5" fill="var(--fg)" opacity=".5"/></pattern></defs>`;
  T.tk.forEach(t => { const y = Y1(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="var(--hair)"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${lvl(t)}</text>`; });
  const path = (p, q) => { let r = ''; for (let i = p; i <= q; i++) r += (i === p ? 'M' : 'L') + Xc(i).toFixed(1) + ',' + Y1(d.v[i]).toFixed(1); return r; };
  s += `<line x1="${Xc(e.p)}" x2="${W - RP}" y1="${Y1(d.v[e.p])}" y2="${Y1(d.v[e.p])}" stroke="var(--ink2)" stroke-dasharray="3 3" opacity=".8"/>`;
  s += `<path d="${path(a, z)}" fill="none" stroke="var(--fg)" stroke-opacity=".9" stroke-width="1.6" stroke-linejoin="round"/><path d="${path(e.p, e.t)}" fill="none" stroke="var(--loss)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  const dot = (i, f, st, txt, dy, anchor = 'middle') => (anchor = Xc(i) < GX + 22 && anchor === 'middle' ? 'start' : anchor, `<circle cx="${Xc(i)}" cy="${Y1(d.v[i])}" r="4" fill="${f}" stroke="${st}" stroke-width="2"/><text class="nm-l" x="${Xc(i)}" y="${Y1(d.v[i]) + dy}" text-anchor="${anchor}" font-size="11">${txt}</text>`);
  s += dot(e.p, 'var(--fg)', 'var(--sec)', '고점', -9) + dot(e.t, 'var(--loss)', 'var(--sec)', '바닥', 16);
  if (e.r && e.r <= z) s += dot(e.r, 'var(--sec)', 'var(--fg)', '전고점', -9, e.r >= z - 2 ? 'end' : 'middle');
  // 금리
  s += `<text class="cap" x="0" y="${cap3}">${R.label}</text>`;
  for (let t = 0; t <= rmax; t += rstep) { const y = Y3(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="${t === 0 ? 'var(--ink3)' : 'var(--hair)'}"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${t}%</text>`; }
  const step = (p, q, close) => { let r = ''; for (let i = p; i <= q; i++) { const v = rv(i); if (v == null) continue; r += (r ? '' : `M${X(i).toFixed(1)},${close ? P3b : Y3(v)}${close ? `L${X(i).toFixed(1)},${Y3(v).toFixed(1)}` : ''}`) + `H${X(i + 1).toFixed(1)}`; const nv = i + 1 <= q ? rv(i + 1) : null; if (nv != null && nv !== v) r += `V${Y3(nv).toFixed(1)}`; } return r; };
  R.ph.forEach(p => { const p0 = Math.max(a, p.a - rOff), p1 = Math.min(z + 1, p.b - rOff); if (p1 <= p0) return; if (X(p1) - X(p0) < 6) { const vv = Math.max(...Array.from({ length: p1 - p0 }, (_, k) => rv(p0 + k) ?? 0)); s += `<rect x="${(X(p0) + X(p1)) / 2 - 3}" y="${Y3(vv)}" width="6" height="${P3b - Y3(vv)}" fill="none" stroke="var(--ink2)"/>`; return; }
    s += `<path d="${step(p0, p1 - 1, true)}L${X(p1).toFixed(1)},${P3b}Z" fill="${p.k === 'U' ? 'var(--ink2)' : `url(#hz${uid})`}" ${p.k === 'D' ? 'stroke="var(--ink3)"' : ''}/>`; });
  s += `<path d="${step(Math.max(a, -rOff), z, false)}" fill="none" stroke="var(--fg)" stroke-width="1.3" stroke-linejoin="round"/>`;
  // 고점·바닥 달 표식(축 위 짧은 눈금, 선 연결 없음)
  [e.p, e.t].forEach(i => { s += `<rect x="${Xc(i) - 1}" y="${P3b}" width="2" height="6" fill="${i === e.p ? 'var(--fg)' : 'var(--loss)'}"/>`; });
  // x 눈금
  const spanM = n, stepM = [3, 6, 12, 24, 60, 120].find(k => spanM / k <= (W < 300 ? 4 : 6)) || 120;
  for (let i = a; i <= z; i++) { const [y, m] = ymOfI(d, i); if (stepM >= 12 ? (m !== 1 || y % (stepM / 12) !== 0) : (m - 1) % stepM !== 0) continue; const x = Xc(i); if (x < GX + 14 || x > W - RP - 14) continue; s += `<line x1="${x}" x2="${x}" y1="${P3b + 6}" y2="${P3b + 9}" stroke="var(--ink3)"/><text class="ax" x="${x}" y="${AX + 3}" text-anchor="middle">${stepM >= 12 || m === 1 ? y : y + '.' + m}</text>`; }
  return s + '</svg>';
}
function detail(d, e, W, k) {
  const tag = DIRK[e.dir], dirTxt = PHN[tag];
  const rateTxt = e.dir === 'none' ? '' : `<span class="txs mf" style="display:block;font-weight:400">${fr(e.rf)}에서 ${fr(e.rt)}로</span>`;
  const sw = { D: 'dn-s', U: 'up-s', flat: 'fl-s', none: 'no-s' }[tag];
  return `<div class="ex fadein" data-testid="episode-detail" data-ep="${k}">
  <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big dn" data-testid="detail-dd">${fp(e.dd)}</div><div class="txs mf">${e.ongoing ? '지금까지' : `고점 ${ymS(d, e.p)}`} · ${e.ongoing ? `바닥 ${ymS(d, e.t)}` : `바닥 ${ymS(d, e.t)}`}</div></div>
  <div class="trio"><div><div class="l">고점에서 바닥까지</div><div class="v">${e.toT}개월</div></div><div><div class="l">고점에서 전고점까지<span class="ih" role="button" aria-label="기간 기준 설명">i</span></div><div class="v">${e.toR ? e.toR + '개월' : '아직이에요'}</div></div><div><div class="l">그때 금리</div><div class="v" style="display:flex;align-items:center;gap:6px"><i class="sw ${sw}"></i>${dirTxt}</div>${rateTxt}</div></div>
  <div style="margin-top:12px;margin-left:-2px">${zoomChart(d, e, W)}</div>
  ${e.note ? `<div class="txs mf" style="margin-top:6px">${e.note}</div>` : ''}${e.event ? `<div class="evl pre"><span class="mf">같은 시기 사건</span>${e.event}</div>` : ''}</div>`;
}
/* ---------- 머리·목록·③ ---------- */
function headline(d) {
  const w = d.start.slice(0, 4), us = d.rate === 'us', who = us ? '미국' : '한국';
  const parts = []; if (d.nDown) parts.push(`${d.nDown}번은 ${who} 금리를 내리던 중`); if (d.nUp) parts.push(`${d.nUp}번은 올리던 중`); if (d.nFlat) parts.push(`${d.nFlat}번은 거의 그대로`); if (d.nNone) parts.push(`${d.nNone}번은 금리 자료 없음`);
  const last = parts.length - 1; const t2 = parts.map((p, i) => i === 0 && d.nDown ? `<b class="sb" style="color:var(--fg)">${p}</b>` : p).join(', ');
  const base = us ? `${d.base.years}년 중 ${who} 금리를 내리던 때는 ${d.base.dn}년, 올리던 때는 ${d.base.up}년이었어요` : `한국 금리 자료가 있는 ${d.base.years}년 중 내리던 때는 ${d.base.dn}년, 올리던 때는 ${d.base.up}년이었어요`;
  return `<div data-testid="invest-headline"><div class="head1 bal">${w}년 이후 20% 넘게 빠진 때는 ${d.n}번이었어요</div><div class="head2 pre">그중 ${t2}${d.nNone && !d.nFlat && !d.nUp && !d.nDown ? '' : '이었어요'}</div><div class="base pre" data-testid="invest-base">${base}</div></div>`.replace('이었어요</div>', parts.length ? '이었어요</div>' : '</div>');
}
function listHTML(d, W, inline) {
  const dmax = Math.max(...d.eps.map(e => -e.dd)) > 60 ? 80 : 60, dstep = dmax > 60 ? 40 : 20;
  const ticks = []; for (let t = 0; t <= dmax; t += dstep) ticks.push(t);
  const trkW = (W - 24 - 24); // 행 좌우 패딩 12, chev 16+8
  const rowsH = d.eps.map((e, k) => { const tag = DIRK[e.dir], sw = { D: 'dn-s', U: 'up-s', flat: 'fl-s', none: 'no-s' }[tag]; const open = ST.sel === k;
    return `<div class="rowbox ${open ? 'open' : ''}" data-testid="drop-row"><button class="row" data-k="${k}" aria-expanded="${open}"><div class="r1"><span class="nm">${e.name}${e.ongoing ? '<small>진행 중</small>' : ''}</span><span class="rc"><i class="sw ${sw}"></i>${PHN[tag]}<span class="chev" aria-hidden="true">›</span></span></div><div class="r2"><div class="trk">${ticks.slice(1).map(t => `<i class="t" style="left:${t / dmax * 100}%"></i>`).join('')}<i class="f" style="width:${-e.dd / dmax * 100}%"></i></div></div></button>${open && inline ? detail(d, e, W - 24, k) : ''}</div>`; }).join('');
  const ax = `<div class="axrow" aria-hidden="true">${ticks.map(t => `<span style="left:calc(${t / dmax * 100}% * ${(W - 24 - 24) / (W - 24)} + ${t === 0 ? 0 : 0}px);${t === 0 ? 'transform:none' : ''}">${t === 0 ? '0%' : fp(-t, 0)}</span>`).join('')}</div>`;
  const hdr = `<div class="axrow" style="height:18px" aria-hidden="true"><span style="left:0;transform:none" class="cap-t">크게 빠진 때</span>${ticks.slice(1).map((t, j, ar) => `<span style="left:${t / dmax * (W - 24)}px${j === ar.length - 1 ? ';transform:translateX(-100%)' : ''}">${fp(-t, 0)}</span>`).join('')}</div>`;
  return `<h2 class="sr-only">크게 빠진 때</h2><div style="margin:0 -12px">${hdr}<div class="rows" data-testid="invest-sec2">${rowsH}</div></div><p class="note pre" style="margin-top:8px">같은 시기에 있었다는 기록이고, 무엇이 원인인지는 말하지 않아요.</p>`;
}
function calc(d, sy, sm, method) {
  const v = d.v, base = d.start, [by, bm] = base.split('-').map(Number), s = (sy - by) * 12 + sm - bm, e = v.length - 1, n = e - s + 1;
  if (method === 'lump') { const b0 = v[s - 1] ?? v[0], mult = v[e] / b0; return { mult, n }; }
  let u = 0, min = 9, mi = s, last = 1; for (let t = s; t <= e; t++) { u += 1 / v[t]; const r = u * v[t] / (t - s + 1); if (r < min) { min = r; mi = t; } last = r; } return { mult: last, min: (min - 1) * 100, mi, n };
}
function sec3(d) {
  const sy = ST.sy, sm = EM, lump = ST.m === 'lump', r = calc(d, sy, sm, ST.m), mult = +r.mult.toFixed(2), tot = (mult - 1) * 100, cagr = (Math.pow(mult, 12 / r.n) - 1) * 100;
  const mt = ymOfI(d, r.mi ?? 0);
  const sentence = lump ? `${sy}년 ${sm}월에 한 번에 넣었다면, 지금 ${d.label} 지수 기준 원금의` : `${sy}년 ${sm}월부터 매달 같은 금액을 넣었다면, 지금 ${d.label} 지수 기준 넣은 돈의`;
  const sub = lump ? `해마다 평균 <b class="sb up">${fp(cagr)}</b> 오른 셈이에요` : `가장 낮았던 달은 ${mt[0]}년 ${mt[1]}월, <b class="sb ${r.min < 0 ? 'dn' : 'up'}">${fp(r.min)}</b>였어요`;
  const chips = d.cur === '달러' ? '<span class="chip">달러 기준</span>' : '<span class="chip">포인트 기준</span>';
  return `<section id="sec3" data-testid="invest-sec3"><div class="card"><div class="sec-t">기간을 골라 계산해 보기 <small>금액은 입력하지 않아요</small></div>
  <div class="seg hit" role="tablist" aria-label="넣는 방식"><button data-m="lump" class="${lump ? 'on' : ''}" role="tab" aria-selected="${lump}">한 번에</button><button data-m="month" class="${lump ? '' : 'on'}" role="tab" aria-selected="${!lump}">매달</button></div>
  <div class="sel" style="margin-top:10px"><div class="f"><span><small>시작</small>&nbsp; ${sy}년 ${sm}월</span><span class="mf">⌄</span></div><div class="f"><span><small>끝</small>&nbsp; 지금까지</span><span class="mf">⌄</span></div></div>
  <div class="ci" style="margin:12px 0 0">${chips}<span class="chip">지수 값만(배당 빼고)</span></div>
  <div class="res" data-testid="calc-result"><div class="tsm bal">${sentence}</div><div class="t2xl b" style="margin:4px 0 6px;display:flex;align-items:baseline;gap:8px">${mult.toFixed(2)}배<span class="tsm sb up" style="margin-left:2px">${fp(tot, 0)}</span></div><div class="txs mf">${sub}</div></div>
  <p class="note" style="margin-top:12px">배당을 다시 넣었다면 결과는 이보다 커요.</p><p class="note" style="margin-top:4px">과거 지수 값으로 계산한 결과예요. 배당·세금·수수료는 빼고, 앞으로의 수익을 뜻하지 않아요.</p></div></section>`;
}
const TOP = () => `<div class="top"><div class="logo">S</div><div class="nav1"><span>상세</span><span>성과</span><span class="on">투자</span></div><span class="chip" style="height:20px;font-size:11px;padding:0 7px;color:var(--imp)">가데이터</span><div class="ico"><i></i></div><div class="ico"><i></i></div></div>`;
const IDXSEL = () => `<div class="seg hit" role="tablist" aria-label="지수 선택" data-testid="invest-index">${[['spx', 'S&amp;P 500'], ['ndx', '나스닥100'], ['kospi', '코스피']].map(([k, l]) => `<button class="${ST.idx === k ? 'on' : ''}" data-i="${k}" role="tab" aria-selected="${ST.idx === k}">${l}</button>`).join('')}</div>`;

/* ---------- 조립 ---------- */
function render() {
  const d = cur(); if (WIDE && ST.sel == null) ST.sel = d.eps.reduce((b, e, k, a) => e.dd < a[b].dd ? k : b, 0);
  const CW = VW >= 1000 ? 1000 : VW - 32 - 32, LW = WIDE ? 400 - 32 : VW - 32 - 32 + 24 - 0; // 차트 폭 / 목록 폭
  const mc = mainChart(d, CW, { sel: ST.sel, yr: ST.yr });
  const src = `<div class="src">${d.cur === '달러' ? '달러 기준 · ' : ''}가격 지수(배당 제외) · 월말 종가 · 금리는 ${d.rate === 'us' ? '연준' : '한국은행'} 발표 값 · 지수 값은 가데이터</div>`;
  const card1 = `<div class="card tight" data-testid="invest-sec1">${headline(d)}<div style="margin-top:12px">${mc.svg}</div>${WIDE ? src : ''}${WIDE ? '' : `<div style="margin-top:4px" data-testid="invest-list">${listHTML(d, VW - 32 - 32 + 24, true)}</div>`}</div>`;
  let body;
  if (!WIDE) body = `${IDXSEL()}${card1}${sec3(d)}`;
  else { const e = d.eps[ST.sel]; body = `${IDXSEL()}${card1}<div class="two"><div class="card tight" data-testid="invest-list">${listHTML(d, 400 - 32 + 24, false)}</div><div class="card sticky" data-testid="invest-detail"><div class="sec-t" style="margin-bottom:6px">${e.name} <small>${e.ps}~${e.ts}</small></div>${detail(d, e, 560 - 8, ST.sel)}</div></div><div style="max-width:560px">${sec3(d)}</div>`; }
  document.body.innerHTML = `<div class="app">${TOP()}<main class="wrap" id="main">${body}<div class="src" style="text-align:center">지수는 공개 통계의 월말 요약값이에요 · S&amp;P 500은 S&amp;P Dow Jones Indices의 상표예요 · 기준일 ${EY}.${EM}.30</div></main></div>`;
  // 상호작용(목업)
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { ST.idx = b.dataset.i; ST.sel = null; ST.yr = null; render(); });
  document.querySelectorAll('.row').forEach(b => b.onclick = () => { const k = +b.dataset.k; ST.sel = (!WIDE && ST.sel === k) ? null : k; ST.yr = null; render(); });
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { ST.m = b.dataset.m; render(); });
  const hit = $('#mc .hit'); if (hit) hit.addEventListener('pointerdown', ev => { const r = $('#mc').getBoundingClientRect(), g = mc.geo, i = Math.floor((ev.clientX - r.left - g.GX) / g.PW * g.n); const y = ymOfI(d, Math.max(0, Math.min(g.n - 1, i)))[0]; const k = d.eps.findIndex(e => i >= e.p && i <= e.t + 1); ST.yr = y; if (k >= 0) ST.sel = k; render(); });
}
render();
