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
const isForeignStock = (s: Stock): boolean => s.category === "foreign" || s.currency !== "KRW";

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
