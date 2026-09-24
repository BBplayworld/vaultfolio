import { useEffect, useState } from "react";

const PC_PREVIEW_QUERY = "(min-width: 640px)";

// 프리뷰(반응형) 렌더 중에만 뷰포트 ≥640px(PC) 여부를 추적한다. 캡처(!responsive)는 항상 고정폭이라
// false 고정 — portfolio-ring-card.tsx·share-card.tsx가 공유하는 단일 출처.
export function usePcPreview(responsive: boolean): boolean {
  const [isPcPreview, setIsPcPreview] = useState(false);
  useEffect(() => {
    if (!responsive || typeof window === "undefined") return;
    const mql = window.matchMedia(PC_PREVIEW_QUERY);
    const update = () => setIsPcPreview(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [responsive]);
  return isPcPreview;
}
