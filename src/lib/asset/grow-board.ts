/**
 * asset/grow-board.ts
 * 내 자산 불리기(#239, 5.125 재설계 3차) 화면의 표시 값(순수 함수).
 *  - 결론 카드: 지금 가진 주식의 산 날부터 지금까지 손익 — 상세 › 주식 '전체' 헤더와 같은 공용 계산(computeStockTotals)
 *  - 기준별 점검: 보유 기간 / ETF·개별 / 핵심 분야 / 시가총액 4축. 분류는 X-Ray 판정(classifyStock)을 그대로 쓰고 기기 캐시만 읽는다(요청 0)
 *  - 종목별 표: 오래 가진 순 고정(값 순 정렬 없음). 보유 기간 대비 점수는 연 환산 수익률 구간(자산 성적표 성장 축과 같은 구간)
 *  - 묶음·막대 순서는 값과 무관한 고정 순서다. 앱은 종목을 고르거나 권하지 않는다 — 여기서 만드는 값은 내 기록에서 나온 사실뿐이다
 */

import type { Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { computeStockMetrics, computeStockTotals, groupStocksByTicker, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { classifyStock } from "@/lib/xray/stock-xray";
import { GRADE_THRESHOLDS } from "@/lib/report/asset-grade";
import { isStockLabelKey, stockLabelTime, type StockLabels } from "@/lib/asset/stock-labels";
import { elapsedSince, formatAgo, formatSince, kstDayText, tradeCountsByLabelKey, type GrowLabelState } from "@/lib/asset/grow-rows";

type Rates = { USD: number; JPY: number };

// ─── 보유 기간 대비 점수 ──────────────────────────────────────────────

/**
 * 점수를 매기기 시작하는 보유 일수(약 6개월). 연 환산은 (1 + 수익률)^(365 ÷ 보유 일수) − 1 이라 보유가 짧을수록 지수가 커진다
 * — 6개월이면 2제곱, 3개월이면 4제곱, 1개월이면 12제곱. 6개월 미만은 한두 달 시세 변동이 점수를 좌우해 '측정 중'으로 둔다.
 * 6개월은 점검 주기 선택지(3·6·12개월)의 가운데 값이기도 하다.
 */
export const SCORE_MIN_DAYS = 183;

/** 점수 구간 — 자산 성적표 '장기 순자산 성장' 축의 연평균 성장률 구간을 그대로 쓴다(같은 앱 안에서 같은 잣대) */
const G = GRADE_THRESHOLDS.growth;
export const HOLD_SCORE_BANDS: readonly { score: number; min: number | null; text: string }[] = [
  { score: 5, min: G.cagrExcellent, text: `연 환산 ${G.cagrExcellent}% 이상` },
  { score: 4, min: G.cagrGood, text: `${G.cagrGood}% 이상` },
  { score: 3, min: G.cagrReal, text: `${G.cagrReal}% 이상` },
  { score: 2, min: 0, text: "0% 이상" },
  { score: 1, min: null, text: "0% 미만" },
];

export type HoldScore =
  | { state: "score"; score: number; annualPct: number }
  | { state: "measuring" }
  | { state: "none" };

/** 연 환산 수익률(%) — 보유 일수가 0 이하이거나 원가가 없으면 null */
export function annualizedPct(profit: number, cost: number, days: number): number | null {
  if (!(cost > 0) || !(days > 0)) return null;
  const r = profit / cost;
  if (r <= -1) return -100;
  return (Math.pow(1 + r, 365 / days) - 1) * 100;
}

export function holdScore(profit: number, cost: number, days: number | null, priced: boolean): HoldScore {
  if (!priced || days === null || !(cost > 0)) return { state: "none" };
  if (days < SCORE_MIN_DAYS) return { state: "measuring" };
  // 소수 1자리로 반올림한 뒤 구간을 정한다(부동소수 오차로 15%가 14.999…%로 떨어지지 않게)
  const annualPct = Math.round(annualizedPct(profit, cost, days)! * 10) / 10;
  const band = HOLD_SCORE_BANDS.find((b) => b.min === null || annualPct >= b.min)!;
  return { state: "score", score: band.score, annualPct };
}

// ─── 종목 행 ────────────────────────────────────────────────────────

export interface BoardRow {
  /** 행 key — 티커 묶음(`t:원문 티커`) 또는 티커 없는 보유 건 id */
  key: string;
  /** 이름표 저장 키(normalizeTicker). 티커 없는 종목은 null(이름표 칩 없음) */
  labelKey: string | null;
  name: string;
  groupStockIds: string[];
  rawTicker: string;
  category: string;
  /** 분류 판정용 대표 보유 건(묶음의 합산 대표) */
  rep: Stock;
  /** 가장 이른 매수일(YYYY-MM-DD). 읽을 수 없거나 미래면 null */
  purchaseDate: string | null;
  /** 보유 일수·지난 달력 월 수. 매수일을 읽을 수 없으면 null */
  holdDays: number | null;
  holdMonths: number | null;
  /** `2년 2개월` / `9개월` / `20일` / `기간 미상` */
  holdText: string;
  /** 원화 평가액·매입원가·손익(상세 › 주식과 같은 식). 시세가 없으면 priced=false */
  value: number;
  cost: number;
  profit: number;
  /** 손익 ÷ 원가(%) — 시세 없음·원가 0이면 null */
  rate: number | null;
  priced: boolean;
  score: HoldScore;
  labelState: GrowLabelState;
  /** 이름표 사실 — `마지막 점검 4개월 전` / `오래 두기로 한 지 9개월` 등. 없으면 null */
  labelFact: string | null;
  /** '점검할 자산'이고 내가 정한 주기가 지났는지(점검 차례) */
  due: boolean;
  /** 오늘 이미 점검을 눌렀는지 */
  checkedToday: boolean;
  /** 이 앱에 기록한 매매 최근 3개월 건수(매수·매도 합) */
  tradeCount: number;
}

/** 주기 판정 기준일 — 점검일과 이름표를 붙인 날 중 늦은 쪽 */
function cycleBaseOf(item: { checkedAt?: string; labeledAt: string }): string {
  const c = stockLabelTime(item.checkedAt);
  const l = stockLabelTime(item.labeledAt);
  return c !== null && (l === null || c >= l) ? item.checkedAt! : item.labeledAt;
}

/** 매수일(YYYY-MM-DD) → 보유 기간. 비었거나 형식이 틀리거나 미래면 null */
function holdingOf(purchaseDate: string | undefined, nowMs: number): { date: string; days: number; months: number } | null {
  if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return null;
  if (purchaseDate > kstDayText(nowMs)) return null;
  const e = elapsedSince(purchaseDate, nowMs);
  return e ? { date: purchaseDate, days: e.days, months: e.months } : null;
}

const holdTextOf = (h: { days: number; months: number } | null): string => {
  if (!h) return "기간 미상";
  if (h.days === 0) return "오늘";
  return formatSince(h);
};

function labelFactOf(item: StockLabels["items"][string], nowMs: number): string | null {
  if (item.label === "keep") {
    const e = elapsedSince(item.labeledAt, nowMs);
    return e ? (e.days === 0 ? "오늘 오래 두기로 했어요" : `오래 두기로 한 지 ${formatSince(e)}`) : null;
  }
  if (item.label === "check") {
    const checked = elapsedSince(item.checkedAt, nowMs);
    if (checked) return `마지막 점검 ${formatAgo(checked)}`;
    const e = elapsedSince(item.labeledAt, nowMs);
    return e ? (e.days === 0 ? "오늘 점검할 자산으로 정했어요" : `점검하기로 한 지 ${formatSince(e)}`) : null;
  }
  return null;
}

/**
 * 종목별 표 행 — 오래 가진 순(가장 이른 매수일 오름차순, 기간 미상은 끝). 상장폐지 보유 건은 뺀다.
 * 티커 없는 종목도 행을 만든다(묶음 합 = 결론 카드 합계가 되도록) — 이름표 칩만 없다.
 * 행 금액은 보유 건마다 computeStockMetrics를 더해 상세 › 주식 '전체' 헤더 합과 원 단위로 같다.
 */
export function buildBoardRows(stocks: Stock[], rates: Rates, labels: StockLabels, nowMs: number, transactions: Transaction[] = []): BoardRow[] {
  const active = stocks.filter((s) => s.inactiveStatus !== "delisted");
  const trades = tradeCountsByLabelKey(active, transactions, nowMs);
  const rows: BoardRow[] = [];
  for (const [key, items] of groupStocksByTicker(active)) {
    const merged = mergeStockGroup(items);
    const ticker = key.startsWith("t:") ? normalizeTicker(merged) : "";
    const labelKey = ticker && isStockLabelKey(ticker) ? ticker : null;
    let value = 0;
    let cost = 0;
    for (const it of items) {
      const m = computeStockMetrics(it, rates);
      value += m.currentVal;
      cost += m.cost;
    }
    const priced = items.every((it) => it.currentPrice > 0);
    const profit = value - cost;
    const held = holdingOf(merged.purchaseDate, nowMs);
    const item = labelKey ? labels.items[labelKey] : undefined;
    let due = false;
    let checkedToday = false;
    if (item?.label === "check") {
      const c = elapsedSince(item.checkedAt, nowMs);
      checkedToday = !!c && c.days === 0;
      if (labels.cycle.months !== null) {
        const e = elapsedSince(cycleBaseOf(item), nowMs);
        due = !!e && e.months >= labels.cycle.months;
      }
    }
    rows.push({
      key,
      labelKey,
      name: merged.name,
      groupStockIds: items.map((s) => s.id),
      rawTicker: merged.ticker || "",
      category: merged.category,
      rep: merged,
      purchaseDate: held?.date ?? null,
      holdDays: held?.days ?? null,
      holdMonths: held?.months ?? null,
      holdText: holdTextOf(held),
      value,
      cost,
      profit,
      rate: priced && cost > 0 ? (profit / cost) * 100 : null,
      priced,
      score: holdScore(profit, cost, held?.days ?? null, priced),
      labelState: !labelKey ? "unset" : !item ? "unset" : item.label === null ? "none" : item.label,
      labelFact: item ? labelFactOf(item, nowMs) : null,
      due,
      checkedToday,
      tradeCount: labelKey ? (trades.get(labelKey) ?? 0) : 0,
    });
  }
  return rows.sort((a, b) => {
    if (a.purchaseDate && b.purchaseDate && a.purchaseDate !== b.purchaseDate) return a.purchaseDate < b.purchaseDate ? -1 : 1;
    if (!a.purchaseDate !== !b.purchaseDate) return a.purchaseDate ? -1 : 1;
    return a.key.localeCompare(b.key);
  });
}

// ─── 결론 카드 ──────────────────────────────────────────────────────

export interface BoardTotal {
  /** 시세 없는 종목이 있으면 false — 합계를 그리지 않는다 */
  priced: boolean;
  count: number;
  profit: number;
  cost: number;
  rate: number;
}

/** 결론 카드 합계 — 상세 › 주식 '전체' 헤더와 같은 공용 함수 */
export function boardTotal(stocks: Stock[], rates: Rates, rows: BoardRow[]): BoardTotal {
  const t = computeStockTotals(stocks, rates);
  return { priced: rows.every((r) => r.priced), count: rows.length, profit: t.totalProfit, cost: t.totalCost, rate: t.totalProfitRate };
}

/** '앞으로 · 점검' — 사용자가 '점검할 자산'으로 정한 종목의 다음 점검일(주기 기준). 지났으면 `지금`. 가까운 순 */
export function nextChecks(rows: BoardRow[], labels: StockLabels, nowMs: number): { state: "no-check" | "no-cycle" } | { state: "list"; items: { name: string; when: string; due: boolean }[] } {
  const checks = rows.filter((r) => r.labelState === "check" && r.labelKey);
  if (checks.length === 0) return { state: "no-check" };
  const months = labels.cycle.months;
  if (months === null) return { state: "no-cycle" };
  const items = checks.map((r) => {
    const base = stockLabelTime(cycleBaseOf(labels.items[r.labelKey!]))!;
    const d = new Date(base + 9 * 60 * 60 * 1000);
    const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
    const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
    target.setUTCDate(Math.min(d.getUTCDate(), last));
    const ms = target.getTime();
    return { name: r.name, ms, due: r.due, when: r.due ? "지금" : `${target.getUTCMonth() + 1}월 ${target.getUTCDate()}일` };
  });
  items.sort((a, b) => (a.due !== b.due ? (a.due ? -1 : 1) : a.ms - b.ms || a.name.localeCompare(b.name)));
  return { state: "list", items: items.map(({ name, when, due }) => ({ name, when, due })) };
}

// ─── 기준별 점검 ─────────────────────────────────────────────────────

export type BoardAxis = "hold" | "etf" | "sector" | "cap";
export const BOARD_AXES: readonly { value: BoardAxis; label: string }[] = [
  { value: "hold", label: "보유 기간" },
  { value: "etf", label: "ETF·개별" },
  { value: "sector", label: "핵심 분야" },
  { value: "cap", label: "시가총액" },
];

export interface BoardGroup {
  key: string;
  label: string;
  rowKeys: string[];
  count: number;
  profit: number;
  cost: number;
  /** Σ손익 ÷ Σ원가(%) */
  rate: number;
}

const HOLD_ORDER = ["long", "short", "unknown"];
const HOLD_LABEL: Record<string, string> = { long: "1년 이상", short: "1년 미만", unknown: "기간 미상" };
const ETF_ORDER = ["etf", "single"];
const ETF_LABEL: Record<string, string> = { etf: "ETF", single: "개별 종목" };
const CAP_ORDER = ["large", "mid", "small", "etf", "unclassified"];

/** 한 행의 축 분류(키·라벨) */
export function rowAxisKey(axis: BoardAxis, row: BoardRow): { key: string; label: string } {
  if (axis === "hold") {
    const k = row.holdMonths === null ? "unknown" : row.holdMonths >= 12 ? "long" : "short";
    return { key: k, label: HOLD_LABEL[k] };
  }
  if (axis === "etf") {
    const k = classifyStock("marketCap", row.rep).key === "etf" ? "etf" : "single";
    return { key: k, label: ETF_LABEL[k] };
  }
  return classifyStock(axis === "sector" ? "theme" : "marketCap", row.rep);
}

/**
 * 축의 묶음 — 묶음 손익 = Σ행 손익, % = Σ손익 ÷ Σ원가. 묶음 합 = 결론 카드 합계(축마다).
 * 순서는 고정: 보유 기간·ETF·시가총액은 정해 둔 순서, 핵심 분야는 X-Ray와 같은 평가액 큰 순(수익률과 무관).
 */
export function buildAxisGroups(axis: BoardAxis, rows: BoardRow[]): BoardGroup[] {
  const map = new Map<string, BoardGroup & { value: number }>();
  for (const r of rows) {
    const { key, label } = rowAxisKey(axis, r);
    const g = map.get(key) ?? { key, label, rowKeys: [], count: 0, profit: 0, cost: 0, rate: 0, value: 0 };
    g.rowKeys.push(r.key);
    g.count++;
    g.profit += r.profit;
    g.cost += r.cost;
    g.value += r.value;
    map.set(key, g);
  }
  const list = [...map.values()].map((g) => ({ ...g, rate: g.cost > 0 ? (g.profit / g.cost) * 100 : 0 }));
  const order = axis === "hold" ? HOLD_ORDER : axis === "etf" ? ETF_ORDER : axis === "cap" ? CAP_ORDER : null;
  if (order) list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  else list.sort((a, b) => b.value - a.value || a.key.localeCompare(b.key));
  return list.map(({ value: _v, ...g }) => g);
}

/**
 * 막대 눈금 — 네 축의 모든 묶음과 모든 종목의 %로 한 번 정한다(탭을 바꿔도 길이 비교가 유지된다).
 * 10% 단위로 올림, 음수가 없으면 0이 왼쪽 끝.
 */
export function boardScale(rates: number[]): { lo: number; hi: number } {
  const step = 10;
  const max = Math.max(0, ...rates);
  const min = Math.min(0, ...rates);
  const hi = Math.max(step, Math.ceil(max / step) * step);
  const lo = Math.floor(min / step) * step;
  return { lo, hi: hi === lo ? lo + step : hi };
}

/** 눈금 위치(0~100%) */
export const scalePos = (v: number, s: { lo: number; hi: number }): number => Math.min(100, Math.max(0, ((v - s.lo) / (s.hi - s.lo)) * 100));

