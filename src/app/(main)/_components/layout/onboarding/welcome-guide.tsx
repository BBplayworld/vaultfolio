"use client";

import React from "react";
import { Building2, TrendingUp, ShieldCheck, CloudLightning, EyeOff, ArrowRight, FolderInput, Pencil, ImageUp, Globe, Camera, Download, Share, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { useAssetImport } from "@/hooks/use-asset-import";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { toast } from "sonner";
import { TreemapItem, NetAssetSummaryBox } from "@/app/(main)/_components/views/home/dashboard";
import { StockSummaryHeader, StockCategorySection, StockRowItem } from "@/app/(main)/_components/views/detail/tabs/stock-tab";
import { assignColors, computeStockMetrics, getMultiplier } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { Stock } from "@/types/asset";
import { PwaInstallGuideDialog } from "../../pwa/pwa-install-guide-dialog";
import { dispatchAddStock, dispatchAddRealEstate } from "@/app/(main)/_components/layout/navigation/asset-dispatch";
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
const foreignMetrics = foreignStocks.map((st) => computeStockMetrics(st, EXCHANGE_RATES, foreignTotal));
const foreignProfit = foreignMetrics.reduce((s, m) => s + m.profit, 0);
const foreignCurrencyGain = foreignMetrics.reduce((s, m) => s + m.currencyGain, 0);
const foreignCost = foreignTotal - foreignProfit;
const foreignProfitRate = foreignCost > 0 ? (foreignProfit / foreignCost) * 100 : 0;

export function WelcomeGuide() {
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const { fileInputRef, isImporting, openFilePicker, handleFileChange } = useAssetImport();
  const { isInstallable, isIOS, isStandalone, installPWA } = usePWAInstall();
  const [pwaLoading, setPwaLoading] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const canInstallPWA = mounted && !isStandalone;

  const handleStockTutorial = (mode: "screenshot" | "manual") => {
    setIsStockMenuOpen(false);
    dispatchAddStock(mode);
  };

  const handleRealEstateTutorial = () => {
    dispatchAddRealEstate();
  };

  const handleInstallPWA = async () => {
    if (isInstallable) {
      setPwaLoading(true);
      try {
        const success = await installPWA();
        if (success) {
          toast.success("앱이 설치되었습니다! 설치된 앱에서 자산을 등록해보세요.");
        }
      } catch {
        toast.error("설치 중 오류가 발생했습니다.");
      } finally {
        setPwaLoading(false);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <div className="w-full border-0 bg-transparent shadow-none px-0 py-2 sm:px-0 space-y-8">

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

      {/* 보안 특징 카드 3개 — 앱가이드와 동일 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <FeatureCard
          icon={ShieldCheck}
          title="영지식(Zero-Knowledge) 로컬 격리"
          desc="모든 자산 데이터는 브라우저 내부(localStorage 및 기기 비추출 키 기반 IndexedDB)에만 안전하게 보관됩니다. 자격 증명이나 사용자 동의 없이는 데이터가 기기를 절대 벗어나지 않습니다."
        />
        <FeatureCard
          icon={CloudLightning}
          title="이중 종단간 암호화(E2EE) 동기화"
          desc="기기 내부에서 금고 암호로부터 PBKDF2 (200k 반복 연산)를 통해 강력한 대칭키와 인증용 서명 키쌍(Ed25519)을 파생합니다. 전송되는 모든 데이터는 기기 내에서 암호화됩니다."
        />
        <FeatureCard
          icon={EyeOff}
          title="서버 관리자 자산 열람 원천 불가"
          desc="서버는 오직 암호문(blob)과 공개키(pubKey)만 보관하며 해독 수단이 전혀 없습니다. 링크 공유 시에도 복호화 키의 절반은 브라우저 주소에만 전달됩니다."
        />
      </div>

      {/* PWA 웹앱 설치 유도 */}
      {canInstallPWA && (
        <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 shrink-0">
              <Smartphone className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">웹앱으로 설치하세요</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                홈 화면에서 바로 실행 · 네이티브 앱처럼 사용
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="shrink-0 size-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">1</span>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">앱 설치</span> — 아래 버튼으로 홈 화면에 추가
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 size-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">2</span>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">자산 등록</span> — 설치된 앱에서 첫 자산 추가
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="shrink-0 size-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[11px] font-bold mt-0.5">3</span>
              <p className="text-muted-foreground leading-relaxed">
                <span className="text-foreground font-medium">잠금 설정</span> — 더보기 → 설정에서 PIN 인증 활성화
              </p>
            </div>
          </div>
          {isIOS ? (
            <div className="flex flex-col gap-2">
              <div className="rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground flex items-center gap-1">
                  <Share className="size-3.5" /> iOS 설치 방법
                </p>
                <p>1. Safari 하단의 <span className="font-semibold text-foreground">공유</span> 버튼을 누릅니다.</p>
                <p>2. <span className="font-semibold text-foreground">홈 화면에 추가</span>를 선택합니다.</p>
              </div>
            </div>
          ) : (
            <Button
              variant="brand"
              size="lg"
              className="gap-2 w-full sm:w-auto"
              onClick={handleInstallPWA}
              disabled={pwaLoading}
            >
              <Download className="size-4" />
              {pwaLoading ? "설치 중..." : "웹앱 설치하기"}
            </Button>
          )}
        </div>
      )}

      {/* 예시 미리보기 */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">포트폴리오 미리보기</p>
          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">예시 데이터</Badge>
        </div>

        {/* 1. 홈탭 (자산 분포 및 구성) 미리보기 영역 — 바깥 카드 영역 제거, 최대 가로 너비 */}
        <div className="space-y-5">
          <NetAssetSummaryBox
            netAsset={netAsset}
            treemapData={PREVIEW_TREEMAP}
            lastDaily={{ diff: previewData.dailyProfit, pct: previewData.dailyProfitRate, isBig: false }}
            screenshotMode={true}
            showRealtimeBadge={true}
          />
        </div>

        {/* 구분선 */}
        <div className="border-t border-border/60 my-6" />

        {/* 2. 주식 탭 미리보기 영역 — 실제 stock-tab 과 동일하게 카드 박스 없이 노출 */}
        <div className="space-y-4">
          {/* 인증샷 가이드 배너 */}
          <div className="rounded-lg border-0 bg-primary/5 px-4 py-3 flex items-center gap-2.5">
            <Camera className="size-4 text-primary shrink-0" />
            <div>
              <p className="text-xs font-semibold text-foreground">인증샷으로 공유하세요</p>
              <p className="text-[11px] text-muted-foreground">우측 상단 메뉴 → 인증샷 · 자산 분포·주식 카테고리·금액 숨기기 선택 가능</p>
            </div>
          </div>

          <StockSummaryHeader
            totalValue={foreignTotal}
            totalProfit={foreignProfit}
            totalProfitRate={foreignProfitRate}
            currencyGain={foreignCurrencyGain}
            screenshotMode={false}
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
      <p className={`text-[11px] text-center ${ASSET_THEME.distributionCard.muted}`}>
        실제 자산을 입력하면 이 화면이 내 포트폴리오로 채워집니다.
      </p>

      {/* CTA 섹션 */}
      <div className="rounded-xl border border-border/60 bg-card/80 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h2 className="text-lg font-semibold">
            {mounted && isStandalone ? "자산을 등록해보세요" : "첫 번째 자산을 추가해보세요"}
          </h2>
          <p className="text-sm text-muted-foreground">
            부동산, 주식, 암호화폐, 현금, 대출까지 — 모든 자산을 한 곳에서 관리하세요.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
          <Button size="lg" className="gap-2 bg-primary" onClick={handleRealEstateTutorial}>
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
                onClick={() => handleStockTutorial("screenshot")}
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
                onClick={() => handleStockTutorial("manual")}
              >
                <Pencil className="size-4 text-muted-foreground shrink-0" />
                <div className="text-left">
                  <p className="font-medium">직접 입력</p>
                  <p className="text-xs text-muted-foreground">수동으로 종목 추가</p>
                </div>
              </button>
            </PopoverContent>
          </Popover>
          <Button size="lg" variant="outline" className="gap-2 text-muted-foreground hover:text-foreground" onClick={openFilePicker} disabled={isImporting}>
            <FolderInput className="size-4" />
            {isImporting ? "가져오는 중..." : "기존 데이터 가져오기"}
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
      </div>

      <PwaInstallGuideDialog open={showGuide} onOpenChange={setShowGuide} />
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
    <div className="rounded-xl border border-border/50 bg-card/60 p-5 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold">{title}</h3>
      </div>
      <p className="text-[13px] text-muted-foreground leading-7 tracking-[0.01em] break-keep">{desc}</p>
    </div>
  );
}
