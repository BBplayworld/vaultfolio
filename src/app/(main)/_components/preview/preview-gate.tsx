"use client";

/**
 * preview-gate.tsx — Vercel preview 전용(#31). 운영·로컬(isPreviewEnv() false)에서는 children만 그대로 렌더해 DOM 추가 0.
 *  - PREVIEW · v4.NN 배지
 *  - ?demo=1 데모 주입 / ?demo=empty 빈 상태 → 쿼리 제거 → html[data-demo-ready="1"]
 *  - 쿼리 없이 자산 0건이면 하단 선택 카드(데모 데이터로 보기 / 빈 상태로 보기)
 *  - 데모 주입 상태에서는 튜토리얼을 띄우지 않는다(#4.36). ?demo=empty는 데모가 건너뛴 튜토리얼만 원상복구
 * AssetDataProvider 바깥에 두고 주입이 끝날 때까지 children을 렌더하지 않아, provider가 새 데이터를 처음부터 읽는다.
 */

import { ReactNode, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/config/app-version";
import { Z_LAYER } from "@/config/theme";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { applyImportedPayload, clearAssetData, getAssetData, STORAGE_KEYS } from "@/lib/asset/asset-storage";
import { buildDemoRefreshMeta, kstToday, materializeDemo, resolvePreviewAction } from "@/lib/preview/demo-payload";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import type { AssetData } from "@/types/asset";

const hasAnyAssets = (d: AssetData) =>
  d.realEstate.length + d.stocks.length + d.crypto.length + d.cash.length + d.loans.length > 0;

// 데모가 튜토리얼을 건너뛰었다는 preview 전용 표식 — clearAssetData가 지우는 secretasset_ 키라 ?demo=empty·전체 삭제 때 함께 사라진다
export const DEMO_TUTORIAL_MARKER = "secretasset_preview_demo_tutorial_skipped";

/** ?demo=1 주입 직후: 튜토리얼 전체 건너뛰기(가져오기와 같은 skipAllTutorialSteps) + 표식 */
export function applyDemoTutorialSkip(): void {
  skipAllTutorialSteps();
  localStorage.setItem(DEMO_TUTORIAL_MARKER, "1");
  tutorialStore.getState().initTutorial();
}

/** ?demo=empty 처리 직전: 데모가 건너뛴 튜토리얼만 첫 사용 상태로 되돌린다(데모 이력 없으면 무동작 — 기존 동작 그대로) */
export function resetDemoTutorialSkip(): void {
  if (localStorage.getItem(DEMO_TUTORIAL_MARKER) !== "1") return;
  localStorage.removeItem(STORAGE_KEYS.tutorialStatus);
  localStorage.removeItem(DEMO_TUTORIAL_MARKER);
  tutorialStore.getState().initTutorial();
}

// 데모 주입 — 검증 실패 시 applyImportedPayload가 기존 데이터를 지우기 전에 throw한다
async function injectDemo(): Promise<void> {
  const mod = await import("@/lib/preview/demo-data.json");
  applyImportedPayload(materializeDemo(mod.default, kstToday()));
  // assetRefresh는 clearAssetData의 보존 키라 import로 덮이지 않음 → 기존 키·형식으로 직접 기록(멱등)
  localStorage.setItem(STORAGE_KEYS.assetRefresh, JSON.stringify(buildDemoRefreshMeta()));
  applyDemoTutorialSkip();
}

// 처리한 ?demo 쿼리 제거 — 새로고침 시 재주입 방지(사용자가 preview에서 만든 변경 보존)
function stripDemoQuery() {
  const url = new URL(window.location.href);
  url.searchParams.delete("demo");
  window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
}

export function PreviewGate({ children }: { children?: ReactNode }) {
  if (!isPreviewEnv()) return <>{children}</>;
  return <PreviewGateInner>{children}</PreviewGateInner>;
}

type Phase = "init" | "loading" | "ready" | "failed";

function PreviewGateInner({ children }: { children?: ReactNode }) {
  const [phase, setPhase] = useState<Phase>("init");
  const [showChoice, setShowChoice] = useState(false);
  const [pending, setPending] = useState<"demo" | "empty" | null>(null);
  const [demoDone, setDemoDone] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const action = resolvePreviewAction(true, window.location.search, hasAnyAssets(getAssetData()));
    if (action === "demo") {
      setPhase("loading");
      setPending("demo");
      injectDemo()
        .then(() => {
          stripDemoQuery();
          setPending(null);
          setPhase("ready");
          setDemoDone(true);
        })
        .catch(() => {
          setPending(null);
          setPhase("failed");
        });
      return;
    }
    if (action === "empty") {
      resetDemoTutorialSkip(); // clearAssetData가 표식을 지우기 전에 판정
      clearAssetData();
      stripDemoQuery();
      setPhase("ready");
      setDemoDone(true); // 선택 카드는 이 페이지 수명 동안 띄우지 않는다
      return;
    }
    setShowChoice(action === "choose");
    setPhase("ready");
  }, []);

  // children 렌더 이후 qa 대기 신호 설정
  useEffect(() => {
    if (demoDone) document.documentElement.dataset.demoReady = "1";
  }, [demoDone]);

  // 선택 카드 노출 중 사용자가 직접 자산을 추가하면 카드 제거(preview 전용 가벼운 확인)
  useEffect(() => {
    if (!showChoice) return;
    const id = window.setInterval(() => {
      if (hasAnyAssets(getAssetData())) setShowChoice(false);
    }, 1500);
    return () => window.clearInterval(id);
  }, [showChoice]);

  const choose = (kind: "demo" | "empty") => {
    setPending(kind);
    const url = new URL(window.location.href);
    url.searchParams.set("demo", kind === "demo" ? "1" : "empty");
    window.location.assign(url.pathname + url.search + url.hash);
  };

  const renderChildren = phase === "ready" || phase === "failed";
  const showCard = showChoice || phase === "loading" || phase === "failed";
  const busy = pending !== null;

  return (
    <>
      {renderChildren && children}
      {/* 헤더(mt-1 h-12 = 52px) 바로 아래 중앙 — 375px에서 top-0이면 상세/성과 탭·우측 아이콘과 겹친다(헤더는 비고정이라 스크롤 시 본문 위에 뜨며 클릭은 통과) */}
      <div
        data-testid="preview-badge"
        data-screenshot-hide
        aria-hidden="true"
        style={{ zIndex: Z_LAYER.modal - 1 }}
        className="pointer-events-none fixed top-[3.25rem] left-1/2 flex h-5 -translate-x-1/2 select-none items-center whitespace-nowrap rounded-md bg-muted px-2 text-xs font-medium tabular-nums text-muted-foreground opacity-90 shadow-sm"
      >
        PREVIEW · v{APP_VERSION}
      </div>
      {showCard && (
        <div
          data-screenshot-hide
          style={{ zIndex: Z_LAYER.modal - 1 }}
          className="fixed inset-x-0 bottom-0 pb-[max(0.75rem,env(safe-area-inset-bottom))] motion-safe:animate-in motion-safe:fade-in"
        >
          <div className="mx-3 flex flex-col gap-3 rounded-xl bg-card p-3 shadow-sm" aria-busy={busy}>
            {phase === "failed" ? (
              <p role="alert" className="text-sm text-destructive text-pretty">
                데이터를 불러오지 못했어요. 다시 시도해 주세요
              </p>
            ) : (
              <p className="text-sm text-muted-foreground text-pretty">
                {busy ? "데이터를 불러오는 중이에요" : "미리보기 환경이에요. 점검할 상태를 골라 주세요."}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button
                data-testid="preview-demo-btn"
                variant="brand"
                className="min-h-10 break-keep"
                disabled={busy}
                onClick={() => choose("demo")}
              >
                {pending === "demo" && <Loader2 className="animate-spin" />}
                데모 데이터로 보기
              </Button>
              <Button
                data-testid="preview-empty-btn"
                variant="outline"
                className="min-h-10 break-keep"
                disabled={busy}
                onClick={() => choose("empty")}
              >
                {pending === "empty" && <Loader2 className="animate-spin" />}
                빈 상태로 보기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
