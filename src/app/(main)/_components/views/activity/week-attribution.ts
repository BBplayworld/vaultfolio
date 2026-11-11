// 홈 Hero '지난 접속 이후'와 자산 변화 › 주 '최근 7일'이 같이 쓰는 원인 분해 단일 계산(4.79 #153).
// 본문은 dashboard.tsx useHeaderNetChange의 계산부를 그대로 옮긴 것 — 저장소 읽기는 호출부에 남겨 순수하게 유지한다.
// (change-hero.tsx의 matchRecordedTransferDetail을 쓰므로 lib이 아니라 뷰 폴더에 둔다 — lib→뷰 역의존 방지)

import {
  attachCauseDates, buildLiveAttributionCurr, computeAttributionSince, formatAttributionDate, formatAttributionSentence,
  getAttributionItems, getAttributionOffset, getAttributionRecords, sortCausesByDate,
  type AttributionDisplayItem, type AttributionRecord, type AttributionTransfer, type PeriodAttribution,
} from "@/lib/report/asset-report";
import type { AssetData, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
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
