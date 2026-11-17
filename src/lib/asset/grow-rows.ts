/**
 * asset/grow-rows.ts
 * 내 자산 불리기(#239) 화면·허브 카드의 표시 값(순수 함수).
 *  - 종목 행: 상세 › 주식 전체 탭과 같은 그룹(groupStocksByTicker)·같은 계산(computeStockMetrics)·같은 문자열
 *  - 기간 표기: 지난 달력 월 수(KST 날짜 기준)
 *  - 앱이 종목을 나누거나 고르지 않는다 — 여기서 만드는 값은 사용자가 붙인 이름표와 기록에서 나온 사실뿐이다
 */

import type { Stock } from "@/types/asset";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { computeStockMetrics, getMultiplier, groupStocksByTicker, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { profitTone } from "@/app/(main)/_components/views/detail/detail-summary-header";
import { isStockLabelKey, stockLabelTime, type StockLabelItem, type StockLabels } from "@/lib/asset/stock-labels";

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** ms → KST 날짜 { y, m(1~12), d, serial(일 번호) } */
function kstDate(ms: number): { y: number; m: number; d: number; serial: number } {
  const t = new Date(ms + KST_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), serial: Math.floor((ms + KST_OFFSET_MS) / DAY_MS) };
}

export interface Elapsed { days: number; months: number }

/** from → now 사이 지난 날 수와 지난 달력 월 수(음수는 0으로). from을 읽지 못하면 null */
export function elapsedSince(from: string | undefined, nowMs: number): Elapsed | null {
  const ms = stockLabelTime(from);
  if (ms === null) return null;
  const a = kstDate(ms);
  const b = kstDate(nowMs);
  const days = Math.max(0, b.serial - a.serial);
  const months = Math.max(0, (b.y - a.y) * 12 + (b.m - a.m) - (b.d < a.d ? 1 : 0));
  return { days, months };
}

