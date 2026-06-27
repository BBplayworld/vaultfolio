"use client";

import { useEffect, useState, useRef } from "react";
import { Sparkles, Copy, Share2, Info, User, MessageSquarePlus, Loader2, Settings, ChevronRight, Cloud, RefreshCw, BellRing } from "lucide-react";
import { useNickname, NICKNAME_MAX, sanitizeNickname } from "@/hooks/use-nickname";
import { MAIN_PALETTE, ASSET_THEME } from "@/config/theme";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { PromptPreviewDialog } from "../layout/ui/prompt-preview-dialog";
import { CloudSyncMenuEntry } from "../functions/cloud-sync/cloud-sync-menu-entry";
import { NOTICE_TITLE, NoticeContent } from "../layout/onboarding/notice";
import { generateShareToken, STORAGE_KEYS } from "@/lib/asset-storage";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { getProfitBasis } from "@/lib/profit-utils";
import type { AssetSnapshots } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { AI_PROMPT_TEMPLATES, AssetPromptContext } from "@/lib/ai-prompts";
import { useAssetNavigation } from "../layout/navigation/navigation-context";

export function ToolMenuPage() {
  const assetDataContext = useAssetData();
  const [nickname, setNickname] = useNickname();
  const { refreshData, getAssetSummary, assetData, isSharePending } = assetDataContext;
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const { navigate } = useAssetNavigation();
  const cs = useCloudSync();

  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;
  const [showAIPromptDialog, setShowAIPromptDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const otpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showShareDialog) {
      setTimeout(() => otpRef.current?.focus(), 150);
    }
  }, [showShareDialog]);

  const [showShareSyncChooser, setShowShareSyncChooser] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [sharePin, setSharePin] = useState("");
  const [preGeneratedShortUrl, setPreGeneratedShortUrl] = useState<string | null>(null);
  const [shortUrlLoading, setShortUrlLoading] = useState(false);
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [showHelpChooser, setShowHelpChooser] = useState(false);
  const [showNotice, setShowNotice] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackContact, setFeedbackContact] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);

  const FEEDBACK_MAX = 2000;
  const submitFeedback = async () => {
    const message = feedbackMessage.trim();
    if (!message) {
      toast.error("요청 내용을 입력해주세요.");
      return;
    }
    setFeedbackSending(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, nickname: nickname || undefined, contact: feedbackContact.trim() || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error || "전송에 실패했습니다.");
        return;
      }
      toast.success("의견이 전달되었습니다. 감사합니다!");
      setShowFeedbackDialog(false);
      setFeedbackMessage("");
      setFeedbackContact("");
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setFeedbackSending(false);
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
  useEffect(() => {
    if (!showShareDialog || !assetData) return;
    if (sharePin.length < 4) return;

    setPreGeneratedShortUrl(null);
    setShortUrlLoading(true);

    const localKey = Math.random().toString(36).substring(2, 14);

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
          setPreGeneratedShortUrl(
            `${window.location.origin}${window.location.pathname}#share=share:${json.key}_${localKey}&theme=${themeMode}`
          );
        }
      })
      .catch(() => { /* 미리 생성 실패 */ })
      .finally(() => setShortUrlLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShareDialog, sharePin, themeMode]);

  const confirmShareShort = async () => {
    if (!preGeneratedShortUrl) return;
    if (sharePin.length !== 4) {
      toast.error("PIN 번호 4자리를 입력해주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(preGeneratedShortUrl);
      toast.success("공유 URL이 복사되었습니다.");
      window.dispatchEvent(new CustomEvent("tutorial-complete-step2"));
      setShowShareDialog(false);
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
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
          <p className={SECTION_LABEL}>공유 · 동기화</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={() => setShowShareSyncChooser(true)} disabled={!hasAssets}>
              <Cloud className="size-5 text-primary shrink-0" />
              <span className="font-medium">자산 공유 · 동기화</span>
              {cs.status === "armed" && (
                <RefreshCw className={`size-4 text-primary shrink-0 ${cs.syncing ? "animate-spin" : ""}`} />
              )}
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>도구</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={() => setShowAIPromptDialog(true)} disabled={!hasAssets}>
              <Sparkles className="size-5 text-primary shrink-0" />
              <span className="flex-1 font-medium">AI 평가용 자산 현황</span>
              <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">Plus</span>
            </button>
          </div>
        </section>

        <section>
          <p className={SECTION_LABEL}>지원</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={() => setShowFeedbackDialog(true)}>
              <MessageSquarePlus className="size-5 text-primary shrink-0" />
              <span className="font-medium">의견·요청 보내기</span>
            </button>
            <button type="button" className={ROW} onClick={() => setShowHelpChooser(true)}>
              <Info className="size-5 text-primary shrink-0" />
              <span className="font-medium">앱 가이드 · 공지사항</span>
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-2">
            <button type="button" className={ROW} onClick={() => navigate({ type: "settings" })}>
              <Settings className="size-5 text-primary shrink-0" />
              <span className="font-medium">설정</span>
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          </div>
        </section>
      </div>

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

      <Dialog open={showShareSyncChooser} onOpenChange={setShowShareSyncChooser}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="size-5 text-primary" />
              자산 공유 · 동기화
            </DialogTitle>
            <DialogDescription className="text-left">
              자산을 다른 기기로 공유하거나 동기화합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <button
              type="button"
              className="flex flex-col text-left p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/50 transition-all duration-200 group relative overflow-hidden"
              onClick={() => {
                setShowShareSyncChooser(false);
                handleShare();
              }}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <Share2 className="size-5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-foreground">간편 공유</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                URL로 다른 기기에 <strong className="text-foreground font-semibold">1회 전달</strong>합니다 (PIN 설정 필요).
              </p>
            </button>

            <button
              type="button"
              className="flex flex-col text-left p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/50 transition-all duration-200 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!cs.enabled}
              onClick={() => {
                setShowShareSyncChooser(false);
                setShowCloudSync(true);
              }}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div className="flex items-center gap-2">
                  <Cloud className="size-5 text-primary group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-foreground">기기 동기화</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">
                    Plus
                  </span>
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold text-muted-foreground">
                    베타 무료
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                여러 기기에서 자산 데이터를 <strong className="text-foreground font-semibold">항상 최신으로 자동 유지</strong>합니다.
              </p>
              <p className="text-[11px] text-primary/80 mt-1.5 leading-relaxed">
                Plus 요금제 출시 전 한시적 프로모션으로 지금은 무료예요.
              </p>
            </button>
          </div>

          <DialogFooter className="flex justify-end">
            <Button variant="outline" onClick={() => setShowShareSyncChooser(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CloudSyncMenuEntry open={showCloudSync} onOpenChange={setShowCloudSync} />

      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              간편 공유
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-1 text-sm text-muted-foreground text-left">
                <p>자산 데이터를 PIN으로 암호화하여 다른 기기로 공유(1회 전달)합니다.</p>
                <p className="text-[11px] text-primary">이후 지속적인 기기 동기화가 필요하다면 &apos;기기 동기화&apos; 메뉴를 이용해 주세요.</p>
                <p className="text-xs pt-1 text-muted-foreground/80">
                  암호화된 데이터만 서버를 안전하게 경유하며, URL 키와 PIN이 분리되어 서버 관리자도 내용을 복호화할 수 없습니다.
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
                ref={otpRef}
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
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="rose" onClick={confirmShareShort} disabled={shortUrlLoading || !preGeneratedShortUrl || sharePin.length !== 4} type="button" className="flex-1 sm:flex-initial">
              <Share2 className="mr-2 size-4" />
              {shortUrlLoading ? "생성 중..." : "공유 URL 복사"}
            </Button>
            <Button variant="outline" onClick={() => setShowShareDialog(false)} className="flex-1 sm:flex-initial">
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="size-5 text-primary" />
              의견·요청 보내기
            </DialogTitle>
            <DialogDescription>
              개선 의견이나 기능 요청을 남겨주세요. 개발자에게 바로 전달됩니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Textarea
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value.slice(0, FEEDBACK_MAX))}
                placeholder="자산 관리 개선에 대한 의견, 추가하고 싶은 기능 등을 자유롭게 남겨주세요."
                rows={8}
                className="resize-none min-h-[160px] max-h-[40vh] overflow-y-auto"
              />
              <p className="text-[11px] text-muted-foreground text-right tabular-nums">
                {feedbackMessage.length}/{FEEDBACK_MAX}
              </p>
            </div>
            <Input
              value={feedbackContact}
              onChange={(e) => setFeedbackContact(e.target.value)}
              placeholder="연락처 (선택 · 이메일 등 회신받을 곳)"
              maxLength={100}
            />
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              variant="brand"
              onClick={submitFeedback}
              disabled={feedbackSending || !feedbackMessage.trim()}
              type="button"
            >
              {feedbackSending ? <Loader2 className="mr-2 size-4 animate-spin" /> : <MessageSquarePlus className="mr-2 size-4" />}
              보내기
            </Button>
            <Button variant="outline" onClick={() => setShowFeedbackDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 도움말 선택기: 앱 가이드 · 공지사항 (정보 진입점 통합) */}
      <Dialog open={showHelpChooser} onOpenChange={setShowHelpChooser}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-5 text-primary" />
              앱 가이드 · 공지사항
            </DialogTitle>
            <DialogDescription className="text-left">
              앱 사용법 가이드와 최신 업데이트 공지를 확인합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <button
              type="button"
              className="flex items-center gap-3 text-left p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/50 transition-[background-color,border-color] duration-200 active:not-disabled:scale-[0.99]"
              onClick={() => {
                setShowHelpChooser(false);
                window.dispatchEvent(new CustomEvent("trigger-restore-guide"));
              }}
            >
              <Info className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">앱 가이드 보기</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">주요 기능 사용법을 단계별로 둘러봅니다.</p>
              </div>
            </button>

            <button
              type="button"
              className="flex items-center gap-3 text-left p-4 rounded-xl border bg-card hover:bg-accent hover:border-primary/50 transition-[background-color,border-color] duration-200 active:not-disabled:scale-[0.99]"
              onClick={() => {
                setShowHelpChooser(false);
                setShowNotice(true);
              }}
            >
              <BellRing className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">공지사항 보기</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">최신 업데이트·핵심 기능 안내를 확인합니다.</p>
              </div>
            </button>
          </div>

          <DialogFooter className="flex justify-end">
            <Button variant="outline" onClick={() => setShowHelpChooser(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 공지사항 뷰어 — 자동 팝업(UpdateNoticeDialog)과 동일 본문 재사용 */}
      <Dialog open={showNotice} onOpenChange={setShowNotice}>
        <DialogContent
          showCloseButton={false}
          className="max-h-[90dvh] overflow-y-auto w-[calc(100%-1.5rem)] sm:w-full sm:max-w-lg md:max-w-xl lg:max-w-2xl p-4 sm:p-6"
        >
          <DialogHeader className="gap-3 text-left">
            <div className="inline-flex items-center gap-2 text-primary">
              <BellRing className="size-5" />
              <span className="text-sm font-semibold">업데이트 공지</span>
            </div>
            <DialogTitle>{NOTICE_TITLE}</DialogTitle>
            <DialogDescription className="sr-only">앱 업데이트 내용</DialogDescription>
          </DialogHeader>

          <NoticeContent />

          <DialogFooter>
            <Button variant="brand" onClick={() => setShowNotice(false)} className="w-full sm:w-auto">
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
