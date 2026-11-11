"use client";

// 시장과 비교 진입 글줄(#132 U5, ui.md 4·5절 E1) — 상세·주식 요약 헤더 안 / 자산 변화 › 주식 기간 선택 아래 공용.
// 값 = 비교할 종목이 있는 시장의 지수 등락(페이지와 같은 computeIndexSpan·같은 반올림, A11). 차이는 싣지 않는다.
// 티커 있는 종목이 있으면 첫 렌더부터 자리를 잡고 내용만 opacity로 나타난다. 비교할 종목 0이면 grid-rows로 접는다.
// 인증카드·공유 캡처에는 나오지 않는다(data-screenshot-hide, 상세·주식은 screenshotMode에서 렌더 안 함). 저장 호출 0.

import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
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

export function MarketEntryLine({ variant, period, visible = true, onOpen, testId }: {
  // stock = 상세·주식(1주 고정, `최근 1주` 접두·`내 종목과 비교`) / hero = 자산 변화(선택 기간, 접두 없음·`시장과 비교`)
  variant: "stock" | "hero";
  period: ComparePeriod;
  visible?: boolean;
  onOpen: () => void;
  testId: string;
}) {
  const { assetData } = useAssetData();
  const { basis, hydrated } = useCompareBasis();
  const dailyToken = useDailyRefToken();
  const peerCodes = useKospiPeerCodes();

  const hasTickerStock = assetData.stocks.some((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted" && s.quantity > 0);
  // 비교할 종목이 있는 시장(국내 → 미국). 판별 전 null
  const markets = useMemo<CompareMarket[] | null>(() => {
    if (!peerCodes) return null;
    const c = classifyHoldings(assetData.stocks, peerCodes);
    return (["kr", "us"] as const).filter((m) => c[m].length > 0);
  }, [assetData.stocks, peerCodes]);
  // 올해(ytd)는 연 탭 링크 전용 — 값 없이 링크만이라 지수를 조회하지 않는다(#150, Hero 1년 값과의 오독 방지)
  const linkOnly = period === "ytd";
  const indexRefs = useMarketIndexRefs(basis, hydrated && !!markets && markets.length > 0 && !linkOnly, dailyToken, [period]);

  if (!hasTickerStock) return null;

  const spans = linkOnly ? [] : (markets ?? []).map((m) => ({ m, s: computeIndexSpan(m, period, indexRefs) }));
  const ready = markets !== null && hydrated && spans.every((x) => x.s.state !== "loading");
  const values = spans.filter((x) => x.s.state === "ok");
  const open = visible && (markets === null || markets.length > 0);
  const periodLabel = period === "daily" ? "하루" : period === "weekly" ? "1주" : "1개월";
  const ytdLinkReady = linkOnly && markets !== null && hydrated;

  return (
    <div
      data-testid={testId}
      data-period={period}
      data-screenshot-hide
      {...(open ? {} : { inert: true, "aria-hidden": true })}
      className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${open ? "grid-rows-[1fr] -mb-2" : "grid-rows-[0fr]"}`}
    >
      <div className="min-h-0 overflow-hidden">
        <div className={`mt-3 border-t ${HAIRLINE} pt-1.5 ${variant === "hero" ? "sm:max-w-md" : ""}`}>
          <button
            type="button"
            data-testid={variant === "stock" ? "stock-market-entry" : "change-market-entry-button"}
            onClick={onOpen}
            disabled={!(ready || ytdLinkReady)}
            className={`flex w-full min-h-10 flex-col items-start justify-center rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:inline-flex sm:w-auto sm:flex-row sm:items-center sm:gap-3 motion-safe:transition-opacity motion-safe:duration-200 ${ready || ytdLinkReady ? "opacity-100" : "opacity-0"}`}
          >
            {!linkOnly && (!ready || values.length > 0) && (
              <span className="text-sm text-muted-foreground break-keep">
                {!ready ? " " : (
                  <>
                    {variant === "stock" && <><span className="max-[359px]:hidden">최근 </span>{periodLabel} </>}
                    {values.map(({ m, s }, i) => (
                      <span key={m}>
                        {i > 0 && <span aria-hidden className="mx-1.5 text-muted-foreground/60">·</span>}
                        <span className="whitespace-nowrap">
                          {MARKET_INDEX_NAME[m]} <span className="font-medium text-foreground tabular-nums">{formatCompareRate(s.rate!)}</span>
                        </span>
                      </span>
                    ))}
                  </>
                )}
              </span>
            )}
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-sm font-medium text-foreground">
              {variant === "stock" ? "내 종목과 비교" : linkOnly ? "올해 시장과 비교" : "시장과 비교"}
              <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
