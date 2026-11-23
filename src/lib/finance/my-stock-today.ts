// #246 홈 '내 종목 오늘' 1줄 — 상세·주식 `전체` 행(같은 티커 묶음)의 '오늘' 칩 값 중
// 원화 등락 기여(등락 × 수량 × 현재 환율) 절대값이 가장 큰 1행을 고른다. 화면에는 그 행의 칩 %만 보인다.
// 계산은 computeTodayChip·todayChipLabel·rateTenths·formatCompareRate 호출뿐(새 계산·새 반올림 0).
// 기여 금액은 고르기에만 쓰고 화면·접근성 이름·GA·서버 어디에도 내보내지 않는다.
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { Stock } from "@/types/asset";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { computeTodayChip, todayChipLabel, type TodayChipResult } from "@/lib/finance/today-chip";
import { formatCompareRate, rateTenths } from "@/lib/finance/market-compare";
import { getMultiplier, groupStocksByTicker, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";

// 상세·주식(stock-tab useFilteredStockData)·saveSnapshots와 같은 티커 목록 → 같은 캐시 키·같은 queryKey
export function myStockTickerList(stocks: Stock[]): string {
  const withTicker = stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.currentPrice > 0 && s.inactiveStatus !== "delisted");
  return Array.from(new Set(withTicker.map((s) => normalizeTicker(s)).filter(Boolean))).sort().join(",");
}

// 상세·주식 `오늘` 칩과 같은 queryKey(#134) — 새 캐시 키 0
export const myStockQueryKey = (tickerList: string) => ["profit", "daily", "kstAccessDay", tickerList] as const;

export interface MyStockRow {
  name: string;
  chip: TodayChipResult | null;
  value: number; // 원화 평가금(동률 2단)
}

// 상세·주식 `전체` 행과 같은 묶음: 평가금 큰 순 정렬 → t:티커 묶음 → 대표 이름은 묶음 첫 항목(행 이름과 같음)
export function buildMyStockRows(
  stocks: Stock[],
  refData: ProfitRefResponse | undefined,
  rates: { USD: number; JPY: number },
  now: Date = new Date(),
): MyStockRow[] {
  const val = (s: Stock) => s.quantity * s.currentPrice * getMultiplier(s.currency, rates);
  const sorted = [...stocks].sort((a, b) => val(b) - val(a));
  const rows: MyStockRow[] = [];
  for (const items of groupStocksByTicker(sorted).values()) {
    const merged = mergeStockGroup(items);
    rows.push({ name: merged.name, chip: computeTodayChip(items, refData, rates, now), value: val(merged) });
  }
  return rows;
}

export interface MyStockPick {
  name: string;
  label: string; // `오늘` / `M/D 종가` (행 칩과 같은 라벨)
  rateText: string; // `+3.2%` / `-4.1%` (지수 줄과 같은 꼴, ASCII -)
  sign: "up" | "down";
  rate: number; // 손익색 판정용
  more: number; // 칩 값이 있는 나머지 행 수(0.0% 행 포함)
}

// 고르기: 칩이 있고 보이는 값이 0.0%가 아닌 행 중 |원화 기여| 최대. 동률(원 단위) → |보이는 등락률| → 평가금. 후보 0이면 null
export function pickMyStockToday(rows: MyStockRow[]): MyStockPick | null {
  const withChip = rows.filter((r): r is MyStockRow & { chip: TodayChipResult } => r.chip !== null && Number.isFinite(r.chip.rate));
  let best: (MyStockRow & { chip: TodayChipResult }) | null = null;
  for (const r of withChip) {
    if (rateTenths(r.chip.rate) === 0) continue;
    if (!best) { best = r; continue; }
    const d = Math.round(Math.abs(r.chip.krwChange)) - Math.round(Math.abs(best.chip.krwChange));
    const t = Math.abs(rateTenths(r.chip.rate)) - Math.abs(rateTenths(best.chip.rate));
    if (d > 0 || (d === 0 && (t > 0 || (t === 0 && r.value > best.value)))) best = r;
  }
  if (!best) return null;
  const tenths = rateTenths(best.chip.rate);
  return {
    name: best.name,
    label: todayChipLabel(best.chip, "row"),
    rateText: formatCompareRate(best.chip.rate),
    sign: tenths > 0 ? "up" : "down",
    rate: best.chip.rate,
    more: withChip.length - 1,
  };
}

export type MyStockLineState = "off" | "pending" | "on";

// 줄 상태 — 입력에 홈 팁 값이 없다(#245 팁과 무관, CEO 디자인 판정 ①). pending은 종가쌍 조회가 실제로 도는 동안만
export function myStockLineState(i: {
  screenshotMode?: boolean;
  hasHeaderChange: boolean; // 첫 저장 당일이면 false(지수 줄과 같은 조건)
  hasTickerStock: boolean; // 조회 대상 종목(티커 목록) 있음
  fetching: boolean; // 결과 없이 조회 진행 중
  picked: MyStockPick | null;
}): MyStockLineState {
  if (i.screenshotMode || !i.hasHeaderChange || !i.hasTickerStock) return "off";
  if (i.picked) return "on";
  return i.fetching ? "pending" : "off";
}

export const myStockText = (p: MyStockPick) => `${p.name} ${p.label} ${p.rateText}${p.more > 0 ? ` · 외 ${p.more}종목` : ""}`;
export const myStockAriaLabel = (p: MyStockPick) => `내 종목 보기, ${p.name} ${p.label} ${p.rateText}${p.more > 0 ? `, 외 ${p.more}종목` : ""}`;
