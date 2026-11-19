/**
 * asset/grow-board.ts
 * 내 자산 불리기(#239, 5.125 재설계 5차 개선판 5b) 화면의 표시 값(순수 함수).
 *  - 종합 카드: 지금 가진 주식의 산 날부터 지금까지 손익 — 상세 › 주식 '전체' 헤더와 같은 공용 계산(computeStockTotals)
 *    + 라벨 3행(오래 둘 수익률·산 날보다 낮은 수 / 점검할 점검 차례 수 / 배당). 종목명은 쓰지 않는다
 *  - 기준 4칸: 보유 기간 / ETF·개별 / 핵심 분야 / 시가총액. 분류는 X-Ray 판정(classifyStock)을 그대로 쓰고 기기 캐시만 읽는다(요청 0)
 *  - 내 종목: 오래 둘 → 점검할 → 아직 안 정함 묶음. 묶음 안은 점검 차례 → 오래 가진 순(값 순 정렬 없음).
 *    오래 둘 점검 차례 안에서만 산 날보다 낮은 행을 먼저 두는 이분 규칙(크기 순위 아님). 순서는 화면에 들어올 때 한 번 정한다
 *  - 점검 차례: 점검할 = 내가 정한 조건(−하한·+상한)에 닿거나 기준일 + (조건 기간 ‖ 기본 주기), 오래 둘 = 기준일 + 12개월.
 *    ±% 조건은 같은 방향을 `그대로 둠`으로 확인하면 풀린다(#247, pctAckOf) — 다음 점검일·조건 수정·반대 방향에서 다시 차례
 *    기준일 = max(정한 날, 점검한 날, 그 티커의 마지막 '그대로 둠' 기록)
 *  - 묶음·막대 순서는 값과 무관한 고정 순서다. 앱은 종목을 고르거나 권하지 않는다 — 여기서 만드는 값은 내 기록에서 나온 사실뿐이다
 */

