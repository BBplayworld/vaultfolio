// 주식 스크린샷 파싱 응답(`/api/parse-screenshot`) → 등록용 ImportStock 매핑 순수 함수.
// 앱 내 업로드 경로와 비중 미리보기 인계 경로(#63)가 함께 쓴다.
import type { Stock } from "@/types/asset";
import { matchBrokerHint } from "@/config/asset-options";

export type ImportStock = Omit<Stock, "id"> & {
  id: string;
  section: "국내" | "해외" | "기타";
  selected: boolean;
  tickerInput?: string;
  originalCurrency?: "KRW" | "USD" | "JPY";
  broker?: string;
};

/** 파싱 응답의 종목 1건 (서버 원본) */
export type ParsedStock = Stock & { section: "국내" | "해외" | "기타"; brokerHint?: string };

export const DOMESTIC_CATEGORIES = new Set(["domestic", "isa", "irp", "pension", "unlisted"]);
export const BROKER_NONE = "__none__";

// 카테고리 변경에 따른 가격/통화 환산 (foreign↔domestic). 공통·개별 모드 공용.
export function convertStockCategory(stock: ImportStock, category: Stock["category"], usdRate: number): ImportStock {
  const wasForeign = stock.category === "foreign";
  const becomeForeign = category === "foreign";
  if (!wasForeign && becomeForeign) {
    return {
      ...stock, category,
      currentPrice: Math.round((stock.currentPrice / usdRate) * 10000) / 10000,
      averagePrice: Math.round((stock.averagePrice / usdRate) * 10000) / 10000,
      originalCurrency: "USD" as const,
    };
  }
  if (wasForeign && !becomeForeign) {
    const aiSawUSD = stock.originalCurrency === "USD";
    if (aiSawUSD) {
      return {
        ...stock, category,
        currentPrice: Math.round(stock.currentPrice * usdRate),
        averagePrice: Math.round(stock.averagePrice * usdRate),
        originalCurrency: "KRW" as const,
      };
    }
    return { ...stock, category, originalCurrency: "KRW" as const };
  }
  return { ...stock, category };
}

/** 공통 모드 일괄 적용: 전 종목에 카테고리 변환 + 증권사 지정 */
export function applyCommonDefaults(
  stocks: ImportStock[],
  defaultCategory: Stock["category"],
  defaultBroker: string,
  usdRate: number,
): ImportStock[] {
  const broker = defaultBroker === BROKER_NONE ? undefined : defaultBroker;
  return stocks.map((s) => ({ ...convertStockCategory(s, defaultCategory, usdRate), broker }));
}

/** 국내(또는 기타)와 해외 section이 한 결과에 함께 있는지 */
export function isMixedSections(raw: { section: ParsedStock["section"] }[]): boolean {
  const hasForeign = raw.some((s) => s.section === "해외");
  const hasLocal = raw.some((s) => s.section !== "해외");
  return hasForeign && hasLocal;
}

/**
 * 응답 → ImportStock 매핑. 공통 일괄 변환은 하지 않는다(호출자가 모드에 따라 applyCommonDefaults 적용).
 * defaultCategory: 해외 과반이면 foreign, 아니면 국내계열 activeTab/domestic.
 */
export function mapParsedStocks(
  raw: ParsedStock[],
  { activeTab }: { activeTab?: string; usdRate?: number },
): { stocks: ImportStock[]; defaultCategory: Stock["category"]; defaultBroker: string; isMixed: boolean } {
  // 동일 ticker:category 그룹 내 순서 카운터 (broker 기본값 지정용)
  const groupIndex = new Map<string, number>();

  const stocks: ImportStock[] = raw.map((s) => {
    const resolvedCategory: Stock["category"] =
      s.section === "해외"
        ? "foreign"
        : activeTab && DOMESTIC_CATEGORIES.has(activeTab)
        ? (activeTab as Stock["category"])
        : s.category;

    const groupKey = `${s.ticker || s.name}:${resolvedCategory}`;
    const idx = (groupIndex.get(groupKey) ?? 0) + 1;
    groupIndex.set(groupKey, idx);

    // broker 자동 설정: brokerHint 매칭 우선, 없으면 동일 그룹 2번째부터 "항목 N"
    const matchedBroker = matchBrokerHint(s.brokerHint ?? "");
    const broker = matchedBroker ?? (idx > 1 ? `항목 ${idx}` : undefined);

    return { ...s, category: resolvedCategory, selected: true, broker };
  });

  const foreignCount = stocks.filter((s) => s.category === "foreign").length;
  const defaultCategory: Stock["category"] =
    foreignCount * 2 > stocks.length
      ? "foreign"
      : activeTab && DOMESTIC_CATEGORIES.has(activeTab)
      ? (activeTab as Stock["category"])
      : "domestic";
  const defaultBroker = matchBrokerHint(raw[0]?.brokerHint ?? "") ?? BROKER_NONE;

  return { stocks, defaultCategory, defaultBroker, isMixed: isMixedSections(raw) };
}
