// 코인 안내 문구 후보를 320(콘텐츠 폭 240)·390(310)에서 줄 수·줄바꿈 위치 측정
const { chromium } = require('playwright');
const cands = [
  "처음 사는 코인은 '암호화폐 추가'로 등록해요. 산 돈은 현금에서 따로 빼 주세요",
  "새 코인은 '암호화폐 추가'로 등록해요. 현금은 따로 빼 주세요",
  "새 코인은 암호화폐 추가에서 등록해요. 현금은 직접 줄여 주세요",
  "새 코인은 암호화폐 추가에서 등록하고, 현금은 직접 줄여 주세요",
  "처음 사는 코인은 암호화폐 추가에서 등록해요. 현금은 직접 줄여 주세요",
  "새 코인은 암호화폐 추가에서 등록해요. 산 돈은 직접 빼 주세요",
];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const w of [240, 310]) {
    for (const c of cands) {
      await p.setContent(`<div id=t style="width:${w}px;font:14px/1.625 sans-serif;word-break:keep-all;text-wrap:pretty">${c}</div>`);
      const r = await p.evaluate(() => { const el = document.getElementById('t'); const rg = document.createRange(); const n = el.firstChild; const lines = []; let last = null, cur = '';
        for (let i = 0; i < n.length; i++) { rg.setStart(n, i); rg.setEnd(n, i + 1); const t = Math.round(rg.getBoundingClientRect().top); if (last !== null && t !== last) { lines.push(cur); cur = ''; } cur += n.data[i]; last = t; } lines.push(cur); return lines; });
      console.log(w, r.length, JSON.stringify(r));
    }
  }
  await b.close();
})();
