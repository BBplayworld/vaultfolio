"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type DetailTab = "hub" | "stocks" | "stocks-xray" | "real-estate" | "crypto" | "cash" | "loans";
export type ActivityTab = "hub" | "netasset" | "profit" | "dividend";

export type AssetView =
  | { type: "home" }
  | { type: "more" }
  | { type: "detail"; tab: DetailTab }
  | { type: "activity"; tab: ActivityTab };

const DETAIL_TABS: readonly DetailTab[] = ["hub", "stocks", "stocks-xray", "real-estate", "crypto", "cash", "loans"];
const ACTIVITY_TABS: readonly ActivityTab[] = ["hub", "netasset", "profit", "dividend"];

export function parseHash(hash: string): AssetView {
  const clean = hash.replace(/^#/, "");
  if (!clean || clean === "home") return { type: "home" };
  if (clean === "more") return { type: "more" };
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
  // 허브는 짧은 #detail / #activity 형태 유지
  if (view.tab === "hub") return `#${view.type}`;
  return `#${view.type}/${view.tab}`;
}

// 뒤로가기 버튼에 표시할 라벨 — 현재 view가 아니라 "돌아갈 view"를 표시
// - 허브(detail/activity)에서 뒤로 → 홈
// - 하위 페이지(stocks/netasset 등)에서 뒤로 → 해당 허브("상세"/"성과")
export function getBackLabel(view: AssetView): string {
  if (view.type === "home") return "";
  if (view.type === "more") return "더보기";
  if (view.tab === "hub") return "홈";
  if (view.type === "detail" && view.tab === "stocks-xray") return "주식";
  return view.type === "detail" ? "상세" : "성과";
}

type NavCtx = {
  view: AssetView;
  navigate: (v: AssetView) => void;
  back: () => void;
};

const NavigationContext = createContext<NavCtx | null>(null);

// 페이지 이동 시 최상단으로 스크롤
function scrollPastHeader() {
  if (typeof window === "undefined") return;
  window.scrollTo({ top: 0, behavior: "auto" });
}

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AssetView>({ type: "home" });

  // 초기 hash 1회 동기화 (SSR 안전)
  useEffect(() => {
    setView(parseHash(window.location.hash));
    const onPop = () => {
      setView(parseHash(window.location.hash));
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
    setView(v);
    // 페이지 이동 시 항상 최상단
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  // 뒤로가기: drill-down 1단계만 복귀.
  // 성과/상세 하위 영역 → 해당 허브, 허브 → 홈
  const back = useCallback(() => {
    if (view.type === "more") {
      navigate({ type: "home" });
      return;
    }
    if (view.type === "activity" && view.tab !== "hub") {
      navigate({ type: "activity", tab: "hub" });
      return;
    }
    if (view.type === "detail" && view.tab !== "hub") {
      // X-Ray 하위 페이지 → 주식 상세로 1단 복귀
      if (view.tab === "stocks-xray") {
        navigate({ type: "detail", tab: "stocks" });
        return;
      }
      navigate({ type: "detail", tab: "hub" });
      return;
    }
    navigate({ type: "home" });
  }, [navigate, view]);

  return (
    <NavigationContext.Provider value={{ view, navigate, back }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useAssetNavigation(): NavCtx {
  const ctx = useContext(NavigationContext);
  if (!ctx) throw new Error("useAssetNavigation must be used within NavigationProvider");
  return ctx;
}
