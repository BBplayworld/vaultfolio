"use client";

import { useState } from "react";
import { Monitor, Smartphone, Share, Copy, Check, Info, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MAIN_PALETTE } from "@/config/theme";

interface PwaInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PwaInstallGuideDialog({ open, onOpenChange }: PwaInstallGuideDialogProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyAppsLink = async () => {
    try {
      await navigator.clipboard.writeText("chrome://apps");
      setCopied(true);
      toast.success("복사되었습니다. 크롬 주소창에 붙여넣고 이동해주세요.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("주소 복사에 실패했습니다.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[95dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl touch-pan-y">
        <DialogHeader className="px-6 pt-6 pb-2 text-left">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Info className="size-5" style={{ color: MAIN_PALETTE[0] }} />
            앱 설치 및 재설치 가이드
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            바탕화면 아이콘을 삭제하셨거나 브라우저 문제로 설치 버튼이 작동하지 않는 경우, 아래 가이드에 따라 완전 삭제 후 재설치를 진행해 주세요.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pc" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-border/60">
            <TabsList className="grid w-full grid-cols-3 h-10 p-0.5 bg-muted/40 rounded-lg">
              <TabsTrigger value="pc" className="text-xs py-1.5 flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-background">
                <Monitor className="size-3.5" />
                PC (크롬/엣지)
              </TabsTrigger>
              <TabsTrigger value="android" className="text-xs py-1.5 flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-background">
                <Smartphone className="size-3.5" />
                Android
              </TabsTrigger>
              <TabsTrigger value="ios" className="text-xs py-1.5 flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-background">
                <Share className="size-3.5" />
                iOS (Safari)
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* 1. PC (Windows/macOS) */}
            <TabsContent value="pc" className="m-0 focus-visible:ring-0 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">1</span>
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">주소창 아이콘 설치:</span><br />
                    브라우저 주소창 우측 끝에 표시되는 <span className="font-semibold text-foreground">모니터+화살표(앱 설치)</span> 또는 <span className="font-semibold text-foreground">[앱 열기]</span> 아이콘을 클릭하여 설치 및 실행할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">2</span>
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">브라우저 메뉴 설치:</span><br />
                    브라우저 우측 상단 <span className="font-semibold text-foreground">메뉴(점 3개) → [시크릿에셋 설치]</span> 또는 <span className="font-semibold text-foreground">[시크릿에셋 열기]</span>를 선택하세요.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">3</span>
                  <div className="text-muted-foreground leading-relaxed space-y-1">
                    <p className="text-amber-600 dark:text-amber-400 font-semibold">바탕화면 아이콘만 지운 후 재설치가 안 될 때 (중요)</p>
                    <p>
                      브라우저에 기존 설치 기록이 남아있는 상태입니다. **앱 관리 주소(`chrome://apps`)가 클립보드에 자동으로 복사되었습니다.** 만약 복사되지 않았다면 아래 버튼으로 직접 복사해 주세요.
                    </p>
                    <div className="flex items-center gap-2 my-2 bg-muted/60 rounded-lg p-2 border">
                      <code className="text-xs font-mono text-foreground flex-1 select-all">chrome://apps</code>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCopyAppsLink}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                        {copied ? "복사됨" : "주소 복사"}
                      </Button>
                    </div>
                    <p>
                      이동 후 나타나는 앱 목록에서 <span className="text-foreground font-semibold">시크릿에셋</span>을 우클릭하고 <span className="text-foreground font-semibold">[Chrome에서 제거]</span>를 클릭한 뒤, 이 페이지를 새로고침(<span className="font-mono text-xs border px-1 rounded bg-muted">F5</span>)해 주세요.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 2. Android */}
            <TabsContent value="android" className="m-0 focus-visible:ring-0 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">1</span>
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">브라우저 메뉴 설치:</span><br />
                    크롬 또는 삼성 인터넷 우측 상단/하단 <span className="font-semibold text-foreground">메뉴(점 3개/줄 3개) → [앱 설치]</span> 또는 <span className="font-semibold text-foreground">[홈 화면에 추가]</span>를 터치하여 재설치할 수 있습니다.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">2</span>
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">완전 삭제 후 재설치:</span><br />
                    바탕화면 아이콘 삭제 후 재설치가 작동하지 않는다면, 기기의 <span className="font-semibold text-foreground">[설정 → 애플리케이션 → 시크릿에셋]</span>을 찾아 <span className="font-semibold text-destructive">[설치 삭제]</span>한 후 브라우저 페이지를 새로고침하여 재진행해 주세요.
                  </p>
                </div>
              </div>
            </TabsContent>

            {/* 3. iOS (Safari) */}
            <TabsContent value="ios" className="m-0 focus-visible:ring-0 space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">1</span>
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">공유 버튼 클릭:</span><br />
                    Safari 브라우저 하단 툴바의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5"><Share className="size-3.5" /> [공유]</span> 아이콘을 누릅니다.
                  </p>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="shrink-0 size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">2</span>
                  <p className="text-muted-foreground leading-relaxed">
                    <span className="text-foreground font-semibold">홈 화면에 추가:</span><br />
                    나타나는 공유 시트에서 아래로 스크롤하여 <span className="font-semibold text-foreground">[홈 화면에 추가]</span> 버튼을 클릭하여 기기에 앱을 설치합니다.
                  </p>
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <RefreshCw className="size-3 animate-spin-slow" />
            삭제 후 반드시 웹페이지를 새로고침해 주세요
          </p>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-xs px-4 h-8 text-white"
            style={{ backgroundColor: MAIN_PALETTE[0] }}
          >
            확인했습니다
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
