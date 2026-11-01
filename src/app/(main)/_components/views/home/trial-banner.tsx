"use client";

/**
 * 체험 모드(#59) 홈 배너 — 체험 페이지의 "예시" 표기 정본 1곳. page.tsx 홈 분기에서만 렌더(in-flow, 고정 아님).
 * "내 자산으로 시작": 종료 표식(sessionStorage) 기록 후 실제 `/`로 이동 — 복귀한 웰컴이 CTA 슬롯을 asset 상태로 연다.
 * 원본 복구 코드 없음(페이지를 버릴 뿐, S2). 인앱(#60)은 같은 버튼이 외부 브라우저 이동(useExternalMove).
 */

import { useState } from "react";
import { ArrowRight, Compass, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useExternalMove } from "@/hooks/use-external-move";
import { TRIAL_EXIT_KEY } from "@/lib/trial/trial-mode";
import { InAppExternalGuide } from "../../pwa/in-app-external-guide";

export function TrialBanner() {
  const { isInApp, isIOS, isStandalone } = usePWAInstall();
  const inApp = isInApp && !isStandalone;
  const { go, iosFallback } = useExternalMove(isIOS);
  const [busy, setBusy] = useState(false);
  const showGuide = inApp && isIOS;

  const handleStart = async () => {
    if (busy) return;
    setBusy(true);
    if (inApp) {
      try {
        await go(window.location.origin + "/");
      } finally {
        setBusy(false);
      }
      return;
    }
    try { sessionStorage.setItem(TRIAL_EXIT_KEY, "1"); } catch { /* 표식 실패 시 일반 웰컴으로 복귀 */ }
    window.location.assign("/");
  };

  return (
    <section
      data-testid="trial-banner"
      data-screenshot-hide
      aria-label="체험 안내"
      className="flex flex-col rounded-xl bg-card shadow-xs border border-border/10 dark:border-0 p-3 sm:px-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-600 dark:text-orange-400">
            <Compass aria-hidden className="size-4" />
          </span>
          <p className="min-w-0 text-sm leading-relaxed text-pretty break-keep">
            <span className="block font-semibold text-foreground sm:inline">예시 데이터로 둘러보는 중이에요</span>
            <span aria-hidden className="hidden sm:inline mx-1.5 text-muted-foreground/50">·</span>
            <span className="block text-muted-foreground sm:inline">저장되지 않아요</span>
          </p>
        </div>
        <Button
          variant="brand"
          size="lg"
          data-testid="trial-start-btn"
          className="w-full gap-1.5 break-keep sm:w-auto sm:shrink-0"
          onClick={handleStart}
          disabled={busy}
          aria-busy={busy || undefined}
          {...(showGuide ? { "aria-controls": "trial-inapp-guide", "aria-expanded": iosFallback } : {})}
        >
          내 자산으로 시작
          {busy ? <Loader2 aria-hidden className="size-4 motion-safe:animate-spin" /> : <ArrowRight aria-hidden className="size-4" />}
        </Button>
      </div>
      {/* 인앱 iOS: 주소 복사 후 수동 가이드 — 항상 마운트 + grid-rows 0fr↔1fr(재마운트 없음), 닫힘은 inert. 간격은 펼침 영역 안 */}
      {showGuide && (
        <div
          id="trial-inapp-guide"
          data-testid="trial-inapp-guide"
          role="region"
          aria-label="외부 브라우저 이동 방법"
          {...(iosFallback ? {} : { inert: true })}
          className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${iosFallback ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="pt-3 text-left break-keep">
              <InAppExternalGuide
                notice={
                  <p role="status" className="text-sm font-semibold break-keep text-pretty">
                    주소가 복사됐어요. 브라우저에 붙여넣어 주세요.
                  </p>
                }
                lastStep="이동한 브라우저에서 주소로 접속하면 이어집니다."
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
