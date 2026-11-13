// 미래에셋 등 일부 화면에서 종목명 끝에 수량이 괄호로 붙어 인식되는 경우(`KODEX 미국빅테크10(104)`) 제거.
// 괄호 숫자가 인식된 수량과 같을 때만 제거하고, 다르면 종목명의 일부로 보존한다. 서버 후처리 전용.
export function stripTrailingQuantity(name: string, quantity: number): string {
  if (!name || !(quantity > 0)) return name;
  const m = name.match(/^(.*\S)\s*\(\s*([\d,]+(?:\.\d+)?)\s*\)\s*$/);
  if (!m) return name;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n) || Math.abs(n - quantity) > 1e-9 * Math.max(1, quantity)) return name;
  return m[1];
}
