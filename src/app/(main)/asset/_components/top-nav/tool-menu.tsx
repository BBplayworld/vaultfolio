"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Upload, Trash2, Sparkles, Copy, Check, Share2, CircleChevronDown } from "lucide-react";
import { MAIN_PALETTE, ASSET_THEME } from "@/config/theme";
import { toast } from "sonner";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Lock, Unlock } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { SidebarMenu, SidebarcategoryBox, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { getInitials } from "@/lib/utils";
import { exportAssetData, importAssetData, clearAssetData, generateShareToken, STORAGE_KEYS } from "@/lib/asset-storage";
import type { AssetSnapshots } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { AI_PROMPT_TEMPLATES, AssetPromptContext } from "@/lib/ai-prompts";

export function NavUser({
  user,
}: {
  readonly user: {
    readonly name: string;
    readonly email: string;
    readonly avatar: string;
  };
}) {
  const { isMobile } = useSidebar();
  const assetDataContext = useAssetData();
  const { refreshData, initAndSync, getAssetSummary, assetData } = assetDataContext;
  const hasAssets =
    assetData.realEstate.length > 0 ||
    assetData.stocks.length > 0 ||
    assetData.crypto.length > 0 ||
    assetData.cash.length > 0 ||
    assetData.loans.length > 0;
  const [isImporting, setIsImporting] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [showAIPromptDialog, setShowAIPromptDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [selectedPromptIdx, setSelectedPromptIdx] = useState(0);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [sharePin, setSharePin] = useState("");
  const [preGeneratedShortUrl, setPreGeneratedShortUrl] = useState<string | null>(null);
  const [shortUrlLoading, setShortUrlLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      exportAssetData();
      toast.success("자산 데이터가 다운로드되었습니다.");
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

    const token = generateShareToken(assetData, assetDataContext.exchangeRates, sharePin || undefined, localKey, collectSnapshots());
    const ownerId = localStorage.getItem("secretasset_share_owner_id") ?? undefined;
    fetch("/api/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, owner_id: ownerId }),
    })
      .then((res) => res.json() as Promise<{ key?: string; owner_id?: string }>)
      .then((json) => {
        if (json.owner_id) {
          localStorage.setItem("secretasset_share_owner_id", json.owner_id);
        }
        if (json.key) {
          setPreGeneratedShortUrl(
            `${window.location.origin}${window.location.pathname}#share=s:${json.key}_${localKey}`
          );
        }
      })
      .catch(() => { /* 미리 생성 실패 — 버튼 비활성화로 처리 */ })
      .finally(() => setShortUrlLoading(false));
    // assetData, assetDataContext.exchangeRates는 다이얼로그 열린 시점의 스냅샷만 필요
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showShareDialog, sharePin]);

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

      const token = generateShareToken(assetData, assetDataContext.exchangeRates, sharePin, undefined, collectSnapshots());
      const shareUrl = `${window.location.origin}${window.location.pathname}#share=${encodeURIComponent(token)}`;

      await navigator.clipboard.writeText(shareUrl);

      const length = token.length;
      if (length <= 200) {
        toast.success("PIN 암호화된 공유 URL이 복사되었습니다.");
      } else {
        toast.success("공유 URL이 복사되었습니다.");
        toast.info(`데이터가 많아 토큰이 ${length}자입니다. 일부 환경에서 제한될 수 있습니다.`);
      }
      setShowShareDialog(false);
    } catch {
      toast.error("URL 공유 준비에 실패했습니다.");
    }
  };

  useEffect(() => {
    const handler = () => fileInputRef.current?.click();
    window.addEventListener("trigger-import", handler);
    return () => window.removeEventListener("trigger-import", handler);
  }, []);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const { assetData: imported, snapshotRestored } = await importAssetData(file);
      toast.success("자산 데이터를 불러왔습니다.");
      if (snapshotRestored) toast.info("순자산 히스토리(일별·월별)도 복원되었습니다.");
      void initAndSync(imported); // 주식 현재가 갱신은 백그라운드 처리 → syncTodayStockPrices가 별도 toast 표시
    } catch (error) {
      toast.error("데이터 가져오기에 실패했습니다. 파일 형식을 확인해주세요.");
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  const getPromptContext = (): AssetPromptContext => ({
    data: assetData,
    summary: getAssetSummary(),
    exchangeRates: assetDataContext.exchangeRates,
  });

  const handleCopyPrompt = async () => {
    const prompt = AI_PROMPT_TEMPLATES[selectedPromptIdx].generate(getPromptContext());
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("AI 평가 프롬프트가 복사되었습니다.");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <>
      <SidebarMenu className="rounded-md transition-colors shadow-sm overflow-hidden">
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarcategoryBox
                size="lg"
                className="h-7 sm:h-9 px-1.5 sm:px-2 text-white hover:text-white transition-colors border-none"
                style={{ backgroundColor: MAIN_PALETTE[0] }}
              >
                <div className="grid flex-1 text-left leading-tight ml-0.5 sm:ml-1">
                  <span className="truncate font-bold tracking-tighter uppercase text-[10px] sm:text-[11px]">자산 도구</span>
                </div>
                <CircleChevronDown className="ml-auto size-3 sm:size-3.5 opacity-70" />
              </SidebarcategoryBox>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-60 rounded-lg"
              side={isMobile ? "bottom" : "right"}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-2 py-2 text-left text-sm rounded-md">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={user.avatar || undefined} alt={user.name} />
                    <AvatarFallback className="rounded-lg text-xs font-semibold text-white">
                      {getInitials(user.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className={`truncate font-semibold ${ASSET_THEME.primary.text}`}>자산 도구</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <div className="px-2 py-2.5">
                <p className={`text-xs font-semibold ${ASSET_THEME.primary.text}`}>데이터 관리</p>
              </div>
              <DropdownMenuItem className="py-2.5" onClick={handleExport} disabled={!hasAssets}>
                <Upload className="size-4" />
                데이터 내보내기
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5" onClick={handleImportClick} disabled={isImporting}>
                <Download className="size-4" />
                {isImporting ? "가져오는 중..." : "데이터 가져오기"}
              </DropdownMenuItem>
              <DropdownMenuItem className="py-2.5" onClick={handleShare} disabled={!hasAssets}>
                <Share2 className="size-4" />
                공유 URL 복사
              </DropdownMenuItem>
              <DropdownMenuItem className="text-rose-400 focus:text-rose-400 py-2.5" onClick={() => setShowClearDialog(true)} disabled={!hasAssets}>
                <Trash2 className="size-4" />
                모든 데이터 삭제
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <div className="px-2 py-2.5">
                <p className={`text-xs font-semibold ${ASSET_THEME.primary.text}`}>기능</p>
              </div>
              <DropdownMenuItem className="py-2.5" onClick={() => setShowAIPromptDialog(true)} disabled={!hasAssets}>
                <Sparkles className="size-4" />
                <span className="flex-1">AI 평가용 자산 현황</span>
                <span className="ml-2 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">NEW</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

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

      <Dialog open={showAIPromptDialog} onOpenChange={setShowAIPromptDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="size-5 text-primary" />
              AI 평가용 자산 종합 현황
            </DialogTitle>
            <DialogDescription>
              아래 프롬프트를 복사하여 Grok·Gemini·GPT 등 AI에게 자산 분석 및 조언을 요청하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {AI_PROMPT_TEMPLATES.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedPromptIdx(i)}
                className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${i === selectedPromptIdx
                  ? "bg-background shadow-sm font-medium"
                  : "text-muted-foreground hover:text-foreground"
                  }`}
                style={i === selectedPromptIdx ? { color: MAIN_PALETTE[0] } : undefined}
              >
                <span>{t.label}</span>
                <span className="text-[10px] opacity-60 hidden sm:block leading-tight text-center">{t.sublabel}</span>
              </button>
            ))}
          </div>
          <div className="space-y-3 overflow-y-auto flex-1 pr-2">
            <Textarea
              value={AI_PROMPT_TEMPLATES[selectedPromptIdx].generate(getPromptContext())}
              readOnly
              className="min-h-[380px] w-full font-mono text-sm resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIPromptDialog(false)}>
              닫기
            </Button>
            <Button onClick={handleCopyPrompt} style={{ backgroundColor: MAIN_PALETTE[0] }} className="text-white hover:opacity-90 border-none">
              {copied ? (
                <>
                  <Check className="mr-2 size-4" />
                  복사됨
                </>
              ) : (
                <>
                  <Copy className="mr-2 size-4" />
                  프롬프트 복사
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
