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

// 짧은 화폐 단위 포맷 (억, 만)
export function formatShortCurrency(value: number): string {
  if (value === 0) return "0원";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const length = Math.floor(abs).toString().length;
  if (length >= 9) {
    return `${sign}${formatNumberWithCommas(Math.floor((abs / 100000000) * 10) / 10)}억원`;
  }
  if (length >= 5) {
    return `${sign}${formatNumberWithCommas(Math.floor(abs / 10000))}만원`;
  }
  return `${sign}${formatNumberWithCommas(Math.floor(abs))}원`;
}

// 짧은 화폐 단위 포맷 (억, 만, 백만) - 소수점 2자리 (버림)
const truncToFixed = (n: number, digits: number) => {
  const factor = Math.pow(10, digits);
  return (Math.floor(n * factor) / factor).toFixed(digits);
};

export function formatShortCurrencyDecimal(value: number): string {
  if (value === 0) return "0원";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  if (abs >= 100000000) {
    // 1억 이상: 소수점 2자리 (버림)
    const formatted = truncToFixed(abs / 100000000, 2).replace(/\.?0+$/, "");
    return `${sign}${formatNumberWithCommas(formatted)}억원`;
  }
  if (abs >= 1000000) {
    // 100만 이상: 백만 단위 소수점 2자리 (버림)
    const formatted = truncToFixed(abs / 1000000, 2).replace(/\.?0+$/, "");
    return `${sign}${formatted}백만원`;
  }
  if (abs >= 10000) {
    // 1만 이상: 소수점 2자리 (버림)
    const formatted = truncToFixed(abs / 10000, 2).replace(/\.?0+$/, "");
    return `${sign}${formatted}만원`;
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

export function formatHoldingPeriod(purchaseDate: string): string {
  const purchase = new Date(purchaseDate);
  const today = new Date();
  let years = today.getFullYear() - purchase.getFullYear();
  let months = today.getMonth() - purchase.getMonth();
  let days = today.getDate() - purchase.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  if (months > 0) parts.push(`${months}개월`);
  if (days > 0 || parts.length === 0) parts.push(`${days}일`);
  return parts.join(" ");
}

