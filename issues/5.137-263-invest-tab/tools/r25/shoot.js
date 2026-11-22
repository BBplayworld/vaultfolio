// 사용: NODE_PATH=$(npm root -g) node shoot.js [이름 ...]  (PW_CHROME 으로 크롬 경로 지정)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'r25'); fs.mkdirSync(OUT, { recursive: true });
const URL = q => 'file://' + path.join(__dirname, 'index.html') + '?' + q;
const FOLD = 780;
const SHOTS = {
  '390-first-light': { q: 'w=390&theme=light', vp: [390, FOLD], kind: 'vp' },
  '390-first-dark': { q: 'w=390&theme=dark', vp: [390, FOLD], kind: 'vp' },
  '390-open-dotcom-light': { q: 'w=390&theme=light&ep=1', vp: [390, 844], kind: 'chartlist' },
  '390-open-dotcom-dark': { q: 'w=390&theme=dark&ep=1', vp: [390, 844], kind: 'chartlist' },
  '390-open-2022-light': { q: 'w=390&theme=light&ep=3', vp: [390, 844], kind: 'chartlist' },
  '390-yr-2008-light': { q: 'w=390&theme=light&yr=2008', vp: [390, 844], kind: 'chartlist' },
  '390-yr-2020-light': { q: 'w=390&theme=light&yr=2020', vp: [390, FOLD], kind: 'vp' },
  '390-ndx-first-light': { q: 'w=390&theme=light&idx=ndx', vp: [390, FOLD], kind: 'vp' },
  '390-kospi-first-light': { q: 'w=390&theme=light&idx=kospi', vp: [390, FOLD], kind: 'vp' },
  '390-kospi-first-dark': { q: 'w=390&theme=dark&idx=kospi', vp: [390, FOLD], kind: 'vp' },
  '390-kospi-list-light': { q: 'w=390&theme=light&idx=kospi', vp: [390, 844], kind: 'chartlist' },
  '390-kospi-ongoing-sim-light': { q: 'w=390&theme=light&idx=kospi&asof=2022&ep=5', vp: [390, 844], kind: 'chartlist' },
  '320-first-light': { q: 'w=320&theme=light', vp: [320, 700], kind: 'vp' },
  '320-kospi-first-light': { q: 'w=320&theme=light&idx=kospi', vp: [320, 700], kind: 'vp' },
  '390-sec3-light': { q: 'w=390&theme=light', vp: [390, 844], kind: 'el', sel: '#sec3' },
  '390-sec3-yearly-dark': { q: 'w=390&theme=dark&m=yearly', vp: [390, 844], kind: 'el', sel: '#sec3' },
  '390-source-light': { q: 'w=390&theme=light', vp: [390, 844], kind: 'src' },
  '1280-light': { q: 'w=1280&theme=light', vp: [1280, 900], kind: 'full' },
  '1280-dark': { q: 'w=1280&theme=dark&idx=ndx', vp: [1280, 900], kind: 'full' },
};
(async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHOTS);
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  const report = {};
  for (const n of names) {
    const S = SHOTS[n]; const c = await b.newContext({ viewport: { width: S.vp[0], height: S.vp[1] }, deviceScaleFactor: 2 }); const p = await c.newPage();
    await p.goto(URL(S.q)); await p.waitForTimeout(250);
    const f = path.join(OUT, n + '.png');
    if (S.kind === 'vp') await p.screenshot({ path: f });
    else if (S.kind === 'full') await p.screenshot({ path: f, fullPage: true });
    else if (S.kind === 'el') { const bb = await (await p.$(S.sel)).boundingBox(); await p.screenshot({ path: f, fullPage: true, clip: { x: 0, y: bb.y - 12, width: S.vp[0], height: bb.height + 24 } }); }
    else if (S.kind === 'src') { const bb = await (await p.$('[data-testid=invest-source]')).boundingBox(); await p.screenshot({ path: f, fullPage: true, clip: { x: 0, y: bb.y - 12, width: S.vp[0], height: bb.height + 24 } }); }
    else { const A = await (await p.$('[data-testid=invest-sec1]')).boundingBox(); const Z = await (await p.$('[data-testid=invest-list]')).boundingBox(); await p.screenshot({ path: f, fullPage: true, clip: { x: 0, y: A.y - 8, width: S.vp[0], height: Z.y + Z.height - A.y + 16 } }); }
    report[n] = await p.evaluate(F => {
      const re = /\d[\d,.]*/g, toks = new Set(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let nd;
      while ((nd = w.nextNode())) { const t = nd.textContent.trim(); if (!t) continue; const el = nd.parentElement; if (el.closest('.ax') || el.closest('.axrow') || el.closest('.nm') || el.closest('[data-nm]') || el.closest('[data-testid=invest-index]') || el.closest('.cap') || el.closest('.top')) continue; const r = document.createRange(); r.selectNodeContents(nd); const bb = r.getBoundingClientRect(); if (bb.width && bb.top < F && bb.bottom > 0) (t.match(re) || []).forEach(m => toks.add(m.replace(/[.,]$/, ''))); }
      const over = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + .5 && !e.closest('svg')).length;
      const tx = [...document.querySelectorAll('#mc text')].map(e => ({ t: e.textContent, r: e.getBoundingClientRect() })), ov = []; for (let i = 0; i < tx.length; i++) for (let j = i + 1; j < tx.length; j++) { const a = tx[i].r, c = tx[j].r; if (a.width && c.width && a.left < c.right - .5 && a.right > c.left + .5 && a.top < c.bottom - .5 && a.bottom > c.top + .5) ov.push(tx[i].t + ' × ' + tx[j].t); }
      const rows = [...document.querySelectorAll('.row')].map(e => { const r = e.getBoundingClientRect(); return { nm: e.querySelector('.nm').textContent, top: Math.round(r.top), bottom: Math.round(r.bottom), vis: r.bottom <= F }; });
      const hit = [...document.querySelectorAll('button')].filter(e => { const r = e.getBoundingClientRect(); return r.height < 39.5 && r.height > 0 && !e.classList.contains('row'); }).length;
      const names = [...document.querySelectorAll('#mc [data-nm]')].map(e => e.textContent);
      return { nums: [...toks], count: toks.size, scrollW: document.documentElement.scrollWidth, over, textOverlap: ov, rowsInFold: rows.filter(r => r.vis).length, rows: rows.map(r => `${r.nm}:${r.top}-${r.bottom}`).slice(0, 8), smallBtn: hit, chartNames: names, h: document.documentElement.scrollHeight };
    }, FOLD);
    await c.close();
  }
  console.log(JSON.stringify(report, null, 1)); await b.close();
})();
