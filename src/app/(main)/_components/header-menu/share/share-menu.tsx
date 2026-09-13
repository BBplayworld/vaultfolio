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
// 외부 공유(카페 등 재업로드) 시 원본 픽셀이 그대로(1600px 이상) 노출되는 문제 — 저장 파일
// 자체 해상도를 카드 레이아웃 폭과 같게 낮춰 어디서든 680px 안팎으로 노출되게 한다(2026-09,
// 사용자 선택: 확대/인쇄 선명도보다 외부 공유 시 크기 제어 우선). CARD_WIDTH와 동일 → pixelRatio=1.
// (변경 시 logo-source.ts의 CAPTURE_PIXEL_RATIO를 반드시 함께 맞출 것 — 로고 요청 해상도가
// 이 pixelRatio를 그대로 가정하고 있어, 어긋나면 과대 요청(R34 로고 누락 회귀) 또는 저해상도 로고가 됨)
const CAPTURE_TARGET_PX = 680;

// 캡처 전 로고 <img> 로드 대기 예산 (모바일에서 느린 로고 로드/디코드 대비)
const IMG_SETTLE_PER_MS = 4000;
const IMG_SETTLE_TOTAL_MS = 12000;
// handleSave 전체 하드 타임아웃 — 초과 시 저장 실패로 처리하고 버튼 복구
const SAVE_HARD_TIMEOUT_MS = 20000;
// fetch 실패 이미지가 toPng 전체를 throw시키지 않도록 하는 1x1 투명 PNG
const TRANSPARENT_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

/** 캡처 노드 안 모든 <img>가 로드(or 실패)될 때까지 대기 — 이미지별·전체 타임아웃 */
async function settleImages(imgs: HTMLImageElement[]): Promise<void> {
  await Promise.race([
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((res) => {
            const done = () => res();
            if (img.complete && img.naturalWidth > 0) {
              img.decode?.().then(done).catch(done);
              return;
            }
            img.addEventListener("load", () => img.decode?.().then(done).catch(done), { once: true });
            img.addEventListener("error", done, { once: true });
            setTimeout(done, IMG_SETTLE_PER_MS);
          }),
      ),
    ),
    new Promise<void>((r) => setTimeout(r, IMG_SETTLE_TOTAL_MS)),
  ]);
}

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

    const imgs = Array.from(cardRef.current.querySelectorAll("img"));

    // 1) 화면 밖 캡처 노드의 로고 <img>가 아직 로딩 중일 수 있으니 먼저 settle 대기
    //    (모바일에서 프리뷰보다 뒤처지거나 디코드가 지연되는 경우 대비)
    await settleImages(imgs);

    // 2) 모든 <img>를 직접 fetch → dataURL로 인라인
    //    (html-to-image가 동일 src를 캐싱해 첫 이미지로 덮어쓰는 문제 회피 + 원본 로드 실패분 복구)
    await Promise.all(
      imgs.map(async (img) => {
        const src = img.getAttribute("src");
        if (!src || src.startsWith("data:")) return;
        for (let i = 0; i < 2; i++) {
          try {
            // 방금 프리뷰/캡처 노드가 채운 HTTP 캐시를 강제 사용 → 네트워크 없이 성공 가능
            const res = await fetch(src, { cache: "force-cache" });
            if (!res.ok) throw new Error(`logo ${res.status}`);
            const blob = await res.blob();
            const dataUrl: string = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(blob);
            });
            img.setAttribute("src", dataUrl);
            await img.decode?.().catch(() => {});
            return;
          } catch (e) {
            if (i === 1) console.warn("[share-card] 로고 인라인 실패:", src, e);
            else await new Promise((r) => setTimeout(r, 400));
          }
        }
      }),
    );

    const el = cardRef.current;
    // offsetWidth(레이아웃 폭, 항상 CARD_WIDTH 고정) 기준 — getBoundingClientRect는 미리보기 축소
    // transform의 영향을 받아 기기마다 다른 pixelRatio·해상도가 나오므로 사용 금지
    const pixelRatio = Math.ceil(CAPTURE_TARGET_PX / el.offsetWidth);
    // 카드의 계산된 배경색(테마 따라 흰/어두움)을 캡처 배경으로 지정 → 투명 영역까지 테마색으로 채움
    const backgroundColor = getComputedStyle(el).backgroundColor;
    return toPng(el, {
      pixelRatio,
      skipFonts: false,
      backgroundColor,
      // 인라인 실패한 이미지가 toPng 전체를 throw시키지 않도록 — 투명으로 대체
      imagePlaceholder: TRANSPARENT_1PX,
      fetchRequestInit: { cache: "force-cache" },
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const dataUrl = await Promise.race([
        captureImage(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("capture timeout")), SAVE_HARD_TIMEOUT_MS),
        ),
      ]);
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
      {/* 모바일: 좌우 12px 인셋(노치·홈 인디케이터는 safe-area 우선), 세로는 top 앵커 + h-auto라
          팝업 높이가 내부 주식현황/포트폴리오 콘텐츠 높이만큼 늘어난다(화면 고정 아님). 콘텐츠가
          뷰포트를 넘으면 팝업 전체가 스크롤(max-h + overflow-y-auto) — 내부 프리뷰 영역엔 별도
          스크롤바 없음. 가장자리로 블러된 오버레이(`bg-black/70 backdrop-blur-sm`)가 살짝 비친다.
          sm: 이상은 기존 중앙 배치(760px, 94dvh)로 복귀. 여기는 캡처 대상이 아니라 셸이라 sm: 허용(R32 무관). */}
      <DialogContent className="p-0 gap-0 overflow-x-hidden overflow-y-auto sm:overflow-hidden transition-all outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 flex flex-col border shadow-lg top-[max(0.75rem,env(safe-area-inset-top))] left-3 right-3 translate-x-0 translate-y-0 w-auto max-w-none h-auto max-h-[calc(100dvh_-_max(0.75rem,env(safe-area-inset-top))_-_max(0.75rem,env(safe-area-inset-bottom)))] rounded-2xl sm:top-[50%] sm:bottom-auto sm:left-[50%] sm:right-auto sm:translate-x-[-50%] sm:translate-y-[-50%] sm:w-full sm:max-w-[760px] sm:h-[94dvh] sm:max-h-[96dvh] sm:rounded-lg [&_[data-slot=dialog-close]]:top-3 sm:[&_[data-slot=dialog-close]]:top-4">
        <DialogHeader className="px-3 pt-3 pb-2 sm:px-5 sm:py-4 text-left">
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
            프리뷰를 화면 끝까지. 텍스트·막대바는 인증카드 프리뷰 전용 크기(ASSET_THEME_SHOT,
            2026-09부터 상세>주식탭보다 ~2px 작게 조정).
            모바일: flex-none + 자연 높이라 이 영역엔 자체 스크롤바가 없다(팝업 셸이 통째로 늘어남).
            sm: 이상은 고정 높이 다이얼로그의 스크롤 본문(flex-1 + overflow-y-auto). */}
        <div className="flex-none overflow-visible sm:flex-1 sm:overflow-y-auto px-0 py-1 sm:p-4 outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:ring-0 [&_*]:focus:ring-0 [&_*]:focus-visible:ring-0 [&_path]:outline-none">
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
