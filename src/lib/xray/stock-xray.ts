/**
 * 주식 X-Ray 계산 — 통화/지역/테마/시가총액/지수 축 분포
 *
 * - 모든 축은 한 종목이 단일 키에만 속하도록 집계(중복 포함 없음). 합 = 100%.
 */

import { Stock } from "@/types/asset";
import { ExchangeRates } from "@/lib/finance-service";
import { getClassification } from "./classification-store";

export type XrayAxis = "region" | "theme" | "marketCap" | "index" | "currency";

export interface BreakdownItem {
  key: string;
  label: string;
  value: number;      // 원화 환산 평가금액 합계
  ratio: number;      // 0~1
  tickers: string[];  // 해당 버킷에 기여한 종목 ticker (가치 내림차순)
  contributions: Array<{ ticker: string; name: string; value: number; displayLabel: string }>;
  topThemes?: string[]; // theme(sector) 축 한정 — 버킷 종목들의 themes 빈도·가치 가중 상위 (최대 4)
}

export type ConcentrationLevel = "high" | "medium" | "low";

export interface BreakdownResult {
  axis: XrayAxis;
  items: BreakdownItem[];
  total: number;
  topShare: number;
  concentration: ConcentrationLevel;
  unclassifiedRatio: number;
}

const UNCLASSIFIED_KEY = "unclassified";
const UNCLASSIFIED_LABEL = "미분류";

function classifyConcentration(topShare: number): ConcentrationLevel {
  if (topShare >= 0.6) return "high";
  if (topShare >= 0.35) return "medium";
  return "low";
}

function getMultiplier(currency: string | undefined, rates: ExchangeRates | undefined): number {
  if (!rates) return 1;
  if (currency === "USD") return rates.USD;
  if (currency === "JPY") return rates.JPY / 100;
  return 1;
}

function valueOf(stock: Stock, rates: ExchangeRates | undefined): number {
  if (stock.inactiveStatus === "delisted") return 0;
  const m = getMultiplier(stock.currency, rates);
  return stock.quantity * stock.currentPrice * m;
}

// ─────────────────────────────────────────────
// 축별 키 추출 — 모든 축 단일 배정
// ─────────────────────────────────────────────

type SingleExtractor = (stock: Stock) => { key: string; label: string };

const REGION_LABEL: Record<string, string> = {
  KR: "한국",
  US: "미국",
  JP: "일본",
  CN: "중국",
  HK: "홍콩",
  Other: "기타",
};

const extractRegion: SingleExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  
  // 1) 국내 ETF 중 해외 지수를 추종하는 상품은 명칭 기반으로 지역 판정 (이전의 잘못된 캐시 region: "KR"을 덮어쓰기 위해 최우선 실행)
  const name = s.name || "";
  const upper = name.toUpperCase();
  const isKrEtf = cls?.marketCapTier === "etf" || KR_ETF_BRANDS.some((b) => upper.startsWith(b)) || upper.includes("ETF");
  if (isKrEtf) {
    if (upper.includes("미국") || upper.includes("US") || upper.includes("S&P500") || upper.includes("나스닥") || upper.includes("NASDAQ") || upper.includes("SP500")) {
      return { key: "US", label: REGION_LABEL["US"] };
    }
    if (upper.includes("일본") || upper.includes("니케이") || upper.includes("TOPIX") || upper.includes("NIKKEI")) {
      return { key: "JP", label: REGION_LABEL["JP"] };
    }
    if (upper.includes("중국") || upper.includes("차이나") || upper.includes("항셍") || upper.includes("홍콩") || upper.includes("HSCEI") || upper.includes("CSI")) {
      if (upper.includes("홍콩") || upper.includes("항셍")) {
        return { key: "HK", label: REGION_LABEL["HK"] };
      }
      return { key: "CN", label: REGION_LABEL["CN"] };
    }
    if (upper.includes("유럽") || upper.includes("유로") || upper.includes("EURO")) {
      return { key: "Other", label: REGION_LABEL["Other"] };
    }
    if (upper.includes("인도") || upper.includes("NIFTY")) {
      return { key: "Other", label: REGION_LABEL["Other"] };
    }
  }

  // 2) 분류 정보에 지역이 있으면 반영 (개별주 및 해외 직접투자)
  if (cls?.region) {
    return { key: cls.region, label: REGION_LABEL[cls.region] ?? cls.region };
  }

  // 3) 해외 직접투자는 통화에 따라 US/JP 분류
  if (s.category === "foreign") {
    const reg = s.currency === "JPY" ? "JP" : "US";
    return { key: reg, label: REGION_LABEL[reg] ?? reg };
  }

  // 4) 기본값 한국
  return { key: "KR", label: REGION_LABEL["KR"] };
};

