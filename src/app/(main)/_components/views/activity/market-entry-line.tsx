"use client";

// 시장과 비교 진입 글줄(#132 U5, ui.md 4·5절 E1) — 자산 변화 › 주식 기간 선택 아래(hero). 상세·주식 요약 안 글줄은 4.83에서 시장 타일로 대체됐다.
// 값 계산은 훅 useMarketEntryValue로 분리해 글줄·상세·주식 시장 타일·성과 허브 행이 공유한다(4.83).
// 값 = 비교할 종목이 있는 시장의 지수 등락(페이지와 같은 computeIndexSpan·같은 반올림, A11). 차이는 싣지 않는다.
// 티커 있는 종목이 있으면 첫 렌더부터 자리를 잡고 내용만 opacity로 나타난다. 비교할 종목 0이면 grid-rows로 접는다.
// 인증카드·공유 캡처에는 나오지 않는다(data-screenshot-hide). 저장 호출 0.

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import type { AssetData } from "@/types/asset";
import {
  MARKET_INDEX_NAME,
  classifyHoldings,
  computeIndexSpan,
  formatCompareRate,
  type CompareMarket,
  type ComparePeriod,
} from "@/lib/finance/market-compare";
import { useCompareBasis, useDailyRefToken, useKospiPeerCodes, useMarketIndexRefs } from "@/hooks/use-market-compare";

const HAIRLINE = "border-border dark:border-border/40";

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

// 자산 변화 › 주식 기간 선택 아래 글줄(선택 기간 값, 접두 없음·`시장과 비교`)
export function MarketEntryLine({ period, visible = true, onOpen, testId }: {
  period: ComparePeriod;
  visible?: boolean;
  onOpen: () => void;
  testId: string;
}) {
  const { hasTickerStock, ready, values, linkOnly, ytdLinkReady, open } = useMarketEntryValue(period, visible);

  if (!hasTickerStock) return null;

  return (
    <div
      data-testid={testId}
      data-period={period}
      data-screenshot-hide
      {...(open ? {} : { inert: true, "aria-hidden": true })}
      className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${open ? "grid-rows-[1fr] -mb-2" : "grid-rows-[0fr]"}`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={`mt-3 border-t ${HAIRLINE} pt-1.5 sm:max-w-md`}>
          <button
            type="button"
            data-testid="change-market-entry-button"
            onClick={onOpen}
            disabled={!(ready || ytdLinkReady)}
            className={`flex w-full min-h-10 flex-col items-start justify-center rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-3 motion-safe:transition-opacity motion-safe:duration-200 ${ready || ytdLinkReady ? "opacity-100" : "opacity-0"}`}
          >
            {!linkOnly && (!ready || values.length > 0) && (
              <span className="text-sm text-muted-foreground break-keep">
                {!ready ? " " : <MarketIndexValues values={values} />}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-sm font-medium text-foreground">
              {linkOnly ? "올해 시장과 비교" : "시장과 비교"}
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
