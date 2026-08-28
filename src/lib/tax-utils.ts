// 세금 안내 개인화 (S-4.23)
// 보유 자산 → 세금 태그 매칭, 해외주식 실현차익 집계, 홈 배너 노출·닫기 상태.
// 외부 API·네트워크 없이 assetData와 정적 상수(config/tax-calendar.ts)만으로 계산한다.

import type { AssetData, Stock } from "@/types/asset";
import type { PositionSnapshot } from "@/types/transaction";
import { computeNewPosition } from "./trade/trade-utils";
import { STORAGE_KEYS } from "./local-storage";
import {
  TAX_EVENTS_BY_MONTH,
  FOREIGN_CAPITAL_GAIN_DEDUCTION,
  type TaxEvent,
  type TaxTag,
} from "@/config/tax-calendar";

// ─────────────────────────────────────────────
// 보유 태그 판정
// ─────────────────────────────────────────────

/** 세금 항목에 붙은 태그 → 그렇게 판정한 근거 문구. 홈 배너의 "왜 나에게 뜨는가" 설명에 쓴다. */
export type TaxTagReasons = Map<TaxTag, string>;

/** 해외주식 판정 — category가 foreign이거나 외화 표시 종목 */
export const isForeignStock = (s: Stock): boolean => s.category === "foreign" || s.currency !== "KRW";

const PENSION_CATEGORIES: ReadonlySet<string> = new Set(["irp", "isa", "pension"]);

/**
 * 보유 자산에서 세금 태그와 근거 문구를 산출한다.
 * "common"은 자산과 무관하게 항상 포함되며, 홈 배너 노출 판정에서는 제외된다.
 */
export function resolveTaxTags(assetData: AssetData): TaxTagReasons {
  const reasons: TaxTagReasons = new Map();
  reasons.set("common", "모든 납세자 공통");

  const commercial = assetData.realEstate.filter((r) => r.type === "commercial");
  if (commercial.length > 0) reasons.set("business", `상가·사무실 ${commercial.length}건 보유`);

  if (assetData.realEstate.length > 0) reasons.set("realestate", `부동산 ${assetData.realEstate.length}건 보유`);

  if (assetData.stocks.length > 0) reasons.set("stock", `주식 ${assetData.stocks.length}종목 보유`);

  const foreign = assetData.stocks.filter(isForeignStock);
  if (foreign.length > 0) reasons.set("foreign", `해외주식 ${foreign.length}종목 보유`);

  const pension = assetData.stocks.filter((s) => PENSION_CATEGORIES.has(s.category));
  if (pension.length > 0) reasons.set("pension", `연금·절세계좌 ${pension.length}종목 보유`);

  if (assetData.cash.length > 0) reasons.set("cash", `예적금·현금성 자산 ${assetData.cash.length}건 보유`);

  const mortgage = assetData.loans.filter((l) => l.type === "mortgage-home");
  if (mortgage.length > 0) reasons.set("loan", `담보대출 ${mortgage.length}건 보유`);

  return reasons;
}

// ─────────────────────────────────────────────
// 해외주식 실현차익 (양도소득세 신고 대상 판정)
// ─────────────────────────────────────────────

export interface ForeignRealizedGain {
  gainKrw: number;      // 연간 실현손익 통산액 (KRW)
  sellCount: number;    // 집계에 쓰인 매도 거래 건수
  estimated: boolean;   // 매수 로그·체결 환율 누락으로 폴백이 섞였는지
  overDeduction: boolean; // 기본공제(250만원) 초과 여부
}

const krwMul = (cur: string | undefined, rates: { USD: number; JPY: number }): number =>
  cur === "USD" ? rates.USD : cur === "JPY" ? rates.JPY / 100 : 1;

/**
 * 당해 연도 해외주식 매도 거래의 실현손익을 KRW로 통산한다.
 *
 * 거래 로그를 날짜순으로 replay하며 종목별 이동평균 원가를 추적하고(기존 computeNewPosition 재사용),
 * 매도 시점의 (체결가 − 평단) × 수량을 KRW로 환산해 누적한다.
 * 환율은 체결 환율 > 매입 환율 > 현재 환율 순으로 폴백하며, 폴백이 쓰이면 estimated=true.
 *
 * 거래 로그 자체가 없으면 null (계산 근거가 없어 안내하지 않는다).
 */
