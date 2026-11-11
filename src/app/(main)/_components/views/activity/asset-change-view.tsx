"use client";

// 성과 · 자산 변화(#32) — 순자산·수익 화면을 기간(일·주·월·연) × 범위(전체·주식) 하나로 합친 셸.
// 기존 화면은 분해하지 않고 제어 prop(view/period)만 넘긴다. 전체·월 = 월말 결산, 전체·주 = 최근 7일 원인 분해.

import { useEffect, useMemo, useRef, useState } from "react";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { formatPriceByMode } from "@/lib/number-utils";
import { ChevronDown, ChevronRight, Table2 } from "lucide-react";
import { readDailySnapshots, readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readExchangeHistory } from "@/lib/finance/profit-utils";
import { track } from "@/lib/analytics/ga";
import { buildWeekRows, type WeekRow } from "@/lib/report/settlement";
import type { ProfitPeriod } from "@/lib/finance/profit-utils";
import { rememberChangeInit, useAssetNavigation, type ChangeInit, type ChangePeriod, type ChangeScope } from "../../layout/navigation/navigation-context";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { SECTION } from "../../layout/ui/report-section";
import { BODY_ENTER, CauseBlock, ChangeHero, ChangeHeroFrame } from "./change-hero";
import { computeAttributionView, mapWeekCauses, resolveWeekHero, weekSinceDate, weekStartDate, weekToday } from "./week-attribution";
import { AttributionRecordList } from "../attribution-records";
import { YearlyNetAssetChart } from "./net-asset-chart";
import { ProfitCard } from "./profit-chart";
import { MarketEntryLine, hasComparableStock } from "./market-entry-line";
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
const PROFIT_PERIOD: Record<ChangePeriod, Exclude<ProfitPeriod, "ytd">> = { day: "daily", week: "weekly", month: "monthly", year: "yearly" };
// 시장과 비교 글줄 기간(연 탭은 값 없이 `올해 시장과 비교` 링크만 — Hero 1년 값과 기간이 달라 오독을 막는다, #150)
const COMPARE_PERIOD = { day: "daily", week: "weekly", month: "monthly", year: "ytd" } as const;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function AssetChangeView({ init }: { init?: ChangeInit }) {
  const { navigate } = useAssetNavigation();
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
    // 전체 범위에서 사용자가 주를 눌렀을 때만 1건(복원·첫 진입은 init으로 들어와 여기를 거치지 않는다, 4.79)
    if (v === "week" && scope === "all") track("feature_use", { category: "change_week_all" });
    setPeriod(v);
    setEntry((e) => ({ key: e.key + 1, month: undefined, source: "menu" }));
  };
  const changeScope = (v: ChangeScope) => {
    if (v === scope) return;
    // 사용자가 주식 범위를 눌렀을 때만 1건(복원·첫 진입은 init으로 들어와 여기를 거치지 않는다, #132)
    if (v === "stock") track("feature_use", { category: "change_scope_stock" });
    setScope(v);
    setEntry((e) => ({ key: e.key + 1, month: undefined, source: "menu" }));
  };

  // 기간 선택 — Hero 틀(ChangeHeroFrame) 맨 아래에 1회만 렌더해 본문이 바뀌어도 같은 노드로 유지(썸 슬라이드).
  // 공유 캡처에도 상태 표시로 남김
  const periodSelector = (
    <InlineSelector fullWidth value={period} onChange={changePeriod} options={PERIODS} ariaLabel="기간 선택" className="w-full sm:max-w-md" />
  );

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div className="flex h-11 items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">자산 변화</h2>
        <InlineSelector fullWidth value={scope} onChange={changeScope} options={SCOPES} ariaLabel="범위 선택" className="w-[164px] shrink-0" />
      </div>

      <ChangeHeroFrame
        period={periodSelector}
        footer={scope === "stock" ? (
          <MarketEntryLine
            variant="hero"
            testId="change-market-entry"
            period={COMPARE_PERIOD[period]}
            onOpen={() => {
              // 뒤로(pop) 때 범위 = 주식·지금 기간으로 다시 열리게 현재 history 항목에 싣는다(K3)
              rememberChangeInit({ scope: "stock", period });
              navigate({ type: "activity", tab: "change-market" });
            }}
          />
        ) : undefined}
      >
      {scope === "stock" ? (
        <ProfitCard isActive period={PROFIT_PERIOD[period]} />
      ) : period === "month" ? (
        <SettlementView key={entry.key} initialMonth={entry.month} source={entry.source} />
      ) : period === "week" ? (
        <WeekList />
      ) : (
        <YearlyNetAssetChart view={period === "year" ? "yearly" : "daily"} />
      )}
      </ChangeHeroFrame>
    </div>
  );
}

