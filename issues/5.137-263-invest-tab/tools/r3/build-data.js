// 사용: node build-data.js  → data.js (window.DATA). 값은 ../../data/*.csv 에서만 읽는다(하드코딩 0).
// 정의 한 벌: ① 연 금리 방향 = 전년 12월 말 → 그해 12월 말 기준금리 상단 순변화, |Δ|<0.25%p = 거의 그대로
//            ② 하락 = 연말값 지그재그, 문턱 15%  ③ 침체 = NBER(고점 다음 달 ~ 저점 월)  ④ 사건 = events-r3.csv 31건(분류 7종)
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', '..', 'data');
function parseCSV(txt) { // 따옴표 안 쉼표·줄바꿈 처리
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) { const c = txt[i];
    if (q) { if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; } else if (c !== '\r') cell += c; }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const [h, ...r] = rows; return r.filter(x => x.length > 1).map(x => Object.fromEntries(h.map((k, i) => [k, x[i]])));
}
const csv = f => parseCSV(fs.readFileSync(path.join(D, f), 'utf8'));
const wiki = csv('index-annual-wiki.csv'), dam = csv('spx-level-damodaran.csv'), rm = csv('rates-monthly.csv'), mac = csv('macro-us-annual.csv'), kra = csv('kr-annual.csv'), rec = csv('recessions-us.csv'), evs = csv('events-r3.csv');
const T = +(process.env.T || 15) / 100, LAST = 2025;
const num = v => v === '' || v == null ? null : +v;
const META = { spx: { code: 'SPX', label: 'S&P 500', rate: 'us', cur: '달러', ev: 'S&P' }, ndx: { code: 'NDX', label: '나스닥100', rate: 'us', cur: '달러', ev: '나스닥' }, kospi: { code: 'KOSPI', label: '코스피', rate: 'kr', cur: '포인트', ev: '코스피' } };
const base0 = {};
for (const [k, M] of Object.entries(META)) {
  const rows = wiki.filter(r => r.index === M.code).map(r => ({ y: +r.year, c: num(r.close), r: num(r.ret_pct), v: r.verify_status }));
  if (k === 'spx') { const dm = Object.fromEntries(dam.map(r => [+r.year, +r.spx_close_damodaran])); let maxd = 0; rows.forEach(r => { maxd = Math.max(maxd, Math.abs((dm[r.y] / dm[r.y - 1] - 1) * 100 - r.r)); });
    base0.spx = { start: 1960, y: Array.from({ length: LAST - 1959 }, (_, i) => 1960 + i), c: Array.from({ length: LAST - 1959 }, (_, i) => dm[1960 + i]), xcheck: { n: rows.length, maxDiffPp: +maxd.toFixed(3) }, flags: [] }; }
  else base0[k] = { start: rows[0].y, y: rows.map(r => r.y), c: rows.map(r => r.c), flags: rows.filter(r => /DIFF|MISMATCH|NO_CROSS/.test(r.v)).map(r => r.y + ':' + r.v), xcheck: null };
}
const mon = {}; rm.forEach(r => mon[r.month] = r);
const RT = { us: { col: 'fed_target_upper', label: '미국 기준금리', from: '1982-09' }, kr: { col: 'bok_base', label: '한국 기준금리', from: '1999-05' } };
for (const R of Object.values(RT)) { R.m = {}; for (const [m, r] of Object.entries(mon)) if (m >= R.from && m <= LAST + '-12' && r[R.col] !== '') R.m[m] = +r[R.col]; R.first = Object.keys(R.m).sort()[0]; }
// 겹쳐 보기 10년물: 미국 = H.15 월말 값(us10y_end), 한국 = 국고채 10년 월평균(kr10y_avg)
const OV = { us: { col: 'us10y_end', label: '10년물', full: '미 10년물 국채 금리', def: '매달 마지막 날 값' }, kr: { col: 'kr10y_avg', label: '10년물', full: '국고채 10년 금리', def: '매달 평균' } };
for (const [k, O] of Object.entries(OV)) { O.m = {}; for (const [m, r] of Object.entries(mon)) if (m <= LAST + '-12' && r[O.col] !== '') O.m[m] = +r[O.col]; O.first = Object.keys(O.m).sort()[0]; O.max = Math.max(...Object.values(O.m)); RT[k].max = Math.max(...Object.values(RT[k].m), O.max); RT[k].rmax = Math.ceil(RT[k].max / 2) * 2; }
// 검증: 월말 10년물의 12월 값 = 연 표의 연말 값(macro-us-annual) / 침체 월 수 재계산
const macY = Object.fromEntries(mac.map(r => [+r.year, r]));
let mism = 0; for (const [y, r] of Object.entries(macY)) { const m = OV.us.m[y + '-12']; if (r.us10y_end !== '' && m != null && Math.abs(m - +r.us10y_end) > 0.005) mism++; }
const monthIdx = s => +s.slice(0, 4) * 12 + (+s.slice(5) - 1);
const RECS = rec.filter(r => r.recession_end_month >= '1961-01').map(r => ({ s: r.recession_start_month, e: r.recession_end_month, n: +r.contraction_months, peak: r.peak_month }));
let recMis = 0; for (const [y, r] of Object.entries(macY)) { let n = 0; RECS.forEach(x => { for (let mi = monthIdx(x.s); mi <= monthIdx(x.e); mi++) if (Math.floor(mi / 12) === +y) n++; }); if (n !== +r.recession_months_nber) recMis++; }
RECS.forEach(x => { if (monthIdx(x.e) - monthIdx(x.s) + 1 !== x.n) recMis++; });
const dec = (R, y) => R.m[y + '-12'];
const cls = d => d == null ? 'none' : Math.abs(d) < 0.25 - 1e-9 ? 'flat' : d > 0 ? 'up' : 'down';
const delta = (R, a, b) => (dec(R, a) == null || dec(R, b) == null) ? null : Math.round((dec(R, b) - dec(R, a)) * 100) / 100;
function zig(v, TT) { const n = v.length, eps = []; let hi = 0, lo = null, inD = false;
  for (let i = 1; i < n; i++) { if (!inD) { if (v[i] >= v[hi]) hi = i; else if (v[i] <= v[hi] * (1 - TT)) { inD = true; lo = i; } } else { if (v[i] < v[lo]) lo = i; else if (v[i] >= v[lo] * (1 + TT)) { eps.push({ p: hi, t: lo }); inD = false; hi = i; } } }
  if (inD) eps.push({ p: hi, t: lo });
  eps.forEach(e => { let r = null; for (let i = e.t + 1; i < n; i++) if (v[i] >= v[e.p]) { r = i; break; } e.r = r; }); return eps; }
