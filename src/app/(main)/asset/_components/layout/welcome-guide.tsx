"use client";

import React from "react";
import { Building2, TrendingUp, Shield, Sparkles, Activity, ArrowRight, FolderInput, Pencil, ImageUp, Globe, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState } from "react";
import { dispatchAddRealEstate, dispatchAddStock } from "@/app/(main)/asset/_components/layout/asset-dispatch";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { formatShortCurrency } from "@/lib/number-utils";
import { AssetDonutChart, SectionBar, TreemapItem } from "@/app/(main)/asset/_components/main-nav/home/dashboard";
import { StockSummaryHeader, StockCategorySection, StockRowItem } from "@/app/(main)/asset/_components/main-nav/detail/tabs/stock-tab";
import { assignColors, computeStockMetrics, getMultiplier } from "@/app/(main)/asset/_components/main-nav/detail/asset-detail-tabs";
import { Stock } from "@/types/asset";
import previewData from "./welcome-preview-data.json";

// ── 예시 데이터 정적 계산 (컴포넌트 외부)
const EXCHANGE_RATES = previewData.exchangeRates as { USD: number; JPY: number };
const PREVIEW_STOCKS = previewData.stocks as unknown as Stock[];

const stockTotal = PREVIEW_STOCKS.reduce(
  (s, st) => s + st.quantity * st.currentPrice * getMultiplier(st.currency, EXCHANGE_RATES),
  0,
);
const financialValue = stockTotal + previewData.cryptoValue + previewData.cashValue;
const totalAsset = previewData.realEstateValue + financialValue;
const netAsset = totalAsset - previewData.loanValue;
const grossTotal = totalAsset + previewData.loanValue;

const PREVIEW_TREEMAP: TreemapItem[] = [
  { key: "realEstate", name: "부동산", value: previewData.realEstateValue, color: MAIN_PALETTE[0], pct: (previewData.realEstateValue / grossTotal) * 100 },
  { key: "financial", name: "금융자산", value: financialValue, color: MAIN_PALETTE[3], pct: (financialValue / grossTotal) * 100 },
  { key: "liability", name: "부채", value: previewData.loanValue, color: MAIN_PALETTE[1], pct: (previewData.loanValue / grossTotal) * 100 },
];

const finBase = [
  { key: "stocks", label: "주식", value: stockTotal },
  { key: "crypto", label: "암호화폐", value: previewData.cryptoValue },
  { key: "cash", label: "현금성", value: previewData.cashValue },
].filter((d) => d.value > 0);
const finColors = assignColors(finBase);
const PREVIEW_FIN_BAR = finBase.map((d, i) => ({ ...d, color: finColors[i] }));

const foreignStocks = PREVIEW_STOCKS.filter((s) => s.category === "foreign").sort(
  (a, b) => b.quantity * b.currentPrice * EXCHANGE_RATES.USD - a.quantity * a.currentPrice * EXCHANGE_RATES.USD,
);
const foreignTotal = foreignStocks.reduce((s, st) => s + st.quantity * st.currentPrice * EXCHANGE_RATES.USD, 0);
const foreignBarValues = foreignStocks.map((st) => ({ value: st.quantity * st.currentPrice * EXCHANGE_RATES.USD }));
const foreignBarColors = assignColors(foreignBarValues);
const PREVIEW_BAR_ITEMS = foreignStocks.map((st, i) => ({ stock: st, value: foreignBarValues[i].value, color: foreignBarColors[i] }));
const foreignProfit = foreignStocks.reduce((s, st) => s + computeStockMetrics(st, EXCHANGE_RATES, foreignTotal).profit, 0);
const foreignCost = foreignTotal - foreignProfit;
const foreignProfitRate = foreignCost > 0 ? (foreignProfit / foreignCost) * 100 : 0;

