/**
 * 주식 X-Ray 계산 — 통화/지역/테마/시가총액/지수 축 분포
 *
 * - share 모드: 한 종목이 단일 키에만 속함 (예: 통화, 지역, 시가총액). 합 = 100%.
 * - exposure 모드: 한 종목이 여러 키에 동시 노출(테마·지수). 합 > 100% 가능. "노출 비중".
 */

import { Stock } from "@/types/asset";
import { ExchangeRates } from "@/lib/finance-service";
import { getClassification } from "./classification-store";

export type XrayAxis = "currency" | "region" | "theme" | "marketCap" | "index";
export type AggregationMode = "share" | "exposure";

export interface BreakdownItem {
  key: string;
  label: string;
  value: number;      // 원화 환산 평가금액 합계
  ratio: number;      // 0~1 (exposure 모드에선 1 초과 가능)
  tickers: string[];  // 해당 버킷에 기여한 종목 ticker (가치 내림차순)
  contributions: Array<{ ticker: string; name: string; value: number }>;
}

export type ConcentrationLevel = "high" | "medium" | "low";

export interface BreakdownResult {
  axis: XrayAxis;
  mode: AggregationMode;
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
// 축별 키 추출 — share(단일) / exposure(다중) 구분
// ─────────────────────────────────────────────

type SingleExtractor = (stock: Stock) => { key: string; label: string };
type MultiExtractor = (stock: Stock) => Array<{ key: string; label: string }>;

const CURRENCY_LABEL: Record<string, string> = { KRW: "원화 (KRW)", USD: "달러 (USD)", JPY: "엔화 (JPY)" };
const extractCurrency: SingleExtractor = (s) => {
  const k = s.currency || "KRW";
  return { key: k, label: CURRENCY_LABEL[k] ?? k };
};

const REGION_LABEL: Record<string, string> = { KR: "한국", US: "미국", JP: "일본", CN: "중국", HK: "홍콩", Other: "기타" };
const extractRegion: SingleExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  if (cls?.region) return { key: cls.region, label: REGION_LABEL[cls.region] ?? cls.region };
  if (s.category === "foreign") {
    if (s.currency === "JPY") return { key: "JP", label: REGION_LABEL.JP };
    return { key: "US", label: REGION_LABEL.US };
  }
  return { key: "KR", label: REGION_LABEL.KR };
};

const CAP_LABEL: Record<string, string> = { large: "대형주", mid: "중형주", small: "소형주", unknown: "미분류" };
const extractMarketCap: SingleExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const tier = cls?.marketCapTier ?? "unknown";
  if (tier === "unknown") return { key: UNCLASSIFIED_KEY, label: UNCLASSIFIED_LABEL };
  return { key: tier, label: CAP_LABEL[tier] ?? tier };
};

const extractThemes: MultiExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const themes = Array.isArray(cls?.themes) ? cls!.themes! : [];
  if (themes.length === 0) return [{ key: UNCLASSIFIED_KEY, label: UNCLASSIFIED_LABEL }];
  return themes.map((t) => ({ key: t, label: t }));
};

const extractIndices: MultiExtractor = (s) => {
  const cls = s.ticker ? getClassification(s.ticker) : undefined;
  const idx = Array.isArray(cls?.indices) ? cls!.indices! : [];
  if (idx.length === 0) return [{ key: UNCLASSIFIED_KEY, label: UNCLASSIFIED_LABEL }];
  return idx.map((v) => ({ key: v, label: v }));
};

const SHARE_AXES: Record<Extract<XrayAxis, "currency" | "region" | "marketCap">, SingleExtractor> = {
  currency: extractCurrency,
  region: extractRegion,
  marketCap: extractMarketCap,
};

const EXPOSURE_AXES: Record<Extract<XrayAxis, "theme" | "index">, MultiExtractor> = {
  theme: extractThemes,
  index: extractIndices,
};

function axisMode(axis: XrayAxis): AggregationMode {
  return axis === "theme" || axis === "index" ? "exposure" : "share";
}

// ─────────────────────────────────────────────
// 공통 집계
// ─────────────────────────────────────────────

export function computeBreakdown(
  axis: XrayAxis,
  stocks: Stock[],
  exchangeRates?: ExchangeRates,
): BreakdownResult {
  const mode = axisMode(axis);
  const buckets = new Map<string, BreakdownItem>();
  let total = 0;
  let unclassifiedValue = 0;

  function addContribution(key: string, label: string, s: Stock, v: number) {
    const cur = buckets.get(key);
    const contrib = { ticker: (s.ticker || s.name).toUpperCase(), name: s.name, value: v };
    if (cur) {
      cur.value += v;
      cur.contributions.push(contrib);
    } else {
      buckets.set(key, { key, label, value: v, ratio: 0, tickers: [], contributions: [contrib] });
    }
  }

  if (mode === "share") {
    const extract = SHARE_AXES[axis as keyof typeof SHARE_AXES];
    for (const s of stocks) {
      const v = valueOf(s, exchangeRates);
      if (v <= 0) continue;
      total += v;
      const { key, label } = extract(s);
      if (key === UNCLASSIFIED_KEY) unclassifiedValue += v;
      addContribution(key, label, s, v);
    }
  } else {
    // exposure: 종목 1개 → 다수 키에 각각 풀가중치
    const extract = EXPOSURE_AXES[axis as keyof typeof EXPOSURE_AXES];
    for (const s of stocks) {
      const v = valueOf(s, exchangeRates);
      if (v <= 0) continue;
      total += v;
      const keys = extract(s);
      const onlyUnclassified = keys.length === 1 && keys[0].key === UNCLASSIFIED_KEY;
      if (onlyUnclassified) unclassifiedValue += v;
      for (const { key, label } of keys) {
        addContribution(key, label, s, v);
      }
    }
  }

  const items = Array.from(buckets.values()).map((it) => {
    it.contributions.sort((a, b) => b.value - a.value);
    return {
      ...it,
      ratio: total > 0 ? it.value / total : 0,
      tickers: it.contributions.map((c) => c.ticker),
    };
  });
  items.sort((a, b) => b.value - a.value);

  const topShare = items[0]?.ratio ?? 0;
  return {
    axis,
    mode,
    items,
    total,
    topShare,
    concentration: classifyConcentration(topShare > 1 ? 1 : topShare),
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
