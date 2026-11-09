// 월별 기록(#127, 4.67) — 저장된 월 스냅샷(13개월 보존분) + 이번 달 실시간 값을 달마다 한 줄로 조립하는 순수 함수.
// 새 금액 계산·환산·보간 없음: 지난 달은 스냅샷 breakdown·netAsset, 이번 달은 결산과 같은 live breakdown·summary.netAsset.
// 읽기 전용 — 저장·서버 전송 없음. 증감·%·비중은 만들지 않는다(정본은 결산 Hero·구성 블록).

import type { MonthlyAssetSnapshot, SnapshotBreakdown } from "@/types/asset";
import { formatCurrency, formatShortCurrency } from "@/lib/number-utils";
import { COMPOSITION_KEYS, COMPOSITION_LABELS, type CompositionKey } from "./composition";
import { formatSettlementPoint, listSettlementMonths, SETTLEMENT_KEEP_MONTHS } from "./settlement";

export type MonthlyLogKey = CompositionKey | "loans" | "tenantDeposit";
/** 열 순서: 자산 5종(구성 블록과 같은 순서) → 부채 2종 */
export const MONTHLY_LOG_KEYS: MonthlyLogKey[] = [...COMPOSITION_KEYS, "loans", "tenantDeposit"];
export const MONTHLY_LOG_LABELS: Record<MonthlyLogKey, string> = { ...COMPOSITION_LABELS, loans: "대출", tenantDeposit: "임차보증금" };
/** 부채 열 — 항상 −(U+2212) + 절댓값으로 표시 */
export const MONTHLY_LOG_DEBT_KEYS: ReadonlySet<MonthlyLogKey> = new Set<MonthlyLogKey>(["loans", "tenantDeposit"]);

type LogBreakdown = Pick<SnapshotBreakdown, "realEstate" | "stocks" | "crypto" | "cash" | "loans"> & { tenantDeposit?: number; physical?: number };

export type MonthlyLogRow =
  /** 자산군 합 = 순자산(±1원)인 줄 */
  | { kind: "full"; month: string; current: boolean; recordLabel: string; values: Record<MonthlyLogKey, number>; netAsset: number }
  /** breakdown 없음(레거시) 또는 합 불일치(구버전 기기·tenantDeposit 필드 이전) — 순자산만 */
  | { kind: "net-only"; month: string; current: boolean; recordLabel: string; netAsset: number }
  /** 첫 기록 달 ~ 이번 달 사이 기록 없는 달 */
  | { kind: "gap"; month: string };

export interface MonthlyLog {
  /** 최신순(이번 달이 맨 위) */
  rows: MonthlyLogRow[];
  /** full 줄 중 한 번이라도 0이 아닌 자산군만(표시 순서) */
  columns: MonthlyLogKey[];
  /** 기록된 달 수 = |저장된 달 ∪ {이번 달}|(13개월 창 안) — 2 미만이면 진입 행 숨김 */
  recordedCount: number;
  firstMonth: string;
  currentMonth: string;
  /** '—인 달은 순자산만…' 캡션 조건 */
  hasNetOnly: boolean;
  /** 13개월 보존 한도까지 찼는지('최근 13개월까지 보여요' 캡션 조건) */
  atLimit: boolean;
}

/** 합 검증 허용 오차(원) — 저장 시점 부동소수 차만 허용 */
const SUM_TOLERANCE = 1;

/** 자산군 값 — 합 검증(S3)을 통과하면 값 묶음, 아니면 null(순자산만 표시) */
function verifiedValues(b: LogBreakdown | undefined, netAsset: number): Record<MonthlyLogKey, number> | null {
  if (!b || !Number.isFinite(netAsset)) return null;
  const values: Record<MonthlyLogKey, number> = {
    realEstate: b.realEstate, physical: b.physical ?? 0, stocks: b.stocks, crypto: b.crypto, cash: b.cash,
    loans: b.loans, tenantDeposit: b.tenantDeposit ?? 0,
  };
  if (MONTHLY_LOG_KEYS.some((k) => typeof values[k] !== "number" || !Number.isFinite(values[k]))) return null;
  const sum = values.realEstate + values.physical + values.stocks + values.crypto + values.cash - values.loans - values.tenantDeposit;
  return Math.abs(sum - netAsset) > SUM_TOLERANCE ? null : values;
}

