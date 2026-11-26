// 5.161 맞추기 결과 대조 — 화면에 표시된 합계(screenTotal)를 행과 분리해 읽는다.
// 순수 함수. 서버는 이 값을 저장·캐시·로그하지 않고 응답에 실어 돌려줄 뿐이다(기기 메모리에서만 쓴다).

export interface ScreenTotal {
  value: number;
  /** 화면에 적힌 합계 라벨 글자(예: "총 평가금액") — 예수금 포함 여부를 기기에서 판단하는 데 쓴다 */
  label: string;
  currency: "KRW" | "USD" | "JPY";
}

const CURRENCIES = ["KRW", "USD", "JPY"] as const;
const MAX_LABEL = 30;

/** 모델이 준 합계 필드를 검증한다. 숫자 아님·0 이하·라벨 없음·통화 불명이면 null(= 총액 없음) */
export function sanitizeScreenTotal(value: unknown, label: unknown, currency: unknown): ScreenTotal | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  if (typeof label !== "string") return null;
  const trimmed = label.trim().slice(0, MAX_LABEL);
  if (!trimmed) return null;
  if (!(CURRENCIES as readonly string[]).includes(currency as string)) return null;
  return { value, label: trimmed, currency: currency as ScreenTotal["currency"] };
}

/**
 * 주식 응답 해석 — 기존 최상위 배열과 `{ rows, screenTotal, screenTotalLabel, screenTotalCurrency }` 둘 다 받는다(하위호환).
 * 배열이거나 rows가 배열이 아니면 null(호출측이 422).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseStockPayload(parsed: unknown): { rows: any[]; screenTotal: ScreenTotal | null } | null {
  if (Array.isArray(parsed)) return { rows: parsed, screenTotal: null };
  if (parsed && typeof parsed === "object") {
    const o = parsed as Record<string, unknown>;
    if (!Array.isArray(o.rows)) return null;
    return { rows: o.rows, screenTotal: sanitizeScreenTotal(o.screenTotal, o.screenTotalLabel, o.screenTotalCurrency) };
  }
  return null;
}
