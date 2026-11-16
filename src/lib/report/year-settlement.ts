// 올해 결산(5.124 #237) 순수 함수 — 연 탭 첫 블록의 대상 연도·예측 구간 분리·3묶음 매핑·결론 문장·기간 표현.
// 엔진(asset-report.ts)·mapSettlementCauses·resolveYearChain 본문은 건드리지 않고 결과만 읽는다.
// 전부 기기 안 읽기 계산 — 저장·서버 전송 없음. 투자 조언 아님(사용자 자신의 기록 사이 변화만 나눈다).

import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot, YearlyNetAsset } from "@/types/asset";
import {
  CARD_UNTIL_DAY, FIRST_RECORD_MIN_DAYS, daysBetween, isEnriched, pickFirstRecordStart, snapshotDate,
  type SettlementCause, type SettlementCauses,
} from "./settlement";

// ── 대상 연도 ───────────────────────────────────────────────────

export interface YearTarget {
  year: number;                  // 결산 대상 해
  closed: boolean;               // true = 1/1~1/10에 직전 해 결산을 유지하는 상태
  start: YearlyNetAsset | null;  // 비교 시작(대상 해보다 앞선 가장 최근 년도별 항목). null = 첫 해
  end: YearlyNetAsset;           // 대상 해의 년도별 항목(끝값의 단일 출처)
}

/**
 * 연 탭 결산 대상. 1/1~1/10(`CARD_UNTIL_DAY`)이고 년도별에 직전 해 항목이 있으면 직전 해를 닫힌 결산으로 유지한다.
 * 그 밖에는 올해 항목이 있을 때만 올해가 대상이다(없으면 null — 현행 '올해 순자산이 기록되면…' 문구, 블록 없음).
 */
export function resolveYearTarget(yearly: readonly YearlyNetAsset[], today: string): YearTarget | null {
  const sorted = [...yearly].sort((a, b) => a.year - b.year);
  const thisYear = Number(today.slice(0, 4));
  const pick = (year: number, closed: boolean): YearTarget | null => {
    const end = sorted.find((y) => y.year === year);
    if (!end) return null;
    const start = [...sorted].reverse().find((y) => y.year < year) ?? null;
    return { year, closed, start, end };
  };
  if (today.slice(5, 7) === "01" && Number(today.slice(8, 10)) <= CARD_UNTIL_DAY) {
    const prev = pick(thisYear - 1, true);
    if (prev) return prev;
  }
  return pick(thisYear, false);
}

/** 닫힌 결산의 끝점 — 그 해의 마지막 enrich 월 기록(보통 12월). 없으면 null(전부 예측) */
export function pickYearEndSnapshot(monthly: readonly MonthlyAssetSnapshot[], year: number): MonthlyAssetSnapshot | null {
  return [...monthly]
    .filter((s) => typeof s?.month === "string" && s.month.startsWith(`${year}-`) && isEnriched(s))
    .sort((a, b) => a.month.localeCompare(b.month))
    .at(-1) ?? null;
}

// ── 첫 해 시작점 ─────────────────────────────────────────────────

/**
 * 직전 해 값이 없는 첫 해의 시작점과 체인. 시작점 = 대상 해의 enrich이고 기록일(date)이 있는 가장 이른 월 기록(끝 달 제외)
 * → 없으면 4.94 `pickFirstRecordStart`(일별, daily를 넘겼을 때만) → 시작점에서 끝까지 7일 미만이면 null.
 * 체인 = [시작점, 그 뒤 같은 해 enrich 월(끝 달 제외)…]. 끝(실시간 또는 끝 기록)은 호출부가 붙인다.
 */
export function resolveFirstYearChain(
  monthly: readonly MonthlyAssetSnapshot[],
  daily: DailyAssetSnapshot[] | null,
  assetData: AssetData,
  year: number,
  endDate: string,
): MonthlyAssetSnapshot[] | null {
  const endMonth = endDate.slice(0, 7);
  const months = [...monthly]
    .filter((s) => typeof s?.month === "string" && s.month.startsWith(`${year}-`) && s.month < endMonth && isEnriched(s) && !!s.date)
    .sort((a, b) => a.month.localeCompare(b.month));
  const first = daily ? pickFirstRecordStart(daily, assetData, endDate) : null;
  const start = months[0] ?? (first?.date?.startsWith(`${year}-`) ? first : null);
  if (!start?.date || daysBetween(start.date, endDate) < FIRST_RECORD_MIN_DAYS) return null;
  return [start, ...months.filter((s) => snapshotDate(s) > start.date!)];
}

// ── 예측 구간 분리 ───────────────────────────────────────────────

