"use client";

import React from "react";
import { formatCurrency } from "@/lib/number-utils";
import { computeStockMetrics } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import {
  useFilteredStockData,
  StockSummaryHeader,
  StockCategorySection,
  StockCard,
} from "@/app/(main)/_components/views/detail/tabs/stock-tab";
import { useAssetData } from "@/contexts/asset-data-context";
import { APP_CONFIG } from "@/config/app";
import { stockCategories } from "@/config/asset-options";
import { SHARE_SAFE_PALETTE, SHARE_ETC_COLOR, ASSET_THEME_SHOT, ASSET_THEME_SHOT_BIG } from "@/config/theme";
import { computeBreakdown } from "@/lib/xray/stock-xray";
import { getEtfBrand } from "@/lib/finance/logo-source";
import { PortfolioRingCard, type RingSegment, type SubLogo } from "./portfolio-ring-card";
import { PortfolioSectorBar, type SectorBarItem } from "./portfolio-sector-bar";

// 인증카드 축약 상수 — 비중 바·종목 리스트 모두 상위 N개만 노출하고 나머지는 "기타"/"외 N종목"으로 집계
const SHOT_MAX = 7;
// 포트폴리오 "분야 구성" 막대바 전용 — 항목이 많아지면 범례가 늘어지므로 5개 + "그 외 N개 분야"로 통일(최대 6항목)
const SECTOR_MAX = 5;
const ETC_COLOR = SHARE_ETC_COLOR; // 포트폴리오 도넛·막대바 "그 외"/미분류 — 중립 그레이
// 포트폴리오 타입 도넛·분야 막대바 공용 팔레트. 색 조정은 theme.ts 배열만 손보면 된다.
const segFill = (i: number) => SHARE_SAFE_PALETTE[i % SHARE_SAFE_PALETTE.length];

export type ShareCardVariant = "stock" | "portfolio";

export interface ShareCardProps {
  variant: ShareCardVariant;
  hideAmounts: boolean;
  // 캡처 인스턴스만 전달(저장 대상). 화면용 반응형 프리뷰 인스턴스는 생략.
  cardRef?: React.RefObject<HTMLDivElement>;
  // 분류 캐시 갱신 감지용 — 다이얼로그가 useXrayClassifications로 fetch 후 증가시킴
  xrayTick?: number;
  // true = 화면용 프리뷰(뷰포트 반응형 · ASSET_THEME · 스케일 없음).
  // 미전달(기본) = 캡처용(680px 고정 · ASSET_THEME_SHOT). 저장 PNG는 항상 캡처 인스턴스 기준.
  responsive?: boolean;
}