const CURRENCY_LABEL: Record<string, string> = {
  KRW: "원화 (KRW)",
  USD: "달러 (USD)",
  JPY: "엔화 (JPY)",
  CNY: "위안화 (CNY)",
  HKD: "홍콩달러 (HKD)",
  Other: "기타 통화",
};

const extractCurrency: SingleExtractor = (s) => {
  // 국내 거래소 상장 자산(국내상장 해외 ETF 포함)은 원화(KRW)로 분류
  const isDomestic = s.category === "domestic" || s.category === "irp" || s.category === "isa" || s.category === "pension";
  if (isDomestic) {
    return { key: "KRW", label: CURRENCY_LABEL["KRW"] };
  }
  // 해외 직접 투자 주식만 해당 통화(달러, 엔화 등)로 분류
  const cur = s.currency || "USD";
  return { key: cur, label: CURRENCY_LABEL[cur] ?? cur };
};

const CAP_LABEL: Record<string, string> = { large: "대형주", mid: "중형주", small: "소형주", etf: "ETF/펀드", unknown: "미분류" };
const extractMarketCap: SingleExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const tier = cls?.marketCapTier ?? "unknown";
  if (tier === "unknown") return { key: UNCLASSIFIED_KEY, label: UNCLASSIFIED_LABEL };
  return { key: tier, label: CAP_LABEL[tier] ?? tier };
};

const extractSector: SingleExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const sector = typeof cls?.sector === "string" && cls.sector.length > 0 ? cls.sector : undefined;
  if (!sector) return { key: UNCLASSIFIED_KEY, label: UNCLASSIFIED_LABEL };
  return { key: sector, label: sector };
};

// 원시 지수 문자열 → 핵심 지수 정규화 (코스피/코스닥/나스닥100/S&P500/그 외). 미인식은 null.
function canonicalIndex(raw: string): { key: string; label: string } | null {
  const t = raw.trim();
  if (!t) return null;
  const u = t.toUpperCase();
  const norm = u.replace(/[^A-Z0-9]/g, "");
  if (u.includes("KOSDAQ") || t.includes("코스닥")) return { key: "KOSDAQ", label: "코스닥" };
  if (u.includes("KOSPI") || t.includes("코스피")) return { key: "KOSPI", label: "코스피" };
  if (u.includes("NASDAQ") || t.includes("나스닥")) return { key: "NASDAQ100", label: "NASDAQ 100" };
  if (norm.includes("SP500") || u.includes("S&P 500") || t.includes("S&P 500")) return { key: "SP500", label: "S&P 500" };
  return null;
}

// 한 종목이 여러 지수에 속하면 우선순위로 단일 배정(중복 포함 없음)
const INDEX_PRIORITY = ["KOSPI", "KOSDAQ", "NASDAQ100", "SP500", "OTHER"];
const OTHER_INDEX = { key: "OTHER", label: "그 외 핵심 지수" };

// 국내 ETF 브랜드 접두어 (stock-tab.tsx ETF_DOMAIN 키와 동기화)
const KR_ETF_BRANDS = ["TIGER", "KODEX", "ACE", "KBSTAR", "SOL", "RISE", "PLUS", "ARIRANG", "KOSEF", "HANARO", "KINDEX", "TIMEFOLIO", "BIG"];
// 해외(미국 등) 시장 키워드 — 구체 지수 미매칭 시 "그 외 핵심 지수"로
const FOREIGN_NAME_KEYS = ["미국", "US", "선진", "신흥", "유럽", "중국", "일본", "인도", "글로벌", "베트남", "대만", "홍콩", "다우", "DOW", "러셀", "RUSSELL", "나스닥종합"];

