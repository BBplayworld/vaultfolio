"use client";

// 내 자산 불리기(#239, 5.125 재설계 3차) — 결론 카드 · 기준별 점검 · 종목별 표(+이름표 칩) · 점검 주기.
// 앱은 내 기록에서 나온 사실(손익·보유 기간·분류)만 보여 주고, 종목을 고르거나 권하지 않는다.
//  - 순서는 값과 무관한 고정 순서(묶음: 정해 둔 순서, 표: 오래 가진 순). 수익률·점수 순 정렬 없음
//  - 손익색은 % 숫자·막대와 큰 합계 금액에만. 주황 없음, brand는 '점검 차례' 1곳
//  - 이 화면에서 새로 나가는 요청 0 — 분류는 X-Ray 기기 캐시를 읽기만, 배당은 성과 허브와 같은 쿼리 캐시
//  - 저장 구조(이름표·base·주기) 그대로. 묶음 거르기·탭·펼침은 화면 메모리에만 둔다(새 저장 키 없음)

import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Check, ChevronDown, ChevronRight, List, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import { useAssetData } from "@/contexts/asset-data-context";
import { useStockLabels } from "@/hooks/use-stock-labels";
import { buildLabelBase } from "@/lib/asset/grow-rows";
import {
  BOARD_AXES, HOLD_SCORE_BANDS, SCORE_MIN_DAYS, boardScale, boardTotal, buildAxisGroups, buildBoardRows, nextChecks, scalePos,
  type BoardAxis, type BoardGroup, type BoardRow,
} from "@/lib/asset/grow-board";
import { isStockLabelRevisit, STOCK_LABEL_CYCLES, type StockLabelCycleMonths, type StockLabelKind } from "@/lib/asset/stock-labels";
import { track } from "@/lib/analytics/ga";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { formatShortCurrency } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { useStockPageStore } from "@/stores/stock-page-store";
import { useDividendAnnualTotals } from "./performance-hub";
import { InfoHint } from "../../layout/ui/info-hint";
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
const AXIS_OPTIONS = BOARD_AXES.map((a) => ({ ...a, testId: `grow-axis-${a.value}` }));

// 처음 보이는 행 수 — 점검 차례인 행은 이 수를 넘어도 접지 않는다
const VISIBLE_ROWS = 5;
// 핵심 분야처럼 묶음이 많은 축은 처음 3개만, 나머지는 `그 밖 N개`로 접는다
const VISIBLE_GROUPS = 3;
// `전체 보기` 펼침 여부 — 종목 페이지에 다녀와도 유지, 새로고침하면 접힘(세션 메모리)
let expandedInSession = false;

// 접힘·펼침 공용: 항상 마운트 + grid-rows 0fr↔1fr(연타해도 현재 높이에서 되돌아간다)
const FOLD = "grid ease-out motion-safe:transition-[grid-template-rows]";
const fillTone = (v: number) => (v >= 0 ? "bg-rose-500 dark:bg-rose-400" : "bg-blue-500 dark:bg-blue-400");

