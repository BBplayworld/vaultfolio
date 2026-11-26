// 상세·암호화폐 거래소별 합계(#325, 5.163) — 순수 함수(저장·React·서버 호출 없음). broker-totals의 얇은 래퍼.
// 모집단은 요약 헤더(getAssetSummary().cryptoValue·cryptoProfit)와 같다: 수량>0 전체(목록의 value>0 필터를 쓰지 않는다).
// 화면 문자열의 합 = 헤더 문자열(C150): 원 단위로 반올림한 뒤 apportionUnits로 헤더 표시값에 맞춘다.
import type { Crypto } from "@/types/asset";
import { cryptoExchanges } from "@/config/asset-options";
import { isUnassignedBroker } from "@/lib/asset/resync/match";
import { largestRemainderTenths } from "@/lib/ratio-preview/ratio-list";
import { apportionUnits, type BrokerTotalRow } from "@/lib/asset/broker-totals";

export const UNASSIGNED_EXCHANGE_LABEL = "거래소 미지정";

const squash = (s: string) => s.replace(/\s/g, "");

/** 공백·대소문자를 뺀 값이 거래소 목록의 라벨이나 value와 완전히 같으면 목록 라벨. 부분 일치는 쓰지 않는다(`코인` ≠ `코인원`) */
export function exactExchangeLabel(raw: string): string | undefined {
  const h = squash(raw).toLowerCase();
  if (!h) return undefined;
  return cryptoExchanges.find((e) => squash(e.label).toLowerCase() === h || e.value === h)?.label;
}

interface Group {
  key: string;
  name: string;
  unassigned: boolean;
  symbols: Set<string>;
  value: number;
  cost: number;
}

/** 거래소별 행. 평가금 내림차순, `거래소 미지정`은 항상 맨 아래. 묶음이 없으면 빈 배열 */
export function computeExchangeTotals(crypto: Crypto[]): BrokerTotalRow[] {
  const groups: Group[] = [];
  for (const c of crypto) {
    if (!(c.quantity > 0)) continue;
    const unassigned = isUnassignedBroker(c.exchange);
    const raw = (c.exchange ?? "").trim();
    const label = unassigned ? undefined : exactExchangeLabel(raw);
    // 목록 거래소는 라벨로, 자유 텍스트는 공백만 뺀 글자 그대로 묶는다
    const key = unassigned ? "__unassigned" : label ? `l:${label}` : `f:${squash(raw)}`;
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = { key, name: unassigned ? UNASSIGNED_EXCHANGE_LABEL : label ?? raw, unassigned, symbols: new Set(), value: 0, cost: 0 };
      groups.push(g);
    }
    g.symbols.add(c.symbol ? `s:${c.symbol.trim().toUpperCase()}` : c.id);
    g.value += c.quantity * c.currentPrice;
    g.cost += c.quantity * c.averagePrice;
  }
  if (groups.length === 0) return [];

  // 헤더 표시: 평가금 = round(합), 손익 = Math.round(합 - 원가)
  // 합은 헤더(computeNetAsset·computeAssetCost)와 같은 순서·같은 식으로 더한다(부동소수 반올림 경계 불일치 방지)
  const totalValue = crypto.reduce((sum, c) => sum + c.quantity * c.currentPrice, 0);
  const totalCost = crypto.reduce((sum, c) => sum + c.quantity * c.averagePrice, 0);
  const values = apportionUnits(groups.map((g) => g.value), Math.round(totalValue));
  const profits = apportionUnits(groups.map((g) => g.value - g.cost), Math.round(totalValue - totalCost));
  const shares = largestRemainderTenths(groups.map((g) => Math.max(0, g.value)));

  return groups
    .map((g, i) => ({
      g,
      row: {
        name: g.name,
        unassigned: g.unassigned,
        count: g.symbols.size,
        valueUnits: values[i],
        profitUnits: profits[i],
        profitRate: g.cost > 0 ? ((g.value - g.cost) / g.cost) * 100 : null,
        shareTenths: shares[i],
      } satisfies BrokerTotalRow,
    }))
    .sort((a, b) => Number(a.g.unassigned) - Number(b.g.unassigned) || b.g.value - a.g.value)
    .map((x) => x.row);
}
