// 사용: node build.js && NODE_PATH=$(npm root -g) node shoot.js · 캡처(screenshots/r42) + 자동 검사 + 길이/섹션 높이 표(last-report.json)
const { chromium } = require('playwright'), path = require('path'), fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'r42'); fs.mkdirSync(OUT, { recursive: true });
const U = q => 'file://' + path.join(__dirname, 'index.html') + '?' + q;
const SEC = ['s1', 's2', 's3', 's4', 's5'];
const check = () => {
  const out = {}, txt = document.body.innerText;
  out.scrollW = document.documentElement.scrollWidth; out.innerW = innerWidth;
  out.over = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + .5 && !e.closest('svg') && !e.closest('.tblw')).length;
  out.small = [...document.querySelectorAll('button,select,a')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 0 && !e.classList.contains('gc') && r.height < 39.5; }).map(e => (e.textContent || '').trim().slice(0, 10) + ':' + Math.round(e.getBoundingClientRect().height));
  const ov = []; document.querySelectorAll('svg').forEach(sv => { const tx = [...sv.querySelectorAll('text')].map(e => ({ t: e.textContent, r: e.getBoundingClientRect() })); for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i].r, c = tx[j].r; if (a.width && c.width && a.left < c.right - .5 && a.right > c.left + .5 && a.top < c.bottom - .5 && a.bottom > c.top + .5) ov.push(tx[i].t + '×' + tx[j].t); } }); out.textOverlap = ov;
  const cut = txt.replace(/수익률/g, ''); out.forbidden = ['때문', '덕분', '로 인해', '영향으로', '촉발', '여파', '역전', '신호', '예고', '기회', '타이밍', '유리', '불리', '추천', '수익', '로그', '지금 사면', '더 좋', '더 나', '전조'].filter(x => cut.includes(x));
  const stk = document.getElementById('stk').getBoundingClientRect(), top = document.querySelector('.top').getBoundingClientRect(); out.fixedH = Math.round(stk.height); out.topH = Math.round(top.height);
  out.sec = {}; ['s1', 's2', 's3', 's4', 's5'].forEach(id => { const e = document.getElementById(id); out.sec[id] = e ? Math.round(e.getBoundingClientRect().height) : null; });
  out.srcTop = Math.round(document.querySelector('[data-testid=invest-source-button]').getBoundingClientRect().bottom + scrollY);
  out.total = document.documentElement.scrollHeight; out.stkTop = Math.round(stk.top); out.cellMin = Math.min(...[...document.querySelectorAll('.gc[data-y]')].map(e => e.getBoundingClientRect().width)).toFixed(1);
  return out;
};
(async () => {
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' }), rep = {};
  const run = async (name, w, h, q, steps) => {
    const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }), p = await c.newPage();
    await p.goto(U(`w=${w}&${q}`)); await p.waitForTimeout(350);
    rep[name] = await p.evaluate(check);
    for (const [sn, id, off] of steps) { await p.evaluate(([id, off]) => { const e = document.getElementById(id); window.scrollTo(0, e ? e.getBoundingClientRect().top + scrollY - off : 0); window.dispatchEvent(new Event('scroll')); }, [id, off]); await p.waitForTimeout(150); await p.screenshot({ path: path.join(OUT, `${name}-${sn}.png`) }); }
    await c.close();
  };
  const S390 = [['1-first', null, 0], ['2-drop', 's2', 112], ['3-grid', 's3', 112], ['4-period', 's4', 112], ['5-period-chart', 's4', -300], ['6-deep', 's5', 160]];
  for (const th of ['light', 'dark']) await run(`390-${th}`, 390, 844, `theme=${th}&open=table&row=2025`, S390);
  await run('390-light-chips', 390, 844, 'theme=light&chips=1', []);
  await run('320-light', 320, 640, 'theme=light&open=table&row=2025', [['1-first', null, 0], ['4-period', 's4', 112]]);
  await run('320-dark', 320, 640, 'theme=dark&idx=kospi&open=table&row=2025', [['1-first', null, 0], ['4-period', 's4', 112]]);
  await run('390-closed', 390, 844, 'theme=light', []);
  await run('320-closed', 320, 640, 'theme=light', []);
  await run('390-ndx-dark', 390, 844, 'theme=dark&idx=ndx', []);
  fs.writeFileSync(path.join(__dirname, 'last-report.json'), JSON.stringify(rep, null, 1)); console.log(JSON.stringify(rep, null, 1)); await b.close();
})();
