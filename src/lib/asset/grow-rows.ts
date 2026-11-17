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
import { isStockLabelKey, stockLabelTime, type StockLabelBase, type StockLabelItem, type StockLabels } from "@/lib/asset/stock-labels";

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
  /** 무게 줄 분자 — 상장폐지 보유분은 분모에서 빠지므로 여기서도 뺀 평가액 */
  weightValue: number;
  /** `34.0%` — 전체 탭 행과 같은 문자열. 시세 미조회면 `—` */
  weightText: string;
  /** `+52.0%`·`-18.0%` — 전체 탭 행과 같은 문자열. 시세 미조회면 `—` */
  rateText: string;
  labelState: GrowLabelState;
  /** 이름표 사실 줄. 이름표가 없으면 null */
  labelFact: string | null;
  /** 주기 경과 문구. 지나지 않았으면 null */
  overdueFact: string | null;
  /** 수량 비교 — 정한 날의 내 기록과 지금의 내 기록. 당일·base 없는 항목·이름표 없는 행은 null */
  qtyFact: { state: "same" | "changed"; text: string } | null;
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

const valueOf = (s: Stock, rates: { USD: number; JPY: number }) => s.quantity * s.currentPrice * getMultiplier(s.currency, rates);
const counted = (s: Stock) => s.inactiveStatus !== "delisted";

/** 비중 분모(전체 탭과 같은 값: 상장폐지 제외 전 종목의 원화 평가액 합)와 시세 없는 종목 유무 */
export function growTotals(stocks: Stock[], exchangeRates: { USD: number; JPY: number }): { totalValue: number; hasUnpriced: boolean } {
  const active = stocks.filter(counted);
  return {
    totalValue: active.reduce((sum, s) => sum + valueOf(s, exchangeRates), 0),
    hasUnpriced: active.some((s) => !(s.currentPrice > 0)),
  };
}

/** 수량 표기 — 종목 페이지 `총 N주`와 같은 방식 */
export const formatQty = (qty: number): string => `${qty.toLocaleString()}주`;

/** 이름표 키(normalizeTicker)별 보유 수량 합 — 계좌·분류·증권사 무관, 원문 티커가 달라 나뉜 행도 합친다 */
export function qtyByLabelKey(stocks: Stock[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const s of stocks) {
    if (!s.ticker) continue;
    const key = normalizeTicker(s);
    map.set(key, (map.get(key) ?? 0) + s.quantity);
  }
  return map;
}

/**
 * 이름표를 붙이는 순간의 기준값. 수량은 지금 수량과 같은 함수(qtyByLabelKey).
 * 시세는 종목 통화 그대로, 그 종목 시세가 없으면 비운다. 비중은 시세 없는 종목이 하나라도 있으면(분모가 틀린다) 비운다.
 */
export function buildLabelBase(stocks: Stock[], exchangeRates: { USD: number; JPY: number }, ticker: string): StockLabelBase | undefined {
  const mine = stocks.filter((s) => s.ticker && normalizeTicker(s) === ticker);
  const qty = mine.reduce((sum, s) => sum + s.quantity, 0);
  if (!(Number.isFinite(qty) && qty > 0)) return undefined;
  const priced = mine.find((s) => s.currentPrice > 0);
  // 시세 기준일은 날짜만 남긴다 — baseDate는 `2026-11-17-H19`처럼 시간 슬롯이 붙기도 해 그대로 두면 시각으로 읽히지 않는다
  const priceDay = priced?.baseDate?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  const { totalValue, hasUnpriced } = growTotals(stocks, exchangeRates);
  const weight = !hasUnpriced && totalValue > 0
    ? Math.round((mine.filter(counted).reduce((sum, s) => sum + valueOf(s, exchangeRates), 0) / totalValue) * 10000) / 100
    : null;
  return {
    qty,
    ...(priced ? { price: priced.currentPrice } : {}),
    ...(priceDay ? { priceAt: priceDay } : {}),
    ...(weight !== null && weight >= 0 && weight <= 100 ? { weight } : {}),
  };
}