export function computeForeignRealizedGain(
  assetData: AssetData,
  year: number,
  rates: { USD: number; JPY: number },
): ForeignRealizedGain | null {
  const foreignIds = new Set(assetData.stocks.filter(isForeignStock).map((s) => s.id));
  const stockById = new Map(assetData.stocks.map((s) => [s.id, s]));

  // 해외 종목의 거래만 대상. 매도된 뒤 삭제된 종목은 stocks에 없으므로 거래의 currency로도 판정한다.
  const target = assetData.transactions.filter(
    (t) => foreignIds.has(t.stockId) || t.currency !== "KRW",
  );
  if (target.length === 0) return null;

  const sorted = [...target].sort(
    (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt),
  );

  const positions = new Map<string, PositionSnapshot>();
  let gainKrw = 0;
  let sellCount = 0;
  let estimated = false;

  const basePosition = (stockId: string): PositionSnapshot => ({
    stockId,
    quantity: 0,
    avgPrice: 0,
    avgExchangeRate: 0,
    source: "computed",
    effectiveDate: "",
    lockedByManual: false,
  });

  for (const tx of sorted) {
    const cur = positions.get(tx.stockId) ?? basePosition(tx.stockId);

    if (tx.type === "sell" && tx.date.slice(0, 4) === String(year)) {
      const stock = stockById.get(tx.stockId);
      // 매수 로그가 없어 평단을 모르면 현재 보유 평단으로 폴백(추정)
      let costPrice = cur.avgPrice;
      let costRate = cur.avgExchangeRate;
      if (cur.quantity <= 0 || costPrice <= 0) {
        costPrice = stock?.averagePrice ?? 0;
        costRate = stock?.purchaseExchangeRate ?? 0;
        estimated = true;
      }

      const sellRate = tx.exchangeRate ?? krwMul(tx.currency, rates);
      if (tx.exchangeRate === undefined) estimated = true;
      if (costRate <= 0) {
        costRate = sellRate;
        estimated = true;
      }

      // 취득가·양도가 각각 해당 시점 환율로 환산 (환차익도 과세 대상에 포함되는 구조와 동일)
      const proceeds = tx.price * tx.quantity * sellRate - (tx.fee ?? 0) * sellRate;
      const cost = costPrice * tx.quantity * costRate;
      gainKrw += proceeds - cost;
      sellCount += 1;
    }

    const preview = computeNewPosition(cur, tx);
    positions.set(tx.stockId, {
      ...cur,
      quantity: preview.quantity,
      avgPrice: preview.avgPrice,
      avgExchangeRate: preview.avgExchangeRate,
      effectiveDate: tx.date,
    });
  }

  if (sellCount === 0) return null;

  return {
    gainKrw,
    sellCount,
    estimated,
    overDeduction: gainKrw > FOREIGN_CAPITAL_GAIN_DEDUCTION,
  };
}

// ─────────────────────────────────────────────
// 연말 절세 시뮬레이션 (S-4.31)
// ─────────────────────────────────────────────
// "지금 팔면 세금이 얼마인가"는 미래 시점 가정이라 computeForeignRealizedGain처럼
// 거래로그를 replay할 필요가 없다 — Stock.averagePrice가 곧 현재 보유분의 취득원가다.

export const FOREIGN_CAPITAL_GAIN_TAX_RATE = 0.22;

/** 250만원 공제 적용 후 세액. 두 계산(후보 목록·선택 시뮬레이션)이 공유하는 단일 세액 공식 */
function computeForeignTax(gainKrw: number): { taxableKrw: number; taxKrw: number } {
  const taxableKrw = Math.max(gainKrw - FOREIGN_CAPITAL_GAIN_DEDUCTION, 0);
  return { taxableKrw, taxKrw: taxableKrw * FOREIGN_CAPITAL_GAIN_TAX_RATE };
}