/** `+16.7%` / `-3.1%` — 표시 기준(소수 1자리 반올림)이 0이면 부호 없음 */
const pctText = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${(r === 0 ? 0 : r).toFixed(1)}%`;
};
const pctTone = (v: number) => (Math.round(v * 10) === 0 ? "text-muted-foreground" : getProfitLossColor(v));
/** `+231만원` — 축약 금액에 부호 */
const wonText = (v: number) => `${Math.round(v) > 0 ? "+" : ""}${formatShortCurrency(Math.round(v))}`;

/** 0 기준 가로 막대 — 이익은 0에서 오른쪽, 손실은 0에서 왼쪽. 눈금은 화면 전체 공통 */
function ZeroBar({ value, scale, className }: { value: number; scale: { lo: number; hi: number }; className: string }) {
  const a = scalePos(Math.min(0, value), scale);
  const b = scalePos(Math.max(0, value), scale);
  return (
    <span aria-hidden className={`relative block overflow-hidden rounded-full bg-foreground/7 ${className}`}>
      <span className={`absolute inset-y-0 rounded-full ${fillTone(value)} motion-safe:transition-[left,width] motion-safe:duration-300`} style={{ left: `${a}%`, width: `${Math.max(b - a, 0.8)}%` }} />
    </span>
  );
}

// ─── ① 결론 카드 ────────────────────────────────────────────────────

function Conclusion({ count, total, checks }: { count: number; total: ReturnType<typeof boardTotal>; checks: ReturnType<typeof nextChecks> }) {
  const { isLoading, failedCount, annualAtHeldQty } = useDividendAnnualTotals();
  return (
    <section data-testid="grow-total-card" className={SECTION}>
      <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        <span>산 날부터 지금까지 · 내 주식 {count}종목</span>
        <span data-screenshot-hide className="inline-flex">
          <InfoHint summary="지금 가진 종목을 산 날부터 지금까지 손익이에요.">
            <p className="text-pretty break-keep">판 종목은 들어가지 않아요. %는 손익을 산 금액으로 나눈 값이고, 상세 › 주식 &apos;전체&apos;의 손익과 같은 값이에요.</p>
            <p className="text-pretty break-keep">배당은 올해 지급·예정 배당을 지금 가진 수량으로 계산한 가정이에요. 실제로 받는 금액과 다를 수 있어요.</p>
          </InfoHint>
        </span>
      </div>
      {total.priced ? (
        <p data-testid="grow-total" data-profit={Math.round(total.profit)} data-rate={pctText(total.rate)} className={`flex flex-wrap items-baseline gap-x-2 tabular-nums ${pctTone(total.rate)}`}>
          <span className="text-3xl font-bold tracking-tight">{wonText(total.profit)}</span>
          <span className="text-lg font-bold">{pctText(total.rate)}</span>
        </p>
      ) : (
        <p data-testid="grow-total" data-state="unpriced" className="text-sm text-muted-foreground text-pretty break-keep">시세를 불러오면 합계가 보여요.</p>
      )}
      <dl className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 border-t border-border pt-3 text-sm dark:border-border/40">
        <dt className="text-muted-foreground">배당</dt>
        <dd data-testid="grow-next-dividend" className="min-w-0 tabular-nums text-pretty break-keep">
          {isLoading ? (
            <span aria-hidden className={`inline-block h-4 w-32 rounded align-middle ${SKELETON_FILL}`} />
          ) : failedCount > 0 ? (
            <span className="text-muted-foreground">배당 정보를 불러오지 못했어요</span>
          ) : annualAtHeldQty > 0 ? (
            <>1년 약 {formatShortCurrency(annualAtHeldQty)}<span className="ml-1.5 inline-block rounded bg-muted/70 px-1.5 text-xs text-muted-foreground">지금 수량 기준 가정</span></>
          ) : (
            <span className="text-muted-foreground">올해 예정된 배당이 없어요</span>
          )}
        </dd>
        <dt className="text-muted-foreground">점검</dt>
        <dd data-testid="grow-next-check" className="min-w-0 text-pretty break-keep">
          {checks.state !== "list" ? (
            <span className="text-muted-foreground">{checks.state === "no-check" ? "점검할 자산으로 정한 종목이 없어요" : "점검 주기를 정하면 다음 점검일이 보여요"}</span>
          ) : (
            checks.items.map((c, i) => (
              <span key={`${c.name}-${i}`} className="whitespace-nowrap">
                {i > 0 && <span aria-hidden className="text-muted-foreground"> · </span>}
                {c.name} <span className={c.due ? "font-semibold" : "text-muted-foreground"}>{c.when}</span>
              </span>
            ))
          )}
        </dd>
      </dl>
    </section>
  );
}

// ─── ② 기준별 점검 ───────────────────────────────────────────────────

const AXIS_COLS = "grid grid-cols-[6.25rem_minmax(0,1fr)_4.25rem] gap-x-2 max-[359px]:grid-cols-[5.5rem_minmax(0,1fr)_4rem]";

function Axes({ axis, onAxis, groups, totalRate, scale, filterKey, onGroup }: {
  axis: BoardAxis;
  onAxis: (a: BoardAxis) => void;
  groups: BoardGroup[];
  totalRate: number;
  scale: { lo: number; hi: number };
  filterKey: string | null;
  onGroup: (g: BoardGroup) => void;
}) {
  const [moreGroups, setMoreGroups] = useState(false);
  const refPos = scalePos(totalRate, scale);
  const zeroPos = scalePos(0, scale);
  const visible = moreGroups || groups.length <= VISIBLE_GROUPS + 1 ? groups : groups.slice(0, VISIBLE_GROUPS);
  const hidden = groups.length - visible.length;
  const hasUnclassified = groups.some((g) => g.key === "unclassified");
  return (
    <section data-testid="grow-axes" className={SECTION}>
      <SectionHeader icon={BarChart3} title="기준별 점검">
        <span data-screenshot-hide className="inline-flex">
          <InfoHint summary="지금 가진 종목을 기준별로 묶어 산 날부터 지금까지 손익을 나란히 보여 줘요.">
            <p className="text-pretty break-keep">묶음 %는 묶음 손익을 묶음 산 금액으로 나눈 값이에요. 막대는 모든 탭이 같은 눈금이고, 점선은 내 주식 전체의 %예요.</p>
            <p className="text-pretty break-keep">보유 기간은 그 종목을 처음 산 날부터 세요. 핵심 분야·시가총액은 X-Ray와 같은 분류이고 자동 추정이에요. 분류가 아직 없는 종목은 미분류로 보여요.</p>
          </InfoHint>
        </span>
      </SectionHeader>
      <InlineSelector<BoardAxis> fullWidth tight ariaLabel="점검 기준" value={axis} onChange={onAxis} options={AXIS_OPTIONS} className="max-[359px]:[&>button]:text-xs" />
      <div data-testid="grow-groups" data-axis={axis}>
        <div aria-hidden className={`${AXIS_COLS} h-4 text-xs text-muted-foreground`}>
          <span />
          <span className="relative">
            <span className={`absolute tabular-nums ${zeroPos > 0 ? "-translate-x-1/2" : ""}`} style={{ left: `${zeroPos}%` }}>0</span>
            <span data-testid="grow-ref-label" className="absolute -translate-x-1/2 whitespace-nowrap bg-card px-1 font-semibold tabular-nums text-foreground" style={{ left: `${refPos}%` }}>전체 {pctText(totalRate)}</span>
          </span>
          <span />
        </div>
        <ul className="mt-1">
          {visible.map((g) => {
            const on = filterKey === g.key;
            return (
              <li key={g.key} className="border-t border-border first:border-t-0 dark:border-border/40">
                <button
                  type="button"
                  data-testid="grow-group"
                  data-key={g.key}
                  data-rate={pctText(g.rate)}
                  data-profit={Math.round(g.profit)}
                  aria-pressed={on}
                  aria-label={`${g.label} ${g.count}종목 ${pctText(g.rate)} ${wonText(g.profit)}, 누르면 아래 종목을 이 묶음으로 걸러요`}
                  onClick={() => onGroup(g)}
                  className={`${AXIS_COLS} -mx-2 min-h-13 w-[calc(100%+1rem)] items-center rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150 ${on ? "bg-foreground/8" : "hover:bg-muted/40"}`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground text-pretty break-keep">{g.label}</span>
                    <span className="block text-xs text-muted-foreground tabular-nums">{g.count}종목</span>
                  </span>
                  <span className="relative block">
                    <ZeroBar value={g.rate} scale={scale} className="h-2.5" />
                    <span aria-hidden data-testid="grow-ref-line" className="absolute -inset-y-2.5 w-0 border-l-[1.5px] border-dashed border-foreground/55" style={{ left: `${refPos}%` }} />
                  </span>
                  <span className="text-right tabular-nums">
                    <span className={`block text-base font-bold ${pctTone(g.rate)}`}>{pctText(g.rate)}</span>
                    <span className="block text-xs text-muted-foreground">{wonText(g.profit)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {hidden > 0 && (
          <button type="button" data-testid="grow-groups-more" onClick={() => setMoreGroups(true)} className="flex min-h-10 w-full items-center justify-center gap-1 border-t border-border text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border/40">
            그 밖 {hidden}개 <ChevronDown aria-hidden className="size-4" />
          </button>
        )}
        {hasUnclassified && (
          <p data-testid="grow-unclassified-caption" className="mt-2 text-xs text-muted-foreground text-pretty break-keep">X-Ray를 열면 분류가 채워져요.</p>
        )}
      </div>
    </section>
  );
}

// ─── ③ 종목별 표 ────────────────────────────────────────────────────

// 열: 종목·보유 기간 | (1024~) 보유 기간 | 수익률 + 미니 막대 | 손익 | 이름표. 360 미만은 손익을 수익률 칸 둘째 줄로 접는다
const ROW_COLS = "grid grid-cols-[minmax(0,1fr)_3.5rem_3.75rem_4.75rem] max-[359px]:grid-cols-[minmax(0,1fr)_4rem_4.75rem] lg:grid-cols-[minmax(0,1fr)_7rem_6rem_6.5rem_6.75rem]";
const CHIP_TEXT: Record<BoardRow["labelState"], string> = { keep: "오래 둘", check: "점검할", none: "이름표", unset: "이름표" };

/** 보유 기간 · 점수 · 점검 차례 — withHold=false면 보유 기간 없이(1024 열 둘째 줄, testId는 모바일 줄에만) */
function HoldLine({ row, withHold, className }: { row: BoardRow; withHold: boolean; className: string }) {
  const tid = (id: string) => (withHold ? { "data-testid": id } : {});
  const parts: { key: string; node: React.ReactNode }[] = [];
  if (withHold) parts.push({ key: "hold", node: <span className="whitespace-nowrap">{row.holdText}</span> });
  if (row.score.state !== "none") {
    parts.push({
      key: "score",
      node: (
        <span {...tid("grow-row-score")} data-state={row.score.state} data-score={row.score.state === "score" ? row.score.score : ""} className="whitespace-nowrap">
          {row.score.state === "score" ? `${row.score.score}점` : "측정 중"}
        </span>
      ),
    });
  }
  if (row.due) parts.push({ key: "due", node: <span {...tid("grow-row-due")} className="whitespace-nowrap font-semibold text-indigo-600 dark:text-indigo-200">점검 차례</span> });
  if (parts.length === 0) return null;
  return (
    <span className={`flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground tabular-nums ${className}`}>
      {parts.map((p, i) => <span key={p.key} className="contents">{i > 0 && <span aria-hidden>·</span>}{p.node}</span>)}
    </span>
  );
}

function BoardRowItem({ row, scale, open, onToggle, onOpenPage, onLabel, onCheck }: {
  row: BoardRow;
  scale: { lo: number; hi: number };
  open: boolean;
  onToggle: () => void;
  onOpenPage: (row: BoardRow) => void;
  onLabel: (ticker: string, label: StockLabelKind | null) => void;
  onCheck: (ticker: string) => void;
}) {
  const isCheck = row.labelState === "check";
  const panelId = `grow-panel-${row.key}`;
  const caption = [`최근 3개월 매매 ${row.tradeCount}건 · 이 앱 기록`, row.labelFact].filter(Boolean).join(" · ");
  return (
    <li data-testid="grow-row" data-key={row.key} data-ticker={row.labelKey ?? ""} data-label={row.labelState} data-due={row.due ? "true" : "false"} className="border-t border-border first:border-t-0 dark:border-border/40">
      <div className={`${ROW_COLS} min-h-14 items-center`}>
        <button
          type="button"
          data-testid="grow-row-open"
          onClick={() => onOpenPage(row)}
          aria-label={`${row.name} 종목 페이지 보기, 보유 ${row.holdText}, 수익률 ${row.rate === null ? "없음" : pctText(row.rate)}`}
          className="min-h-10 min-w-0 rounded-md py-1.5 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <span className="block min-w-0 truncate text-sm font-semibold text-foreground max-[359px]:whitespace-normal max-[359px]:break-keep">{row.name}</span>
          <HoldLine row={row} withHold className="lg:hidden" />
        </button>
        <span className="hidden flex-col items-end justify-center text-sm tabular-nums lg:flex">
          <span className="whitespace-nowrap">{row.holdText}</span>
          <HoldLine row={row} withHold={false} className="justify-end" />
        </span>
        <span data-testid="grow-row-rate" data-rate={row.rate === null ? "" : pctText(row.rate)} className="flex flex-col items-end justify-center tabular-nums">
          {row.rate === null ? (
            <span className="text-sm text-muted-foreground">—</span>
          ) : (
            <>
              <span className={`text-sm font-bold ${pctTone(row.rate)}`}>{pctText(row.rate)}</span>
              <ZeroBar value={row.rate} scale={scale} className="mt-1 h-1 w-12 max-[359px]:hidden lg:w-18" />
              <span className="hidden text-xs text-muted-foreground max-[359px]:block">{wonText(row.profit)}</span>
            </>
          )}
        </span>
        <span data-testid="grow-row-profit" data-profit={row.priced ? Math.round(row.profit) : ""} className="whitespace-nowrap text-right text-xs text-muted-foreground tabular-nums max-[359px]:hidden">
          {row.priced ? wonText(row.profit) : "—"}
        </span>
        <span className="flex justify-end">
          {row.labelKey && (
            <button
              type="button"
              data-testid="grow-chip"
              aria-expanded={open}
              aria-controls={panelId}
              aria-label={`${row.name} 이름표 ${row.labelState === "keep" ? "오래 둘 자산" : isCheck ? "점검할 자산" : "없음"}, 누르면 고를 수 있어요`}
              onClick={onToggle}
              className={`relative inline-flex h-7 items-center gap-0.5 whitespace-nowrap rounded-full px-2 text-xs outline-none after:absolute after:-inset-x-0.5 after:-inset-y-1.5 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-transform ${
                row.due ? "ring-[1.5px] ring-brand ring-inset" : row.labelState === "keep" || isCheck ? "" : "ring-1 ring-border ring-inset"
              } ${row.labelState === "keep" || isCheck ? "bg-muted/75 font-semibold text-foreground" : "font-medium text-muted-foreground"}`}
            >
              {CHIP_TEXT[row.labelState]}
              <ChevronDown aria-hidden className={`size-3 opacity-80 motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </span>
      </div>
      {row.labelKey && (
        <div id={panelId} {...(open ? {} : { inert: true, "aria-hidden": true })} className={`${FOLD} motion-safe:duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
          <div className="min-h-0 overflow-hidden">
            <div data-testid="grow-panel" className="mb-3 flex flex-col gap-2 rounded-lg bg-foreground/5 p-3">
              <InlineSelector<LabelChoice>
                fullWidth
                tight
                ariaLabel={`${row.name} 이름표`}
                value={row.labelState === "unset" ? null : row.labelState}
                onChange={(v) => onLabel(row.labelKey!, v === "none" ? null : v)}
                options={LABEL_OPTIONS}
                className="max-[359px]:[&>button]:text-xs"
              />
              {isCheck && (
                <Button
                  type="button"
                  variant="secondary"
                  data-testid="grow-check"
                  data-state={row.checkedToday ? "done" : "todo"}
                  aria-label={row.checkedToday ? `${row.name} 오늘 점검함` : `${row.name} 오늘 점검했어요`}
                  aria-disabled={row.checkedToday || undefined}
                  onClick={() => { if (!row.checkedToday) onCheck(row.labelKey!); }}
                  className={`h-10 w-full motion-safe:transition-[color,background-color] motion-safe:duration-150 ${row.checkedToday ? "cursor-default bg-transparent text-muted-foreground hover:bg-transparent active:scale-100!" : ""}`}
                >
                  {row.checkedToday && <Check aria-hidden className="size-4" />}
                  {row.checkedToday ? "오늘 점검함" : "오늘 점검했어요"}
                </Button>
              )}
              <p data-testid="grow-panel-caption" className="text-xs text-muted-foreground tabular-nums text-pretty break-keep">{caption}</p>
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

/** 불리기 블록. 표시할 주식 종목이 없으면 아무것도 그리지 않는다 */
export function StockLabelBlock() {
  const { assetData, exchangeRates } = useAssetData();
  const { navigate } = useAssetNavigation();
  const setStockPageTarget = useStockPageStore((s) => s.setTarget);
  const { labels, ready, setLabel, markChecked, setCycle } = useStockLabels();
  const [now] = useState(() => Date.now());
  const [axis, setAxis] = useState<BoardAxis>("hold");
  const [filter, setFilter] = useState<{ axis: BoardAxis; key: string } | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(() => expandedInSession);
  const [cycleOpen, setCycleOpen] = useState(false);

  const rows = useMemo(
    () => buildBoardRows(assetData.stocks, exchangeRates, labels, now, assetData.transactions ?? []),
    [assetData.stocks, assetData.transactions, exchangeRates, labels, now],
  );
  const total = useMemo(() => boardTotal(assetData.stocks, exchangeRates, rows), [assetData.stocks, exchangeRates, rows]);
  const checks = useMemo(() => nextChecks(rows, labels, now), [rows, labels, now]);
  // 네 축의 묶음을 한 번에 만들어 막대 눈금을 하나로 정한다(탭을 바꿔도 길이 비교 유지)
  const axisGroups = useMemo(
    () => Object.fromEntries(BOARD_AXES.map((a) => [a.value, buildAxisGroups(a.value, rows)])) as Record<BoardAxis, BoardGroup[]>,
    [rows],
  );
  const scale = useMemo(
    () => boardScale([...Object.values(axisGroups).flatMap((gs) => gs.map((g) => g.rate)), ...rows.flatMap((r) => (r.rate === null ? [] : [r.rate]))]),
    [axisGroups, rows],
  );

  // 보조 지표 '다시 봄' — 화면을 연 시점의 저장소 값으로 마운트당 1회. preview 데모는 여기서, 체험은 track 안에서 막는다
  const revisitJudged = useRef(false);
  useEffect(() => {
    if (!ready || revisitJudged.current) return;
    revisitJudged.current = true;
    if (isPreviewEnv()) return;
    if (isStockLabelRevisit(labels, Date.now())) track("feature_use", { category: "grow_revisit" });
  }, [ready, labels]);

  if (!ready || rows.length === 0) return null;

  // 시세 없는 종목이 있거나 1종목뿐이면 기준별 점검을 숨긴다(합계가 틀리거나 비교할 묶음이 없다)
  const showAxes = total.priced && rows.length > 1;
  const activeFilter = filter && showAxes ? axisGroups[filter.axis].find((g) => g.key === filter.key) ?? null : null;
  const filtered = activeFilter ? rows.filter((r) => activeFilter.rowKeys.includes(r.key)) : rows;
  const shown = activeFilter || expanded ? filtered : filtered.filter((r, i) => i < VISIBLE_ROWS || r.due);
  const canFold = !activeFilter && filtered.some((r, i) => i >= VISIBLE_ROWS && !r.due);

  const openStockPage = (row: BoardRow) => {
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
  // 이름표를 붙이는 순간의 기준값(수량·시세·비중)을 함께 저장한다(저장 구조 유지). '정하지 않음'에는 쓰지 않는다
  const onLabel = (ticker: string, label: StockLabelKind | null) =>
    setLabel(ticker, label, label === null ? undefined : buildLabelBase(assetData.stocks, exchangeRates, ticker));
  const onAxis = (a: BoardAxis) => { setAxis(a); setFilter(null); };
  const onGroup = (g: BoardGroup) => setFilter(filter?.axis === axis && filter.key === g.key ? null : { axis, key: g.key });
  const toggleExpanded = () => { expandedInSession = !expanded; setExpanded(!expanded); };

  return (
    <div data-testid="grow-block" className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start">
      <div className="flex min-w-0 flex-col gap-5">
        <Conclusion count={rows.length} total={total} checks={checks} />
        {showAxes && (
          <Axes axis={axis} onAxis={onAxis} groups={axisGroups[axis]} totalRate={total.rate} scale={scale} filterKey={activeFilter && filter?.axis === axis ? activeFilter.key : null} onGroup={onGroup} />
        )}
      </div>

      <section data-testid="grow-list" className={`min-w-0 ${SECTION}`}>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <SectionHeader icon={List} title="종목별" />
          {activeFilter ? (
            <button
              type="button"
              data-testid="grow-filter-chip"
              onClick={() => setFilter(null)}
              aria-label={`${activeFilter.label} 거르기 해제`}
              className="relative inline-flex min-h-7 items-center gap-1 whitespace-nowrap rounded-full bg-foreground/12 px-2.5 text-sm font-semibold outline-none after:absolute after:-inset-y-1.5 after:inset-x-0 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-transform"
            >
              {activeFilter.label} · {activeFilter.count}종목 <X aria-hidden className="size-3.5" />
            </button>
          ) : (
            <span className="whitespace-nowrap text-sm text-muted-foreground">오래 가진 순</span>
          )}
        </div>
        <div>
          <div className={`${ROW_COLS} items-center border-b border-border pb-1.5 text-xs text-muted-foreground dark:border-border/40`}>
            <span className="flex min-w-0 items-center gap-1">
              <span className="truncate">종목<span className="lg:hidden"> · 기간 · 점수</span></span>
              <span data-testid="grow-score-hint" data-screenshot-hide className="inline-flex">
                <InfoHint summary="점수는 보유 기간 대비 성과를 5점 만점으로 매긴 거예요.">
                  <p className="text-pretty break-keep">산 날부터 지금까지 수익률을 1년 기준으로 바꾼 값(연 환산)으로 매겨요. 오래 가진 종목과 최근에 산 종목을 같은 잣대로 보기 위해서예요.</p>
                  <ul className="flex flex-col gap-0.5 tabular-nums">
                    {HOLD_SCORE_BANDS.map((b) => <li key={b.score}>{b.score}점 · {b.text}</li>)}
                  </ul>
                  <p className="text-pretty break-keep">보유가 {Math.round(SCORE_MIN_DAYS / 30.5)}개월이 안 된 종목은 연 환산 값이 크게 흔들려 측정 중으로 보여요. 나눠 산 종목은 처음 산 날부터 세요. 구간은 자산 성적표 &apos;장기 순자산 성장&apos;과 같아요.</p>
                </InfoHint>
              </span>
            </span>
            <span className="hidden text-right lg:block">보유 기간 · 점수</span>
            <span className="text-right">수익률</span>
            <span className="text-right max-[359px]:hidden">손익</span>
            <span className="text-right">이름표</span>
          </div>
          <ul data-testid="grow-rows">
            {shown.map((row) => (
              <BoardRowItem
                key={row.key}
                row={row}
                scale={scale}
                open={openKey === row.key}
                onToggle={() => setOpenKey(openKey === row.key ? null : row.key)}
                onOpenPage={openStockPage}
                onLabel={onLabel}
                onCheck={markChecked}
              />
            ))}
          </ul>
          {canFold && (
            <button
              type="button"
              data-testid="grow-more"
              aria-expanded={expanded}
              onClick={toggleExpanded}
              className="flex min-h-10 w-full items-center justify-center gap-1 border-t border-border text-sm font-medium text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring/50 dark:border-border/40"
            >
              {expanded ? "접기" : "전체 보기"}
              <ChevronDown aria-hidden className={`size-4 motion-safe:transition-transform motion-safe:duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
        {/* ④ 점검 주기 — 목록 끝 설정 줄 1개. 누르면 그 자리에서 3·6·12개월을 고른다 */}
        <div className="border-t border-border dark:border-border/40">
          <button
            type="button"
            data-testid="grow-cycle-row"
            aria-expanded={cycleOpen}
            aria-controls="grow-cycle-panel"
            onClick={() => setCycleOpen(!cycleOpen)}
            className="flex min-h-11 w-full items-center justify-between text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <span>점검 주기</span>
            <span className="inline-flex items-center gap-0.5 text-muted-foreground">
              {labels.cycle.months === null ? "정하지 않음" : `${labels.cycle.months}개월`}
              <ChevronRight aria-hidden className={`size-4 motion-safe:transition-transform motion-safe:duration-200 ${cycleOpen ? "rotate-90" : ""}`} />
            </span>
          </button>
          <div id="grow-cycle-panel" {...(cycleOpen ? {} : { inert: true, "aria-hidden": true })} className={`${FOLD} motion-safe:duration-200 ${cycleOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
            <div className="min-h-0 overflow-hidden">
              <div data-testid="grow-cycle" className="pb-1">
                <InlineSelector<CycleChoice>
                  fullWidth
                  tight
                  ariaLabel="점검 주기"
                  value={labels.cycle.months === null ? null : (`${labels.cycle.months}` as CycleChoice)}
                  onChange={(v) => setCycle(Number(v) as StockLabelCycleMonths)}
                  options={CYCLE_OPTIONS}
                />
                <p data-testid="grow-cycle-caption" className="mt-1.5 text-xs text-muted-foreground text-pretty break-keep">점검할 자산은 내가 정한 주기가 지나면 표에 점검 차례로 보여요.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
