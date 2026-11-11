"use client";

// `새` 표시(4.83) — 새 소식 시트 `whats-new-item-new`와 같은 모양. 한 화면 1개·켜짐/꺼짐 판정은 useNewSpot(lib/new-spot.ts).
// 점/숫자/펄스 없음, 닫기 없음, 모션 없음. 체험·인증카드 캡처에서는 spot이 null이라 렌더 0.
import { useEffect, useState } from "react";
import { HUB_NEW_SPOT_ORDER, type NewSpot } from "@/config/new-spots";
import { getLastVisitedAt } from "@/lib/feature-usage";
import { pickNewSpot } from "@/lib/new-spot";
import { todayKst } from "@/lib/tax-utils";
import { isTrialMode } from "@/lib/trial/trial-mode";

export { HUB_NEW_SPOT_ORDER };

// 보이는 자리 후보(우선순위 순) 중 지금 켜진 1곳. localStorage 읽기라 마운트 후 결정(SSR 불일치 방지)
export function useNewSpot(candidates: readonly NewSpot[]): NewSpot | null {
  const [spot, setSpot] = useState<NewSpot | null>(null);
  const key = candidates.join(",");
  useEffect(() => {
    setSpot(isTrialMode() ? null : pickNewSpot(candidates, todayKst(), getLastVisitedAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return spot;
}

export function NewChip({ spot }: { spot: NewSpot }) {
  return (
    <>
      <span
        data-testid="new-chip"
        data-spot={spot}
        aria-hidden
        className="ml-1.5 inline-flex rounded bg-orange-500/10 px-1.5 py-0.5 align-middle text-[11px] font-bold leading-none text-orange-700 dark:text-orange-400"
      >
        새
      </span>
      <span className="sr-only">, 새 기능</span>
    </>
  );
}
