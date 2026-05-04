"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, ChevronRight } from "lucide-react";
import { dispatchAddStock, dispatchAddRealEstate } from "@/app/(main)/asset/_components/layout/asset-dispatch";
import { useTutorialStore } from "@/stores/tutorial/tutorial-provider";
import { TUTORIAL_STEP_CONFIGS } from "./tutorial-step-config";
import type { TutorialStep } from "@/stores/tutorial/tutorial-store";
import { MAIN_PALETTE } from "@/config/theme";
import { AppGuideContent } from "@/app/(main)/asset/_components/top-nav/app-guide";

interface TargetRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const TOOLTIP_MARGIN = 15;
const HIGHLIGHT_PADDING_X = 12 + 100; // 좌우
const HIGHLIGHT_PADDING_Y = 12 + 200; // 상하
const OVERLAY_COLOR = "rgba(0,0,0,0.70)";

/** Sheet/Dialog/Drawer가 열려있으면 true */
function useIsModalOpen() {
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      setIsOpen(
        !!document.querySelector(
          '[role="dialog"][data-state="open"], [data-vaul-drawer][data-state="open"], [role="dialog"]:not([data-state="closed"])'
        )
      );
    };
    const mo = new MutationObserver(check);
    // subtree + childList로 DOM 삽입도 감지 (Radix UI는 open 시 DOM에 삽입)
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
    check();
    return () => mo.disconnect();
  }, []);
  return isOpen;
}

/** data-tutorial 속성을 가진 요소의 viewport 기준 rect를 반환 */
function useTargetRect(targetAttr: string | null, activeStep: TutorialStep | null, isModalOpen: boolean) {
  const [rect, setRect] = useState<TargetRect | null>(null);

  const measure = useCallback(() => {
    if (!targetAttr) { setRect(null); return; }
    const el = document.querySelector(`[data-tutorial="${targetAttr}"]`);
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRect(null); return; }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [targetAttr]);

  useEffect(() => {
    // 약간 지연 후 첫 측정 (렌더링 완료 보장)
    const t = setTimeout(measure, 80);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);

    // DOM 변경(새 요소 삽입, 클래스/스타일 변경 등)을 감지하여 타겟을 다시 찾음
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style", "data-state"] });

    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      mo.disconnect();
    };
  }, [measure, activeStep, isModalOpen]);

  return rect;
}

/**
 * 타겟+말풍선을 합친 bounding box 바깥을 4개 div 패널로 덮는 오버레이.
 * SVG/clipPath 방식은 stacking context 문제로 포기.
 * div 패널은 z-index만으로 작동하므로 stacking context 영향 없음.
 */
