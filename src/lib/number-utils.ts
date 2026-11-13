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

// 화폐 단위 포맷 (전체금액 + "원")
export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

// 짧은 화폐 단위 포맷 (억, 만)
/** 종목 통화별 가격 표기(USD $·JPY ¥·그 외 원) — 거래·종목 화면 공용(#4.85, 3벌 중복 통합) */
export function formatPriceByCurrency(value: number, currency: string): string {
  if (currency === "USD") return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (currency === "JPY") return `¥${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  return formatCurrency(value);
}

export function formatShortCurrency(value: number): string {
  if (value === 0) return "0원";

  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";

  const length = Math.floor(abs).toString().length;
  if (length >= 9) {
    // 0.1억(1,000만원) 단위 버림 — 곱셈 뒤 버림은 부동소수 오차로 한 칸 더 버릴 수 있어 정수 나눗셈으로 계산
    return `${sign}${formatTruncatedUnits(Math.floor(abs / 10000000), 1)}억원`;
  }
  if (length >= 5) {
    return `${sign}${formatNumberWithCommas(Math.floor(abs / 10000))}만원`;
  }
  return `${sign}${formatNumberWithCommas(Math.floor(abs))}원`;
}

// units(정수, 소수 digits자리까지의 개수)를 "정수부(천 단위 콤마).소수부" 문자열로 — 끝 0 제거.
// 예: (230, 2) → "2.3", (201, 2) → "2.01", (1200, 2) → "12", (123456, 2) → "1,234.56"
function formatTruncatedUnits(units: number, digits: number): string {
  const factor = 10 ** digits;
  const intPart = Math.floor(units / factor);
  const frac = String(units % factor).padStart(digits, "0").replace(/0+$/, "");
  return `${intPart.toLocaleString("ko-KR")}${frac ? `.${frac}` : ""}`;
}

// 짧은 화폐 단위 포맷 (억, 만, 백만) - 소수점 2자리 (버림)
// 원 단위 정수로 맞춘 뒤 표시 최소 단위(0.01억=100만원 등)로 정수 나눗셈해 버린다.
// 부동소수 곱셈 뒤 Math.floor는 2.3억→2.29억처럼 한 칸 더 버리므로 쓰지 않는다(#129, CHECKLIST C59).
export function formatShortCurrencyDecimal(value: number): string {
  if (value === 0) return "0원";

  const won = Math.round(Math.abs(value)); // 전체 금액 표기(formatCurrency)와 같은 원 단위 기준
  const sign = value < 0 ? "-" : "";

  if (won >= 100000000) {
    // 1억 이상: 소수점 2자리 (버림) — 0.01억 = 100만원 단위
    return `${sign}${formatTruncatedUnits(Math.floor(won / 1000000), 2)}억원`;
  }
  if (won >= 1000000) {
    // 100만 이상: 백만 단위 소수점 2자리 (버림) — 0.01백만 = 1만원 단위
    return `${sign}${formatTruncatedUnits(Math.floor(won / 10000), 2)}백만원`;
  }
  if (won >= 10000) {
    // 1만 이상: 소수점 2자리 (버림) — 0.01만 = 100원 단위
    return `${sign}${formatTruncatedUnits(Math.floor(won / 100), 2)}만원`;
  }
  return formatCurrency(value);
}

// 좁은 화면(320) 막대 값 라벨용 축약 — 원 생략, 억/만 단위, 10 미만 소수 1자리(버림)·이상 정수, 음수는 U+2212. 정밀값은 formatShortCurrencyDecimal
export function formatCompactKRW(value: number): string {
  const won = Math.round(Math.abs(value));
  if (won === 0) return "0";
  const sign = value < 0 ? "\u2212" : "";
  const units = (v: number) => (v < 10 ? `${Math.floor(v * 10) / 10}` : `${Math.floor(v)}`);
  if (won >= 1e8) return `${sign}${units(won / 1e8)}억`;
  if (won >= 1e4) return `${sign}${units(won / 1e4)}만`;
  return `${sign}${won.toLocaleString("ko-KR")}`;
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

// 총 수익률(%) → 연환산 수익률(CAGR, %). 보유기간을 감안한 "1년당 수익률".
// 보유 1년 미만은 연환산이 과장되므로 null(미표시). 원금 전손(-100% 이하)도 정의 불가.
export function annualizeReturnRate(totalRatePct: number, sinceDate: string): number | null {
  if (!sinceDate || totalRatePct <= -100) return null;
  const years = calculateHoldingDays(sinceDate) / 365;
  if (years < 1) return null;
  return (Math.pow(1 + totalRatePct / 100, 1 / years) - 1) * 100;
}

// 만기까지 남은 일수 (지났으면 음수). 만기 D-day 표기용
export function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// 면적 단위 변환 — 1평 = 3.3058㎡. 부동산 입력·근거 표기가 같은 상수를 쓰도록 여기로 모음
export const SQM_PER_PYEONG = 3.3058;
export const sqmToPyeong = (sqm: number): number => sqm / SQM_PER_PYEONG;
export const pyeongToSqm = (pyeong: number): number => pyeong * SQM_PER_PYEONG;

// "84.9㎡ (약 26평)"
export function formatArea(sqm: number): string {
  if (!(sqm > 0)) return "";
  return `${Math.round(sqm * 10) / 10}㎡ (약 ${sqmToPyeong(sqm).toFixed(0)}평)`;
}

// 가격 표시 방식 설정 (1안: "full-only" - 토스/도미노 스타일, 2안: "hybrid" - 시크릿에셋 스타일)
export type PriceDisplayMode = "full-only" | "hybrid";
export const PRICE_DISPLAY_MODE: PriceDisplayMode = "full-only";

export interface PriceLayout {
  primary: string;
  secondary?: string;
}

export function getPriceLayout(
  value: number,
  formatFull: (v: number) => string = formatCurrency,
  formatShort: (v: number) => string = formatShortCurrency
): PriceLayout {
  if (PRICE_DISPLAY_MODE === "full-only") {
    return {
      primary: formatFull(value),
    };
  }
  return {
    primary: formatShort(value),
    secondary: formatFull(value),
  };
}

export function formatPriceByMode(value: number): string {
  if (PRICE_DISPLAY_MODE === "full-only") {
    return formatCurrency(value);
  }
  return formatShortCurrency(value);
}

export function formatPriceDecimalByMode(value: number): string {
  if (PRICE_DISPLAY_MODE === "full-only") {
    return formatCurrency(value);
  }
  return formatShortCurrencyDecimal(value);
}