// 사건(31건): 삭제 E07·E15, 보류 E16 (CEO 판정). 분류 7종 재정의(r3-data-ceo 4절)
const DROP = new Set(['E07', 'E15', 'E16']);
const CAT = { E01: '금리·통화 정책', E04: '금리·통화 정책', E05: '금리·통화 정책', E09: '금리·통화 정책', E19: '금리·통화 정책', E23: '금리·통화 정책', E24: '금리·통화 정책', E25: '금리·통화 정책', E28: '금리·통화 정책', E29: '금리·통화 정책',
  E10: '금융위기', E11: '금융위기', E12: '금융위기', E20: '금융위기', E21: '금융위기', E22: '금융위기', E32: '금융위기', E06: '시장 급락', E33: '시장 급락',
  E08: '전쟁·지정학', E14: '전쟁·지정학', E18: '전쟁·지정학', E26: '전쟁·지정학', E27: '전쟁·지정학', E31: '전쟁·지정학', E34: '전쟁·지정학', E13: '기술 거품', E17: '팬데믹', E30: '팬데믹', E02: '에너지', E03: '에너지' };
// 표시 정밀도: 1차 출처가 확인해 준 정밀도까지만(위키 날짜 미표시). 기본은 fact_date 그대로, 아래는 정밀도를 낮추거나 구간 표기
const DISP = { E10: '1994년 12월', E13: '2000~2002년', E17: '2003년 3~4월', E20: '2008년 9월', E21: '2010년 5월', E24: '2015년 여름', E26: '2016년 6월', E30: '2020년 3월', E31: '2022년 2월' };
const SHORT = { E31: '러시아-우크라이나 전쟁', E13: '닷컴 버블 붕괴', E04: '볼커 긴축', E09: '연준 연속 인상(1994)', E19: '연준 연속 인상(2004~06)' };
const fd = s => { const [y, m, d] = s.split('-'); return d ? `${+y}년 ${+m}월 ${+d}일` : `${+y}년 ${+m}월`; };
const EV = evs.filter(r => !DROP.has(r.id)).map(r => {
  const [y, m, d] = r.fact_date.split('-'); const t = (r.id === 'E13' ? +r.start.slice(0, 4) + (+r.start.slice(5) - 0.5) / 12 : +y + ((+m) - 0.5) / 12);
  const rel = new Set(); if (/세 지수/.test(r.related_index)) ['S&P', '나스닥', '코스피'].forEach(x => rel.add(x)); else r.related_index.split('·').forEach(x => rel.add(x));
  return { id: r.id, name: SHORT[r.id] || r.name, cat: CAT[r.id], t, y: Math.floor(t), disp: DISP[r.id] || fd(r.fact_date), rel: [...rel] }; });
