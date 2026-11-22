// 의존 없는 CSV 파서·작성기(따옴표 안 쉼표·줄바꿈 처리). 생성·검증 스크립트와 테스트가 함께 쓴다.
export function parseCsv(txt) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) {
      if (c === '"') { if (txt[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  const [h, ...r] = rows;
  return r.filter((x) => x.length > 1).map((x) => Object.fromEntries(h.map((k, i) => [k, x[i] ?? ""])));
}
const esc = (v) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(header, rows) {
  return [header.join(","), ...rows.map((r) => header.map((h) => esc(String(r[h] ?? ""))).join(","))].join("\n") + "\n";
}
