"use client";

import React, { useEffect, useRef, useState } from "react";
import { IdCard, Check, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { useXrayClassifications } from "@/lib/xray/use-xray-classifications";
import type { Stock } from "@/types/asset";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { ShareCard, type ShareCardVariant } from "./share-card";

const CARD_VARIANTS = [
  { value: "stock", label: "주식 현황" },
  { value: "portfolio", label: "포트폴리오" },
] as const satisfies readonly { value: ShareCardVariant; label: string }[];

// 포트폴리오가 아닐 때 useXrayClassifications 트리거를 끄기 위한 안정 참조
const EMPTY_STOCKS: Stock[] = [];

// 캡처 전용 인스턴스는 항상 680px 고정 폭(화면 밖). 프리뷰는 별도 반응형 인스턴스라
// 저장 PNG는 기기·뷰포트 무관 100% 동일(R32).
// 폭을 바꾸면 portfolio-ring-card.tsx의 VIEW_W(= CARD_WIDTH − p-3 좌우 24)도 함께 조정해야 한다.
const CARD_WIDTH = 680;
// 캡처 PNG 목표 최소 폭 — pixelRatio는 이 값을 offsetWidth로 나눈 올림 정수.
// (680 기준 ceil(1400/680)=3 → 최종 약 2040px)
const CAPTURE_TARGET_PX = 1400;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // 외부(홈 팁 등)에서 특정 카드 타입으로 바로 열어달라는 요청 — dispatchOpenShareCard(variant) 참고.
  initialVariant?: ShareCardVariant;
}

