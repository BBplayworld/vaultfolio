"use client";

import { useState } from "react";
import { Monitor, Smartphone, Share, Copy, Check, Info, RefreshCw, AlertTriangle, SquarePlus } from "lucide-react";
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
import { IosShareStep, IosChromeShareStep, IosWhaleShareStep, IosAddToHomeStep, SamsungMenuStep, SamsungAddToHomeStep } from "./pwa-guide-illustrations";

interface PwaInstallGuideDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PwaInstallGuideDialog({ open, onOpenChange }: PwaInstallGuideDialogProps) {
  const [copied, setCopied] = useState(false);
  const [iosBrowser, setIosBrowser] = useState<"safari" | "chrome" | "whale">("safari");
  const [androidBrowser, setAndroidBrowser] = useState<"chrome" | "whale" | "samsung">("chrome");

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
      <DialogContent className="sm:max-w-[640px] md:max-w-[680px] max-h-[95dvh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl touch-pan-y">
        <DialogHeader className="px-6 pt-6 pb-3 text-left border-b border-border/50">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Info className="size-5" style={{ color: MAIN_PALETTE[0] }} />
            앱 설치가 안 되나요?
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed mt-1">
            설치 버튼이 안 보이거나, 아이콘을 지운 뒤 재설치가 안 되거나, 카카오톡·인스타 같은 <span className="font-semibold text-foreground">인앱 브라우저처럼 설치가 막힌 환경</span>일 수 있어요. 아래에서 사용 중인 환경을 선택해 주세요.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="pc" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-6 border-b border-border/60 bg-muted/10 py-2">
            <TabsList className="grid w-full grid-cols-3 h-10 p-0.5 bg-muted/40 rounded-lg">
              <TabsTrigger value="pc" className="text-sm py-1.5 flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-background font-semibold">
                <Monitor className="size-3.5" />
                PC (크롬/엣지/웨일)
              </TabsTrigger>
              <TabsTrigger value="android" className="text-sm py-1.5 flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-background font-semibold">
                <Smartphone className="size-3.5" />
                Android
              </TabsTrigger>
              <TabsTrigger value="ios" className="text-sm py-1.5 flex items-center justify-center gap-1.5 rounded-md data-[state=active]:bg-background font-semibold">
                <Share className="size-3.5" />
                iOS (Safari·크롬·웨일 등)
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* 1. PC (Windows/macOS) */}
            <TabsContent value="pc" className="m-0 focus-visible:ring-0 space-y-4">
              <div className="space-y-4 text-sm">
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 items-start text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">시크릿 모드(사생활 보호 모드) 설치 불가</p>
                    <p className="leading-relaxed text-sm text-amber-600/95 dark:text-amber-400/90">
                      브라우저의 시크릿 모드 또는 사생활 보호 모드에서는 보안 정책과 쿠키/스토리지 차단으로 인해 앱 설치(PWA) 기능이 지원되지 않습니다. <strong>일반 브라우저 창으로 웹사이트에 다시 접속</strong>하여 설치를 진행해 주세요.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-t pt-4">
                  <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">!</span>
                  <div className="text-muted-foreground leading-relaxed space-y-2 flex-1">
                     <p className="text-amber-600 dark:text-amber-400 font-semibold text-sm">바탕화면 아이콘만 지운 후 재설치가 안 될 때 (중요)</p>
                     <p className="text-sm">
                       브라우저에 기존 설치 기록이 남아있는 상태입니다. <strong className="font-semibold text-foreground">앱 관리 주소(chrome://apps)가 클립보드에 자동으로 복사되었습니다.</strong> 만약 복사되지 않았다면 아래 버튼으로 직접 복사해 주세요.
                     </p>
                     <div className="flex items-center gap-2 my-2 bg-muted/60 rounded-lg p-2 border">
                       <code className="text-sm font-mono text-foreground flex-1 select-all pl-1">chrome://apps</code>
                       <Button
                         type="button"
                         size="sm"
                         variant="ghost"
                         onClick={handleCopyAppsLink}
                         className="h-8 px-3 text-sm gap-1"
                       >
                         {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
                         {copied ? "복사됨" : "주소 복사"}
                       </Button>
                     </div>
                     <p className="text-sm">
                       이동 후 나타나는 앱 목록에서 <span className="text-foreground font-semibold">시크릿에셋</span>을 우클릭하고 <span className="text-foreground font-semibold">[Chrome에서 제거]</span>를 클릭한 뒤, 이 페이지를 새로고침(<span className="font-mono text-sm border px-1.5 py-0.5 rounded bg-muted">F5</span>)해 주세요.
                     </p>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 items-start text-sm text-amber-700 dark:text-amber-400 mt-2">
                  <AlertTriangle className="size-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">Firefox 및 일부 브라우저 미지원</p>
                    <p className="leading-relaxed text-sm text-amber-600/95 dark:text-amber-400/90">
                      Firefox 등 일부 브라우저는 PWA 설치를 지원하지 않습니다. Chrome, Edge, 또는 웨일 브라우저로 주소를 열어 설치를 진행해 주세요.
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* 2. Android */}
            <TabsContent value="android" className="m-0 focus-visible:ring-0 space-y-5">
              {/* 브라우저별 선택 칩 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">사용 중인 브라우저:</span>
                <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg border">
                  {(["chrome", "whale", "samsung"] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setAndroidBrowser(b)}
                      className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors capitalize ${
                        androidBrowser === b ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {b === "chrome" ? "Chrome" : b === "whale" ? "Whale" : "삼성 인터넷"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 1단계 */}
                <div className="flex flex-col space-y-3 p-4 rounded-xl border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">1</span>
                    <p className="font-semibold text-sm">
                      {androidBrowser === "chrome" ? "Chrome" : androidBrowser === "whale" ? "Whale" : "삼성 인터넷"} 메뉴 열기
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed h-12">
                    {androidBrowser === "chrome" && (
                      <>
                        크롬 브라우저 우측 상단 메뉴(<span className="font-semibold text-foreground font-mono">⋮</span>) 터치 후, 나타나는 메뉴에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 선택합니다.
                      </>
                    )}
                    {androidBrowser === "whale" && (
                      <>
                        웨일 브라우저 하단 우측 메뉴(<span className="font-semibold text-foreground font-mono">≡</span>) 터치 후, 나타나는 메뉴에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 선택합니다.
                      </>
                    )}
                    {androidBrowser === "samsung" && (
                      <>
                        삼성 인터넷 하단 툴바 우측 메뉴(<span className="font-semibold text-foreground font-mono">☰</span>) 터치 후, 나타나는 패널 우측 최상단의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">+ 현재 페이지 추가</span> 버튼을 터치합니다.
                      </>
                    )}
                  </p>
                  <div className="flex-1 flex items-center justify-center pt-2">
                    {androidBrowser === "chrome" && (
                      <IosChromeShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                    {androidBrowser === "whale" && (
                      <IosWhaleShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                    {androidBrowser === "samsung" && (
                      <SamsungMenuStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                  </div>
                </div>

                {/* 2단계 */}
                <div className="flex flex-col space-y-3 p-4 rounded-xl border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-bold">2</span>
                    <p className="font-semibold text-sm">
                      {androidBrowser === "samsung" ? "홈 화면" : "홈 화면에 추가"} 선택
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed h-12">
                    {androidBrowser === "samsung" ? (
                      <>
                        나타나는 &lsquo;현재 페이지 추가&rsquo; 메뉴에서 <span className="font-semibold text-foreground">홈 화면</span>을 선택하여 설치를 완료합니다.
                      </>
                    ) : (
                      <>
                        공유 시트 메뉴에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">홈 화면에 추가 <SquarePlus className="size-3" /></span> 항목을 찾아 터치하고 [추가]를 누릅니다.
                      </>
                    )}
                  </p>
                  <div className="flex-1 flex items-center justify-center pt-2">
                    {androidBrowser === "samsung" ? (
                      <SamsungAddToHomeStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    ) : (
                      <IosAddToHomeStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 flex gap-3 items-start text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">인앱 브라우저 제한 안내</p>
                    <p className="leading-relaxed text-sm text-amber-600 dark:text-amber-300">
                      카카오톡, 네이버, 인스타그램 내에서는 홈 화면 추가가 원천적으로 막혀있습니다. 우측 상단 메뉴에서 <span className="font-semibold text-foreground">&ldquo;다른 브라우저로 열기&rdquo;</span>를 통해 기본 크롬/삼성 인터넷으로 접속해야 합니다.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold">※ 앱 완전 삭제 및 초기화 (공통)</strong><br />
                  앱이 재설치되지 않는 경우, 홈 화면의 앱 아이콘을 길게 눌러 삭제(설치 제거)하거나 기기 [설정]에서 앱을 완전히 삭제한 후 다시 시도해 주세요.
                </div>
              </div>
            </TabsContent>

            {/* 3. iOS */}
            <TabsContent value="ios" className="m-0 focus-visible:ring-0 space-y-5">
              {/* 브라우저별 선택 칩 */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground font-medium">사용 중인 브라우저:</span>
                <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg border">
                  {(["safari", "chrome", "whale"] as const).map((b) => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => setIosBrowser(b)}
                      className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors capitalize ${
                        iosBrowser === b ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {b === "safari" ? "Safari" : b === "chrome" ? "Chrome" : "Whale"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* 1단계 */}
                <div className="flex flex-col space-y-3 p-4 rounded-xl border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">1</span>
                    <p className="font-semibold text-sm">
                      {iosBrowser === "safari" ? "Safari" : iosBrowser === "chrome" ? "Chrome" : "Whale"} 공유 메뉴 열기
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed h-12">
                    {iosBrowser === "safari" && (
                      <>
                        Safari 하단 우측 메뉴(<span className="font-semibold text-foreground font-mono">⋯</span>) 터치 후, 메뉴창 상단의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5"><Share className="size-3" /> [공유]</span> 버튼을 선택합니다.
                      </>
                    )}
                    {iosBrowser === "chrome" && (
                      <>
                        크롬 브라우저 주소창 우측에 위치한 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 터치합니다.
                      </>
                    )}
                    {iosBrowser === "whale" && (
                      <>
                        웨일 브라우저 하단 우측 메뉴(<span className="font-semibold text-foreground font-mono">≡</span>) 터치 후, 나타나는 메뉴에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 선택합니다.
                      </>
                    )}
                  </p>
                  <div className="flex-1 flex items-center justify-center pt-2">
                    {iosBrowser === "safari" && (
                      <IosShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                    {iosBrowser === "chrome" && (
                      <IosChromeShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                    {iosBrowser === "whale" && (
                      <IosWhaleShareStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                    )}
                  </div>
                </div>

                {/* 2단계 */}
                <div className="flex flex-col space-y-3 p-4 rounded-xl border border-border/50 bg-muted/10">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">2</span>
                    <p className="font-semibold text-sm">홈 화면에 추가 클릭</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed h-12">
                    나타나는 공유 시트 메뉴를 아래로 스크롤하여 <span className="font-semibold text-foreground">[홈 화면에 추가]</span> 항목을 찾아 터치하고, 우측 상단 [추가]를 누릅니다.
                  </p>
                  <div className="flex-1 flex items-center justify-center pt-2">
                    <IosAddToHomeStep className="w-full max-w-[280px] text-foreground transition-all hover:scale-[1.02]" />
                  </div>
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5 flex gap-3 items-start text-sm text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="size-4.5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold text-sm">카카오톡·인스타그램 등으로 접속하셨나요?</p>
                    <p className="leading-relaxed text-sm text-amber-600 dark:text-amber-300">
                      인앱 브라우저에서는 공유 메뉴에 홈 화면 추가 기능이 없습니다. 화면의 <strong className="text-foreground">우측 상단 메뉴(점 3개 등) → &ldquo;다른 브라우저로 열기&rdquo;</strong>를 눌러 Safari 또는 Chrome 브라우저로 이동해 주세요.
                    </p>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-muted/20 p-3.5 text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-foreground font-semibold">※ 앱 완전 삭제 및 초기화 (공통)</strong><br />
                  앱이 재설치되지 않는 경우, 홈 화면의 앱 아이콘을 길게 눌러 삭제(설치 제거)하거나 기기 [설정]에서 앱을 완전히 삭제한 후 다시 시도해 주세요.
                </div>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="px-6 py-4 border-t border-border/60 bg-muted/20 flex items-center justify-between">
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <RefreshCw className="size-3 animate-spin-slow" />
            앱 정보 변경 시 반드시 새로고침해 주세요
          </p>
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="text-sm px-5 h-9 text-white font-semibold rounded-lg shadow-sm"
            style={{ backgroundColor: MAIN_PALETTE[0] }}
          >
            안내 확인 완료
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
