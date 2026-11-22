/* #263 R1 목업 공통 라이브러리 — 데이터는 전부 가데이터(근사값). 코드 아님, 시안용 */
const Q = new URLSearchParams(location.search);
const WIDE = Q.get('w') === '1280';
const DARK = Q.get('theme') === 'dark';
document.documentElement.className = (DARK ? 'dark ' : '') + (WIDE ? 'wide' : '');
const $ = (s, r = document) => r.querySelector(s);
const fp = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d) + '%';
const fr = v => v.toFixed(v % 1 ? 2 : 2).replace(/0$/, '').replace(/\.$/, '') + '%';

const Y0 = 1985, Y1 = 2025, NY = Y1 - Y0 + 1;
const SPX = {1985:26.3,1986:14.6,1987:2.0,1988:12.4,1989:27.3,1990:-6.6,1991:26.3,1992:4.5,1993:7.1,1994:-1.5,1995:34.1,1996:20.3,1997:31.0,1998:26.7,1999:19.5,2000:-10.1,2001:-13.0,2002:-23.4,2003:26.4,2004:9.0,2005:3.0,2006:13.6,2007:3.5,2008:-38.5,2009:23.5,2010:12.8,2011:0.0,2012:13.4,2013:29.6,2014:11.4,2015:-0.7,2016:9.5,2017:19.4,2018:-6.2,2019:28.9,2020:16.3,2021:26.9,2022:-19.4,2023:24.2,2024:23.3,2025:16.4};
const FF = {1984:8.5,1985:8.25,1986:6.5,1987:6.75,1988:8.75,1989:8.25,1990:7.0,1991:4.0,1992:3.0,1993:3.0,1994:5.5,1995:5.5,1996:5.25,1997:5.5,1998:4.75,1999:5.5,2000:6.5,2001:1.75,2002:1.25,2003:1.0,2004:2.25,2005:4.25,2006:5.25,2007:4.25,2008:0.25,2009:0.25,2010:0.25,2011:0.25,2012:0.25,2013:0.25,2014:0.25,2015:0.5,2016:0.75,2017:1.5,2018:2.5,2019:1.75,2020:0.25,2021:0.25,2022:4.5,2023:5.5,2024:4.5,2025:3.75};
const yd = y => Math.sign(FF[y] - FF[y - 1]); // 1 올림 -1 내림 0 동결
const ydTxt = y => yd(y) > 0 ? '올림' : yd(y) < 0 ? '내림' : '그대로';
const fmtR = v => (Math.round(v * 100) / 100).toString() + '%';

