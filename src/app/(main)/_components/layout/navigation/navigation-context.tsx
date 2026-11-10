"use client";

import { createContext, useCallback, useContext, useEffect, useState, useRef, type ReactNode } from "react";
import { recordVisit, viewToKey } from "@/lib/feature-usage";
import { trackScreen, trackThemeMode } from "@/lib/analytics/ga";

export type DetailTab = "hub" | "stocks" | "stocks-xray" | "stocks-trades" | "real-estate" | "physical" | "crypto" | "crypto-transactions" | "cash" | "cash-transactions" | "loans" | "loan-transactions";
// change-market = 자산 변화 하위 화면 '시장과 비교'(#132)
export type ActivityTab = "hub" | "change" | "change-market" | "dividend" | "report";

// 자산 변화 화면 진입 상태(#32) — 해시에는 싣지 않는다(옛 해시 리다이렉트·결산 카드·FAB가 초기 탭을 지정)
export type ChangeScope = "all" | "stock";
export type ChangePeriod = "day" | "week" | "month" | "year";
export interface ChangeInit {
  scope?: ChangeScope;
  period?: ChangePeriod;
  month?: string;           // 월 탭에서 선택할 달(YYYY-MM)
  source?: "card" | "menu" | "home_tip"; // settlement_view 진입 경로(home_tip = 홈 결산 팁, #4.36)
}

export type AssetView =
  | { type: "home" }
  | { type: "more" }
  | { type: "settings" }
  | { type: "tax" }
  | { type: "detail"; tab: DetailTab }
  | { type: "activity"; tab: ActivityTab; init?: ChangeInit };

const DETAIL_TABS: readonly DetailTab[] = ["hub", "stocks", "stocks-xray", "stocks-trades", "real-estate", "physical", "crypto", "crypto-transactions", "cash", "cash-transactions", "loans", "loan-transactions"];
const ACTIVITY_TABS: readonly ActivityTab[] = ["hub", "change", "change-market", "dividend", "report"];

// 시장과 비교(#132 K3) — 자산 변화에서 들어갈 때 범위·기간을 모듈 메모리에 기억하고, 비교 화면에서 pop으로 자산 변화에 돌아오면 그 값으로 다시 연다.
// history.state는 쓰지 않는다(Next App Router가 __NA 없는 state의 popstate를 전체 새로고침으로 처리). 저장소 0, 새로고침하면 사라짐
let changeInitForReturn: ChangeInit | null = null;
export function rememberChangeInit(init: Pick<ChangeInit, "scope" | "period">): void {
  changeInitForReturn = { scope: init.scope, period: init.period };
}

// popstate 대상 view에 복원 상태를 입힌다 — 비교 화면에서 자산 변화로 돌아올 때만(해시 리다이렉트 init이 있으면 그대로)
export function withRestoredChangeInit(next: AssetView, from: AssetView, remembered: ChangeInit | null): AssetView {
  if (next.type !== "activity" || next.tab !== "change" || next.init) return next;
  if (from.type !== "activity" || from.tab !== "change-market" || !remembered) return next;
  return { ...next, init: { ...remembered } };
}

// 시장과 비교에 앱 안에서 들어왔는지(모듈 메모리, 새로고침하면 false) — 뒤로 = history.back() / 주소 진입 = 자산 변화(주식·주)
let marketCompareEnteredInApp = false;
export function marketCompareBackAction(enteredInApp: boolean, historyLength: number): "pop" | "change" {
  return enteredInApp && historyLength > 1 ? "pop" : "change";
}
// 옛 해시(북마크·공유 링크 보호) → 자산 변화의 해당 범위·기간으로 리다이렉트(#32)
const LEGACY_ACTIVITY_TABS: Record<string, ChangeInit> = {
  netasset: { scope: "all", period: "year" },
  profit: { scope: "stock", period: "day" },
};

// 1차 메뉴 좌우 순서 — 스와이프 이동·슬라이드 방향 계산 공용
const PAGE_ORDER = ["home", "detail", "activity", "more"] as const;
type MainViewType = typeof PAGE_ORDER[number];
// 슬라이드 전환 방향: "right"=오른쪽에서 진입(다음 메뉴), "left"=왼쪽에서 진입(이전 메뉴)
export type SlideDir = "left" | "right" | null;
// settings·tax는 더보기 하위 페이지 — 스와이프 위치상 more로 취급(PAGE_ORDER는 불변)
const mainTypeOf = (t: AssetView["type"]): MainViewType => (t === "settings" || t === "tax" ? "more" : t);

export function parseHash(hash: string): AssetView {
  const clean = hash.replace(/^#/, "");
  if (!clean || clean === "home") return { type: "home" };
  if (clean === "more") return { type: "more" };
  if (clean === "settings") return { type: "settings" };
  if (clean === "tax") return { type: "tax" };
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
    if (tab && Object.hasOwn(LEGACY_ACTIVITY_TABS, tab)) return { type: "activity", tab: "change", init: { ...LEGACY_ACTIVITY_TABS[tab] } };
  }
  return { type: "home" };
}

export function toHash(view: AssetView): string {
  if (view.type === "home") return "";
  if (view.type === "more") return "#more";
  if (view.type === "settings") return "#settings";
  if (view.type === "tax") return "#tax";
  // 허브는 짧은 #detail / #activity 형태 유지
  if (view.tab === "hub") return `#${view.type}`;
  return `#${view.type}/${view.tab}`;
}