function SpotlightOverlay({ rect }: { rect: TargetRect; tooltipRect: TargetRect }) {
  const PX = HIGHLIGHT_PADDING_X;
  const PY = HIGHLIGHT_PADDING_Y;
  const top = rect.top - PY;
  const left = rect.left - PX;
  const right = rect.left + rect.width + PX;
  const bottom = rect.top + rect.height + PY;

  const s: React.CSSProperties = {
    position: "fixed",
    background: OVERLAY_COLOR,
    zIndex: 9998,
    pointerEvents: "none",
  };

  return (
    <>
      {/* 상단 */}
      <div style={{ ...s, top: 0, left: 0, right: 0, height: Math.max(0, top) }} />
      {/* 하단 */}
      <div style={{ ...s, top: bottom, left: 0, right: 0, bottom: 0 }} />
      {/* 좌측 (상하 사이) */}
      <div style={{ ...s, top, left: 0, width: Math.max(0, left), height: bottom - top }} />
      {/* 우측 (상하 사이) */}
      <div style={{ ...s, top, left: right, right: 0, height: bottom - top }} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────
// Step 0: AppGuide 전체 내용을 튜토리얼 카드로 표시
// ──────────────────────────────────────────────────────────────
function Step0Card({ onNext }: { onNext: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      style={{ backgroundColor: OVERLAY_COLOR }}
    >
      <div className="bg-background rounded-2xl shadow-2xl max-w-3xl w-full p-5 flex flex-col gap-6 animate-in fade-in zoom-in-95 duration-200 max-h-[120vh] overflow-y-auto">
        <AppGuideContent />
        <div className="flex items-center justify-between gap-2 pt-1">
          <div>&nbsp;</div>
          <button
            onClick={onNext}
            className="flex items-center gap-1.5 text-sm font-semibold text-white px-5 py-2 rounded-full transition-opacity hover:opacity-90"
            style={{ backgroundColor: MAIN_PALETTE[0] }}
          >
            다음
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────
// Step 1~5: 타겟 하이라이트 + 말풍선
// ──────────────────────────────────────────────────────────────
function StepOverlay({
  step,
  onComplete,
  targetAttr,
  isWaiting,
}: {
  step: TutorialStep;
  onComplete: () => void;
  targetAttr: string;
  isWaiting: boolean;
}) {
  const isModalOpen = useIsModalOpen();
  const rect = useTargetRect(targetAttr, step, isModalOpen);
  const config = TUTORIAL_STEP_CONFIGS[step];
  const step5Sub = useTutorialStore((s) => s.step5Sub);

  if (isWaiting) return null;
  // Sheet/Dialog 열려있으면 overlay 숨김
  if (isModalOpen) return null;
  // 타겟 요소가 DOM에 없으면 렌더링 하지 않음
  if (!rect) return null;

  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  // 말풍선 위치 계산 — rect(타겟 원본) 기준
  const tooltipWidth = Math.min(300, vw - 24);
  let tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2;
  tooltipLeft = Math.max(12, Math.min(vw - tooltipWidth - 12, tooltipLeft));

  const spaceBelow = vh - (rect.top + rect.height);
  const showAbove =
    config.preferPosition === "top" ||
    (config.preferPosition === "auto" && spaceBelow < 180);
  const tooltipHeight = 140;
  // Step 1(FAB)의 경우 말풍선을 좀 더 위로 올리기 위해 마진을 추가 조정
  const margin = step === 1 ? 35 : TOOLTIP_MARGIN;
  const tooltipTop = showAbove
    ? rect.top - margin - tooltipHeight
    : rect.top + rect.height + margin;

  const tooltipRect: TargetRect = { top: tooltipTop, left: tooltipLeft, width: tooltipWidth, height: tooltipHeight };

  const Icon = config.icon;

  let displayTitle = config.title;
  let displayDescription = config.description;

  if (step === 5 && step5Sub === "profit") {
    displayTitle = config.title2 || displayTitle;
    displayDescription = config.description2 || displayDescription;
  }

  return createPortal(
    <>
      <SpotlightOverlay rect={rect} tooltipRect={tooltipRect} />

      {/* 말풍선 */}
      <div
        className="fixed rounded-xl shadow-xl border border-primary/80 p-4 flex flex-col gap-3 animate-in fade-in duration-150 bg-background text-foreground"
        style={{ top: tooltipTop, left: tooltipLeft, width: tooltipWidth, zIndex: 10000 }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <div
              className="size-6 rounded-full flex items-center justify-center shrink-0 mt-0.5"
              style={{ backgroundColor: MAIN_PALETTE[0] }}
            >
              <Icon className="size-3.5" style={{ color: MAIN_PALETTE[0] }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-snug" style={{ color: MAIN_PALETTE[0] }}>{displayTitle}</p>
              {displayDescription && (
                <p className="text-sm text-foreground mt-1 leading-snug">{displayDescription}</p>
              )}
            </div>
          </div>
          <button onClick={onComplete} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
            <X className="size-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{step} / 5</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onComplete}
              className="flex items-center gap-1 text-sm font-semibold text-white px-4 py-1.5 rounded-full transition-opacity hover:opacity-90"
              style={{ backgroundColor: MAIN_PALETTE[0] }}
            >
              다음
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

// ──────────────────────────────────────────────────────────────
// 메인 TutorialOverlay
// ──────────────────────────────────────────────────────────────
export function TutorialOverlay({
  isWelcomeGuide,
  isSharePending,
  step0Mode = null,
}: {
  isWelcomeGuide: boolean;
  isSharePending: boolean;
  step0Mode?: "screenshot" | "manual" | "real-estate" | null;
}) {
  const activeStep = useTutorialStore((s) => s.activeStep);
  const isTutorialFinished = useTutorialStore((s) => s.isTutorialFinished);
  const step5Sub = useTutorialStore((s) => s.step5Sub);
  const completeStep = useTutorialStore((s) => s.completeStep);
  const skipStep = useTutorialStore((s) => s.skipStep);
  const isWaiting = useTutorialStore((s) => s.isWaiting);
  const startWaiting = useTutorialStore((s) => s.startWaiting);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  // Step 5 sub-step 분기를 위해 targetAttr 계산
  const targetAttr =
    activeStep !== null && activeStep !== 0
      ? (activeStep === 5 && step5Sub === "profit"
        ? "tutorial-profit-subtab"
        : TUTORIAL_STEP_CONFIGS[activeStep].targetAttr)
      : null;

  // step4 전용: DropdownMenu 열림 감지로 완료 처리
  useEffect(() => {
    if (activeStep !== 4 || isWaiting || isTutorialFinished) return;
    const mo = new MutationObserver(() => {
      const menu = document.querySelector('[role="menu"][data-state="open"]');
      if (menu) startWaiting(4);
    });
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-state"] });
    return () => mo.disconnect();
  }, [activeStep, isWaiting, isTutorialFinished, startWaiting]);

  // document 캡처 단계 클릭 리스너 — 컴포넌트 바깥에서 안정적으로 감지
  useEffect(() => {
    if (!targetAttr || isWaiting || activeStep === null || activeStep === 0) return;
    const handler = (e: MouseEvent) => {
      const el = document.querySelector(`[data-tutorial="${targetAttr}"]`);
      const path = e.composedPath ? e.composedPath() : [];
      const hit = el && (el.contains(e.target as Node) || path.includes(el));
      if (!hit) return;

      // 즉각 완료되어야 하는 스텝(1, 3, 5)에서 startWaiting이 호출되면
      // isWaiting=true가 되어 말풍선이 5초간 사라지는 버그가 발생하므로, 대기가 필요한 스텝만 처리합니다.
      if (activeStep === 2 || activeStep === 4) {
        startWaiting(activeStep);
      } else {
        // 대기가 필요 없는 스텝은 클릭 시 즉시 완료/진행 처리
        if (activeStep === 1) window.dispatchEvent(new CustomEvent("tutorial-complete-step1"));
        if (activeStep === 3) window.dispatchEvent(new CustomEvent("tutorial-complete-step3"));
        if (activeStep === 5) {
          if (step5Sub === "activity") {
            window.dispatchEvent(new CustomEvent("tutorial-advance-step5"));
          } else {
            window.dispatchEvent(new CustomEvent("tutorial-complete-step5"));
          }
        }
      }
    };
    document.addEventListener("click", handler, true);
    return () => document.removeEventListener("click", handler, true);
  }, [targetAttr, isWaiting, activeStep, startWaiting, completeStep]);

  if (!mounted) return null;
  if (isSharePending) return null;
  if (isTutorialFinished) return null;
  if (activeStep === null) return null;

  // WelcomeGuide에서는 Step 0만 제어 (step 1 이후는 isWelcomeGuide 무관하게 표시)
  if (isWelcomeGuide && activeStep === 0 && !step0Mode) return null;

  // Step 0 — 중앙 카드
  if (activeStep === 0) {
    return (
      <Step0Card
        onNext={() => {
          completeStep(0);
          if (step0Mode) {
            if (step0Mode === "real-estate") {
              dispatchAddRealEstate();
            } else {
              dispatchAddStock(step0Mode);
            }
          }
        }}
      />
    );
  }

  if (!targetAttr) return null;

  return (
    <StepOverlay
      key={activeStep}
      step={activeStep}
      onComplete={() => {
        const el = document.querySelector(`[data-tutorial="${targetAttr}"]`) as HTMLElement;
        if (el) {
          // Radix UI 트리거(Tabs, Dropdown 등)는 click 메서드 대신 pointer/mouse down 이벤트를 감지하므로 수동으로 디스패치
          const eventInit = { bubbles: true, cancelable: true, view: window, button: 0 };
          el.dispatchEvent(new PointerEvent("pointerdown", { ...eventInit, buttons: 1 }));
          el.dispatchEvent(new MouseEvent("mousedown", { ...eventInit, buttons: 1 }));
          el.dispatchEvent(new PointerEvent("pointerup", { ...eventInit, buttons: 0 }));
          el.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
          el.click();
        }

        // Radix UI 특성상 이미 해당 탭/상태가 활성화되어 있으면 click() 시 내부 onChange 이벤트가 발생하지 않아
        // 튜토리얼이 멈추는 현상을 방지하기 위해, "다음" 버튼 클릭 시에는 명시적으로 해당 스텝의 이벤트를 한 번 더 트리거합니다. (다중 호출 안전함)
        if (activeStep === 1) window.dispatchEvent(new CustomEvent("tutorial-complete-step1"));
        if (activeStep === 2) window.dispatchEvent(new CustomEvent("tutorial-start-wait-step2"));
        if (activeStep === 3) window.dispatchEvent(new CustomEvent("tutorial-complete-step3"));
        if (activeStep === 4) startWaiting(4);

        if (activeStep === 5) {
          if (step5Sub === "activity") {
            window.dispatchEvent(new CustomEvent("tutorial-advance-step5"));
          } else {
            window.dispatchEvent(new CustomEvent("tutorial-complete-step5"));
          }
        }
      }}
      targetAttr={targetAttr}
      isWaiting={isWaiting}
    />
  );
}
