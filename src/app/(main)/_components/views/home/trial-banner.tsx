"use client";

/**
 * 체험 모드(#59) 공통 표시 — 체험 페이지의 "예시" 표기 정본 1곳. page.tsx 마지막 return 첫 자식(전 화면 공통, #249).
 * 상단 sticky 1줄: 가림 면(하단 탭과 같은 bg-background/95 backdrop-blur-md) + 카드 48px. 화면 전환에 재마운트 없음(key 래퍼 밖).
 * sticky top·세금 화면 오프셋은 globals.css `--trial-bar-top`·`--trial-bar-h`(html:has([data-trial-bar])) — 화면별 예외 코드 0.
 * "내 자산으로 시작": 보던 화면 키(#249) + 종료 표식(sessionStorage) 기록 후 실제 `/`로 이동 — 복귀한 웰컴이 등록 칸을 그 자산군 상태로 연다.
 * 원본 복구 코드 없음(페이지를 버릴 뿐, S2). 인앱(#60)은 같은 버튼이 외부 브라우저 이동(useExternalMove), 전달값 미기록.
 */

import { useRef, useState } from "react";
import { ArrowRight, Compass, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useExternalMove } from "@/hooks/use-external-move";
import { writeTrialExit } from "@/lib/trial/trial-exit";
import { InAppExternalGuide } from "../../pwa/in-app-external-guide";

/** viewKey: 지금 보는 화면 키(viewToKey 결과) — 시작 누름 때만 전달값으로 기록(#249) */
export function TrialBanner({ viewKey = "" }: { viewKey?: string } = {}) {
  const { isInApp, isIOS, isStandalone } = usePWAInstall();
  const inApp = isInApp && !isStandalone;
  const { go, iosFallback } = useExternalMove(isIOS);
  const [busy, setBusy] = useState(false);
  const [guideClosed, setGuideClosed] = useState(false); // iOS 안내 `닫기` — 다시 누르면 다시 펼침
  const startRef = useRef<HTMLButtonElement>(null);
  const showGuide = inApp && isIOS;
  const guideOpen = iosFallback && !guideClosed;

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    if (inApp) {
      setGuideClosed(false);
      try {
        await go(window.location.origin + "/");
      } finally {
        setBusy(false);
      }
      return;
    }
    try { writeTrialExit(sessionStorage, viewKey); } catch { /* 표식 실패 시 일반 웰컴으로 복귀 */ }
    window.location.assign("/");
  };

  const closeGuide = () => {
    setGuideClosed(true);
    startRef.current?.focus();
  };

  return (
    <>
    {/* 모바일 설치 앱 노치 띠 — 스크롤 뒤 상태바 영역으로 본문이 비치지 않게(브라우저·PC는 높이 0).
        가림 면(backdrop-filter = fixed 기준 상자) 밖 형제로 둔다. fixed라 flex gap에 들어가지 않는다 */}
    <div aria-hidden data-screenshot-hide className="pointer-events-none fixed inset-x-0 top-0 z-20 h-[env(safe-area-inset-top,0px)] bg-background" />
    <div
      data-testid="trial-banner"
      data-trial-bar
      data-screenshot-hide
      className="trial-bar-sticky sticky z-20 -mx-3 -my-1 bg-background/95 px-3 py-1 backdrop-blur-md md:-mx-12 md:px-12"
    >
      <section
        aria-label="체험 안내"
        className="flex flex-col rounded-xl bg-card p-1.5 pl-2.5 dark:shadow-xs motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <Compass aria-hidden className="size-4" />
          </span>
          <p className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5 break-keep">
            <span data-testid="trial-tag" className="whitespace-nowrap text-sm font-semibold text-foreground">예시 자산</span>
            <span data-testid="trial-note" className="whitespace-nowrap text-xs text-muted-foreground">저장되지 않아요</span>
          </p>
          <Button
            ref={startRef}
            variant="brand"
            data-testid="trial-start-btn"
            className="relative shrink-0 gap-1.5 whitespace-nowrap after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-['']"
            onClick={handleStart}
            disabled={busy}
            aria-busy={busy || undefined}
            {...(showGuide ? { "aria-controls": "trial-inapp-guide", "aria-expanded": guideOpen } : {})}
          >
            내 자산으로 시작
            {busy ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
          </Button>
        </div>
        {/* 인앱 iOS: 주소 복사 후 수동 가이드 — 항상 마운트 + grid-rows 0fr↔1fr(재마운트 없음), 닫힘은 inert.
            sticky라 펼친 높이는 화면 안으로 제한(안쪽 스크롤), 끝에 `닫기` */}
        {showGuide && (
          <div
            id="trial-inapp-guide"
            data-testid="trial-inapp-guide"
            role="region"
            aria-label="외부 브라우저 이동 방법"
            {...(guideOpen ? {} : { inert: true })}
            className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${guideOpen ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="max-h-[calc(100dvh-7.5rem)] overflow-y-auto overscroll-contain px-1 pt-3 text-left break-keep">
                <InAppExternalGuide
                  notice={
                    <p role="status" className="text-sm font-semibold break-keep text-pretty">
                      주소가 복사됐어요. 브라우저에 붙여넣어 주세요.
                    </p>
                  }
                  lastStep="이동한 브라우저에서 주소로 접속하면 이어집니다."
                />
                <div className="flex justify-end pt-1">
                  <Button variant="ghost" data-testid="trial-inapp-guide-close" className="h-10" onClick={closeGuide}>
                    닫기
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
    </>
  );
}
