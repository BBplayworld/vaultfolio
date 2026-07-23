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

// 총 수익률(%) → 연환산 수익률(CAGR, %). 보유기간을 감안한 "1년당 수익률".
// 보유 1년 미만은 연환산이 과장되므로 null(미표시). 원금 전손(-100% 이하)도 정의 불가.
export function annualizeReturnRate(totalRatePct: number, sinceDate: string): number | null {
  if (!sinceDate || totalRatePct <= -100) return null;
  const years = calculateHoldingDays(sinceDate) / 365;
  if (years < 1) return null;
  return (Math.pow(1 + totalRatePct / 100, 1 / years) - 1) * 100;
}

// 매입가·현재가·가정 연수익률로 "대략적인 과거 매수일" 역산 (CAGR 가정).
// 연수 = ln(현재가/평단가) / ln(1+r). 이익일 때만 유효(손실·동가는 오늘 유지가 맞아 null).
// 지수 ETF 등 장기 우상향 자산에 근사가 잘 맞고, 개별주식은 어디까지나 근사치.
const ASSUMED_ANNUAL_RETURN_PCT = 8; // 장기 명목 주식 기대수익 근사
export function estimatePurchaseDateFromReturn(
  averagePrice: number,
  currentPrice: number,
  annualReturnPct: number = ASSUMED_ANNUAL_RETURN_PCT,
  asOf: Date = new Date(),
): string | null {
  if (!(averagePrice > 0) || !(currentPrice > averagePrice)) return null; // 이익일 때만 추정
  const r = annualReturnPct / 100;
  if (r <= 0) return null;
  const years = Math.log(currentPrice / averagePrice) / Math.log(1 + r);
  if (!isFinite(years) || years <= 0) return null;
  const capped = Math.min(years, 30); // 비현실적 과거 방지
  const d = new Date(asOf);
  d.setDate(d.getDate() - Math.round(capped * 365));
  return d.toISOString().split("T")[0];
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



