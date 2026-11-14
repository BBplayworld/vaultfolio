"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatShortCurrencyDecimal, formatNarrowKRW, formatPriceByMode } from "@/lib/number-utils";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readExchangeHistory } from "@/lib/finance/profit-utils";
import { formatAttributionDate, CAUSE_DISPLAY_MIN, type AttributionDisplayItem, type AttributionRecord } from "@/lib/report/asset-report";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor, pickDonutLabelColor } from "@/config/theme";
import { realEstateTypes } from "@/config/asset-options";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { DailyAssetSnapshot, SnapshotGrade } from "@/types/asset";
import { DataSourceBadge } from "../data-source-badge";
import { AttributionRecordList } from "../attribution-records";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { useNickname } from "@/hooks/use-nickname";
import { HomeTipBox } from "./home-tip-box";
import { track } from "@/lib/analytics/ga";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { ChevronRight, ChevronDown, ChevronUp, Trophy } from "lucide-react";
import { tierLabel } from "@/lib/report/asset-grade";
import { TIER_STYLE } from "../activity/asset-report-view";
import { computeAttributionView } from "../activity/week-attribution";
import type { ReactNode } from "react";
import { displayShareWidths, MIN_DONUT_PCT } from "@/lib/report/min-share";
import { pickTopCause, weekTrendTitle } from "@/lib/report/home-today";
import { marketLineState, type MarketLineState } from "@/lib/finance/market-compare";
import { CauseMarketSegment, MarketLine, causeMarketText, useMarketEntryValue, type MarketEntryValue } from "../activity/market-entry-line";

const LIABILITY_COLORS = { loans: MAIN_PALETTE[1], tenant: MAIN_PALETTE[2] } as const;
export { LIABILITY_COLORS };

function assignColors(items: { value: number }[]): string[] {
  if (items.length === 0) return [];
  const maxIdx = items.reduce((mi, it, i) => (it.value > items[mi].value ? i : mi), 0);
  let si = 0;
  return items.map((_, i) => (i === maxIdx ? MAIN_PALETTE[0] : MAIN_PALETTE[3 + (si++) % 7]));
}