const catCount = {}; EV.forEach(e => catCount[e.cat] = (catCount[e.cat] || 0) + 1);
if (EV.length !== 31 || Object.keys(catCount).length !== 7 || EV.some(e => !e.cat)) throw new Error('사건 31건·분류 7종 불일치 ' + EV.length + JSON.stringify(catCount));
const NM = { spx: { 1972: ['1973~74년 하락', ''], 1999: ['닷컴 버블 붕괴', 'E13'], 2007: ['글로벌 금융위기', 'E20'], 2021: ['2022년 하락', ''] }, ndx: { 1999: ['닷컴 버블 붕괴', 'E13'], 2007: ['글로벌 금융위기', 'E20'], 2021: ['2022년 하락', ''] },
  kospi: { 1989: ['1990~91년 하락', ''], 1994: ['외환위기', 'E11'], 1999: ['닷컴 버블 붕괴', 'E13'], 2007: ['글로벌 금융위기', 'E20'], 2017: ['2018년 하락', ''], 2021: ['2022년 하락', ''] } };
const mmFmt = s => `${+s.slice(0, 4)}년 ${+s.slice(5)}월`;
const recText = x => x.s.slice(0, 4) === x.e.slice(0, 4) ? `${mmFmt(x.s)}~${+x.e.slice(5)}월` : `${mmFmt(x.s)}~${mmFmt(x.e)}`;
function mk(k, last) {
  const S = base0[k], M = META[k], R = RT[M.rate], cut = S.y.indexOf(last) + 1, y = S.y.slice(0, cut), v = S.c.slice(0, cut), eps = zig(v, T);
  const ret = v.map((x, i) => i === 0 ? null : Math.round((x / v[i - 1] - 1) * 10000) / 100);
  const yrDir = {}; y.forEach(Y => { const d = delta(R, Y - 1, Y); yrDir[Y] = { d, k: cls(d) }; });
  const base = { n: 0, up: 0, down: 0, flat: 0, first: null }; y.forEach(Y => { const c = yrDir[Y].k; if (c !== 'none') { base.n++; base[c]++; if (base.first == null) base.first = Y; } });
  const evAll = EV.filter(e => e.rel.includes(M.ev) && e.y <= last);
  const E = eps.map(e => { const nm = NM[k][y[e.p]] || ['', '']; const d = delta(R, y[e.p], y[e.t]);
    const t0 = y[e.p] + 1, t1 = y[e.t] + 1; // 하락 창: 고점 연말 다음 해 1월 ~ 바닥 해 12월
    const evl = evAll.filter(q => q.t >= t0 && q.t < t1).map(q => q.id);
    const recs = M.rate === 'us' ? RECS.filter(x => monthIdx(x.e) >= t0 * 12 && monthIdx(x.s) < t1 * 12).map(recText) : null;
    return { py: y[e.p], ty: y[e.t], ry: e.r == null ? null : y[e.r], pc: v[e.p], tc: v[e.t], dd: +((v[e.t] / v[e.p] - 1) * 100).toFixed(2), name: nm[0] || (y[e.t] + '년 하락'), same: nm[1], ongoing: e.r == null, rf: dec(R, y[e.p]) ?? null, rt: dec(R, y[e.t]) ?? null, rd: d, dir: cls(d), evl, recs }; });
  // 연도별 표
  const tbl = y.slice().reverse().map(Y => { const i = Y - S.start, m = macY[Y], kk = kra.find(r => +r.year === Y);
    const evn = evAll.filter(q => q.y === Y).map(q => q.name);
    const row = { y: Y, close: v[i], ret: ret[i], rate: dec(R, Y) ?? null, dir: yrDir[Y].k, ev: evn };
    if (M.rate === 'us') { row.y10 = m && m.us10y_end !== '' ? +m.us10y_end : null; row.s2 = m && m.spread_10y2y_end !== '' ? +m.spread_10y2y_end : null; row.s3 = m && m.spread_10y3m_end !== '' ? +m.spread_10y3m_end : null; row.rec = m ? +m.recession_months_nber : null; }
    else { row.k3 = kk && kk.kr3y_end !== '' ? +kk.kr3y_end : null; row.k10 = kk && kk.kr10y_end !== '' ? +kk.kr10y_end : null; if (kk && kk.bok_base_end !== '' && dec(R, Y) != null && Math.abs(+kk.bok_base_end - dec(R, Y)) > 0.005) throw new Error('kr 기준금리 불일치 ' + Y); }
    return row; });
  return { key: k, label: M.label, cur: M.cur, rate: M.rate, start: S.start, last, years: y, close: v, ret, yrDir, eps: E, base, flags: S.flags, xcheck: S.xcheck, ev: evAll, tbl };
}
const out = { last: LAST, T: T * 100, idx: {}, sim: {}, rates: {}, ovl: {}, rec: RECS, sens: {}, cats: catCount, checks: { us10yMonthlyVsAnnualMismatch: mism, recessionMonthMismatch: recMis } };
for (const [k, R] of Object.entries(RT)) out.rates[k] = { label: R.label, first: R.first, m: R.m, rmax: R.rmax };
for (const [k, O] of Object.entries(OV)) out.ovl[k] = { label: O.label, full: O.full, def: O.def, first: O.first, m: O.m };
for (const k of Object.keys(META)) { out.idx[k] = mk(k, LAST); out.sens[k] = {}; for (const t of [10, 12, 14, 15, 16, 17, 18, 20, 25]) out.sens[k][t] = zig(base0[k].c, t / 100).length; }
out.sim.kospi = mk('kospi', 2022);
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.DATA=' + JSON.stringify(out) + ';');
console.log('checks', JSON.stringify(out.checks), 'events', EV.length, JSON.stringify(catCount), 'rmax', out.rates.us.rmax, out.rates.kr.rmax, 'recs', RECS.map(x => x.s + '~' + x.e).join(' '));
for (const k of Object.keys(out.idx)) { const d = out.idx[k]; console.log(`\n== ${d.label} ${d.years[0]}~${d.years.at(-1)} base ${JSON.stringify(d.base)} 사건 ${d.ev.length}`);
  d.eps.forEach(e => console.log(`  ${e.name} ${e.dd}% 고점${e.py} 바닥${e.ty} 금리 ${e.dir} 침체 ${JSON.stringify(e.recs)} 사건 ${e.evl.join(',')}`)); }
