// 종목명 후처리(서버 전용): 증권사 화면에서 이름이 잘리거나 다음 줄 숫자가 붙는 경우를 정리한다.
// - 잘린 이름 끝의 `(`·`…`·`...` 제거 (예: `KODEX 미국빅테크10(` → `KODEX 미국빅테크10`, 이후 마스터 접두 일치로 코드 확정)
// - 끝 `(N)`이 인식 수량과 같으면 제거(쉼표·공백 허용). 수량과 달라도 N을 뗀 이름만 마스터에 있고 원본은 없으면 제거
//   (주문가능·보유수량이 2줄로 쌓인 화면에서 다른 줄 숫자가 붙은 경우). 그 외 `(H)` 등 문자 괄호는 종목명의 일부로 보존.
// - 키움식 2줄 행의 2행 꼬리 `구분 | 티커`(예: `엔비디아 현금 | NVDA`) 제거, 말줄임·열린 괄호는 반복 제거 (5.101)
// - 줄바꿈 자리에 공백이 끼어도(`미국 빅테크`) 마스터 종목명과 공백·괄호 무시로 같으면 마스터 표기로 통일
import { FOREIGN_STOCK_MAP, lookupTicker } from "./ticker-map";
import { KR_NAME_TO_CODE } from "@/lib/finance/kr-master";
import { normalizeStockName } from "@/lib/name-match";

let masterByNorm: Map<string, string> | null = null;
function canonicalMasterName(name: string): string {
  if (!masterByNorm) {
    masterByNorm = new Map();
    for (const k of [...Object.keys(KR_NAME_TO_CODE), ...Object.keys(FOREIGN_STOCK_MAP)]) {
      const n = normalizeStockName(k);
      if (n && !masterByNorm.has(n)) masterByNorm.set(n, k);
    }
  }
  const n = normalizeStockName(name);
  return (n.length >= 4 && masterByNorm.get(n)) || name;
}

export function stripTrailingQuantity(name: string, quantity: number, ticker?: string | null): string {
  if (!name) return name;
  return canonicalMasterName(stripCore(name, quantity, ticker));
}

function stripCore(name: string, quantity: number, ticker?: string | null): string {
  // 2행 꼬리 `현금 | TSLA` (구분 1~4자 한글 + | + 티커)
  // `구분 | 티커`(구분은 알려진 계좌 구분 라벨)이거나 `|` 뒤가 이 종목의 티커와 같을 때만 제거(영문 이름 `Procter | Gamble` 보존)
  const tm = name.match(/^(.*?)\s*\|\s*([A-Za-z0-9.-]{1,12})\s*$/);
  if (tm && tm[1].trim()) {
    const head = tm[1].trim();
    const lm = head.match(/^(.*\S)\s+(?:현금|신용|융자|대출|담보|대주|일반|위탁|예탁)$/);
    if (lm) name = lm[1];
    else if (ticker && tm[2].toUpperCase() === ticker.trim().toUpperCase()) name = head;
  }
  // 잘린 이름: 끝의 열린 괄호·말줄임(겹쳐 있어도 모두)
  const truncated = name.replace(/(?:\s|\(|…|\.{2,})+$/, "");
  if (truncated !== name && truncated.trim()) return truncated.trim();

  // 닫는 괄호 없는 `(숫자` 꼬리(예: `KODEX 미국빅테크10(104`): 수량과 같거나, 떼야 마스터에 매칭될 때만 제거
  const u = name.match(/^(.*\S)\s*\(\s*([\d,]+(?:\.\d+)?)\s*$/);
  if (u) {
    const n = Number(u[2].replace(/,/g, ""));
    if (Number.isFinite(n)) {
      if (quantity > 0 && Math.abs(n - quantity) <= 1e-9 * Math.max(1, quantity)) return u[1];
      if (!lookupTicker(name) && lookupTicker(u[1])) return u[1];
    }
    return name;
  }

  const m = name.match(/^(.*\S)\s*\(\s*([\d,]+(?:\.\d+)?)\s*\)\s*$/);
  if (!m) return name;
  const n = Number(m[2].replace(/,/g, ""));
  if (!Number.isFinite(n)) return name;
  if (quantity > 0 && Math.abs(n - quantity) <= 1e-9 * Math.max(1, quantity)) return m[1];
  // 수량과 다른 숫자: 이름만으로는 종목을 못 찾고, 숫자를 떼면 찾을 수 있을 때만 제거
  if (!lookupTicker(name) && lookupTicker(m[1])) return m[1];
  return name;
}
