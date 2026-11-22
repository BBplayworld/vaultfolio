// 사용: node build-data.js  → data.js (window.DATA). 값은 ../../data/*.csv 에서만 읽는다(하드코딩 0).
// 정의 한 벌: ① 연 금리 방향 = 전년 12월 말 → 그해 12월 말 기준금리 상단 순변화, |Δ|<0.25%p = 거의 그대로(구간에도 같은 규칙)
//            ② 하락 = 연말값 지그재그(고점에서 T% 이상 내린 뒤 T% 이상 오르면 다음 하락은 새로 센다), T = 15%
const fs = require('fs'), path = require('path');
const D = path.join(__dirname, '..', '..', 'data');
const csv = f => { const [h, ...r] = fs.readFileSync(path.join(D, f), 'utf8').trim().split('\n'); const k = h.split(','); return r.map(l => { const c = l.split(','); const o = {}; k.forEach((x, i) => o[x] = c[i]); return o; }); };
const wiki = csv('index-annual-wiki.csv'), dam = csv('spx-level-damodaran.csv'), rm = csv('rates-monthly.csv');
const T = +(process.env.T || 15) / 100, LAST = 2025;
const META = { spx: { code: 'SPX', label: 'S&P 500', rate: 'us', cur: '달러' }, ndx: { code: 'NDX', label: '나스닥100', rate: 'us', cur: '달러' }, kospi: { code: 'KOSPI', label: '코스피', rate: 'kr', cur: '포인트' } };
const base0 = {};
for (const [k, M] of Object.entries(META)) {
  const rows = wiki.filter(r => r.index === M.code).map(r => ({ y: +r.year, c: r.close === '' ? null : +r.close, r: r.ret_pct === '' ? null : +r.ret_pct, v: r.verify_status }));
  if (k === 'spx') { const dm = Object.fromEntries(dam.map(r => [+r.year, +r.spx_close_damodaran])); let maxd = 0; rows.forEach(r => { maxd = Math.max(maxd, Math.abs((dm[r.y] / dm[r.y - 1] - 1) * 100 - r.r)); });
    base0.spx = { start: 1960, y: Array.from({ length: LAST - 1959 }, (_, i) => 1960 + i), c: Array.from({ length: LAST - 1959 }, (_, i) => dm[1960 + i]), xcheck: { n: rows.length, maxDiffPp: +maxd.toFixed(3) }, flags: [] }; }
  else base0[k] = { start: rows[0].y, y: rows.map(r => r.y), c: rows.map(r => r.c), flags: rows.filter(r => /DIFF|MISMATCH|NO_CROSS/.test(r.v)).map(r => r.y + ':' + r.v), xcheck: null };
}
const mon = {}; rm.forEach(r => mon[r.month] = r);
const RT = { us: { col: 'fed_target_upper', label: '미국 기준금리', from: '1982-09' }, kr: { col: 'bok_base', label: '한국 기준금리', from: '1999-05' } };
for (const R of Object.values(RT)) { R.m = {}; for (const [m, r] of Object.entries(mon)) if (m >= R.from && m <= LAST + '-12' && r[R.col] !== '') R.m[m] = +r[R.col]; R.first = Object.keys(R.m).sort()[0]; }
const dec = (R, y) => R.m[y + '-12'];
const cls = d => d == null ? 'none' : Math.abs(d) < 0.25 - 1e-9 ? 'flat' : d > 0 ? 'up' : 'down';
const delta = (R, a, b) => (dec(R, a) == null || dec(R, b) == null) ? null : Math.round((dec(R, b) - dec(R, a)) * 100) / 100;
function zig(v, TT) { const n = v.length, eps = []; let hi = 0, lo = null, inD = false;
  for (let i = 1; i < n; i++) { if (!inD) { if (v[i] >= v[hi]) hi = i; else if (v[i] <= v[hi] * (1 - TT)) { inD = true; lo = i; } } else { if (v[i] < v[lo]) lo = i; else if (v[i] >= v[lo] * (1 + TT)) { eps.push({ p: hi, t: lo }); inD = false; hi = i; } } }
  if (inD) eps.push({ p: hi, t: lo });
  eps.forEach(e => { let r = null; for (let i = e.t + 1; i < n; i++) if (v[i] >= v[e.p]) { r = i; break; } e.r = r; }); return eps; }
