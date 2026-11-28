"use client";

import { Badge } from "@/components/ui/badge";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatCurrency } from "@/lib/number-utils";
import { ASSET_THEME, MAIN_PALETTE } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { DividendFrequency } from "@/lib/finance/finance-service";
import { latestPerSharePayout, type DividendCalcResult, type DividendMonthState } from "@/lib/finance/dividend-calc";
import { kstTodayString } from "@/lib/asset/import-inherit";
import type { Stock } from "@/types/asset";
import type { DividendGroup } from "./use-dividend-data";

const FREQUENCY_LABEL: Record<DividendFrequency, string> = {
  annual: "연간",
  semiannual: "반기",
  quarterly: "분기",
  monthly: "월배당",
};

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

const CATEGORY_GROUPS = [
  { key: "domestic", label: "국내주식", color: MAIN_PALETTE[3] },
  { key: "foreign", label: "해외주식", color: MAIN_PALETTE[5] },
  { key: "irp", label: "IRP", color: MAIN_PALETTE[6] },
  { key: "isa", label: "ISA", color: MAIN_PALETTE[4] },
  { key: "pension", label: "연금저축", color: MAIN_PALETTE[7] },
] as const;

/** 배당월 배지 상태(#377) — 진함 = 지급, 점선 = 예상, 테두리 없음 = 보유 전(그때 보유 0) */
type MonthChipState = "paid" | "expected" | "inactive";
const CHIP_STATES: readonly MonthChipState[] = ["paid", "expected", "inactive"];
const CHIP_SR_SUFFIX: Record<MonthChipState, string> = { paid: " 지급", expected: " 예상", inactive: " 보유 전, 0원" };
const LEGEND_LABEL: Record<MonthChipState, string> = { paid: "지급", expected: "예상", inactive: "보유 전" };

// 모양만으로 구분(흑백·색맹): 지급 = 채운 면, 예상 = 점선 테두리, 보유 전 = 테두리 없음. 선택된 달은 색만 brand로 짙어진다(ui.md 2절)
const CHIP_SHAPE: Record<MonthChipState, string> = {
  paid: "bg-brand/15 dark:bg-brand/25 border-brand text-foreground dark:text-indigo-300 font-semibold",
  expected: "bg-transparent border-dashed border-muted-foreground text-muted-foreground font-medium",
  inactive: "bg-transparent border-transparent text-muted-foreground dark:text-muted-foreground/70 font-normal",
};
const CHIP_SELECTED: Record<MonthChipState, string> = {
  paid: "bg-brand border-brand text-brand-foreground font-semibold",
  expected: "bg-transparent border-dashed border-brand text-indigo-600 dark:text-indigo-300 font-semibold",
  inactive: CHIP_SHAPE.inactive,
};
const CHIP_MOTION = "cursor-default transition-[color,background-color,border-color,box-shadow] motion-safe:duration-150 motion-reduce:transition-none";

interface StockDividendRow {
  stock: Stock;
  /** 월 오름차순(상태 무관) — 검산 경로(진한 달 합 = 지급, 점선 달 합 = 올해 합계 − 지급)를 시간순으로 읽는다 */
  chips: Array<{ month: number; state: MonthChipState }>;
  payoutMonths: number[];
  perShareForeign: number;
  perShareKRW: number;
  currency: string;
  annualTotal: number;
  annualForeign: number;
  annualActual: number;
  annualForeignActual: number;
  monthlyTotal: number;
  monthlyForeign: number;
  monthlyActual: number;
  monthlyForeignActual: number;
  frequency?: DividendFrequency;
}

interface Props {
  selectedMonth: number | undefined;
  /** 배당 차트와 같은 공용 훅 결과 — 표는 재계산하지 않고 종목별 값(calc.byStock)만 표시한다(#313) */
  groups: DividendGroup[];
  calc: DividendCalcResult;
}

const monthsIn = (state: DividendMonthState[], want: DividendMonthState) =>
  state.flatMap((st, i) => (st === want ? [i + 1] : []));
