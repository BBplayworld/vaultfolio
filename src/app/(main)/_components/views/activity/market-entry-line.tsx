"use client";

// 시장과 비교 진입 값·타일(#132 U5 → 4.83 상세·주식 타일 → 4.88 자산 변화 타일).
// 값 계산은 훅 useMarketEntryValue로 분리해 자산 변화 타일·상세·주식 시장 타일·성과 허브 행이 공유한다.
// 값 = 비교할 종목이 있는 시장의 지수 등락(페이지와 같은 computeIndexSpan·같은 반올림, A11). 차이는 싣지 않는다. 저장 호출 0.

import { useMemo } from "react";
import { ChartNoAxesColumn } from "lucide-react";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import { useAssetData } from "@/contexts/asset-data-context";
import type { AssetData } from "@/types/asset";
import {
  COMPARE_PERIOD_LABEL,
  MARKET_INDEX_NAME,
  classifyHoldings,
  computeIndexSpan,
  formatCompareRate,
  type CompareMarket,
  type ComparePeriod,
} from "@/lib/finance/market-compare";
import { ToolTile } from "../../layout/ui/tool-tile";
import { useCompareBasis, useDailyRefToken, useKospiPeerCodes, useMarketIndexRefs } from "@/hooks/use-market-compare";

// 시장과 비교로 넘길 종목이 있는가(티커 있는 보유 주식) — 자산 변화 › 주 `종목 등락 보기` 노출 조건과 공용
export const hasComparableStock = (assetData: AssetData): boolean =>
  assetData.stocks.some((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted" && s.quantity > 0);

export interface MarketEntryValue {
  hasTickerStock: boolean;
  markets: CompareMarket[] | null; // 판별 전 null
  ready: boolean; // 판별·기준 설정·지수 조회가 끝남
  values: { m: CompareMarket; rate: number }[]; // 값이 있는 시장만(국내 → 미국)
  linkOnly: boolean;
  ytdLinkReady: boolean;
  open: boolean; // 비교할 종목이 있거나 판별 전
}

// 시장 지수 등락 값 단일 계산 — 같은 computeIndexSpan·같은 시장 순서라 글줄·타일·허브 행·페이지가 같은 값(A11, C65)
export function useMarketEntryValue(period: ComparePeriod, visible = true): MarketEntryValue {
  const { assetData } = useAssetData();
  const { basis, hydrated } = useCompareBasis();
  const dailyToken = useDailyRefToken();
  const peerCodes = useKospiPeerCodes();

  const hasTickerStock = hasComparableStock(assetData);
  // 비교할 종목이 있는 시장(국내 → 미국). 판별 전 null
  const markets = useMemo<CompareMarket[] | null>(() => {
    if (!peerCodes) return null;
    const c = classifyHoldings(assetData.stocks, peerCodes);
    return (["kr", "us"] as const).filter((m) => c[m].length > 0);
  }, [assetData.stocks, peerCodes]);
  // 올해(ytd)는 연 탭 링크 전용 — 값 없이 링크만이라 지수를 조회하지 않는다(#150, Hero 1년 값과의 오독 방지)
  const linkOnly = period === "ytd";
  const indexRefs = useMarketIndexRefs(basis, hydrated && !!markets && markets.length > 0 && !linkOnly, dailyToken, [period]);

  const spans = linkOnly ? [] : (markets ?? []).map((m) => ({ m, s: computeIndexSpan(m, period, indexRefs) }));
  const ready = markets !== null && hydrated && spans.every((x) => x.s.state !== "loading");
  return {
    hasTickerStock,
    markets,
    ready,
    values: spans.filter((x) => x.s.state === "ok").map((x) => ({ m: x.m, rate: x.s.rate! })),
    linkOnly,
    ytdLinkReady: linkOnly && markets !== null && hydrated,
    open: visible && (markets === null || markets.length > 0),
  };
}

// 지수 이름 + 등락(`코스피 −7.8%`) 나열 — 시장 사이 `·`. restBelowSm = 첫 시장 외는 sm 미만에서 숨김(타일·허브 행의 좁은 폭)
export function MarketIndexValues({ values, restBelowSm = false }: { values: MarketEntryValue["values"]; restBelowSm?: boolean }) {
  return (
    <>
      {values.map(({ m, rate }, i) => (
        <span key={m} className={restBelowSm && i > 0 ? "max-sm:hidden" : undefined}>
          {i > 0 && <span aria-hidden className="mx-1.5 text-muted-foreground/60">·</span>}
          <span className="whitespace-nowrap">
            {MARKET_INDEX_NAME[m]} <span className="font-medium text-foreground tabular-nums">{formatCompareRate(rate)}</span>
          </span>
        </span>
      ))}
    </>
  );
}

// 시장 타일 값 줄 — 로딩(스켈레톤)·빈(지수 0건)·값 3분기. 연 탭(linkOnly)은 값 없이 링크 문구.
// 상세·주식 타일(1주 고정)과 자산 변화 타일(기간 연동)이 공유한다(C65).
export function MarketTileValue({ market, label, testId, className }: {
  market: MarketEntryValue;
  label: string;
  testId: string;
  className?: string;
}) {
  return (
    <span data-testid={testId} className={className}>
      {!market.ready && !market.ytdLinkReady
        ? <span aria-hidden className={`inline-block h-4 w-20 rounded align-middle ${SKELETON_FILL}`} />
        : market.linkOnly
          ? "올해 지수와 나란히 보기"
          : market.values.length === 0
            ? "지수와 나란히 보기"
            : <>{label} <MarketIndexValues values={market.values} restBelowSm /></>}
    </span>
  );
}

// 자산 변화 › 주식 — 기간 선택 Hero 카드 바로 아래 단일 도구 타일(4.88). 값 = 선택 기간(연은 값 없음).
// 비교할 종목 0(판별 후 포함)이면 렌더하지 않는다. 인증카드·공유 캡처에는 나오지 않는다(data-screenshot-hide).
export function MarketTile({ period, onOpen, testId }: {
  period: ComparePeriod;
  onOpen: () => void;
  testId: string;
}) {
  const market = useMarketEntryValue(period);
  if (!market.hasTickerStock || !market.open) return null;
  return (
    <div data-testid={testId} data-period={period} data-screenshot-hide className="sm:max-w-md">
      <ToolTile
        icon={ChartNoAxesColumn}
        name="시장과 비교"
        testId={`${testId}-button`}
        onClick={onOpen}
        className="w-full"
      >
        <MarketTileValue
          key={period}
          market={market}
          label={COMPARE_PERIOD_LABEL[period]}
          testId={`${testId}-value`}
          className="inline-block whitespace-nowrap motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
        />
      </ToolTile>
    </div>
  );
}
