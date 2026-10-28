"use client";

// 성과 · 자산 변화(#32) — 순자산·수익 화면을 기간(일·주·월·연) × 범위(전체·주식) 하나로 합친 셸.
// 기존 화면은 분해하지 않고 제어 prop(view/period)만 넘긴다. 전체·월 = 월말 결산, 전체·주 = 최근 7일 목록.

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { formatPriceByMode } from "@/lib/number-utils";
import { readDailySnapshots } from "@/lib/asset/snapshot-storage";
import { buildWeekRows } from "@/lib/report/settlement";
import type { ProfitPeriod } from "@/lib/finance/profit-utils";
import type { ChangeInit, ChangePeriod, ChangeScope } from "../../layout/navigation/navigation-context";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { SECTION } from "../../layout/ui/report-section";
import { BODY_ENTER, ChangeHero } from "./change-hero";
import { YearlyNetAssetChart } from "./net-asset-chart";
import { ProfitCard } from "./profit-chart";
import { SettlementView } from "./settlement-view";

const SCOPES: { value: ChangeScope; label: string; testId: string }[] = [
  { value: "all", label: "전체 자산", testId: "change-scope-all" },
  { value: "stock", label: "주식", testId: "change-scope-stock" },
];
const PERIODS: { value: ChangePeriod; label: string; testId: string }[] = [
  { value: "day", label: "일", testId: "change-period-day" },
  { value: "week", label: "주", testId: "change-period-week" },
  { value: "month", label: "월", testId: "change-period-month" },
  { value: "year", label: "연", testId: "change-period-year" },
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

  // 탭으로 진입·전환하는 경우의 월 탭은 메뉴 진입으로 본다
  // 이미 선택된 칸을 다시 눌러도 결산을 새로 열지 않는다(settlement_view 중복 발화 방지)
  const changePeriod = (v: ChangePeriod) => {
    if (v === period) return;
    setPeriod(v);
    setEntry((e) => ({ key: e.key + 1, month: undefined, source: "menu" }));
  };
  const changeScope = (v: ChangeScope) => {
    if (v === scope) return;
    setScope(v);
    setEntry((e) => ({ key: e.key + 1, month: undefined, source: "menu" }));
  };

  // 기간 선택 — 각 본문의 Hero 맨 아래에 놓인다(공유 캡처에도 상태 표시로 남김)
  const periodSelector = (
    <InlineSelector fullWidth value={period} onChange={changePeriod} options={PERIODS} ariaLabel="기간 선택" className="w-full" />
  );

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex h-11 items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">자산 변화</h2>
        <InlineSelector fullWidth value={scope} onChange={changeScope} options={SCOPES} ariaLabel="범위 선택" className="w-[164px] shrink-0" />
      </div>

      {scope === "stock" ? (
        <ProfitCard isActive period={PROFIT_PERIOD[period]} periodSelector={periodSelector} />
      ) : period === "month" ? (
        <SettlementView key={entry.key} initialMonth={entry.month} source={entry.source} periodSelector={periodSelector} />
      ) : period === "week" ? (
        <WeekList periodSelector={periodSelector} />
      ) : (
        <YearlyNetAssetChart view={period === "year" ? "yearly" : "daily"} periodSelector={periodSelector} />
      )}
    </div>
  );
}

// 전체·주 — 기존 일별 스냅샷(30일 롤링)에서 최근 7일. 신규 계산·원인 분해 없음.
function WeekList({ periodSelector }: { periodSelector: ReactNode }) {
  const { snapshotVersion } = useAssetData();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const { rows, weekDiff } = useMemo(
    () => buildWeekRows(snapshotVersion >= 0 ? readDailySnapshots() : [], today),
    [snapshotVersion, today],
  );
  // 7일 전 대비 — 끝 = 최근 기록(rows[0]), 시작 = 끝 − weekDiff
  const end = rows[0]?.netAsset ?? 0;
  const start = weekDiff !== null ? end - weekDiff : end;
  return (
    <>
      <ChangeHero
        title="7일 전 대비"
        delta={weekDiff}
        pct={weekDiff !== null && start !== 0 ? (weekDiff / Math.abs(start)) * 100 : null}
        start={start}
        end={end}
        message="기록이 쌓이면 더 보여드려요"
        contentKey="week"
        period={periodSelector}
      />
      {rows.length > 0 && (
        <section data-testid="week-list" className={`${SECTION} ${BODY_ENTER}`}>
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
        </section>
      )}
    </>
  );
}