export interface YearPeriodRow {
  amount: number;  // 월 기록 전 기간의 금액 = 첫 enrich 월 기록 − Hero 시작값(원 반올림)
  month: number;   // N — 첫 enrich 월 기록의 달
  from: string;    // 기간 시작일(앵커 기준일, 입출금 유무 판정용)
  until: string;   // 그 기록의 실제 기록일 YYYY-MM-DD
}

export type YearSplit<T> =
  | { kind: "measured"; total: number; period: null; measured: T }
  | { kind: "mixed"; total: number; period: YearPeriodRow; measured: T }
  | { kind: "estimated-only"; total: number; period: null; measured: null };

/**
 * 체인에서 예측일 수 있는 구간은 첫 구간(앵커 → 첫 enrich 월)뿐이다. 앵커가 enrich가 아니면 그 구간을 기간 행으로 떼고
 * 나머지 체인을 기존 원인 함수(run)로 다시 돈다. 합 = Hero 증감은 뺄셈으로 보장된다.
 * 기간 행은 앵커 netAsset이 아니라 Hero 시작값으로 계산한다(전년 12월 레거시 기록과 년도별 값이 달라도 항등식 유지).
 */
export function splitYearChain<T>(
  points: MonthlyAssetSnapshot[],
  heroStart: number,
  heroDelta: number,
  run: (points: MonthlyAssetSnapshot[], deltaNet: number) => T,
): YearSplit<T> {
  const total = Math.round(heroDelta);
  if (isEnriched(points[0])) return { kind: "measured", total, period: null, measured: run(points, total) };
  if (points.length < 2) return { kind: "estimated-only", total, period: null, measured: null };
  const first = points[1];
  const amount = Math.round(first.netAsset) - Math.round(heroStart);
  return {
    kind: "mixed", total,
    period: { amount, month: Number(first.month.slice(5, 7)), from: snapshotDate(points[0]), until: snapshotDate(first) },
    measured: run(points.slice(1), total - amount),
  };
}

/** 월 기록 전 기간 (from, until]에 반영된 입출금 기록이 있는지 — 도움말 1줄 조건(금액은 내지 않는다) */
export function hasReflectedCashIn(assetData: AssetData, from: string, until: string): boolean {
  return (assetData.cashTransactions ?? []).some((t) => t.reflected && t.date > from && t.date <= until);
}

/** 넣은 돈 도움말 갈래 — `computeChainCauses`의 cashTracked와 같은 판정(시작·끝 현금 또는 구간 안 입출금 기록) */
export function isYearCashTracked(assetData: AssetData, start: MonthlyAssetSnapshot | undefined, endCash: number, endDate: string): boolean {
  const from = start?.date ?? null;
  const hasCash = !!from && (assetData.cashTransactions ?? []).some((t) => t.date > from && t.date <= endDate);
  return (start?.breakdown?.cash ?? 0) > 0 || endCash > 0 || hasCash;
}

// ── 3묶음 매핑 ───────────────────────────────────────────────────

const NOISE = 10; // settlement.ts NOISE_WON과 같은 값 — 10원 미만은 숨긴다
const GROWTH_KEYS = ["price", "valuation", "fx"] as const;

export interface YearGroups {
  income: number | null;                                             // 넣은 돈(순유입)
  growth: { amount: number; rows: SettlementCause[] } | null;        // 불어난 돈(시세 변동 + 평가 갱신 + 환율 효과)
  loan: number | null;                                               // 빠져나간 돈(대출)
  unrecorded: SettlementCause | null;                                // 기록 안 된 변화(묶음 밖 1행)
}

/** 기존 매핑 결과(이미 10원 미만 제외)를 3묶음으로 읽는다. 묶음 금액 = 하위 행 합, |합| < 10원이면 묶음을 숨긴다 */
export function groupYearSettlement(mapped: SettlementCauses): YearGroups {
  const find = (key: SettlementCause["key"]) => mapped.causes.find((c) => c.key === key) ?? null;
  const rows = GROWTH_KEYS.map(find).filter((c): c is SettlementCause => c !== null);
  const growthSum = rows.reduce((s, c) => s + c.amount, 0);
  return {
    income: find("income")?.amount ?? null,
    growth: rows.length > 0 && Math.abs(growthSum) >= NOISE ? { amount: growthSum, rows } : null,
    loan: find("loan")?.amount ?? null,
    unrecorded: find("unrecorded"),
  };
}

/** 값과 함께 그릴 행이 하나라도 있는지(묶음·기록 안 된 변화·기간 행) — 블록 렌더·GA 전송 조건 */
export function hasYearRows(groups: YearGroups | null, period: YearPeriodRow | null): boolean {
  return !!period || !!groups && (groups.income !== null || groups.growth !== null || groups.loan !== null || groups.unrecorded !== null);
}

// ── 결론 문장·기간 표현 ──────────────────────────────────────────