// 사건(13건, 1줄 사실, 과거형 — 인과 단어 0)
const EV = [
 {y:1987,m:10,n:'블랙먼데이',f:'1987년 10월 19일 미국 주가가 하루 만에 사상 최대 비율로 떨어졌어요'},
 {y:1990,m:8,n:'걸프전',f:'1990년 8월 이라크가 쿠웨이트를 침공했어요'},
 {y:1994,m:2,n:'연준 연속 인상',f:'1994년 2월부터 1년간 연준이 기준금리를 연달아 올렸어요'},
 {y:1997,m:7,n:'아시아 외환위기',f:'1997년 7월 태국 바트화가 폭락했고 동아시아 통화가 잇따라 떨어졌어요'},
 {y:1998,m:8,n:'러시아·LTCM',f:'1998년 8월 러시아가 국채 지급을 미뤘고 9월 헤지펀드 LTCM이 구제됐어요'},
 {y:2000,m:3,n:'닷컴 버블 붕괴',f:'2000년 3월 기술주가 정점을 찍은 뒤 2002년까지 길게 내렸어요'},
 {y:2001,m:9,n:'9·11 테러',f:'2001년 9월 11일 미국에서 동시다발 테러가 있었고 증시가 며칠 쉬었어요'},
 {y:2008,m:9,n:'글로벌 금융위기',f:'2008년 9월 15일 리먼 브러더스가 파산 보호를 신청했어요'},
 {y:2011,m:8,n:'미국 신용등급 강등',f:'2011년 8월 5일 S&P가 미국 국가신용등급을 한 단계 낮췄어요'},
 {y:2018,m:3,n:'미중 무역분쟁',f:'2018년 미국과 중국이 서로 관세를 매기기 시작했어요'},
 {y:2020,m:3,n:'코로나19 확산',f:'2020년 3월 WHO가 팬데믹을 선언했고 연준은 금리를 0~0.25%로 내렸어요'},
 {y:2022,m:2,n:'우크라이나 전쟁',f:'2022년 2월 24일 러시아가 우크라이나를 침공했어요'},
 {y:2023,m:3,n:'미국 지역은행 위기',f:'2023년 3월 실리콘밸리은행이 문을 닫았어요'}
];
const evOf = y => EV.filter(e => e.y === y);
// 크게 빠진 때(고점 대비 −20% 이상, 월 단위) — data/events.csv 낙폭·기간 + 가데이터
const EP = [
 {id:'e87',s:[1987,8],t:[1987,12],d:-33.5,toT:3,rec:23,rf:6.5,rt:6.75,dir:1,ev:'블랙먼데이',fact:EV[0].f,short:'블랙먼데이'},
 {id:'e00',s:[2000,3],t:[2002,10],d:-49.1,toT:31,rec:86,rf:5.75,rt:1.75,dir:-1,ev:'닷컴 버블 붕괴',fact:EV[5].f,short:'닷컴 버블'},
 {id:'e07',s:[2007,10],t:[2009,3],d:-56.8,toT:17,rec:65,rf:4.5,rt:0.25,dir:-1,ev:'글로벌 금융위기',fact:EV[7].f,short:'금융위기'},
 {id:'e20',s:[2020,2],t:[2020,3],d:-33.9,toT:1,rec:6,rf:1.75,rt:0.25,dir:-1,ev:'코로나19 확산',fact:EV[10].f,short:'코로나19'},
 {id:'e22',s:[2022,1],t:[2022,10],d:-25.4,toT:9,rec:24,rf:0.25,rt:3.25,dir:1,ev:'우크라이나 전쟁',fact:EV[11].f,short:'우크라이나 전쟁'}
];
const EPDIR = e => e.dir > 0 ? '올리던 중' : '내리던 중';
const nDown = EP.filter(e => e.dir < 0).length, nUp = EP.filter(e => e.dir > 0).length;
// 금리 국면(U 올림 D 내림 F 멈춤)
const PH = [['D',1985,1,1986,9],['F',1986,9,1987,3],['U',1987,3,1989,3],['F',1989,3,1989,6],['D',1989,6,1992,9],['F',1992,9,1994,2],['U',1994,2,1995,3],['F',1995,3,1995,7],['D',1995,7,1996,2],['F',1996,2,1998,9],['D',1998,9,1998,12],['F',1998,12,1999,6],['U',1999,6,2000,6],['F',2000,6,2001,1],['D',2001,1,2003,7],['F',2003,7,2004,6],['U',2004,6,2006,7],['F',2006,7,2007,9],['D',2007,9,2008,12],['F',2008,12,2015,12],['U',2015,12,2019,1],['F',2019,1,2019,7],['D',2019,7,2020,4],['F',2020,4,2022,3],['U',2022,3,2023,8],['F',2023,8,2024,9],['D',2024,9,2026,1]]
 .map(([k,a,b,c,d]) => ({k, a:a+(b-1)/12, b:c+(d-1)/12}));
const phYrs = k => Math.round(PH.filter(p => p.k === k).reduce((s, p) => s + Math.min(p.b, 2026) - Math.max(p.a, 1985), 0));
const NDN = phYrs('D'), NUP = phYrs('U'), NTOT = NY;
const PHN = {U:'올리는 중', D:'내리는 중', F:'멈춰 있음'};
// 월말 지수(근사, 로그 보간)
const ANC = '1985-01:165,1986-12:242,1987-08:336,1987-12:223,1989-07:346,1989-12:353,1990-07:359,1990-10:304,1991-12:417,1993-12:466,1994-12:459,1995-12:616,1996-12:740,1997-12:970,1998-12:1229,1999-12:1469,2000-03:1527,2000-12:1320,2001-12:1148,2002-10:777,2002-12:880,2003-12:1112,2004-12:1212,2005-12:1248,2006-12:1418,2007-05:1530,2007-10:1565,2008-12:903,2009-03:677,2009-12:1115,2010-12:1257,2011-12:1257,2012-12:1426,2013-03:1569,2013-12:1848,2014-12:2059,2015-12:2044,2016-12:2239,2017-12:2673,2018-09:2913,2018-12:2507,2019-12:3231,2020-02:3386,2020-03:2237,2020-08:3500,2020-12:3756,2021-12:4766,2022-01:4797,2022-10:3577,2022-12:3839,2023-12:4770,2024-01:4846,2024-12:5882,2025-12:6850'
 .split(',').map(s => { const [ym, v] = s.split(':'); const [y, m] = ym.split('-').map(Number); return {i:(y-Y0)*12+m-1, v:+v}; });
const MI = []; for (let k = 0; k < ANC.length - 1; k++) { const a = ANC[k], b = ANC[k+1]; for (let i = a.i; i < b.i; i++) MI[i] = a.v * Math.pow(b.v / a.v, (i - a.i) / (b.i - a.i)); } MI[ANC[ANC.length-1].i] = ANC[ANC.length-1].v;
const NM = MI.length, mx = (y, m) => ((y - Y0) * 12 + (m - 1) + 0.5) / NM; // 0~1
const yx = y => (y - Y0) / NY; // 해 시작 0~1

