// 목업 스크린샷: node shoot.js  (라이트·다크 × 390 전 상태, 320 핵심 상태, 줄바꿈 측정 로그)
const { chromium } = require('playwright'); const path = require('path');
const dir = path.resolve(__dirname); const out = path.resolve(dir, '../screenshots');
const file = 'file://' + path.join(dir, 'mock.html');
const all = ['a','b','b_us','load','e0','none','error','c','c_fail','c_us','c_load','f','f0','h1','h0'];
const key = ['a','b','none','error','c','c_fail','c_us','c_load','f','h1','h0'];
(async () => {
  const b = await chromium.launch();
  for (const [w, list, themes] of [[390, all, ['light','dark']], [320, key, ['light','dark']]]) {
    for (const t of themes) for (const s of list) {
      const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 });
      await p.goto(`${file}?s=${s}&t=${t === 'dark' ? 'dark' : 'light'}`);
      await p.locator('.dlg').screenshot({ path: `${out}/mock-${w}-${t}-${s}.png` });
      // 가로 넘침·줄 수 측정
      const m = await p.evaluate(() => { const d = document.querySelector('.dlg'); const over = [...d.querySelectorAll('*')].filter(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible').map(e => e.className || e.tagName).slice(0, 5); const notes = [...d.querySelectorAll('p,.note span')].map(e => [e.textContent.trim().slice(0, 18), Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight))]); return { over, notes, docW: document.documentElement.scrollWidth }; });
      console.log(w, t, s, JSON.stringify(m));
      await p.close();
    }
  }
  await b.close();
})();
