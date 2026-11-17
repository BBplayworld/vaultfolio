"use client";

// 내 자산 불리기(#239, 5.125) — 내 주식 이름표·점검 블록.
// 앱은 내 기록에서 나온 사실(비중·매입가 대비·붙인 날·점검한 날)만 보여 주고, 종목을 나누거나 고르지 않는다.
//  - 모든 행이 같은 형식·같은 색이다. 손익색(빨강/파랑)·주황·경고색을 쓰지 않는다
//  - 순서는 화면에 들어올 때와 주기를 바꿀 때만 다시 정한다(누른 행이 손가락 아래에서 사라지지 않게)
//  - 주기가 지난 행은 접지 않는다. 펼침 여부는 세션 메모리에만 둔다(새 저장 키 없음)

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { useStockLabels } from "@/hooks/use-stock-labels";
import { buildGrowRows, buildLabelBase, collapsedGrowRowKeys, growTotals, sortGrowRowKeys, summarizeGrowRows, type GrowRow, type GrowWeight } from "@/lib/asset/grow-rows";
import { isStockLabelRevisit, STOCK_LABEL_CYCLES, type StockLabelCycleMonths, type StockLabelKind } from "@/lib/asset/stock-labels";
import { track } from "@/lib/analytics/ga";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
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
        {/* 이름표 사실: ① 붙인 날·마지막 점검 → ② 수량 비교(있을 때만) → ③ 주기 경과(언제나 자기 줄).
            ②는 전부 보조색 한 가지 — 늘고 준 방향을 색·굵기·아이콘으로 나타내지 않는다 */}
        <span
          {...(labeled && row.labelFact ? {} : { "aria-hidden": true })}
          className={`${FOLD} motion-safe:duration-200 ${labeled && row.labelFact ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
        >
          <span className="min-h-0 overflow-hidden">
            <span data-testid="grow-row-label-fact" className="mt-0.5 flex flex-col text-sm text-muted-foreground tabular-nums">
              <span className="flex flex-col @min-[33rem]:flex-row @min-[33rem]:gap-x-1.5">
                <span className="whitespace-nowrap">{row.labelFact}</span>
                {row.qtyFact && (
                  <>
                    <span aria-hidden className="hidden @min-[33rem]:inline">·</span>
                    <span data-testid="grow-row-qty" data-state={row.qtyFact.state} className="@min-[33rem]:whitespace-nowrap">
                      {/* 33rem 미만에서는 '→' 앞에서만 줄을 바꾼다 — 긴 소수 수량이 320에서 잘리던 문제(ui-review R-I1). 숫자 조각은 끊지 않는다 */}
                      {row.qtyFact.text.split(" → ").map((part, i) => (
                        <span key={i} className="whitespace-nowrap">{i > 0 ? <>{" "}→ {part}</> : part}</span>
                      ))}
                    </span>
                  </>
                )}
              </span>
              {row.overdueFact && <span data-testid="grow-row-overdue" className="whitespace-nowrap">{row.overdueFact}</span>}
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

// 무게 줄 — 의미색 없이 전경색 투명도 3단(손익색·주황·brand·차트 팔레트 금지). 순서는 항상 오래 둘 → 점검할 → 정하지 않음
const WEIGHT_PARTS = [
  { key: "keep", label: "오래 둘", tone: "bg-foreground/80", lead: "내 주식의 " },
  { key: "check", label: "점검할", tone: "bg-foreground/45", lead: "" },
  { key: "none", label: "정하지 않음", tone: "bg-foreground/15", lead: "" },
] as const;

function WeightSummary({ weights }: { weights: Record<"keep" | "check" | "none", GrowWeight> }) {
  // 시세 없는 종목이 있으면 비중을 낼 수 없다 — 막대 없이 범례만(`N종목 · —`)
  const hasBar = WEIGHT_PARTS.every((p) => weights[p.key].pct !== null);
  return (
    <div data-testid="grow-summary" data-state="labeled">
      {hasBar && (
        <div data-testid="grow-weight-bar" aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {WEIGHT_PARTS.map((p) => {
            const pct = weights[p.key].pct ?? 0;
            return (
              <span
                key={p.key}
                data-testid={`grow-weight-seg-${p.key}`}
                className={`h-full ${p.tone} motion-safe:transition-[width] motion-safe:duration-300 motion-safe:ease-out ${pct > 0 ? "min-w-1" : "hidden"}`}
                style={{ width: `${pct}%` }}
              />
            );
          })}
        </div>
      )}
      <ul className={`flex flex-col gap-y-0.5 text-sm text-muted-foreground tabular-nums @min-[45rem]:flex-row @min-[45rem]:gap-x-4 ${hasBar ? "mt-2" : ""}`}>
        {WEIGHT_PARTS.map((p) => {
          const w = weights[p.key];
          return (
            <li key={p.key} data-testid={`grow-weight-${p.key}`} data-count={w.count} data-pct={w.pctText} className="flex items-center gap-1.5 whitespace-nowrap">
              <span aria-hidden className={`size-2 shrink-0 rounded-full ${p.tone}`} />
              <span>
                {p.label} <span className={FACT_VALUE}>{w.count}종목</span> · {p.lead}<span className={FACT_VALUE}>{w.pctText}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
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
  const summary = useMemo(
    () => summarizeGrowRows(rows, labels, now, growTotals(assetData.stocks, exchangeRates)),
    [rows, labels, now, assetData.stocks, exchangeRates],
  );

  // 보조 지표 '다시 봄' — 화면을 연 시점의 저장소 값으로 마운트당 1회(이 화면에서 방금 붙인 이름표로는 보내지 않는다).
  // 체험은 track 안에서, preview 데모(시드의 붙인 날이 과거다)는 여기서 막는다. 보내는 값은 category뿐
  const revisitJudged = useRef(false);
  useEffect(() => {
    if (!ready || revisitJudged.current) return;
    revisitJudged.current = true;
    if (isPreviewEnv()) return;
    if (isStockLabelRevisit(labels, Date.now())) track("feature_use", { category: "grow_revisit" });
  }, [ready, labels]);

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
  // 이름표를 붙이는 순간의 기준값(수량·시세·비중)을 함께 넘긴다. '정하지 않음'에는 쓰지 않는다
  const onLabel = (ticker: string, label: StockLabelKind | null) =>
    setLabel(ticker, label, label === null ? undefined : buildLabelBase(assetData.stocks, exchangeRates, ticker));
  const rowProps = { onOpen: openStockPage, onLabel, onCheck: markChecked };
  const cycleChosen = labels.cycle.months !== null;
  const labeledAny = summary.keep + summary.check > 0;

  return (
    <section data-testid="grow-block" className={`@container ${SECTION}`}>
      <SectionHeader icon={Tag} title="내 주식 이름표" />

      {/* 요약 자리 — 이름표가 1개 이상이면 무게 줄(막대 + 범례), 0개면 숫자·분류 없이 안내 문장만 */}
      {labeledAny ? (
        <WeightSummary weights={summary.weights} />
      ) : (
        <p data-testid="grow-summary" data-state="empty" className="text-sm text-muted-foreground text-pretty break-keep">이름표를 붙이면 내 주식이 어떻게 나뉘는지 여기에 보여요.</p>
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
        {/* 주기 안내 — 주기를 고르기 전에만. 항상 마운트하고 접는다(목록이 튀지 않게) */}
        <div
          {...(cycleChosen ? { "aria-hidden": true } : {})}
          className={`${FOLD} motion-safe:duration-200 ${cycleChosen ? "grid-rows-[0fr]" : "grid-rows-[1fr]"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <p data-testid="grow-cycle-caption" className="mt-1 text-sm text-muted-foreground text-pretty break-keep">점검할 자산은 내가 정한 주기가 지나면 목록 위쪽에 보여요.</p>
          </div>
        </div>
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
