"use client";

import { useEffect, useState } from "react";
import type { Stock } from "@/types/asset";
import { fetchAndStoreClassifications, type ClassifyProgress } from "./fetch-classifications";

/**
 * 보유 종목의 X-Ray 분류 캐시(localStorage)가 미완성이면 자동으로 fetch → 캐시 머지.
 *
 * - `fetchAndStoreClassifications`는 캐시가 완비면 즉시 no-op, 모듈 단위로 동시 호출을 dedup한다.
 * - 반환 `tick`을 `computeBreakdown`/`pickHighlights`를 감싸는 `useMemo` deps에 넣어
 *   localStorage 갱신을 재계산에 반영한다.
 * - 트리거를 끄려면 빈 배열(`[]`)을 넘긴다(즉시 no-op).
 */
export function useXrayClassifications(stocks: Stock[]): { tick: number; progress: ClassifyProgress | null } {
  const [tick, setTick] = useState(0);
  const [progress, setProgress] = useState<ClassifyProgress | null>(null);

  useEffect(() => {
    let mounted = true;
    fetchAndStoreClassifications(stocks, (p) => {
      if (mounted) setProgress(p);
    }).then(() => {
      if (mounted) {
        setTick((v) => v + 1);
        setProgress(null);
      }
    });
    return () => {
      mounted = false;
    };
  }, [stocks]);

  return { tick, progress };
}