// 전체·주 — 최근 7일(today−7 이후) 원인 분해(4.79 #153). 계산은 홈 Hero와 같은 computeAttributionView, 6줄은 합산만.
// 일별 마감 목록(30일 롤링)은 '날짜별 마감 기록' 접힘 카드로 내렸다(행·값 그대로).
export function WeekList() {
  const { assetData, exchangeRates, snapshotVersion, getAssetSummary } = useAssetData();
  const { navigate } = useAssetNavigation();
  const today = weekToday();
  const summary = getAssetSummary();
  const view = useMemo(
    () => computeAttributionView({
      assetData,
      rates: exchangeRates,
      summary,
      daily: readDailySnapshots(),
      monthly: readMonthlySnapshots(),
      exchangeHistory: readExchangeHistory(),
      sinceDate: weekSinceDate(today),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [assetData, exchangeRates, snapshotVersion, today],
  );
  // 시작 행(Hero 시작 순자산의 마감 기록)까지 포함 — 월 스냅샷 시작점은 일별 행이 없을 수 있다(그땐 시작 행 없음)
  const startDate = view ? weekStartDate(view) : undefined;
  const { rows } = useMemo(
    () => buildWeekRows(snapshotVersion >= 0 ? readDailySnapshots() : [], today, startDate),
    [snapshotVersion, today, startDate],
  );
  const hero = resolveWeekHero(view, today);
  const decomposed = view && (hero.kind === "recent" || hero.kind === "since") ? view : null;
  const mapped = useMemo(() => (decomposed ? mapWeekCauses(decomposed) : null), [decomposed]);

  // 홈 Hero와 같은 끝(실시간 순자산)·같은 % 식(deltaNet ÷ (끝 − deltaNet))
  const end = summary.netAsset;
  const delta = decomposed ? decomposed.attr.deltaNet : null;
  const start = delta !== null ? end - delta : undefined;
  const pct = delta !== null && start !== undefined && start > 0 ? (delta / start) * 100 : null;
  const records = decomposed?.records ?? [];
  const hasStock = hasComparableStock(assetData);

  return (
    <>
      <ChangeHero
        title={hero.title}
        titleTestId="week-title"
        range={hero.kind === "recent" ? hero.range : undefined}
        rangeTestId="week-range"
        delta={delta}
        pct={pct}
        start={start}
        end={delta !== null ? end : undefined}
        message={hero.kind === "insufficient"
          ? <span data-testid="week-insufficient">최근 7일 기록이 부족해요</span>
          : hero.kind === "empty" ? <span data-testid="week-empty">기록이 쌓이면 더 보여드려요</span> : undefined}
        note={hero.kind === "insufficient" ? "기록이 쌓이면 원인을 나눠 보여드려요" : undefined}
        contentKey="week"
      />
      {mapped && (
        <CauseBlock
          scope="week"
          mapped={mapped}
          estimatedLabel="예측"
          footer={(records.length > 0 || hasStock) ? (
            <div className="flex flex-wrap items-start justify-between gap-x-3 border-t border-border dark:border-border/40 pt-1">
              {records.length > 0 && <div data-testid="week-records" className="min-w-0 flex-1 has-[[aria-expanded=true]]:basis-full"><AttributionRecordList records={records} /></div>}
              {hasStock && (
                <button
                  type="button"
                  data-testid="week-market-link"
                  data-screenshot-hide
                  aria-label="종목별 등락, 시장과 비교로 이동"
                  onClick={() => {
                    // 뒤로(pop) 때 전체·주로 다시 열리게 현재 history 항목에 싣는다. 시장과 비교 목록 기간은 늘 1주로 열린다(저장 안 함)
                    rememberChangeInit({ scope: "all", period: "week" });
                    navigate({ type: "activity", tab: "change-market" });
                  }}
                  className="ml-auto inline-flex min-h-10 items-center gap-1 text-sm text-muted-foreground hover:text-foreground motion-safe:active:scale-[0.96] transition-[color,transform]"
                >
                  종목 등락 보기
                  <ChevronRight aria-hidden className="size-3.5" />
                </button>
              )}
            </div>
          ) : undefined}
        />
      )}
      {hero.kind !== "empty" && rows.length > 0 && <WeekClosingCard rows={rows} />}
    </>
  );
}

// 날짜별 마감 기록 — 기본 접힘(저장 안 함, 탭을 바꿨다 오면 다시 접힘). 패널은 항상 마운트해 grid-rows로 접고 펼친다
function WeekClosingCard({ rows }: { rows: WeekRow[] }) {
  const [open, setOpen] = useState(false);
  return (
    <section {...(open ? {} : { "data-screenshot-hide": true })} className={`${SECTION} ${BODY_ENTER}`} style={{ animationDelay: "120ms", animationFillMode: "backwards" }}>
      <div>
        <button
          type="button"
          data-testid="week-closing-toggle"
          aria-expanded={open}
          aria-controls="week-list"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-10 w-full items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-transform motion-safe:active:scale-[0.98]"
        >
          <Table2 aria-hidden className="size-5 shrink-0 text-sky-600 dark:text-sky-400" />
          <span className="text-sm sm:text-base font-bold text-foreground">날짜별 마감 기록</span>
          <ChevronDown aria-hidden className={`ml-auto size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
        <div
          id="week-list"
          data-testid="week-list"
          {...(open ? {} : { inert: true, "aria-hidden": true })}
          className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${open ? "grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-2 pt-3">
              <p className="text-sm text-muted-foreground text-pretty break-keep">날짜별 마감 기준이라 위 금액과 조금 다를 수 있어요</p>
              <div className="flex flex-col divide-y divide-border dark:divide-border/40">
                {rows.map((r) => (
                  <div key={r.date} data-testid="week-row" className="flex items-baseline justify-between gap-3 py-2">
                    <span className="min-w-0 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                      {Number(r.date.slice(5, 7))}/{Number(r.date.slice(8, 10))} ({WEEKDAY[new Date(`${r.date}T00:00:00Z`).getUTCDay()]})
                    </span>
                    <span className="ml-auto whitespace-nowrap text-sm font-semibold text-foreground tabular-nums">{formatPriceByMode(r.netAsset)}</span>
                    <span className={`min-w-24 shrink-0 whitespace-nowrap text-right text-sm tabular-nums ${r.diff === null ? "text-muted-foreground" : getProfitLossColor(r.diff)}`}>
                      {r.diff === null ? "-" : `${r.diff >= 0 ? "+" : ""}${formatPriceByMode(r.diff)}`}
                    </span>
                  </div>
                ))}
              </div>
              {rows.length < 7 && <p className="text-sm text-muted-foreground">기록이 쌓이면 더 보여드려요</p>}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
