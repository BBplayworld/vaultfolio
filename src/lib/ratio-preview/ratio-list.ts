// 비중 미리보기(/ratio) 결과 계산 순수 함수. 금액은 반환하지 않고 비중(%)·종목 수만 노출한다.
import type { ParsedStock } from "@/lib/asset/screenshot-stock-map";

/** 목록에 개별 표시하는 상위 종목 수 (나머지는 "그 외 N종목") */
export const RATIO_TOP_N = 7;
export const FALLBACK_USD = 1380;
export const FALLBACK_JPY = 930;

export interface RatioRates {
  USD: number;
  /** 100엔당 원화 값 (/api/finance?type=exchange 기준) */
  JPY: number;
}

export interface RatioRow {
  /** 목록 표시 순서의 키 (그 외 행은 "etc") */
  key: string;
  name: string;
  ticker?: string;
  /** 비중 % (소수 1자리, 표시값 합 100.0) */
  pct: number;
  isEtc: boolean;
  /** 그 외 행에 묶인 종목 수 */
  etcCount?: number;
}

export interface RatioSplitItem {
  kind: "domestic" | "foreign" | "other";
  /** 비중 % (소수 1자리, 합 100.0) */
  pct: number;
  /** 인식 전체 기준 종목 수 */
  count: number;
}

export interface RatioResult {
  /** 인식 전체 종목 수 (가격 0 포함) */
  totalCount: number;
  domesticCount: number;
  foreignCount: number;
  otherCount: number;
  /** 가격을 읽지 못해 비중에서 뺀 종목 수 */
  zeroPriceCount: number;
  /** 전 종목 가격 0 → 결과 대신 empty 안내 */
  allZero: boolean;
  rows: RatioRow[];
  /** 평가액 있는 구간만 (0건 구간 생략) */
  split: RatioSplitItem[];
}

/** 평가액(원화 환산). 해외 section은 originalCurrency에 따라 USD/JPY(100엔 단위) 환산 */
export function stockValueKrw(s: Pick<ParsedStock, "section" | "quantity" | "currentPrice" | "originalCurrency">, rates: RatioRates): number {
  const fx =
    s.section === "해외"
      ? s.originalCurrency === "USD"
        ? rates.USD
        : s.originalCurrency === "JPY"
        ? rates.JPY / 100
        : 1
      : 1;
  const v = (s.quantity || 0) * (s.currentPrice || 0) * fx;
  return Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * largest remainder: 값들의 비중을 0.1% 단위 정수(tenths)로 반올림하되 합이 정확히 1000이 되게 한다.
 * 동률이면 원래 값이 큰 쪽, 그다음 입력 순서가 먼저 받는다.
 */
export function largestRemainderTenths(values: number[]): number[] {
  const total = values.reduce((a, b) => a + b, 0);
  if (total <= 0) return values.map(() => 0);
  const raw = values.map((v) => (v / total) * 1000);
  const floors = raw.map((r) => Math.floor(r + 1e-9));
  let remain = 1000 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - floors[i], v: values[i] }))
    .sort((a, b) => b.frac - a.frac || b.v - a.v || a.i - b.i);
  for (const o of order) {
    if (remain <= 0) break;
    floors[o.i] += 1;
    remain -= 1;
  }
  return floors;
}

export function buildRatioList(raw: ParsedStock[], rates: RatioRates): RatioResult {
  const items = raw.map((s, i) => ({ s, i, value: stockValueKrw(s, rates) }));
  const priced = items.filter((x) => x.value > 0);

  const count = (sec: ParsedStock["section"]) => raw.filter((s) => s.section === sec).length;
  const base = {
    totalCount: raw.length,
    domesticCount: count("국내"),
    foreignCount: count("해외"),
    otherCount: count("기타"),
    zeroPriceCount: raw.length - priced.length,
  };
  if (priced.length === 0) return { ...base, allZero: true, rows: [], split: [] };

  // 목록: 평가액 내림차순(동률은 인식 순서), 상위 N + 그 외
  const sorted = [...priced].sort((a, b) => b.value - a.value || a.i - b.i);
  const top = sorted.slice(0, RATIO_TOP_N);
  const rest = sorted.slice(RATIO_TOP_N);
  const groups = [...top.map((x) => x.value), ...(rest.length > 0 ? [rest.reduce((a, x) => a + x.value, 0)] : [])];
  const tenths = largestRemainderTenths(groups);
  const rows: RatioRow[] = top.map((x, k) => ({
    key: String(x.i),
    name: x.s.name,
    ticker: x.s.ticker || undefined,
    pct: tenths[k] / 10,
    isEtc: false,
  }));
  if (rest.length > 0) {
    rows.push({ key: "etc", name: `그 외 ${rest.length}종목`, pct: tenths[top.length] / 10, isEtc: true, etcCount: rest.length });
  }

  // 국내/해외/기타 막대: 평가액이 있는 구간만
  const kinds = [
    { kind: "domestic" as const, sec: "국내" as const },
    { kind: "foreign" as const, sec: "해외" as const },
    { kind: "other" as const, sec: "기타" as const },
  ];
  const segs = kinds
    .map((k) => ({ kind: k.kind, count: count(k.sec), value: priced.filter((x) => x.s.section === k.sec).reduce((a, x) => a + x.value, 0) }))
    .filter((g) => g.value > 0);
  const segTenths = largestRemainderTenths(segs.map((g) => g.value));
  const split: RatioSplitItem[] = segs.map((g, k) => ({ kind: g.kind, pct: segTenths[k] / 10, count: g.count }));

  return { ...base, allZero: false, rows, split };
}
