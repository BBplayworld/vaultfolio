"use client";

import { useEffect, useState } from "react";
import { Download, Upload, Trash2, Sparkles, Copy, Share2, Info, RefreshCw, Moon, Sun, User } from "lucide-react";
import { useNickname, NICKNAME_MAX, sanitizeNickname } from "@/hooks/use-nickname";
import { MAIN_PALETTE, ASSET_THEME } from "@/config/theme";
import { updateThemeMode } from "@/lib/theme-utils";
import { setValueToCookie } from "@/server/server-actions";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PromptPreviewDialog } from "../layout/ui/prompt-preview-dialog";
import { useAssetImport } from "@/hooks/use-asset-import";
import { exportAssetData, clearAssetData, clearUserCaches, generateShareToken, STORAGE_KEYS } from "@/lib/asset-storage";
import { getProfitBasis } from "@/lib/profit-utils";
import type { AssetSnapshots } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { AI_PROMPT_TEMPLATES, AssetPromptContext } from "@/lib/ai-prompts";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";

export function ToolMenuPage() {
  const assetDataContext = useAssetData();
  const [nickname, setNickname] = useNickname();
  const { refreshData, getAssetSummary, assetData, isSharePending } = assetDataContext;
  const { fileInputRef, isImporting, openFilePicker, handleFileChange } = useAssetImport();
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);

  const handleToggleTheme = async () => {
    const next = themeMode === "dark" ? "light" : "dark";
    updateThemeMode(next);
    setThemeMode(next);
    await setValueToCookie("theme_mode", next);
  };
  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAIPromptDialog, setShowAIPromptDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sharePin, setSharePin] = useState("");
  const [preGeneratedShortUrl, setPreGeneratedShortUrl] = useState<string | null>(null);
  const [shortUrlLoading, setShortUrlLoading] = useState(false);

  const handleExport = () => {
    try {
      exportAssetData();
      toast.success("자산 데이터가 다운로드되었습니다.");
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
    } catch (error) {
      toast.error("데이터 내보내기에 실패했습니다.");
    }
  };

  const collectSnapshots = (): AssetSnapshots => {
    try {
      const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
      const rawMonthly = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
      return {
        daily: rawDaily ? JSON.parse(rawDaily) : [],
        monthly: rawMonthly ? JSON.parse(rawMonthly) : [],
      };
    } catch {
      return { daily: [], monthly: [] };
    }
  };

  const handleShare = () => {
    setSharePin("");
    setShowShareDialog(true);
  };

  // 다이얼로그가 열리거나 PIN이 변경될 때 short URL을 미리 생성해둠.
  // 버튼 클릭 시점에는 이미 준비된 URL을 동기적으로 복사 → user activation 만료 문제 없음.
  useEffect(() => {
    if (!showShareDialog || !assetData) return;
    // PIN 4자리 완성 전에는 생성하지 않음 (PIN 필수)
    if (sharePin.length < 4) return;

    setPreGeneratedShortUrl(null);
    setShortUrlLoading(true);

    const localKey = Math.random().toString(36).substring(2, 14); // 12자리 난수

    const token = generateShareToken(assetData, assetDataContext.exchangeRates, sharePin || undefined, localKey, collectSnapshots(), getProfitBasis(), nickname || undefined);
    const ownerId = localStorage.getItem(STORAGE_KEYS.shareOwnerId) ?? undefined;
    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, owner_id: ownerId }),
    })
      .then((res) => res.json() as Promise<{ key?: string; owner_id?: string }>)
      .then((json) => {
        if (json.owner_id) {
          localStorage.setItem(STORAGE_KEYS.shareOwnerId, json.owner_id);
        }
        if (json.key) {
          const isLight = themeMode === "light";
          setPreGeneratedShortUrl(
            `${window.location.origin}${window.location.pathname}#share=s:${json.key}_${localKey}${isLight ? "&theme=light" : ""}`
          );
        }
      })
      .catch(() => { /* 미리 생성 실패 — 버튼 비활성화로 처리 */ })
      .finally(() => setShortUrlLoading(false));
    // assetData, assetDataContext.exchangeRates는 다이얼로그 열린 시점의 스냅샷만 필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShareDialog, sharePin, themeMode]);

  // confirmShare와 동일하게 미리 준비된 URL을 동기적으로 복사
  const confirmShareShort = async () => {
    if (!preGeneratedShortUrl) return;
    if (sharePin.length !== 4) {
      toast.error("PIN 번호 4자리를 입력해주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(preGeneratedShortUrl);
      toast.success(`짧은 공유 URL이 복사되었습니다. (${preGeneratedShortUrl.length}자)`);
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
      setShowShareDialog(false);
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  };

  const confirmShare = async () => {
    try {
      if (!assetData) return;

      if (sharePin.length !== 4) {
        toast.error("PIN 번호 4자리를 입력해주세요.");
        return;
      }

      const token = generateShareToken(assetData, assetDataContext.exchangeRates, sharePin, undefined, collectSnapshots(), getProfitBasis(), nickname || undefined);
      const isLight = themeMode === "light";
      const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(token)}${isLight ? "&theme=light" : ""}`;

      await navigator.clipboard.writeText(shareUrl);

      const length = token.length;
      if (length <= 200) {
        toast.success("PIN 암호화된 공유 URL이 복사되었습니다.");
      } else {
        toast.success("공유 URL이 복사되었습니다.");
        toast.info(`데이터가 많아 토큰이 ${length}자입니다. 일부 환경에서 제한될 수 있습니다.`);
      }
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
      setShowShareDialog(false);
    } catch {
      toast.error("URL 공유 준비에 실패했습니다.");
    }
  };

  const handleClear = () => {
    const success = clearAssetData();
    if (success) {
      refreshData();
      toast.success("모든 자산 데이터가 삭제되었습니다.");
    } else {
      toast.error("데이터 삭제에 실패했습니다.");
    }
    setShowClearDialog(false);
  };

  const handleClearCache = () => {
    const count = clearUserCaches();
    refreshData();
    toast.success(`캐시 ${count}개를 초기화했습니다.`);
  };

  const getPromptContext = (): AssetPromptContext => ({
    data: assetData,
    summary: getAssetSummary(),
    exchangeRates: assetDataContext.exchangeRates,
  });

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const ROW = "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border bg-card hover:bg-accent transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed";
  const ROW_DESTRUCTIVE = "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-rose-300/40 dark:border-rose-900/40 bg-rose-500/5 hover:bg-rose-500/10 transition-colors text-left text-rose-600 dark:text-rose-400 disabled:opacity-50 disabled:cursor-not-allowed";
  const SECTION_LABEL = `text-xs font-semibold ${ASSET_THEME.primary.text} mb-2 mt-1 px-1`;

  return (
    <>
      <div className="flex flex-col gap-5">
        <section>
          <p className={SECTION_LABEL}>프로필</p>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-card">
            <User className="size-5 text-primary shrink-0" />
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(sanitizeNickname(e.target.value))}
              maxLength={NICKNAME_MAX}
              placeholder="닉네임 (최대 8자)"
              aria-label="닉네임"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground"
            />
            <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{nickname.length}/{NICKNAME_MAX}</span>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>메인 도구</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={() => setShowAIPromptDialog(true)} disabled={!hasAssets}>
              <Sparkles className="size-5 text-primary shrink-0" />
              <span className="flex-1 font-medium">AI 평가용 자산 현황</span>
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">NEW</span>
            </button>
            <button type="button" className={ROW} onClick={handleShare} disabled={!hasAssets}>
              <Share2 className="size-5 text-primary shrink-0" />
              <span className="font-medium">공유 URL 복사</span>
            </button>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>데이터 관리</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={handleExport} disabled={!hasAssets}>
              <Upload className="size-5 text-primary shrink-0" />
              <span className="font-medium">데이터 내보내기</span>
            </button>
            <button type="button" className={ROW} onClick={openFilePicker} disabled={isImporting}>
              <Download className="size-5 text-primary shrink-0" />
              <span className="font-medium">{isImporting ? "가져오는 중..." : "데이터 가져오기"}</span>
            </button>
            <button type="button" className={ROW} onClick={handleClearCache} disabled={!hasAssets}>
              <RefreshCw className="size-5 text-primary shrink-0" />
              <span className="font-medium">캐시 초기화</span>
            </button>
            <button type="button" className={ROW_DESTRUCTIVE} onClick={() => setShowClearDialog(true)} disabled={!hasAssets}>
              <Trash2 className="size-5 shrink-0" />
              <span className="font-medium">모든 데이터 삭제</span>
            </button>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>설정 / 기능</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={handleToggleTheme}>
              {themeMode === "dark" ? <Sun className="size-5 text-primary shrink-0" /> : <Moon className="size-5 text-primary shrink-0" />}
              <span className="font-medium">{themeMode === "dark" ? "라이트 모드" : "다크 모드"}</span>
            </button>
            <button type="button" className={ROW} onClick={() => {
              const isWelcomeGuide = isSharePending || !hasAssets;
              if (!isWelcomeGuide) {
                window.dispatchEvent(new CustomEvent("trigger-restore-guide"));
              }
              tutorialStore.getState().showStep0(true);
            }}>
              <Info className="size-5 text-primary shrink-0" />
              <span className="font-medium">앱 가이드 보기</span>
            </button>
          </div>
        </section>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        onChange={handleFileChange}
        className="hidden"
      />

      <AlertDialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>정말 모든 데이터를 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 모든 자산 데이터가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 border-none">
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <PromptPreviewDialog
        open={showAIPromptDialog}
        onOpenChange={setShowAIPromptDialog}
        title={<><Sparkles className="size-5 text-primary" />AI 평가용 자산 종합 현황</>}
        description="아래 프롬프트를 복사하여 Grok·Gemini·GPT 등 AI에게 자산 분석 및 조언을 요청하세요."
        tabs={AI_PROMPT_TEMPLATES.map((t) => ({
          id: t.id,
          label: t.label,
          sublabel: t.sublabel,
          getPrompt: () => t.generate(getPromptContext()),
        }))}
        copySuccessMessage="AI 평가 프롬프트가 복사되었습니다."
      />

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              자산 데이터 공유
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>자산 데이터를 PIN으로 암호화하여 파트너와 공유합니다.</p>
                <p className="text-xs">
                  <span className="font-medium text-foreground">전체 URL</span> — 서버 저장 없이 URL에 직접 포함
                  {" · "}
                  <span className="font-medium text-foreground">짧은 URL</span> — 암호화된 데이터만 서버 경유, URL 키와 PIN이 분리되어 서버 관리자도 복호화 불가
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                {sharePin.length === 4 ? <Lock className="size-3.5 text-primary" /> : <Unlock className="size-3.5 text-muted-foreground" />}
                비밀번호 <span className="text-rose-500 font-semibold">(4자리, 필수)</span>
              </Label>
              <InputOTP
                maxLength={4}
                value={sharePin}
                onChange={(value) => setSharePin(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
              <p className="text-[11px] text-muted-foreground">
                받는 사람도 동일한 PIN으로 자산을 열람합니다.
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setShowShareDialog(false)}>
              취소
            </Button>
            <Button variant="rose" onClick={confirmShareShort} disabled={shortUrlLoading || !preGeneratedShortUrl || sharePin.length !== 4} type="button">
              <Share2 className="mr-2 size-4" />
              {shortUrlLoading ? "생성 중..." : "짧은 URL 복사"}
            </Button>
            <Button onClick={confirmShare} disabled={sharePin.length !== 4} type="button" style={{ backgroundColor: MAIN_PALETTE[0] }} className="text-white hover:opacity-90 border-none">
              <Copy className="mr-2 size-4" />
              전체 URL 복사
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
