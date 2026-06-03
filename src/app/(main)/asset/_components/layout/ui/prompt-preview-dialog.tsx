"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { MAIN_PALETTE } from "@/config/theme";

export interface PromptTab {
  id: string;
  label: string;
  sublabel?: string;
  getPrompt: () => string;
}

interface PromptPreviewDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  tabs: PromptTab[];        // 1개면 탭 영역 숨김
  copySuccessMessage?: string;
}

// AI 프롬프트 미리보기 + 복사 공용 다이얼로그
// - tool-menu(AI 평가용 자산 현황)·X-Ray(주식 X-Ray) 공통 사용
// - 탭이 1개면 셀렉터 숨김
export function PromptPreviewDialog({
  open,
  onOpenChange,
  title,
  description,
  tabs,
  copySuccessMessage = "프롬프트가 복사되었습니다.",
}: PromptPreviewDialogProps) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [copied, setCopied] = useState(false);

  const activeTab = tabs[Math.min(selectedIdx, tabs.length - 1)] ?? tabs[0];
  // 다이얼로그 열려 있는 동안만 프롬프트 생성 (닫혀 있을 땐 비용 0)
  const promptText = useMemo(
    () => (open && activeTab ? activeTab.getPrompt() : ""),
    [open, activeTab],
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promptText);
      setCopied(true);
      toast.success(copySuccessMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {tabs.length > 1 && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {tabs.map((t, i) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedIdx(i)}
                className={`flex-1 flex flex-col items-center gap-0.5 px-2 py-1.5 rounded text-xs transition-colors ${
                  i === selectedIdx
                    ? "bg-background shadow-sm font-medium"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                style={i === selectedIdx ? { color: MAIN_PALETTE[0] } : undefined}
              >
                <span>{t.label}</span>
                {t.sublabel && (
                  <span className="text-[10px] opacity-60 hidden sm:block leading-tight text-center">{t.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        )}
        <div className="space-y-3 overflow-y-auto flex-1 pr-2">
          <Textarea
            value={promptText}
            readOnly
            className="min-h-[380px] w-full font-mono text-sm resize-none"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
          <Button
            onClick={handleCopy}
            style={{ backgroundColor: MAIN_PALETTE[0] }}
            className="text-white hover:opacity-90 border-none"
          >
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
  );
}
