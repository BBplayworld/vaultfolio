"use client";

// 투자 탭 진입점. 데이터·그림·계산은 이 탭에 들어올 때만 동적 import한다(첫 화면 JS 증가 0). 실패하면 `잠시 뒤 다시 열어 주세요` + `다시 시도`.
import dynamic from "next/dynamic";
import { Component, useMemo, useState, type ReactNode } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { holdingSplit } from "@/lib/invest/default-index";
import { pickDefaultIndex } from "@/lib/invest/calc";
import { LOAD_ERROR } from "@/lib/invest/text";
import { Button } from "@/components/ui/button";

function Skeleton() {
  return (
    <div data-testid="invest-loading" aria-hidden className="flex flex-col gap-3">
      <div className="h-10 rounded-xl bg-secondary" />
      <div className="rounded-2xl bg-card p-4 shadow-sm dark:shadow-none"><div className="h-[300px] rounded-xl bg-secondary" /></div>
    </div>
  );
}

const makeDynamic = () => dynamic(() => import("./invest-view").then((m) => m.InvestView), { ssr: false, loading: () => <Skeleton /> });

class LoadBoundary extends Component<{ children: ReactNode; onRetry: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div data-testid="invest-error" className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center shadow-sm dark:shadow-none">
        <p className="text-sm text-muted-foreground">{LOAD_ERROR}</p>
        <Button type="button" variant="secondary" onClick={() => { this.setState({ failed: false }); this.props.onRetry(); }}>다시 시도</Button>
      </div>
    );
  }
}

/** 앱 투자 탭. 기본 지수는 기기 안에서만 판정한다(보유 주식 평가액 국내 > 해외면 코스피, 그 밖은 S&P 500) — 저장·전송 0 */
export function InvestTab() {
  const { assetData, exchangeRates } = useAssetData();
  const [Comp, setComp] = useState(() => makeDynamic());
  const [boundaryKey, setBoundaryKey] = useState(0);
  const defaultIndex = useMemo(() => pickDefaultIndex(isTrialMode() ? null : holdingSplit(assetData.stocks, exchangeRates)), [assetData.stocks, exchangeRates]);
  // 진행 중 하락 모의(preview 점검용): ?asof=2022
  const asof = useMemo(() => {
    if (typeof window === "undefined" || !isPreviewEnv()) return undefined;
    const v = Number(new URLSearchParams(window.location.search).get("asof"));
    return Number.isInteger(v) && v > 1990 && v < 2100 ? v : undefined;
  }, []);
  return (
    <LoadBoundary key={boundaryKey} onRetry={() => { setComp(() => makeDynamic()); setBoundaryKey((k) => k + 1); }}>
      <Comp variant="app" defaultIndex={defaultIndex} asof={asof} />
    </LoadBoundary>
  );
}
