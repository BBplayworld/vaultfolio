"use client";

import { Building2, TrendingUp, Shield, Sparkles, Activity, ArrowRight, FolderInput, Bitcoin, Wallet, CreditCard, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ASSET_THEME } from "@/config/theme";

// 미리보기용 예시 자산 데이터
const PREVIEW_CATEGORIES = [
  { key: "realEstate", label: "부동산", icon: Building2, color: ASSET_THEME.categoryColors.realEstate, value: 480_000_000, pct: 46 },
  { key: "stocks", label: "주식", icon: TrendingUp, color: ASSET_THEME.categoryColors.stocks, value: 310_000_000, pct: 30 },
  { key: "cash", label: "현금", icon: Wallet, color: ASSET_THEME.categoryColors.cash, value: 150_000_000, pct: 14 },
  { key: "crypto", label: "암호화폐", icon: Bitcoin, color: ASSET_THEME.categoryColors.crypto, value: 90_000_000, pct: 7 },
  { key: "loans", label: "대출", icon: CreditCard, color: ASSET_THEME.categoryColors.loans, value: 30_000_000, pct: 3, isLiability: true },
];

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
          title="영지식(Zero-Knowledge) 이중 암호화"
          desc="자산 데이터는 이 기기에만 저장됩니다. '짧은 공유 URL' 사용 시 서버를 거치더라도, 암호화 열쇠의 절반(URL)과 PIN 번호(4자리)가 완벽히 분리되어 서버 관리자조차 복호화가 100% 불가능한 원천 봉쇄 구조입니다."
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

      {/* 예시 자산분포 미리보기 — asset-distribution-cards 실제 스타일 적용 */}
      <div className="rounded-xl bg-gradient-to-br from-zinc-900 to-zinc-950 border border-zinc-500 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white">자산 분포 미리보기</p>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">예시 데이터</Badge>
        </div>

        {/* 순자산 요약 */}
        <div className="flex items-center justify-between rounded-lg bg-zinc-800/60 border border-zinc-700 px-4 py-3">
          <div>
            <p className="text-xs font-semibold text-zinc-400">순자산</p>
            <p className="text-2xl font-extrabold tabular-nums text-orange-400">10억</p>
            <p className="text-[11px] text-white">1,000,000,000원</p>
          </div>
          <div className="text-right space-y-1.5">
            <div className="text-xs">
              <span className="text-zinc-400">총 자산 </span>
              <span className="font-bold text-primary">10.3억</span>
            </div>
            <div className="text-xs">
              <span className="text-zinc-400">총 부채 </span>
              <span className="font-bold text-rose-400">3,000만</span>
            </div>
          </div>
        </div>

        {/* 자산 vs 부채 비율 바 */}
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-zinc-400">자산 / 부채 비율</p>
          <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
            <div
              className="flex items-center justify-center transition-all"
              style={{ width: "97%", backgroundColor: ASSET_THEME.categoryColors.realEstate }}
            >
              <span className="text-white text-[10px] font-bold drop-shadow select-none">97%</span>
            </div>
            <div
              className="flex items-center justify-center transition-all"
              style={{ width: "3%", backgroundColor: ASSET_THEME.categoryColors.loans }}
            />
          </div>
        </div>

        {/* 총 자산 구성 바 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-400">총 자산 구성</span>
            <span className="font-bold tabular-nums text-primary">10.3억</span>
          </div>
          <div className="flex h-8 w-full rounded-xl overflow-hidden gap-px">
            {PREVIEW_CATEGORIES.filter(c => !c.isLiability).map((cat) => (
              <div
                key={cat.key}
                className="relative flex items-center justify-center overflow-hidden hover:opacity-85 transition-opacity"
                style={{ width: `${cat.pct / 0.97}%`, backgroundColor: cat.color }}
                title={`${cat.label}: ${formatAmount(cat.value)} (${(cat.pct / 0.97).toFixed(1)}%)`}
              >
                {(cat.pct / 0.97) > 10 && (
                  <span className="text-white text-[10px] font-bold drop-shadow select-none px-1 truncate">
                    {(cat.pct / 0.97).toFixed(0)}%
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {PREVIEW_CATEGORIES.filter(c => !c.isLiability).map((cat) => {
              const Icon = cat.icon;
              return (
                <div key={cat.key} className="flex items-center gap-1">
                  <span className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: cat.color }} />
                  <Icon className="size-3 text-zinc-500 flex-shrink-0" />
                  <span className="text-xs text-zinc-300">{cat.label}</span>
                  <span className="text-xs font-bold tabular-nums text-primary">{(cat.pct / 0.97).toFixed(1)}%</span>
                  <span className="text-xs tabular-nums text-white">(<span>{formatAmount(cat.value)}</span>)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 총 부채 구성 바 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-400">총 부채 구성</span>
            <span className="font-bold tabular-nums text-rose-400">3,000만</span>
          </div>
          <div className="flex h-8 w-full rounded-xl overflow-hidden gap-px">
            <div
              className="relative flex items-center justify-center overflow-hidden hover:opacity-85 transition-opacity"
              style={{ width: "100%", backgroundColor: ASSET_THEME.categoryColors.loans }}
            >
              <span className="text-white text-[10px] font-bold drop-shadow select-none px-1">100%</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            <div className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm flex-shrink-0" style={{ backgroundColor: ASSET_THEME.categoryColors.loans }} />
              <CreditCard className="size-3 text-zinc-500 flex-shrink-0" />
              <span className="text-xs text-zinc-300">대출</span>
              <span className="text-xs font-bold tabular-nums text-primary">100%</span>
              <span className="text-xs tabular-nums text-white">(<span>3,000만</span>)</span>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-zinc-500 text-center">
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