function calc(sy, sm, method) {
  const s = (sy - Y0) * 12 + sm - 1, e = NM - 1, n = e - s + 1;
  if (method === 'lump') { const base = MI[s - 1] || MI[0]; const mult = MI[e] / base; const path = []; for (let t = s; t <= e; t++) path.push(MI[t] / base); return {mult, tot:(mult-1)*100, cagr:(Math.pow(mult, 12 / n) - 1) * 100, n, path, s}; }
  let u = 0, path = [], min = 9, mi = s; for (let t = s; t <= e; t++) { u += 1 / MI[t]; const r = u * MI[t] / (t - s + 1); path.push(r); if (r < min) { min = r; mi = t; } }
  const mult = path[path.length - 1]; return {mult, tot:(mult-1)*100, min:(min-1)*100, mi, n, path, s};
}
const ymTxt = i => `${Y0 + Math.floor(i / 12)}년 ${i % 12 + 1}월`;

// ---- 공통 조각
const HEAD = (opts = {}) => `
<div class="card" data-testid="invest-headline">
  <div class="head1 bal">${Y0}년 이후 20% 넘게 빠진 때는 ${EP.length}번이었어요</div>
  <div class="head2 bal">그중 <b class="sb" style="color:var(--fg)">${nDown}번은 금리를 내리던 중</b>, ${nUp}번은 올리던 중이었어요</div>
  ${opts.base === false ? '' : `<div class="base">같은 기간 금리를 내리던 때는 ${NDN}년, 올리던 때는 ${NUP}년이었어요</div>`}
</div>`;
const TOP = () => `
<div class="top"><div class="logo">S</div><div class="nav1"><span>상세</span><span>성과</span><span class="on">투자</span></div><span class="chip" style="height:20px;font-size:11px;padding:0 7px;color:var(--imp)">가데이터</span><div class="ico"><i></i></div><div class="ico"><i></i></div></div>`;
const IDXSEL = () => `<div class="seg hit" role="tablist" aria-label="지수 선택" data-testid="invest-index"><button class="on" role="tab" aria-selected="true">S&amp;P 500</button><button role="tab">나스닥100</button><button role="tab">코스피</button></div>`;
const LEGEND = () => `<div style="display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:10px" class="txs mf"><span style="display:inline-flex;gap:6px;align-items:center"><i class="sw up-s"></i>올리는 중</span><span style="display:inline-flex;gap:6px;align-items:center"><i class="sw dn-s"></i>내리는 중</span><span style="display:inline-flex;gap:6px;align-items:center"><i class="sw flat-s"></i>멈춰 있음</span></div>`;
const SEC2NOTE = `<p class="note" style="margin-top:12px">같은 시기에 있었다는 기록이고, 무엇이 원인인지는 말하지 않아요.</p>`;
const FOOT = () => `<div class="src">지수는 공개 통계의 연·월 요약값이에요 · 달러 기준<br>S&amp;P 500은 S&amp;P Dow Jones Indices의 상표예요 · 기준일 2025.12</div><div class="note" style="text-align:center">가데이터 목업 · 값은 근사치</div>`;

