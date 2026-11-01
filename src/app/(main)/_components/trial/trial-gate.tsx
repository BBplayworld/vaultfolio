"use client";

/**
 * trial-gate.tsx — 체험 모드 게이트(#59). `ReactQueryProvider` 안·`AssetDataProvider` 바깥(PreviewGate보다 바깥)에 둔다.
 *  - `?trial=1`이 없으면 children만 그대로 반환(DOM 추가 0, 첫 렌더 지연 0).
 *  - 있으면 children을 보류하고 빈 로딩 덮개 → trial-boot(동적 import) → 결과에 따라
 *    체험(메모리 금고) / 거부(쿼리만 제거한 일반 화면) / 실패(새로고침 — 전역 교체가 일부 남았을 수 있음).
 * 쿼리 판정은 SSR과 같은 값(useSearchParams)으로 첫 렌더에 1회 고정한다 — 처리 후 쿼리를 지워도 바뀌지 않게.
 */

import { ReactNode, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Z_LAYER } from "@/config/theme";
import { TRIAL_QUERY_KEY } from "@/lib/trial/trial-mode";

export function TrialGate({ children }: { children?: ReactNode }) {
  const params = useSearchParams();
  const [entry] = useState(() => params?.get(TRIAL_QUERY_KEY) === "1");
  if (!entry) return <>{children}</>;
  return <TrialGateInner>{children}</TrialGateInner>;
}

function TrialGateInner({ children }: { children?: ReactNode }) {
  const [ready, setReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    import("@/lib/trial/trial-boot")
      .then((m) => m.runTrialBoot())
      .then((result) => {
        // 설치를 시도한 뒤 실패 → 교체된 전역이 남지 않게 쿼리 없는 주소로 다시 연다(앱은 아직 마운트 전)
        if (result === "failed") { window.location.reload(); return; }
        setReady(true);
      })
      .catch(() => {
        // 모듈 로드 실패 — 아무것도 설치되지 않음 → 쿼리만 지우고 일반 화면
        try {
          const url = new URL(window.location.href);
          url.searchParams.delete(TRIAL_QUERY_KEY);
          window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
        } catch { /* 무시 */ }
        setReady(true);
      });
  }, []);

  if (ready) return <>{children}</>;
  return (
    <div
      data-testid="trial-gate-loading"
      role="status"
      aria-busy="true"
      className="fixed inset-0 flex items-center justify-center bg-background"
      style={{ zIndex: Z_LAYER.gate }}
    >
      {/* 페이드(바깥)와 회전(안쪽)은 같은 animation 속성이라 노드를 나눈다 — 300ms 지연은 페이드에만 */}
      <span
        aria-hidden
        className="motion-safe:animate-in motion-safe:fade-in"
        style={{ animationDelay: "300ms", animationFillMode: "backwards" }}
      >
        <Loader2 className="size-5 text-muted-foreground motion-safe:animate-spin" />
      </span>
      <span className="sr-only">불러오는 중</span>
    </div>
  );
}
