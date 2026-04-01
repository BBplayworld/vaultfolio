"use client";

import { Building2, TrendingUp, Shield, Sparkles, Activity, ArrowRight, FolderInput, Bitcoin, Wallet, CreditCard, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// 미리보기용 예시 자산 데이터
const PREVIEW_CATEGORIES = [
  { key: "realEstate", label: "부동산", icon: Building2, color: "#0d9488", value: 450_000_000, pct: 45 },
  { key: "stocks", label: "주식", icon: TrendingUp, color: "#2563eb", value: 300_000_000, pct: 30 },
  { key: "cash", label: "현금", icon: Wallet, color: "#16a34a", value: 150_000_000, pct: 15 },
  { key: "crypto", label: "암호화폐", icon: Bitcoin, color: "#7c3aed", value: 70_000_000, pct: 7 },
  { key: "loans", label: "대출", icon: CreditCard, color: "#e11d48", value: 30_000_000, pct: 3, isLiability: true },
] as const;

function formatAmount(n: number) {
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(0)}억`;
  if (n >= 10_000) return `${(n / 10_000).toFixed(0)}만`;
  return n.toLocaleString();
}

export function WelcomeGuide() {
  const handleImport = () => {
    window.dispatchEvent(new CustomEvent("trigger-import"));
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6 md:p-10 space-y-8">

      {/* 헤로 섹션 */}
      <div className="text-center space-y-3">
        <Badge variant="outline" className="border-primary/40 text-primary px-3 py-1 text-xs font-medium">
          시작하기
        </Badge>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          나만의 비밀 자산 금고
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto leading-relaxed">
          로그인 없이, 서버 저장 없이.<br className="hidden sm:block" />
          내 자산은 오직 내 브라우저에만 보관됩니다.
        </p>
      </div>

      {/* 특징 카드 3개 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FeatureCard
          icon={Shield}
          title="로그인·서버 저장 없음"
          desc="데이터는 이 기기 브라우저에만 보관되며 외부로 전송되지 않습니다. '공유 URL 복사'로 PIN 암호화된 자산 현황을 가족·파트너와 안전하게 공유할 수 있습니다."
        />
        <FeatureCard
          icon={Sparkles}
          title="AI 자산 분석"
          desc="상단 자산 관리 메뉴에서 Grok·Gemini·GPT에 바로 붙여넣을 수 있는 AI 평가용 프롬프트를 생성할 수 있습니다. 데이터 내보내기·가져오기를 지원합니다."
        />
        <FeatureCard
          icon={Activity}
          title="매일 자동 업데이트"
          desc="보유 주식 현재가와 환율(USD·JPY)을 매일 최신 정보로 자동 반영합니다."
        />
      </div>

      {/* 예시 자산분포 미리보기 */}
      <div className="rounded-xl border border-border/60 bg-card/60 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">자산 분포 미리보기</p>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">예시 데이터</Badge>
        </div>

        {/* 스택 바 */}
        <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
          {PREVIEW_CATEGORIES.map((cat) => (
            <div
              key={cat.key}
              style={{ width: `${cat.pct}%`, backgroundColor: cat.color }}
              className="transition-all"
              title={`${cat.label} ${cat.pct}%`}
            />
          ))}
        </div>

        {/* 범례 카드 */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {PREVIEW_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div key={cat.key} className="rounded-lg border border-border/40 bg-background/60 p-2.5 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                  <Icon className="size-3 text-muted-foreground" />
                  <span className="text-[11px] font-medium truncate">{cat.label}</span>
                </div>
                <p className="text-xs font-bold tabular-nums pl-0.5">{formatAmount(cat.value)}</p>
                <p className="text-[10px] text-muted-foreground">{cat.pct}%</p>
              </div>
            );
          })}
        </div>

        <p className="text-[11px] text-muted-foreground/70 text-center">
          실제 자산을 입력하면 이 화면이 내 포트폴리오로 채워집니다.
        </p>
      </div>

      {/* CTA 섹션 */}
      <div className="rounded-xl border border-border/60 bg-card/80 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">첫 번째 자산을 추가해보세요</h2>
          <p className="text-sm text-muted-foreground">
            부동산, 주식, 암호화폐, 현금, 대출까지 — 모든 자산을 한 곳에서 관리하세요.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button size="lg" className="gap-2" onClick={() => window.dispatchEvent(new CustomEvent("trigger-add-real-estate"))}>
            <Building2 className="size-4" />
            부동산 추가
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="outline" className="gap-2" onClick={() => window.dispatchEvent(new CustomEvent("trigger-add-stock"))}>
            <TrendingUp className="size-4" />
            주식 추가
            <ArrowRight className="size-4" />
          </Button>
          <Button size="lg" variant="secondary" className="gap-2 text-muted-foreground hover:text-foreground" onClick={handleImport}>
            <FolderInput className="size-4" />
            기존 데이터 가져오기
          </Button>
        </div>
      </div>

      {/* For international visitors */}
      <div className="rounded-xl border border-border/40 bg-muted/30 px-5 py-4 flex items-start gap-3">
        <Globe className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-foreground/70">For international visitors</span>
          {" — "}
          This app is designed exclusively for the Korean financial ecosystem (KRX).
          It supports Korean stocks (6-digit KRX tickers), KRW-based exchange rates (USD · JPY),
          Korean real estate types, and Korea-specific financial products such as IRP, ISA, and pension accounts.
        </p>
      </div>

    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/60 p-4 space-y-2">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
    </div>
  );
}
