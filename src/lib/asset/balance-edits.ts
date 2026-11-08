// 현금·대출 잔액 맞추기(#93) 순수 로직 — 입력 문자열 정리, 행 검사, 저장용 목록 교체.
// 저장 핸들러는 getAssetData() 최신 목록에 applyBalanceEdits를 적용해 saveData를 1회만 호출한다(C37).

export type BalanceCategory = "cash" | "loan";
export type BalanceCurrency = "KRW" | "USD" | "JPY";

export interface BalanceItem {
  id: string;
  balance: number;
}

/** 외화(USD)는 소수 2자리, 그 외는 정수 */
export function maxDecimalsOf(currency: BalanceCurrency): number {
  return currency === "USD" ? 2 : 0;
}

/** 입력 문자열 정리: 숫자(와 허용 시 소수점 1개)만 남기고 소수 자릿수 제한. 쉼표·음수·문자는 제거 */
export function sanitizeBalanceText(text: string, maxDecimals: number): string {
  let cleaned = text.replace(/[^\d.]/g, "");
  if (maxDecimals <= 0) return cleaned.replace(/\./g, "").replace(/^0+(?=\d)/, "");
  const dot = cleaned.indexOf(".");
  if (dot >= 0) {
    const int = cleaned.slice(0, dot);
    const frac = cleaned.slice(dot + 1).replace(/\./g, "").slice(0, maxDecimals);
    cleaned = `${int || "0"}.${frac}`;
    return cleaned.replace(/^0+(?=\d)/, "");
  }
  return cleaned.replace(/^0+(?=\d)/, "");
}

/** 정리된 문자열 → 숫자. 빈 칸·소수점만 있는 경우는 null(변경 아님) */
export function parseBalanceText(text: string): number | null {
  if (text === "" || text === ".") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

/** 표시용: 정수부에만 쉼표(소수점 이하·입력 중 끝 점은 유지) */
export function formatBalanceText(text: string): string {
  if (!text) return "";
  const [int, frac] = text.split(".");
  const head = Number(int || "0").toLocaleString("ko-KR");
  return frac === undefined ? head : `${head}.${frac}`;
}

/** 부동소수 비교 오차 방지: 소수 2자리로 맞춰 비교 */
const norm = (n: number) => Math.round(n * 100) / 100;

export type BalanceRowIssue = "cash-zero" | "magnitude" | null;

export interface BalanceRowCheck {
  /** 실제로 바뀌는 행인가(빈 칸·현재 값과 같은 값은 false) */
  changed: boolean;
  /** cash-zero=저장 차단(현금 0), magnitude=경고만(저장 허용) */
  issue: BalanceRowIssue;
}

/** 행 검사(spec 5절). 같은 통화 단위로 비교하므로 current·next는 원통화 값이다 */
export function checkBalanceRow(category: BalanceCategory, current: number, next: number | null): BalanceRowCheck {
  if (next === null) return { changed: false, issue: null };
  if (norm(next) === norm(current)) return { changed: false, issue: null };
  if (next === 0) return { changed: true, issue: category === "cash" ? "cash-zero" : null };
  if (current > 0 && (next / current >= 10 || next / current <= 0.1)) return { changed: true, issue: "magnitude" };
  return { changed: true, issue: null };
}

/**
 * 저장용 목록 교체. balance 외 필드는 그대로 보존하고, 목록에 없는 id는 건너뛴다(되살림 0).
 * applied = 실제로 값이 바뀐 건수. 0이면 호출부가 저장하지 않는다.
 */
export function applyBalanceEdits<T extends BalanceItem>(list: T[], edits: Record<string, number>): { list: T[]; applied: number } {
  let applied = 0;
  const next = list.map((item) => {
    const edit = edits[item.id];
    if (edit === undefined || !Number.isFinite(edit) || norm(edit) === norm(item.balance)) return item;
    applied += 1;
    return { ...item, balance: edit };
  });
  return { list: applied > 0 ? next : list, applied };
}