// 국내 ETF는 상장거래소(KOSPI)가 아니라 '추종 지수' 기준으로 종목명에서 판정.
// 캐시된 분류(상장거래소 KOSPI 포함)까지 즉시 교정. 추종 지수 미상이면 null(폴백).
function indexFromEtfName(s: Stock): { key: string; label: string } | null {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const name = s.name || "";
  const upper = name.toUpperCase();
  const isKrEtf = cls?.marketCapTier === "etf" || KR_ETF_BRANDS.some((b) => upper.startsWith(b)) || upper.includes("ETF");
  if (!isKrEtf) return null;

  const norm = upper.replace(/[^A-Z0-9]/g, "");
  if (norm.includes("SP500") || upper.includes("S&P 500") || name.includes("S&P500")) return { key: "SP500", label: "S&P 500" };
  if (upper.includes("NASDAQ") || name.includes("나스닥")) return { key: "NASDAQ100", label: "NASDAQ 100" };
  if (upper.includes("KOSDAQ") || name.includes("코스닥")) return { key: "KOSDAQ", label: "코스닥" };
  if (upper.includes("KOSPI") || name.includes("코스피")) return { key: "KOSPI", label: "코스피" };

  // 미국/US 관련 주식형 테마/액티브 ETF 판별 (채권/원자재 포함하더라도 명칭에 미국/US가 있으면 우선 분류)
  const isUsRelated = upper.includes("미국") || upper.includes("US") || cls?.region === "US";
  if (isUsRelated) {
    const isTechGrowth = [
      "반도체", "테크", "TECH", "빅테크", "AI", "소프트웨어", "SOFTWARE", 
      "필라델피아", "SOX", "SOXX", "SOXL", "혁신", "성장", "IT", "FANG"
    ].some(k => upper.includes(k));

    if (isTechGrowth) {
      return { key: "NASDAQ100", label: "NASDAQ 100" };
    } else {
      return { key: "SP500", label: "S&P 500" };
    }
  }

  if (FOREIGN_NAME_KEYS.some((k) => upper.includes(k))) return OTHER_INDEX;
  return null; // 국내 테마(2차전지·반도체 등) → 폴백(상장거래소)
}

const extractIndex: SingleExtractor = (s) => {
  // 1) 국내 ETF는 종목명 추종지수 우선 판정
  const byName = indexFromEtfName(s);
  if (byName) return byName;

  // 2) 분류 indices 기반 (개별주·해외 종목·추종지수 미상 ETF)
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const idx = Array.isArray(cls?.indices) ? cls!.indices! : [];
  
  const isUsStock = cls?.region === "US" || 
                    (s.category === "foreign" && s.currency === "USD") ||
                    (s.name || "").toUpperCase().includes("미국") ||
                    (s.name || "").toUpperCase().includes("US");

  let best: { key: string; label: string } | null = null;
  let bestRank = Infinity;
  for (const raw of idx) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    let c = canonicalIndex(raw);

    // 미국 주식/ETF인 경우, 매칭되지 않은 특수 지수명이 존재할 때 NASDAQ 100 / S&P 500으로 유추 배정
    if (!c && isUsStock) {
      const rawUpper = raw.toUpperCase();
      const isTechGrowth = [
        "SEMICONDUCTOR", "SOX", "TECH", "DIGITAL", "AI", "SOFTWARE", "INNOVATION", "GROWTH", "NASDAQ"
      ].some(k => rawUpper.includes(k));

      c = isTechGrowth ? { key: "NASDAQ100", label: "NASDAQ 100" } : { key: "SP500", label: "S&P 500" };
    }

    if (!c) {
      c = OTHER_INDEX;
    }

    const rank = INDEX_PRIORITY.indexOf(c.key);
    if (rank < bestRank) { bestRank = rank; best = c; }
  }
  if (!best) return { key: UNCLASSIFIED_KEY, label: UNCLASSIFIED_LABEL };
  return best;
};