/**
 * 결론 비율 — 넣은 돈·불어난 돈이 둘 다 양수이고, 기록 안 된 변화가 둘의 합보다 작고, 반올림 비율이 1~99일 때만.
 * 그 밖(부호 섞임·한쪽만·0/100%·기록 안 된 변화가 큼)은 null — 금액 문장은 만들지 않는다(묶음 행과 같은 숫자 반복 금지).
 */
export function buildYearConclusion(groups: YearGroups | null): { n: number; m: number } | null {
  const income = groups?.income ?? 0;
  const growth = groups?.growth?.amount ?? 0;
  if (!(income >= NOISE && growth >= NOISE)) return null;
  if (Math.abs(groups?.unrecorded?.amount ?? 0) >= income + growth) return null;
  const n = Math.round((income / (income + growth)) * 100);
  return n >= 1 && n <= 99 ? { n, m: 100 - n } : null;
}

export const mdOf = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

export interface YearPeriodContext {
  year: number;
  closed: boolean;
  period: YearPeriodRow | null;   // 예측 섞임이면 그 기간 행
  firstStart: string | null;      // 첫 해 시작일
}

/** 문장에 넣는 기간 표현 — `올해`·`11월부터`·`11/3부터`·`2026년에`·`2026년 11월부터` */
export function yearPeriodPhrase({ year, closed, period, firstStart }: YearPeriodContext): string {
  if (firstStart) return `${mdOf(firstStart)}부터`;
  if (period) return `${closed ? `${year}년 ` : ""}${period.month + 1}월부터`;
  return closed ? `${year}년에` : "올해";
}

/** 블록 제목 — `올해 결산` / 첫 해 `11/3 이후 결산` / 1월 초 `2026년 결산` */
export function yearSettlementTitle({ year, closed, firstStart }: Pick<YearPeriodContext, "year" | "closed" | "firstStart">): string {
  if (firstStart) return `${mdOf(firstStart)} 이후 결산`;
  return closed ? `${year}년 결산` : "올해 결산";
}

/** 기간 행 라벨 — `1~10월`(N=1이면 `1월`), 년도별 값이 한 해 이상 건너뛰면 `10월 기록 전` */
export function yearPeriodLabel(period: YearPeriodRow, skipped: boolean): string {
  if (skipped) return `${period.month}월 기록 전`;
  return period.month === 1 ? "1월" : `1~${period.month}월`;
}

// 문구 단일 출처 — 금지어 테스트(AC-6) 대상
export const YEAR_SETTLE_COPY = {
  help: "받은 배당은 계좌 잔액에 들어 있어 넣은 돈 또는 기록 안 된 변화에 포함돼요",
  income: "넣은 돈",
  growth: "불어난 돈",
  loan: "빠져나간 돈",
  loanHint: "추정한 대출 이자와, 늘어난 대출 중 자산에 남지 않은 몫이에요",
  periodSub: "월 기록 전 기간",
  periodHint: "달마다 남긴 기록이 없어 넣은 돈과 불어난 돈을 나누지 못해요",
  periodCashNote: "이 기간에 적은 입출금도 이 금액에 들어 있어요",
  cashLink: "입출금을 기록할 현금 계좌 고르기",
  empty: "월 기록이 쌓이면 원인을 나눠 보여드려요",
  error: "변화 원인을 불러오지 못했어요",
} as const;

const GROWTH_SINGLE_HINT: Record<(typeof GROWTH_KEYS)[number], string> = {
  price: "시세 변동으로 달라진 금액이에요",
  valuation: "평가 갱신으로 달라진 금액이에요",
  fx: "환율 효과로 달라진 금액이에요",
};

export const yearConclusionText = (phrase: string, c: { n: number; m: number }) =>
  ({ head: `${phrase} 순자산을 늘린 금액은`, income: `${YEAR_SETTLE_COPY.income} ${c.n}%,`, growth: `${YEAR_SETTLE_COPY.growth} ${c.m}%예요` });
export const yearPeriodNoteText = (period: YearPeriodRow) => `${period.month + 1}월부터 나눈 금액이에요`;
export const yearIncomeHint = (phrase: string, cashTracked: boolean) =>
  cashTracked ? `${phrase} 입금에서 출금을 뺀 금액이에요` : `입출금 기록이 없어 ${phrase} 사고판 금액의 차이로 계산했어요`;
export const yearGrowthSingleHint = (row: SettlementCause) => GROWTH_SINGLE_HINT[row.key as (typeof GROWTH_KEYS)[number]];
export const yearPeriodDateText = (period: YearPeriodRow) => `${mdOf(period.until)} 기록까지`;
/** 1월 초 머리 줄 기준 — `2025년 말 → 2026년 말`, 첫 해는 `11/3 → 2026년 말` */
export const yearHeadText = (target: YearTarget, firstStart: string | null) =>
  `${firstStart ? mdOf(firstStart) : `${target.start?.year}년 말`} → ${target.year}년 말`;