/** 수량 비교 문장 — 표시 문자열이 같으면 '그대로'(소수 수량의 부동소수 오차로 다르게 뜨지 않게). 늘고 준 방향은 말하지 않는다 */
function qtyFactOf(item: StockLabelItem | undefined, nowQty: number | undefined, nowMs: number): GrowRow["qtyFact"] {
  if (!item || item.label === null || !item.base || nowQty === undefined) return null;
  const e = elapsedSince(item.labeledAt, nowMs);
  if (!e || e.days === 0) return null;
  const then = formatQty(item.base.qty);
  const now = formatQty(nowQty);
  return then === now ? { state: "same", text: "정한 뒤 수량 그대로" } : { state: "changed", text: `정한 날 ${then} → 지금 ${now}` };
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
  const { totalValue } = growTotals(stocks, exchangeRates);
  const qtyNow = qtyByLabelKey(stocks);

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
      weightValue: items.filter(counted).reduce((sum, s) => sum + valueOf(s, exchangeRates), 0),
      weightText: priced ? `${m.pct.toFixed(1)}%` : "—",
      rateText: priced ? `${tone.sign}${tone.rate.toFixed(1)}%` : "—",
      labelState: !item ? "unset" : item.label === null ? "none" : item.label,
      labelFact: fact,
      overdueFact,
      qtyFact: qtyFactOf(item, qtyNow.get(ticker), nowMs),
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

export interface GrowWeight {
  /** 종목(행) 수 */
  count: number;
  /** `58.4%` 또는 `—`(시세 없는 종목이 있을 때) */
  pctText: string;
  /** 막대 조각 폭(표시값과 같은 수). 비중을 낼 수 없으면 null */
  pct: number | null;
}

export interface GrowSummary {
  keep: number;
  check: number;
  none: number;
  /** 보유 중인 '점검할 자산'의 가장 최근 점검 — `마지막 점검 N개월 전`. 기록이 없으면 null */
  lastCheckText: string | null;
  /** 무게 줄 — 이름표별 내 주식 비중. 세 표시값의 합은 100.0 */
  weights: { keep: GrowWeight; check: GrowWeight; none: GrowWeight };
}

/**
 * 요약 — 사용자가 붙인 개수와 그 묶음의 내 주식 비중. 세 수의 합 = 행 수, 세 비중의 합 = 100.0.
 * 비중은 행 평가액 합 ÷ 행 비중과 같은 분모로 내고(행에 표시된 %를 더하지 않는다), '정하지 않음'은 100 − 나머지 둘의 표시값
 * (티커 없는 종목의 몫 포함). 시세 없는 종목이 하나라도 있으면 분모가 틀리므로 비중은 `—`.
 * 이 값으로 정렬하거나 이름표끼리 견주지 않는다.
 */
export function summarizeGrowRows(
  rows: GrowRow[],
  labels: StockLabels,
  nowMs: number,
  totals: { totalValue: number; hasUnpriced: boolean },
): GrowSummary {
  let keep = 0;
  let check = 0;
  let keepValue = 0;
  let checkValue = 0;
  let latest: string | null = null;
  for (const r of rows) {
    if (r.labelState === "keep") { keep++; keepValue += r.weightValue; }
    else if (r.labelState === "check") {
      check++;
      checkValue += r.weightValue;
      const at = labels.items[r.ticker]?.checkedAt;
      const ms = stockLabelTime(at);
      if (ms !== null && (latest === null || ms > stockLabelTime(latest)!)) latest = at!;
    }
  }
  const none = rows.length - keep - check;
  const e = latest ? elapsedSince(latest, nowMs) : null;
  const usable = !totals.hasUnpriced && totals.totalValue > 0;
  const shown = (value: number) => Number(((value / totals.totalValue) * 100).toFixed(1));
  const weight = (count: number, pct: number | null): GrowWeight => ({ count, pct, pctText: pct === null ? "—" : `${pct.toFixed(1)}%` });
  const keepPct = usable ? shown(keepValue) : null;
  const checkPct = usable ? shown(checkValue) : null;
  const nonePct = keepPct !== null && checkPct !== null ? Math.max(0, Number((100 - keepPct - checkPct).toFixed(1))) : null;
  return {
    keep, check, none,
    lastCheckText: e ? `마지막 점검 ${formatAgo(e)}` : null,
    weights: { keep: weight(keep, keepPct), check: weight(check, checkPct), none: weight(none, nonePct) },
  };
}