/**
 * 보유 해외주식을 증권사(broker)와 무관하게 티커 기준으로 종합한다.
 * 동일 종목을 증권사별로 나눠 세금을 계산하는 것은 실제 세법과 맞지 않다(양도소득세는
 * 종목 단위로 손익을 합산해 신고) — `asset-detail-tabs.tsx`의 `groupStocksByTicker`/
 * `mergeStockGroup`(상세 > 주식 탭 "전체" 카테고리 병합)과 동일한 방식이나, lib 계층이
 * 컴포넌트 파일을 참조하지 않도록 이 파일 안에 동형 로직을 둔다.
 */
function groupForeignStocksByTicker(assetData: AssetData): Stock[] {
  const groups = new Map<string, Stock[]>();
  for (const s of assetData.stocks) {
    if (!isForeignStock(s) || s.inactiveStatus === "delisted" || s.inactiveStatus === "halted" || s.quantity <= 0) continue;
    const key = s.ticker ? `t:${s.ticker}` : s.id;
    const arr = groups.get(key);
    if (arr) arr.push(s);
    else groups.set(key, [s]);
  }
  return Array.from(groups.entries()).map(([key, items]) => {
    if (items.length === 1) return items[0];
    const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
    const averagePrice = totalQty > 0
      ? items.reduce((sum, it) => sum + it.averagePrice * it.quantity, 0) / totalQty
      : items[0].averagePrice;
    // 매입환율: 매입원금(수량×평단) 가중 평균, 유효 환율(>0)만 대상 — mergeStockGroup과 동일 규칙
    const rateItems = items.filter((it) => it.purchaseExchangeRate && it.purchaseExchangeRate > 0);
    const rateWeight = rateItems.reduce((sum, it) => sum + it.averagePrice * it.quantity, 0);
    const purchaseExchangeRate = rateWeight > 0
      ? rateItems.reduce((sum, it) => sum + it.purchaseExchangeRate! * it.averagePrice * it.quantity, 0) / rateWeight
      : items[0].purchaseExchangeRate;
    return { ...items[0], id: key, quantity: totalQty, averagePrice, purchaseExchangeRate, broker: undefined };
  });
}

/** 종목 1개를 "지금 전량 매도"한다고 가정했을 때 손익(KRW). 원가는 averagePrice(현재 평단) 그대로 사용 */
function computeStockUnrealizedGainKrw(
  stock: Stock,
  rates: { USD: number; JPY: number },
): { gainKrw: number; estimated: boolean } {
  const sellRate = krwMul(stock.currency, rates);
  let costRate = stock.purchaseExchangeRate;
  let estimated = false;
  if (costRate === undefined || costRate <= 0) {
    costRate = sellRate;
    estimated = true;
  }
  const proceeds = stock.currentPrice * stock.quantity * sellRate;
  const cost = stock.averagePrice * stock.quantity * costRate;
  return { gainKrw: proceeds - cost, estimated };
}

export interface TaxSimCandidate {
  stockId: string;
  name: string;
  quantity: number;           // 보유수량("전량" 프리셋 값)
  gainPerShareKrw: number;    // 주당 손익(KRW) — 부분 수량 시뮬레이션에 선형 사용
  unrealizedGainKrw: number;  // quantity * gainPerShareKrw (전량 기준 참고값, +이익/-손실)
  estimated: boolean;         // 매입 환율 폴백 여부
  rebuyQuantity: number;      // 이익 종목 한정 — 잔여 공제 한도를 채우는 수량(0=해당 없음/손실 종목)
}

export interface YearEndTaxSimulation {
  baselineGainKrw: number;        // 당해 실현손익 합계. 거래 없으면 0
  baselineEstimated: boolean;
  remainingDeductionKrw: number;  // 250만원 - max(baselineGainKrw,0), 0 미만 없음
  candidates: TaxSimCandidate[];  // 보유 해외주식 전체(비활성 제외). 손실 큰 순 → 이익 큰 순
}

/**
 * 이익 종목을 잔여 공제 한도까지 팔면 몇 주까지 비과세인지 계산한다.
 * baseGainKrw(그 종목을 제외한 나머지 손익 합계)는 음수일 수 있다 — 손실이 크면 그만큼
 * 한도가 250만원보다 커지는 것이 정상적인 손익통산이라 여기서 0으로 클램프하지 않는다.
 */
