"use client";

import React from "react";
import { ShieldCheck, CloudLightning, EyeOff, ArrowRight, FolderInput, Pencil, ImageUp, Download, Smartphone, ChevronDown, Link2 } from "lucide-react";
import { useOnboardingWizardStore } from "@/stores/onboarding-wizard-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect, useRef } from "react";
import { useAssetImport } from "@/hooks/use-asset-import";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { useIsMobile } from "@/hooks/use-mobile";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { TreemapItem, NetAssetSummaryBox } from "@/app/(main)/_components/views/home/dashboard";
import { StockSummaryHeader, StockCategorySection, StockRowItem } from "@/app/(main)/_components/views/detail/tabs/stock-tab";
import { assignColors, computeStockMetrics, getMultiplier } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { Stock } from "@/types/asset";
import { PwaInstallFlow } from "../../pwa/pwa-install-flow";
import { dispatchAddStock } from "@/app/(main)/_components/layout/navigation/asset-dispatch";
import previewData from "./welcome-preview-data.json";
import { track, type GaParams } from "@/lib/analytics/ga";
import { detectBrowserEnv, isStandaloneDisplay } from "@/lib/pwa/detect-browser";
import { useCloudSync } from "@/lib/cloud-sync/cloud-sync-provider";

// 진입 stagger 공용 클래스 (모션 비활성 환경에선 즉시 표시) — delay는 style로 분산
const ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500";

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

// ── GA 호출 조건 고정용 순수 매핑(#48) — 위치만 바뀌고 값·조건은 기존과 동일
/** welcome_view source 판정: standalone → pwa, 인앱 → inapp, 그 외 → web */
export function welcomeSource(standalone: boolean, inApp: boolean): "pwa" | "inapp" | "web" {
  return standalone ? "pwa" : inApp ? "inapp" : "web";
}

/** 웰컴 CTA 버튼별 onboarding_action method */
export const WELCOME_CTA_METHODS = {
  wizard: "wizard",
  manual: "manual",
  import: "import",
  syncConnect: "sync_connect",
  skipInstall: "skip_install",
} as const satisfies Record<string, NonNullable<GaParams["method"]>>;

/** CTA 슬롯 상태 — pending: 마운트 전(SSR 동일) / install: 모바일 웹 미설치 / asset: 자산 등록 */
export type WelcomeCtaState = "pending" | "install" | "asset";
export function welcomeCtaState(env: { mounted: boolean; isMobile: boolean; isStandalone: boolean; skipInstall: boolean }): WelcomeCtaState {
  if (!env.mounted) return "pending";
  if (env.isMobile && !env.isStandalone && !env.skipInstall) return "install";
  return "asset";
}