const yearMonth = (months: number) => {
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}년` : `${y}년 ${m}개월`;
};

/** `오늘` / `N일 전` / `N개월 전` / `N년 N개월 전`(나머지 0이면 `N년 전`) */
export function formatAgo(e: Elapsed): string {
  if (e.days === 0) return "오늘";
  if (e.months < 1) return `${e.days}일 전`;
  if (e.months < 12) return `${e.months}개월 전`;
  return `${yearMonth(e.months)} 전`;
}

/** `…한 지` 뒤에 붙는 꼴 — `N일` / `N개월` / `N년 N개월`. 같은 날은 호출측이 줄 전체를 다른 문장으로 쓴다 */
export function formatSince(e: Elapsed): string {
  if (e.months < 1) return `${e.days}일`;
  if (e.months < 12) return `${e.months}개월`;
  return yearMonth(e.months);
}

export type GrowLabelState = "keep" | "check" | "none" | "unset";

export interface GrowRow {
  /** 전체 탭 그룹 키(`t:원문 티커`) — 행 key */
  key: string;
  /** 이름표 저장 키(normalizeTicker) — 원문이 달라 행이 나뉜 같은 종목은 이 값이 같아 이름표를 함께 쓴다 */
  ticker: string;
  name: string;
  /** 종목 페이지 진입용 */
  groupStockIds: string[];
  rawTicker: string;
  category: string;
  /** 원화 평가액 — 비중 순 정렬용(화면에 그리지 않는다) */
  value: number;
  /** `34.0%` — 전체 탭 행과 같은 문자열. 시세 미조회면 `—` */
  weightText: string;
  /** `+52.0%`·`-18.0%` — 전체 탭 행과 같은 문자열. 시세 미조회면 `—` */
  rateText: string;
  labelState: GrowLabelState;
  /** 이름표 사실 줄. 이름표가 없으면 null */
  labelFact: string | null;
  /** 주기 경과 문구. 지나지 않았으면 null */
  overdueFact: string | null;
  /** 오늘 이미 점검을 눌렀는지 */
  checkedToday: boolean;
}

/** 주기 판정 기준일 — 점검일과 이름표를 붙인 날 중 늦은 쪽(이름표를 다시 붙인 날 바로 '지났어요'가 뜨지 않게) */
function cycleBase(item: StockLabelItem): string {
  const c = stockLabelTime(item.checkedAt);
  const l = stockLabelTime(item.labeledAt);
  return c !== null && (l === null || c >= l) ? item.checkedAt! : item.labeledAt;
}

function labelFactOf(item: StockLabelItem, nowMs: number): { fact: string | null; checkedToday: boolean } {
  if (item.label === "keep") {
    const e = elapsedSince(item.labeledAt, nowMs);
    if (!e) return { fact: null, checkedToday: false };
    return { fact: e.days === 0 ? "오늘 오래 두기로 했어요" : `오래 두기로 한 지 ${formatSince(e)}`, checkedToday: false };
  }
  if (item.label === "check") {
    const checked = elapsedSince(item.checkedAt, nowMs);
    if (checked) return { fact: `마지막 점검 ${formatAgo(checked)}`, checkedToday: checked.days === 0 };
    const e = elapsedSince(item.labeledAt, nowMs);
    if (!e) return { fact: null, checkedToday: false };
    return { fact: e.days === 0 ? "오늘 점검할 자산으로 정했어요" : `점검하기로 한 지 ${formatSince(e)}`, checkedToday: false };
  }
  return { fact: null, checkedToday: false };
}

/**
 * 종목 행 목록 — 비중 큰 순. 티커 없는 수동 종목은 행을 만들지 않는다(비중 분모에는 포함 — 전체 탭과 같은 값).
 * 정렬(주기 지난 행 위로)과 접힘은 화면이 진입·주기 변경 시점에만 정한다(sortGrowRowKeys).
 */
export function buildGrowRows(
  stocks: Stock[],
  exchangeRates: { USD: number; JPY: number },
  labels: StockLabels,
  nowMs: number,
): GrowRow[] {
  // 전체 탭과 같은 분모: 상장폐지 제외 전 종목의 원화 평가액 합
  const totalValue = stocks
    .filter((s) => s.inactiveStatus !== "delisted")
    .reduce((sum, s) => sum + s.quantity * s.currentPrice * getMultiplier(s.currency, exchangeRates), 0);

  const rows: GrowRow[] = [];
  for (const [key, items] of groupStocksByTicker(stocks)) {
    if (!key.startsWith("t:")) continue; // 티커 없는 종목
    const merged = mergeStockGroup(items);
    const ticker = normalizeTicker(merged);
    if (!isStockLabelKey(ticker)) continue;
    const m = computeStockMetrics(merged, exchangeRates, totalValue);
    const tone = profitTone(m.profit, m.profitRate);
    const priced = merged.currentPrice > 0;
    const item = labels.items[ticker];
    const { fact, checkedToday } = item ? labelFactOf(item, nowMs) : { fact: null, checkedToday: false };
    let overdueFact: string | null = null;
    if (item?.label === "check" && labels.cycle.months !== null) {
      const e = elapsedSince(cycleBase(item), nowMs);
      if (e && e.months >= labels.cycle.months) overdueFact = `내가 정한 주기 ${labels.cycle.months}개월이 지났어요`;
    }
    rows.push({
      key,
      ticker,
      name: merged.name,
      groupStockIds: items.map((s) => s.id),
      rawTicker: merged.ticker || "",
      category: merged.category,
      value: m.currentVal,
      weightText: priced ? `${m.pct.toFixed(1)}%` : "—",
      rateText: priced ? `${tone.sign}${tone.rate.toFixed(1)}%` : "—",
      labelState: !item ? "unset" : item.label === null ? "none" : item.label,
      labelFact: fact,
      overdueFact,
      checkedToday,
    });
  }
  return rows.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
}

/** 화면 순서 — 주기가 지난 '점검할 자산'이 위, 그 밖은 비중 큰 순(입력이 이미 비중 순). 손실 순 없음 */
export function sortGrowRowKeys(rows: GrowRow[]): string[] {
  return [...rows.filter((r) => r.overdueFact), ...rows.filter((r) => !r.overdueFact)].map((r) => r.key);
}

/** 접히는 행 — 정렬 4번째 이후이면서 주기가 지나지 않은 행(AC-6a) */
export function collapsedGrowRowKeys(orderedRows: GrowRow[], visibleCount = 3): string[] {
  return orderedRows.filter((r, i) => i >= visibleCount && !r.overdueFact).map((r) => r.key);
}

export interface GrowSummary {
  keep: number;
  check: number;
  none: number;
  /** 보유 중인 '점검할 자산'의 가장 최근 점검 — `마지막 점검 N개월 전`. 기록이 없으면 null */
  lastCheckText: string | null;
}

/** 요약 — 사용자가 붙인 개수만 센다. 세 수의 합 = 행 수. 같은 이름표를 함께 쓰는 행도 행마다 센다 */
export function summarizeGrowRows(rows: GrowRow[], labels: StockLabels, nowMs: number): GrowSummary {
  let keep = 0;
  let check = 0;
  let latest: string | null = null;
  for (const r of rows) {
    if (r.labelState === "keep") keep++;
    else if (r.labelState === "check") {
      check++;
      const at = labels.items[r.ticker]?.checkedAt;
      const ms = stockLabelTime(at);
      if (ms !== null && (latest === null || ms > stockLabelTime(latest)!)) latest = at!;
    }
  }
  const e = latest ? elapsedSince(latest, nowMs) : null;
  return { keep, check, none: rows.length - keep - check, lastCheckText: e ? `마지막 점검 ${formatAgo(e)}` : null };
}
