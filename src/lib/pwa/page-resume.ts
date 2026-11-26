/**
 * page-resume.ts (#309, 5.155)
 * 화면 복귀 트리거 — `visibilitychange → visible`과 bfcache 복원(`pageshow`, persisted)만 쓴다.
 * 타이머·주기 폴링·잠금 해제·온라인 복귀 이벤트는 쓰지 않는다.
 */

/** 복귀 이벤트 두 가지에 onResume을 건다. 해제 함수를 돌려준다 */
export function onPageResume(onResume: () => void, doc: Document = document, win: Window = window): () => void {
  const onVisibility = () => {
    if (doc.visibilityState === "visible") onResume();
  };
  const onPageShow = (e: Event) => {
    if ((e as PageTransitionEvent).persisted) onResume();
  };
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("pageshow", onPageShow);
  return () => {
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("pageshow", onPageShow);
  };
}

/**
 * 진행 중 1개만 — 실행 중이거나 canStart()가 false면 무시한다(연타·visible+pageshow 연속 → 1회).
 * run의 성공·실패와 관계없이 끝나면 다시 받을 수 있다.
 */
export function createSingleFlight(run: () => Promise<void>, canStart: () => boolean = () => true): () => Promise<void> {
  let running = false;
  return async () => {
    if (running || !canStart()) return;
    running = true;
    try {
      await run();
    } finally {
      running = false;
    }
  };
}
