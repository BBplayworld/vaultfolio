// FRED(BLS 원자료 경유) 월 CSV 2개 → 연평균 CSV. 사용: node make-bls-annual.mjs <CPIAUCNS.csv> <UNRATENSA.csv> <out.csv>
// 연평균 = 월 12개 단순 평균, CPI 전년 대비 % = 연평균 지수 비율. 1961~2025(2026 제외). 앱 런타임 호출 0.
import fs from "node:fs";
const [cpiF, unF, out] = process.argv.slice(2);
const read = (f) => fs.readFileSync(f, "utf8").trim().split("\n").slice(1).map((l) => l.split(","));
const avg = (rows) => {
  const by = {};
  for (const [d, v] of rows) { if (v === "." || v === "") continue; (by[d.slice(0, 4)] ||= []).push(+v); }
  return by;
};
// 부동소수점 오차로 x.x5 반올림이 흔들리지 않게 월 값을 정수(×1000)로 합산하고 half-up 정수 나눗셈으로 반올림한다.
const toInt = (v) => Math.round(parseFloat(v) * 1000);
const sums = (rows) => {
  const by = {};
  for (const [d, v] of rows) { if (v === "." || v === "") continue; (by[d.slice(0, 4)] ||= []).push(toInt(v)); }
  const o = {};
  for (const [y, a] of Object.entries(by)) if (a.length === 12) o[y] = a.reduce((s, x) => s + x, 0);
  return o; // 월 12개 합(×1000), 12개가 안 차면 없음(2025-10 미공표 → 빈 칸, 보간 0)
};
const c = sums(read(cpiF)), u = sums(read(unF));
const hu = (num, den) => Math.floor((2 * num + den) / (2 * den)); // num/den half-up 정수 반올림
const fx = (n, d) => (n / 10 ** d).toFixed(d);
const lines = ["year,cpi_u_avg,cpi_u_yoy_pct,unemployment_avg_pct"];
for (let y = 1961; y <= 2025; y++) {
  const a = c[y], p = c[y - 1], un = u[y];
  const avgC = a == null ? "" : fx(hu(a, 12), 3); // 연평균 지수(소수 3자리)
  const yoy = a == null || p == null ? "" : fx(hu(1000 * (a - p), p), 1); // 전년 대비 %(소수 1자리, 연평균끼리의 비)
  const unT = un == null ? "" : fx(hu(un, 12 * 100), 1); // 월 합(×1000) → 연평균 소수 1자리
  lines.push(`${y},${avgC},${yoy},${unT}`);
}
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.length - 1, "행");
