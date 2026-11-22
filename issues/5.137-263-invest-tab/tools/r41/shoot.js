// 사용: NODE_PATH=$(npm root -g) node shoot.js [이름 ...] · 캡처 + 자동 검사(last-report.json). PW_CHROME 으로 크롬 경로 지정
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'r41'); fs.mkdirSync(OUT, { recursive: true });
const URL = q => 'file://' + path.join(__dirname, 'index.html') + '?' + q;
const S = {
  '390-grid-light': { q: 'w=390&theme=light&yr=2008', vp: [390, 900], sel: '[data-testid=yearly-grid]' },
  '390-grid-dark': { q: 'w=390&theme=dark&yr=2022', vp: [390, 900], sel: '[data-testid=yearly-grid]' },
  '390-grid-kospi-light': { q: 'w=390&theme=light&idx=kospi&yr=1998', vp: [390, 900], sel: '[data-testid=yearly-grid]' },
  '390-period-10y-light': { q: 'w=390&theme=light', vp: [390, 900], sel: '#sec3' },
  '390-period-10y-dark': { q: 'w=390&theme=dark&cy=2022&info=1', vp: [390, 900], sel: '#sec3' },
  '390-period-1999-2012-light': { q: 'w=390&theme=light&sy=1999&ey=2012&cy=2008&yr=2008', vp: [390, 1400], sel: 'main' },
  '390-period-1999-2012-dark': { q: 'w=390&theme=dark&sy=1999&ey=2012&cy=2002', vp: [390, 900], sel: '#sec3' },
  '390-period-full-light': { q: 'w=390&theme=light&full=1', vp: [390, 900], sel: '#sec3' },
  '390-period-ndx-light': { q: 'w=390&theme=light&idx=ndx&sy=1999&ey=2012', vp: [390, 900], sel: '#sec3' },
  '390-altB-light': { q: 'w=390&theme=light&alt=b', vp: [390, 500], sel: 'main' },
  '320-light': { q: 'w=320&theme=light&sy=1999&ey=2012&yr=2008', vp: [320, 1400], sel: 'main' },
  '320-dark-10y': { q: 'w=320&theme=dark', vp: [320, 1400], sel: 'main' },
  '1280-light': { q: 'w=1280&theme=light&sy=1999&ey=2012&yr=2008&cy=2008', vp: [1280, 900], sel: 'main' },
  '1280-dark': { q: 'w=1280&theme=dark&idx=ndx', vp: [1280, 900], sel: 'main' },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(S);
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' }); const rep = {};
  for (const n of names) {
    const s = S[n], c = await b.newContext({ viewport: { width: s.vp[0], height: s.vp[1] }, deviceScaleFactor: 2 }), p = await c.newPage();
    await p.goto(URL(s.q)); await p.waitForTimeout(400);
    const bb = await (await p.$(s.sel)).boundingBox(); await p.screenshot({ path: path.join(OUT, n + '.png'), fullPage: true, clip: { x: 0, y: Math.max(0, bb.y - 10), width: s.vp[0], height: bb.height + 20 } });
    rep[n] = await p.evaluate(() => {
      const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
      const pr = s => (s.match(/[\d.]+/g) || []).map(Number);
      const card = pr(getComputedStyle(document.querySelector('.card')).backgroundColor), fg = pr(getComputedStyle(document.body).color);
      let minC = 99, minCell = null; const cells = [...document.querySelectorAll('[data-testid=year-cell]')];
      cells.forEach(e => { const bg = pr(getComputedStyle(e).backgroundColor); const a = bg.length > 3 ? bg[3] : 1; const m = [0, 1, 2].map(i => bg[i] * a + card[i] * (1 - a)); const l1 = lum(m), l2 = lum(fg), r = (Math.max(l1, l2) + .05) / (Math.min(l1, l2) + .05); if (r < minC) { minC = r; minCell = e.textContent; } });
      const cw = cells.map(e => e.getBoundingClientRect()), minW = cw.length ? Math.min(...cw.map(r => r.width)) : null, minH = cw.length ? Math.min(...cw.map(r => r.height)) : null;
      const cellOver = cells.filter(e => e.scrollWidth > e.clientWidth + 0.5).map(e => e.textContent);
      const ov = []; document.querySelectorAll('svg').forEach(sv => { const tx = [...sv.querySelectorAll('text')].map(e => ({ t: e.textContent, r: e.getBoundingClientRect() })); for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i].r, c = tx[j].r; if (a.width && c.width && a.left < c.right - .5 && a.right > c.left + .5 && a.top < c.bottom - .5 && a.bottom > c.top + .5) ov.push(tx[i].t + ' × ' + tx[j].t); } });
      const small = [...document.querySelectorAll('button,select')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && !e.classList.contains('gc') && r.height < 39.5; }).map(e => (e.textContent || e.id).slice(0, 10) + ':' + Math.round(e.getBoundingClientRect().height));
      const over = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + .5 && !e.closest('svg')).length;
      const txt = document.body.innerText, bad = ['때문', '덕분', '로 인해', '영향으로', '촉발', '여파', '역전', '신호', '예고', '기회', '타이밍', '유리', '불리', '추천', '수익', '로그', '지금 사면', '→', '↑', '↓', '가데이터', '확인 중', '더 좋', '더 나', '전조'].filter(x => txt.includes(x));
      const g = x => { const e = document.querySelector(x); return e ? e.textContent : null; };
      const gw = document.querySelector('.ggrid') ? document.querySelector('.ggrid').getBoundingClientRect().width : null;
      return { scrollW: document.documentElement.scrollWidth, innerW: innerWidth, over, cells: cells.length, cellMinW: minW && +minW.toFixed(1), cellMinH: minH, cellTextClipped: cellOver, minContrast: +minC.toFixed(2), minContrastCell: minCell, textOverlap: ov, smallBtn: small, forbidden: bad,
        lump: g('[data-testid=calc-mult-lump]'), lumpTot: g('[data-testid=calc-total-lump]'), lumpCagr: g('[data-testid=calc-cagr-lump]'), dca: g('[data-testid=calc-mult-dca]'), dcaTot: g('[data-testid=calc-total-dca]'), dcaCagr: g('[data-testid=calc-cagr-dca]'), endLump: g('[data-testid=end-lump]'), endDca: g('[data-testid=end-dca]'), barLabels: document.querySelectorAll('[data-testid=period-bar]').length };
    });
    await c.close();
  }
  fs.writeFileSync(path.join(__dirname, 'last-report.json'), JSON.stringify(rep, null, 1)); console.log(JSON.stringify(rep, null, 1)); await b.close();
})();