// 뒤로가기 버튼에 표시할 라벨 — 현재 view가 아니라 "돌아갈 view"를 표시
// - 허브(detail/activity)에서 뒤로 → 홈
// - 하위 페이지(stocks/change 등)에서 뒤로 → 해당 허브("상세"/"성과")
export function getBackLabel(view: AssetView): string {
  if (view.type === "home") return "";
  if (view.type === "more") return "홈";
  if (view.type === "settings") return "더보기";
  // 세금 일정은 홈 배너·더보기 두 경로에서 진입하므로 중립 라벨(실제 복귀는 history.back)
  if (view.type === "tax") return "뒤로";
  // 시장과 비교는 상세·주식·자산 변화 두 곳에서 진입 → 중립 라벨(#132)
  if (view.type === "activity" && view.tab === "change-market") return "뒤로";
  if (view.tab === "hub") return "홈";
  if (view.type === "detail" && (view.tab === "stocks-xray" || view.tab === "stocks-trades")) return "주식";
  if (view.type === "detail" && view.tab === "cash-transactions") return "현금";
  if (view.type === "detail" && view.tab === "loan-transactions") return "대출";
  if (view.type === "detail" && view.tab === "crypto-transactions") return "암호화폐";
  return view.type === "detail" ? "상세" : "성과";
}

type NavCtx = {
  view: AssetView;
  // 두 번째 인자(이동 출처)는 호출부 호환용 — GA 전송에는 쓰지 않는다(4.41)
  navigate: (v: AssetView, navSource?: "tap" | "swipe" | "back") => void;
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
    // 옛 해시(#activity/netasset 등)로 들어오면 주소창도 새 해시로 바꿔 둔다(히스토리 추가 없음)
    if (initial.type === "activity" && initial.init && window.location.hash !== toHash(initial)) {
      window.history.replaceState(null, "", toHash(initial));
    }
    viewRef.current = initial;
    setView(initial);
    // GA 화면 page_view(S-4.28) — 해시가 아닌 가상 경로(/v/<화면키>)로 전송. #share·#sync는 parseHash가 home으로 처리
    trackScreen(viewToKey(initial));
    // 현재 테마(<html class="dark"> 여부)를 세션당 1회 계측 — 설정에서 전환하면 settings-page가 새 모드로 재전송
    trackThemeMode(document.documentElement.classList.contains("dark") ? "dark" : "light");
    const onPop = () => {
      const next = withRestoredChangeInit(parseHash(window.location.hash), viewRef.current, changeInitForReturn);
      if (next.type === "activity" && next.init && window.location.hash !== toHash(next)) {
        window.history.replaceState(null, "", toHash(next));
      }
      setSlideDir(computeSlideDir(viewRef.current, next));
      viewRef.current = next;
      setView(next);
      scrollPastHeader();
      trackScreen(viewToKey(next));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const navigate = useCallback((v: AssetView) => {
    const hash = toHash(v);
    if (v.type === "activity" && v.tab === "change-market") marketCompareEnteredInApp = true;
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
    // 기능 방문 기록 — 모든 이동이 이 함수를 통과하므로 훅 지점은 여기 한 곳으로 충분(기기 로컬 전용)
    recordVisit(viewToKey(v));
    trackScreen(viewToKey(v));
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
    if (view.type === "settings" || view.type === "tax") {
      // settings·tax는 pushState로 진입하므로 pop으로 복귀 (tax는 홈·더보기 양쪽에서 진입 가능)
      if (typeof window !== "undefined" && window.history.length > 1) {
        window.history.back();
        return;
      }
      // 콜드스타트(history 없음, 딥링크 진입 등)는 항상 홈으로 — settings를 "more"로 보내면
      // more의 back()이 다시 history.back()에 의존해 설정↔더보기 핑퐁 루프가 발생했다(홈 도달 불가)
      navigate({ type: "home" });
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
    // 시장과 비교: 앱 안 진입이면 들어온 화면으로 pop(상태 복원은 K3), 주소 진입·새로고침이면 자산 변화(주식·주)
    if (view.type === "activity" && view.tab === "change-market") {
      if (typeof window !== "undefined" && marketCompareBackAction(marketCompareEnteredInApp, window.history.length) === "pop") {
        window.history.back();
        return;
      }
      navigate({ type: "activity", tab: "change", init: { scope: "stock", period: "week" } });
      return;
    }
    if (view.type === "activity" && view.tab !== "hub") {
      navigate({ type: "activity", tab: "hub" });
      return;
    }
    if (view.type === "detail" && view.tab !== "hub") {
      // 거래내역 → 주식 상세로 1단 복귀
      if (view.tab === "stocks-trades") {
        navigate({ type: "detail", tab: "stocks" });
        return;
      }
      // 현금 입출금 내역 → 현금 상세로 1단 복귀
      if (view.tab === "cash-transactions") {
        navigate({ type: "detail", tab: "cash" });
        return;
      }
      // 대출 상환/추가대출 내역 → 대출 상세로 1단 복귀
      if (view.tab === "loan-transactions") {
        navigate({ type: "detail", tab: "loans" });
        return;
      }
      // 코인 매수/매도 내역 → 코인 상세로 1단 복귀
      if (view.tab === "crypto-transactions") {
        navigate({ type: "detail", tab: "crypto" });
        return;
      }
      // X-Ray는 진입 경로가 다양(주식탭 하위·성적표 딥링크 등) → 실제 진입 경로로 되돌리는 history pop
      if (view.tab === "stocks-xray") {
        if (typeof window !== "undefined" && window.history.length > 1) {
          window.history.back();
          return;
        }
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