export function computeRebuyQuantity(gainPerShareKrw: number, quantity: number, baseGainKrw: number): number {
  if (gainPerShareKrw <= 0) return 0;
  const room = Math.max(FOREIGN_CAPITAL_GAIN_DEDUCTION - baseGainKrw, 0);
  return Math.max(0, Math.min(quantity, Math.floor(room / gainPerShareKrw)));
}

/**
 * 연말 절세 시뮬레이션의 기준 데이터(S-4.31). 당해 거래 로그가 없어도(=baseline 0)
 * 보유 해외주식이 있으면 항상 candidates를 반환한다 — 1차 구현의 null 게이팅 버그 수정.
 */
export function getYearEndTaxSimulation(
  assetData: AssetData,
  year: number,
  rates: { USD: number; JPY: number },
): YearEndTaxSimulation {
  const realized = computeForeignRealizedGain(assetData, year, rates);
  const baselineGainKrw = realized?.gainKrw ?? 0;
  const baselineEstimated = realized?.estimated ?? false;
  // 클램프 없이 그대로 뺀다 — baseline이 순손실(음수)이면 한도가 250만원보다 커지는 게 맞다
  const remainingDeductionKrw = Math.max(FOREIGN_CAPITAL_GAIN_DEDUCTION - baselineGainKrw, 0);

  const candidates: TaxSimCandidate[] = groupForeignStocksByTicker(assetData)
    .map((s) => {
      const { gainKrw, estimated } = computeStockUnrealizedGainKrw(s, rates);
      const gainPerShareKrw = gainKrw / s.quantity;
      // 선택 없음(체크박스 0개) 기준 초기값 — 실제 UI는 다른 선택 종목을 반영해 매 선택마다 다시 계산한다
      const rebuyQuantity = computeRebuyQuantity(gainPerShareKrw, s.quantity, baselineGainKrw);
      return {
        stockId: s.id, name: s.name, quantity: s.quantity,
        gainPerShareKrw, unrealizedGainKrw: gainKrw, estimated, rebuyQuantity,
      };
    })
    .sort((a, b) => a.unrealizedGainKrw - b.unrealizedGainKrw); // 손실(작을수록 음수 큼) 먼저, 이익은 뒤로

  return { baselineGainKrw, baselineEstimated, remainingDeductionKrw, candidates };
}

export interface SelectedSaleInput {
  stockId: string;
  quantity: number; // ≤ 보유수량
}

export interface SelectedSaleSimulation {
  combinedGainKrw: number;
  taxKrw: number;
  baselineTaxKrw: number;
  savingsKrw: number;   // baselineTaxKrw - taxKrw (양수=절감, 음수=오히려 증가)
  estimated: boolean;
}

/**
 * 체크된 종목들을 지정 수량만큼 지금 매도한다고 가정한 합산 시뮬레이션(S-4.31).
 * 부분 수량은 종목 손익을 수량 비례로 선형 계산한다(참고용 추정치).
 */
export function simulateSelectedForeignSale(
  assetData: AssetData,
  selections: readonly SelectedSaleInput[],
  year: number,
  rates: { USD: number; JPY: number },
): SelectedSaleSimulation {
  const realized = computeForeignRealizedGain(assetData, year, rates);
  const baselineGainKrw = realized?.gainKrw ?? 0;
  let estimated = realized?.estimated ?? false;

  const stockById = new Map(groupForeignStocksByTicker(assetData).map((s) => [s.id, s]));
  let selectedGainKrw = 0;
  for (const sel of selections) {
    const stock = stockById.get(sel.stockId);
    if (!stock || sel.quantity <= 0) continue;
    const { gainKrw, estimated: stockEstimated } = computeStockUnrealizedGainKrw(stock, rates);
    if (stockEstimated) estimated = true;
    selectedGainKrw += (gainKrw / stock.quantity) * sel.quantity;
  }

  const combinedGainKrw = baselineGainKrw + selectedGainKrw;
  const baselineTaxKrw = computeForeignTax(baselineGainKrw).taxKrw;
  const taxKrw = computeForeignTax(combinedGainKrw).taxKrw;

  return { combinedGainKrw, taxKrw, baselineTaxKrw, savingsKrw: baselineTaxKrw - taxKrw, estimated };
}

