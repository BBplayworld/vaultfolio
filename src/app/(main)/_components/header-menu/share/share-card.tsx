"use client";

import React from "react";
import { Logo } from "@/components/logo";
import { APP_CONFIG } from "@/config/app";
import { formatCurrency } from "@/lib/number-utils";
import { computeStockMetrics } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import {
  useFilteredStockData,
  StockSummaryHeader,
  StockCategorySection,
  StockCard,
} from "@/app/(main)/_components/views/detail/tabs/stock-tab";
import { useAssetData } from "@/contexts/asset-data-context";
import { stockCategories } from "@/config/asset-options";
import { SHARE_SAFE_PALETTE, SHARE_ETC_COLOR, ASSET_THEME_SHOT, ASSET_THEME_SHOT_BIG, SHOT_BIG_SCALE, pickOnColor } from "@/config/theme";
import { computeBreakdown } from "@/lib/xray/stock-xray";
import { getEtfBrand } from "@/lib/finance/logo-source";
import { resolveInvestorType, type AccountKey, type RegionKey, type KrUsBalance } from "@/lib/xray/investor-type";
import type { Sector, StockType } from "@/lib/xray/classification-store";
import { PortfolioRingCard, type RingSegment, type SubLogo } from "./portfolio-ring-card";
import { PortfolioSectorBar, type SectorBarItem } from "./portfolio-sector-bar";
import { InvestorAvatar } from "./investor-avatar";

// 인증카드 축약 상수 — 비중 바·종목 리스트 모두 상위 N개만 노출하고 나머지는 "기타"/"외 N종목"으로 집계
const SHOT_MAX = 7;
// 포트폴리오 "분야 구성" 막대바 전용 — 항목이 많아지면 범례가 늘어지므로 5개 + "그 외 N개 분야"로 통일(최대 6항목)
const SECTOR_MAX = 5;
const ETC_COLOR = SHARE_ETC_COLOR; // 포트폴리오 도넛·막대바 "그 외"/미분류 — 중립 그레이
// 워터마크(Logo) 프리뷰 크기(px) — 캡처는 카드 텍스트와 동일한 SHOT_BIG_SCALE(1.46)로 파생시켜
// 프리뷰↔캡처 배율을 카드 전체 규칙과 통일한다(개별 반올림 누적으로 배율이 벌어지는 것 방지).
const LOGO_SIZE_PREVIEW = 24;
const LOGO_SIZE_CAPTURE = Math.round(LOGO_SIZE_PREVIEW * SHOT_BIG_SCALE);
// "S" 옆 병기하는 한글 서비스명 워드마크 — 인증카드 단독 노출 시 최소 브랜딩용.
// 과거(#4.24) 완전 제거했던 풀 브랜드 문구 대신 로고 옆 작은 글자 하나로 최소화한 절충안.
const BRAND_TEXT_SIZE_PREVIEW = 11;
const BRAND_TEXT_SIZE_CAPTURE = Math.round(BRAND_TEXT_SIZE_PREVIEW * SHOT_BIG_SCALE); // ≈16, 카드 전체 확대 배율과 통일(R32)
// 포트폴리오 타입 도넛·분야 막대바 공용 팔레트. 색 조정은 theme.ts 배열만 손보면 된다.
const segFill = (i: number) => SHARE_SAFE_PALETTE[i % SHARE_SAFE_PALETTE.length];
// "투자 유형" 해시태그 — 대자보 핀업 연출용 태그별 회전각(deg)·세로 오프셋(px) 순환 배열 +
// 압정 색(팔레트 코랄레드 고정 — 실제 압정 색 느낌). 고정 배열만 쓰고 Math.random은 쓰지 않는다
// (캡처 PNG가 리렌더마다 달라지면 안 됨).
const TAG_ROTATE = [-6, 5, -4, 7, -5, 4, -3];
const TAG_OFFSET_Y = [2, -3, 4, -2, 3, -4, 2];
const TAG_PIN_COLOR = "#FF5A5A"; // PORTFOLIO_PALETTE 코랄레드 — 실제 압정과 같은 채도 높은 빨강

