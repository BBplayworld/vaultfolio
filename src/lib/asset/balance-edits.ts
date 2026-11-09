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

/**
 * 잔액 맞추기 행 순서 = 상세 탭 순서. 현금은 원화 환산액 큰 순, 대출은 잔액 큰 순(완납은 뒤로).
 * mul은 통화 → 원화 배수(getMultiplier). 동률은 원래 순서 유지.
 */
export function orderBalanceRows<T extends BalanceItem & { currency?: string }>(category: BalanceCategory, list: T[], mul: (currency?: string) => number): T[] {
  const key = (x: T) => (category === "cash" ? x.balance * mul(x.currency) : x.balance);
  return list
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      if (category === "loan" && (a.item.balance > 0) !== (b.item.balance > 0)) return a.item.balance > 0 ? -1 : 1;
      return key(b.item) - key(a.item) || a.i - b.i;
    })
    .map((x) => x.item);
}

// ── 입출금 기록과 잔액 맞추기의 이중 반영 경고(#93 후속, cto 권고 (a)②) ──
// 맞추기는 잔액 절대값이라 그 시점까지의 입출금·매수·상환이 이미 녹아 있다. 거래일 이후에 그 카테고리를 맞춘 기록이
// 있는데 '즉시 반영'으로 기록하면 같은 돈이 두 번 빠질 수 있다. 기록은 기기 로컬 assetRefresh(스키마 변경 0)를 쓴다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** ISO 시각 → KST 날짜(YYYY-MM-DD). 잘못된 값은 null */
export function kstDateOfIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + KST_OFFSET_MS).toISOString().split("T")[0];
}

/**
 * 거래일(YYYY-MM-DD) 이후(같은 날 포함)에 그 카테고리를 맞춘 기록이 있고 '즉시 반영'이면 true.
 * 반영하지 않는(과거 소급 기록용) 거래는 잔액을 바꾸지 않으므로 경고하지 않는다.
 */
export function shouldWarnTxAfterResync(opts: { txDate: string; reflected: boolean; refreshedAtIso: string | null | undefined }): boolean {
  if (!opts.reflected || !opts.txDate) return false;
  const refreshed = kstDateOfIso(opts.refreshedAtIso);
  return refreshed !== null && refreshed >= opts.txDate;
}

/** 경고 문구(spec 14-2). 맞춘 날이 오늘(KST)이면 `오늘`, 아니면 `{M월 D일}에` */
export function resyncWarningText(category: BalanceCategory, refreshedAtIso: string, todayKst: string): string {
  const d = kstDateOfIso(refreshedAtIso) ?? "";
  const [, m, day] = d.split("-");
  const when = d === todayKst ? "오늘" : `${Number(m)}월 ${Number(day)}일에`;
  return `${when} 맞춘 ${category === "cash" ? "현금" : "대출"} 잔액에 이미 들어간 금액이면 체크를 꺼 주세요`;
}

/** 거래 입력 '연결 계좌' 행 전용 경고 — 앞부분은 resyncWarningText와 같고 끝맺음만 '연결 안 함으로 바꿔 주세요'(거래 폼엔 이 체크박스가 없음) */
export function linkResyncWarningText(category: BalanceCategory, refreshedAtIso: string, todayKst: string): string {
  return resyncWarningText(category, refreshedAtIso, todayKst).replace("체크를 꺼 주세요", "연결 안 함으로 바꿔 주세요");
}

/** 잔액 맞추기 머리말(spec 14-1) */
export const BALANCE_RESYNC_INTRO: Record<BalanceCategory, string> = {
  cash: "은행·증권 앱 잔액을 그대로 넣으면 돼요. 매수·매도·상환·배당·이자로 바뀐 돈도 함께 맞춰져서, 입출금 기록은 따로 안 남겨도 돼요.",
  loan: "은행 앱 대출 잔액을 그대로 넣으면 돼요. 상환·추가 대출로 바뀐 금액도 함께 맞춰져서, 상환 기록은 따로 안 남겨도 돼요.",
};