export function WelcomeGuide() {
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);

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

      {/* 예시 미리보기 */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">포트폴리오 미리보기</p>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">예시 데이터</Badge>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* 왼쪽: 자산 분포 도넛 + 금융자산 구성 바 */}
          <div className={`rounded-xl ${ASSET_THEME.distributionCard.bg} border border-zinc-500/60 p-5 space-y-5`}>
            {/* 순자산 요약 */}
            <div className={`flex items-center justify-between rounded-lg ${ASSET_THEME.distributionCard.sectionBg} border ${ASSET_THEME.distributionCard.sectionBorder} px-4 py-3`}>
              <div>
                <p className={`text-xs font-semibold ${ASSET_THEME.distributionCard.muted}`}>순자산</p>
                <p className={`text-2xl font-extrabold tabular-nums ${ASSET_THEME.important}`}>{formatShortCurrency(netAsset)}</p>
                <p className={`text-[11px] ${ASSET_THEME.text.default}`}>{netAsset.toLocaleString("ko-KR")}원</p>
              </div>
              <div className="text-right space-y-1.5">
                <div className="text-xs">
                  <span className={ASSET_THEME.distributionCard.muted}>총 자산 </span>
                  <span className={`font-bold ${ASSET_THEME.primary.text}`}>{formatShortCurrency(totalAsset)}</span>
                </div>
                <div className="text-xs">
                  <span className={ASSET_THEME.distributionCard.muted}>총 부채 </span>
                  <span className={`font-bold ${ASSET_THEME.liability}`}>{formatShortCurrency(previewData.loanValue)}</span>
                </div>
              </div>
            </div>

            {/* 자산 분포 도넛 차트 */}
            <AssetDonutChart items={PREVIEW_TREEMAP} netAsset={netAsset} screenshotMode={true} />

            {/* 금융자산 구성 바 */}
            <div className="space-y-2 border-t border-border/40 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className={`font-semibold ${ASSET_THEME.distributionCard.muted}`}>금융자산 구성</span>
                <span className={`font-bold tabular-nums ${ASSET_THEME.primary.text}`}>{formatShortCurrency(financialValue)}</span>
              </div>
              <SectionBar items={PREVIEW_FIN_BAR} total={financialValue} />
            </div>
          </div>

          {/* 오른쪽: 인증샷 가이드 + 주식 종합 + 주식 상세 */}
          <div className="space-y-3">
            {/* 인증샷 가이드 배너 */}
            <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex items-center gap-2.5">
              <Camera className="size-4 text-primary shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">인증샷으로 공유하세요</p>
                <p className="text-[11px] text-muted-foreground">우측 상단 메뉴 → 인증샷 · 자산 분포·주식 종합·상세 섹션 선택 가능</p>
              </div>
            </div>

            {/* 주식 종합 */}
            <StockSummaryHeader
              totalValue={foreignTotal}
              totalProfit={foreignProfit}
              totalProfitRate={foreignProfitRate}
              screenshotMode={true}
            />

            {/* 주식 상세 — 해외주식 고정 */}
            <StockCategorySection
              activeCategory="foreign"
              onCategoryChange={() => { }}
              filteredStocks={foreignStocks}
              totalValue={foreignTotal}
              barItems={PREVIEW_BAR_ITEMS}
              barColors={foreignBarColors}
              screenshotMode={true}
              renderItem={(stock, _isFirst, color) => {
                const m = computeStockMetrics(stock, EXCHANGE_RATES, foreignTotal);
                return (
                  <StockRowItem
                    key={stock.id}
                    stock={stock}
                    color={color}
                    pct={m.pct}
                    currentVal={m.currentVal}
                    profit={m.profit}
                    profitRate={m.profitRate}
                    screenshotMode={true}
                  />
                );
              }}
            />
          </div>
        </div>
      </div>
      <p className={`text-[11px] text-center ${ASSET_THEME.distributionCard.muted}`}>
        실제 자산을 입력하면 이 화면이 내 포트폴리오로 채워집니다.
      </p>

      {/* CTA 섹션 */}
      <div className="rounded-xl border border-border/60 bg-card/80 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">첫 번째 자산을 추가해보세요</h2>
          <p className="text-sm text-muted-foreground">
            부동산, 주식, 암호화폐, 현금, 대출까지 — 모든 자산을 한 곳에서 관리하세요.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button size="lg" className="gap-2 bg-primary" onClick={dispatchAddRealEstate}>
            <Building2 className="size-4" />
            부동산 추가
            <ArrowRight className="size-4" />
          </Button>
          <Popover open={isStockMenuOpen} onOpenChange={setIsStockMenuOpen}>
            <PopoverTrigger asChild>
              <Button size="lg" variant="outline" className="gap-2" style={{ backgroundColor: MAIN_PALETTE[0] }}>
                <TrendingUp className="size-4" />
                주식 추가
                <ArrowRight className="size-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="center" className="w-52 p-1.5 space-y-0.5">
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => { setIsStockMenuOpen(false); dispatchAddStock("screenshot"); }}
              >
                <ImageUp className="size-4 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <p className="font-medium">스크린샷 가져오기</p>
                  <p className="text-xs text-muted-foreground">스크린샷 화면 자동 인식</p>
                </div>
              </button>
              <button
                type="button"
                className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
                onClick={() => { setIsStockMenuOpen(false); dispatchAddStock("manual"); }}
              >
                <Pencil className="size-4 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <p className="font-medium">직접 입력</p>
                  <p className="text-xs text-muted-foreground">수동으로 종목 추가</p>
                </div>
              </button>
            </PopoverContent>
          </Popover>
          <Button size="lg" variant="outline" className="gap-2 text-muted-foreground hover:text-foreground" onClick={handleImport}>
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
