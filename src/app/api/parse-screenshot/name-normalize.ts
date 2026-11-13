// 종목명 후처리(서버 전용): 증권사 화면에서 이름이 잘리거나 다음 줄 숫자가 붙는 경우를 정리한다.
// - 잘린 이름 끝의 `(`·`…`·`...` 제거 (예: `KODEX 미국빅테크10(` → `KODEX 미국빅테크10`, 이후 마스터 접두 일치로 코드 확정)
// - 끝 `(N)`이 인식 수량과 같으면 제거(쉼표·공백 허용). 수량과 달라도 N을 뗀 이름만 마스터에 있고 원본은 없으면 제거
//   (주문가능·보유수량이 2줄로 쌓인 화면에서 다른 줄 숫자가 붙은 경우). 그 외 `(H)` 등 문자 괄호는 종목명의 일부로 보존.
import { lookupTicker } from "./ticker-map";

export function stripTrailingQuantity(name: string, quantity: number): string {
  if (!name) return name;
  // 잘린 이름: 끝의 열린 괄호·말줄임
  const truncated = name.replace(/\s*(?:\(|…|\.{2,})\s*$/, "");
  if (truncated !== name && truncated.trim()) return truncated.trim();

  const m = name.match(/^(.*\S)\s*\(\s*([\d,]+(?:\.\d+)?)\s*\)\s*$/);
  if (!m) return name;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return name;
  if (quantity > 0 && Math.abs(n - quantity) <= 1e-9 * Math.max(1, quantity)) return m[1];
  // 수량과 다른 숫자: 이름만으로는 종목을 못 찾고, 숫자를 떼면 찾을 수 있을 때만 제거
  if (!lookupTicker(name) && lookupTicker(m[1])) return m[1];
  return name;
}
