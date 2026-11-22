// 사용: node shoot.js [a|b|c ...]  (환경변수 PW_CHROME 로 크롬 경로 지정)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const OUT = path.join(__dirname, '..', '..', 'screenshots', 'r1'); fs.mkdirSync(OUT, { recursive: true });
const opts = { a: { sel: 'sel=2008', end: '#sec1' }, b: { sel: 'ep=e07', end: '#sec1' }, c: { sel: 'open=e07', end: '.ec.open' } };
const FOLD = 780; // 844 − PWA 하단 칸 64
(async () => {
  const which = process.argv.slice(2).length ? process.argv.slice(2) : ['a', 'b', 'c'];
  const b = await chromium.launch({ executablePath: process.env.PW_CHROME || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  const report = {};
  for (const k of which) {
    const url = q => 'file://' + path.join(__dirname, k + '.html') + '?' + q;
    const go = async (w, h, q) => { const c = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2 }); const p = await c.newPage(); await p.goto(url(q)); await p.waitForTimeout(250); return [c, p]; };
    const span = async (p, a, z, name, pad = 0) => { const A = await (await p.$(a)).boundingBox(), Z = await (await p.$(z)).boundingBox(); await p.screenshot({ path: path.join(OUT, name), fullPage: true, clip: { x: 0, y: A.y - pad, width: 390, height: Z.y + Z.height - A.y + pad * 2 } }); };
    const el = async (p, sel, name, pad = 0) => { const h = await p.$(sel); const bb = await h.boundingBox(); await p.screenshot({ path: path.join(OUT, name), fullPage: true, clip: { x: 0, y: bb.y - pad, width: 390, height: bb.height + pad * 2 } }); };
    for (const th of ['light', 'dark']) { const [c, p] = await go(390, 844, 'w=390&theme=' + th); await p.screenshot({ path: path.join(OUT, `${k}-390-first-${th}.png`) });
      if (th === 'light') { report[k] = await p.evaluate(F => {
        const re = /\d+(?:[.,]\d+)?/g, toks = [], w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n; while ((n = w.nextNode())) { const t = n.textContent.trim(); if (!t || n.parentElement.closest('.mock')) continue; const r = document.createRange(); r.selectNodeContents(n); const bb = r.getBoundingClientRect(); if (bb.width && bb.top < F && bb.bottom > 0) (t.match(re) || []).forEach(m => toks.push(m)); }
        const over = [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 390.5 && !e.closest('svg')).length;
        return { count: toks.length, toks, scrollW: document.documentElement.scrollWidth, over, h: document.documentElement.scrollHeight };
      }, FOLD); }
      await c.close(); }
    { const [c, p] = await go(390, 844, 'w=390&theme=light&' + opts[k].sel); await span(p, k === 'c' ? '#sec1' : '#sec1', opts[k].end, `${k}-390-interact.png`, 16); await c.close(); }
    { const [c, p] = await go(390, 844, 'w=390&theme=dark&' + opts[k].sel); await span(p, '#sec1', opts[k].end, `${k}-390-interact-dark.png`, 16); await c.close(); }
    { const [c, p] = await go(390, 844, 'w=390&theme=light'); await el(p, '#sec2', `${k}-390-sec2.png`, 16); await el(p, '#sec3', `${k}-390-sec3.png`, 16); await c.close(); }
    { const [c, p] = await go(390, 844, 'w=390&theme=light&m=month'); await el(p, '#sec3', `${k}-390-sec3-month.png`, 16); await c.close(); }
    { const [c, p] = await go(1280, 900, 'w=1280&theme=light&' + opts[k].sel); await p.screenshot({ path: path.join(OUT, `${k}-1280.png`), fullPage: true }); await c.close(); }
  }
  console.log(JSON.stringify(report, null, 1)); await b.close();
})();