export function ShareScreenshotDialog({ open, onOpenChange, initialVariant }: Props) {
  // 기본은 금액 노출 — 필요 시 스위치로 숨겨 자산 규모(₩)만 가릴 수 있다
  const [showAmounts, setShowAmounts] = useState(true);
  // 카드 타입 — 저장 안 함(다이얼로그 로컬 상태)
  const [variant, setVariant] = useState<ShareCardVariant>("stock");

  // 열릴 때 initialVariant가 지정돼 있으면 그 타입으로 맞춘다(예: 홈 "새 공지" 팁 → 포트폴리오 직행).
  // 지정 없이 아이콘 버튼으로 열면 기존 선택을 그대로 유지(리셋 안 함).
  useEffect(() => {
    if (open && initialVariant) setVariant(initialVariant);
  }, [open, initialVariant]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  // 포트폴리오 타입일 때만 X-Ray 분류 캐시 자동 보충 → 완료 시 tick 증가로 분야 막대바 등장
  const { assetData } = useAssetData();
  const { tick: xrayTick, progress: xrayProgress } = useXrayClassifications(
    open && variant === "portfolio" ? assetData.stocks : EMPTY_STOCKS,
  );
  const classifying =
    !!xrayProgress && xrayProgress.total > 0 && xrayProgress.done < xrayProgress.total;

  const captureImage = async () => {
    if (!cardRef.current) return null;
    const { toPng } = await import("html-to-image");

    // 캡처 전 모든 <img>를 직접 fetch → dataURL로 인라인
    // (html-to-image가 동일 src를 캐싱해 첫 이미지로 덮어쓰는 문제 회피)
    const imgs = Array.from(cardRef.current.querySelectorAll("img"));
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        try {
          const res = await fetch(src);
          if (!res.ok) return;
          const blob = await res.blob();
          const dataUrl: string = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          img.setAttribute("src", dataUrl);
          if (!(img.complete && img.naturalWidth > 0)) {
            await new Promise<void>((resolve) => {
              img.addEventListener("load", () => resolve(), { once: true });
              img.addEventListener("error", () => resolve(), { once: true });
            });
          }
        } catch {
          // 실패 시 원본 src 유지 — onError로 initial 표시됨
        }
      }),
    );

    const el = cardRef.current;
    // offsetWidth(레이아웃 폭, 항상 CARD_WIDTH 고정) 기준 — getBoundingClientRect는 미리보기 축소
    // transform(ScaledCardPreview)의 영향을 받아 기기마다 다른 pixelRatio·해상도가 나오므로 사용 금지
    const pixelRatio = Math.ceil(CAPTURE_TARGET_PX / el.offsetWidth);
    // 카드의 계산된 배경색(테마 따라 흰/어두움)을 캡처 배경으로 지정 → 투명 영역까지 테마색으로 채움
    const backgroundColor = getComputedStyle(el).backgroundColor;
    return toPng(el, { pixelRatio, skipFonts: false, backgroundColor });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `secretasset-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      setSaveSuccess(true);
      window.dispatchEvent(new CustomEvent("tutorial-complete-step3"));
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      console.error("이미지 저장 실패", e);
      toast.error("이미지 저장에 실패했습니다.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 모바일: 전체화면(100vw × 100dvh, 테두리·라운드 제거)으로 프리뷰를 최대 확대.
          sm: 이상은 기존 값(760px, 94dvh) 유지. 여기는 캡처 대상(share-card.tsx)이 아니라
          다이얼로그 셸이라 sm: 반응형 사용 가능(R32 무관).
          닫기(X) 버튼(공용 DialogContent 기본 top-4)을 헤더 상단 여백과 동일하게 —
          모바일은 max(14px, 노치 safe-area-inset-top), 데스크톱은 top-4(py-4 헤더). */}
      <DialogContent className="p-0 gap-0 overflow-hidden transition-all outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 w-screen max-w-none rounded-none border-0 h-[100dvh] max-h-[100dvh] sm:w-full sm:max-w-[760px] sm:rounded-lg sm:border sm:h-[94dvh] sm:max-h-[96dvh] flex flex-col [&_[data-slot=dialog-close]]:top-[max(0.875rem,env(safe-area-inset-top))] sm:[&_[data-slot=dialog-close]]:top-4">
        <DialogHeader className="px-3 pb-2 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-5 sm:py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base">
            <IdCard className="size-4 text-primary" />
            인증카드
          </DialogTitle>
          {/* 설명 문구는 데스크톱만 — 모바일은 타입 토글 라벨로 충분(세로 공간 확보) */}
          <DialogDescription className="hidden sm:block text-xs text-left">
            {variant === "portfolio"
              ? "내 종목 구성 비중을 이미지로 만들어 저장할 수 있습니다."
              : "내 주식 현황을 이미지로 만들어 저장할 수 있습니다."}
          </DialogDescription>
        </DialogHeader>

        {/* 제어 바 — 1줄: 타입 토글 + 저장 / 2줄: (주식 현황 한정) 금액 표시 */}
        <div className="flex flex-col gap-2 px-3 py-2 sm:px-5 sm:py-3 border-t border-b bg-muted/20">
          <div className="flex items-center justify-between gap-3">
            <InlineSelector<ShareCardVariant>
              value={variant}
              onChange={setVariant}
              options={CARD_VARIANTS}
              size="sm"
              ariaLabel="인증카드 타입"
            />
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="brand"
                onClick={handleSave}
                disabled={isSaving}
                className="h-8 px-3 text-sm gap-1.5"
              >
                {isSaving ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : saveSuccess ? (
                  <Check className="size-3" />
                ) : (
                  <Download className="size-3" />
                )}
                {saveSuccess ? "저장됨!" : isSaving ? "처리 중..." : "저장"}
              </Button>
            </div>
          </div>

          {variant === "stock" && (
            <div className="flex items-center gap-1.5">
              <Switch
                id="show-amounts"
                checked={showAmounts}
                onCheckedChange={setShowAmounts}
                className="scale-75"
              />
              <Label htmlFor="show-amounts" className="text-xs cursor-pointer select-none">금액 표시</Label>
            </div>
          )}
          {variant === "portfolio" && classifying && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              분야 정보를 분석하는 중… 완료되면 분야 구성이 표시됩니다.
            </div>
          )}
        </div>

        {/* 카드 미리보기 — 뷰포트에 맞춘 반응형 렌더(스케일 없음). 모바일은 좌우 여백 0(px-0)으로
            프리뷰를 화면 끝까지. 텍스트·막대바는 상세>주식탭과 동일한 네이티브 크기(ASSET_THEME). */}
        <div className="overflow-y-auto flex-1 px-0 py-1 sm:p-4 outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:ring-0 [&_*]:focus:ring-0 [&_*]:focus-visible:ring-0 [&_path]:outline-none">
          <ShareCard
            variant={variant}
            hideAmounts={!showAmounts}
            xrayTick={xrayTick}
            responsive
          />
        </div>

        {/* 캡처 전용 — 화면 밖 고정 680px 인스턴스. toPng은 이걸 캡처하므로 저장 PNG는
            기기·뷰포트 무관 100% 동일(R32). 항상 마운트돼 있어야 handleSave 시점에 레이아웃됨. */}
        <div
          aria-hidden
          className="fixed left-[-9999px] top-0 pointer-events-none"
          style={{ width: CARD_WIDTH }}
        >
          <ShareCard
            variant={variant}
            hideAmounts={!showAmounts}
            xrayTick={xrayTick}
            cardRef={cardRef}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
