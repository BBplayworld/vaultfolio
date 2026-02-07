// 숫자에 천 단위 콤마 추가
export function formatNumberWithCommas(value: number | string): string {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(numValue)) return "";
  return numValue.toLocaleString("ko-KR");
}

// 콤마가 포함된 문자열을 숫자로 변환
export function parseNumberFromCommas(value: string): number {
  const parsed = parseFloat(value.replace(/,/g, ""));
  return isNaN(parsed) ? 0 : parsed;
}

// 화폐 단위 포맷 (원)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

// 짧은 화폐 단위 포맷 (천억, 억, 만)
export function formatShortCurrency(value: number): string {
  if (value === 0) return "0원";
  if (value >= 1000000000000) {
    // 1조 이상
    return `${(value / 1000000000000).toFixed(1)}조원`;
  }
  if (value >= 100000000000) {
    // 1000억 이상
    return `${(value / 100000000).toFixed(0)}억원`;
  }
  if (value >= 100000000) {
    // 1억 이상
    return `${(value / 100000000).toFixed(1)}억원`;
  }
  if (value >= 10000) {
    // 1만 이상
    return `${(value / 10000).toFixed(0)}만원`;
  }
  return formatCurrency(value);
}

// 보유일수 계산
export function calculateHoldingDays(purchaseDate: string): number {
  const purchase = new Date(purchaseDate);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - purchase.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}
