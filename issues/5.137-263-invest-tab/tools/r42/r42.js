/* #263 R4.2 모바일 정리안 — 순서: 첫 화면 → 크게 빠진 때 → 연도별 수익률(격자) → 기간 수익률 → 더 깊이 보기 → 출처. 값은 data.js 계산, 하드코딩 0. 시안용
   쿼리: w idx theme chips=1(바로가기 칩) open=table|pattern(깊이 보기 펼침) row=<연도>(표 행 펼침) info=1 sy ey yr cy */
const A = R3, B = R41, Q = new URLSearchParams(location.search), $ = (s, r = document) => r.querySelector(s);
const VW = +(Q.get('w') || 390), DARK = Q.get('theme') === 'dark', d = A.cur(), MINUS = '−';
B.fixSE();
const fp = A.fp, lvlf = v => v >= 10 ? Math.round(v).toLocaleString('en-US') : v.toFixed(1);
const CW = VW - 32 - 32;
const mc = A.mainChart(d, CW, {});
const card1 = `<section class="card tight" id="s1" data-testid="invest-sec1">${A.headline(d).replace(/<div class="base[\s\S]*?<\/div>(?=<\/div>$)/, '')}<div class="rd" data-testid="invest-readout"><div class="rd1"><span class="hint">해를 누르거나 끌면 그해 말 값이 나와요</span></div></div><div class="mcw" id="mcw">${mc.svg}${A.ovBtn(d, mc.geo)}${A.ovMenu(d, mc.geo)}</div></section>`;
// 목록 카드: 질문 한 줄 + 정본 제목·부제 + 행(접힘) + 각주(비교 기준 줄을 머리에서 이곳으로 이동)
const B0 = d.base, who = d.rate === 'us' ? '미국' : '한국';
const baseLine = `${who} 금리 자료가 있는 ${B0.n}년 중 내려간 해는 ${B0.down}년, 올라간 해는 ${B0.up}년` + (B0.flat ? `, 거의 그대로인 해는 ${B0.flat}년이었어요` : '이었고 거의 그대로인 해는 없었어요');
const list = `<section class="card tight" id="s2" data-testid="invest-list"><div class="q">얼마나 크게 빠졌고, 그때 금리는 어땠나요?</div>${A.listHTML(d, VW - 32 - 32 + 24, true)}<p class="note pre" style="margin-top:4px" data-testid="invest-base">${baseLine}</p></section>`;
const grid = B.gridCard().replace('연도별 등락률</div>', '연도별 수익률</div>').replace('아래 기간 등락률에서', '아래 기간 수익률에서').replace('<div class="sec-t"', '<div class="q">해마다 얼마나 움직였나요?</div><div class="sec-t"');
const period = B.periodCard().replace('기간 등락률 <small>', '기간 수익률 <small>').replace('<div class="sec-t">', '<div class="q">그해 말에 넣었다면 얼마가 됐을까요?</div><div class="sec-t">');
// 더 깊이 보기: 접힘 행 2개(기존 tblbtn 패턴). 표는 핵심 4열 + 행을 누르면 나머지 값(가로 스크롤 0)
const op = Q.get('open'), rowY = +(Q.get('row') || 0);
const pc = v => v == null ? '—' : v.toFixed(2) + '%', f2 = v => v == null ? '—' : (v < 0 ? MINUS : '') + Math.abs(v).toFixed(2);
const tb = d.tbl.slice().sort((a, b) => b.y - a.y), us = d.rate === 'us';
const mrows = tb.slice(0, 10).map(r => `<button class="mr" data-row="${r.y}" aria-expanded="${rowY === r.y}"><span>${r.y}</span><span>${lvlf(r.close)}</span><span class="${r.ret == null ? '' : r.ret < 0 ? 'dn' : 'up'}">${r.ret == null ? '—' : fp(r.ret)}</span><span>${r.dir === 'none' ? '—' : A.PH[r.dir]}</span><span class="ch" aria-hidden="true">›</span></button>${rowY === r.y ? `<dl class="kv"><div><span class="k">기준금리 연말</span><b>${pc(r.rate)}</b></div>${us ? `<div><span class="k">10년 만기 국채 금리</span><b>${pc(r.y10)}</b></div><div><span class="k">장단기 금리차 10년−2년(%p)</span><b>${f2(r.s2)}</b></div><div><span class="k">경기침체</span><b>${r.rec > 0 ? r.rec + '개월' : '—'}</b></div>` : ''}<div><span class="k">사건</span><b>${r.ev.length ? r.ev.join(', ') : '—'}</b></div></dl>` : ''}`).join('');
const gloss = us ? `<div class="gloss" data-testid="invest-gloss"><b>장단기 금리차</b>는 10년 만기 국채 금리에서 2년 만기 금리를 뺀 값이에요. 마이너스면 짧은 쪽 금리가 더 높았다는 뜻이에요. <b>경기침체</b>는 미국 경제연구소(NBER)가 정한 침체 기간이에요.</div>` : '';
const patSub = '결과를 알 수 있는 해까지 세어 표로 모았어요';
const pat = `<div class="tblsec" data-testid="invest-pattern"><button class="tblbtn" data-acc="pattern" aria-expanded="${op === 'pattern'}"><span><b class="sb">하락 전 12개월과 크게 오른 해에 있었던 일</b><small>${patSub}</small></span><span class="chev2" aria-hidden="true">⌄</span></button><div class="tblpanel ${op === 'pattern' ? 'open' : ''}"><div class="tblin" style="padding:4px 0 8px"><p class="tsm" style="line-height:1.5">크게 빠지기 전 12개월에 연준 금리가 올라간 때는 자료가 있는 3번 중 1번이었어요.</p><p class="note" style="margin-top:6px">(이하 R4 정본 그대로: 에피소드별 조건 행 4개, 크게 오른 해 행 5개+더 보기)</p></div></div></div>`;
const tab = `<div class="tblsec mt" data-testid="invest-table"><button class="tblbtn" data-acc="table" aria-expanded="${op === 'table'}"><span><b class="sb">연도별 표</b><small>그림의 값을 해마다 표로 모았어요. 해를 누르면 나머지 값이 나와요</small></span><span class="chev2" aria-hidden="true">⌄</span></button><div class="tblpanel ${op === 'table' ? 'open' : ''}"><div class="tblin"><div class="mh"><span>연도</span><span>연말 지수</span><span>연간 등락</span><span>금리 방향</span><span></span></div>${mrows}${gloss}<button class="more">이전 해 10개 더 보기</button></div></div></div>`;
const deep = `<section class="card tight deep" id="s5" data-testid="invest-deep"><div class="dh">더 깊이 보기</div>${pat}${tab}</section>`;
const src = `<div class="srcb" data-testid="invest-source-button"><span>출처·라이선스</span><span class="ih" aria-hidden="true">i</span><span aria-hidden="true">⌄</span></div>`;
const chips = Q.get('chips') ? `<nav class="chips" aria-label="바로가기"><a href="#s2">빠진 때</a><a href="#s3">해마다</a><a href="#s4">넣었다면</a><a href="#s5">더 보기</a></nav>` : '';
const idx = `<div class="stk" id="stk"><div class="seg hit" role="tablist" aria-label="지수 선택" data-testid="invest-index">${[['spx', 'S&amp;P 500'], ['ndx', '나스닥100'], ['kospi', '코스피']].map(([k, l]) => `<button class="${A.ST.idx === k ? 'on' : ''}" data-i="${k}" role="tab">${l}</button>`).join('')}</div>${chips}</div>`;
const wrap = x => x.replace('<section class="card gridcard"', '<section id="s3" class="card gridcard"').replace('<section class="card" id="sec3"', '<section class="card" id="s4"');
document.body.innerHTML = `<div class="app">${A.TOP(d)}<main class="wrap" id="main">${idx}${card1}${list}${wrap(grid)}${wrap(period)}${deep}${src}</main></div>`;
document.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const q = new URLSearchParams(location.search); q.set('idx', b.dataset.i); ['sy', 'ey', 'yr', 'cy', 'row'].forEach(k => q.delete(k)); location.search = q.toString(); });
document.querySelectorAll('[data-acc]').forEach(b => b.onclick = () => { const o = b.getAttribute('aria-expanded') !== 'true'; b.setAttribute('aria-expanded', o); b.nextElementSibling.classList.toggle('open', o); });
document.querySelectorAll('.mr').forEach(b => b.onclick = () => { const q = new URLSearchParams(location.search); q.set('open', 'table'); q.set('row', b.dataset.row); location.search = q.toString(); });
addEventListener('scroll', () => $('#stk').classList.toggle('shadow', scrollY > 60));
