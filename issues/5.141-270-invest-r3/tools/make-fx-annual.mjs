// FRED EXKOUS(연준 G.5) 월 CSV → 연평균 CSV. 사용: node make-fx-annual.mjs <EXKOUS.csv> <out.csv>
// 연평균 = 월 12개 단순 평균(소수 1자리, half-up). 12개월이 다 있는 해만(1982~2025). 앱 런타임 호출 0.
import fs from "node:fs";
const [inF, out] = process.argv.slice(2);
const rows = fs.readFileSync(inF, "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
// 월 값을 정수(×10^4)로 합산해 부동소수점 오차 없이 half-up 정수 나눗셈으로 반올림한다.
const by = {};
for (const [d, v] of rows) { if (v === "." || v === "") continue; (by[d.slice(0, 4)] ||= []).push(Math.round(parseFloat(v) * 1e4)); }
const hu = (num, den) => Math.floor((2 * num + den) / (2 * den));
const lines = ["year,krw_per_usd_avg,months"];
for (const y of Object.keys(by).sort()) {
  const a = by[y];
  if (a.length !== 12) continue;
  const s = a.reduce((p, x) => p + x, 0);
  lines.push(`${y},${(hu(s, 12 * 1000) / 10).toFixed(1)},12`);
}
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.length - 1, "행");
