/* #263 R2.5 목업 — 연 단위 재설계. 값의 출처는 data.js(= data/*.csv, build-data.js 계산). 코드 아님, 시안용
   쿼리: w=390|320|1280 theme=dark idx=spx|ndx|kospi ep=<행번호> yr=<연도> m=lump|yearly sy=<시작연도> ey=<끝연도> asof=2022(진행 중 모의: 코스피만) */
const Q = new URLSearchParams(location.search);
const VW = +(Q.get('w') || 390), WIDE = VW >= 1000, DARK = Q.get('theme') === 'dark';
document.documentElement.className = (DARK ? 'dark ' : '') + (WIDE ? 'wide' : '');
const $ = (s, r = document) => r.querySelector(s);
const MINUS = '−';
const fp = (v, d = 1) => (v > 0 ? '+' : v < 0 ? MINUS : '') + Math.abs(v).toFixed(d) + '%';
const fr = v => (Math.round(v * 100) / 100).toString().replace(/(\.\d)0$/, '$1') + '%';
const lvl = v => v >= 10 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
const ST = { idx: Q.get('idx') || 'spx', sel: Q.get('ep') != null ? +Q.get('ep') : null, yr: Q.get('yr') ? +Q.get('yr') : null, m: Q.get('m') || 'lump', sy: +(Q.get('sy') || 2015), ey: +(Q.get('ey') || DATA.last) };
const SIM = Q.get('asof') === '2022' ? 'kospi' : null;
const cur = () => (SIM && ST.idx === SIM) ? DATA.sim[SIM] : DATA.idx[ST.idx];
const pad = n => String(n).padStart(2, '0');
const PH = { down: '내려감', up: '올라감', flat: '거의 그대로', none: '금리 자료 없음' };
const PHV = { down: '내려갔어요', up: '올라갔어요', flat: '거의 그대로였어요' };
let UID = 0;