// ─────────────────────────────────────────────
// 항목 조회
// ─────────────────────────────────────────────

export function getEventsForMonth(month: number): readonly TaxEvent[] {
  return TAX_EVENTS_BY_MONTH[month] ?? [];
}

/** 내 보유 태그와 교집합인 항목만 (common 포함 — 캘린더 "내 세금" 필터용) */
export function getMyEvents(events: readonly TaxEvent[], tags: TaxTagReasons): TaxEvent[] {
  return events.filter((e) => e.tags.some((t) => tags.has(t)));
}

export interface TaxEventMatch {
  event: TaxEvent;
  reasons: string[]; // 매칭 근거 문구 (예: ["상가·사무실 1건 보유"])
}

/** KST 기준 오늘 (YYYY-MM-DD) */
function todayKst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
}

/** KST 기준 이번 달 (YYYY-MM) */
function currentMonthKst(): string {
  return todayKst().slice(0, 7);
}

/**
 * 홈 배너용 — 이번 달·다음 달 중 **내 자산에서 파생된** 일정만.
 * 전 국민 공통(common) 태그로만 걸리는 항목은 제외한다(자산과 무관하므로 홈에 띄우지 않는다).
 */
export function getAssetDrivenHighlights(
  assetData: AssetData,
  today: string = todayKst(),
  limit = 3,
): TaxEventMatch[] {
  const tags = resolveTaxTags(assetData);
  const thisMonth = Number(today.slice(5, 7));
  const nextMonth = (thisMonth % 12) + 1;

  const collect = (month: number): TaxEventMatch[] =>
    getEventsForMonth(month)
      .map((event) => {
        // common을 제외한 교집합만 인정
        const matched = event.tags.filter((t) => t !== "common" && tags.has(t));
        return { event, reasons: matched.map((t) => tags.get(t) as string) };
      })
      .filter((m) => m.reasons.length > 0);

  const rank = (m: TaxEventMatch, month: number) =>
    (m.event.severity === "high" ? 0 : 1) * 10 + (month === thisMonth ? 0 : 1);

  return [
    ...collect(thisMonth).map((m) => ({ m, month: thisMonth })),
    ...collect(nextMonth).map((m) => ({ m, month: nextMonth })),
  ]
    .sort((a, b) => rank(a.m, a.month) - rank(b.m, b.month))
    .slice(0, limit)
    .map(({ m }) => m);
}

// ─────────────────────────────────────────────
// 홈 배너 닫기 상태 (월 단위 재노출)
// ─────────────────────────────────────────────
// backup-status.ts와 동일한 "단일 키 + 객체 값" 패턴. 기기 로컬 메타라 동기화 payload에 넣지 않는다.

interface TaxNoticeMeta {
  dismissedMonth?: string; // "YYYY-MM" (KST)
}

function readTaxNoticeMeta(): TaxNoticeMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.taxNotice);
    return raw ? (JSON.parse(raw) as TaxNoticeMeta) : {};
  } catch {
    return {};
  }
}

/** 이번 달에 닫았는지 */
export function isTaxNoticeDismissed(): boolean {
  return readTaxNoticeMeta().dismissedMonth === currentMonthKst();
}

/** 이번 달 동안 미노출로 기록 — 달이 바뀌면 자동으로 다시 노출된다 */
export function markTaxNoticeDismissed(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.taxNotice, JSON.stringify({ dismissedMonth: currentMonthKst() }));
  } catch { /* ignore */ }
}

/** 홈 배너 노출 여부 — 이번 달 미닫힘 && 내 자산에서 파생된 일정이 1건 이상 */
export function shouldShowTaxNotice(assetData: AssetData): boolean {
  if (isTaxNoticeDismissed()) return false;
  return getAssetDrivenHighlights(assetData).length > 0;
}

// 테스트·뷰에서 공용으로 쓰는 날짜 헬퍼
export { todayKst, currentMonthKst };