export function SectionBar({ items, total }: { items: { key: string; label: string; value: number; color: string }[]; total: number }) {
  if (items.length === 0 || total <= 0) return null;
  return (
    <div className="space-y-1.5">
      <div className="flex h-5 w-full rounded-full overflow-hidden gap-px">
        {items.map(({ key, label, value, color }, idx) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${displayShareWidths(items.map((b) => b.value), { total })[idx]}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
              {/* 바 내부 % 텍스트 제거 — 밝은 배경 위 흰글씨 저대비 방지. %는 아래 범례에서 크게 표기 */}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center gap-1">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <span className="text-sm font-semibold text-foreground">{formatShortCurrency(value)}</span>
              <span className="text-sm font-bold text-primary">({pct.toFixed(1)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export type TreemapItem = { key: string; name: string; value: number; color: string; pct: number };

const RADIAN = Math.PI / 180;

/** 라벨 상자(이름 글자수 기준)가 조각 안에 들어가는 최소 비율(%) — 3자 9 / 4자 11 / 5자 13 */
export const DONUT_LABEL_MIN_PCT = (name: string) => 9 + Math.max(0, name.length - 3) * 2;

// legacy(웰컴 미리보기, screenshotMode)는 기존 3줄 라벨을 그대로 유지한다. 홈은 이름+% 2줄, 조각색별 글자색.
export function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, pct, value, activeTab, itemKey, maskFn, legacy = false, color }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number;
  name: string; pct: number; value: number; activeTab?: string; itemKey?: string;
  maskFn?: (v: number) => string; legacy?: boolean; color?: string;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  if (legacy ? pct < 5 : pct < DONUT_LABEL_MIN_PCT(name)) return null;
  if (activeTab && activeTab !== "all" && itemKey !== activeTab) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (!legacy) {
    const fill = pickDonutLabelColor(color ?? "#000000");
    return (
      <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }} data-testid={`donut-label-${itemKey}`}>
        <tspan x={x} dy="-7" fontSize={11} fontWeight={700} fill={fill}>{name}</tspan>
        <tspan x={x} dy="22" fontSize={13} fontWeight={700} fill={fill} style={{ fontVariantNumeric: "tabular-nums" }}>{pct.toFixed(1)}%</tspan>
      </text>
    );
  }
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" style={{ pointerEvents: "none" }}>
      <tspan x={x - 1} dy="-16" fontSize={11} fontWeight={700} fill="white">{name}</tspan>
      <tspan x={x} dy="16" fontSize={13} fontWeight={700} fill="rgba(255, 255, 255, 1)">{fmt(value)}</tspan>
      <tspan x={x + 3} dy="16" fontSize={13} fontWeight={700} fill="rgba(255, 255, 255, 0.85)">{pct.toFixed(1)}%</tspan>
    </text>
  );
}

export function AssetDonutChart({ items, netAsset, activeTab, onSegmentClick, screenshotMode = false, maskFn }: {
  items: TreemapItem[];
  netAsset: number;
  activeTab?: string;
  onSegmentClick?: (key: string) => void;
  screenshotMode?: boolean;
  maskFn?: (v: number) => string;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  if (items.length === 0) return null;
  // 홈은 투명 카드 위라 조각 경계를 배경색으로, 웰컴 미리보기(screenshotMode)는 기존 card 색 유지
  const sliceStroke = screenshotMode ? "var(--card)" : "var(--background)";
  // 각도만 최소 비중 보장(항목 5개 이하, #148) — 라벨·중앙·범례 숫자와 라벨 표시 기준(DONUT_LABEL_MIN_PCT)은 실제 값 그대로
  const widths = displayShareWidths(items.map((it) => it.value), { minPct: MIN_DONUT_PCT });
  const shownItems = items.map((it, i) => ({ ...it, shown: widths[i] })).filter((it) => it.shown > 0);
  return (
    <div className="space-y-3" data-testid={screenshotMode ? undefined : "home-donut"}>
      <ResponsiveContainer width="100%" height={screenshotMode ? 220 : 260} className={`[&_*]:outline-none [&_path]:outline-none ${screenshotMode ? "" : "sm:!h-[360px]"}`} style={screenshotMode ? { pointerEvents: "none" } : undefined}>
        <PieChart style={{ outline: "none" }}>
          <Pie
            data={shownItems}
            dataKey="shown"
            nameKey="name"
            innerRadius={screenshotMode ? 45 : 55}
            outerRadius={screenshotMode ? 110 : 130}
            strokeWidth={2}
            stroke={sliceStroke}
            labelLine={false}
            label={({ key, ...props }) => <DonutLabel key={key} itemKey={key} activeTab={activeTab} maskFn={maskFn} legacy={screenshotMode} color={items.find((it) => it.key === key)?.color} {...props} value={items.find((it) => it.key === key)?.value ?? props.value} />}
            onClick={(data) => { if (!screenshotMode && data?.key && onSegmentClick) onSegmentClick(data.key as string); }}
            style={{ cursor: screenshotMode ? "default" : "pointer", outline: "none" }}
            rootTabIndex={-1}
            isAnimationActive={false}
            activeShape={(props: React.ComponentProps<typeof Sector>) => <Sector {...props} outerRadius={screenshotMode ? 110 : 130} strokeWidth={0} stroke="none" />}
          >
            {shownItems.map((item, i) => {
              const isAll = !activeTab || activeTab === "all";
              const isActive = item.key === activeTab;
              return (
                <Cell
                  key={i}
                  fill={item.color}
                  stroke={sliceStroke}
                  strokeWidth={2}
                  tabIndex={-1}
                  style={{
                    opacity: isAll || isActive ? 1 : 0.1,
                    // 홈은 선택 시 밝기 필터 없음(라벨 대비·배경색 경계 보존), 웰컴(screenshotMode)만 기존 유지
                    filter: isActive && screenshotMode ? "brightness(1.15)" : undefined,
                    transition: "opacity 0.2s, filter 0.2s",
                    cursor: screenshotMode ? "default" : "pointer",
                    outline: "none",
                  }}
                />
              );
            })}
          </Pie>
          {(() => {
            const isAll = !activeTab || activeTab === "all";
            const active = isAll ? null : items.find((it) => it.key === activeTab);
            return (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                {active ? (
                  <>
                    <tspan x="50%" dy="-18" fontSize={12} fontWeight={700} fill="var(--muted-foreground)">{active.name}</tspan>
                    <tspan x="50%" dy="24" fontSize={18} fontWeight={700} fill="var(--foreground)">{fmt(active.value)}</tspan>
                    <tspan x="50%" dy="20" fontSize={14} fontWeight={600} fill="var(--muted-foreground)">{active.pct.toFixed(1)}%</tspan>
                  </>
                ) : (
                  <>
                    <tspan x="50%" dy="-12" fontSize={12} fill="var(--muted-foreground)">순자산</tspan>
                    <tspan x="50%" dy="26" fontSize={18} fontWeight={700} fill={screenshotMode ? ASSET_THEME.importantHex : "var(--foreground)"}>{fmt(netAsset)}</tspan>
                  </>
                )}
              </text>
            );
          })()}
        </PieChart>
      </ResponsiveContainer>
      {/* 범례 */}
      <div className={`grid gap-x-2 ${screenshotMode ? "hidden gap-y-0.5 grid-cols-1 pointer-events-none" : "gap-y-0 grid-cols-1 sm:grid-cols-2"}`}>
        {items.map(({ key, name, value, color, pct }) => {
          const isAll = !activeTab || activeTab === "all";
          const isActive = key === activeTab;
          if (screenshotMode) {
            return (
              <div
                key={name}
                className={`flex items-center gap-1 min-w-0 rounded-md transition-all px-1.5 py-2 cursor-pointer`}
                style={{ opacity: isAll || isActive ? 1 : 0.35 }}
                onClick={() => { if (!screenshotMode && onSegmentClick) onSegmentClick(key); }}
              >
                <span className={`rounded-full flex-shrink-0 size-2.5`} style={{ backgroundColor: color }} />
                <span className={`text-foreground truncate text-sm`}>{name}</span>
                <span className={`ml-auto text-sm ${key === 'liability' ? ASSET_THEME.liability : ASSET_THEME.text.default}`}>{fmt(value)}</span>
                <span className={`font-bold text-sm`} style={{ color: color }}>({pct.toFixed(1)}%)</span>
              </div>
            );
          }
          // 홈: 금액·% 열 정렬(tabular-nums, % 고정폭), 행 높이 40px(상하 gap 0으로 카드 높이 유지)
          return (
            <div
              key={name}
              data-testid={`donut-legend-row-${key}`}
              className="flex items-center gap-2 min-w-0 min-h-10 rounded-md transition-opacity px-1.5 cursor-pointer"
              style={{ opacity: isAll || isActive ? 1 : 0.35 }}
              onClick={() => { if (onSegmentClick) onSegmentClick(key); }}
            >
              <span className="rounded-full flex-shrink-0 size-2.5" style={{ backgroundColor: color }} />
              <span className="text-foreground truncate text-sm min-w-0 whitespace-nowrap">{name}</span>
              <span data-testid={`donut-legend-amount-${key}`} className={`ml-auto text-sm tabular-nums whitespace-nowrap ${key === 'liability' ? ASSET_THEME.liability : ASSET_THEME.text.default}`}>{fmt(value)}</span>
              <span data-testid={`donut-legend-pct-${key}`} className="w-[4.5rem] shrink-0 text-right font-bold text-sm tabular-nums" style={{ color: color }}>({pct.toFixed(1)}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NetAssetSummaryBox({
  netAsset,
  totalAsset,
  totalLiability,
  nickname,
  change,
  treemapData,
  activeTab = "all",
  onSegmentClick,
  visibleTabs = [],
  screenshotMode = false,
  showRealtimeBadge = false,
  grade,
  onGradeClick,
  market,
  marketLine = "off",
  onMarketOpen,
}: {
  netAsset: number;
  totalAsset?: number;
  totalLiability?: number;
  nickname?: string;
  change?: HeaderChange | null;
  treemapData: TreemapItem[];
  activeTab?: string;
  onSegmentClick?: (key: string) => void;
  visibleTabs?: { value: string; label: string }[];
  screenshotMode?: boolean;
  showRealtimeBadge?: boolean;
  /** 자산 성적표 최신 등급(성적표 화면 방문 시 기록됨) — 있으면 우상단에 미니 트로피 배지 노출 */
  grade?: SnapshotGrade | null;
  onGradeClick?: () => void;
  /** 지수 종가 줄(4.90) — 홈 Dashboard가 판정(marketLineState)해 넘긴다. 캡처·웰컴 미리보기는 넘기지 않는다 */
  market?: MarketEntryValue;
  marketLine?: MarketLineState;
  onMarketOpen?: () => void;
}) {
  // Hero·총액은 전액 표기(formatPriceByMode) — 도넛 라벨·범례·막대는 폭 제약상 축약 유지
  const hasRightSide = totalAsset !== undefined && totalLiability !== undefined;
  const [causeOpen, setCauseOpen] = useState(false);
  const hasCause = !!change && !change.negligible && (!!change.sentence || change.estimated);
  // 가장 큰 원인 1줄(4.90 B) — 원인이 있으면 쉐브론 대신 이 줄이 펼침 입구. 원인 0개(예측만)는 현행 쉐브론 유지
  const top = hasCause && change ? pickTopCause(change.causes) : null;
  const showLine = !!top && !screenshotMode;
  // 보조 줄 지수 구간(5.105) — 라벨 `전일 대비`+지수 on일 때만. 기간이 다른 1일 지수를 나란히 두지 않는다
  const marketOn = !!market && marketLine !== "off";
  const inlineMarket = showLine && marketOn && change?.label === "전일 대비" && market ? market : null;
  const open = causeOpen || screenshotMode;
  const panelRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLButtonElement>(null);
  const focusTo = useRef<"panel" | "line" | null>(null);
  // 열 때만 home_cause_open 1건(닫을 때 제외) — B 줄·쉐브론 두 입구가 이 핸들러 1개를 공유
  const toggleCause = () => {
    if (!causeOpen) track("feature_use", { category: "home_cause_open" });
    setCauseOpen((v) => !v);
  };
  // 펼침 직후 포커스 = 패널, 접힘 직후(포커스가 패널 안이었을 때만) = B 줄(preventScroll)
  useEffect(() => {
    if (focusTo.current === "panel") panelRef.current?.focus({ preventScroll: true });
    else if (focusTo.current === "line") lineRef.current?.focus({ preventScroll: true });
    focusTo.current = null;
  }, [causeOpen]);

  return (
    <div className="space-y-4">
      <div className={`relative flex flex-col rounded-lg ${ASSET_THEME.primary.bgLight} px-4 py-4`}>
        {/* 자산 성적표 미니 배지 — 성적표 화면이 기록해둔 최신 등급(재계산 없음)을 트로피+점수로
            압축 노출. hasRightSide(총자산/총부채 컬럼)와 자리가 겹치므로 그때는 생략(방어). */}
        {grade && !hasRightSide && onGradeClick && (
          <button
            type="button"
            onClick={onGradeClick}
            aria-label={`자산 성적표 보기 — ${tierLabel(grade.tier)} ${grade.overall}점`}
            className="absolute top-2 right-2 p-2 inline-flex items-center gap-1 sm:gap-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
          >
            <Trophy className={`size-4 sm:size-5 lg:size-6 ${TIER_STYLE[grade.tier].color} ${TIER_STYLE[grade.tier].shadow}`} strokeWidth={2} />
            <span className={`text-sm sm:text-base lg:text-lg font-bold tabular-nums ${TIER_STYLE[grade.tier].color}`}>{grade.overall}</span>
          </button>
        )}
        <div className={hasRightSide ? "flex items-center justify-between" : ""}>
        <div>
          <div className="flex items-center gap-1.5">
            {nickname && (
              <span className={`text-sm font-semibold ${ASSET_THEME.primary.text}`}>{nickname}</span>
            )}
            <p className={`text-sm font-semibold ${ASSET_THEME.text.muted}`}>순자산</p>
            {showRealtimeBadge && <DataSourceBadge kind="realtime" />}
          </div>

          <div className="mt-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className={`text-2xl sm:text-3xl lg:text-4xl font-bold tabular-nums break-all leading-tight ${ASSET_THEME.important}`}>
                {formatPriceByMode(netAsset)}
              </p>
              {change && change.negligible && (
                // 만원 미만 변동은 원 단위 금액·"+0만원" 원인이 깨져 보여, 정합되게 "변동 없음"으로 대체
                <span className="text-sm font-medium text-muted-foreground">{change.label} 변동 없음</span>
              )}
              {change && !change.negligible && (
                // 금액·%는 각각 한 덩어리(금액·단위 분리 방지), 좁은 폭에선 flex-wrap으로 %·라벨이 다음 행(#4.36)
                <span className={`inline-flex flex-wrap gap-y-0.5 items-center text-base lg:text-lg font-bold tabular-nums ${getProfitLossColor(change.deltaNet)}`}>
                  <span className="whitespace-nowrap">{change.deltaNet >= 0 ? "▲ +" : "▼ "}{formatShortCurrency(change.deltaNet)}</span>
                  <span className="text-sm lg:text-base font-bold ml-1 whitespace-nowrap">({change.deltaNet >= 0 ? "+" : ""}{change.pct.toFixed(1)}%)</span>
                  {/* 라벨·쉐브론은 한 덩어리 — 쉐브론만 다음 줄에 떨어지지 않게(#4.36 ui-review R1) */}
                  <span className="inline-flex items-center ml-1.5">
                  <span className="text-sm font-medium text-muted-foreground break-keep">{change.label}</span>
                  {change.estimated && (
                    <span data-testid="home-cause-estimated" className="ml-1.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">예측</span>
                  )}
                  {/* 원인 문구는 기본 접힘 — 헤더에 상시 노출하면 숫자보다 문장이 시선을 끈다 */}
                  {hasCause && !screenshotMode && !showLine && (
                    <button
                      type="button"
                      onClick={toggleCause}
                      aria-expanded={causeOpen}
                      aria-label="변동 원인 보기"
                      className="ml-1 -my-2 p-2 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`size-3.5 transition-transform duration-200 ${causeOpen ? "rotate-180" : ""}`} />
                    </button>
                  )}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
        {hasRightSide && (
          <div className="text-right space-y-1.5 shrink-0">
            <div className="text-sm">
              <span className={ASSET_THEME.distributionCard.muted}>총 자산 </span>
              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(totalAsset)}</span>
            </div>
            <div className="text-sm">
              <span className={ASSET_THEME.distributionCard.muted}>총 부채 </span>
              <span className={`font-bold ${ASSET_THEME.liability}`}>{formatShortCurrency(totalLiability)}</span>
            </div>
          </div>
        )}
        </div>
        {change && hasCause && (
          <div className="mt-1 w-full">
              <>
                {showLine && top && (
                  // B 가장 큰 원인 1줄 — 항상 마운트, 열리면 줄이 접히고 같은 자리에 목록이 열린다(같은 값 두 번 노출 0).
                  // 접힌 쪽은 inert(포커스·읽기 제외)로 숨긴다 — visibility 전환을 쓰면 열린 직후 프레임에 포커스가 안 들어간다
                  // 히트 40px(py-2.5)는 음수 마진으로 레이아웃 높이 20px 유지, 접힘 상태에서는 마진도 함께 전환
                  <div
                    inert={open}
                    className={`grid motion-safe:transition-[grid-template-rows,opacity,margin] motion-safe:duration-200 ease-out ${open ? "grid-rows-[0fr] opacity-0" : "-mt-1.5 -mb-2.5 grid-rows-[1fr] opacity-100"}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <button
                        ref={lineRef}
                        type="button"
                        data-testid="home-cause-line"
                        data-cause-key={top.key}
                        aria-expanded={open}
                        aria-controls="home-cause-panel"
                        aria-label={`변동 원인 펼치기, ${top.label} ${top.text}${change.causes.length > 1 ? ` 외 ${change.causes.length - 1}개` : ""}${inlineMarket?.ready && inlineMarket.values[0] ? `, ${causeMarketText(inlineMarket.values[0])}` : ""}`}
                        onClick={() => { focusTo.current = "panel"; toggleCause(); }}
                        className="@container relative flex min-h-5 w-full items-center gap-1.5 whitespace-nowrap py-2.5 text-left text-sm after:absolute after:-inset-x-4 after:inset-y-0 after:content-[''] active:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-inset"
                      >
                        <span className="min-w-0 truncate text-sm text-foreground">{top.label}</span>
                        <span className={`shrink-0 text-sm font-semibold tabular-nums ${getProfitLossColor(top.amount)}`}>{top.text}</span>
                        {change.causes.length > 1 && (
                          <span data-testid="home-cause-more" className="shrink-0 text-sm text-muted-foreground @max-[260px]:hidden">외 {change.causes.length - 1}개</span>
                        )}
                        {inlineMarket && <CauseMarketSegment market={inlineMarket} />}
                        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}
                <div
                  ref={panelRef}
                  id="home-cause-panel"
                  data-testid="home-cause-panel"
                  role="region"
                  aria-label="변동 원인"
                  tabIndex={-1}
                  inert={!open}
                  className={`grid outline-none motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="space-y-1 pt-1">
                  {/* 비교 구간 — 오랜만의 접속에서도 어느 기간의 변화인지 바로 읽히게(S-4.33) */}
                  {change.rangeLabel && (
                    <p className="text-xs tabular-nums text-muted-foreground">{change.rangeLabel}</p>
                  )}
                  {/* 항목이 많아 한 줄 문장이 길어지므로 세로 리스트로 정렬 — 라벨(전경)·기록 날짜(muted)·금액(손익색) 분리.
                      시세·환율 → 기록 날짜순 → 날짜 없는 항목 순(sortCausesByDate) */}
                  <ul className="w-full max-w-xs space-y-0.5">
                    {change.causes.map((c) => (
                      <li key={c.key} className="flex items-baseline justify-between gap-3">
                        <span className="text-sm text-foreground break-keep">
                          {c.label}
                          {c.dateLabel && <span className="ml-1.5 text-xs tabular-nums text-muted-foreground">{c.dateLabel}</span>}
                        </span>
                        <span className={`text-sm font-semibold tabular-nums shrink-0 ${getProfitLossColor(c.amount)}`}>{c.text}</span>
                      </li>
                    ))}
                  </ul>
                  {(change.offsetTotal ?? 0) >= CAUSE_DISPLAY_MIN && (
                    <p data-testid="home-cause-offset-caption" className="mt-1.5 text-xs text-muted-foreground break-keep text-pretty leading-relaxed max-w-xs">
                      자산 사이에 옮긴 돈은 원인에서 뺐어요
                    </p>
                  )}
                  {!screenshotMode && change.records && (
                    <AttributionRecordList records={change.records} className="w-full max-w-xs" />
                  )}
                      {showLine && marketOn && market && onMarketOpen && (
                        <MarketLine market={market} onOpen={onMarketOpen} variant="panel" />
                      )}
                      {showLine && (
                        <button
                          type="button"
                          data-testid="home-cause-collapse"
                          aria-label="변동 원인 접기"
                          onClick={() => {
                            focusTo.current = panelRef.current?.contains(document.activeElement) ? "line" : null;
                            toggleCause();
                          }}
                          className="flex min-h-10 w-full items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                        >
                          접기
                          <ChevronUp aria-hidden className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </>
          </div>
        )}
      </div>

      {!screenshotMode && !showLine && market && marketLine !== "off" && onMarketOpen && <MarketLine market={market} onOpen={onMarketOpen} />}

      {visibleTabs.length > 1 && onSegmentClick && (
        <div className="flex justify-center">
          <InlineSelector
            value={activeTab}
            onChange={onSegmentClick}
            options={visibleTabs.map((t) => ({ value: t.value, label: t.label }))}
            ariaLabel="자산 분포 필터"
          />
        </div>
      )}

      <AssetDonutChart
        items={treemapData}
        netAsset={netAsset}
        activeTab={activeTab}
        onSegmentClick={onSegmentClick}
        screenshotMode={screenshotMode}
      />
    </div>
  );
}

/**
 * 자산 분포 도닛차트에 필요한 treemapData를 계산하는 후크.

 * ShareCard 등 다른 컨포넌트에서 재사용 가능.
 */
export function useAssetTreemapData() {
  const { getAssetSummary } = useAssetData();
  const summary = getAssetSummary();

  const totalAsset = summary.realEstateValue + summary.physicalValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const financialAssetValue = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const liabilityValue = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + liabilityValue;

  const treemapRawAssets = [
    { key: "realEstate", name: "부동산", value: summary.realEstateValue },
    { key: "financial", name: "금융자산", value: financialAssetValue },
  ].filter((d) => d.value > 0);

  const assetPaletteColors = assignColors(treemapRawAssets);
  // 실물(#58)은 assignColors 입력에서 빼고 색을 MAIN_PALETTE[8]로 고정 — 넣으면 [1] 빨강·[2] 주황이 배정돼 부채·순자산 의미색과 충돌하고
  // 부동산/금융자산의 기존 색 배정도 실물 유무에 따라 달라진다
  const physicalItem = summary.physicalValue > 0
    ? [{ key: "physical", name: "실물", value: summary.physicalValue, color: MAIN_PALETTE[8], pct: grossTotal > 0 ? (summary.physicalValue / grossTotal) * 100 : 0 }]
    : [];
  const treemapData: TreemapItem[] = [
    ...treemapRawAssets.map((d, i) => ({
      ...d,
      color: assetPaletteColors[i],
      pct: grossTotal > 0 ? (d.value / grossTotal) * 100 : 0,
    })),
    ...physicalItem,
    ...(liabilityValue > 0
      ? [{
        key: "liability",
        name: "부채",
        value: liabilityValue,
        color: LIABILITY_COLORS.loans,
        pct: grossTotal > 0 ? (liabilityValue / grossTotal) * 100 : 0,
      }]
      : []),
  ];

  return { treemapData, summary };
}

// 최근 7일 일별 스냅샷 + 전일 대비 손익 (Dashboard / DailyNetAssetTrend 공용)
function useLast7DailySnapshots() {
  const { snapshotVersion } = useAssetData();
  const [snapshots, setSnapshots] = useState<DailyAssetSnapshot[]>([]);
  useEffect(() => {
    const all = readDailySnapshots();
    setSnapshots([...all].sort((a, b) => a.date.localeCompare(b.date)).slice(-7));
  }, [snapshotVersion]);
  return snapshots;
}

// 홈 순자산 헤더의 미니 트로피 배지용 — 성적표 화면(asset-report-view.tsx)이 확정 시 기록해둔
// 최신 등급을 그대로 읽는다(재계산 안 함, 성적표 미방문이면 null).
function useLatestAssetGrade(): SnapshotGrade | null {
  const { snapshotVersion } = useAssetData();
  const [grade, setGrade] = useState<SnapshotGrade | null>(null);
  useEffect(() => {
    const sorted = [...readDailySnapshots()].sort((a, b) => b.date.localeCompare(a.date));
    setGrade(sorted.find((s) => s.grade)?.grade ?? null);
  }, [snapshotVersion]);
  return grade;
}

// Hero 통합 등락 뷰모델 — "지난 접속일 종가 → 실시간 현재"를 원인분해까지 한 줄에 표기.
interface HeaderChange {
  deltaNet: number;
  pct: number;
  isBig: boolean;
  negligible: boolean;      // |deltaNet| < 만원 → 원 단위 금액·원인 대신 "변동 없음" 표시
  label: string;            // "전일 대비" 또는 "지난 접속(M/D) 이후"
  estimated: boolean;
  sentence: string | null;  // 원인 전체를 한 줄로 결합(원인 유무 판정·스크린샷용)
  causes: AttributionDisplayItem[]; // 원인 리스트(항목별 색상 렌더)
  rangeLabel?: string;              // 비교 구간 "M/D → M/D"(S-4.33)
  records?: AttributionRecord[];    // 구간 내 반영 기록(입출금·매매·대출) 시간순(S-4.33)
  offsetTotal?: number;             // 내부 이동 상쇄 합(원) — 1만 이상이면 캡션(#103)
}

// 헤더 통합 등락: 끝점을 실시간 현재값(buildLiveAttributionCurr)으로 잡아 Hero 순자산과 기준 일치.
// 시작점은 지난 접속일. 당일 재접속(previousVisitDate=오늘)이어도 직전 기록일(어제 등) 대비로 항상 노출.
// 비교할 과거 스냅샷이 하나도 없을 때만 null(첫날).
function useHeaderNetChange(): HeaderChange | null {
  const { assetData, exchangeRates, snapshotVersion, previousVisitDate, getAssetSummary } = useAssetData();
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  return useMemo(() => {
    const yesterday = new Date(Date.now() + 9 * 60 * 60 * 1000);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];
    // 지난 접속일이 유효(오늘 이전)면 그걸, 아니면(당일 재접속·미기록) 직전 기록일 기준으로 어제까지 소급
    const sinceDate = previousVisitDate && previousVisitDate < todayStr ? previousVisitDate : yesterdayStr;
    const summary = getAssetSummary();
    const view = computeAttributionView({
      assetData,
      rates: exchangeRates,
      summary,
      daily: readDailySnapshots(),
      monthly: readMonthlySnapshots(),
      exchangeHistory: readExchangeHistory(),
      sinceDate,
    });
    if (!view) return null;
    const { attr } = view;
    const prevNet = summary.netAsset - attr.deltaNet;
    const pct = prevNet > 0 ? (attr.deltaNet / prevNet) * 100 : 0;
    const label = attr.fromDate === yesterdayStr ? "전일 대비" : `${formatAttributionDate(attr.fromDate)} 이후`;
    return {
      deltaNet: attr.deltaNet,
      pct,
      isBig: Math.abs(pct) >= 5,
      negligible: Math.abs(attr.deltaNet) < CAUSE_DISPLAY_MIN,
      label,
      estimated: attr.estimated,
      sentence: view.sentence,
      causes: view.causes,
      offsetTotal: view.offsetTotal,
      rangeLabel: view.rangeLabel,
      records: view.records,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousVisitDate, todayStr, assetData, exchangeRates, snapshotVersion]);
}

function DailyNetAssetTrend() {
  return <WeekTrendCard snapshots={useLast7DailySnapshots()} />;
}

// 7일 순자산 막대 카드 — 기록 2개 이상이면 버튼(4.90). 표시만 하는 함수라 테스트가 기록을 직접 넣는다
export function WeekTrendCard({ snapshots }: { snapshots: DailyAssetSnapshot[] }) {
  const { navigate } = useAssetNavigation();

  // 자산 등록 직후엔 기록이 없어 이 영역이 통째로 비어버린다 → 언제부터 쌓이는지 알려준다
  if (snapshots.length === 0) {
    return (
      <div className="rounded-lg bg-muted/40 px-4 py-6 text-center space-y-1">
        <p className="text-sm font-semibold text-foreground">순자산 추이는 내일부터 그려져요</p>
        <p className="text-sm text-muted-foreground text-pretty">접속할 때마다 하루치가 자동으로 기록됩니다.</p>
      </div>
    );
  }

  const maxVal = Math.max(...snapshots.map((s) => s.netAsset));
  const minVal = Math.min(...snapshots.map((s) => s.netAsset));
  // 베이스라인을 최소값보다 약간 아래로 — 최소값 막대도 보이게 + 작은 변동 시각 대비 강화
  const baseVal = minVal - (maxVal - minVal) * 0.15;
  const range = maxVal - baseVal || 1;
  // 막대 높이 범위 확장: 8 ~ 72px (정확한 비례, 반올림 X)
  const MIN_BAR = 8;
  const MAX_BAR = 72;

  // 기록 2개 이상이면 카드 전체가 자산 변화 › 전체·주로 가는 버튼(4.90 C). 0·1개는 안내만(비버튼)
  const clickable = snapshots.length >= 2;
  const Root = clickable ? "button" : "div";
  const rootProps = clickable
    ? {
        type: "button" as const,
        "data-testid": "home-week-card",
        "aria-label": "순자산 추이, 자산 변화 주 보기",
        onClick: () => {
          track("feature_use", { category: "change_week_all", source: "home_week" });
          navigate({ type: "activity", tab: "change", init: { scope: "all", period: "week" } });
        },
      }
    : {};

  return (
    <Root
      {...rootProps}
      className={`block w-full rounded-lg bg-brand/[0.03] px-4 py-3 text-left space-y-2.5 ${clickable ? "transition-[background-color,scale] hover:bg-brand/[0.06] active:scale-[0.98]" : ""}`}
    >
      <div className="flex w-full items-center gap-1.5">
        <p data-testid="home-week-title" className="text-sm font-semibold text-muted-foreground">{weekTrendTitle(snapshots)}</p>
        <DataSourceBadge kind="closing" />
        {clickable && <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-foreground" />}
      </div>
      {snapshots.length === 1 && (
        <p className="text-sm text-muted-foreground text-pretty">하루 더 쌓이면 날짜별 변화를 비교할 수 있어요.</p>
      )}
      <div className="flex gap-1">
        {snapshots.map((snap, i) => {
          const isLast = i === snapshots.length - 1;
          // 값에 정확히 비례한 높이 (반올림 없이) — 어제보다 작으면 막대도 무조건 더 낮음
          const heightPx = MIN_BAR + ((snap.netAsset - baseVal) / range) * (MAX_BAR - MIN_BAR);
          const barColor = isLast ? MAIN_PALETTE[0] : MAIN_PALETTE[0] + "88";
          const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(snap.date).getDay()];
          const label = `${snap.date.slice(5)} (${dow})`;

          return (
            <div key={snap.date} className="flex-1 flex flex-col items-center gap-0.5 relative">
              <div className="w-full flex flex-col items-center" style={{ height: MAX_BAR + 24 }}>
                <div style={{ flex: 1 }} />
                {/* 640 미만은 원 없는 11px 한 줄(4.96): <375 tiny / 375~639 기본 / 640 이상 기존 표기 */}
                <span className="hidden text-[11px] font-bold tabular-nums whitespace-nowrap tracking-tighter text-foreground leading-none mb-1 max-[375px]:inline">{formatNarrowKRW(snap.netAsset, { tiny: true })}</span>
                <span className="hidden text-[11px] font-bold tabular-nums whitespace-nowrap tracking-tighter text-foreground leading-none mb-1 min-[375px]:max-sm:inline">{formatNarrowKRW(snap.netAsset)}</span>
                <span className="hidden text-sm font-bold text-foreground leading-none mb-1 sm:inline">{formatShortCurrencyDecimal(snap.netAsset)}</span>
                <div className="w-full rounded-t-sm" style={{ height: heightPx, backgroundColor: barColor }} />
              </div>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
    </Root>
  );
}

// 탭 하단 요약 문장 → 해당 상세 화면으로 이동. 최소 히트영역 40px 확보(py-2.5)
function DrillDownRow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-2 text-left text-muted-foreground text-sm py-2.5 rounded-lg hover:text-foreground transition-colors active:scale-[0.99]"
    >
      <span className="min-w-0 text-pretty">{children}</span>
      <ChevronRight className="size-4 shrink-0" />
    </button>
  );
}

export type DashboardTab = { value: string; label: string };

export function useDashboardTabs(activeDetailTab: string): { visibleTabs: DashboardTab[]; resolvedTab: string } {
  const { getAssetSummary } = useAssetData();
  const summary = getAssetSummary();
  const financialTotal = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const totalLiability = summary.loanBalance + summary.tenantDepositTotal;

  const TAB_META: DashboardTab[] = [
    { value: "all", label: "전체" },
    ...(financialTotal > 0 ? [{ value: "financial", label: "금융자산" }] : []),
    ...(summary.realEstateValue > 0 ? [{ value: "realEstate", label: "부동산" }] : []),
    ...(totalLiability > 0 ? [{ value: "liability", label: "부채" }] : []),
  ];

  const availableValues = TAB_META.map((t) => t.value);
  const resolvedTab = availableValues.includes(activeDetailTab) ? activeDetailTab : "all";

  return { visibleTabs: TAB_META, resolvedTab };
}

export function Dashboard() {
  const [activeDetailTab, setActiveDetailTab] = useState("");
  const [nickname] = useNickname();
  const { assetData, getAssetSummary } = useAssetData();
  const { navigate } = useAssetNavigation();
  const summary = getAssetSummary();
  // Hero 통합 등락 — 지난 접속일 종가 → 실시간 현재 (원인분해 포함)
  const headerChange = useHeaderNetChange();
  // 자산 성적표 미니 배지 — 저장된 최신 등급만 읽음(재계산 없음)
  const latestGrade = useLatestAssetGrade();
  // 지수 종가 줄(4.90 A) — 지수 조회·종목 마스터는 첫 저장 당일(headerChange null)·주식 없음이면 건너뛴다. 줄과 팁 억제가 같은 판정 1곳
  const market = useMarketEntryValue("daily", true, headerChange !== null);
  const marketLine = marketLineState({ hasHeaderChange: headerChange !== null, hasTickerStock: market.hasTickerStock, markets: market.markets });

  const totalAsset = summary.realEstateValue + summary.physicalValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const totalLiability = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + totalLiability;

  // 홈 탭에 physical이 없으므로 실물 조각은 상세 실물 탭으로 이동, 그 외는 기존 필터 전환(탭 필터에도 "실물"은 넣지 않는다)
  const handleSegmentClick = (key: string) => {
    if (key === "physical") navigate({ type: "detail", tab: "physical" });
    else setActiveDetailTab(key);
  };

  // 도넛 데이터는 공용 훅 재사용 (ShareCard 등과 동일 계산 — 로컬 복제 금지)
  const { treemapData } = useAssetTreemapData();

  const financialTotal = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const finBase = [
    { key: "stocks", label: "주식", value: summary.stockValue },
    { key: "crypto", label: "암호화폐", value: summary.cryptoValue },
    { key: "cash", label: "현금성", value: summary.cashValue },
  ].filter((d) => d.value > 0);
  const finColors = assignColors(finBase);
  const financialBarItems = finBase.map((d, i) => ({ ...d, color: finColors[i] }));

  const liabTopBase = [
    { key: "loans", label: "대출", value: summary.loanBalance },
    { key: "tenant", label: "임차보증금", value: summary.tenantDepositTotal },
  ].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const liabTopItems = liabTopBase.map((d) => ({ ...d, color: LIABILITY_COLORS[d.key as keyof typeof LIABILITY_COLORS], pct: totalLiability > 0 ? (d.value / totalLiability) * 100 : 0 }));

  const realEstateCatBase = realEstateTypes
    .map(({ value: type, label }) => ({
      key: type,
      label,
      value: assetData.realEstate.filter((r) => r.type === type).reduce((s, r) => s + r.currentValue, 0),
    }))
    .filter((d) => d.value > 0);
  const realEstateCatColors = assignColors(realEstateCatBase);
  const realEstateCatBarItems = realEstateCatBase.map((d, i) => ({ ...d, color: realEstateCatColors[i] }));

  const tenantCount = assetData.realEstate.filter((re) => (re.tenantDeposit ?? 0) > 0).length;

  const { visibleTabs, resolvedTab } = useDashboardTabs(activeDetailTab);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500">
      {/* ── 자산 분포 카드 (통합) ── */}
      <Card className={`lg:col-span-2 gap-2 ${ASSET_THEME.contentCard}`}>
        <CardContent className={`pb-2 overflow-hidden ${ASSET_THEME.contentPad}`}>
          {/* 부채만 등록한 사용자도 순자산·구성이 보여야 하므로 자산+부채 합계로 판단 */}
          {grossTotal === 0 ? (
            <div className="flex h-36 items-center justify-center text-muted-foreground text-sm">등록된 자산이 없습니다.</div>
          ) : (
            <Tabs value={resolvedTab} onValueChange={setActiveDetailTab}>
              {/* ── 순자산 요약 + DonutChart / 세부 콘텐츠 2컬럼 ── */}
              <div className="py-3 grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                {/* col-1: 순자산 요약 + DonutChart */}
                <NetAssetSummaryBox
                  netAsset={summary.netAsset}
                  nickname={nickname}
                  change={headerChange}
                  treemapData={treemapData}
                  activeTab={resolvedTab}
                  onSegmentClick={handleSegmentClick}
                  visibleTabs={visibleTabs}
                  showRealtimeBadge
                  grade={latestGrade}
                  onGradeClick={() => navigate({ type: "activity", tab: "report" })}
                  market={market}
                  marketLine={marketLine}
                  onMarketOpen={() => {
                    track("feature_use", { category: "home_market" });
                    navigate({ type: "activity", tab: "change-market", init: { period: "day" } });
                  }}
                />

                {/* col-2: 세부 분포 탭 콘텐츠 */}
                <div>
                  <TabsContent value="all" className="mt-0 space-y-5 lg:pt-0 pt-2">
                    <DailyNetAssetTrend />
                  </TabsContent>

                  {financialTotal > 0 && (
                    <TabsContent value="financial" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className="rounded-lg bg-primary/5 px-4 py-3 flex items-center justify-between">
                        <div className="w-full">
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.muted}`}>금융자산 총액</p>
                          <p className={`text-2xl font-bold tabular-nums break-all leading-tight ${ASSET_THEME.text.default}`}>{formatPriceByMode(financialTotal)}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className={`text-sm font-semibold ${ASSET_THEME.text.default}`}>금융자산 구성</p>
                        <SectionBar items={financialBarItems} total={financialTotal} />
                      </div>

                      <DrillDownRow onClick={() => navigate({ type: "detail", tab: "stocks" })}>
                        주식 <span className="font-bold text-foreground">{summary.stockCount}개</span>
                        {summary.cryptoCount > 0 && <> · 암호화폐 <span className="font-bold text-foreground">{summary.cryptoCount}개</span></>}
                        {summary.cashCount > 0 && <> · 현금성 <span className="font-bold text-foreground">{summary.cashCount}개</span></>}
                        {" "}보유 중
                      </DrillDownRow>
                    </TabsContent>
                  )}

                  {summary.realEstateValue > 0 && (
                    <TabsContent value="realEstate" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className="rounded-lg bg-primary/5 px-4 py-3 flex items-center justify-between">
                        <div className="w-full">
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.muted}`}>부동산 총액</p>
                          <p className={`text-2xl font-bold tabular-nums break-all leading-tight ${ASSET_THEME.text.default}`}>{formatPriceByMode(summary.realEstateValue)}</p>
                        </div>
                      </div>

                      {realEstateCatBarItems.length > 0 && (
                        <div className="space-y-2">
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.default}`}>부동산 구성</p>
                          <SectionBar items={realEstateCatBarItems} total={summary.realEstateValue} />
                        </div>
                      )}

                      <DrillDownRow onClick={() => navigate({ type: "detail", tab: "real-estate" })}>
                        총 <span className="font-bold text-foreground">{summary.realEstateCount}개</span> 부동산 보유 중
                      </DrillDownRow>
                    </TabsContent>
                  )}

                  {totalLiability > 0 && (
                    <TabsContent value="liability" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className={ASSET_THEME.summaryHeader}>
                        <div className="w-full">
                          <p className="text-sm font-semibold text-muted-foreground">부채 총액</p>
                          <p className={`text-2xl font-bold tabular-nums break-all leading-tight ${ASSET_THEME.liability}`}>{formatPriceByMode(totalLiability)}</p>
                        </div>
                      </div>

                      {liabTopItems.length > 0 && (
                        <div className="space-y-2">
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.default}`}>부채 구성</p>
                          <SectionBar items={liabTopItems} total={totalLiability} />
                        </div>
                      )}

                      <DrillDownRow onClick={() => navigate({ type: "detail", tab: "loans" })}>
                        {summary.loanCount > 0 && <>대출 <span className="font-bold text-foreground">{summary.loanCount}건</span></>}
                        {summary.loanCount > 0 && tenantCount > 0 && " · "}
                        {tenantCount > 0 && <>임차보증금 <span className="font-bold text-foreground">{tenantCount}건</span></>}
                      </DrillDownRow>
                    </TabsContent>
                  )}
                </div>
              </div>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* ── 홈 알림/팁 통합 박스 (S-4.32 후속) — 백업·세금·자산 최신화·기능 팁 4종을 위험도 순으로
          1개만 노출. 전부 조건 미충족이면 스스로 null을 반환한다. ── */}
      <div className="lg:col-span-2 empty:hidden">
        <HomeTipBox marketLine={marketLine} />
      </div>
    </div>
  );
}
