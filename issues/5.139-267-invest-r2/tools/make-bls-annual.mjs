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
const c = avg(read(cpiF)), u = avg(read(unF));
// 월 12개가 아니면 null(2025-10은 미 연방정부 셧다운으로 BLS가 값을 내지 않음 → 2025 연평균·전년 대비는 빈 칸. 추정·보간 0)
const mean = (a, y) => (a[y]?.length === 12 ? a[y].reduce((s, x) => s + x, 0) / 12 : null);
const r = (x, n) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n);
const lines = ["year,cpi_u_avg,cpi_u_yoy_pct,unemployment_avg_pct"];
for (let y = 1961; y <= 2025; y++) {
  const a = mean(c, y), p = mean(c, y - 1), un = mean(u, y);
  lines.push(`${y},${a == null ? "" : r(a, 3)},${a == null || p == null ? "" : r((a / p - 1) * 100, 1)},${un == null ? "" : r(un, 1)}`);
}
fs.writeFileSync(out, lines.join("\n") + "\n");
console.log(lines.length - 1, "행");
