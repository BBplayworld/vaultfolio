// 사용: node compare.js → 문서 표용 값(한 번에 / 매달-평균 / 매달-직선보간 / 해마다 연말). 값은 ../r3/data.js
const D = eval(require('fs').readFileSync(__dirname + '/../r3/data.js', 'utf8').replace('window.DATA=', '(').replace(/;\s*$/, '') + ')');
function run(k, sy, ey) { const d = D.idx[k], c = d.close, i0 = sy - d.start, n = ey - sy; const L = c[i0 + n] / c[i0];
  let ua = 0, ul = 0, uy = 0; for (let t = 1; t <= n; t++) { const a = c[i0 + t - 1], b = c[i0 + t]; ua += (1 / n) / ((a + b) / 2); for (let m = 1; m <= 12; m++) ul += (1 / (12 * n)) / (a + (b - a) * m / 12); uy += 1 / n / a; }
  const fin = c[i0 + n], irr = (V, mm) => { let lo = -.99, hi = 10; for (let q = 0; q < 80; q++) { const r = (lo + hi) / 2; let s = 0; for (let j = 1; j <= 12 * n; j++) s += Math.pow(1 + r, n - j / 12) / (12 * n); if (s < V) lo = r; else hi = r; } return (lo + hi) / 2 * 100; };
  const A = ua * fin, Lin = ul * fin, Y = uy * fin; // 해마다 연말: n번 연말(시작 해 말 ~ 끝 전년 말)
  let ys = 0; for (let k2 = 0; k2 < n; k2++) ys += 1 / n / c[i0 + k2]; const Ye = ys * fin;
  return { k, sy, ey, L, Lc: (Math.pow(L, 1 / n) - 1) * 100, A, Ac: irr(A), Lin, Linc: irr(Lin), Ye };
}
const f = v => v.toFixed(3);
for (const [sy, ey] of [[2015, 2025], [1999, 2012], [2000, 2002], [2007, 2009], [1989, 2025]]) for (const k of ['spx', 'ndx', 'kospi']) { const d = D.idx[k]; if (sy < d.start) continue; const r = run(k, sy, ey); console.log(`${k} ${sy}→${ey} 한번에 ${f(r.L)}배(${(r.L - 1) * 100 | 0}%, 연평균 ${r.Lc.toFixed(2)}) | 매달·평균 ${f(r.A)}배(${((r.A - 1) * 100).toFixed(0)}%, ${r.Ac.toFixed(2)}) | 매달·보간 ${f(r.Lin)}배(${((r.Lin - 1) * 100).toFixed(0)}%, ${r.Linc.toFixed(2)}) | 해마다 연말 ${f(r.Ye)}배`); }