export function ShareCard({ variant, hideAmounts, cardRef, xrayTick, responsive }: ShareCardProps) {
  const { assetData, exchangeRates } = useAssetData();
  // 주식 탭과 동일한 단일 출처 — 전체 카테고리 기준. 내부에서 tickerList를 정렬해
  // 캐시 키를 공유하므로 주식 탭과 중복 fetch가 생기지 않는다.
  const {
    groupedStocks,
    groupKeyOf,
    mergedStocks,
    totalValue,
    totalProfit,
    totalProfitRate,
    barItems,
    barColors,
    summary,
    marketMap,
  } = useFilteredStockData("all");

  // 인증카드 "주식 현황" 비중바 색상 — 주식 탭(MAIN_PALETTE) 대신 인증카드 전용 고채도
  // 팔레트로 교체(포트폴리오 도넛·분야 막대바와 색 계열 통일). 원본 barItems/barColors는
  // 주식 탭과 공유하는 훅 결과라 여기서 직접 덮어쓰지 않고 인증카드 전용 배열을 새로 만든다.
  const shareBarItems = React.useMemo(
    () => barItems.map((b, i) => ({ ...b, color: segFill(i) })),
    [barItems],
  );
  const shareBarColors = React.useMemo(
    () => shareBarItems.map((b) => b.color),
    [shareBarItems],
  );

  // 금액류만 마스킹 — 비중%·수익률%는 항상 노출.
  // 상세 > 주식 탭과 동일하게 요약 헤더·종목 리스트 모두 전체 금액으로 표시(PRICE_DISPLAY_MODE="full-only").
  const mask = hideAmounts ? (_: number) => "••••" : formatCurrency;

  const siteHost = APP_CONFIG.siteUrl.replace(/^https?:\/\//, "");

  // 포트폴리오 타입: 상위 7 + "그 외" 1건 = 최대 8조각. mergedStocks는 평가액 내림차순이라
  // 1위가 자동으로 팔레트 [0](브랜드 인디고). "그 외"는 팔레트 밖 중립 그레이.
  const ringSegments: RingSegment[] = React.useMemo(() => {
    const top = mergedStocks.slice(0, SHOT_MAX).map((stock, i): RingSegment => {
      const m = computeStockMetrics(stock, exchangeRates, totalValue);
      return {
        key: `seg-${stock.id}`,
        name: stock.name,
        ticker: stock.ticker ?? "",
        isForeign: m.isForeign,
        truePct: m.pct,
        color: segFill(i),
        etfBrand: getEtfBrand(stock.name),
      };
    });
    const rest = mergedStocks.slice(SHOT_MAX);
    if (rest.length > 0) {
      const restPct = rest.reduce(
        (s, stock) => s + computeStockMetrics(stock, exchangeRates, totalValue).pct,
        0,
      );
      // "그 외" 조각 안에는 구성 상위 3종목 로고를 미니 칩으로 보여준다
      const subLogos: SubLogo[] = rest.slice(0, 3).map((stock) => ({
        key: stock.id,
        ticker: stock.ticker ?? "",
        name: stock.name,
        isForeign: computeStockMetrics(stock, exchangeRates, totalValue).isForeign,
        etfBrand: getEtfBrand(stock.name),
      }));
      top.push({
        key: "etc",
        name: `그 외 ${rest.length}종목`,
        ticker: "",
        isForeign: false,
        truePct: restPct,
        color: ETC_COLOR,
        subLogos,
      });
    }
    return top;
  }, [mergedStocks, exchangeRates, totalValue]);

  // 포트폴리오 타입 하단 분야(섹터) 막대바 — X-Ray 테마 축. 상위 5 + "그 외 N개 분야"로 통일(최대 6항목).
  // 분류 캐시가 거의 없어 유효 분야가 2개 미만이면 빈 배열(막대바 미렌더).
  const sectorItems: SectorBarItem[] = React.useMemo(() => {
    const { items } = computeBreakdown("theme", mergedStocks, exchangeRates);
    const real = items.filter((it) => it.key !== "unclassified" && it.ratio > 0);
    if (real.length < 2) return [];
    const top = items.slice(0, SECTOR_MAX).map((it, i): SectorBarItem => ({
      key: it.key,
      label: it.label,
      pct: it.ratio * 100,
      color: segFill(i),
    }));
    const rest = items.slice(SECTOR_MAX).filter((it) => it.ratio > 0);
    if (rest.length > 0) {
      const restRatio = rest.reduce((s, it) => s + it.ratio, 0);
      top.push({ key: "etc", label: `그 외 ${rest.length}개 분야`, pct: restRatio * 100, color: ETC_COLOR });
    }
    return top;
    // xrayTick: 분류 fetch 완료 후 localStorage 갱신을 재계산에 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedStocks, exchangeRates, xrayTick]);

  // 포트폴리오 타입 하단 두 번째 막대바 — 보유 유형(stock.category: 국내/해외/IRP/ISA/연금저축/비상장).
  // 필수 입력 필드라 분류 캐시 의존 없음 — "그 외" 롤업 없이 실제 보유 유형을 전부 노출.
  // mergedStocks는 "all" 필터라 종목을 카테고리 무관 티커 단위로 합쳐버려(예: 같은 ETF를
  // 연금+IRP 양쪽에 보유) 병합 대표 1건의 category만 남는다 — 병합 전 원본(assetData.stocks)을
  // 그대로 순회해야 각 보유분이 실제 계좌 카테고리로 정확히 집계된다. totalValue 분모와 맞추기
  // 위해 delisted만 제외(useFilteredStockData의 activeStocks와 동일 필터).
  // IRP·연금저축펀드는 둘 다 세제혜택 은퇴 계좌 성격이 같아 이 막대바에서만 한 버킷으로 합친다
  // (stockCategories 자체는 안 바꿈 — 카테고리 필터 탭 등 다른 소비처는 그대로 6종 유지).
  // ISA는 국내·해외 지수 ETF를 다 담을 수 있지만 계좌 성격 자체가 뚜렷이 다르므로 계속 분리.
  // 비상장주식도 그대로 별도 유지.
  const categoryItems: SectorBarItem[] = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const stock of assetData.stocks) {
      if (stock.inactiveStatus === "delisted") continue;
      const pct = computeStockMetrics(stock, exchangeRates, totalValue).pct;
      const groupKey = stock.category === "irp" || stock.category === "pension" ? "pension_irp" : stock.category;
      totals.set(groupKey, (totals.get(groupKey) ?? 0) + pct);
    }
    return Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([key, pct], i): SectorBarItem => ({
        key,
        label: key === "pension_irp" ? "연금저축펀드·IRP" : (stockCategories.find((c) => c.value === key)?.label ?? key),
        pct,
        color: segFill(i),
      }));
  }, [assetData.stocks, exchangeRates, totalValue]);

  // 하위 컴포넌트는 프리뷰·캡처 모두 항상 screenshotMode(=정적, 펼침 없음).
  // 캡처(!responsive)만 shotBig → ASSET_THEME_SHOT_BIG(폰트 ×SHOT_BIG_SCALE)로 680px 아트보드에서 프리뷰 비율 재현.
  // screenshotMode 자체를 responsive에 재결속하지 않는다(과거 프리뷰 펼침 부활 회귀).
  const shotBig = !responsive;
  const footerTok = shotBig ? ASSET_THEME_SHOT_BIG : ASSET_THEME_SHOT;

  return (
    <div
      ref={cardRef}
      className={responsive ? "p-2 sm:p-3 rounded-2xl bg-background dark:bg-card w-full" : "p-3 rounded-2xl bg-background dark:bg-card"}
    >

      {variant === "portfolio" ? (
        <div className="py-4">
          <PortfolioRingCard segments={ringSegments} responsive={responsive} />
          {sectorItems.length > 0 && (
            <div className="mt-5 px-2">
              <PortfolioSectorBar title="분야 구성" items={sectorItems} big={shotBig} />
            </div>
          )}
          {categoryItems.length > 0 && (
            <div className="mt-5 px-2">
              <PortfolioSectorBar title="보유 유형 구성" items={categoryItems} big={shotBig} />
            </div>
          )}
        </div>
      ) : (
      <>
      {/* 요약 헤더 — 주식 탭과 동일 컴포넌트(총 주식 평가금액 + 평가손익) */}
      <StockSummaryHeader
        totalValue={totalValue}
        totalProfit={totalProfit}
        totalProfitRate={totalProfitRate}
        currencyGain={summary.stockCurrencyGain}
        maskFn={mask}
        screenshotMode
        shotBig={shotBig}
      />

      {/* 비중 바(상위 7 + 기타) + 종목 리스트(상위 7 + 외 N종목) — 주식 탭과 동일 컴포넌트.
          배경색 없이 카드 전체 배경과 통일. 세로 패딩(py-[22px]=22px)은 간격 계산(헤더 mt-3.5 등)의
          기준점이라 유지하고, 가로만(px-2=8px) 좁혀 콘텐츠가 카드 폭을 넓게 쓰게 한다.
          헤더는 하단 패딩 0이라 여기 마진(14px) + 이 박스의 상단 패딩(22px)을 더해야
          범례~리스트 간격(mt-9=36px)과 실제 노출 여백이 같아진다(2026-09 28→36px 상향, 상세 탭과 통일). */}
      <div className="mt-3.5 rounded-lg py-[22px] px-2">
        <StockCategorySection
          activeCategory="all"
          onCategoryChange={() => { /* 인증카드는 카테고리 고정 */ }}
          filteredStocks={mergedStocks}
          totalValue={totalValue}
          barItems={shareBarItems}
          barColors={shareBarColors}
          screenshotMode
          shotBig={shotBig}
          maxItems={SHOT_MAX}
          maskFn={mask}
          exchangeRates={exchangeRates}
          renderItem={(stock, _isFirst, color) => {
            const groupKey = groupKeyOf(stock);
            const groupItems = groupedStocks.get(groupKey) ?? [stock];
            const m = computeStockMetrics(stock, exchangeRates, totalValue);
            const linkedLoans = groupItems.flatMap((s) => assetData.loans.filter((l) => l.linkedStockId === s.id));
            return (
              <StockCard
                key={groupKey}
                stock={stock}
                color={color}
                pct={m.pct}
                currentVal={m.currentVal}
                profit={m.profit}
                profitRate={m.profitRate}
                isForeign={m.isForeign}
                krwMul={m.krwMul}
                currencyGain={m.currencyGain}
                currencyGainRate={m.currencyGainRate}
                linkedLoans={linkedLoans}
                onDelete={() => { /* 인증카드는 읽기 전용 */ }}
                categoryLabels={[]}
                groupItems={groupItems}
                exchangeRates={exchangeRates}
                totalValue={totalValue}
                marketMap={marketMap}
                screenshotMode
                shotBig={shotBig}
                maskFn={mask}
              />
            );
          }}
        />
      </div>
      </>
      )}

      {/* 푸터 — 브랜드명 + 도메인. 좌우 여백은 위 헤더·비중 바·리스트와 동일(8px),
          하단 패딩(pb-2)도 헤더의 상단 패딩(pt-2)과 맞춰 카드 최상단~"총 주식 평가금액"과
          "시크릿에셋"~카드 최하단 간격이 같아지게 한다.
          리스트~푸터 실제 노출 간격 = 마진(mt-1.5=6px) + 마지막 행 자체 하단 패딩(cardHeader py-2=8px)
          + 비중바·리스트 래퍼 하단 패딩(py-[22px]=22px) = 36px로, 범례~리스트(순수 mt-9=36px)와 동일하다. */}
      <div className="mt-1.5 flex items-baseline gap-1.5 px-2 pb-2">
        <span className={`${footerTok.footerBrand} text-foreground font-semibold`}>{APP_CONFIG.name}</span>
        <span className={`${footerTok.footerDomain} text-muted-foreground`}>{siteHost}</span>
      </div>
    </div>
  );
}