const SHARE_AXES: Record<XrayAxis, SingleExtractor> = {
  region: extractRegion,
  marketCap: extractMarketCap,
  theme: extractSector,
  index: extractIndex,
  currency: extractCurrency,
};

// ─────────────────────────────────────────────
// 공통 집계
// ─────────────────────────────────────────────

export function computeBreakdown(
  axis: XrayAxis,
  stocks: Stock[],
  exchangeRates?: ExchangeRates,
): BreakdownResult {
  const buckets = new Map<string, BreakdownItem>();
  let total = 0;
  let unclassifiedValue = 0;

  // theme(sector) 축에서만 사용: 버킷별 themes 가중 누적 (key→ themes Map<theme, value>)
  const themeWeights = new Map<string, Map<string, number>>();

  function addContribution(key: string, label: string, s: Stock, v: number) {
    const cur = buckets.get(key);
    const tickerUpper = (s.ticker || s.name).toUpperCase();
    // 국내(주식·ETF)는 한글 종목명, 해외는 ticker로 표기 — 티커 정규식 대신 카테고리 기준(접미사 붙은 국내 ETF 오판 방지)
    const isDomestic = s.category === "domestic" || s.category === "irp" || s.category === "isa" || s.category === "pension";
    const displayLabel = isDomestic ? s.name : tickerUpper;
    const contrib = { ticker: tickerUpper, name: s.name, value: v, displayLabel };
    if (cur) {
      cur.value += v;
      cur.contributions.push(contrib);
    } else {
      buckets.set(key, { key, label, value: v, ratio: 0, tickers: [], contributions: [contrib] });
    }
    if (axis === "theme") {
      const cls = s.ticker ? getClassification(s.ticker) : undefined;
      const themes = Array.isArray(cls?.themes) ? cls!.themes! : [];
      if (themes.length > 0) {
        let bag = themeWeights.get(key);
        if (!bag) { bag = new Map(); themeWeights.set(key, bag); }
        for (const t of themes) {
          if (typeof t !== "string" || !t) continue;
          bag.set(t, (bag.get(t) ?? 0) + v);
        }
      }
    }
  }

  const extract = SHARE_AXES[axis];
  for (const s of stocks) {
    const v = valueOf(s, exchangeRates);
    if (v <= 0) continue;
    total += v;
    const { key, label } = extract(s);
    if (key === UNCLASSIFIED_KEY) unclassifiedValue += v;
    addContribution(key, label, s, v);
  }

  const items = Array.from(buckets.values()).map((it) => {
    it.contributions.sort((a, b) => b.value - a.value);
    const bag = themeWeights.get(it.key);
    const topThemes = bag
      ? Array.from(bag.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([t]) => t)
      : undefined;
    return {
      ...it,
      ratio: total > 0 ? it.value / total : 0,
      tickers: it.contributions.map((c) => c.ticker),
      topThemes,
    };
  });
  items.sort((a, b) => b.value - a.value);

  const topShare = items[0]?.ratio ?? 0;
  return {
    axis,
    items,
    total,
    topShare,
    concentration: classifyConcentration(topShare),
    unclassifiedRatio: total > 0 ? unclassifiedValue / total : 0,
  };
}

// 인사이트 스트립용 한 줄 요약 후보 추출
export interface InsightHighlight {
  axis: XrayAxis;
  label: string;
  ratio: number;
  concentration: ConcentrationLevel;
}

export function pickHighlights(
  stocks: Stock[],
  exchangeRates: ExchangeRates | undefined,
  axes: XrayAxis[] = ["theme", "region", "marketCap", "index", "currency"],
  limit = 2,
): InsightHighlight[] {
  const results: InsightHighlight[] = [];
  for (const axis of axes) {
    const br = computeBreakdown(axis, stocks, exchangeRates);
    const top = br.items[0];
    if (!top || top.key === UNCLASSIFIED_KEY) continue;
    results.push({
      axis,
      label: `${top.label} ${Math.round(top.ratio * 100)}%`,
      ratio: top.ratio,
      concentration: br.concentration,
    });
  }
  results.sort((a, b) => b.ratio - a.ratio);
  return results.slice(0, limit);
}
