/**
 * B2(5.142): 투자 탭 세 지수 보기 머리 1줄 `내 주식 국내 x%·해외 y%`의 값.
 * 주식 X-Ray 지역 축과 같은 계산(groupStocksByTicker → mergeStockGroup → computeBreakdown("region")·formatBreakdownPct)이고,
 * 100에서 빼서 만들지 않는다: 국내 = `한국`, 해외 = 미국·일본·중국·홍콩 비중의 합, 기타 = `기타`(있을 때만).
 * 분류 캐시(localStorage) 읽기만 하며 네트워크·저장·GA 0. 보유 주식이 없으면 null.
 */
import type { Stock } from "@/types/asset";
import type { ExchangeRates } from "@/lib/finance/finance-service";
import { groupStocksByTicker, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { computeBreakdown, formatBreakdownPct } from "./stock-xray";

export interface RegionSplit { domestic: number; overseas: number; other: number }

export function regionSplit(stocks: Stock[], rates: ExchangeRates | undefined): RegionSplit | null {
  const merged = Array.from(groupStocksByTicker(stocks).values()).map((g) => mergeStockGroup(g));
  const r = computeBreakdown("region", merged, rates);
  if (!(r.total > 0)) return null;
  let kr = 0, other = 0, abroad = 0;
  for (const it of r.items) {
    if (it.key === "KR") kr += it.ratio;
    else if (it.key === "Other") other += it.ratio;
    else abroad += it.ratio;
  }
  return { domestic: formatBreakdownPct(kr), overseas: formatBreakdownPct(abroad), other: formatBreakdownPct(other) };
}
