"use client";

import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatShortCurrency, formatShortCurrencyDecimal, formatPriceByMode } from "@/lib/number-utils";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/snapshot-storage";
import { readExchangeHistory } from "@/lib/profit-utils";
import { buildLiveAttributionCurr, computeAttributionSince, formatAttributionSentence } from "@/lib/report/asset-report";
import { ASSET_THEME, MAIN_PALETTE, getProfitLossColor } from "@/config/theme";
import { realEstateTypes } from "@/config/asset-options";
import { PieChart, Pie, Cell, ResponsiveContainer, Sector } from "recharts";
import { DailyAssetSnapshot } from "@/types/asset";
import { DataSourceBadge } from "../data-source-badge";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { useNickname } from "@/hooks/use-nickname";
import { BackupNudge } from "./backup-nudge";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { ChevronRight, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

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
        {items.map(({ key, label, value, color }) => {
          const pct = (value / total) * 100;
          return (
            <div key={key} className="flex items-center justify-center overflow-hidden transition-all" style={{ width: `${pct}%`, backgroundColor: color }} title={`${label}: ${pct.toFixed(1)}%`}>
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

function DonutLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, pct, value, activeTab, itemKey, maskFn }: {
  cx: number; cy: number; midAngle: number; innerRadius: number; outerRadius: number;
  name: string; pct: number; value: number; activeTab?: string; itemKey?: string;
  maskFn?: (v: number) => string;
}) {
  const fmt = maskFn ?? formatShortCurrency;
  if (pct < 5) return null;
  if (activeTab && activeTab !== "all" && itemKey !== activeTab) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
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
  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={screenshotMode ? 220 : 260} className={`[&_*]:outline-none [&_path]:outline-none ${screenshotMode ? "" : "sm:!h-[360px]"}`} style={screenshotMode ? { pointerEvents: "none" } : undefined}>
        <PieChart style={{ outline: "none" }}>
          <Pie
            data={items}
            dataKey="value"
            nameKey="name"
            innerRadius={screenshotMode ? 45 : 55}
            outerRadius={screenshotMode ? 110 : 130}
            strokeWidth={2}
            stroke="var(--card)"
            labelLine={false}
            label={({ key, ...props }) => <DonutLabel key={key} itemKey={key} activeTab={activeTab} maskFn={maskFn} {...props} />}
            onClick={(data) => { if (!screenshotMode && data?.key && onSegmentClick) onSegmentClick(data.key as string); }}
            style={{ cursor: screenshotMode ? "default" : "pointer", outline: "none" }}
            rootTabIndex={-1}
            isAnimationActive={false}
            activeShape={(props: React.ComponentProps<typeof Sector>) => <Sector {...props} outerRadius={screenshotMode ? 110 : 130} strokeWidth={0} stroke="none" />}
          >
            {items.map((item, i) => {
              const isAll = !activeTab || activeTab === "all";
              const isActive = item.key === activeTab;
              return (
                <Cell
                  key={i}
                  fill={item.color}
                  stroke="var(--card)"
                  strokeWidth={2}
                  tabIndex={-1}
                  style={{
                    opacity: isAll || isActive ? 1 : 0.1,
                    filter: isActive ? "brightness(1.15)" : undefined,
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
      <div className={`grid gap-x-2 ${screenshotMode ? "hidden gap-y-0.5 grid-cols-1 pointer-events-none" : "gap-y-1 grid-cols-1 sm:grid-cols-2"}`}>
        {items.map(({ key, name, value, color, pct }) => {
          const isAll = !activeTab || activeTab === "all";
          const isActive = key === activeTab;
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
}) {
  // Hero·총액은 전액 표기(formatPriceByMode) — 도넛 라벨·범례·막대는 폭 제약상 축약 유지
  const hasRightSide = totalAsset !== undefined && totalLiability !== undefined;
  const [causeOpen, setCauseOpen] = useState(false);
  const hasCause = !!change && (!!change.sentence || change.estimated);

  return (
    <div className="space-y-4">
      <div className={`rounded-lg ${ASSET_THEME.primary.bgLight} px-4 py-4 ${hasRightSide ? "flex items-center justify-between" : ""}`}>
        <div>
          <div className="flex items-center gap-1.5">
            {nickname && (
              <span className={`text-sm font-semibold ${ASSET_THEME.primary.text}`}>{nickname}</span>
            )}
            <p className={`text-sm font-semibold ${ASSET_THEME.text.muted}`}>순자산</p>
            {showRealtimeBadge && <DataSourceBadge kind="realtime" />}
          </div>

          <div className="mt-1 space-y-1">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <p className={`text-2xl sm:text-3xl lg:text-4xl font-extrabold tabular-nums break-all leading-tight ${ASSET_THEME.important}`}>
                {formatPriceByMode(netAsset)}
              </p>
              {change && (
                <span className={`inline-flex items-center text-base lg:text-lg font-extrabold tabular-nums ${getProfitLossColor(change.deltaNet)}`}>
                  {change.deltaNet >= 0 ? "▲ +" : "▼ "}{formatShortCurrency(change.deltaNet)}
                  <span className="text-sm lg:text-base font-bold ml-1">({change.deltaNet >= 0 ? "+" : ""}{change.pct.toFixed(1)}%)</span>
                  <span className="text-sm font-medium text-muted-foreground ml-1.5">{change.label}</span>
                  {/* 원인 문구는 기본 접힘 — 헤더에 상시 노출하면 숫자보다 문장이 시선을 끈다 */}
                  {hasCause && !screenshotMode && (
                    <button
                      type="button"
                      onClick={() => setCauseOpen((v) => !v)}
                      aria-expanded={causeOpen}
                      aria-label="변동 원인 보기"
                      className="ml-1 -my-2 p-2 text-muted-foreground hover:text-foreground"
                    >
                      <ChevronDown className={`size-3.5 transition-transform duration-200 ${causeOpen ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </span>
              )}
            </div>
            {change && hasCause && (causeOpen || screenshotMode) && (
              <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground text-pretty">
                {change.estimated && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">예측</span>
                )}
                {change.sentence && <span>{change.sentence}</span>}
              </p>
            )}
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

  const totalAsset = summary.realEstateValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const financialAssetValue = summary.stockValue + summary.cryptoValue + summary.cashValue;
  const liabilityValue = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + liabilityValue;

  const treemapRawAssets = [
    { key: "realEstate", name: "부동산", value: summary.realEstateValue },
    { key: "financial", name: "금융자산", value: financialAssetValue },
  ].filter((d) => d.value > 0);

  const assetPaletteColors = assignColors(treemapRawAssets);
  const treemapData: TreemapItem[] = [
    ...treemapRawAssets.map((d, i) => ({
      ...d,
      color: assetPaletteColors[i],
      pct: grossTotal > 0 ? (d.value / grossTotal) * 100 : 0,
    })),
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

// Hero 통합 등락 뷰모델 — "지난 접속일 종가 → 실시간 현재"를 원인분해까지 한 줄에 표기.
interface HeaderChange {
  deltaNet: number;
  pct: number;
  isBig: boolean;
  label: string;            // "전일 대비" 또는 "지난 접속(M/D) 이후"
  estimated: boolean;
  sentence: string | null;  // 최상위 원인 문장
}

// 비교 시작일 표기: YYYY-MM-DD → M/D, YYYY-MM → M월
function fmtFromDate(d: string): string {
  const parts = d.split("-");
  if (parts.length >= 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  return `${parseInt(parts[1])}월`;
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
    const liveCurr = buildLiveAttributionCurr(assetData, exchangeRates, summary);
    const attr = computeAttributionSince(
      readDailySnapshots(),
      readMonthlySnapshots(),
      readExchangeHistory(),
      sinceDate,
      assetData,
      exchangeRates,
      liveCurr,
    );
    if (!attr) return null;
    const prevNet = summary.netAsset - attr.deltaNet;
    const pct = prevNet > 0 ? (attr.deltaNet / prevNet) * 100 : 0;
    const label = attr.fromDate === yesterdayStr ? "전일 대비" : `지난 접속(${fmtFromDate(attr.fromDate)}) 이후`;
    return {
      deltaNet: attr.deltaNet,
      pct,
      isBig: Math.abs(pct) >= 5,
      label,
      estimated: attr.estimated,
      sentence: formatAttributionSentence(attr),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previousVisitDate, todayStr, assetData, exchangeRates, snapshotVersion]);
}

function DailyNetAssetTrend() {
  const snapshots = useLast7DailySnapshots();

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

  return (
    <div className="rounded-lg px-4 py-3 space-y-2.5" style={{ backgroundColor: MAIN_PALETTE[0] + "08" }}>
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold text-muted-foreground">순자산 추이 (최근 {snapshots.length}일)</p>
        <DataSourceBadge kind="closing" />
      </div>
      {snapshots.length === 1 && (
        <p className="text-sm text-muted-foreground text-pretty">하루 더 쌓이면 날짜별 변화를 비교할 수 있어요.</p>
      )}
      <div className="flex gap-1">
        {snapshots.map((snap, i) => {
          const prev = i > 0 ? snapshots[i - 1].netAsset : null;
          const diff = prev !== null ? snap.netAsset - prev : 0;
          const pct = prev !== null && prev > 0 ? (diff / prev) * 100 : 0;
          const isBig = prev !== null && pct >= 5;
          const isLast = i === snapshots.length - 1;
          // 값에 정확히 비례한 높이 (반올림 없이) — 어제보다 작으면 막대도 무조건 더 낮음
          const heightPx = MIN_BAR + ((snap.netAsset - baseVal) / range) * (MAX_BAR - MIN_BAR);
          const barColor = isBig ? MAIN_PALETTE[4] : isLast ? MAIN_PALETTE[0] : MAIN_PALETTE[0] + "88";
          const dow = ["일", "월", "화", "수", "목", "금", "토"][new Date(snap.date).getDay()];
          const label = `${snap.date.slice(5)} (${dow})`;

          return (
            <div key={snap.date} className="flex-1 flex flex-col items-center gap-0.5 relative">
              {isBig && (
                <span className="text-[10px] sm:text-[11px] font-bold animate-pulse leading-none mb-0.5" style={{ color: MAIN_PALETTE[4] }}>▲{pct.toFixed(0)}%</span>
              )}
              {!isBig && <span className="text-[10px] sm:text-[11px] leading-none mb-0.5 invisible">x</span>}
              <div className="w-full flex flex-col items-center" style={{ height: MAX_BAR + 24 }}>
                <div style={{ flex: 1 }} />
                <span className="text-sm font-bold text-foreground leading-none mb-1">{formatShortCurrencyDecimal(snap.netAsset)}</span>
                <div
                  className="w-full rounded-t-sm transition-all"
                  style={{ height: heightPx, backgroundColor: barColor, boxShadow: isBig ? `0 0 6px ${MAIN_PALETTE[4]}88` : undefined }}
                />
              </div>
              <span className="text-sm text-muted-foreground">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
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

  const totalAsset = summary.realEstateValue + summary.stockValue + summary.cryptoValue + summary.cashValue;
  const totalLiability = summary.loanBalance + summary.tenantDepositTotal;
  const grossTotal = totalAsset + totalLiability;

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
      {/* ── 상단 알림 (백업 넛지) — 지난 접속 등락은 Hero로 통합됨 ── */}
      <div className="lg:col-span-2 empty:hidden space-y-3">
        <BackupNudge />
      </div>

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
                  onSegmentClick={setActiveDetailTab}
                  visibleTabs={visibleTabs}
                  showRealtimeBadge
                />

                {/* col-2: 세부 분포 탭 콘텐츠 */}
                <div>
                  <TabsContent value="all" className="mt-0 space-y-5 lg:pt-0 pt-2">
                    <DailyNetAssetTrend />
                  </TabsContent>

                  {financialTotal > 0 && (
                    <TabsContent value="financial" className="mt-0 space-y-5 lg:pt-0 pt-2">
                      <div className="rounded-lg bg-primary/5 px-4 py-3 flex items-center justify-between">
                        <div>
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.muted}`}>금융자산 총액</p>
                          <p className={`text-2xl font-extrabold tabular-nums break-all leading-tight ${ASSET_THEME.text.default}`}>{formatPriceByMode(financialTotal)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          {financialBarItems.map(({ key, label, value }) => {
                            const pct = financialTotal > 0 ? (value / financialTotal) * 100 : 0;
                            return (
                              <div key={key} className="text-sm">
                                <span className="text-muted-foreground">{label} </span>
                                <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                                <span className="text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>
                              </div>
                            );
                          })}
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
                        <div>
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.muted}`}>부동산 총액</p>
                          <p className={`text-2xl font-extrabold tabular-nums break-all leading-tight ${ASSET_THEME.text.default}`}>{formatPriceByMode(summary.realEstateValue)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          {realEstateCatBarItems.map(({ key, label, value }) => {
                            const pct = summary.realEstateValue > 0 ? (value / summary.realEstateValue) * 100 : 0;
                            return (
                              <div key={key} className="text-sm">
                                <span className="text-muted-foreground">{label} </span>
                                <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                                <span className="text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>
                              </div>
                            );
                          })}
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
                        <div>
                          <p className="text-sm font-semibold text-muted-foreground">부채 총액</p>
                          <p className={`text-2xl font-extrabold tabular-nums break-all leading-tight ${ASSET_THEME.liability}`}>{formatPriceByMode(totalLiability)}</p>
                        </div>
                        <div className="text-right space-y-1">
                          {liabTopItems.map(({ key, label, value, pct }) => (
                            <div key={key} className="text-sm">
                              <span className="text-muted-foreground">{label} </span>
                              <span className={`font-bold ${ASSET_THEME.text.default}`}>{formatShortCurrency(value)}</span>
                              <span className="text-muted-foreground ml-1">({pct.toFixed(1)}%)</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {liabTopItems.length > 0 && (
                        <div className="space-y-2">
                          <p className={`text-sm font-semibold ${ASSET_THEME.text.default}`}>부채 구성</p>
                          <SectionBar items={liabTopItems} total={totalLiability} />
                        </div>
                      )}

                      <DrillDownRow onClick={() => navigate({ type: "detail", tab: "loans" })}>
                        {assetData.loans.length > 0 && <>대출 <span className="font-bold text-foreground">{assetData.loans.length}건</span></>}
                        {assetData.loans.length > 0 && tenantCount > 0 && " · "}
                        {tenantCount > 0 && <>임차보증금 <span className="font-bold text-foreground">{tenantCount}건</span></>}
                      </DrillDownRow>
                    </TabsContent>
                  )}
                </div>
              </div>
            </Tabs>
          )}
        </CardContent>
        <CardFooter className={ASSET_THEME.contentPad}>
          <p className={`${ASSET_THEME.distributionCard.muted} text-xs`}>
            마지막 업데이트: {assetData.lastUpdated && !Number.isNaN(new Date(assetData.lastUpdated).getTime()) ? new Date(assetData.lastUpdated).toLocaleString("ko-KR") : ""}
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