export function WelcomeGuide() {
  const { isStandalone } = usePWAInstall();
  const isMobile = useIsMobile();
  const [mounted, setMounted] = useState(false);
  const [showAssetCta, setShowAssetCta] = useState(false); // 모바일 웹: '웹에서 바로 시작' 선택 시에만 자산 등록 노출
  const [securityOpen, setSecurityOpen] = useState(false); // 보안 상세 펼침 — 메모리 상태만(저장 안 함)

  useEffect(() => {
    setMounted(true);
    // 활성화 퍼널 1단계(S-4.28)
    track("welcome_view", { source: welcomeSource(isStandaloneDisplay(), detectBrowserEnv().isInApp) });
  }, []);

  const ctaState = welcomeCtaState({ mounted, isMobile: !!isMobile, isStandalone, skipInstall: showAssetCta });
  // 설치 박스는 데스크톱·태블릿 미설치만 — 모바일 웹은 CTA 슬롯이 설치를 대신한다
  const showInstallBox = mounted && !isStandalone && !isMobile;

  const handleSkipInstall = () => {
    track("onboarding_action", { method: WELCOME_CTA_METHODS.skipInstall });
    setShowAssetCta(true);
  };

  return (
    <div className="w-full py-2 space-y-5">

      {/* ① 히어로 */}
      <section data-testid="welcome-hero" className={`text-center space-y-2 ${ENTER}`}>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-balance">
          나만의 비밀 자산 금고
        </h1>
        <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed text-pretty">
          흩어진 자산을 한 화면에서 정리해 보세요.
        </p>
      </section>

      {/* ② 신뢰 한 줄 + 자세히 보기 + 보안 상세(제자리 펼침) — 접힌 상세가 여백을 남기지 않게 gap 없음 */}
      <div data-testid="welcome-trust" className={`w-full flex flex-col items-center ${ENTER}`} style={{ animationDelay: "60ms" }}>
        <p className="max-w-xl text-sm text-muted-foreground leading-relaxed text-balance text-center">
          <ShieldCheck aria-hidden className="inline size-4 -mt-0.5 mr-1.5 text-primary" />
          {/* 구분자를 앞 항목과 한 덩어리로 묶어 줄바꿈은 구분자 뒤에서만 일어나게 */}
          <span className="whitespace-nowrap">로그인 없음<span aria-hidden className="mx-1.5 text-muted-foreground/50">·</span></span>
          <span className="whitespace-nowrap">자산은 내 기기에만<span aria-hidden className="mx-1.5 text-muted-foreground/50">·</span></span>
          <span className="whitespace-nowrap">기기 간 암호화 동기화 지원</span>
        </p>
        <button
          type="button"
          data-testid="welcome-security-toggle"
          onClick={() => setSecurityOpen((v) => !v)}
          aria-expanded={securityOpen}
          aria-controls="welcome-security-detail"
          className="mt-1 inline-flex min-h-10 items-center gap-1 px-2 text-sm text-muted-foreground hover:text-foreground motion-safe:active:scale-[0.96] transition-[color,transform]"
        >
          {securityOpen ? "접기" : "자세히 보기"}
          <ChevronDown aria-hidden className={`size-3.5 motion-safe:transition-transform duration-200 ${securityOpen ? "rotate-180" : ""}`} />
        </button>
        {/* 항상 마운트 + grid-rows 0fr↔1fr 높이 전환(재마운트 없음, 전환 중 재탭은 현재 값에서 역전). 닫힘은 inert */}
        <div
          id="welcome-security-detail"
          data-testid="welcome-security-detail"
          role="region"
          aria-label="보안 상세"
          {...(securityOpen ? {} : { inert: true })}
          className={`grid w-full ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${securityOpen ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
        >
          <div className="min-h-0 overflow-hidden">
            {/* 보안 특징 카드 3개 — 앱가이드와 동일 원문 */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          </div>
        </div>
      </div>

      {/* ③ 예시 순자산 미리보기 */}
      <div data-testid="welcome-preview-net" className={`space-y-3 ${ENTER}`} style={{ animationDelay: "120ms" }}>
        <PreviewLabel title="포트폴리오 미리보기" />
        <NetAssetSummaryBox
          netAsset={netAsset}
          treemapData={PREVIEW_TREEMAP}
          change={{ deltaNet: previewData.dailyProfit, pct: previewData.dailyProfitRate, isBig: false, negligible: false, label: "전일 대비", estimated: false, sentence: null, causes: [] }}
          screenshotMode={true}
          showRealtimeBadge={true}
        />
      </div>

      {/* ④ 시작 CTA 단일 슬롯(#33 대체 지점) — 셸 노드는 상태가 바뀌어도 유지, 안쪽 콘텐츠만 교체 */}
      <div
        data-testid="welcome-cta-slot"
        data-state={ctaState}
        className={`rounded-xl bg-card/80 shadow-xs p-4 sm:p-6 min-h-[152px] sm:min-h-[160px] ${ENTER}`}
        style={{ animationDelay: "180ms" }}
      >
        {ctaState === "install" && <WelcomeInstallCta onSkipInstall={handleSkipInstall} />}
        {ctaState === "asset" && <WelcomeAssetCta standalone={isStandalone} focusOnMount={showAssetCta} />}
      </div>

      {/* ⑤ 주식 미리보기 — 실제 stock-tab 과 동일하게 카드 박스 없이 노출 */}
      <div data-testid="welcome-preview-stock" className="space-y-3">
        <PreviewLabel title="주식 미리보기" />
        <div className="space-y-4">
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

      {/* ⑥ PWA 웹앱 설치 유도(데스크톱·태블릿 미설치) — 홈 설치 버튼과 동일한 설치 흐름(PwaInstallFlow) 공용 사용 */}
      {showInstallBox && (
        <div data-testid="welcome-install-box" className="rounded-xl bg-gradient-to-br from-primary/5 via-transparent to-primary/10 p-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <Smartphone aria-hidden className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">웹앱으로 설치하세요</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                홈 화면에서 바로 실행 · 네이티브 앱처럼 사용
              </p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <InstallButton className="w-full sm:w-auto" />
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewLabel({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <Badge variant="secondary" className="text-[10px] px-2 py-0.5">예시 데이터</Badge>
    </div>
  );
}

/** 설치 버튼 — 데스크톱 설치 박스·모바일 CTA 슬롯 공용(같은 화면에 1개만 렌더) */
function InstallButton({ className = "" }: { className?: string }) {
  return (
    <PwaInstallFlow>
      {({ onClick, loading }) => (
        <Button
          variant="brand"
          size="lg"
          data-testid="welcome-install-btn"
          className={`gap-2 ${className}`}
          onClick={onClick}
          disabled={loading}
        >
          <Download className="size-4" />
          {loading ? "준비 중..." : "웹앱 설치하기"}
        </Button>
      )}
    </PwaInstallFlow>
  );
}

/** CTA 슬롯 install 상태(모바일 웹 미설치): 설치(주) + 웹에서 바로 시작(보조) + 캡션 1줄 */
export function WelcomeInstallCta({ onSkipInstall }: { onSkipInstall: () => void }) {
  return (
    <div className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
      <InstallButton className="w-full" />
      <Button variant="secondary" size="lg" data-testid="welcome-skip-install-btn" className="w-full gap-1.5" onClick={onSkipInstall}>
        웹에서 바로 시작
        <ArrowRight className="size-4" />
      </Button>
      <p className="mt-1 text-sm text-muted-foreground text-center text-pretty">설치하면 홈 화면에서 바로 열립니다.</p>
    </div>
  );
}

/** CTA 슬롯 asset 상태: 기존 자산 등록 CTA(스크린샷 등록 + 직접 입력·가져오기 팝오버) */
export function WelcomeAssetCta({ standalone, focusOnMount = false }: { standalone: boolean; focusOnMount?: boolean }) {
  const [isStockMenuOpen, setIsStockMenuOpen] = useState(false);
  const { fileInputRef, isImporting, openFilePicker, handleFileChange } = useAssetImport();
  const cs = useCloudSync();
  const openWizard = useOnboardingWizardStore((s) => s.open);
  const wizardRef = useRef<HTMLButtonElement>(null);

  // '웹에서 바로 시작' 후 사라진 버튼 대신 자산 등록 버튼으로 포커스 이동(키보드·스크린리더 흐름 유지)
  useEffect(() => {
    if (focusOnMount) wizardRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleWizard = () => {
    track("onboarding_action", { method: WELCOME_CTA_METHODS.wizard });
    openWizard();
  };

  const handleStockManual = () => {
    track("onboarding_action", { method: WELCOME_CTA_METHODS.manual });
    setIsStockMenuOpen(false);
    dispatchAddStock("manual");
  };

  return (
    <>
    <div className={`space-y-5 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200 ${focusOnMount ? "motion-safe:slide-in-from-bottom-1" : ""}`}>
      <div className="text-center space-y-1">
        <h2 className="text-lg font-semibold text-balance">
          {standalone ? "자산을 등록해보세요" : "첫 번째 자산을 추가해보세요"}
        </h2>
        <p className="text-sm text-muted-foreground text-pretty break-keep">
          부동산, 주식, 암호화폐, 현금, 대출까지 — 모든 자산을 한 곳에서 관리하세요.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
        <Button ref={wizardRef} size="lg" variant="brand" data-testid="welcome-cta-wizard" className="gap-2" onClick={handleWizard}>
          <ImageUp className="size-4" />
          스크린샷으로 자산 등록
          <ArrowRight className="size-4" />
        </Button>
        <Popover open={isStockMenuOpen} onOpenChange={setIsStockMenuOpen}>
          <PopoverTrigger asChild>
            <Button size="lg" variant="secondary" data-testid="welcome-cta-more" className="gap-2">
              <Pencil className="size-4" />
              직접 입력 · 가져오기
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-56 p-1.5 space-y-0.5">
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
              onClick={handleStockManual}
            >
              <Pencil className="size-4 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">주식 직접 입력</p>
                <p className="text-xs text-muted-foreground">수동으로 종목 추가</p>
              </div>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => { track("onboarding_action", { method: WELCOME_CTA_METHODS.import }); setIsStockMenuOpen(false); openFilePicker(); }}
              disabled={isImporting}
            >
              <FolderInput className="size-4 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">{isImporting ? "가져오는 중..." : "기존 데이터 가져오기"}</p>
                <p className="text-xs text-muted-foreground">백업 JSON 파일 복원</p>
              </div>
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm hover:bg-accent transition-colors"
              onClick={() => { track("onboarding_action", { method: WELCOME_CTA_METHODS.syncConnect }); setIsStockMenuOpen(false); cs.setShowConnectDialog(true); }}
            >
              <Link2 className="size-4 text-muted-foreground shrink-0" />
              <div className="text-left">
                <p className="font-medium">기존 동기화 자산 연결</p>
                <p className="text-xs text-muted-foreground">다른 기기의 자산 불러오기</p>
              </div>
            </button>
          </PopoverContent>
        </Popover>
      </div>
    </div>
    {/* 숨은 file input은 space-y 밖 — 마지막 자식이면 버튼 행에 하단 여백이 붙는다 */}
    <input ref={fileInputRef} type="file" accept="application/json" onChange={handleFileChange} className="hidden" />
    </>
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
    <div className="rounded-xl bg-card/60 shadow-xs p-5 space-y-2.5">
      <div className="flex items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2 shrink-0">
          <Icon className="size-4 text-primary" />
        </div>
        <h3 className="text-[15px] font-semibold text-balance">{title}</h3>
      </div>
      <p className="text-[13px] text-muted-foreground leading-7 tracking-[0.01em] break-keep text-pretty">{desc}</p>
    </div>
  );
}