const cents = (v: number) => Math.round(v * 100) / 100;

export function MonthlyDividendStocks({ selectedMonth, groups, calc }: Props) {
  const { exchangeRates } = useAssetData();
  const usdRate = exchangeRates.USD;
  const todayKst = kstTodayString();

  const rows: StockDividendRow[] = groups
    .map(({ key, stock, payouts }): StockDividendRow | null => {
      const d = calc.byStock.get(key);
      if (!d || payouts.length === 0) return null;
      const firstPayout = d.firstPayout ?? payouts[0];
      // 최근 1주당(#377): 지난 달 추정을 뺀 확정 회차 중 가장 늦은 1건(서버 예상 금액과 같은 회차)
      const perShare = latestPerSharePayout(payouts, todayKst) ?? firstPayout;
      const currency = stock.currency === "USD" ? "USD" : "KRW";
      const rate = currency === "USD" ? usdRate : 1;
      // 배당월 배지: 그 달이 모두 지급이면 paid, 하나라도 예상이면 expected, 그때 보유 0이면 inactive. 글자는 모두 `N월`
      const actualMonths = monthsIn(d.monthState, "paid");
      const estimatedMonths = monthsIn(d.monthState, "expected");
      const chips = d.monthState
        .map((st, i) => ({ month: i + 1, state: st }))
        .filter((c): c is { month: number; state: MonthChipState } => c.state !== "none");
      const m = selectedMonth !== undefined ? selectedMonth - 1 : -1;
      return {
        stock,
        chips,
        payoutMonths: [...actualMonths, ...estimatedMonths].sort((a, b) => a - b),
        perShareForeign: currency === "USD" ? (perShare.amountForeign ?? perShare.amountPerShare) : 0,
        perShareKRW: Math.round(perShare.amountPerShare * rate),
        currency,
        annualTotal: Math.round(d.paid + d.expected),
        annualForeign: cents(d.paidForeign + d.expectedForeign),
        annualActual: Math.round(d.paid),
        annualForeignActual: cents(d.paidForeign),
        monthlyTotal: m >= 0 ? Math.round(d.perMonth.paid[m] + d.perMonth.expected[m]) : 0,
        monthlyForeign: m >= 0 ? cents(d.perMonth.paidForeign[m] + d.perMonth.expectedForeign[m]) : 0,
        monthlyActual: m >= 0 ? Math.round(d.perMonth.paid[m]) : 0,
        monthlyForeignActual: m >= 0 ? cents(d.perMonth.paidForeign[m]) : 0,
        frequency: firstPayout.frequency,
      };
    })
    .filter((r): r is StockDividendRow => r !== null);

  const grouped = CATEGORY_GROUPS.map(({ key, label, color }) => {
    const items = rows.filter((r) => r.stock.category === key);
    const filtered = selectedMonth !== undefined
      ? items.filter((r) => r.payoutMonths.includes(selectedMonth))
      : items;
    return { key, label, color, filtered };
  }).filter(({ filtered }) => filtered.length > 0);

  // 배당월 범례(#377): 보이는 행에 있는 배지 상태만, 2개 이상일 때만(C170 — 기록할수록 숨는 역전 없음)
  const shownStates = new Set(grouped.flatMap(({ filtered }) => filtered.flatMap((r) => r.chips.map((c) => c.state))));
  const legendStates = CHIP_STATES.filter((st) => shownStates.has(st));

  if (grouped.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-3">
        {selectedMonth !== undefined ? `${selectedMonth}월 배당 종목이 없습니다.` : "배당 데이터가 없습니다."}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {legendStates.length >= 2 && (
        <div role="list" aria-label="배당월 표시" data-testid="dividend-month-legend" className="flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
          {legendStates.map((st) => (
            <Badge
              key={st}
              role="listitem"
              variant="outline"
              data-testid={`dividend-legend-${st}`}
              className={`h-5 px-1.5 text-xs whitespace-nowrap cursor-default ${CHIP_SHAPE[st]}`}
            >
              {LEGEND_LABEL[st]}
            </Badge>
          ))}
        </div>
      )}
      {grouped.map(({ key, label, color, filtered }) => (
        <div key={key} className="rounded-lg border overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30 border-b">
            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-semibold text-muted-foreground">{label}</span>
          </div>
          {/* 640px 미만(sm 미만)은 행 2단(#326·#332): 1단 이름·메타·배당월 칩 전폭, 2단 주당|지급|합계 3열. DOM 한 벌, 배치만 바꾼다(640 이상 불변).
              접두는 `max-sm:`(폭 < 40rem), `sm:`와 정확히 맞물린다 */}
          <div role="table" aria-label={`${label} 배당 종목`} data-testid="dividend-table" data-category={key}>
          <div role="row" className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_11.5rem_4.75rem_5.5rem_5.5rem] lg:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-1 sm:gap-x-2 lg:gap-x-3 px-2 sm:px-3 py-2 bg-muted/50 text-xs whitespace-nowrap text-muted-foreground border-b max-sm:grid-cols-[minmax(0,1fr)_5rem_5.5rem] max-sm:gap-x-2">
            {/* 320~359: 종목명 머리는 sr-only(최근 1주당과 겹침 방지, 행 첫 줄 이름이 열 뜻을 대신) */}
            <span role="columnheader" className="max-sm:col-start-1 max-sm:row-start-1 max-[360px]:sr-only">종목명</span>
            <span role="columnheader" data-testid="dividend-col-months" className="text-right max-sm:sr-only">배당월</span>
            <span role="columnheader" data-testid="dividend-col-pershare" className="text-right max-sm:col-start-1 max-sm:row-start-1">최근 1주당</span>
            <span role="columnheader" data-testid="dividend-col-paid" className="text-right">{selectedMonth !== undefined ? `${selectedMonth}월 지급` : "지급"}</span>
            <span role="columnheader" data-testid="dividend-col-total" className="text-right">{selectedMonth !== undefined ? `${selectedMonth}월 합계` : "올해 합계"}</span>
          </div>
          <div role="rowgroup" className="divide-y">
            {filtered.map(({ stock, chips, perShareForeign, perShareKRW, currency, annualTotal, annualForeign, annualActual, annualForeignActual, monthlyTotal, monthlyForeign, monthlyActual, monthlyForeignActual, frequency }) => {
              const ticker = normalizeTicker(stock);
              const isDomestic = DOMESTIC_CATEGORIES.has(stock.category);
              const displayTotal = selectedMonth !== undefined ? monthlyTotal : annualTotal;
              const displayForeign = selectedMonth !== undefined ? monthlyForeign : annualForeign;
              const displayActual = selectedMonth !== undefined ? monthlyActual : annualActual;
              const displayForeignActual = selectedMonth !== undefined ? monthlyForeignActual : annualForeignActual;
              return (
                <div
                  key={stock.id}
                  role="row"
                  className="grid grid-cols-[minmax(0,1fr)_3.25rem_3.5rem_3.5rem_3.5rem] sm:grid-cols-[minmax(0,1fr)_11.5rem_4.75rem_5.5rem_5.5rem] lg:grid-cols-[1fr_16rem_6rem_7rem_7rem] gap-x-1 sm:gap-x-2 lg:gap-x-3 px-2 sm:px-3 py-2.5 items-center max-sm:grid-cols-[minmax(0,1fr)_5rem_5.5rem] max-sm:gap-x-2 max-sm:gap-y-2 max-sm:items-start"
                  data-testid="dividend-stock-row"
                >
                  <div role="cell" className="min-w-0 max-sm:col-span-3 max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-1.5">
                    <div className="flex items-center gap-1 max-sm:basis-full max-sm:min-w-0">
                      <p data-testid="dividend-stock-name" className="text-sm font-semibold truncate max-sm:whitespace-normal max-sm:line-clamp-2 max-sm:break-keep max-sm:[overflow-wrap:anywhere]">{stock.name || ticker}</p>
                      {frequency && (
                        <Badge className={`hidden md:inline-flex ${ASSET_THEME.categoryBox} text-xs px-1 py-0 h-4 md:h-5 shrink-0`}>
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      )}
                    </div>
                    {frequency && (
                      <div data-testid="dividend-stock-meta" className="flex shrink-0 items-center gap-x-1 md:hidden mt-0.5">
                        <Badge className={`${ASSET_THEME.categoryBox} text-xs px-1 py-0 h-4 shrink-0`}>
                          {FREQUENCY_LABEL[frequency]}
                        </Badge>
                      </div>
                    )}
                    {stock.purchaseDate && <p data-testid="dividend-stock-purchase" className="text-xs text-muted-foreground mt-1 max-sm:mt-0.5 max-sm:whitespace-nowrap max-sm:tabular-nums">매수 {stock.purchaseDate}</p>}
                  </div>
                  <div role="cell" data-testid="dividend-stock-months" className="flex flex-wrap gap-1 sm:gap-1.5 justify-end max-sm:col-span-3 max-sm:justify-start">
                    {chips.map(({ month, state }) => {
                      const selected = month === selectedMonth && state !== "inactive";
                      return (
                        <Badge
                          key={`m-${month}`}
                          variant="outline"
                          data-testid="dividend-month-chip"
                          data-state={state}
                          data-selected={selected ? "true" : undefined}
                          className={`h-6 px-2 py-0.5 text-xs tabular-nums ${CHIP_MOTION} ${selected ? CHIP_SELECTED[state] : CHIP_SHAPE[state]}`}
                        >
                          {month}월<span className="sr-only">{CHIP_SR_SUFFIX[state]}</span>
                        </Badge>
                      );
                    })}
                  </div>
                  <div role="cell" data-testid="dividend-stock-pershare" className="text-right max-sm:whitespace-nowrap">
                    {!isDomestic && currency === "USD" ? (
                      <>
                        <p className="text-xs tabular-nums" style={{ color: MAIN_PALETTE[10] }}>${perShareForeign.toFixed(4)}</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{perShareKRW.toLocaleString()}원</p>
                      </>
                    ) : (
                      <p className="text-xs tabular-nums" style={{ color: MAIN_PALETTE[10] }}>{perShareKRW.toLocaleString()}원</p>
                    )}
                    <p className="text-xs tabular-nums break-keep text-muted-foreground">지금 {stock.quantity}주</p>
                  </div>
                  <div role="cell" data-testid="dividend-cell-paid" className="text-right whitespace-nowrap max-sm:flex max-sm:flex-col max-sm:items-end">
                    {!isDomestic && currency === "USD" && displayForeignActual > 0 && (
                      <p className="text-xs tabular-nums text-muted-foreground">${displayForeignActual.toFixed(2)}</p>
                    )}
                    {/* 2단(640 미만)에서 외화 지급이 0이면 첫 줄 자리를 채워 `-`를 합계의 원화 줄과 같은 높이에 둔다 */}
                    {!isDomestic && currency === "USD" && !(displayForeignActual > 0) && (
                      <p aria-hidden className="text-xs sm:hidden">&nbsp;</p>
                    )}
                    <p data-testid="dividend-paid-amount" className="text-xs xl:text-sm font-bold tabular-nums text-foreground">
                      {displayActual > 0 ? formatCurrency(displayActual) : <span className="text-muted-foreground">-</span>}
                    </p>
                  </div>
                  <div role="cell" data-testid="dividend-cell-total" className="text-right whitespace-nowrap max-sm:flex max-sm:flex-col max-sm:items-end">
                    {!isDomestic && currency === "USD" && (
                      <p className="text-xs tabular-nums text-muted-foreground ">${displayForeign.toFixed(2)}</p>
                    )}
                    <p data-testid="dividend-est-amount" className={`text-xs xl:text-sm font-bold tabular-nums ${ASSET_THEME.text.default}`}>
                      {formatCurrency(displayTotal)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        </div>
      ))}
    </div>
  );
}