/**
 * 월별 기록 줄 조립. 월 범위는 결산 월 화살표와 같은 `listSettlementMonths`(현재월 포함 13개월, 저장된 달·이번 달만 기록).
 * 지난 달 줄의 순자산 = 그 달 스냅샷 netAsset(= 결산 Hero 끝값 `settlementDelta`의 w.end.netAsset),
 * 이번 달 줄 = live(결산과 같은 `buildLiveAttributionCurr` breakdown·summary.netAsset).
 */
export function buildMonthlyLog(
  monthly: MonthlyAssetSnapshot[],
  today: string,
  live: { breakdown?: LogBreakdown | null; netAsset: number },
): MonthlyLog {
  const currentMonth = today.slice(0, 7);
  const months = listSettlementMonths(monthly, today);
  const firstIdx = months.findIndex((m) => m.enabled);
  const span = months.slice(firstIdx);
  const asc: MonthlyLogRow[] = span.map(({ month, enabled }) => {
    if (!enabled) return { kind: "gap", month };
    const current = month === currentMonth;
    // 같은 달이 여러 개면 결산(resolveSettlementWindow)과 같이 첫 항목
    const snap = current ? null : monthly.find((s) => s.month === month) ?? null;
    const netAsset = current ? live.netAsset : snap!.netAsset;
    const recordLabel = current ? "오늘" : snap!.date ? formatSettlementPoint(snap!.date) : formatSettlementPoint(null, month);
    const values = verifiedValues(current ? live.breakdown ?? undefined : snap!.breakdown, netAsset);
    return values
      ? { kind: "full", month, current, recordLabel, values, netAsset }
      : { kind: "net-only", month, current, recordLabel, netAsset };
  });
  const full = asc.filter((r): r is Extract<MonthlyLogRow, { kind: "full" }> => r.kind === "full");
  return {
    rows: asc.reverse(),
    columns: MONTHLY_LOG_KEYS.filter((k) => full.some((r) => Math.round(r.values[k]) !== 0)),
    recordedCount: span.filter((m) => m.enabled).length,
    firstMonth: span[0].month,
    currentMonth,
    hasNetOnly: asc.some((r) => r.kind === "net-only"),
    atLimit: span.length >= SETTLEMENT_KEEP_MONTHS,
  };
}

/** 진입 행 기간 라벨 — "8월~11월", 해가 다르면 "25년 12월~26년 3월" */
export function monthlyLogRangeLabel(first: string, last: string): string {
  const sameYear = first.slice(0, 4) === last.slice(0, 4);
  const name = (m: string) => `${sameYear ? "" : `${m.slice(2, 4)}년 `}${Number(m.slice(5, 7))}월`;
  return `${name(first)}~${name(last)}`;
}

const MINUS = "−"; // U+2212

/**
 * 표 금액 표기. short(<sm) = formatShortCurrency에서 1만원 이상은 끝 '원' 생략(`1,234만`·`12.3억`), full(sm↑) = 원 단위.
 * 부채 열은 −+절댓값, 0은 부호 없이 `0원`. 음수 부호는 전부 U+2212.
 */
export function formatMonthlyLogAmount(value: number, mode: "short" | "full", debt = false): string {
  if (Math.abs(value) < 0.5) return "0원";
  const v = debt ? -Math.abs(value) : value;
  const text = mode === "full" ? formatCurrency(v) : formatShortCurrency(v).replace(/([만억])원$/, "$1");
  return text.replace(/^-/, MINUS);
}
