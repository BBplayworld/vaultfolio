"use client";

// 성과 · 자산 변화(#32) — 순자산·수익 화면을 기간(일·주·월·연) × 범위(전체·주식) 하나로 합친 셸.
// 기존 화면은 분해하지 않고 제어 prop(view/period)만 넘긴다. 전체·월 = 월말 결산, 전체·주 = 최근 7일 목록.

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { formatPriceByMode } from "@/lib/number-utils";
import { readDailySnapshots } from "@/lib/asset/snapshot-storage";
import { buildWeekRows } from "@/lib/report/settlement";
import type { ProfitPeriod } from "@/lib/finance/profit-utils";
import type { ChangeInit, ChangePeriod, ChangeScope } from "../../layout/navigation/navigation-context";
import { SECTION, GROUP_BADGE, SectionHeader, SpecRow } from "../../layout/ui/report-section";
import { YearlyNetAssetChart } from "./net-asset-chart";
import { ProfitCard } from "./profit-chart";
import { SettlementView } from "./settlement-view";

const SCOPES: { value: ChangeScope; label: string }[] = [
  { value: "all", label: "전체 자산" },
  { value: "stock", label: "주식" },
];
const PERIODS: { value: ChangePeriod; label: string }[] = [
  { value: "day", label: "일" },
  { value: "week", label: "주" },
  { value: "month", label: "월" },
  { value: "year", label: "연" },
];
const PROFIT_PERIOD: Record<ChangePeriod, ProfitPeriod> = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function AssetChangeView({ init }: { init?: ChangeInit }) {
  const [scope, setScope] = useState<ChangeScope>(init?.scope ?? "all");
  const [period, setPeriod] = useState<ChangePeriod>(init?.period ?? "month");
  // 결산 진입 정보 — 화면이 열린 채로 다시 진입(FAB·카드)하면 key를 올려 월 탭을 새로 연다
  const [entry, setEntry] = useState({ key: 0, month: init?.month, source: init?.source ?? "menu" });
  const firstInit = useRef(init);
  useEffect(() => {
    if (!init || init === firstInit.current) return;
    setScope(init.scope ?? "all");
    setPeriod(init.period ?? "month");
    setEntry((e) => ({ key: e.key + 1, month: init.month, source: init.source ?? "menu" }));
  }, [init]);

  const scopeLabel = SCOPES.find((s) => s.value === scope)!.label;
  // 탭으로 진입·전환하는 경우의 월 탭은 메뉴 진입으로 본다
  const changePeriod = (v: string) => {
    setPeriod(v as ChangePeriod);
    setEntry((e) => ({ key: e.key + 1, month: undefined, source: "menu" }));
  };

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex items-center gap-2">
        <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">자산 변화</h2>
        <span data-testid="change-scope-label" className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">{scopeLabel}</span>
      </div>

      <div className="flex flex-col gap-2" data-screenshot-hide>
        <Tabs value={scope} onValueChange={(v) => { setScope(v as ChangeScope); setEntry((e) => ({ key: e.key + 1, month: undefined, source: "menu" })); }}>
          <TabsList className={`${ASSET_THEME.tabList2} h-auto`} aria-label="범위 선택">
            {SCOPES.map((s) => (
              <TabsTrigger key={s.value} value={s.value} data-testid={`change-scope-${s.value}`} className={`${ASSET_THEME.tabTrigger2} min-h-10`}>
                {s.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Tabs value={period} onValueChange={changePeriod}>
          <TabsList className={`${ASSET_THEME.tabList3} h-auto`} aria-label="기간 선택">
            {PERIODS.map((p) => (
              <TabsTrigger key={p.value} value={p.value} data-testid={`change-period-${p.value}`} className={`${ASSET_THEME.tabTrigger3} min-h-10 py-2.5`}>
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {scope === "stock" ? (
        <ProfitCard isActive period={PROFIT_PERIOD[period]} />
      ) : period === "month" ? (
        <SettlementView key={entry.key} initialMonth={entry.month} source={entry.source} />
      ) : period === "week" ? (
        <WeekList />
      ) : (
        <YearlyNetAssetChart view={period === "year" ? "yearly" : "daily"} />
      )}
    </div>
  );
}

// 전체·주 — 기존 일별 스냅샷(30일 롤링)에서 최근 7일. 신규 계산·원인 분해 없음.
function WeekList() {
  const { snapshotVersion } = useAssetData();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { rows, weekDiff } = useMemo(
    () => buildWeekRows(snapshotVersion >= 0 ? readDailySnapshots() : [], today),
    [snapshotVersion, today],
  );
  return (
    <section data-testid="week-list" className={SECTION}>
      <SectionHeader icon={CalendarRange} title="순자산 변화" badge={<span className={GROUP_BADGE}>최근 7일</span>} />
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">기록이 쌓이면 더 보여드려요</p>
      ) : (
        <>
          {weekDiff !== null && (
            <SpecRow label="7일 전 대비">
              <span className={getProfitLossColor(weekDiff)}>{weekDiff >= 0 ? "+" : ""}{formatPriceByMode(weekDiff)}</span>
            </SpecRow>
          )}
          <div className="flex flex-col divide-y divide-border/40">
            {rows.map((r) => (
              <div key={r.date} data-testid="week-row" className="flex items-baseline justify-between gap-3 py-2">
                <span className="text-sm text-muted-foreground tabular-nums">
                  {Number(r.date.slice(5, 7))}/{Number(r.date.slice(8, 10))} ({WEEKDAY[new Date(`${r.date}T00:00:00Z`).getUTCDay()]})
                </span>
                <span className="ml-auto text-sm font-semibold text-foreground tabular-nums">{formatPriceByMode(r.netAsset)}</span>
                <span className={`w-24 text-right text-sm tabular-nums ${r.diff === null ? "text-muted-foreground" : getProfitLossColor(r.diff)}`}>
                  {r.diff === null ? "-" : `${r.diff >= 0 ? "+" : ""}${formatPriceByMode(r.diff)}`}
                </span>
              </div>
            ))}
          </div>
          {rows.length < 7 && <p className="text-sm text-muted-foreground">기록이 쌓이면 더 보여드려요</p>}
        </>
      )}
    </section>
  );
}
