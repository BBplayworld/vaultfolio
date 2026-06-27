"use client";

import { createContext, useCallback, useContext, useEffect, useState, useRef, type ReactNode } from "react";

export type DetailTab = "hub" | "stocks" | "stocks-xray" | "stocks-trades" | "real-estate" | "crypto" | "cash" | "loans";
export type ActivityTab = "hub" | "netasset" | "profit" | "dividend";

export type AssetView =
  | { type: "home" }
  | { type: "more" }
  | { type: "settings" }
  | { type: "detail"; tab: DetailTab }
  | { type: "activity"; tab: ActivityTab };

const DETAIL_TABS: readonly DetailTab[] = ["hub", "stocks", "stocks-xray", "stocks-trades", "real-estate", "crypto", "cash", "loans"];
const ACTIVITY_TABS: readonly ActivityTab[] = ["hub", "netasset", "profit", "dividend"];

// 1차 메뉴 좌우 순서 — 스와이프 이동·슬라이드 방향 계산 공용
const PAGE_ORDER = ["home", "detail", "activity", "more"] as const;
type MainViewType = typeof PAGE_ORDER[number];
// 슬라이드 전환 방향: "right"=오른쪽에서 진입(다음 메뉴), "left"=왼쪽에서 진입(이전 메뉴)
export type SlideDir = "left" | "right" | null;
const mainTypeOf = (t: AssetView["type"]): MainViewType => (t === "settings" ? "more" : t);

export function parseHash(hash: string): AssetView {
  const clean = hash.replace(/^#/, "");
  if (!clean || clean === "home") return { type: "home" };
  if (clean === "more") return { type: "more" };
  if (clean === "settings") return { type: "settings" };
  const [type, tab] = clean.split("/");
  if (type === "detail") {
    // #detail (탭 생략) → hub
    if (!tab) return { type: "detail", tab: "hub" };
    if (DETAIL_TABS.includes(tab as DetailTab)) return { type: "detail", tab: tab as DetailTab };
  }
  if (type === "activity") {
    // #activity (탭 생략) → hub
    if (!tab) return { type: "activity", tab: "hub" };
    if (ACTIVITY_TABS.includes(tab as ActivityTab)) return { type: "activity", tab: tab as ActivityTab };
  }
  return { type: "home" };
}

export function toHash(view: AssetView): string {
  if (view.type === "home") return "";
  if (view.type === "more") return "#more";
  if (view.type === "settings") return "#settings";
  // 허브는 짧은 #detail / #activity 형태 유지
  if (view.tab === "hub") return `#${view.type}`;
  return `#${view.type}/${view.tab}`;
}

// 뒤로가기 버튼에 표시할 라벨 — 현재 view가 아니라 "돌아갈 view"를 표시
// - 허브(detail/activity)에서 뒤로 → 홈
// - 하위 페이지(stocks/netasset 등)에서 뒤로 → 해당 허브("상세"/"성과")
export function getBackLabel(view: AssetView): string {
  if (view.type === "home") return "";
  if (view.type === "more") return "홈";
  if (view.type === "settings") return "더보기";
  if (view.tab === "hub") return "홈";
  if (view.type === "detail" && (view.tab === "stocks-xray" || view.tab === "stocks-trades")) return "주식";
  return view.type === "detail" ? "상세" : "성과";
}

type NavCtx = {
  view: AssetView;
  navigate: (v: AssetView) => void;
  back: () => void;
  slideDir: SlideDir;
};

const NavigationContext = createContext<NavCtx | null>(null);

// 페이지 이동 시 최상단으로 스크롤
function scrollPastHeader() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "auto" });
}

