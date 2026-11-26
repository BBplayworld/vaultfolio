"use client";

import { useMemo } from "react";
import type { Stock } from "@/types/asset";
import { priceAsOfLine, type PriceAsOfLineValue } from "@/lib/finance/price-freshness";
import { usePriceSyncStatusStore } from "@/stores/price-sync-status-store";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { todayKst } from "@/lib/tax-utils";

/**
 * '언제 시세' 줄 값(#309) — 홈(prefix `주식 `)·주식 요약(분류 탭 종목)이 같은 계산을 쓴다.
 * 체험 모드는 시세를 받지 않으므로 null(줄 DOM 0). 실패 집합은 메모리 store(저장 키 0).
 */
export function usePriceAsOfLine(stocks: readonly Stock[], prefix = ""): PriceAsOfLineValue | null {
  const failedTickers = usePriceSyncStatusStore((s) => s.failedTickers);
  const today = todayKst();
  return useMemo(
    () => (isTrialMode() ? null : priceAsOfLine(stocks, failedTickers, { today, prefix })),
    [stocks, failedTickers, today, prefix],
  );
}

/**
 * 표시 전용 각주 줄(ui.md 3장). 조각 2개 각각 nowrap, 점은 앞 조각 끝에 붙여 둘째 줄이 점으로 시작하지 않는다.
 * aria-live 없음(복귀마다 읽어 주면 소음), 캡처에서는 숨김.
 */
export function PriceAsOfLine({ value, className = "" }: { value: PriceAsOfLineValue; className?: string }) {
  const { main, failedText } = value;
  return (
    <p
      data-testid="price-asof"
      data-screenshot-hide
      className={`text-2xs text-muted-foreground tabular-nums leading-normal text-pretty ${className}`}
    >
      {main && (
        <span data-testid="price-asof-main" className="whitespace-nowrap">
          {main}
          {failedText && " ·"}
        </span>
      )}
      {main && failedText && " "}
      {failedText && (
        <span data-testid="price-asof-failed" className="whitespace-nowrap text-foreground">
          {failedText}
        </span>
      )}
    </p>
  );
}
