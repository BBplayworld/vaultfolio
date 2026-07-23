"use client";

import React, { useRef, useState } from "react";
import { Camera, Copy, Check, Loader2, Download } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ShareCard } from "./share-card";
import { MAIN_PALETTE } from "@/config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareScreenshotDialog({ open, onOpenChange }: Props) {
  // 기본은 금액 노출 — 필요 시 스위치로 숨겨 자산 규모(₩)만 가릴 수 있다
  const [showAmounts, setShowAmounts] = useState(true);
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
  const wrapperRef = useRef<HTMLDivElement>(null);

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
    const actualWidth = el.getBoundingClientRect().width;
    const pixelRatio = Math.ceil(1100 / actualWidth);
    // 카드의 계산된 배경색(테마 따라 흰/어두움)을 캡처 배경으로 지정 → 투명 영역까지 테마색으로 채움
    const backgroundColor = getComputedStyle(el).backgroundColor;
    return toPng(el, { pixelRatio, skipFonts: false, backgroundColor });
  };

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      const dataUrl = await captureImage();
      if (!dataUrl) return;
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setCopySuccess(true);
        window.dispatchEvent(new CustomEvent("tutorial-complete-step3"));
        setTimeout(() => setCopySuccess(false), 2000);
      } catch {
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `secretasset-${new Date().toISOString().slice(0, 10)}.png`;
        a.click();
        window.dispatchEvent(new CustomEvent("tutorial-complete-step3"));
      }
    } catch (e) {
      console.error("스크린샷 생성 실패", e);
    } finally {
      setIsCopying(false);
    }
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
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 overflow-hidden transition-all outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 max-w-[520px] sm:max-w-[680px] h-[94dvh] max-h-[96dvh] flex flex-col">
        <DialogHeader className="px-5 pt-4 pb-1">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Camera className="size-4 text-primary" />
            인증용 스크린샷
          </DialogTitle>
          <DialogDescription className="text-xs">
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
                onClick={handleCopy}
                disabled={isCopying || isSaving}
                className="h-8 px-3 text-sm gap-1.5 text-white hover:opacity-90"
                style={{ backgroundColor: MAIN_PALETTE[0] }}
              >
                {isCopying ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : copySuccess ? (
                  <Check className="size-3" />
                ) : (
                  <Copy className="size-3" />
                )}
                {copySuccess ? "복사됨!" : isCopying ? "처리 중..." : "복사"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSave}
                disabled={isSaving || isCopying}
                className="h-8 px-3 text-sm gap-1.5 text-white hover:opacity-90"
                style={{ backgroundColor: MAIN_PALETTE[11] }}
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

        {/* 카드 미리보기 */}
        <div className="overflow-y-auto flex-1 p-2 sm:p-4 outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:ring-0 [&_*]:focus:ring-0 [&_*]:focus-visible:ring-0 [&_path]:outline-none">
          <div ref={wrapperRef} className="w-[480px] max-w-full mx-auto">
            <ShareCard
              hideAmounts={!showAmounts}
              cardRef={cardRef}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