// 스와이프 제스처 무시할 영역(차트, 입력 필드 등) 판단
function shouldIgnoreSwipe(element: HTMLElement | null): boolean {
  if (!element) return false;
  
  // 1. 모달/다이얼로그가 열려있는지 확인
  if (document.querySelector('[role="dialog"]') || document.querySelector('[role="alertdialog"]')) {
    return true;
  }

  let curr: HTMLElement | null = element;
  while (curr && curr !== document.body) {
    // 2. input, textarea, select 등 포커스/드래그가 필요한 Form 요소 검사
    if (curr.tagName === "INPUT" || curr.tagName === "TEXTAREA" || curr.tagName === "SELECT") {
      const type = (curr as HTMLInputElement).type;
      if (type === "range" || type === "text" || type === "number" || type === "password" || type === "email") {
        return true;
      }
    }

    // 3. Recharts 차트 영역 또는 SVG/Canvas 검사
    if (
      curr.classList.contains("recharts-wrapper") ||
      curr.tagName === "svg" ||
      curr.tagName === "canvas" ||
      curr.getAttribute("role") === "slider"
    ) {
      return true;
    }

    // 4. 수평 스크롤이 가능한 컨테이너인지 검사
    const style = window.getComputedStyle(curr);
    const overflowX = style.overflowX;
    if (
      (overflowX === "auto" || overflowX === "scroll") &&
      curr.scrollWidth > curr.clientWidth
    ) {
      return true;
    }

    curr = curr.parentElement;
  }
  
  return false;
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AssetView>({ type: "home" });
  const [slideDir, setSlideDir] = useState<SlideDir>(null);

  const viewRef = useRef<AssetView>(view); // navigate에서 stale 없이 직전 view 참조
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const ignoreSwipeRef = useRef(false);

  // 1차 메뉴 간 이동 방향 계산 (그 외엔 null → 기본 전환)
  const computeSlideDir = (from: AssetView, to: AssetView): SlideDir => {
    const pi = PAGE_ORDER.indexOf(mainTypeOf(from.type));
    const ni = PAGE_ORDER.indexOf(mainTypeOf(to.type));
    if (pi < 0 || ni < 0 || pi === ni) return null;
    return ni > pi ? "right" : "left";
  };

  // 초기 hash 1회 동기화 (SSR 안전)
  useEffect(() => {
    const initial = parseHash(window.location.hash);
    viewRef.current = initial;
    setView(initial);
    const onPop = () => {
      const next = parseHash(window.location.hash);
      setSlideDir(computeSlideDir(viewRef.current, next));
      viewRef.current = next;
      setView(next);
      scrollPastHeader();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((v: AssetView) => {
    const hash = toHash(v);
    const target = hash || window.location.pathname + window.location.search;
    if (window.location.hash !== hash) {
      window.history.pushState(null, "", target);
    }
    // 짧은 햅틱 진동 (지원 기기만, 모바일 대부분) — 토스 스타일 미세 피드백
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(8);
    }
    setSlideDir(computeSlideDir(viewRef.current, v));
    viewRef.current = v;
    setView(v);
    // 페이지 이동 시 항상 최상단
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // 터치 스와이프 제스처 이벤트 등록
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      startTimeRef.current = Date.now();
      ignoreSwipeRef.current = shouldIgnoreSwipe(e.target as HTMLElement);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (ignoreSwipeRef.current) return;

      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      const isMobileViewport = window.matchMedia("(max-width: 768px)").matches;

      // PWA Standalone 모드 또는 모바일 뷰포트 기기만 스와이프 작동
      if (!isStandaloneMode && !isMobileViewport) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;
      const duration = Date.now() - startTimeRef.current;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);

      // 수평 스와이프 인식 — 짧은 이동·빠른 플릭도 인식(둔감 개선)
      const isHorizontal = absX > absY * 1.2;
      const enoughDistance = absX > 45;
      const isFlick = duration < 400 && absX > 30; // 빠르고 짧은 플릭
      if (duration <= 1000 && isHorizontal && (enoughDistance || isFlick)) {
        const currentType = mainTypeOf(view.type);
        if (!PAGE_ORDER.includes(currentType)) return;

        const currentIndex = PAGE_ORDER.indexOf(currentType);

        if (deltaX > 0) {
          // LtoR swipe: 하단 NAV 기준 왼쪽 메뉴 이동 (인덱스 감소)
          const newIndex = currentIndex - 1;
          if (newIndex >= 0) {
            const targetType = PAGE_ORDER[newIndex];
            if (targetType === "home") navigate({ type: "home" });
            else if (targetType === "detail") navigate({ type: "detail", tab: "hub" });
            else if (targetType === "activity") navigate({ type: "activity", tab: "hub" });
            else if (targetType === "more") navigate({ type: "more" });
          }
        } else {
          // RtoL swipe: 하단 NAV 기준 오른쪽 메뉴 이동 (인덱스 증가)
          const newIndex = currentIndex + 1;
          if (newIndex < PAGE_ORDER.length) {
            const targetType = PAGE_ORDER[newIndex];
            if (targetType === "home") navigate({ type: "home" });
            else if (targetType === "detail") navigate({ type: "detail", tab: "hub" });
            else if (targetType === "activity") navigate({ type: "activity", tab: "hub" });
            else if (targetType === "more") navigate({ type: "more" });
          }
        }
      }
    };

    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [view.type, navigate]);

  // 뒤로가기: drill-down 1단계만 복귀.
  // 성과/상세 하위 영역 → 해당 허브, 허브 → 홈
  const back = useCallback(() => {
    if (view.type === "settings") {
      // settings는 more에서 pushState로 진입하므로 pop으로 복귀
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate({ type: "more" });
      return;
    }
    if (view.type === "more") {
      // 진입 경로(주식 X-Ray 등) 복원 위해 진짜 history pop. 외부 진입(depth 부족) 시 home.
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
        return;
      }
      navigate({ type: "home" });
      return;
    }
    if (view.type === "activity" && view.tab !== "hub") {
      navigate({ type: "activity", tab: "hub" });
      return;
    }
    if (view.type === "detail" && view.tab !== "hub") {
      // X-Ray·거래내역 하위 페이지 → 주식 상세로 1단 복귀
      if (view.tab === "stocks-xray" || view.tab === "stocks-trades") {
        navigate({ type: "detail", tab: "stocks" });
        return;
      }
      navigate({ type: "detail", tab: "hub" });
      return;
    }
    navigate({ type: "home" });
  }, [navigate, view]);

  return (
    <NavigationContext.Provider value={{ view, navigate, back, slideDir }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useAssetNavigation(): NavCtx {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useAssetNavigation must be used within NavigationProvider");
  return ctx;
}
