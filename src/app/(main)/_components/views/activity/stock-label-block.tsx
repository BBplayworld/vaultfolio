"use client";

// 내 자산 불리기(#239, 5.125) — 내 주식 이름표·점검 블록.
// 앱은 내 기록에서 나온 사실(비중·매입가 대비·붙인 날·점검한 날)만 보여 주고, 종목을 나누거나 고르지 않는다.
//  - 모든 행이 같은 형식·같은 색이다. 손익색(빨강/파랑)·주황·경고색을 쓰지 않는다
//  - 순서는 화면에 들어올 때와 주기를 바꿀 때만 다시 정한다(누른 행이 손가락 아래에서 사라지지 않게)
//  - 주기가 지난 행은 접지 않는다. 펼침 여부는 세션 메모리에만 둔다(새 저장 키 없음)

import { useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { useStockLabels } from "@/hooks/use-stock-labels";
import { buildGrowRows, collapsedGrowRowKeys, sortGrowRowKeys, summarizeGrowRows, type GrowRow } from "@/lib/asset/grow-rows";
import { STOCK_LABEL_CYCLES, type StockLabelCycleMonths, type StockLabelKind } from "@/lib/asset/stock-labels";
import { useStockPageStore } from "@/stores/stock-page-store";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { SECTION, SectionHeader } from "../../layout/ui/report-section";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";

type LabelChoice = StockLabelKind | "none";
const LABEL_OPTIONS: readonly { value: LabelChoice; label: string; testId: string }[] = [
  { value: "keep", label: "오래 둘 자산", testId: "grow-label-keep" },
  { value: "check", label: "점검할 자산", testId: "grow-label-check" },
  { value: "none", label: "정하지 않음", testId: "grow-label-none" },
];
type CycleChoice = `${StockLabelCycleMonths}`;
const CYCLE_OPTIONS: readonly { value: CycleChoice; label: string; testId: string }[] = STOCK_LABEL_CYCLES.map((m) => ({
  value: `${m}` as CycleChoice, label: `${m}개월`, testId: `grow-cycle-${m}`,
}));

// 처음 보이는 행 수(대표 예외) — 주기가 지난 행은 이 수를 넘어도 접지 않는다
const VISIBLE_ROWS = 3;
// `전체 보기` 펼침 여부 — 종목 페이지에 다녀와도 유지, 새로고침하면 접힘(세션 메모리)
let expandedInSession = false;

const FACT_VALUE = "font-semibold text-foreground";
// 접힘·펼침 공용: 항상 마운트 + grid-rows 0fr↔1fr(연타해도 현재 높이에서 되돌아간다)
const FOLD = "grid ease-out motion-safe:transition-[grid-template-rows]";

function StockLabelRow({ row, onOpen, onLabel, onCheck }: {
  row: GrowRow;
  onOpen: (row: GrowRow) => void;
  onLabel: (ticker: string, label: StockLabelKind | null) => void;
  onCheck: (ticker: string) => void;
}) {
  const labeled = row.labelState === "keep" || row.labelState === "check";
  const isCheck = row.labelState === "check";
  return (
    <li
      data-testid="grow-row"
      data-ticker={row.ticker}
      data-label={row.labelState}
      data-overdue={row.overdueFact ? "true" : "false"}
      className="border-t border-border py-3 dark:border-border/40 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-x-4"
    >
      {/* 이름·사실 줄 — 줄 전체가 종목 페이지 입구(행당 1개). 줄 수는 내용이 아니라 폭으로 정한다(@container) */}
      <button
        type="button"
        data-testid="grow-row-open"
        onClick={() => onOpen(row)}
        aria-label={`${row.name} 종목 페이지 보기, 내 주식의 ${row.weightText}, 내 매입가 대비 ${row.rateText}`}
        className="@container block min-h-10 w-full min-w-0 rounded-md text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150"
      >
        <span className="flex items-center gap-1">
          <span className="min-w-0 truncate text-sm font-bold text-foreground md:text-base">{row.name}</span>
          <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </span>
        <span data-testid="grow-row-fact" className="mt-0.5 flex flex-col text-sm text-muted-foreground tabular-nums @min-[20rem]:flex-row @min-[20rem]:gap-x-1.5">
          <span className="whitespace-nowrap">내 주식의 <span className={FACT_VALUE}>{row.weightText}</span></span>
          <span aria-hidden className="hidden @min-[20rem]:inline">·</span>
          <span className="whitespace-nowrap">내 매입가 대비 <span className={FACT_VALUE}>{row.rateText}</span></span>
        </span>
        <span
          {...(labeled && row.labelFact ? {} : { "aria-hidden": true })}
          className={`${FOLD} motion-safe:duration-200 ${labeled && row.labelFact ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <span className="min-h-0 overflow-hidden">
            <span data-testid="grow-row-label-fact" className="mt-0.5 flex flex-col text-sm text-muted-foreground tabular-nums @min-[27rem]:flex-row @min-[27rem]:gap-x-1.5">
              <span className="whitespace-nowrap">{row.labelFact}</span>
              {row.overdueFact && (
                <>
                  <span aria-hidden className="hidden @min-[27rem]:inline">·</span>
                  <span className="whitespace-nowrap">{row.overdueFact}</span>
                </>
              )}
            </span>
          </span>
        </span>
      </button>

      <div className="mt-2 min-w-0 lg:mt-0">
        <div data-testid="grow-label">
          <InlineSelector<LabelChoice>
            fullWidth
            tight
            ariaLabel={`${row.name} 이름표`}
            value={row.labelState === "unset" ? null : row.labelState}
            onChange={(v) => onLabel(row.ticker, v === "none" ? null : v)}
            options={LABEL_OPTIONS}
            className="max-[359px]:[&>button]:text-xs"
          />
        </div>
        {/* 점검 버튼 — '점검할 자산' 행만 열린다. 누른 뒤에도 같은 요소(포커스·높이 유지) */}
        <div
          {...(isCheck ? {} : { inert: true, "aria-hidden": true })}
          className={`${FOLD} motion-safe:duration-200 ${isCheck ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <Button
              type="button"
              variant="secondary"
              data-testid="grow-check"
              data-state={row.checkedToday ? "done" : "todo"}
              aria-label={row.checkedToday ? `${row.name} 오늘 점검함` : `${row.name} 오늘 점검했어요`}
              aria-disabled={row.checkedToday || undefined}
              onClick={() => { if (!row.checkedToday) onCheck(row.ticker); }}
              className={`mt-2 h-10 w-full motion-safe:transition-[color,background-color] motion-safe:duration-150 ${row.checkedToday ? "cursor-default bg-transparent text-muted-foreground hover:bg-transparent active:scale-100!" : ""}`}
            >
              {row.checkedToday && <Check aria-hidden className="size-4" />}
              {row.checkedToday ? "오늘 점검함" : "오늘 점검했어요"}
            </Button>
          </div>
        </div>
      </div>
    </li>
  );
}

/** 이름표·점검 블록. 표시할 주식 종목(티커 있는 종목)이 없으면 아무것도 그리지 않는다 */
export function StockLabelBlock() {
  const { assetData, exchangeRates } = useAssetData();
  const { navigate } = useAssetNavigation();
  const setStockPageTarget = useStockPageStore((s) => s.setTarget);
  const { labels, ready, setLabel, markChecked, setCycle } = useStockLabels();
  const [now] = useState(() => Date.now());
  const [expanded, setExpanded] = useState(() => expandedInSession);

  const rows = useMemo(() => buildGrowRows(assetData.stocks, exchangeRates, labels, now), [assetData.stocks, exchangeRates, labels, now]);
  const summary = useMemo(() => summarizeGrowRows(rows, labels, now), [rows, labels, now]);

  // 순서·접힘 대상은 화면 진입(첫 계산)과 주기 변경 때만 다시 정한다 — 이름표를 바꾸거나 점검을 눌러도 그대로
  const layoutKey = `${labels.cycle.months}`;
  const [layout, setLayout] = useState<{ key: string; order: string[]; collapsed: string[] } | null>(null);
  if (ready && rows.length > 0 && layout?.key !== layoutKey) {
    const byKey = new Map(rows.map((r) => [r.key, r]));
    const order = sortGrowRowKeys(rows);
    setLayout({ key: layoutKey, order, collapsed: collapsedGrowRowKeys(order.map((k) => byKey.get(k)!), VISIBLE_ROWS) });
  }

  if (!ready || rows.length === 0 || !layout) return null;

  const byKey = new Map(rows.map((r) => [r.key, r]));
  const known = new Set(layout.order);
  // 정해 둔 순서 뒤에, 그 뒤 새로 생긴 종목(다른 기기에서 추가 등)을 비중 순으로 붙인다
  const ordered = [...layout.order.flatMap((k) => byKey.get(k) ?? []), ...rows.filter((r) => !known.has(r.key))];
  const collapsedSet = new Set(layout.collapsed);
  const shown = ordered.filter((r) => !collapsedSet.has(r.key));
  const rest = ordered.filter((r) => collapsedSet.has(r.key));

  const openStockPage = (row: GrowRow) => {
    setStockPageTarget({
      groupStockIds: row.groupStockIds,
      name: row.name,
      ticker: row.rawTicker,
      category: row.category,
      displayCurrency: "KRW",
      origin: "market-compare", // 뒤로 = 들어온 화면으로(pop) — 시장 비교와 같은 동작을 그대로 쓴다
    });
    navigate({ type: "detail", tab: "stocks-item" });
  };
  const toggleExpanded = () => {
    expandedInSession = !expanded;
    setExpanded(!expanded);
  };
  const rowProps = { onOpen: openStockPage, onLabel: setLabel, onCheck: markChecked };
  const labeledAny = summary.keep + summary.check > 0;

  return (
    <section data-testid="grow-block" className={SECTION}>
      <SectionHeader icon={Tag} title="내 주식 이름표" />

      {/* 요약 자리 — 이름표가 1개 이상일 때만 사용자가 붙인 개수를 보여 준다(0개면 숫자·분류 없음) */}
      {labeledAny ? (
        <p data-testid="grow-summary" data-state="labeled" className="flex flex-wrap gap-x-1.5 text-sm text-muted-foreground tabular-nums">
          <span className="whitespace-nowrap">오래 둘 <span className={FACT_VALUE}>{summary.keep}</span></span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">점검할 <span className={FACT_VALUE}>{summary.check}</span></span>
          <span aria-hidden>·</span>
          <span className="whitespace-nowrap">정하지 않음 <span className={FACT_VALUE}>{summary.none}</span></span>
        </p>
      ) : (
        <p data-testid="grow-summary" data-state="empty" className="text-sm text-muted-foreground">종목마다 내가 이름표를 붙여요.</p>
      )}

      <div>
        <div className="flex min-h-10 items-center justify-between gap-3">
          <span className="shrink-0 text-sm font-semibold text-foreground">점검 주기</span>
          <div data-testid="grow-cycle" className="min-w-0 max-w-[216px] flex-1">
            <InlineSelector<CycleChoice>
              fullWidth
              tight
              ariaLabel="점검 주기"
              value={labels.cycle.months === null ? null : (`${labels.cycle.months}` as CycleChoice)}
              onChange={(v) => setCycle(Number(v) as StockLabelCycleMonths)}
              options={CYCLE_OPTIONS}
            />
          </div>
        </div>
        <p className="mt-1 text-sm text-muted-foreground text-pretty break-keep">점검할 자산은 내가 정한 주기가 지나면 목록 위쪽에 보여요.</p>
      </div>

      <div>
        <ul>
          {shown.map((row) => <StockLabelRow key={row.key} row={row} {...rowProps} />)}
        </ul>
        {rest.length > 0 && (
          <>
            <div
              id="grow-rows-rest"
              data-testid="grow-rows-rest"
              {...(expanded ? {} : { inert: true, "aria-hidden": true })}
              className={`${FOLD} motion-safe:duration-300 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
            >
              <ul className="min-h-0 overflow-hidden">
                {rest.map((row) => <StockLabelRow key={row.key} row={row} {...rowProps} />)}
              </ul>
            </div>
            <button
              type="button"
              data-testid="grow-more"
              aria-expanded={expanded}
              aria-controls="grow-rows-rest"
              onClick={toggleExpanded}
              className="flex min-h-10 w-full items-center justify-center gap-1 border-t border-border text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border/40"
            >
              {expanded ? "접기" : "전체 보기"}
              <ChevronDown aria-hidden className={`size-4 motion-safe:transition-transform motion-safe:duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
