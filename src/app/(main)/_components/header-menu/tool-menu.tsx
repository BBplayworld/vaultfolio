"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { track } from "@/lib/analytics/ga";
import { Copy, Share2, Info, User, MessageSquarePlus, Loader2, Settings, ChevronRight, Cloud, RefreshCw, BellRing, Upload, Download, Receipt } from "lucide-react";
import { useDataExport } from "@/hooks/use-data-export";
import { formatLastBackup, isBackupStale } from "@/lib/asset/backup-status";
import { useNickname, NICKNAME_MAX, sanitizeNickname } from "@/hooks/use-nickname";
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
import { CloudSyncMenuEntry } from "../functions/cloud-sync/cloud-sync-menu-entry";
import { dispatchOpenWhatsNew } from "../layout/navigation/asset-dispatch";
import { generateShareToken, STORAGE_KEYS, collectSnapshotsFromStorage } from "@/lib/asset/asset-storage";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";
import { getProfitBasis } from "@/lib/finance/profit-utils";
import type { AssetSnapshots } from "@/types/asset";
import { useAssetData } from "@/contexts/asset-data-context";
import { useAssetNavigation } from "../layout/navigation/navigation-context";
import { useAssetImport } from "@/hooks/use-asset-import";
import { computeStorageStats, formatBytes } from "@/lib/asset/storage-stats";
import { MENU_COLUMN, MENU_ROW, MENU_SECTION_LABEL, MENU_ICON, MENU_LABEL, MENU_DESC } from "./menu-styles";
import { hasAnyAssets } from "@/lib/asset/asset-storage";

