"use client";

import React, { useEffect, useRef, useState } from "react";
import { IdCard, Check, Loader2, Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShareCard } from "./share-card";

// 카드 캡처 대상은 항상 480px 고정 폭 — 좁은 화면에선 CSS transform으로 축소만 하고
// 레이아웃 크기 자체는 바꾸지 않는다. 기기별로 다른 이미지가 나오는 걸 막기 위함.
const CARD_WIDTH = 480;

function ScaledCardPreview({ children }: { children: React.ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number>();

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const update = () => {
      const nextScale = Math.min(1, outer.clientWidth / CARD_WIDTH);
      setScale(nextScale);
      setHeight(inner.scrollHeight * nextScale);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className="flex justify-center w-full" style={{ height }}>
      {/* shrink-0 필수 — 없으면 flexbox가 480px 레이아웃 박스를 컨테이너 폭에 맞춰 먼저
          축소한 뒤 transform: scale()이 그 위에 다시 곱해져 이중으로 작아진다(예: 390px
          컨테이너에서 최종 317px). shrink-0로 레이아웃 폭을 항상 480 고정해야 scale 계산이
          의도대로(컨테이너 꽉 채움) 반영된다. */}
      <div ref={innerRef} className="shrink-0" style={{ width: CARD_WIDTH, transform: `scale(${scale})`, transformOrigin: "top" }}>
        {children}
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareScreenshotDialog({ open, onOpenChange }: Props) {
  // 기본은 금액 노출 — 필요 시 스위치로 숨겨 자산 규모(₩)만 가릴 수 있다
  const [showAmounts, setShowAmounts] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

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
    const pixelRatio = Math.ceil(1100 / el.offsetWidth);
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
      {/* 모바일 폭은 vw 고정값으로 직접 지정 — 기본 `w-full`은 `%` 기반이라 containing block에
          따라 예상보다 좁게 잡힐 수 있어(원인 미상), 뷰포트에 항상 상대적인 vw로 확실히 95% 확보 */}
      <DialogContent className="p-0 gap-0 overflow-hidden transition-all outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 w-[95vw] sm:w-full max-w-[520px] sm:max-w-[680px] h-[94dvh] max-h-[96dvh] flex flex-col">
        <DialogHeader className="px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <IdCard className="size-4 text-primary" />
            인증카드
          </DialogTitle>
          <DialogDescription className="text-xs text-left">
            내 주식 현황을 이미지로 만들어 저장할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        {/* 제어 바 */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-b bg-muted/20 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="show-amounts"
                  checked={showAmounts}
                  onCheckedChange={setShowAmounts}
                  className="scale-90"
                />
                <Label htmlFor="show-amounts" className="text-sm cursor-pointer select-none">금액 표시</Label>
              </div>
            </div>
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

        {/* 카드 미리보기. shrink-0 수정으로 스케일이 컨테이너를 꽉 채우게 됐으니, 카드가
            다이얼로그 가장자리에 완전히 붙지 않도록 최소한의 여백(px-1)만 남긴다 */}
        <div className="overflow-y-auto flex-1 px-2 py-2 sm:p-4 outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:ring-0 [&_*]:focus:ring-0 [&_*]:focus-visible:ring-0 [&_path]:outline-none">
          <ScaledCardPreview>
            <ShareCard
              hideAmounts={!showAmounts}
              cardRef={cardRef}
            />
          </ScaledCardPreview>
        </div>
      </DialogContent>
    </Dialog>
  );
}