// investorType.description 안에서 highlightTerms와 정확히 일치하는 부분만 강조.
// 특수문자 이스케이프 + 긴 용어부터 매칭(짧은 용어가 긴 용어 일부를 잘못 가로채지 않게).
function renderDescriptionWithHighlights(text: string, terms: string[]) {
  if (terms.length === 0) return text;
  const sorted = [...terms].sort((a, b) => b.length - a.length);
  const escaped = sorted.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  return text.split(re).map((part, i) =>
    terms.includes(part) ? (
      <strong key={i} className="font-semibold text-foreground">
        {part}
      </strong>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    ),
  );
}

export type ShareCardVariant = "stock" | "portfolio" | "type";

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

  // "투자 유형 테스트" 카드 전용 — 테마·지역·계좌 축 top 값을 결정적으로 조합해 숫자 없는
  // 유형 이름 + 캐릭터를 만든다. 다른 variant에서는 계산하지 않는다(불필요한 computeBreakdown 방지).
  const investorType = React.useMemo(() => {
    if (variant !== "type") return null;
    const theme = computeBreakdown("theme", mergedStocks, exchangeRates);
    const region = computeBreakdown("region", mergedStocks, exchangeRates);
    const stockType = computeBreakdown("stockType", mergedStocks, exchangeRates);
    // 통화·지수 축 — 설명 문구·해시태그를 더 세세하게 채우기 위한 추가 데이터(요청: "달러 혹은
    // 원화, 투자 국가, 지수, 섹터 등 더 세세한 내용").
    const currency = computeBreakdown("currency", mergedStocks, exchangeRates);
    const indexBreakdown = computeBreakdown("index", mergedStocks, exchangeRates);
    const accountKey = (categoryItems[0]?.key ?? "domestic") as AccountKey;
    // theme·stockType 축은 분류 캐시가 비어 있으면 top이 "unclassified"일 수 있음 — 그 경우 "기타"로 대체
    const topThemeKey = theme.items[0]?.key;
    const themeKey = (!topThemeKey || topThemeKey === "unclassified" ? "기타" : topThemeKey) as Sector;
    const topStockTypeKey = stockType.items[0]?.key;
    const stockTypeKey = (!topStockTypeKey || topStockTypeKey === "unclassified" ? "기타" : topStockTypeKey) as StockType;
    const topCurrencyLabel = currency.items[0]?.label ?? "원화";
    const topIndexItem = indexBreakdown.items[0];
    // 지수 축은 종목 대다수가 지수 무관(unclassified)이거나 비중 0이면 의미가 없어 생략
    const topIndexLabel =
      topIndexItem && topIndexItem.key !== "unclassified" && topIndexItem.ratio > 0 ? topIndexItem.label : undefined;

    // 지수×계좌 교차 — 같은 지수라도 "연금으로 담았는지" "직접 매수(해외 계좌)로 담았는지"
    // 구분하기 위해, mergedStocks가 아닌 원본 assetData.stocks를 티커로 재매칭해 계좌별 비중을
    // 집계한다. mergedStocks는 카테고리 무관 티커 병합이라 이 정보가 소실됨(categoryItems와
    // 동일한 이유, 위 주석 참고).
    let topIndexAccountLabel: string | undefined;
    if (topIndexLabel && topIndexItem) {
      const tickerSet = new Set(topIndexItem.tickers);
      const totals = new Map<string, number>();
      for (const stock of assetData.stocks) {
        if (stock.inactiveStatus === "delisted") continue;
        const tickerUpper = (stock.ticker || stock.name).toUpperCase();
        if (!tickerSet.has(tickerUpper)) continue;
        const pct = computeStockMetrics(stock, exchangeRates, totalValue).pct;
        const groupKey = stock.category === "irp" || stock.category === "pension" ? "pension_irp" : stock.category;
        totals.set(groupKey, (totals.get(groupKey) ?? 0) + pct);
      }
      if (totals.size > 0) {
        const [topKey] = Array.from(totals.entries()).sort((a, b) => b[1] - a[1])[0];
        topIndexAccountLabel =
          topKey === "pension_irp" ? "연금저축펀드·IRP" : (stockCategories.find((c) => c.value === topKey)?.label ?? topKey);
      }
    }

    // 한국·미국 선호도 — 비율 차이(diff)는 내부 버킷 판단에만 쓰고 텍스트로는 절대 노출하지
    // 않는다(classifyConcentration과 동일한 패턴).
    const krItem = region.items.find((it) => it.key === "KR");
    const usItem = region.items.find((it) => it.key === "US");
    let krUsBalance: KrUsBalance | undefined;
    if (krItem && usItem) {
      const diff = krItem.ratio - usItem.ratio;
      krUsBalance = Math.abs(diff) < 0.15 ? "even" : diff > 0 ? "kr_lead" : "us_lead";
    } else if (krItem) {
      krUsBalance = "kr_only";
    } else if (usItem) {
      krUsBalance = "us_only";
    }

    return resolveInvestorType({
      themeKey,
      concentration: theme.concentration,
      regionKey: (region.items[0]?.key ?? "KR") as RegionKey,
      accountKey,
      stockTypeKey,
      topStockName: mergedStocks[0]?.name, // 평가액 1위 종목 — 숫자·비율 없이 이름만 사용
      topCurrencyLabel,
      topIndexLabel,
      subThemeLabel: theme.items[0]?.topThemes?.[0], // 1위 테마 버킷의 세부 테마 1개
      secondStockName: mergedStocks[1]?.name, // 평가액 2위 종목 — 이름만 사용
      secondAccountLabel: categoryItems[1]?.label, // 2위 계좌 카테고리(ISA/연금 등) — 이미 계산된 값 재사용
      topIndexAccountLabel,
      krUsBalance,
    });
    // xrayTick: 분류 fetch 완료 후 localStorage 갱신을 재계산에 반영
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, mergedStocks, exchangeRates, categoryItems, xrayTick]);

  // 하위 컴포넌트는 프리뷰·캡처 모두 항상 screenshotMode(=정적, 펼침 없음).
  // 캡처(!responsive)만 shotBig → ASSET_THEME_SHOT_BIG(폰트 ×SHOT_BIG_SCALE)로 680px 아트보드에서 프리뷰 비율 재현.
  // screenshotMode 자체를 responsive에 재결속하지 않는다(과거 프리뷰 펼침 부활 회귀).
  const shotBig = !responsive;

  return (
    <div
      ref={cardRef}
      // 캡처(!responsive) 배경은 순수 흑/백(`bg-white dark:bg-black`) — 프리뷰가 쓰는 `bg-background`
      // (테마 oklch, 라이트 0.96·다크 0.145)는 모바일 기기·뷰어에 따라 "옅은 검정/흰색"으로 보일 수
      // 있어(2026-09), 저장 PNG는 톤 편차 없는 완전한 흑/백으로 고정한다.
      className={responsive ? "relative p-2 sm:p-3 rounded-2xl bg-background w-full" : "relative p-3 rounded-2xl bg-white dark:bg-black"}
    >
      {/* 워터마크 — 브랜드 텍스트/도메인 푸터 완전 제거(2026-09, #4.24) 이후 서비스 로고(공용 `Logo`
          컴포넌트, `src/components/logo.tsx` — 파비콘과 동일한 Leckerli One 서체 "S")로만 출처를
          남겼었으나, 인증카드만 단독으로 접하는 외부 사용자를 위한 최소 브랜딩 요청(2026-09)으로
          "S" 옆에 작은 한글 서비스명(`APP_CONFIG.name`) 워드마크를 다시 병기한다 — 풀 문구 푸터가
          아닌 로고 옆 캡션 수준 텍스트 1개로 최소화한 절충안. 위치는 좌측 "총 주식 평가금액" 라벨의
          **최상단**과 맞춘다(라벨 top 실측값 재사용: 프리뷰 모바일 outer p-2 기준 16px, ≥sm p-3
          기준 20px, 캡처 p-3 고정 20px). 필기체 폰트는 어센더 여백 때문에 완벽한 픽셀 일치는
          스크린샷으로 재확인 필요.
          이 파일 + `src/components/logo.tsx`로 완결 — 상세>주식 탭과 공유하는 StockSummaryHeader/
          DetailSummaryHeader는 건드리지 않는다. 두 variant(주식현황/포트폴리오) 모두 같은 outer div
          좌표계라 위치가 항상 동일. sm:은 프리뷰 branch에만(캡처는 R32상 금지, 출력 폭이 항상 p-3
          고정이라 분기 불필요). `Logo` 컴포넌트 자체는 top-bar/bottom-nav와 공유하는 범용 원자라
          손대지 않고, 워드마크 `<span>`은 이 파일 전용으로 옆에 나란히 붙인다. */}
      <div
        // 우측 여백은 하단 리스트·막대바 래퍼(px-2=8px)와 동일한 카드 우측 인셋(outer padding+8px)
        // 이 되도록 정렬 — 캡처 12(p-3)+8=20px, 프리뷰 모바일 8(p-2)+8=16px·≥sm 12(p-3)+8=20px.
        className={responsive
          ? "absolute top-4 sm:top-5 right-4 sm:right-5 flex items-baseline gap-1 pointer-events-none"
          : "absolute top-5 right-5 flex items-baseline gap-1 pointer-events-none"}
      >
        <Logo size={responsive ? LOGO_SIZE_PREVIEW : LOGO_SIZE_CAPTURE} className="text-foreground" />
        <span
          className="text-muted-foreground leading-none select-none whitespace-nowrap"
          style={{ fontSize: responsive ? BRAND_TEXT_SIZE_PREVIEW : BRAND_TEXT_SIZE_CAPTURE }}
        >
          {APP_CONFIG.name}
        </span>
      </div>

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
      ) : variant === "type" && investorType ? (
        // "투자 유형 테스트" — 캐릭터가 메인, 숫자·금액·비율은 전혀 노출하지 않는다.
        <div className="py-6 flex flex-col items-center gap-5">
          <InvestorAvatar spec={investorType.avatar} size={responsive ? 176 : 208} />
          <div className="flex flex-col items-center gap-1.5 text-center px-4">
            <div className={responsive ? "text-xl sm:text-2xl font-extrabold tracking-tight" : "text-[30px] font-extrabold tracking-tight"}>
              {investorType.title}
            </div>
            <div className="inline-block rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
              {investorType.subtitle}
            </div>
            <div className={responsive ? "text-xs sm:text-sm text-muted-foreground mt-1 text-pretty leading-relaxed" : "text-[17px] text-muted-foreground mt-1 text-pretty leading-relaxed"}>
              {renderDescriptionWithHighlights(investorType.description, investorType.highlightTerms)}
            </div>
            {/* 대자보에 핀으로 꽂은 공고 쪽지 느낌 — 태그마다 회전각·세로 위치를 고정 배열에서
                순환 픽업해, 같은 tags 배열이면 항상 같은 배치가 나오도록 결정적으로 처리
                (Math.random 금지 — 캡처 PNG가 리렌더마다 달라지면 안 됨). 배경은 팔레트
                (segFill) 순환으로 채도 높게, 텍스트는 pickOnColor로 배경 대비 자동 보정. */}
            <div
              className={responsive
                ? "flex flex-wrap justify-center items-start gap-x-3 gap-y-4 mt-6 sm:mt-7 px-2 min-h-[100px] sm:min-h-[112px] max-w-[300px] sm:max-w-[340px]"
                : "flex flex-wrap justify-center items-start gap-x-3 gap-y-4 mt-8 px-2 min-h-[100px] max-w-[340px]"}
            >
              {investorType.tags.map((tag, i) => {
                const bg = segFill(i);
                return (
                  <span
                    key={tag}
                    className="relative inline-block rounded-[4px] px-3.5 py-2 text-xs font-semibold shadow-sm"
                    style={{
                      backgroundColor: bg,
                      color: pickOnColor(bg),
                      transform: `rotate(${TAG_ROTATE[i % TAG_ROTATE.length]}deg) translateY(${TAG_OFFSET_Y[i % TAG_OFFSET_Y.length]}px)`,
                    }}
                  >
                    {/* 압정 머리 — 태그 상단 중앙에 절반 걸치도록 배치, 채도 높은 고정 레드로 실제 압정 느낌 */}
                    <span
                      className="absolute left-1/2 -top-2 size-2.5 -translate-x-1/2 rounded-full shadow-sm ring-2 ring-background"
                      style={{ backgroundColor: TAG_PIN_COLOR }}
                    />
                    #{tag}
                  </span>
                );
              })}
            </div>
          </div>
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
          배경색 없이 카드 전체 배경과 통일. 세로 패딩(py-[26px]=26px)은 간격 계산(헤더 mt-3.5 등)의
          기준점이라 유지하고, 가로만(px-2=8px) 좁혀 콘텐츠가 카드 폭을 넓게 쓰게 한다.
          헤더는 하단 패딩 0이라 여기 마진(14px) + 이 박스의 상단 패딩(26px)을 더해야
          범례~리스트 간격(mt-10=40px)과 실제 노출 여백이 같아진다(2026-09 28→40px 상향, 상세 탭과 통일). */}
      <div className="mt-3.5 rounded-lg py-[26px] px-2">
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
    </div>
  );
}