function logTicks(min, max, maxN) {
  for (const lad of [[1, 2, 5], [1, 3]]) { const t = []; for (let e = -1; e <= 7; e++) lad.forEach(m => t.push(m * Math.pow(10, e)));
    const lo = Math.max(...t.filter(x => x <= min)), hi = Math.min(...t.filter(x => x >= max)), tk = t.filter(x => x >= lo && x <= hi); if (tk.length <= maxN || lad.length === 2) return { lo, hi, tk }; }
}
const rv = (d, Y, m) => DATA.rates[d.rate].m[Y + '-' + pad(m)];
// 월별 금리 계단(시간 t0~t1, 소수 연도). 값 없는 달은 건너뜀
function stepPath(d, X, Yf, t0, t1, closeTo) {
  let q = '', started = false, prevV = null;
  for (let mi = Math.floor(t0 * 12 + 1e-6); mi < Math.ceil(t1 * 12 - 1e-6); mi++) { const Y = Math.floor(mi / 12), m = mi % 12 + 1, v = rv(d, Y, m); if (v == null) continue;
    const xa = X(Math.max(t0, mi / 12)), xb = X(Math.min(t1, (mi + 1) / 12));
    if (!started) { q += `M${xa.toFixed(1)},${closeTo != null ? closeTo : Yf(v).toFixed(1)}${closeTo != null ? `L${xa.toFixed(1)},${Yf(v).toFixed(1)}` : ''}`; started = true; } else if (v !== prevV) q += `V${Yf(v).toFixed(1)}`;
    q += `H${xb.toFixed(1)}`; prevV = v; }
  return q;
}
function mainChart(d, W, o = {}) {
  const uid = ++UID, n = d.years.length, y0 = d.start, last = d.last, GX = 44, RP = 8, PW = W - GX - RP, span = last - y0;
  const X = t => GX + (t - (y0 + 1)) / span * PW, XE = Y => X(Y + 1), BW = PW / span; // XE: 그해 12월 31일(= 연말값 위치)
  const H1 = WIDE ? 190 : 100, H2 = WIDE ? 72 : 52, H3 = WIDE ? 64 : 44, R = DATA.rates[d.rate];
  const close = d.close, ix = Y => close[Y - y0];
  const T1 = logTicks(Math.min(...close), Math.max(...close), H1 >= 150 ? 8 : 6), lnLo = Math.log(T1.lo), lnHi = Math.log(T1.hi);
  const rets = d.ret.filter(x => x != null), rrange = Math.max(...rets) - Math.min(...rets), rstep = rrange > 120 ? 50 : 20;
  const bmax = Math.ceil(Math.max(...rets) / rstep) * rstep, bmin = Math.floor(Math.min(...rets) / rstep) * rstep;
  const P1 = 24, P1b = P1 + H1, cap2 = P1b + 19, P2 = P1b + 32, P2b = P2 + H2;
  // 이름표: 시간 순, 최대 2단(넘치면 가장 얕은 하락 생략)
  const shortN = s => s.replace(' 버블 붕괴', '').replace('글로벌 ', '').replace(/(\d{4})년 하락/, '$1년').replace('1973~74년 하락', '73~74년').replace('1990~91년 하락', '90~91년');
  const cw = s => [...s].reduce((a, c) => a + (/[0-9a-zA-Z.%~]/.test(c) ? 6.6 : c === ' ' ? 3.8 : 12.2), 0);
  let labs = d.eps.map((e, k) => { const cx = (XE(e.py) + XE(e.ty)) / 2, t = shortN(e.name) + (e.ongoing ? '·진행 중' : ''), w = cw(t); return { k, e, t, w, x0: Math.max(GX, Math.min(W - w - 2, cx - w / 2)) }; });
  const place = L => { const tiers = [[], []]; const ok = []; for (const l of L) { let tr = tiers.findIndex(a => !a.some(q => l.x0 < q.x1 + 6 && l.x0 + l.w > q.x0 - 6)); if (tr < 0) { l.drop = true; continue; } tiers[tr].push({ x0: l.x0, x1: l.x0 + l.w }); l.r = tr; ok.push(l); } return ok; };
  let ord = [...labs].sort((a, b) => a.e.dd - b.e.dd); // 깊은 것 먼저 배치 → 얕은 것이 탈락
  const tiers = [[], []]; ord.forEach(l => { const tr = tiers.findIndex(a => !a.some(q => l.x0 < q.x1 + 6 && l.x0 + l.w > q.x0 - 6)); if (tr < 0) l.drop = true; else { tiers[tr].push({ x0: l.x0, x1: l.x0 + l.w }); l.r = tr; } });
  const nr = Math.max(1, ...labs.filter(l => !l.drop).map(l => l.r + 1)), LB = nr * 14 + 4;
  const cap3 = P2b + LB + 16, P3 = cap3 + 26, P3b = P3 + H3, AX = P3b + 15, H = AX + 4;
  const Y1 = v => P1 + H1 - (Math.log(v) - lnLo) / (lnHi - lnLo) * H1, Y2 = p => P2 + (bmax - p) / (bmax - bmin) * H2;
  const rmax = d.rate === 'us' ? 10 : 6, rst = d.rate === 'us' ? 5 : 2, Y3 = r => P3b - r / rmax * H3;
  const ep = o.sel != null ? d.eps[o.sel] : null, yr = o.yr;
  let s = `<svg id="mc" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;touch-action:pan-y;user-select:none" role="img" aria-label="${d.label} 연말 지수, 연간 등락, ${R.label}를 같은 시간축에 세 줄로 나눈 그림">
<defs><pattern id="hz${uid}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="var(--fg)" opacity=".55"/></pattern></defs>`;
  // 캡션
  s += `<text class="cap" x="0" y="11">지수 · 해마다 연말 값<tspan dx="5" data-ih="1">ⓘ</tspan></text>`;
  // 선택 면
  if (ep) { const a = XE(ep.py), b = XE(ep.ty); s += [[P1, H1], [P2, H2]].map(([p, h]) => `<rect x="${a}" y="${p - 2}" width="${b - a}" height="${h + 4}" rx="3" fill="var(--brandsoft)"/>`).join(''); }
  if (yr != null) { const a = X(yr), b = X(yr + 1); s += [[P1, H1], [P2, H2]].map(([p, h]) => `<rect x="${a}" y="${p}" width="${b - a}" height="${h}" fill="var(--brandsoft)"/>`).join(''); }
  // 10년 세로선(연말선): 세 패널 관통
  const decs = []; for (let Y = Math.ceil((y0 + 1) / 10) * 10; Y <= last; Y += 10) decs.push(Y);
  decs.forEach(Y => { s += `<line x1="${XE(Y)}" x2="${XE(Y)}" y1="${P1}" y2="${P3b}" stroke="var(--ink3)" stroke-width=".8" opacity=".75"/>`; });
  // 지수 패널 눈금
  T1.tk.forEach(t => { const y = Y1(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="var(--hair)"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${lvl(t)}</text>`; });
  const pts = close.map((v, i) => [XE(d.years[i]), Y1(v)]);
  const path = (a, b) => { let q = ''; for (let i = a; i <= b; i++) q += (i === a ? 'M' : 'L') + pts[i][0].toFixed(1) + ',' + pts[i][1].toFixed(1); return q; };
  s += `<path d="${path(0, n - 1)}L${pts[n - 1][0]},${P1b}L${pts[0][0]},${P1b}Z" fill="var(--fg)" opacity=".05"/><path d="${path(0, n - 1)}" fill="none" stroke="var(--fg)" stroke-opacity=".85" stroke-width="1.4" stroke-linejoin="round"/>`;
  d.eps.forEach((e, k) => { const a = e.py - y0, b = e.ty - y0, on = o.sel == null || o.sel === k; s += `<path d="${path(a, b)}" fill="none" stroke="var(--loss)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="${on ? 1 : .4}"/>`;
    if (!e.ongoing) { /* 회복 */ } });
  if (BW >= 5.5) pts.forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="1.7" fill="var(--card)" stroke="var(--fg)" stroke-width="1" opacity=".8"/>`; });
  d.eps.forEach((e, k) => { const on = o.sel == null || o.sel === k; [[e.py, 'var(--fg)'], [e.ty, 'var(--loss)']].forEach(([Y, f]) => { s += `<circle cx="${XE(Y)}" cy="${Y1(ix(Y))}" r="3.2" fill="${f}" stroke="var(--card)" stroke-width="1.5" opacity="${on ? 1 : .5}"/>`; }); });
  if (ep && ep.ry) { const yy = Y1(ep.pc); s += `<line x1="${XE(ep.py)}" x2="${XE(ep.ry)}" y1="${yy}" y2="${yy}" stroke="var(--ink2)" stroke-dasharray="3 3"/><circle cx="${XE(ep.ry)}" cy="${yy}" r="3.4" fill="var(--card)" stroke="var(--fg)" stroke-width="1.5"/>`; }
  if (yr != null) { const x = XE(yr); s += `<circle cx="${x}" cy="${Y1(ix(yr))}" r="4.6" fill="var(--card)" stroke="var(--brand)" stroke-width="2.2"/>`; }
  // ---- 연간 등락 막대
  s += `<text class="cap" x="0" y="${cap2}">연간 등락</text>`;
  for (let t = bmin; t <= bmax; t += rstep) { const y = Y2(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="${t === 0 ? 'var(--ink3)' : 'var(--hair)'}"/>` + ((t !== 0 && Math.abs(Y2(t) - Y2(0)) < 15) || (rstep === 20 && t % 40 !== 0) || (rstep === 50 && t !== 0 && t !== bmax && t !== bmin) ? '' : `<text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${t === 0 ? '0%' : fp(t, 0)}</text>`); }
  // 하락 전체 기간 띠(고점~전고점 되찾기까지): 연한 회색, 진행 중은 점선
  d.eps.forEach((e, k) => { const a = XE(e.py), b = e.ry ? XE(e.ry) : XE(last), on = o.sel == null || o.sel === k;
    s += `<rect x="${a}" y="${P2}" width="${b - a}" height="${H2}" fill="var(--ink3)" opacity="${on ? .32 : .16}" ${e.ongoing ? 'stroke="var(--ink2)" stroke-dasharray="3 3" stroke-width="1"' : ''}/>`; });
  const inDown = Y => d.eps.findIndex(e => Y > e.py && Y <= e.ty);
  for (let i = 1; i < n; i++) { const Y = d.years[i], r = d.ret[i], xa = X(Y) + .5, w = Math.max(1.2, BW - 1), y0b = Y2(0), y1b = Y2(r), k = inDown(Y), on = o.sel == null || o.sel === k;
    s += `<rect x="${xa.toFixed(1)}" y="${Math.min(y0b, y1b).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(.8, Math.abs(y1b - y0b)).toFixed(1)}" fill="${k >= 0 ? 'var(--loss)' : 'var(--ink2)'}" opacity="${k >= 0 ? (on ? 1 : .45) : .55}"/>`; }
  // 이름표
  labs.forEach(l => { if (l.drop) return; const on = o.sel == null || o.sel === l.k; s += `<text class="nm-l svt" x="${l.x0}" y="${P2b + 12 + l.r * 14}" opacity="${on ? 1 : .6}" data-nm="1">${l.t}</text>`;
    if (l.e.ongoing) s += `<line x1="${l.x0}" x2="${l.x0 + l.w}" y1="${P2b + 15 + l.r * 14}" y2="${P2b + 15 + l.r * 14}" stroke="var(--ink2)" stroke-dasharray="2 2"/>`; });
  // ---- 금리(월별 계단) + 연 단위 방향 띠
  s += `<text class="cap" x="0" y="${cap3}">${R.label} · 매달 값<tspan dx="5" data-ih="2">ⓘ</tspan></text>`;
  const lg = cap3 + 15; let lx = 0;
  s += `<rect x="0" y="${lg - 9}" width="12" height="9" rx="2" fill="var(--ink2)"/><text class="cap" x="16" y="${lg}">올라간 해</text><rect x="${lx = 74}" y="${lg - 9}" width="12" height="9" rx="2" fill="url(#hz${uid})" stroke="var(--ink3)"/><text class="cap" x="${lx + 16}" y="${lg}">내려간 해</text><line x1="${lx = 148}" x2="${lx + 10}" y1="${lg - 4}" y2="${lg - 4}" stroke="var(--ink2)" stroke-width="2" stroke-linecap="round"/><text class="cap" x="${lx + 15}" y="${lg}">거의 그대로</text>`;
  for (let t = 0; t <= rmax; t += rst) { const y = Y3(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="${t === 0 ? 'var(--ink3)' : 'var(--hair)'}"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${t}%</text>`; }
  const tR0 = +R.first.slice(0, 4) + (+R.first.slice(5) - 1) / 12, tA = Math.max(y0 + 1, tR0);
  for (let i = 0; i < n; i++) { const Y = d.years[i], c = d.yrDir[Y] && d.yrDir[Y].k; if (!c || c === 'none' || c === 'flat') continue;
    s += `<path d="${stepPath(d, X, Y3, Y, Y + 1, P3b)}L${X(Y + 1).toFixed(1)},${P3b}Z" fill="${c === 'up' ? 'var(--ink2)' : `url(#hz${uid})`}" ${c === 'down' ? 'stroke="var(--ink3)" stroke-width=".6"' : ''}/>`; }
  s += `<path d="${stepPath(d, X, Y3, tA, last + 1, null)}" fill="none" stroke="var(--fg)" stroke-width="1.3" stroke-linejoin="round"/>`;
  if (tA > y0 + 1) { const a = X(y0 + 1), b = X(tA); s += `<rect x="${a}" y="${P3}" width="${b - a}" height="${H3}" fill="var(--sec)" opacity=".8"/><text class="ax" x="${(a + b) / 2}" y="${P3 + H3 / 2 + 4}" text-anchor="middle">자료 없음</text>`; }
  if (ep) { const a = XE(ep.py), b = XE(ep.ty); s += `<rect x="${a}" y="${P3 - 1}" width="${b - a}" height="${H3 + 2}" rx="3" fill="none" stroke="var(--brand)" stroke-width="2"/>`; }
  if (yr != null) { const a = X(yr), b = X(yr + 1); s += `<rect x="${a}" y="${P3 - 1}" width="${b - a}" height="${H3 + 2}" rx="2" fill="none" stroke="var(--brand)" stroke-width="2"/><line x1="${XE(yr)}" x2="${XE(yr)}" y1="${P1}" y2="${P3b}" stroke="var(--brand)" stroke-width="1.4"/>`; }
  // x축: 연말선 라벨(10년) + 5년 눈금
  for (let Y = Math.ceil((y0 + 1) / 5) * 5; Y <= last; Y += 5) { const x = XE(Y), major = Y % 10 === 0; s += `<line x1="${x}" x2="${x}" y1="${P3b}" y2="${P3b + (major ? 5 : 3)}" stroke="var(--ink3)"/>${major ? `<text class="ax" x="${x}" y="${AX}" text-anchor="middle">${Y}</text>` : ''}`; }
  s += `<text class="ax" x="${XE(last) + 2}" y="${AX}" text-anchor="end" opacity="0"></text><rect class="hit" x="${GX}" y="${P1 - 6}" width="${PW}" height="${P3b - P1 + 6}" fill="transparent"/></svg>`;
  return { svg: s, geo: { GX, PW, y0, last, span } };
}
function readout(d, Y) {
  const r = d.ret[Y - d.start], c = d.yrDir[Y], dir = !c || c.k === 'none' ? '금리 자료 없음' : '금리 ' + PH[c.k];
  return `<span>${Y}년 말 <b>${lvl(d.close[Y - d.start])}</b></span><span>·</span><b class="${r < 0 ? 'dn' : 'up'}">${fp(r)}</b><span>·</span><span class="mf">${dir}</span>`;
}
/* ---------- 구간 확대: 고점 1년 전 ~ 전고점 되찾은 해 + 1 ---------- */
function zoomChart(d, e, W) {
  const uid = ++UID, GX = 44, RP = 12, PW = W - GX - RP, a = Math.max(d.start, e.py - 1), z = Math.min(d.last, (e.ry ?? d.last) + 1), span = z - a, X = t => GX + (t - (a + 0)) / span * PW, XE = Y => X(Y);
  // 도메인: 연말 a ~ 연말 z (t = 연말 위치)
  const R = DATA.rates[d.rate], close = d.close, ix = Y => close[Y - d.start];
  const seg = []; for (let Y = a; Y <= z; Y++) seg.push(ix(Y));
  const T1 = logTicks(Math.min(...seg), Math.max(...seg), 5), lnLo = Math.log(T1.lo), lnHi = Math.log(T1.hi);
  const H1 = WIDE ? 130 : 104, H3 = WIDE ? 54 : 44, P1 = 14, P1b = P1 + H1, cap3 = P1b + 26, P3 = cap3 + 10, P3b = P3 + H3, AX = P3b + 16, H = AX + 4;
  const Y1 = v => P1 + H1 - (Math.log(v) - lnLo) / (lnHi - lnLo) * H1;
  const mv = []; for (let mi = (a + 1) * 12; mi < (z + 1) * 12; mi++) { const v = rv(d, Math.floor(mi / 12), mi % 12 + 1); if (v != null) mv.push(v); }
  const rmax = d.rate === 'us' ? (Math.max(...mv, 0) > 6 ? 10 : Math.max(...mv, 0) > 4 ? 6 : 4) : (Math.max(...mv, 0) > 4 ? 6 : 4), rst = rmax > 6 ? 5 : 2, Y3 = r => P3b - r / rmax * H3;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block" role="img" aria-label="${e.name} 구간 확대. 연말 지수와 ${R.label}"><defs><pattern id="hz${uid}" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1.6" height="4" fill="var(--fg)" opacity=".55"/></pattern></defs>`;
  T1.tk.forEach(t => { const y = Y1(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="var(--hair)"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${lvl(t)}</text>`; });
  const stepY = Math.max(1, Math.ceil(span / (W < 300 ? 4 : 6)));
  for (let Y = a; Y <= z; Y++) { const x = XE(Y); s += `<line x1="${x}" x2="${x}" y1="${P1}" y2="${P3b}" stroke="var(--hair)" stroke-width=".8"/>`; }
  const pth = (p, q) => { let r = ''; for (let Y = p; Y <= q; Y++) r += (Y === p ? 'M' : 'L') + XE(Y).toFixed(1) + ',' + Y1(ix(Y)).toFixed(1); return r; };
  s += `<line x1="${XE(e.py)}" x2="${XE(Math.min(z, e.ry ?? z))}" y1="${Y1(e.pc)}" y2="${Y1(e.pc)}" stroke="var(--ink2)" stroke-dasharray="3 3" opacity=".8"/>`;
  s += `<path d="${pth(a, z)}" fill="none" stroke="var(--fg)" stroke-opacity=".9" stroke-width="1.5" stroke-linejoin="round"/><path d="${pth(e.py, e.ty)}" fill="none" stroke="var(--loss)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`;
  for (let Y = a; Y <= z; Y++) s += `<circle cx="${XE(Y)}" cy="${Y1(ix(Y))}" r="2" fill="var(--card)" stroke="var(--fg)" stroke-width="1"/>`;
  const dot = (Y, f, txt, dy, an) => `<circle cx="${XE(Y)}" cy="${Y1(ix(Y))}" r="4" fill="${f}" stroke="var(--sec)" stroke-width="2"/><text class="nm-l svt" style="stroke:var(--sec)" x="${XE(Y)}" y="${Y1(ix(Y)) + dy}" text-anchor="${an || 'middle'}">${txt}</text>`;
  s += dot(e.py, 'var(--fg)', '고점', -9, XE(e.py) < GX + 22 ? 'start' : 'middle') + dot(e.ty, 'var(--loss)', '바닥', 17);
  if (e.ry && e.ry <= z) s += dot(e.ry, 'var(--sec)', '전고점 되찾음', -9, XE(e.ry) > W - RP - 46 ? 'end' : 'middle').replace('fill="var(--sec)" stroke="var(--sec)"', 'fill="var(--sec)" stroke="var(--fg)"');
  s += `<text class="cap" x="0" y="${cap3}">${R.label} · 매달 값</text>`;
  for (let t = 0; t <= rmax; t += rst) { const y = Y3(t); s += `<line x1="${GX}" x2="${W - RP}" y1="${y}" y2="${y}" stroke="${t === 0 ? 'var(--ink3)' : 'var(--hair)'}"/><text class="ax" x="${GX - 6}" y="${y + 4}" text-anchor="end">${t}%</text>`; }
  for (let Y = a + 1; Y <= z; Y++) { const c = d.yrDir[Y] && d.yrDir[Y].k; if (!c || c === 'none' || c === 'flat') continue; s += `<path d="${stepPath(d, tt => X(tt - 1), Y3, Y, Y + 1, P3b)}L${X(Y).toFixed(1)},${P3b}Z" fill="${c === 'up' ? 'var(--ink2)' : `url(#hz${uid})`}" ${c === 'down' ? 'stroke="var(--ink3)" stroke-width=".6"' : ''}/>`; }
  // 월 계열: 구간 [a, z] 연말 기준 → 달력 t = 연말 위치 그대로(해 Y 연말 = Y+1.0 이므로 보정)
  s += `<path d="${stepPath(d, tt => X(tt - 1), Y3, a + 1, z + 1, null)}" fill="none" stroke="var(--fg)" stroke-width="1.3" stroke-linejoin="round"/>`;
  if (!mv.length) s += `<rect x="${GX}" y="${P3}" width="${PW}" height="${H3}" fill="var(--sec)" opacity=".8"/><text class="ax" x="${GX + PW / 2}" y="${P3 + H3 / 2 + 4}" text-anchor="middle">자료 없음</text>`;
  [e.py, e.ty].forEach(Y => { s += `<rect x="${XE(Y) - 1}" y="${P3b}" width="2" height="6" fill="${Y === e.py ? 'var(--fg)' : 'var(--loss)'}"/>`; });
  for (let Y = a; Y <= z; Y++) { if ((Y - a) % stepY && Y !== z) continue; if (Y !== z && z - Y < stepY / 2) continue; const x = XE(Y); s += `<text class="ax" x="${x}" y="${AX + 3}" text-anchor="${x < GX + 14 ? 'start' : x > W - RP - 14 ? 'end' : 'middle'}">${Y}</text>`; }
  return s + '</svg>';
}
function detail(d, e, W, k) {
  const sw = { down: 'dn-s', up: 'up-s' }[e.dir], rt = e.dir === 'none' ? `<span class="mf" style="font-weight:400">자료가 없어요</span>` : `${e.dir === 'flat' ? '<i class="dash"></i> ' : `<i class="sw ${sw}" style="margin-right:6px"></i>`}${PHV[e.dir]}<span class="txs mf" style="display:block;font-weight:400">${fr(e.rf)}에서 ${fr(e.rt)}로</span>`;
  const inner = d.eps.filter(q => q !== e && q.py > e.ty && e.ry && q.py < e.ry);
  const nt = [inner.length ? `전고점을 되찾는 동안 '${inner[0].name}' 하락이 한 번 더 있었어요.` : '', d.eps.indexOf(e) === 0 && d.rate === 'kr' && e.dir === 'none' ? '한국은행 기준금리는 1999년 5월부터 자료가 있어요.' : '', e.dir === 'none' && d.rate === 'us' ? '연준 기준금리 목표는 1982년 9월부터 자료가 있어요.' : ''].filter(Boolean).join(' ');
  return `<div class="ex fadein" data-testid="episode-detail" data-ep="${k}">
  <div style="display:flex;align-items:baseline;gap:10px;flex-wrap:wrap"><div class="big dn" data-testid="detail-dd">${fp(e.dd)}</div><div class="txs mf">고점 ${e.py}년 말 · 바닥 ${e.ty}년 말${e.ongoing ? ' · 진행 중' : ''}</div></div>
  <div class="trio"><div><div class="l">고점에서 바닥까지</div><div class="v">${e.ty - e.py}년</div></div><div><div class="l">고점에서 전고점까지<span class="ih" role="button" aria-label="기간 기준 설명">i</span></div><div class="v">${e.ry ? (e.ry - e.py) + '년' : '아직이에요'}</div></div><div><div class="l">그 사이 금리</div><div class="v" style="font-size:13px">${rt}</div></div></div>
  <div style="margin-top:12px;margin-left:-2px">${zoomChart(d, e, W)}</div>
  ${nt ? `<div class="txs mf pre" style="margin-top:6px">${nt}</div>` : ''}${e.event ? `<div class="evl pre"><span class="mf">같은 시기 사건</span>${e.event}</div>` : ''}</div>`;
}
/* ---------- 머리·목록·③ ---------- */
function headline(d) {
  const who = d.rate === 'us' ? '미국' : '한국', cnt = { down: 0, up: 0, flat: 0, none: 0 }; d.eps.forEach(e => cnt[e.dir]++);
  const done = d.eps, bits = [['down', '내려갔'], ['up', '올라갔'], ['flat', '거의 그대로였']].filter(([k]) => cnt[k]);
  const t2 = bits.map(([k, v], i) => `${i === 0 ? `<b class="sb" style="color:var(--fg)">${cnt[k]}번 ${v}${i === bits.length - 1 ? '어요' : '고'}</b>` : `${cnt[k]}번 ${v}${i === bits.length - 1 ? '어요' : '고'}`}`).join(', ');
  const none = cnt.none ? ` (${cnt.none}번은 금리 자료 없음)` : '';
  const B = d.base, w = d.start + 1;
  const base = `${who} 금리 자료가 있는 ${B.n}년 중 내려간 해는 ${B.down}년, 올라간 해는 ${B.up}년, 거의 그대로인 해는 ${B.flat}년이었어요`;
  return `<div data-testid="invest-headline"><div class="head1 bal">${w}년 이후 연말 기준 ${DATA.T}% 넘게 빠진 때는 ${d.eps.length}번이었어요</div><div class="head2 pre">그 사이 ${who} 금리는 ${t2}${none}</div><div class="base pre" data-testid="invest-base">${base}</div></div>`;
}
function listHTML(d, W, inline) {
  const dmax = Math.max(...d.eps.map(e => -e.dd)) > 60 ? 80 : 60, dstep = 20, ticks = []; for (let t = 0; t <= dmax; t += dstep) ticks.push(t);
  const rowsH = d.eps.map((e, k) => { const open = ST.sel === k, hl = ST.yr != null && ST.yr > e.py && ST.yr <= e.ty;
    const mk = e.dir === 'down' ? '<i class="sw dn-s"></i>' : e.dir === 'up' ? '<i class="sw up-s"></i>' : e.dir === 'flat' ? '<i class="dash"></i>' : '';
    return `<div class="rowbox ${open ? 'open' : ''}" data-testid="drop-row"><button class="row ${hl ? 'hl' : ''}" data-k="${k}" aria-expanded="${open}"><div class="r1"><span class="nm">${e.name}${e.ongoing ? '<span class="ongo">진행 중</span>' : ''}</span><span class="rc">${mk}${PH[e.dir]}<span class="chev" aria-hidden="true">›</span></span></div><div class="r2"><div class="trk">${ticks.slice(1).map(t => `<i class="t" style="left:${t / dmax * 100}%"></i>`).join('')}<i class="f" style="width:${-e.dd / dmax * 100}%"></i></div></div></button>${open && inline ? detail(d, e, W - 24, k) : ''}</div>`; }).join('');
  const tw = W - 24 - 24; // 막대 트랙 폭(행 패딩 12 + 쉐브론 24)
  const scale = `<div class="axrow" style="margin:10px 12px 0 12px;height:14px" aria-hidden="true">${ticks.slice(1).map(t => `<span style="left:${t / dmax * tw}px;transform:translateX(${t === dmax ? '-100%' : '-50%'})">${fp(-t, 0)}</span>`).join('')}</div>`;
  const ex = d.ret[2020 - d.start];
  return `<div class="lh"><div class="t">크게 빠진 때</div><div class="s pre">연말 기준 고점 대비 ${DATA.T}% 넘게 빠진 때예요. 연말만 재서 장중 저점보다 얕게 나와요</div></div>${scale}<div class="rows" data-testid="invest-sec2" style="margin:2px -12px 0">${rowsH}</div>
  <p class="note pre" style="margin-top:8px">한 해 안에서 빠졌다가 같은 해에 되돌린 하락은 이 목록에 없어요. 예를 들어 2020년 ${d.label}는 연간 ${fp(ex)}로 끝나, 그해 3월의 급락은 안 보여요.</p><p class="note pre" style="margin-top:4px">같은 시기에 있었다는 기록이고, 무엇이 원인인지는 말하지 않아요.</p>`;
}
function calc(d, sy, ey, method) {
  const c = d.close, i0 = sy - d.start, i1 = ey - d.start, n = ey - sy;
  if (method === 'lump') return { mult: c[i1] / c[i0], n };
  let dep = 0, min = 9, mi = i0 + 1, lastR = 1; for (let t = i0; t < i1; t++) { dep += 1 / c[t]; } let u = 0; for (let t = i0 + 1; t <= i1; t++) { u = 0; for (let k = i0; k < t; k++) u += 1 / c[k]; const r = u * c[t] / (t - i0); if (r < min) { min = r; mi = t; } lastR = r; }
  return { mult: lastR, min: (min - 1) * 100, my: d.years[mi], n };
}
function sec3(d) {
  const sy = Math.min(Math.max(ST.sy, d.start), d.last - 2), ey = ST.ey, lump = ST.m === 'lump', r = calc(d, sy, ey, ST.m), mult = +r.mult.toFixed(2), tot = (mult - 1) * 100, cagr = (Math.pow(mult, 1 / r.n) - 1) * 100;
  const sentence = lump ? `${sy}년 말에 한 번에 넣었다면, ${ey}년 말 ${d.label} 지수 기준 넣은 돈의` : `${sy}년 말부터 해마다 같은 금액을 ${r.n}번 넣었다면, ${ey}년 말 ${d.label} 지수 기준 넣은 돈 합계의`;
  const sub = lump ? `해마다 평균 <b class="sb ${cagr < 0 ? 'dn' : 'up'}">${fp(cagr)}</b> ${cagr < 0 ? '내린' : '오른'} 셈이에요` : `가장 낮았던 해 말은 ${r.my}년 말, <b class="sb ${r.min < 0 ? 'dn' : 'up'}">${fp(r.min)}</b>였어요`;
  const chips = d.cur === '달러' ? '<span class="chip">달러 기준</span>' : '<span class="chip">포인트 기준</span>';
  return `<section id="sec3" data-testid="invest-sec3"><div class="card"><div class="sec-t">그해 말에 넣었다면 <small>금액은 입력하지 않아요</small></div>
  <div class="seg hit" role="tablist" aria-label="넣는 방식"><button data-m="lump" class="${lump ? 'on' : ''}" role="tab" aria-selected="${lump}">한 번에</button><button data-m="yearly" class="${lump ? '' : 'on'}" role="tab" aria-selected="${!lump}">해마다</button></div>
  <div class="sel" style="margin-top:10px"><div class="f"><span><small>시작</small>&nbsp; ${sy}년 말</span><span class="mf">⌄</span></div><div class="f"><span><small>끝</small>&nbsp; ${ey}년 말</span><span class="mf">⌄</span></div></div>
  <div class="ci" style="margin:12px 0 0">${chips}<span class="chip">지수 값만(배당 빼고)</span></div>
  <div class="res" data-testid="calc-result"><div class="tsm bal">${sentence}</div><div class="t2xl b" style="margin:4px 0 6px;display:flex;align-items:baseline;gap:8px">${mult.toFixed(2)}배<span class="tsm sb ${tot < 0 ? 'dn' : 'up'}" style="margin-left:2px">${fp(tot, 0)}</span></div><div class="txs mf">${sub}</div></div>
  <p class="note" style="margin-top:12px">배당을 다시 넣었다면 결과는 이보다 커요.</p><p class="note" style="margin-top:4px">과거 연말 지수 값으로 계산한 결과예요. 배당·세금·수수료는 빼고, 앞으로도 같다는 뜻은 아니에요.</p></div></section>`;
}
const WK = { spx: ['S&P 500', 'en', '1386627454', '「S&P 500」'], ndx: ['나스닥100', 'en', '1381716602', '「Nasdaq-100」'], kospi: ['코스피', 'ko', '42210370', '「코스피」'] };
function srcHTML(d) {
  const k = d.key, w = WK[k], rate = d.rate === 'us' ? '금리는 미국 연방준비제도(연준) 발표 값(FRED 경유)이에요' : '금리는 한국은행 발표 값이에요', who = d.rate === 'us' ? '' : '';
  const l1 = `지수 연말값: 위키백과 ${w[3]}(${w[1] === 'en' ? '영문' : '한국어'} 문서, 리비전 ${w[2]}, CC BY-SA 4.0)의 표를 바탕으로 시크릿에셋이 다시 계산·가공했어요.` + (k === 'spx' ? ' 연말 지수 수준은 Damodaran(NYU Stern) 연말값을 썼고 위키 등락률과 일치함을 확인했어요(수준값 출처 판정 대기).' : '') + (k === 'ndx' ? ` 2002~2004년 값은 다른 자료와 최대 0.6% 달라 확인 중이에요.` : '') + (k === 'kospi' ? ' 1998년 등락률은 표의 %가 아니라 종가로 다시 계산했어요.' : '');
  const l2 = `가격 지수(배당 제외) · ${d.cur === '달러' ? '미국 지수는 달러 기준 · ' : ''}연말 종가 기준 · ${rate} · 기준일 2025.12.31 · 가공 데이터는 같은 조건(CC BY-SA 4.0)으로 공개해요`;
  const l3 = `${w[0] === '코스피' ? 'KOSPI는 한국거래소' : k === 'spx' ? 'S&P 500은 S&P Dow Jones Indices' : 'Nasdaq-100은 Nasdaq, Inc.'}의 상표이며, 시크릿에셋은 이 기관과 제휴 관계가 아니에요. 과거 시장 사실이며 투자 권유가 아니에요.`;
  return `<div class="src" data-testid="invest-source"><p>${l1}</p><p>${l2}</p><p>${l3}</p></div>`;
}
const TOP = d => `<div class="top"><div class="logo">S</div><div class="nav1"><span>상세</span><span>성과</span><span class="on">투자</span></div>${d.key === 'spx' ? '<span class="chip q" data-testid="pending-chip"><span class="lg">수준값 </span>출처 확인 중</span>' : ''}<div class="ico"><i></i></div><div class="ico"><i></i></div></div>`;
const IDXSEL = () => `<div class="seg hit" role="tablist" aria-label="지수 선택" data-testid="invest-index">${[['spx', 'S&amp;P 500'], ['ndx', '나스닥100'], ['kospi', '코스피']].map(([k, l]) => `<button class="${ST.idx === k ? 'on' : ''}" data-i="${k}" role="tab" aria-selected="${ST.idx === k}">${l}</button>`).join('')}</div>`;
function render() {
  const d = cur(); if (WIDE && ST.sel == null) ST.sel = d.eps.reduce((b, e, k, a) => e.dd < a[b].dd ? k : b, 0);
  const CW = WIDE ? 1000 : VW - 32 - 32, LW = WIDE ? 400 - 32 + 24 : VW - 32 - 32 + 24;
  const mc = mainChart(d, CW, { sel: ST.sel, yr: ST.yr });
  const rdy = ST.yr != null ? ST.yr : null;
  const rd = `<div class="rd" data-testid="invest-readout" aria-live="polite">${rdy != null ? readout(d, rdy) : '<span class="hint">해를 누르거나 끌면 그해 말 값이 나와요</span>'}</div>`;
  const foot = `<p class="note pre" style="margin-top:6px">지수는 연말 값, 금리는 매달 값이라 해상도가 달라요.</p>`;
  const card1 = `<div class="card tight" data-testid="invest-sec1">${headline(d)}${rd}${mc.svg}${WIDE ? '' : `<div data-testid="invest-list">${listHTML(d, VW - 32 - 32 + 24, true)}</div>`}</div>`;
  let body;
  if (!WIDE) body = `${IDXSEL()}${card1}${sec3(d)}`;
  else { const e = d.eps[ST.sel]; body = `${IDXSEL()}${card1}<div class="two"><div class="card tight" data-testid="invest-list">${listHTML(d, LW, false)}</div><div class="card sticky" data-testid="invest-detail"><div class="sec-t" style="margin-bottom:6px">${e.name} <small>${e.py}~${e.ty}년</small></div>${detail(d, e, 560 - 8, ST.sel)}</div></div><div style="max-width:560px">${sec3(d)}</div>`; }
  document.body.innerHTML = `<div class="app">${TOP(d)}<main class="wrap" id="main">${body}${srcHTML(d)}</main></div>`;
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { ST.idx = b.dataset.i; ST.sel = null; ST.yr = null; render(); });
  document.querySelectorAll('.row').forEach(b => b.onclick = () => { const k = +b.dataset.k; ST.sel = (!WIDE && ST.sel === k) ? null : k; ST.yr = null; render(); });
  document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { ST.m = b.dataset.m; render(); });
  const hit = $('#mc .hit'); if (hit) hit.addEventListener('pointerdown', ev => { const r = $('#mc').getBoundingClientRect(), g = mc.geo, t = (ev.clientX - r.left - g.GX) / g.PW * g.span + g.y0 + 1; const Y = Math.max(g.y0 + 1, Math.min(g.last, Math.floor(t))); ST.yr = Y; const k = d.eps.findIndex(e => Y > e.py && Y <= e.ty); if (k >= 0) ST.sel = k; render(); });
}
render();
