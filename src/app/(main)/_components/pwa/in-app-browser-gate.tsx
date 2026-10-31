"use client";

import { useState, useEffect } from "react";
import { ExternalLink, Loader2, Lock, Unlock, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useShareArtifacts } from "@/hooks/use-share-artifacts";
import { useExternalMove } from "@/hooks/use-external-move";
import { useAssetData } from "@/contexts/asset-data-context";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { getAssetId } from "@/lib/cloud-sync/sync-state";
import { isCloudSyncEnabled } from "@/lib/cloud-sync/config";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { InAppExternalGuide } from "./in-app-external-guide";
import { Z_LAYER } from "@/config/theme";

/**
 * 인앱 브라우저 하드 게이트 — 카카오톡·네이버 등 인앱 브라우저 진입 시 앱 전체를 가리고
 * 외부 브라우저(Chrome/Safari)로 이동시킨다.
 *  - Android: 스킴으로 자동 이동(카카오톡=openExternal, 그 외=intent://).
 *  - iOS: 자동 이동 스킴이 없어 현재 주소를 클립보드에 복사하고 수동 가이드로 폴백.
 *  - 자산 없음: origin URL로 단순 이동. 자산 있음: PIN 입력 → 복원코드 URL로 이동.
 *  - 동기화 기기: PIN 없이 sync 링크로 이동(새 기기에서 금고 암호로 복원).
 *  - 자산 0건 + 공유·동기화 대기 없음: 게이트 미렌더 → 웰컴 인앱 슬롯이 외부 이동을 안내(#60).
 *  - 데이터 로드 전: 문구 없는 빈 덮개(같은 루트 노드) — 0건 방문자에게 경고가 깜빡이지 않게.
 */

/** 복원 링크 해시(공유·동기화) 여부 — 처리 후 replaceState로 지워지므로 마운트 시 1회 캡처해 쓴다 */
export function hasRestoreHash(hash: string): boolean {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return ["share", "sync", "asset", "vault"].some((k) => params.has(k));
}

export type InAppGateState = "none" | "cover" | "welcome" | "gate";

/** 게이트 판정(순수) — none: 미렌더 / cover: 로드 전 빈 덮개 / welcome: 웰컴에 맡김(미렌더) / gate: 현행 게이트 */
export function resolveInAppGate(env: {
  mounted: boolean;
  isStandalone: boolean;
  isInApp: boolean;
  isDataLoaded: boolean;
  hasAssets: boolean;
  isSharePending: boolean;
  syncAssetId: string | null;
  restoreHash: boolean;
}): InAppGateState {
  if (!env.mounted || env.isStandalone || !env.isInApp) return "none";
  if (!env.isDataLoaded) return "cover";
  if (!env.hasAssets && !env.isSharePending && !env.syncAssetId && !env.restoreHash) return "welcome";
  return "gate";
}

export function InAppBrowserGate() {
  const { isInApp, isIOS, isStandalone } = usePWAInstall();
  const { syncLink } = useCloudSync();
  const { generateShareArtifacts, hasAssets } = useShareArtifacts();
  const { isDataLoaded, isSharePending } = useAssetData();
  const { go, iosFallback } = useExternalMove(isIOS);
  // 첫 렌더(effect 전)에 1회 캡처 — 공유·동기화 처리 effect가 해시를 지우기 전 값
  const [restoreHash] = useState(() => typeof window !== "undefined" && hasRestoreHash(window.location.hash));

  const [mounted, setMounted] = useState(false);
  const [pinStep, setPinStep] = useState(false);
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setMounted(true), []);

  const syncAssetId = mounted && isCloudSyncEnabled() ? getAssetId() : null;
  const isSyncMode = !!syncAssetId;

  const gate = resolveInAppGate({ mounted, isStandalone, isInApp, isDataLoaded, hasAssets, isSharePending, syncAssetId, restoreHash });
  if (gate === "none" || gate === "welcome") return null;

  const handleMove = async () => {
    // 동기화 기기: PIN 없이 sync 링크로 이동
    if (isSyncMode && syncLink) { await go(syncLink); return; }
    // 자산 없음: origin으로 단순 이동
    if (!hasAssets) { await go(window.location.origin + "/"); return; }
    // 자산 있음: PIN 입력 단계로
    setPinStep(true);
  };

  const handleMoveWithPin = async () => {
    if (pin.length !== 4) { toast.error("PIN 번호 4자리를 입력해주세요."); return; }
    setLoading(true);
    try {
      // 복원코드 URL 생성. 실패 시 origin으로라도 이동(앱은 열리고 자산은 수동 재연동).
      const urlPromise = generateShareArtifacts(pin).then(a =>
        a ? window.location.origin + a.url : window.location.origin + "/",
      );
      await go(urlPromise);
    } finally {
      setLoading(false);
    }
  };

  return (
    // 덮개와 게이트는 같은 루트 노드 — 로드 후 1건 이상이면 노드 교체 없이 내용만 채워진다
    <div
      data-testid={gate === "cover" ? "inapp-gate-cover" : undefined}
      aria-hidden={gate === "cover" ? true : undefined}
      className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-background px-6 py-10"
      style={{ zIndex: Z_LAYER.gate }}
    >
      {gate === "gate" && (
        <div className="w-full max-w-md flex flex-col gap-5">
          <header className="flex flex-col items-center gap-3 text-center">
            <div className="flex items-center justify-center size-14 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="size-7" />
            </div>
            <h1 className="text-lg font-bold text-balance">외부 브라우저에서 열어주세요</h1>
            <p className="text-sm text-muted-foreground leading-relaxed text-pretty">
              카카오톡·네이버 등 인앱 브라우저에서는 브라우저 세션이 끊겨 데이터가 유실될 수 있어 안전하게 이용할 수 없습니다.
              Chrome·Safari 등 외부 브라우저에서 열어주세요.
            </p>
          </header>

          {iosFallback ? (
            <InAppExternalGuide />
          ) : pinStep ? (
            <div className="flex flex-col items-center gap-4">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                {pin.length === 4 ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                데이터 전송용 PIN 번호 <span className="text-rose-500 font-semibold">(4자리, 필수)</span>
              </Label>
              <InputOTP maxLength={4} value={pin} onChange={setPin} autoFocus>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-sm text-muted-foreground text-center leading-relaxed">
                현재 자산 데이터를 외부 브라우저로 안전하게 옮기기 위한 1회성 비밀번호입니다.
                외부 브라우저에서 앱을 열 때 동일한 PIN을 입력하면 복원됩니다.
              </p>
              <Button
                variant="brand"
                onClick={handleMoveWithPin}
                disabled={loading || pin.length !== 4}
                className="w-full h-11 font-semibold text-white"
              >
                {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ExternalLink className="mr-2 size-4" />}
                외부 브라우저로 이동
              </Button>
            </div>
          ) : (
            <Button
              variant="brand"
              onClick={handleMove}
              className="w-full h-11 font-semibold text-white"
            >
              <ExternalLink className="mr-2 size-4" />
              외부 브라우저로 열기
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
