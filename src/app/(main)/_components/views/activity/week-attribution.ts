// 홈 Hero '지난 접속 이후'와 자산 변화 › 주 '최근 7일'이 같이 쓰는 원인 분해 단일 계산(4.79 #153).
// 본문은 dashboard.tsx useHeaderNetChange의 계산부를 그대로 옮긴 것 — 저장소 읽기는 호출부에 남겨 순수하게 유지한다.
// (change-hero.tsx의 matchRecordedTransferDetail을 쓰므로 lib이 아니라 뷰 폴더에 둔다 — lib→뷰 역의존 방지)

import {
  attachCauseDates, buildLiveAttributionCurr, computeAttributionSince, formatAttributionDate, formatAttributionSentence,
  getAttributionItems, getAttributionOffset, getAttributionRecords, sortCausesByDate,
  type AttributionDisplayItem, type AttributionRecord, type AttributionTransfer, type PeriodAttribution,
} from "@/lib/report/asset-report";
import type { AssetData, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { daysBetween, type SettlementCause, type SettlementCauseKey, type SettlementCauses } from "@/lib/report/settlement";
import { matchRecordedTransferDetail } from "./change-hero";

export interface AttributionView {
  attr: PeriodAttribution;
  transfer: AttributionTransfer;
  causes: AttributionDisplayItem[];   // 날짜 부여·정렬까지 끝난 Hero 원인 항목
  records: AttributionRecord[];       // 구간 내 반영 기록 시간순
  offsetTotal: number;                // 내부 이동 상쇄 합(원)
  sentence: string | null;
  rangeLabel: string;                 // "M/D → M/D" (fromDate/toDate 기준 표기)
}

/** sinceDate 이하 가장 최근 기록 → 실시간 끝점의 원인 분해. 비교할 과거 기록이 없으면 null */
export function computeAttributionView({ assetData, rates, summary, daily, monthly, exchangeHistory, sinceDate }: {
  assetData: AssetData;
  rates: { USD: number; JPY: number };
  summary: AssetSummary;
  daily: DailyAssetSnapshot[];
  monthly: MonthlyAssetSnapshot[];
  exchangeHistory: Record<string, { USD: number; JPY: number }>;
  sinceDate: string;
}): AttributionView | null {
  const liveCurr = buildLiveAttributionCurr(assetData, rates, summary);
  const attr = computeAttributionSince(daily, monthly, exchangeHistory, sinceDate, assetData, rates, liveCurr);
  if (!attr) return null;
  const records = getAttributionRecords(attr, assetData, rates);
  // 내부 이동 상쇄(#103): 결산과 같은 짝 함수의 내역을 넘긴다. 기록 짝이 없어도 잔차 짝(매수↔현금 정리 등)은 상쇄된다
  const transfer: AttributionTransfer = matchRecordedTransferDetail(assetData, attr.windowFrom ?? attr.fromDate, attr.windowTo ?? attr.toDate, rates);
  return {
    attr,
    transfer,
    causes: sortCausesByDate(attachCauseDates(getAttributionItems(attr, transfer), records)),
    records,
    offsetTotal: getAttributionOffset(attr, transfer),
    sentence: formatAttributionSentence(attr, transfer),
    rangeLabel: `${formatAttributionDate(attr.fromDate)} → ${formatAttributionDate(attr.toDate)}`,
  };
}

// ── 자산 변화 › 주 '최근 7일'(4.79 #153) — Hero 원인 항목을 결산 어휘 6줄로 합산만 한다(새 계산 없음) ──


const DAY_MS = 86_400_000;
/** 줄 표시 기준(원) — 월 탭 NOISE_WON과 같다 */
export const WEEK_LINE_MIN = 10;
/** 홈 Hero '변동 없음' 기준(CAUSE_DISPLAY_MIN)과 같다 — 이보다 작으면 줄 없이 '뚜렷한 변화 원인이 없어요' */
const WEEK_NEGLIGIBLE = 10000;

/** 홈 Hero와 같은 KST 오늘(YYYY-MM-DD) — 날짜 직접 계산 금지(C69) */
export const weekToday = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

/** today − 7일 */
export function weekSinceDate(today: string): string {
  return new Date(Date.parse(`${today}T00:00:00Z`) - 7 * DAY_MS).toISOString().slice(0, 10);
}

/** Hero 항목 키 → 주 탭 줄. 모르는 키는 기록 안 된 변화로 보내 합계 항등식을 지킨다 */
export function weekLineOf(key: AttributionDisplayItem["key"]): SettlementCauseKey {
  if (key === "price:stock" || key === "price:crypto") return "price";
  if (key === "price:realEstate" || key === "price:physical") return "valuation";
  if (key === "fx") return "fx";
  if (key === "income" || key.startsWith("buy:") || key.startsWith("sell:")) return "income";
  if (key === "debt") return "loan";
  return "unrecorded"; // cash·deposit·unrecorded·price(레거시 통합 시세, O-3)
}

const WEEK_LINE_ORDER: SettlementCauseKey[] = ["price", "valuation", "fx", "income", "loan", "unrecorded"];

/**
 * 6줄 합산. 각 줄 = 그룹 Hero 항목 원값 합(원 반올림), 기록 안 된 변화 = round(deltaNet) − 나머지 줄 합(1만 원 미만 잔차 흡수).
 * |round(deltaNet)| < 1만이면 줄 없이 빈 목록(CauseBlock이 '뚜렷한 변화 원인이 없어요'). 예측 = 그룹 항목 중 estimated 하나라도.
 */
export function mapWeekCauses(view: Pick<AttributionView, "attr" | "causes">): SettlementCauses {
  const deltaNet = Math.round(view.attr.deltaNet);
  const sum: Record<SettlementCauseKey, number> = { price: 0, valuation: 0, fx: 0, income: 0, loan: 0, unrecorded: 0 };
  const est: Record<SettlementCauseKey, boolean> = { price: false, valuation: false, fx: false, income: false, loan: false, unrecorded: false };
  for (const c of view.causes) {
    const line = weekLineOf(c.key);
    sum[line] += c.amount;
    est[line] ||= !!c.estimated;
  }
  const rounded = { price: Math.round(sum.price), valuation: Math.round(sum.valuation), fx: Math.round(sum.fx), income: Math.round(sum.income), loan: Math.round(sum.loan) };
  const unrecorded = deltaNet - rounded.price - rounded.valuation - rounded.fx - rounded.income - rounded.loan;
  if (Math.abs(deltaNet) < WEEK_NEGLIGIBLE) return { causes: [], deltaNet, showUnrecordedHint: false };
  const amounts: Record<SettlementCauseKey, number> = { ...rounded, unrecorded };
  const causes: SettlementCause[] = WEEK_LINE_ORDER
    .map((key) => ({ key, amount: amounts[key], estimated: est[key] }))
    .filter((c) => Math.abs(c.amount) >= WEEK_LINE_MIN);
  return { causes, deltaNet, showUnrecordedHint: false };
}

export type WeekHero =
  | { kind: "recent"; title: string; range: string }     // 7 ≤ D ≤ 9
  | { kind: "since"; title: string }                      // D < 7 또는 10 ≤ D ≤ 14
  | { kind: "insufficient"; title: string }               // D > 14(월 스냅샷 폴백 등)
  | { kind: "empty"; title: string };                     // 기록 없음

/** 비교 시작일(YYYY-MM-DD) — 시작일이 월 표기(YYYY-MM)면 실제 기록일(windowFrom). 마감 기록 목록의 시작 행 기준 */
export function weekStartDate(view: Pick<AttributionView, "attr">): string {
  const { attr } = view;
  return attr.fromDate.length >= 10 ? attr.fromDate : (attr.windowFrom ?? attr.fromDate);
}

/** 표기 판정(spec 5-2). D = today − 비교 시작일. 시작일이 월 표기(YYYY-MM)면 실제 기록일(windowFrom)을 쓴다 */
export function resolveWeekHero(view: AttributionView | null, today: string): WeekHero {
  if (!view) return { kind: "empty", title: "최근 7일" };
  const { attr } = view;
  const start = weekStartDate(view);
  const d = daysBetween(start, today);
  if (!Number.isFinite(d) || d > 14) return { kind: "insufficient", title: "최근 7일" };
  const md = formatAttributionDate(start);
  if (d >= 7 && d <= 9) return { kind: "recent", title: "최근 7일", range: `${md} → 오늘` };
  return { kind: "since", title: `${md} 이후` };
}
