"use client";

import React, { useRef, useState } from "react";
import { Camera, Copy, Check, Loader2, Download, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ShareCard } from "./share-card";
import { CATEGORY_TABS } from "@/app/(main)/asset/_components/main-nav/detail/tabs/stock-tab";
import { MAIN_PALETTE } from "@/config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface SectionVisibility {
  donut: boolean;
  stockHeader: boolean;
  stockList: boolean;
  chart: boolean;
}

export const SECTION_OPTIONS: { key: keyof SectionVisibility; label: string }[] = [
  { key: "donut", label: "자산 분포" },
  { key: "chart", label: "순자산 변화" },
  { key: "stockHeader", label: "주식 종합" },
  { key: "stockList", label: "주식 상세" },
];

export function ShareScreenshotDialog({ open, onOpenChange }: Props) {
  const [hideAmounts, setHideAmounts] = useState(false);
  const [activeCategory, setActiveCategory] = useState("all");
  const [isCopying, setIsCopying] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCaptureMode, setIsCaptureMode] = useState(false);
  const [sections, setSections] = useState<SectionVisibility>({
    donut: true,
    stockHeader: true,
    stockList: true,
    chart: true,
  });
  const cardRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;

  const toggleSection = (key: keyof SectionVisibility) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

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

    return toPng(cardRef.current, { pixelRatio: 1, skipFonts: false });
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
      <DialogContent showCloseButton={!isCaptureMode} className={`p-0 gap-0 overflow-hidden transition-all outline-none focus:outline-none focus-visible:outline-none ring-0 focus:ring-0 focus-visible:ring-0 ${isCaptureMode ? "max-w-full sm:max-w-full w-screen h-dvh max-h-dvh rounded-none border-0" : "max-w-[520px] sm:max-w-[680px] max-h-[96dvh] flex flex-col"}`}>
        {/* 헤더 — 캡처 모드에서 숨김 */}
        {!isCaptureMode && (
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Camera className="size-4 text-primary" />
              인증용 스크린샷
            </DialogTitle>
            <DialogDescription className="text-xs">
              자산 현황을 이미지로 복사합니다
            </DialogDescription>
          </DialogHeader>
        )}

        {/* 섹션 선택 체크박스 — 캡처 모드에서 숨김 */}
        {!isCaptureMode && (
          <div className="px-5 py-3 border-t bg-muted/10">
            <p className="text-[11px] text-muted-foreground font-medium mb-2">포함할 항목</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {SECTION_OPTIONS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`section-${key}`}
                    checked={sections[key]}
                    onCheckedChange={() => toggleSection(key)}
                    className="size-3.5"
                    style={{ backgroundColor: MAIN_PALETTE[0], borderColor: MAIN_PALETTE[0] }}
                  />
                  <Label htmlFor={`section-${key}`} className="text-xs cursor-pointer select-none">
                    {label}
                    {key === "stockList" && (
                      <Select value={activeCategory} onValueChange={setActiveCategory}>
                        <SelectTrigger className="h-5 text-xs w-[76px] ml-1.5 inline-flex">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CATEGORY_TABS.map((tab) => (
                            <SelectItem key={tab.value} value={tab.value} className="text-xs">
                              {tab.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 제어 바 — 캡처 모드에서 숨김 */}
        {!isCaptureMode && (
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-b bg-muted/20 flex-wrap">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch
                  id="hide-amounts"
                  checked={hideAmounts}
                  onCheckedChange={setHideAmounts}
                  className="scale-90"
                />
                <Label htmlFor="hide-amounts" className="text-xs cursor-pointer select-none">금액 숨기기</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="capture-mode"
                  checked={isCaptureMode}
                  onCheckedChange={setIsCaptureMode}
                  className="scale-90"
                />
                <Label htmlFor="capture-mode" className="text-xs cursor-pointer select-none">캡처 모드</Label>
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
        )}

        {/* 카드 미리보기 */}
        <div className={`overflow-y-auto flex-1 outline-none focus:outline-none focus-visible:outline-none [&_*]:outline-none [&_*]:focus:outline-none [&_*]:focus-visible:outline-none [&_*]:ring-0 [&_*]:focus:ring-0 [&_*]:focus-visible:ring-0 [&_path]:outline-none ${isCaptureMode ? "h-dvh p-2 sm:p-4" : "p-2 sm:p-4"}`}>
          {/* 캡처 모드 해제 버튼 */}
          {isCaptureMode && (
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setIsCaptureMode(false)}
                className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/60 hover:bg-muted px-2.5 py-1 rounded-full transition-colors"
              >
                <X className="size-3" />
                캡처 모드 해제
              </button>
            </div>
          )}
          <div className="w-[460px] max-w-full mx-auto">
            <ShareCard
              hideAmounts={hideAmounts}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
              sections={sections}
              cardRef={cardRef}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
