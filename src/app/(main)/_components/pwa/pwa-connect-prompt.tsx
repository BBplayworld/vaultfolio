"use client";

import { useState, useEffect } from "react";
import { Link2, Loader2, ClipboardPaste, Download } from "lucide-react";
import { toast } from "sonner";

import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useAssetData } from "@/contexts/asset-data-context";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MAIN_PALETTE } from "@/config/theme";

const DISMISS_KEY = "secretasset_pwa_connect_dismissed";

/**
 * PWA 첫 실행 연결 화면 — standalone + 자산 없음일 때만 표시.
 * iOS는 홈 화면 추가 시 URL 해시가 제거되므로, 웹에서 자동 복사한 '연결 코드(s:KEY_LOCALKEY)'를
 * 붙여넣어 서버에서 자산을 가져온다. 가져오기 후 PIN 프롬프트(Provider 내부)가 자동 표시된다.
 * z-40: PIN 다이얼로그(z-50)·잠금 화면(z-100)보다 아래에 위치.
 */
export function PwaConnectPrompt() {
  const { isStandalone } = usePWAInstall();
  const { assetData, importSharedByCode, isSharePending } = useAssetData();
  const [code, setCode] = useState("");
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setMounted(true);
    try { setDismissed(sessionStorage.getItem(DISMISS_KEY) === "true"); } catch { /* 무시 */ }
  }, []);

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;

  if (!mounted || !isStandalone || hasAssets || dismissed) return null;

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) { setCode(text.trim()); toast.success("연결 코드를 붙여넣었습니다."); }
      else toast.error("클립보드가 비어 있습니다. 코드를 직접 입력해주세요.");
    } catch {
      toast.error("붙여넣기 권한이 없습니다. 코드를 직접 입력해주세요.");
    }
  };

  const handleImport = async () => {
    const trimmed = code.trim();
    if (!trimmed) { toast.error("연결 코드를 입력해주세요."); return; }
    // 가져오기 → PIN 필요 시 Provider의 PIN 프롬프트가 자동 표시됨
    await importSharedByCode(trimmed);
  };

  const handleSkip = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "true"); } catch { /* 무시 */ }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-40 bg-background flex flex-col items-center justify-center gap-6 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div
          className="flex items-center justify-center size-16 rounded-2xl text-white"
          style={{ backgroundColor: MAIN_PALETTE[0] }}
        >
          <Link2 className="size-8" />
        </div>
        <h1 className="text-lg font-bold">웹에서 쓰던 자산이 있나요?</h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
          웹에서 <span className="font-semibold text-foreground">앱 설치</span> 시 복사된 연결 코드를 붙여넣으면 자산을 그대로 가져옵니다.
        </p>
      </div>

      <div className="w-full max-w-xs flex flex-col gap-2.5">
        <Button
          variant="secondary"
          className="w-full h-11"
          onClick={handlePaste}
          disabled={isSharePending}
          type="button"
        >
          <ClipboardPaste className="mr-2 size-4" /> 연결 코드 붙여넣기
        </Button>
        <Input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="또는 코드 직접 입력 (s:...)"
          className="text-center font-mono text-sm"
          onKeyDown={(e) => { if (e.key === "Enter") void handleImport(); }}
        />
        <Button
          variant="brand"
          className="w-full h-11 text-white font-semibold"
          onClick={handleImport}
          disabled={isSharePending || !code.trim()}
          type="button"
        >
          {isSharePending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Download className="mr-2 size-4" />} 자산 가져오기
        </Button>
      </div>

      <button
        type="button"
        onClick={handleSkip}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        처음 사용해요 (빈 상태로 시작)
      </button>
    </div>
  );
}
