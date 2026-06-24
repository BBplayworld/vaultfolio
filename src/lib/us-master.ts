// 미국 종목 마스터 (주식 + ETF) — 영문명→티커 권위 소스
// 데이터: src/lib/data/us-{stock,etf}-master.json (재생성 절차는 같은 폴더 README.md)
import stockMaster from "@/lib/data/us-stock-master.json";
import etfMaster from "@/lib/data/us-etf-master.json";

export interface UsStockEntry {
  ticker: string;
  name: string;
  exchange: string; // NAS | NYS | AMS
}
export interface UsEtfEntry {
  ticker: string;
  name: string; // Fund Name
  assetClass: string;
}

const STOCK = stockMaster as UsStockEntry[];
const ETF = etfMaster as UsEtfEntry[];

// 정규화 — ticker-map.normalizeName과 동일 규칙(괄호·공백·기호 제거, 소문자)
function norm(s: string): string {
  return s
    .replace(/[()（）\s\-·&…]/g, "")
    .replace(/\.+$/, "")
    .toLowerCase();
}

// 전체 유효 티커 (주식+ETF) — 방어 검증용
export const US_TICKERS = new Set<string>([
  ...STOCK.map((e) => e.ticker),
  ...ETF.map((e) => e.ticker),
]);

// 티커 → 이름
export const US_TICKER_TO_NAME: Record<string, string> = {};
for (const e of [...STOCK, ...ETF]) {
  if (!US_TICKER_TO_NAME[e.ticker]) US_TICKER_TO_NAME[e.ticker] = e.name;
}

// 정리명(원본 name) → 티커. 주식 우선, 정규화 충돌(복수클래스 등)은 제외(보수적)
const _nameCount: Record<string, number> = {};
const _nameTicker: Record<string, string> = {};
for (const e of [...STOCK, ...ETF]) {
  if (!e.name) continue;
  const key = norm(e.name);
  if (!key) continue;
  _nameCount[key] = (_nameCount[key] ?? 0) + 1;
  if (!(key in _nameTicker)) _nameTicker[key] = e.ticker; // 주식이 ETF보다 먼저 → 주식 우선
}
// 충돌(2개 이상 다른 티커)인 정규화 키는 제외
export const US_NAME_TO_TICKER: Record<string, string> = {};
for (const e of [...STOCK, ...ETF]) {
  if (!e.name) continue;
  const key = norm(e.name);
  if (!key || _nameCount[key] > 1) continue;
  if (!(e.name in US_NAME_TO_TICKER)) US_NAME_TO_TICKER[e.name] = e.ticker;
}

const EXCHANGE_BY_TICKER: Record<string, string> = {};
for (const e of STOCK) EXCHANGE_BY_TICKER[e.ticker] = e.exchange;

// 미국 주식 거래소(NAS/NYS/AMS). ETF·미발견은 undefined → KIS 순차 폴백
export function getUsExchange(ticker: string): string | undefined {
  return EXCHANGE_BY_TICKER[ticker];
}