import type { Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { computeStockMetrics, computeStockTotals, groupStocksByTicker, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { classifyStock } from "@/lib/xray/stock-xray";
import { GRADE_THRESHOLDS } from "@/lib/report/asset-grade";
import { STOCK_LABEL_CYCLES, isStockLabelKey, lastSameReview, reviewsOf, stockLabelTime, type StockLabelItem, type StockLabels, type StockReviewHit } from "@/lib/asset/stock-labels";
import { elapsedSince, formatSince, kstDayText, tradeCountsByLabelKey, type GrowLabelState } from "@/lib/asset/grow-rows";

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

/** 점검 칸의 보기 종류(#242) — 부동산·실물은 한 보기(own) */
export type BoardRowKind = "stock" | "crypto" | "real" | "physical";

export interface BoardRow {
  /** 자산 종류(#242). 주식 외 행은 grow-kinds.ts가 만든다 */
  kind: BoardRowKind;
  /** 행 key — 티커 묶음(`t:원문 티커`) 또는 티커 없는 보유 건 id. 주식 외는 이름표 키와 같은 접두(`c:`·`r:`·`p:`) */
  key: string;
  /** 이름표 저장 키(normalizeTicker). 티커 없는 종목은 null(이름표 칩 없음) */
  labelKey: string | null;
  name: string;
  groupStockIds: string[];
  rawTicker: string;
  category: string;
  /** 분류 판정용 대표 보유 건(묶음의 합산 대표). 주식 외 행은 null(기준 4칸 없음) */
  rep: Stock | null;
  /** 부동산·실물 행 전용 — 한 장 값 구획에 쓰는 내 입력값·참고값(저장하지 않는다) */
  own?: { assetId: string; value: number; estimate?: number; estimateDate?: string };
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
  /** 지금 주당 시세(종목 통화) — 시세가 있는 첫 보유 건. 없으면 null */
  nowPrice: number | null;
  /** 행 2줄 `정한 날 대비`/`점검일 대비` % — 장기 보유·점검 대상만. 기준 가격이 없으면 null(칸 없음). today = 기준일이 오늘(KST) → `오늘 정함`·`오늘 점검함` */
  since: { kind: "labeled" | "checked"; pct: number; today: boolean } | null;
  /** 점검 차례 — 점검할 조건·기간, 오래 둘 12개월 재확인 */
  due: boolean;
  dueReason: DueReason | null;
  /** 차례 기준일 + 기간(ms). 기간을 정하지 않은 점검할은 null */
  nextCheckMs: number | null;
  /** 오늘 이미 '그대로 둠'을 눌렀는지 — 그 뒤 조건(±% 값·기간)을 고쳐 다시 차례가 된 행은 false(다시 누를 수 있다) */
  checkedToday: boolean;
  /** 아직 안 정함 행 2줄 — `9월 19일 점검할에서 뺌`(최근 90일 기록만). 없으면 null */
  dropNote: string | null;
  /** 이 앱에 기록한 매매 최근 3개월 건수(매수·매도 합) */
  tradeCount: number;
}

export type DueReason =
  | { kind: "down"; pct: number }
  | { kind: "up"; pct: number }
  | { kind: "date"; months: number; source: "plan" | "cycle" | "keep" };

/** 오래 둘 재확인 간격(개월) */
export const KEEP_RECHECK_MONTHS = 12;
/** `점검할에서 뺌`을 행에 보이는 기간(일) */
export const DROP_NOTE_DAYS = 90;

/** 차례 기준일 — 정한 날·점검한 날·그 티커의 마지막 '그대로 둠' 기록 중 가장 늦은 시각(기기 경합으로 checkedAt이 져도 차례가 되살아나지 않게) */
export function cycleBaseOf(item: Pick<StockLabelItem, "checkedAt" | "labeledAt">, lastSameAt?: string): string {
  let best = item.labeledAt;
  let bestMs = stockLabelTime(item.labeledAt) ?? -Infinity;
  for (const c of [item.checkedAt, lastSameAt]) {
    const ms = stockLabelTime(c);
    if (ms !== null && ms >= bestMs) { best = c!; bestMs = ms; }
  }
  return best;
}

/** KST 날짜에 달력 월을 더한 날(ms, KST 자정 기준 UTC) — 그 날짜가 없는 달은 말일 */
export function addMonthsKst(fromMs: number, months: number): number {
  const d = new Date(fromMs + 9 * 60 * 60 * 1000);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return target.getTime() - 9 * 60 * 60 * 1000;
}

/** `2월 18일`(KST) */
export function monthDayText(ms: number): string {
  const d = new Date(ms + 9 * 60 * 60 * 1000);
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
}

/** 다음 점검 날짜 — 오늘과 11개월 넘게 떨어지면 연도를 붙인다(`2027년 11월 18일`, 같은 달 이름이 두 번 오는 혼동 방지) */
export function nextCheckDateText(ms: number, nowMs: number): string {
  const far = ms > addMonthsKst(nowMs, 11) || ms < addMonthsKst(nowMs, -11);
  return far ? `${new Date(ms + 9 * 60 * 60 * 1000).getUTCFullYear()}년 ${monthDayText(ms)}` : monthDayText(ms);
}

/** 이 이름표의 점검 간격(개월) — 오래 둘 12, 점검할 = 조건 기간 ‖ 기본 주기(없으면 null) */
export function checkMonthsOf(item: StockLabelItem | undefined, cycleMonths: number | null): number | null {
  if (item?.label === "keep") return KEEP_RECHECK_MONTHS;
  if (item?.label === "check") return item.plan?.months ?? cycleMonths;
  return null;
}

const ROUND1 = (v: number) => Math.round(v * 10) / 10;

/** `+16.7%` / `-3.1%` — 표시 기준(소수 1자리 반올림)이 0이면 부호 없음. 불리기 화면·상세·주식·종목 한 장이 같은 글자를 쓴다(#245) */
export const pctText = (v: number): string => {
  const r = ROUND1(v);
  return `${r > 0 ? "+" : ""}${(r === 0 ? 0 : r).toFixed(1)}%`;
};

/** 주기·기간이 없는 종목의 ±% 확인이 유지되는 기간(개월) — 점검 주기 선택지의 가장 짧은 값(3개월) */
export const PCT_ACK_MONTHS = STOCK_LABEL_CYCLES[0];

/**
 * ±% 조건 차례를 이미 확인했는지(#247) — 지금 이름표·지금 조건을 정한 뒤의 `그대로 둠` 기록 가운데
 * ±% 차례에서 누른 것(hit = down·up) 중 가장 최근 것의 방향과 시각. 없으면 null.
 *  - ±% 값·기간을 고치면(plan.at이 기록보다 뒤) 새 조건이라 확인하지 않은 것으로 본다. 메모만 고치면 plan.at이 그대로다(setStockPlan)
 *  - 차례가 아닐 때 누른 기록·기간 차례 기록(hit 없음·plan·cycle·keep)은 건너뛴다 — 확인 뒤 다시 눌러도 확인이 지워지지 않는다
 *  - 5.125에서 누른 기록은 hit이 없어 어느 조건을 보고 눌렀는지 알 수 없다 → 확인으로 치지 않는다(다음 누름부터 hit이 남는다)
 * 저장된 값(기록·plan.at)만 읽는다. 기기 경합으로 checkedAt이 져도 기록이 남아 있으면 같다
 */
export function pctAckOf(labels: StockLabels, labelKey: string, item: StockLabelItem): { hit: "down" | "up"; at: string } | null {
  const floor = Math.max(stockLabelTime(item.labeledAt) ?? -Infinity, stockLabelTime(item.plan?.at) ?? -Infinity);
  // 정규화된 목록은 티커 안에서 최신 먼저
  const last = reviewsOf(labels, labelKey).find((r) => r.choice === "same" && (r.hit === "down" || r.hit === "up") && stockLabelTime(r.at)! >= floor);
  return last ? { hit: last.hit as "down" | "up", at: last.at } : null;
}

/**
 * 점검 차례 판정 — 조건 하한 → 상한 → 기간 순으로 첫 사유 1개.
 * ±% 조건은 같은 방향을 이미 확인했으면(ack) 차례가 아니다. 다시 차례가 되는 때: 약속한 다음 점검일(기준일 + 기간)이 되었을 때,
 * 확인 뒤 조건을 고쳤을 때, 반대 방향 조건에 닿았을 때(#247). 기간이 없는 종목은 약속한 날이 없으므로
 * 확인 기록 + PCT_ACK_MONTHS(3개월)가 지나고 여전히 닿아 있으면 다시 차례다(영구 확인 아님)
 */
function dueOf(item: StockLabelItem, rate: number | null, months: number | null, baseIso: string, nowMs: number, ack: { hit: "down" | "up"; at: string } | null = null): DueReason | null {
  const e = months === null ? null : elapsedSince(baseIso, nowMs);
  const dateDue = months !== null && !!e && e.months >= months;
  if (item.label === "check" && item.plan && rate !== null) {
    const r = ROUND1(rate);
    const hit = item.plan.down !== undefined && r <= -item.plan.down ? "down" : item.plan.up !== undefined && r >= item.plan.up ? "up" : null;
    const acked = ack?.hit === hit && !dateDue && (months !== null || (elapsedSince(ack.at, nowMs)?.months ?? 0) < PCT_ACK_MONTHS);
    if (hit && !acked) return { kind: hit, pct: item.plan[hit]! };
  }
  if (!dateDue) return null;
  const source = item.label === "keep" ? "keep" : item.plan?.months !== undefined ? "plan" : "cycle";
  return { kind: "date", months: months!, source };
}

/** 차례 이유 문장(사실형) — `+25% 이상에 닿았어요` / `정한 기간 3개월이 지났어요` */
export function dueReasonText(r: DueReason): string {
  if (r.kind === "down") return `평단 대비 −${r.pct}% 이하에 닿았어요`;
  if (r.kind === "up") return `평단 대비 +${r.pct}% 이상에 닿았어요`;
  if (r.source === "keep") return `장기 보유로 정한 지 ${r.months}개월이 지났어요`;
  if (r.source === "cycle") return `점검 주기 ${r.months}개월이 지났어요`;
  return `정한 기간 ${r.months}개월이 지났어요`;
}

const DROP_FROM: Record<string, string> = { keep: "장기 보유에서 뺌", check: "점검 대상에서 뺌" };

/** 매수일(YYYY-MM-DD) → 보유 기간. 비었거나 형식이 틀리거나 미래면 null */
export function holdingOf(purchaseDate: string | undefined, nowMs: number): { date: string; days: number; months: number } | null {
  if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return null;
  if (purchaseDate > kstDayText(nowMs)) return null;
  const e = elapsedSince(purchaseDate, nowMs);
  return e ? { date: purchaseDate, days: e.days, months: e.months } : null;
}

export const holdTextOf = (h: { days: number; months: number } | null): string => {
  if (!h) return "기간 미상";
  if (h.days === 0) return "오늘";
  return formatSince(h);
};

export type LabelFacts = Pick<BoardRow, "labelState" | "since" | "due" | "dueReason" | "nextCheckMs" | "checkedToday" | "dropNote">;

/**
 * 한 이름표 키의 묶음·차례·`정한 날 대비` 값 — 주식·코인·부동산·실물 행이 같은 판정을 쓴다(#242, 계산 1벌).
 * rate = 평단(매입가) 대비 %, nowPrice = 지금 주당 시세. 부동산·실물은 nowPrice를 null로 넘겨 `정한 날 대비`를 만들지 않고,
 * pctPlan=false로 ±% 조건을 차례 판정에 쓰지 않는다(값이 내가 넣은 숫자라 조건에 닿는 날 = 내가 값을 고친 날)
 */
export function labelFactsOf(labels: StockLabels, labelKey: string | null, rate: number | null, nowPrice: number | null, nowMs: number, pctPlan = true): LabelFacts {
  const item = labelKey ? labels.items[labelKey] : undefined;
  let dueReason: DueReason | null = null;
  let nextCheckMs: number | null = null;
  let checkedToday = false;
  let since: BoardRow["since"] = null;
  let dropNote: string | null = null;
  if (item && item.label !== null && labelKey) {
    const same = lastSameReview(labels, labelKey, item.labeledAt);
    const baseIso = cycleBaseOf(item, same?.at);
    const months = checkMonthsOf(item, labels.cycle.months);
    dueReason = dueOf(item, pctPlan ? rate : null, months, baseIso, nowMs, pctPlan ? pctAckOf(labels, labelKey, item) : null);
    nextCheckMs = months === null ? null : addMonthsKst(stockLabelTime(baseIso)!, months);
    const checkIso = cycleBaseOf({ labeledAt: "", checkedAt: item.checkedAt }, same?.at);
    const c = elapsedSince(checkIso, nowMs);
    // 오늘 점검한 뒤 ±% 값·기간을 고쳐(plan.at이 그 점검보다 뒤) 다시 차례가 되면 같은 날도 다시 누를 수 있다(#247) —
    // `점검 차례`와 `오늘 점검함`이 함께 보이지 않게. 누르면 그 기록이 plan.at보다 뒤라 다시 막힌다(조건 수정 1번에 1번)
    const planMs = stockLabelTime(item.plan?.at);
    const reopened = dueReason !== null && planMs !== null && (stockLabelTime(checkIso) ?? Infinity) < planMs;
    checkedToday = !!c && c.days === 0 && !reopened;
    // '점검 뒤' = 정한 뒤 마지막 '그대로 둠' 기록의 가격, 없으면 '정한 뒤' = 정한 날 가격(base.price)
    const ref = same ? { kind: "checked" as const, price: same.price, at: same.at } : item.base?.price ? { kind: "labeled" as const, price: item.base.price, at: item.labeledAt } : null;
    if (ref && nowPrice !== null) since = { kind: ref.kind, pct: (nowPrice / ref.price - 1) * 100, today: elapsedSince(ref.at, nowMs)?.days === 0 };
  } else if (labelKey) {
    const last = reviewsOf(labels, labelKey)[0];
    const ms = stockLabelTime(last?.at);
    const days = ms === null ? null : elapsedSince(last.at, nowMs)?.days ?? null;
    if (last && last.choice === "none" && days !== null && days <= DROP_NOTE_DAYS && ms! <= nowMs) dropNote = `${monthDayText(ms!)} ${DROP_FROM[last.from]}`;
  }
  return {
    labelState: !labelKey ? "unset" : !item ? "unset" : item.label === null ? "none" : item.label,
    since, due: dueReason !== null, dueReason, nextCheckMs, checkedToday, dropNote,
  };
}

/** 차례 이유 → 기록에 남길 값(#242 `hit`) — 차례가 아니면 undefined */
export function hitOf(r: DueReason | null): StockReviewHit | undefined {
  if (!r) return undefined;
  return r.kind === "date" ? r.source : r.kind;
}

/**
 * 종목별 표 행 — 오래 가진 순(가장 이른 매수일 오름차순, 기간 미상은 끝). 상장폐지 보유 건은 뺀다.
 * 티커 없는 종목도 행을 만든다(묶음 합 = 결론 카드 합계가 되도록) — 이름표 칩만 없다.
 * 행 금액은 보유 건마다 computeStockMetrics를 더해 상세 › 주식 '전체' 헤더 합과 원 단위로 같다.
 */
export function buildBoardRows(stocks: Stock[], rates: Rates, labels: StockLabels, nowMs: number, transactions: Transaction[] = []): BoardRow[] {
  // 전량 매도로 수량 0만 남은 보유 건은 뺀다 — 판 뒤에도 행·차례·카드 수에 남던 문제(#243, v5.125 qa 확정)
  const active = stocks.filter((s) => s.inactiveStatus !== "delisted" && s.quantity > 0);
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
    const rate = priced && cost > 0 ? (profit / cost) * 100 : null;
    const nowPrice = items.find((it) => it.currentPrice > 0)?.currentPrice ?? null;
    const facts = labelFactsOf(labels, labelKey, rate, nowPrice, nowMs);
    rows.push({
      kind: "stock",
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
      rate,
      priced,
      score: holdScore(profit, cost, held?.days ?? null, priced),
      ...facts,
      nowPrice,
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

export interface BoardSummary {
  /** 오래 둘·점검할을 하나도 정하지 않음 — 카드 라벨 2행 대신 안내 1줄 */
  first: boolean;
  /** 오래 둘 — 수익률은 Σ손익 ÷ Σ원가(늘 수익률 꼴). 시세 없는 행이 있으면 null. low = 산 날보다 낮은 행 수 */
  keep: { count: number; rate: number | null; low: number };
  /** 점검할 — due = 점검 차례 수 */
  check: { count: number; due: number };
}

/** 종합 카드 라벨 행 값 — 개수·수익률만(종목명 없음). 값과 무관하게 같은 두 축이 늘 나온다 */
export function boardSummary(rows: BoardRow[]): BoardSummary {
  const keep = rows.filter((r) => r.labelState === "keep");
  const check = rows.filter((r) => r.labelState === "check");
  const cost = keep.reduce((s, r) => s + r.cost, 0);
  const profit = keep.reduce((s, r) => s + r.profit, 0);
  return {
    first: keep.length + check.length === 0,
    keep: { count: keep.length, rate: keep.length > 0 && keep.every((r) => r.priced) && cost > 0 ? (profit / cost) * 100 : null, low: keep.filter((r) => r.rate !== null && ROUND1(r.rate) < 0).length },
    check: { count: check.length, due: check.filter((r) => r.due).length },
  };
}

/** 점검 차례 종목 수 — 허브 셋째 카드(불리기 화면 행 표시와 같은 판정) */
export const countDueRows = (rows: BoardRow[]): number => rows.filter((r) => r.due).length;

/**
 * 주식 행만의 상태(6차). #242부터 허브 셋째 카드·세그먼트 `내 자산 점검` 둘째 줄은 전 종류 합(grow-kinds.growStatus)을 쓴다.
 * due = 점검 차례 있음 / labeled = 정한 것은 있고 차례 0 / first = 정한 것 0 / empty = 주식 행 없음
 */
export function boardStatus(rows: BoardRow[]): { kind: "due" | "labeled" | "first" | "empty"; due: number; keep: number; check: number; count: number } {
  const keep = rows.filter((r) => r.labelState === "keep").length;
  const check = rows.filter((r) => r.labelState === "check").length;
  const due = countDueRows(rows);
  const kind = rows.length === 0 ? "empty" : due > 0 ? "due" : keep + check > 0 ? "labeled" : "first";
  return { kind, due, keep, check, count: rows.length };
}

export type BoardBucket = "keep" | "check" | "none";
export const BOARD_BUCKETS: readonly { value: BoardBucket; label: string }[] = [
  { value: "keep", label: "장기 보유" },
  { value: "check", label: "점검 대상" },
  { value: "none", label: "정하지 않음" },
];
export const bucketOf = (r: BoardRow): BoardBucket => (r.labelState === "keep" || r.labelState === "check" ? r.labelState : "none");

/**
 * 묶음 안 순서(화면에 들어올 때 한 번 정한다) — 점검 차례 → 오래 가진 순. 오래 둘 점검 차례 안에서만 산 날보다 낮은 행 먼저(이분).
 * 입력 rows는 이미 오래 가진 순이다. 반환은 행 key → 순번
 */
export function boardRowRank(rows: BoardRow[]): Map<string, number> {
  const tier = (r: BoardRow) => (!r.due ? 2 : r.labelState === "keep" && r.rate !== null && ROUND1(r.rate) < 0 ? 0 : 1);
  const ordered = rows.map((r, i) => ({ r, i })).sort((a, b) => tier(a.r) - tier(b.r) || a.i - b.i);
  return new Map(ordered.map(({ r }, i) => [r.key, i]));
}

// ─── 기준 4칸 ─────────────────────────────────────────────────────

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
    const k = classifyStock("marketCap", row.rep!).key === "etf" ? "etf" : "single";
    return { key: k, label: ETF_LABEL[k] };
  }
  return classifyStock(axis === "sector" ? "theme" : "marketCap", row.rep!);
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