export function ToolMenuPage() {
  const assetDataContext = useAssetData();
  const [nickname, setNickname] = useNickname();
  // 닉네임은 편집 중 로컬 draft만 갱신하고, 탭 이탈(언마운트) 시 1회 커밋 → 키 입력마다 push 방지
  const [draft, setDraft] = useState(nickname);
  // 사용자 실제 편집 여부 — 외부 pull로 draft가 갱신된 경우 stale 재push 방지
  const dirtyRef = useRef(false);
  // 외부(pull·다른 탭) 닉네임 변경을 입력란에 반영 + 편집 상태 해제
  useEffect(() => { setDraft(nickname); dirtyRef.current = false; }, [nickname]);
  const commitRef = useRef(() => { });
  commitRef.current = () => {
    if (!dirtyRef.current) return; // 사용자가 직접 입력했을 때만 커밋
    const clean = sanitizeNickname(draft);
    if (clean !== nickname) setNickname(clean);
  };
  // 탭 이탈 시 1회 커밋
  useEffect(() => () => commitRef.current(), []);
  const { refreshData, assetData, isSharePending } = assetDataContext;
  const themeMode = usePreferencesStore((s) => s.themeMode);
  const { navigate } = useAssetNavigation();
  const cs = useCloudSync();

  // 백업 상태 — 내보내기 직후 표시가 즉시 갱신되도록 훅의 tick으로 재계산
  const { exportNow, exportTick } = useDataExport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const lastBackup = useMemo(() => formatLastBackup(), [exportTick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const backupStale = useMemo(() => isBackupStale(), [exportTick]);

  const { fileInputRef, isImporting, openFilePicker, handleFileChange } = useAssetImport();
  // 저장 현황 — 전체 키 순회 동기 작업이라 진입·백업/가져오기 직후에만 계산
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stats = useMemo(() => computeStorageStats(), [exportTick]);

  const hasAssets =
    hasAnyAssets(assetData);
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
        track("feature_use", { category: "feedback", method: "submit", result: "fail" });
        return;
      }
      toast.success("의견이 전달되었습니다. 감사합니다!");
      track("feature_use", { category: "feedback", method: "submit", result: "success" });
      setShowFeedbackDialog(false);
      setFeedbackMessage("");
      setFeedbackContact("");
    } catch {
      toast.error("네트워크 오류가 발생했습니다.");
    } finally {
      setFeedbackSending(false);
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

    const token = generateShareToken(assetData, assetDataContext.exchangeRates, sharePin || undefined, localKey, collectSnapshotsFromStorage(), getProfitBasis(), nickname || undefined);
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
      track("share", { method: "link", content_type: "link" });
      setShowShareDialog(false);
    } catch {
      toast.error("클립보드 복사에 실패했습니다.");
    }
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      <div className={MENU_COLUMN}>
        <section>
          <p className={MENU_SECTION_LABEL}>프로필</p>
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-card shadow-xs">
            <User className={MENU_ICON} />
            <input
              type="text"
              value={draft}
              onChange={(e) => { setDraft(sanitizeNickname(e.target.value)); dirtyRef.current = true; }}
              maxLength={NICKNAME_MAX}
              placeholder="닉네임 (최대 8자)"
              aria-label="닉네임"
              className="flex-1 min-w-0 bg-transparent outline-none text-sm font-medium placeholder:text-muted-foreground"
            />
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{draft.length}/{NICKNAME_MAX}</span>
          </div>
        </section>

        <section data-testid="more-section-share-backup">
          <p className={MENU_SECTION_LABEL}>공유 · 백업</p>
          <div className="flex flex-col gap-2">
            <button type="button" data-testid="more-row-share-sync" className={MENU_ROW} onClick={() => setShowShareSyncChooser(true)} disabled={!hasAssets}>
              <Cloud className={MENU_ICON} />
              <span className={MENU_LABEL}>자산 공유 · 동기화</span>
              {cs.status === "armed" && (
                <RefreshCw className={`size-4 text-primary shrink-0 ${cs.syncing ? "animate-spin" : ""}`} />
              )}
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
            {/* 백업은 데이터 유실을 막는 핵심 동작이라 설정 3뎁스에 숨기지 않고 1단에 노출 */}
            <button type="button" data-testid="more-row-backup" className={MENU_ROW} onClick={exportNow} disabled={!hasAssets}>
              <Upload className={MENU_ICON} />
              <div className="flex-1 min-w-0">
                <span className={MENU_LABEL}>데이터 백업</span>
                <p className={`text-sm mt-0.5 ${backupStale ? "text-orange-600 dark:text-orange-400 font-medium" : "text-muted-foreground"}`}>
                  {lastBackup ? `마지막 백업: ${lastBackup}` : "아직 백업하지 않았습니다"}
                </p>
              </div>
            </button>
            <button type="button" data-testid="more-row-import" className={MENU_ROW} onClick={openFilePicker} disabled={isImporting}>
              <Download className={MENU_ICON} />
              <div className="flex-1 min-w-0">
                <span className={MENU_LABEL}>{isImporting ? "데이터 가져오는 중..." : "데이터 가져오기"}</span>
                <p className={MENU_DESC}>JSON 백업 파일로부터 자산 복원</p>
              </div>
            </button>
            {/* 저장 현황 — 내 데이터가 얼마나 쌓였는지 (읽기 전용) */}
            {stats.itemCount > 0 && (
              <p data-testid="more-storage-stats" className="px-4 pt-1 text-sm text-muted-foreground tabular-nums text-pretty break-keep">
                <span className="whitespace-nowrap">자산 {stats.itemCount}개</span> · <span className="whitespace-nowrap">일별 기록 {stats.dailyCount}일</span>
                {stats.archivedMonths > 0 && <>{" "}<span className="whitespace-nowrap">(+보관 {stats.archivedMonths}개월)</span></>}
                {" · "}<span className="whitespace-nowrap">약 {formatBytes(stats.approxBytes)}</span>
              </p>
            )}
          </div>
        </section>

        <section data-testid="more-section-tools">
          <p className={MENU_SECTION_LABEL}>도구</p>
          <div className="flex flex-col gap-2">
            <button type="button" data-testid="more-row-tax" className={MENU_ROW} onClick={() => navigate({ type: "tax" })}>
              <Receipt className={MENU_ICON} />
              <span className={MENU_LABEL}>세금 관리</span>
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          </div>
        </section>

        <section data-testid="more-section-support">
          <p className={MENU_SECTION_LABEL}>지원</p>
          <div className="flex flex-col gap-2">
            <button type="button" className={MENU_ROW} onClick={() => setShowFeedbackDialog(true)}>
              <MessageSquarePlus className={MENU_ICON} />
              <span className={MENU_LABEL}>의견·요청 보내기</span>
            </button>
            <button type="button" className={MENU_ROW} onClick={() => setShowHelpChooser(true)}>
              <Info className={MENU_ICON} />
              <span className={MENU_LABEL}>앱 가이드 · 새 소식</span>
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          </div>
        </section>

        <section>
          <div className="flex flex-col gap-2">
            <button type="button" data-testid="more-row-settings" className={MENU_ROW} onClick={() => navigate({ type: "settings" })}>
              <Settings className={MENU_ICON} />
              <span className={MENU_LABEL}>설정</span>
              <ChevronRight className="size-4 text-muted-foreground ml-auto shrink-0" />
            </button>
          </div>
        </section>
      </div>

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
              className="flex flex-col text-left p-4 rounded-xl bg-card shadow-xs hover:bg-accent transition-[background-color,box-shadow] duration-200 group relative overflow-hidden"
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
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                URL로 다른 기기에 <strong className="text-foreground font-semibold">1회 전달</strong>합니다 (PIN 설정 필요).
                링크에는 최근 기록만 담기므로, 기기를 옮길 땐 <strong className="text-foreground font-semibold">데이터 백업</strong>을 권장합니다.
              </p>
            </button>

            <button
              type="button"
              className="flex flex-col text-left p-4 rounded-xl bg-card shadow-xs hover:bg-accent transition-[background-color,box-shadow] duration-200 group relative overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
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
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                여러 기기에서 자산 데이터를 <strong className="text-foreground font-semibold">항상 최신으로 자동 유지</strong>합니다.
              </p>
            </button>
          </div>

          <DialogFooter className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowShareSyncChooser(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 가져오기용 숨은 file input — 조건부 블록 밖에 항상 렌더(자산 0에서도 동작) */}
      <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />

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
                <p className="text-xs text-primary">이후 지속적인 기기 동기화가 필요하다면 &apos;기기 동기화&apos; 메뉴를 이용해 주세요.</p>
                <p className="text-xs pt-1 text-muted-foreground dark:text-muted-foreground/80">
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
              <p className="text-xs text-muted-foreground">
                받는 사람도 동일한 PIN으로 자산을 열람합니다.
              </p>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="rose" onClick={confirmShareShort} disabled={shortUrlLoading || !preGeneratedShortUrl || sharePin.length !== 4} type="button" className="flex-1 sm:flex-initial">
              <Share2 className="mr-2 size-4" />
              {shortUrlLoading ? "생성 중..." : "공유 URL 복사"}
            </Button>
            <Button variant="secondary" onClick={() => setShowShareDialog(false)} className="flex-1 sm:flex-initial">
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
              <p className="text-xs text-muted-foreground text-right tabular-nums">
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
            <Button variant="secondary" onClick={() => setShowFeedbackDialog(false)}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 도움말 선택기: 앱 가이드 · 새 소식 (정보 진입점 통합) */}
      <Dialog open={showHelpChooser} onOpenChange={setShowHelpChooser}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader className="text-left">
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-5 text-primary" />
              앱 가이드 · 새 소식
            </DialogTitle>
            <DialogDescription className="text-left break-keep text-pretty">
              보안 가이드와 최근 새 소식을 확인합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 py-4">
            <button
              type="button"
              className="flex items-center gap-3 text-left p-4 rounded-xl bg-card shadow-xs hover:bg-accent transition-[background-color,box-shadow] duration-200 active:not-disabled:scale-[0.99]"
              onClick={() => {
                setShowHelpChooser(false);
                window.dispatchEvent(new CustomEvent("trigger-restore-guide"));
              }}
            >
              <Info className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">앱 가이드 보기</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-keep text-pretty">시크릿에셋의 보안 가이드를 살펴봅니다.</p>
              </div>
            </button>

            <button
              type="button"
              data-testid="more-whats-new"
              className="flex items-center gap-3 text-left p-4 rounded-xl bg-card shadow-xs hover:bg-accent transition-[background-color,box-shadow] duration-200 active:not-disabled:scale-[0.99]"
              onClick={() => {
                setShowHelpChooser(false);
                dispatchOpenWhatsNew("more");
              }}
            >
              <BellRing className="size-5 text-primary shrink-0" />
              <div className="min-w-0">
                <p className="font-semibold text-foreground">새 소식 보기</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed break-keep text-pretty">최근 업데이트와 새 기능을 확인합니다.</p>
              </div>
            </button>
          </div>

          <DialogFooter className="flex justify-end">
            <Button variant="secondary" onClick={() => setShowHelpChooser(false)}>
              닫기
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