// ③ 이때 넣었다면 — 스타일 3종이 공유하는 로직
function sec3(style, def = {method:Q.get('m') || 'lump', sy:+(Q.get('sy') || 2016), sm:1}) {
  const st = {...def};
  const root = document.createElement('section'); root.id = 'sec3'; root.dataset.testid = 'invest-sec3';
  const draw = () => {
    const r = calc(st.sy, st.sm, st.method), lump = st.method === 'lump';
    const mult = r.mult.toFixed(1), tot = fp(r.tot, 0);
    const pill = `<div style="display:flex;flex-wrap:wrap;gap:6px;margin:12px 0 4px"><span class="chip">달러 기준</span><span class="chip">지수 값만(배당 빼고)</span></div>`;
    const nums = lump
      ? [['원금의', `${mult}배`], ['총수익률', `<span class="up">${tot}</span>`], ['해마다 평균', `<span class="up">${fp(r.cagr)}</span>`]]
      : [['넣은 돈의', `${mult}배`], ['총수익률', `<span class="up">${tot}</span>`], [`가장 낮았던 달 ${ymTxt(r.mi).replace('년 ', '.').replace('월', '')}`, `<span class="dn">${fp(r.min)}</span>`]];
    let viz = '';
    if (style === 'A') viz = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:14px">${nums.map(([l, v]) => `<div style="background:var(--sec);border-radius:14px;padding:10px 10px 12px"><div class="t2xs mf" style="min-height:30px">${l}</div><div class="tlg b" style="margin-top:2px">${v}</div></div>`).join('')}</div>
      <div style="margin-top:14px"><div class="t2xs mf" style="display:flex;justify-content:space-between"><span>${lump ? '원금' : '넣은 돈'}</span><span>1.0배</span></div><div style="height:10px;border-radius:5px;background:var(--muted);width:${(100 / r.mult).toFixed(1)}%;margin-top:4px"></div>
      <div class="t2xs mf" style="display:flex;justify-content:space-between;margin-top:8px"><span>평가액</span><span>${mult}배</span></div><div style="height:10px;border-radius:5px;background:var(--profit);width:100%;margin-top:4px;opacity:.9"></div></div>`;
    if (style === 'B') { const W = WIDE ? 560 : 326, H = 96, p = r.path, mx_ = Math.max(...p, 1.2), mn_ = Math.min(...p, 0.6); const X = i => i / (p.length - 1) * W, Yv = v => H - 14 - (v - mn_) / (mx_ - mn_) * (H - 26);
      const d = p.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Yv(v).toFixed(1)}`).join(''); const mi = lump ? null : r.mi - r.s;
      viz = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;margin-top:14px;border-radius:14px;overflow:hidden;background:var(--sec)">${nums.map(([l, v], i) => `<div style="padding:10px 12px;${i ? 'box-shadow:inset 1px 0 0 var(--hair)' : ''}"><div class="t2xs mf" style="min-height:30px">${l}</div><div class="tlg b" style="margin-top:2px">${v}</div></div>`).join('')}</div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" style="margin-top:12px;display:block" role="img" aria-label="${lump ? '시작 때 지수 대비 배수' : '넣은 돈 대비 평가액 배수'}"><line x1="0" x2="${W}" y1="${Yv(1)}" y2="${Yv(1)}" stroke="var(--ink3)" stroke-dasharray="3 3"/><path d="${d}" fill="none" stroke="var(--fg)" stroke-width="1.75" stroke-linejoin="round"/>${mi !== null ? `<circle cx="${X(mi)}" cy="${Yv(p[mi])}" r="4.5" fill="var(--loss)" stroke="var(--card)" stroke-width="2"/>` : ''}<text x="0" y="${H - 1}" font-size="11" fill="var(--mf)">${lump ? '시작' : '시작'}</text><text x="${W}" y="${H - 1}" text-anchor="end" font-size="11" fill="var(--mf)">지금</text><text x="${W / 2}" y="${H - 1}" text-anchor="middle" font-size="11" fill="var(--mf)">점선은 ${lump ? '시작 때 값' : '넣은 돈과 같은 값'}</text></svg>`; }
    if (style === 'C') viz = `<div style="margin-top:14px;border-radius:16px;background:var(--sec);padding:16px"><div class="tsm bal">${st.sy}년 ${st.sm}월부터 ${lump ? '한 번에 넣었다면' : '매달 같은 금액을 넣었다면'}, 지금 지수 기준 ${lump ? '원금' : '넣은 돈'}의</div><div class="t2xl b" style="margin:4px 0 8px">${mult}배<span class="tsm sb mf" style="margin-left:8px"><span class="up">${tot}</span></span></div><div class="txs mf">${lump ? `해마다 평균 <b class="sb up">${fp(r.cagr)}</b>였어요` : `가장 낮았던 달은 ${ymTxt(r.mi)}, <b class="sb dn">${fp(r.min)}</b>였어요`}</div></div>`;
    root.innerHTML = `<div class="card">
      <div class="sec-t">이때 넣었다면 <small>금액은 입력하지 않아요</small></div>
      <div class="seg hit" role="tablist" aria-label="넣는 방식"><button data-m="lump" class="${lump ? 'on' : ''}" role="tab" aria-selected="${lump}">한 번에</button><button data-m="month" class="${lump ? '' : 'on'}" role="tab" aria-selected="${!lump}">매달</button></div>
      <div class="sel" style="margin-top:10px"><div class="f"><span><small>시작</small>&nbsp; ${st.sy}년 ${st.sm}월</span><span class="mf">⌄</span></div><div class="f"><span><small>끝</small>&nbsp; 지금까지</span><span class="mf">⌄</span></div></div>
      ${pill}${viz}
      <p class="note" style="margin-top:12px">배당을 다시 넣었다면 결과는 이보다 커요.</p>
      <p class="note" style="margin-top:4px">과거 지수 값으로 계산한 결과예요. 배당·세금·수수료는 빼고, 앞으로의 수익을 뜻하지 않아요.</p></div>`;
    root.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { st.method = b.dataset.m; draw(); });
  };
  draw(); return root;
}
function mount(build) {
  document.body.innerHTML = `<div class="app">${TOP()}<main class="wrap" id="main"></main></div>`;
  build($('#main'));
}