const NM = { // 널리 쓰이는 이름 또는 'YYYY년 하락'. 사건은 날짜·사실만(값 없음)
  spx: { 1972: ['1973~74년 하락', ''], 1999: ['닷컴 버블 붕괴', '2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'], 2007: ['글로벌 금융위기', '2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'], 2021: ['2022년 하락', '2022년 2월 24일 러시아가 우크라이나를 침공했어요'] },
  ndx: { 1999: ['닷컴 버블 붕괴', '2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'], 2007: ['글로벌 금융위기', '2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'], 2021: ['2022년 하락', '2022년 2월 24일 러시아가 우크라이나를 침공했어요'] },
  kospi: { 1989: ['1990~91년 하락', ''], 1994: ['외환위기', '1997년 7월 태국 바트화가 급락했고 12월 한국은 IMF 대기성 차관에 합의했어요'], 1999: ['닷컴 버블 붕괴', '2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'], 2007: ['글로벌 금융위기', '2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'], 2017: ['2018년 하락', '2018년 미국과 중국이 서로 관세를 부과하기 시작했어요'], 2021: ['2022년 하락', '2022년 2월 24일 러시아가 우크라이나를 침공했어요'] } };
function mk(k, last) {
  const S = base0[k], M = META[k], R = RT[M.rate], cut = S.y.indexOf(last) + 1, y = S.y.slice(0, cut), v = S.c.slice(0, cut), eps = zig(v, T);
  const ret = v.map((x, i) => i === 0 ? null : Math.round((x / v[i - 1] - 1) * 10000) / 100);
  const yrDir = {}; y.forEach(Y => { const d = delta(R, Y - 1, Y); yrDir[Y] = { d, k: cls(d) }; });
  const base = { n: 0, up: 0, down: 0, flat: 0, first: null }; y.forEach(Y => { const c = yrDir[Y].k; if (c !== 'none') { base.n++; base[c]++; if (base.first == null) base.first = Y; } });
  const E = eps.map(e => { const nm = NM[k][y[e.p]] || ['', '']; const d = delta(R, y[e.p], y[e.t]); return { py: y[e.p], ty: y[e.t], ry: e.r == null ? null : y[e.r], pc: v[e.p], tc: v[e.t], dd: +((v[e.t] / v[e.p] - 1) * 100).toFixed(2), name: nm[0] || (y[e.t] + '년 하락'), event: nm[1], ongoing: e.r == null, rf: dec(R, y[e.p]) ?? null, rt: dec(R, y[e.t]) ?? null, rd: d, dir: cls(d) }; });
  return { key: k, label: M.label, cur: M.cur, rate: M.rate, start: S.start, last, years: y, close: v, ret, yrDir, eps: E, base, flags: S.flags, xcheck: S.xcheck };
}
const out = { last: LAST, T: T * 100, idx: {}, sim: {}, rates: {}, sens: {} };
for (const [k, R] of Object.entries(RT)) out.rates[k] = { label: R.label, first: R.first, m: R.m };
for (const k of Object.keys(META)) { out.idx[k] = mk(k, LAST); out.sens[k] = {}; for (const t of [10, 12, 14, 15, 16, 17, 18, 20, 25]) out.sens[k][t] = zig(base0[k].c, t / 100).length; }
out.sim.kospi = mk('kospi', 2022);
fs.writeFileSync(path.join(__dirname, 'data.js'), 'window.DATA=' + JSON.stringify(out) + ';');
for (const k of Object.keys(out.idx)) { const d = out.idx[k]; console.log(`\n== ${d.label} ${d.years[0]}~${d.years.at(-1)} base ${JSON.stringify(d.base)} ${d.xcheck ? JSON.stringify(d.xcheck) : ''} ${d.flags.join(' ')}`);
  d.eps.forEach(e => console.log(`  ${e.name} 고점${e.py}(${e.pc}) 바닥${e.ty}(${e.tc}) ${e.dd}% 회복${e.ry} 금리 ${e.rf}→${e.rt} Δ${e.rd} ${e.dir}`));
  console.log('  sens', JSON.stringify(out.sens[k]), 'ret range', Math.min(...d.ret.filter(x => x != null)), Math.max(...d.ret.filter(x => x != null)), 'n ongoing', d.eps.filter(e => e.ongoing).length); }
const s = out.sim.kospi; console.log('\nsim kospi', JSON.stringify(s.eps.map(e => [e.name, e.dd, e.ongoing])), JSON.stringify(s.base));
