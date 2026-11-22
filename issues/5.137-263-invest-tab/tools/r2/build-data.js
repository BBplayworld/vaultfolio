// R2 데이터 빌더 — data/*.csv → data.js (window.DATA). 값의 단일 출처는 data/ (지수 수준값만 가데이터 근사)
// 사용: node build-data.js
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', '..', 'data');
const csv = f => { const t = fs.readFileSync(path.join(D, f), 'utf8').trim().split(/\r?\n/); const h = parseCSVLine(t[0]); return t.slice(1).map(l => { const c = parseCSVLine(l); const o = {}; h.forEach((k, i) => o[k] = c[i] ?? ''); return o; }); };
function parseCSVLine(l) { const r = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (q) { if (ch === '"') { if (l[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r; }
const END = '2026-10';
const mi = (ym, base) => { const [y, m] = ym.split('-').map(Number); const [by, bm] = base.split('-').map(Number); return (y - by) * 12 + (m - bm); };
const ymOf = (i, base) => { const [by, bm] = base.split('-').map(Number); const t = by * 12 + bm - 1 + i; return `${Math.floor(t / 12)}-${String(t % 12 + 1).padStart(2, '0')}`; };

const mon = csv('index-monthly-derived.csv'), rm = csv('rates-monthly.csv'), ra = csv('rates-annual.csv'), ia = csv('index-annual.csv'), dd = csv('drawdowns.csv');
const monBy = Object.fromEntries(mon.map(r => [r.month, r])), rmBy = Object.fromEntries(rm.map(r => [r.month, r]));

// ---- 지수 월말 수준(가데이터)
const ANC = '1985-01:165,1986-12:242,1987-08:336,1987-12:223,1989-07:346,1989-12:353,1990-07:359,1990-10:304,1991-12:417,1993-12:466,1994-12:459,1995-12:616,1996-12:740,1997-12:970,1998-12:1229,1999-12:1469,2000-03:1527,2000-12:1320,2001-12:1148,2002-10:777,2002-12:880,2003-12:1112,2004-12:1212,2005-12:1248,2006-12:1418,2007-05:1530,2007-10:1565,2008-12:903,2009-03:677,2009-12:1115,2010-12:1257,2011-12:1257,2012-12:1426,2013-03:1569,2013-12:1848,2014-12:2059,2015-12:2044,2016-12:2239'
  .split(',').map(s => { const [ym, v] = s.split(':'); return { i: mi(ym, '1985-01'), v: +v }; });
function spx() { const n = mi(END, '1985-01') + 1, a = []; for (let k = 0; k < ANC.length - 1; k++) { const p = ANC[k], q = ANC[k + 1]; for (let i = p.i; i < q.i; i++) a[i] = p.v * Math.pow(q.v / p.v, (i - p.i) / (q.i - p.i)); } a[ANC[ANC.length - 1].i] = ANC[ANC.length - 1].v;
  for (let i = ANC[ANC.length - 1].i + 1; i < n; i++) { const r = monBy[ymOf(i, '1985-01')].spx_ret_m; a[i] = a[i - 1] * (1 + parseFloat(r) / 100); } return { start: '1985-01', v: a }; }
function ndx() { const n = mi(END, '1986-01') + 1, a = [125]; for (let i = 1; i < n; i++) a[i] = a[i - 1] * (1 + parseFloat(monBy[ymOf(i, '1986-01')].ndx_ret_m) / 100); return { start: '1986-01', v: a }; }
function kospi() { const s = '1994-12', n = mi(END, s) + 1, a = []; for (let i = 0; i < n; i++) a[i] = parseFloat(monBy[ymOf(i, s)].kospi_close); return { start: s, v: a }; }
const SER = { spx: spx(), ndx: ndx(), kospi: kospi() };

// ---- 금리 월 계열 → 국면(올림 U / 내림 D). 같은 방향 변경이 9개월 이내로 이어지면 한 국면. 멈춤은 국면 사이 빈 구간
function rateSeries(col, from) { const out = []; const s = from; const n = mi(END, s) + 1; for (let i = 0; i < n; i++) { const r = rmBy[ymOf(i, s)][col]; out.push(r === '' ? null : parseFloat(r)); } return { start: s, v: out }; }
const RATE = { us: rateSeries('fed_target_upper', '1982-09'), kr: rateSeries('bok_base', '1999-05') };
function phases(rs, GAP = 12) {
  // 1) 같은 방향 변경이 GAP개월 이내로 이어지면 한 국면 2) 순변화 0.5%p 미만 국면은 버림 3) 사이가 비면 같은 방향끼리 다시 합침
  const ch = []; for (let i = 1; i < rs.v.length; i++) if (rs.v[i] != null && rs.v[i - 1] != null && Math.abs(rs.v[i] - rs.v[i - 1]) >= 0.01) ch.push({ i, s: Math.sign(rs.v[i] - rs.v[i - 1]) });
  let ph = []; for (const c of ch) { const last = ph[ph.length - 1]; if (last && last.s === c.s && c.i - last.b <= GAP) last.b = c.i; else ph.push({ s: c.s, a: c.i, b: c.i }); }
  ph = ph.filter(p => Math.abs(rs.v[p.b] - rs.v[p.a - 1]) >= 0.5);
  const m = []; for (const p of ph) { const last = m[m.length - 1]; if (last && last.s === p.s && p.a - last.b <= GAP) last.b = p.b; else m.push({ ...p }); }
  return m.map(p => ({ k: p.s > 0 ? 'U' : 'D', a: p.a, b: p.b + 1 })); // [a,b) 월 인덱스(금리 계열 기준)
}
Object.values(RATE).forEach(r => r.ph = phases(r));

// ---- 에피소드(drawdowns.csv, 월말 종가 기준) + 이름·사건
const NAME = { 'SPX-1987-08-R0': ['블랙먼데이', '1987년 10월 19일 미국 증시가 하루 만에 크게 떨어졌어요'], 'SPX-2000-03-R0': ['닷컴 버블 붕괴', '2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'], 'SPX-2007-10-R0': ['글로벌 금융위기', '2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'], 'SPX-2019-12': ['코로나19 폭락', '2020년 3월 11일 WHO가 팬데믹을 선언했어요'], 'SPX-2021-12': ['2022년 하락', '2022년 2월 24일 러시아가 우크라이나를 침공했어요'],
  'NDX-1987-08': ['블랙먼데이', '1987년 10월 19일 나스닥100은 하루에 15.08% 떨어졌어요'], 'NDX-1990-06': ['1990년 하락', '1990년 8월 이라크가 쿠웨이트를 침공했어요'], 'NDX-2000-03': ['닷컴 버블 붕괴', '2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'], 'NDX-2007-10': ['글로벌 금융위기', '2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'], 'NDX-2021-12': ['2022년 하락', '2022년 2월 24일 러시아가 우크라이나를 침공했어요'],
  'KOSPI-1994-12': ['외환위기', '1997년 7월 태국 바트화가 급락했고 12월 한국은 IMF 대기성 차관에 합의했어요'], 'KOSPI-1999-12': ['닷컴 버블 붕괴', '2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'], 'KOSPI-2002-03': ['2002년 하락', '2003년 3월 미국 주도 연합군이 이라크를 공격했어요'], 'KOSPI-2007-10': ['글로벌 금융위기', '2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'], 'KOSPI-2018-01': ['2018년 하락', '2018년 미국과 중국이 서로 관세를 부과하기 시작했고, 2020년 3월 WHO가 팬데믹을 선언했어요'], 'KOSPI-2021-06': ['2021년 하락', '2022년 2월 24일 러시아가 우크라이나를 침공했어요'], 'KOSPI-2026-06': ['2026년 하락', '']};
const IDX = { spx: { label: 'S&P 500', prefix: 'SPX', rate: 'us', cur: '달러' }, ndx: { label: '나스닥100', prefix: 'NDX', rate: 'us', cur: '달러' }, kospi: { label: '코스피', prefix: 'KOSPI', rate: 'kr', cur: '포인트' } };
const out = {}; const check = [];
for (const [k, c] of Object.entries(IDX)) {
  const S = SER[k], R = RATE[c.rate]; const eps = [];
  for (const r of dd.filter(x => x.index === { spx: 'S&P 500', ndx: 'Nasdaq-100', kospi: 'KOSPI' }[k])) {
    if (r.id === 'SPX-1973-01-R0') continue; // 1985년 이전 — 창 밖
    const pi = mi(r.peak_month, S.start), ti = mi(r.trough_month, S.start), rec = r.months_peak_to_recovery ? pi + +r.months_peak_to_recovery : null;
    const rp = mi(r.peak_month, R.start), rt = mi(r.trough_month, R.start); const a = R.v[rp], b = R.v[rt];
    const net = (a == null || b == null) ? null : Math.round((b - a) * 100) / 100;
    const dir = net == null ? 'none' : Math.abs(net) < 0.25 ? 'flat' : net > 0 ? 'up' : 'down';
    const sv = S.v; let calc = sv[ti] / sv[pi] * 100 - 100; check.push(`${r.id} csv ${r.drawdown_pct} calc ${calc.toFixed(1)} peak ${sv[pi].toFixed(0)} trough ${sv[ti].toFixed(0)} recMonth ${rec != null ? ymOf(rec, S.start) : '-'}`);
    const ongoing = !rec; eps.push({ id: r.id, name: NAME[r.id][0], event: NAME[r.id][1], p: pi, t: ti, r: rec, dd: +r.drawdown_pct, toT: +r.months_to_trough || ti - pi, toR: +r.months_peak_to_recovery || null, rf: a, rt: b, net, dir, ongoing, ps: r.peak_month, ts: r.trough_month, note: r.id === 'KOSPI-1994-12' ? '자료가 1994년 12월부터라 실제 고점은 더 앞일 수 있어요' : '' });
  }
  // 창·기준선
  const w0 = Math.max(0, mi(R.start, S.start)), wn = S.v.length; // 금리 계열 시작이 더 늦으면 그 달부터
  const from = Math.max(S.start === R.start ? 0 : 0, mi(R.start, S.start)); const winStart = Math.max(0, from); // S 인덱스 기준
  const wMonths = wn - winStart; const sMonthInR = i => i; // R 인덱스에서 환산용
  const rOff = mi(S.start, R.start); // S 인덱스 i → R 인덱스 i+rOff
  let dn = 0, up = 0; R.ph.forEach(p => { const a = Math.max(p.a, winStart + rOff), b = Math.min(p.b, wn + rOff); if (b > a) (p.k === 'D' ? dn += b - a : up += b - a); });
  const done = eps.filter(e => !e.ongoing);
  out[k] = { label: c.label, cur: c.cur, rate: c.rate, start: S.start, v: S.v.map(x => Math.round(x * 100) / 100), eps,
    n: done.length, nDown: done.filter(e => e.dir === 'down').length, nUp: done.filter(e => e.dir === 'up').length, nFlat: done.filter(e => e.dir === 'flat').length, nNone: done.filter(e => e.dir === 'none').length,
    base: { years: Math.floor(wMonths / 12), dn: Math.round(dn / 12), up: Math.round(up / 12), from: winStart }, annual: {} };
  ia.forEach(r => { const col = { spx: 'spx_ret', ndx: 'ndx_ret', kospi: 'kospi_ret' }[k]; if (r[col] !== '' && +r.year >= +S.start.slice(0, 4)) out[k].annual[r.year] = +r[col]; });
}
const ratesOut = {}; for (const [k, r] of Object.entries(RATE)) ratesOut[k] = { start: r.start, v: r.v, ph: r.ph, label: k === 'us' ? '미국 기준금리' : '한국 기준금리' };
// 연 단위 금리 방향(연말 목표 변화)
const annRate = { us: {}, kr: {} }; ra.forEach(r => { const y = +r.year; if (y < 1983) return; const p = ra.find(x => +x.year === y - 1); if (r.fed_target_end !== '' && p && p.fed_target_end !== '') annRate.us[y] = Math.round((+r.fed_target_end - +p.fed_target_end) * 100) / 100; if (r.bok_base_end !== '' && p && p.bok_base_end !== '') annRate.kr[y] = Math.round((+r.bok_base_end - +p.bok_base_end) * 100) / 100; });
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.DATA=' + JSON.stringify({ end: END, idx: out, rates: ratesOut, annRate }) + ';');
console.log(check.join('\n')); for (const [k, v] of Object.entries(out)) console.log(k, 'n', v.n, 'down', v.nDown, 'up', v.nUp, 'flat', v.nFlat, 'none', v.nNone, JSON.stringify(v.base));
console.log(JSON.stringify(RATE.us.ph.slice(0, 6)), RATE.us.ph.length, RATE.kr.ph.length);
