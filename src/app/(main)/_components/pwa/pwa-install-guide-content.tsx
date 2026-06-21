"use client";

import { useState } from "react";
import { Share, SquarePlus, AlertTriangle, Copy, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BrowserEnv, GuideBrowser } from "@/lib/pwa/detect-browser";
import { InstallGuideAnimation } from "./pwa-guide-illustrations";

interface InstallGuideContentProps {
  env: BrowserEnv;
  className?: string;
}

const IOS_BROWSERS: GuideBrowser[] = ["safari", "chrome", "whale"];
const ANDROID_BROWSERS: GuideBrowser[] = ["chrome", "whale", "samsung"];
const BROWSER_LABEL: Record<GuideBrowser, string> = { safari: "Safari", chrome: "Chrome", whale: "Whale", samsung: "삼성 인터넷" };

/** 1단계(공유/메뉴 진입) 안내 문구 — 플랫폼·브라우저별 */
function step1Text(platform: "ios" | "android", browser: GuideBrowser) {
  if (browser === "samsung")
    return (<>하단 툴바 우측 메뉴(<span className="font-semibold text-foreground font-mono">☰</span>)에서 <span className="font-semibold text-foreground">+ 현재 페이지 추가</span>를 터치합니다.</>);
  if (browser === "whale")
    return (<>하단 우측 메뉴(<span className="font-semibold text-foreground font-mono">≡</span>)에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span>를 선택합니다.</>);
  if (browser === "chrome")
    return platform === "ios"
      ? (<>주소창 우측의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 터치합니다.</>)
      : (<>우측 상단 메뉴(<span className="font-semibold text-foreground font-mono">⋮</span>)에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span>를 선택합니다.</>);
  // safari
  return (<>하단 중앙의 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">공유 <Share className="size-3" /></span> 버튼을 터치합니다.</>);
}

/** 2단계(홈 화면에 추가 → 추가) 안내 문구 */
function step2Text(browser: GuideBrowser) {
  if (browser === "samsung")
    return (<>나타나는 &lsquo;현재 페이지 추가&rsquo;에서 <span className="font-semibold text-foreground">홈 화면</span>을 선택해 설치를 완료합니다.</>);
  return (<>메뉴에서 <span className="font-semibold text-foreground inline-flex items-center gap-0.5">홈 화면에 추가 <SquarePlus className="size-3" /></span>를 찾아 터치하고 <span className="font-semibold text-foreground">[추가]</span>를 누릅니다.</>);
}

/**
 * 통합 설치 가이드 콘텐츠 — 접속 환경 자동감지.
 * 모바일(iOS·Android): 감지 브라우저 3단계 애니메이션 + 단계 설명. PC: 재설치 문제해결 안내.
 * 하단에 접이식 "설치가 안 되나요?" 섹션(환경별 문제해결)·작은 브라우저 재선택 링크.
 */
export function InstallGuideContent({ env, className }: InstallGuideContentProps) {
  const [browser, setBrowser] = useState<GuideBrowser>(env.browser);
  const [showChips, setShowChips] = useState(false);
  const [copied, setCopied] = useState(false);
  const [troubleOpen, setTroubleOpen] = useState(false);

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

  // ── PC: 단계 애니메이션 없음 → 재설치 문제해결 안내가 본문 ──
  if (env.platform === "pc") {
    return (
      <div className={className}>
        <PcTroubleshooting copied={copied} onCopy={handleCopyAppsLink} />
      </div>
    );
  }

  // ── 모바일(iOS·Android) ──
  const platform = env.platform; // "ios" | "android"
  const chips = platform === "ios" ? IOS_BROWSERS : ANDROID_BROWSERS;

  return (
    <div className={`flex flex-col gap-4 ${className ?? ""}`}>
      <InstallGuideAnimation platform={platform} browser={browser} className="w-full" />

      {/* 단계 설명 */}
      <div className="w-full space-y-2.5">
        <div className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
          <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">1</span>
          <p className="text-sm text-muted-foreground leading-relaxed">{step1Text(platform, browser)}</p>
        </div>
        <div className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-muted/10">
          <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">2</span>
          <p className="text-sm text-muted-foreground leading-relaxed">{step2Text(browser)}</p>
        </div>
      </div>

      {/* 브라우저 재선택 (오감지 대비, 기본 접힘) */}
      <div className="flex flex-col items-center gap-1.5">
        <button type="button" onClick={() => setShowChips(v => !v)} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2">
          다른 브라우저인가요?
        </button>
        {showChips && (
          <div className="flex gap-1 bg-muted/50 p-0.5 rounded-lg border">
            {chips.map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => setBrowser(b)}
                className={`text-xs px-2.5 py-0.5 rounded-md font-semibold transition-colors ${browser === b ? "bg-background text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {BROWSER_LABEL[b]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 접이식 문제해결 */}
      <Collapsible open={troubleOpen} onOpenChange={setTroubleOpen} className="rounded-xl border border-border bg-muted/10">
        <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold">
          <span className="flex items-center gap-2"><AlertTriangle className="size-4 text-amber-500" /> 설치가 안 되나요?</span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${troubleOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <MobileTroubleshooting />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** 모바일 문제해결 — 인앱 브라우저·완전 삭제 */
function MobileTroubleshooting() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
        <p className="font-semibold">카카오톡·인스타그램 등으로 접속하셨나요?</p>
        <p className="leading-relaxed text-amber-600 dark:text-amber-300 mt-0.5">
          인앱 브라우저에서는 홈 화면 추가가 막혀 있습니다. <span className="font-semibold text-foreground">우측 상단 메뉴 → &ldquo;다른 브라우저로 열기&rdquo;</span>로 Safari·Chrome·삼성 인터넷에서 다시 열어 주세요.
        </p>
      </div>
      <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground font-semibold">※ 재설치가 안 될 때</strong><br />
        홈 화면의 앱 아이콘을 길게 눌러 삭제하거나 기기 [설정]에서 앱을 완전히 삭제한 뒤 다시 시도해 주세요.
      </div>
    </div>
  );
}

/** PC 문제해결 — 시크릿모드·재설치(chrome://apps)·Firefox */
function PcTroubleshooting({ copied, onCopy }: { copied: boolean; onCopy: () => void }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 items-start text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">시크릿 모드(사생활 보호 모드) 설치 불가</p>
          <p className="leading-relaxed text-amber-600/95 dark:text-amber-400/90">
            시크릿/사생활 보호 모드에서는 보안 정책으로 앱 설치(PWA)가 지원되지 않습니다. <strong>일반 브라우저 창</strong>으로 다시 접속해 설치해 주세요.
          </p>
        </div>
      </div>

      <div className="flex items-start gap-3 border-t pt-4">
        <span className="shrink-0 size-5.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold mt-0.5">!</span>
        <div className="text-muted-foreground leading-relaxed space-y-2 flex-1">
          <p className="text-amber-600 dark:text-amber-400 font-semibold">아이콘만 지운 뒤 재설치가 안 될 때</p>
          <p>브라우저에 기존 설치 기록이 남은 상태입니다. <strong className="font-semibold text-foreground">앱 관리 주소(chrome://apps)가 자동 복사되었습니다.</strong> 복사되지 않았다면 아래 버튼으로 복사해 주세요.</p>
          <div className="flex items-center gap-2 my-2 bg-muted/60 rounded-lg p-2 border">
            <code className="text-sm font-mono text-foreground flex-1 select-all pl-1">chrome://apps</code>
            <Button type="button" size="sm" variant="ghost" onClick={onCopy} className="h-8 px-3 text-sm gap-1">
              {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
              {copied ? "복사됨" : "주소 복사"}
            </Button>
          </div>
          <p>이동 후 목록에서 <span className="text-foreground font-semibold">시크릿에셋</span>을 우클릭 → <span className="text-foreground font-semibold">[Chrome에서 제거]</span> 후, 이 페이지를 새로고침(<span className="font-mono border px-1.5 py-0.5 rounded bg-muted">F5</span>)해 주세요.</p>
        </div>
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-3 items-start text-amber-700 dark:text-amber-400">
        <AlertTriangle className="size-5 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold">Firefox 등 일부 브라우저 미지원</p>
          <p className="leading-relaxed text-amber-600/95 dark:text-amber-400/90">
            Firefox 등은 PWA 설치를 지원하지 않습니다. Chrome·Edge·웨일로 열어 설치해 주세요.
          </p>
        </div>
      </div>
    </div>
  );
}
