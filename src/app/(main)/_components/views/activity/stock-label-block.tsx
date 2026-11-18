"use client";

// 자산 성적표·불리기(#239, 5.125 재설계 6차)의 내 자산 점검 칸 — ① 종합 카드(평단 대비 수익 · 라벨 행 · 기준 4칸 + 막대 패널) ② 내 종목(장기 보유·점검 대상·정하지 않음 묶음 + 점검 한 장).
// #242(5.127): 보기 3종(주식 / 코인 / 부동산·실물)을 종류 줄로 바꾼다. 코인은 주식과 같은 카드·행·조건, 부동산·실물은 카드·막대·점수·±% 조건 없이 목록 + 값 구획.
//  카드 넷째 라벨 행 `내 선택`(grow-pick.ts)과 펼침 패널은 주식·코인 보기에만 있다. 새 요소는 grow-pick-panel.tsx
// 앱은 내 기록에서 나온 사실(손익·보유 기간·분류)과 내가 정한 조건만 보여 주고, 종목을 고르거나 권하지 않는다.
//  - 묶음은 오래 둘 → 점검할 → 아직 안 정함 고정. 묶음 안은 점검 차례 → 오래 가진 순(화면에 들어올 때 한 번 정함). 수익률·점수 순 없음
//  - 손익색은 % 숫자·막대와 큰 합계 금액에만. 주황 없음, brand 계열은 '점검 차례' 글자에만
//  - 이 화면에서 새로 나가는 요청 0 — 분류는 X-Ray 기기 캐시를 읽기만, 배당은 성과 허브와 같은 쿼리 캐시
//  - 메모는 점검 한 장의 입력 칸 안에서만 보인다(요약 줄·카드·허브에는 '메모' 표시만). 캡처 숨김, 링크로 바꾸지 않는다
//  - 기준 4칸·펼침·거르기는 화면 메모리에만 둔다(새 저장 키 없음)

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, ChevronRight, List, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SKELETON_FILL } from "@/components/ui/skeleton";
import { useAssetData } from "@/contexts/asset-data-context";
import { useStockLabels } from "@/hooks/use-stock-labels";
import { buildLabelBase } from "@/lib/asset/grow-rows";
import { buildCryptoLabelBase, buildGrowBoards, cryptoTotal, firstGrowView, heldViews, ownSnap, viewHasDue, type GrowView } from "@/lib/asset/grow-kinds";
import { computePick, cryptoPickInput, pickAfterOf, stockPickInput } from "@/lib/asset/grow-pick";
import {
  BOARD_AXES, BOARD_BUCKETS, HOLD_SCORE_BANDS, SCORE_MIN_DAYS, addMonthsKst, boardRowRank, boardScale, boardSummary, boardTotal, bucketOf,
  buildAxisGroups, checkMonthsOf, dueReasonText, hitOf, monthDayText, nextCheckDateText, scalePos,
  type BoardAxis, type BoardBucket, type BoardGroup, type BoardRow, type BoardSummary,
} from "@/lib/asset/grow-board";
import {
  cleanStockPlan, isStockLabelRevisit, reviewsOf, STOCK_LABEL_CYCLES, STOCK_PLAN_MEMO_MAX, STOCK_PLAN_RANGE,
  type StockLabelCycleMonths, type StockLabelPlan, type StockLabelReview, type StockLabels, type StockReviewChoice,
} from "@/lib/asset/stock-labels";
import { track } from "@/lib/analytics/ga";
import { isPreviewEnv } from "@/lib/cloud-sync/config";
import { formatShortCurrency } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { useStockPageStore } from "@/stores/stock-page-store";
import { useCryptoTxViewStore } from "@/stores/crypto-tx-view-store";
import { GrowKindTabs, OwnValueBox, PICK_FILTER_LABEL, PickLine, PickPanel, type PickFilter } from "./grow-pick-panel";
import { getGrowView, setGrowView } from "./report-tab";
import { useDividendAnnualTotals } from "./performance-hub";
import { InfoHint } from "../../layout/ui/info-hint";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { SECTION, SectionHeader } from "../../layout/ui/report-section";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";

type CycleChoice = `${StockLabelCycleMonths}`;
const CYCLE_OPTIONS: readonly { value: CycleChoice; label: string; testId: string }[] = STOCK_LABEL_CYCLES.map((m) => ({
  value: `${m}` as CycleChoice, label: `${m}개월`, testId: `grow-cycle-${m}`,
}));

// 핵심 분야처럼 묶음이 많은 축은 처음 3개만, 나머지는 `그 밖 N개`로 접는다
const VISIBLE_GROUPS = 3;

// 접힘·펼침 공용: 항상 마운트 + grid-rows 0fr↔1fr(연타해도 현재 높이에서 되돌아간다)
const FOLD = "grid ease-out motion-safe:transition-[grid-template-rows]";
const fillTone = (v: number) => (v >= 0 ? "bg-rose-500 dark:bg-rose-400" : "bg-blue-500 dark:bg-blue-400");
const DUE_TEXT = "font-semibold text-indigo-600 dark:text-indigo-200";

/** `+16.7%` / `-3.1%` — 표시 기준(소수 1자리 반올림)이 0이면 부호 없음 */
const pctText = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return `${r > 0 ? "+" : ""}${(r === 0 ? 0 : r).toFixed(1)}%`;
};
const pctTone = (v: number) => (Math.round(v * 10) === 0 ? "text-muted-foreground" : getProfitLossColor(v));
/** `+231만원` — 축약 금액에 부호 */
const wonText = (v: number) => `${Math.round(v) > 0 ? "+" : ""}${formatShortCurrency(Math.round(v))}`;

/** 0 기준 가로 막대 — 이익은 0에서 오른쪽, 손실은 0에서 왼쪽. 눈금은 화면 전체 공통 */
function ZeroBar({ value, scale, className, fill, zeroTick = false }: { value: number; scale: { lo: number; hi: number }; className: string; fill?: string; zeroTick?: boolean }) {
  const a = scalePos(Math.min(0, value), scale);
  const b = scalePos(Math.max(0, value), scale);
  return (
    <span aria-hidden className={`relative block overflow-hidden rounded-full bg-foreground/7 ${className}`}>
      <span className={`absolute inset-y-0 rounded-full ${fill ?? fillTone(value)} motion-safe:transition-[left,width] motion-safe:duration-300`} style={{ left: `${a}%`, width: `${Math.max(b - a, 0.8)}%` }} />
      {/* 음수가 있는 눈금이면 0점에 라벨 없는 1px 세로 눈금 — 막대가 그 점에서 좌우로 자란다(6차 ③) */}
      {zeroTick && scale.lo < 0 && <span data-testid="grow-zero-tick" className="absolute inset-y-0 w-px -translate-x-1/2 bg-foreground/60" style={{ left: `${scalePos(0, scale)}%` }} />}
    </span>
  );
}

// ─── ① 종합 카드 ────────────────────────────────────────────────────

function KeepLine({ s }: { s: BoardSummary["keep"] }) {
  if (s.count === 0) return <span className="text-muted-foreground">아직 없어요</span>;
  return (
    <>
      {s.count}종목 수익률 {s.rate === null ? <span className="text-muted-foreground">—</span> : <b className={`font-bold ${pctTone(s.rate)}`}>{pctText(s.rate)}</b>}
      <span aria-hidden className="text-muted-foreground"> · </span>
      {s.low === 0 ? "평단보다 낮은 종목 없음" : s.low === s.count ? <><b className="font-bold">모두</b> 평단보다 낮음</> : <><b className="font-bold">{s.low}종목</b> 평단보다 낮음</>}
    </>
  );
}

function CheckLine({ s }: { s: BoardSummary["check"] }) {
  if (s.count === 0) return <span className="text-muted-foreground">아직 없어요</span>;
  if (s.due === 0) return <>{s.count}종목 · 점검 차례 없음</>;
  if (s.due === s.count) return <>{s.count}종목 <b className="font-bold">모두</b> 점검 차례</>;
  return <>{s.count}종목 중 <b className="font-bold">{s.due}종목</b> 점검 차례</>;
}

function DividendLine() {
  const { isLoading, failedCount, annualAtHeldQty } = useDividendAnnualTotals();
  if (isLoading) return <span aria-hidden className={`inline-block h-4 w-32 rounded align-middle ${SKELETON_FILL}`} />;
  if (failedCount > 0) return <span className="text-muted-foreground">배당 정보를 불러오지 못했어요</span>;
  if (annualAtHeldQty > 0) return <>1년 약 {formatShortCurrency(annualAtHeldQty)}<span className="ml-1.5 inline-block rounded bg-muted/70 px-1.5 text-xs text-muted-foreground">지금 수량 기준 가정</span></>;
  return <span className="text-muted-foreground">올해 예정된 배당이 없어요</span>;
}

/**
 * 기준 패널 — 첫 행 `내 주식 전체`(무채색 막대)와 묶음 행을 같은 눈금으로 나란히. 0·`전체 ±x%` 라벨·점선 없음(6차 ③).
 * 묶음을 누르면 아래 목록을 그 묶음으로 거른다
 */
export function AxisPanel({ axis, groups, total, scale, filterKey, onGroup }: {
  axis: BoardAxis;
  groups: BoardGroup[];
  total: { count: number; profit: number; rate: number };
  scale: { lo: number; hi: number };
  filterKey: string | null;
  onGroup: (g: BoardGroup) => void;
}) {
  const [moreGroups, setMoreGroups] = useState(false);
  const visible = moreGroups || groups.length <= VISIBLE_GROUPS + 1 ? groups : groups.slice(0, VISIBLE_GROUPS);
  const hidden = groups.length - visible.length;
  const cols = "grid grid-cols-[6.25rem_minmax(0,1fr)_4.25rem] gap-x-2 max-[359px]:grid-cols-[5.5rem_minmax(0,1fr)_4rem]";
  return (
    <div data-testid="grow-groups" data-axis={axis} className="border-t border-border pt-1 dark:border-border/40">
      <div data-testid="grow-group-total" data-rate={pctText(total.rate)} data-profit={Math.round(total.profit)} className={`${cols} min-h-13 items-center py-1.5`}>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-muted-foreground text-pretty break-keep">내 주식 전체</span>
          <span className="block text-xs text-muted-foreground tabular-nums">{total.count}종목</span>
        </span>
        <ZeroBar value={total.rate} scale={scale} className="h-2.5" fill="bg-foreground/40" zeroTick />
        <span className="text-right tabular-nums">
          <span className={`block text-base font-bold ${pctTone(total.rate)}`}>{pctText(total.rate)}</span>
          <span className="block text-xs text-muted-foreground">{wonText(total.profit)}</span>
        </span>
      </div>
      <ul>
        {visible.map((g) => {
          const on = filterKey === g.key;
          return (
            <li key={g.key} className="border-t border-border dark:border-border/40">
              <button
                type="button"
                data-testid="grow-group"
                data-key={g.key}
                data-rate={pctText(g.rate)}
                data-profit={Math.round(g.profit)}
                aria-pressed={on}
                aria-label={`${g.label} ${g.count}종목 ${pctText(g.rate)} ${wonText(g.profit)}, 누르면 아래 종목을 이 묶음으로 걸러요`}
                onClick={() => onGroup(g)}
                className={`${cols} -mx-2 min-h-13 w-[calc(100%+1rem)] items-center rounded-lg px-2 py-1.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150 ${on ? "bg-foreground/8" : "hover:bg-muted/40"}`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground text-pretty break-keep">{g.label}</span>
                  <span className="block text-xs text-muted-foreground tabular-nums">{g.count}종목</span>
                </span>
                <ZeroBar value={g.rate} scale={scale} className="h-2.5" zeroTick />
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
      {groups.some((g) => g.key === "unclassified") && (
        <p data-testid="grow-unclassified-caption" className="mt-2 text-xs text-muted-foreground text-pretty break-keep">X-Ray를 열면 분류가 채워져요.</p>
      )}
    </div>
  );
}

// ─── ② 점검 한 장 ───────────────────────────────────────────────────

// 두 묶음 모두 같은 동작(점검 기록)은 같은 낱말 `그대로 두기`(6차 COO 수정 1, C133)
const CHOICE_TEXT: Record<StockReviewChoice, string> = { same: "그대로 두기", keep: "장기 보유로", check: "점검 대상으로", none: "정하지 않음으로" };
const historyText = (r: StockLabelReview) => CHOICE_TEXT[r.choice];

export type PlanDraft = { down: string; up: string; months: "" | CycleChoice; memo: string };
const draftOf = (p: StockLabelPlan | undefined): PlanDraft => ({
  down: p?.down !== undefined ? String(p.down) : "",
  up: p?.up !== undefined ? String(p.up) : "",
  months: p?.months !== undefined ? (`${p.months}` as CycleChoice) : "",
  memo: p?.memo ?? "",
});
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 3);
/** 빈 칸 = 없음, 0 = 없음, 범위 밖은 끝값으로 */
const clampInt = (v: string, [lo, hi]: readonly [number, number]): number | undefined => {
  const n = Number(v);
  if (v === "" || !Number.isFinite(n) || n <= 0) return undefined;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

/** 폼 입력 → 저장할 조건(범위 밖 숫자는 끝값, 메모 정리는 setStockPlan이 같은 규칙으로) */
export function planFromDraft(d: PlanDraft): Pick<StockLabelPlan, "down" | "up" | "months" | "memo"> {
  return { down: clampInt(d.down, STOCK_PLAN_RANGE.down), up: clampInt(d.up, STOCK_PLAN_RANGE.up), months: d.months === "" ? undefined : (Number(d.months) as StockLabelCycleMonths), memo: d.memo };
}
/** 저장값과 다른 입력이 남았는지 — 정리 규칙을 거친 값끼리 비교(공백·범위 밖 숫자만 다른 입력은 같은 값) */
export function planDraftDirty(d: PlanDraft, saved: StockLabelPlan | undefined): boolean {
  const norm = (p: Pick<StockLabelPlan, "down" | "up" | "months" | "memo"> | undefined) => JSON.stringify(p ? cleanStockPlan(p) : null);
  return norm(planFromDraft(d)) !== norm(saved);
}

/** 다시 볼 조건 — 요약 1줄(누르면 폼). 값은 사용자가 비운 칸에 직접 넣는다(예시 숫자·프리셋 없음) */
function PlanEditor({ row, plan, cycleMonths, open, onOpen, onSave, pct = true }: {
  /** false = 부동산·실물(기간·메모만 — ±% 칸 없음) */
  pct?: boolean;
  row: BoardRow;
  plan: StockLabelPlan | undefined;
  cycleMonths: number | null;
  open: boolean;
  onOpen: (open: boolean) => void;
  onSave: (plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">) => void;
}) {
  const [draft, setDraft] = useState<PlanDraft>(() => draftOf(plan));
  const sig = JSON.stringify(plan ?? null);
  // 저장소 값이 바뀌면(다른 탭·pull·범위 정리) 폼을 저장된 값으로 맞춘다
  useEffect(() => { setDraft(draftOf(plan)); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = (d: PlanDraft) => {
    const next = planFromDraft(d);
    setDraft({ ...d, down: next.down === undefined ? "" : String(next.down), up: next.up === undefined ? "" : String(next.up) });
    onSave(next);
  };
  // 입력 중 화면을 벗어나면(접기·한 장 닫기·페이지 이동 = 언마운트) blur가 오지 않는다 — 저장값과 다른 입력이 남아 있으면 그때 저장한다(iOS 숫자 키패드엔 Enter가 없다)
  const latest = useRef({ draft, plan, onSave });
  latest.current = { draft, plan, onSave };
  const flush = () => {
    const { draft: d, plan: saved, onSave: save } = latest.current;
    if (planDraftDirty(d, saved)) save(planFromDraft(d));
  };
  useEffect(() => () => flush(), []); // eslint-disable-line react-hooks/exhaustive-deps
  // 폼이 접힐 때(헤더·다른 선택·다른 행) — 열림 → 닫힘 전환마다 한 번
  const wasOpen = useRef(open);
  useEffect(() => { if (wasOpen.current && !open) flush(); wasOpen.current = open; }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const months = plan?.months ?? cycleMonths;
  const summary = [
    pct && plan?.down !== undefined ? `−${plan.down}% 이하` : null,
    pct && plan?.up !== undefined ? `+${plan.up}% 이상` : null,
    plan && ((pct && (plan.down !== undefined || plan.up !== undefined)) || plan.months !== undefined) && months !== null ? `${months}개월` : null,
    plan?.memo ? "메모" : null,
  ].filter(Boolean).join(" · ");
  const field = "flex min-h-10 items-center gap-1 rounded-lg bg-background px-2.5 text-sm shadow-[inset_0_0_0_1px] shadow-foreground/20 focus-within:ring-2 focus-within:ring-ring/50";
  const bare = "h-auto min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-semibold shadow-none tabular-nums focus-visible:ring-0 dark:bg-transparent md:text-sm";
  const blurOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === "Enter") e.currentTarget.blur(); };
  if (!open) {
    return (
      <button
        type="button"
        data-testid="grow-plan-summary"
        aria-expanded={false}
        onClick={() => onOpen(true)}
        className="grid min-h-11 w-full grid-cols-[auto_minmax(0,1fr)_0.875rem] items-center gap-x-2 rounded-lg bg-background px-3 text-left text-sm shadow-[inset_0_0_0_1px] shadow-foreground/14 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-safe:transition-transform"
      >
        <span className="whitespace-nowrap font-bold">{summary ? "다시 볼 조건" : "다시 볼 조건 정하기"}</span>
        <span className="truncate text-right text-muted-foreground tabular-nums">{summary}</span>
        <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />
      </button>
    );
  }
  return (
    <div data-testid="grow-plan-form" className="flex flex-col gap-2">
      <button type="button" aria-expanded onClick={() => onOpen(false)} className="flex min-h-10 items-center justify-between text-left text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        다시 볼 조건
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-muted-foreground">내가 정해요<ChevronDown aria-hidden className="size-3.5 rotate-180" /></span>
      </button>
      <div className="grid grid-cols-[3.5rem_minmax(0,1fr)_minmax(0,1fr)] items-center gap-1.5">
        {pct && (<>
        <span className="text-xs text-muted-foreground">평단 대비</span>
        <label className={field}>
          <span aria-hidden>−</span>
          <Input data-testid="grow-plan-down" inputMode="numeric" autoComplete="off" aria-label={`${row.name} 평단 대비 몇 퍼센트 이하에 다시 볼지`} value={draft.down} onChange={(e) => setDraft({ ...draft, down: digits(e.target.value) })} onBlur={() => commit(draft)} onKeyDown={blurOnEnter} className={bare} />
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">% 이하</span>
        </label>
        <label className={field}>
          <span aria-hidden>+</span>
          <Input data-testid="grow-plan-up" inputMode="numeric" autoComplete="off" aria-label={`${row.name} 평단 대비 몇 퍼센트 이상에 다시 볼지`} value={draft.up} onChange={(e) => setDraft({ ...draft, up: digits(e.target.value) })} onBlur={() => commit(draft)} onKeyDown={blurOnEnter} className={bare} />
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground">% 이상</span>
        </label>
        </>)}
        <span className="text-xs text-muted-foreground">기간</span>
        <label className={`${field} col-span-2`}>
          <select
            data-testid="grow-plan-months"
            aria-label={`${row.name} 다시 볼 기간`}
            value={draft.months}
            onChange={(e) => { const d = { ...draft, months: e.target.value as PlanDraft["months"] }; setDraft(d); commit(d); }}
            className="min-h-10 w-full appearance-none bg-transparent text-base outline-none md:text-sm"
          >
            <option value="">{cycleMonths === null ? "기본 주기 없음" : `기본 ${cycleMonths}개월`}</option>
            {STOCK_LABEL_CYCLES.map((m) => <option key={m} value={`${m}`}>{m}개월</option>)}
          </select>
          <ChevronDown aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        </label>
        <span className="text-xs text-muted-foreground">메모</span>
        {/* 메모 칸째 캡처 숨김(인증·공유 캡처). 글자로만 그리고 링크로 바꾸지 않는다 */}
        <label data-screenshot-hide className={`${field} col-span-2`}>
          <Input data-testid="grow-plan-memo" maxLength={STOCK_PLAN_MEMO_MAX} autoComplete="off" aria-label={`${row.name} 메모, ${STOCK_PLAN_MEMO_MAX}자까지`} value={draft.memo} onChange={(e) => setDraft({ ...draft, memo: e.target.value })} onBlur={() => commit(draft)} onKeyDown={blurOnEnter} className={`${bare} font-normal`} />
          <span className="ml-auto whitespace-nowrap text-xs text-muted-foreground tabular-nums">{Array.from(draft.memo).length}/{STOCK_PLAN_MEMO_MAX}</span>
        </label>
      </div>
      <p className="text-xs text-muted-foreground text-pretty break-keep">내가 정한 조건이에요. 앱이 권하는 값이 아니에요</p>
    </div>
  );
}

export function ReviewSheet({ row, labels, nowMs, planOpen, onPlanOpen, onChoose, onSavePlan, onOpenPage, afterOf, onEditValue }: {
  /** 이력 줄 오른쪽 값(#242) — 그 기록부터 다음 기록·지금까지 %. `내 선택`과 같은 계산(grow-pick)의 결과를 넘긴다 */
  afterOf?: (r: StockLabelReview) => { kind: "now" | "next"; pct: number } | null;
  /** 부동산·실물 값 구획의 `시세 고치기` — 기존 수정 창을 연다 */
  onEditValue?: (row: BoardRow) => void;
  row: BoardRow;
  labels: StockLabels;
  nowMs: number;
  planOpen: boolean;
  onPlanOpen: (open: boolean) => void;
  onChoose: (row: BoardRow, choice: StockReviewChoice) => void;
  onSavePlan: (row: BoardRow, plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">) => void;
  onOpenPage: (row: BoardRow) => void;
}) {
  const item = row.labelKey ? labels.items[row.labelKey] : undefined;
  const label = item?.label ?? null;
  const history = row.labelKey ? reviewsOf(labels, row.labelKey) : [];
  const months = checkMonthsOf(item, labels.cycle.months);
  const nextIfSame = months === null ? null : nextCheckDateText(addMonthsKst(nowMs, months), nowMs);
  const plan = label === "check" ? item?.plan : undefined;
  // 부동산·실물 — 값이 내가 넣은 숫자라 ±% 조건·이력 값·바닥 줄이 없다
  const own = row.kind === "real" || row.kind === "physical";
  const nextId = `grow-next-${row.key}`;
  const showNext = !row.checkedToday && nextIfSame !== null && label !== null;
  const choices: { choice: StockReviewChoice; text: string }[] = label === "keep"
    ? [{ choice: "same", text: "그대로 두기" }, { choice: "check", text: "점검 대상으로" }, { choice: "none", text: "정하지 않음" }]
    : label === "check"
      ? [{ choice: "same", text: "그대로 두기" }, { choice: "keep", text: "장기 보유로" }, { choice: "none", text: "정하지 않음" }]
      : [{ choice: "keep", text: "장기 보유" }, { choice: "check", text: "점검 대상" }];
  const reason = row.due && row.dueReason
    ? { text: `점검 차례 · ${dueReasonText(row.dueReason)}`, cls: DUE_TEXT }
    : row.checkedToday && row.nextCheckMs !== null
      ? { text: `오늘 점검함 · 다음 점검 ${nextCheckDateText(row.nextCheckMs, nowMs)}`, cls: "text-muted-foreground" }
      : label !== null && row.nextCheckMs !== null
        ? { text: `다음 점검 ${nextCheckDateText(row.nextCheckMs, nowMs)}`, cls: "text-muted-foreground" }
        : null;
  return (
    <div data-testid="grow-sheet" className="flex flex-col gap-3 pt-1">
      {row.labelKey && (
        <>
          {reason && <p data-testid="grow-sheet-reason" className={`text-xs text-pretty break-keep ${reason.cls}`}>{reason.text}</p>}
          {own && onEditValue && <OwnValueBox row={row} onEdit={onEditValue} />}
          <div>
          <div className={`grid gap-1.5 ${choices.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {choices.map(({ choice, text }) => {
              const done = choice === "same" && row.checkedToday;
              return (
                <button
                  key={choice}
                  type="button"
                  data-testid={`grow-choice-${choice}`}
                  aria-disabled={done || undefined}
                  aria-label={done ? `${row.name} 오늘 점검함` : `${row.name} ${text}`}
                  aria-describedby={choice === "same" && showNext ? nextId : undefined}
                  onClick={() => { if (!done) onChoose(row, choice); }}
                  className={`flex min-h-11 items-center justify-center rounded-lg px-1 text-sm font-semibold leading-tight outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[transform,background-color] motion-safe:duration-150 ${done ? "cursor-default bg-transparent text-muted-foreground shadow-[inset_0_0_0_1px] shadow-border" : "bg-muted hover:bg-muted/80 active:scale-[0.96]"}`}
                >
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">{done && <Check aria-hidden className="size-3.5" />}{done ? "오늘 점검함" : text}</span>
                </button>
              );
            })}
          </div>
          {/* 다음 점검 날짜는 버튼 밖 바로 아래 한 줄(#242) — 버튼 안 글자는 낱말 1줄, 세 버튼 높이 같음. 연도가 붙어도 320에서 1줄 */}
          {showNext && (
            <p id={nextId} data-testid="grow-choice-next" className="mt-1.5 flex flex-wrap gap-x-1 text-2xs font-medium text-muted-foreground tabular-nums">
              <span className="whitespace-nowrap">그대로 두면 다음 점검은</span><span className="whitespace-nowrap">{nextIfSame}</span>
            </p>
          )}
          </div>
          {label === "check" && (
            <PlanEditor pct={!own} row={row} plan={plan} cycleMonths={labels.cycle.months} open={planOpen} onOpen={onPlanOpen} onSave={(p) => onSavePlan(row, p)} />
          )}
          {plan && <p data-testid="grow-plan-warn" className="text-xs text-muted-foreground text-pretty break-keep">점검 대상에서 빼면 다시 볼 조건과 메모도 지워져요</p>}
          {(label !== null || history.length > 0) && (
            <div data-testid="grow-history">
              <p className="mb-1 text-xs text-muted-foreground tabular-nums">
                {history.length === 0 ? "아직 점검 기록이 없어요" : `최근 기록 · 점검 ${history.length}번 · 그대로 ${history.filter((r) => r.choice === "same").length}번`}
              </p>
              {history.slice(0, 3).map((r) => (
                <p key={`${r.t}@${r.at}`} data-testid="grow-history-row" className="grid min-h-7 grid-cols-[0.875rem_4rem_minmax(0,1fr)_auto] items-center gap-x-1.5 text-sm">
                  <span aria-hidden className="size-[7px] justify-self-center rounded-full bg-foreground/45" />
                  <span className="whitespace-nowrap text-muted-foreground tabular-nums">{monthDayText(Date.parse(r.at))}</span>
                  <span className="truncate">{historyText(r)}</span>
                  {/* 그날 가격부터 다음 기록(다음 점검까지)·지금(지금까지)까지. 값이 없으면 비운다. 부동산·실물은 가격이 시세가 아니라 값이 없다 */}
                  {(() => {
                    const a = own ? null : afterOf?.(r) ?? null;
                    return a
                      ? <span data-testid="grow-history-after" data-kind={a.kind} className="whitespace-nowrap text-right text-xs text-muted-foreground tabular-nums">{a.kind === "now" ? "지금까지" : "다음 점검까지"} <b className={`text-sm font-bold ${pctTone(a.pct)}`}>{pctText(a.pct)}</b></span>
                      : <span />;
                  })()}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      {!own && (
      <div className="flex min-h-8 items-center justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground dark:border-border/40">
        <span className="tabular-nums text-pretty break-keep">최근 3개월 거래 {row.tradeCount}건 · 이 앱 기록</span>
        <button type="button" data-testid="grow-row-open" onClick={() => onOpenPage(row)} className="inline-flex min-h-10 items-center gap-0.5 whitespace-nowrap text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
          {/* 낱말 = 도착 화면 제목. 코인은 보유 건이 하나면 그 코인의 매수/매도 내역, 여럿이면 상세 › 암호화폐 */}
          {row.kind === "crypto" ? (row.groupStockIds.length === 1 ? "매수/매도 내역" : "암호화폐") : "종목 페이지"} <ChevronRight aria-hidden className="size-4" />
        </button>
      </div>
      )}
    </div>
  );
}

// ─── ② 내 종목 행 ───────────────────────────────────────────────────

function BoardRowItem({ row, scale, open, onToggle, children }: {
  row: BoardRow;
  scale: { lo: number; hi: number };
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const sheetId = `grow-sheet-${row.key}`;
  const own = row.kind === "real" || row.kind === "physical";
  const meta: { key: string; node: React.ReactNode }[] = [{ key: "hold", node: row.holdText }];
  // 부동산·실물 — %가 내가 넣은 값 기준임을 2줄에서 말한다. 매입가 0원이면 % 대신 안내(`—`·`0%` 없음)
  if (own) meta.push({ key: "basis", node: <span data-testid="grow-row-basis">{row.rate === null ? "매입가를 넣으면 보여요" : row.kind === "real" ? "내가 넣은 시세 기준" : "내가 넣은 평가액 기준"}</span> });
  if (row.score.state !== "none") {
    meta.push({
      key: "score",
      node: <span data-testid="grow-row-score" data-state={row.score.state} data-score={row.score.state === "score" ? row.score.score : ""}>{row.score.state === "score" ? `${row.score.score}점` : "측정 중"}</span>,
    });
  }
  // 정한 날이 없으면 칸 자체가 없다(`—`·0% 없음). 기준일이 오늘이면 % 대신 `오늘 정함`·`오늘 점검함`
  if (row.since) {
    meta.push({
      key: "since",
      node: row.since.today
        ? <span data-testid="grow-row-since" data-kind={row.since.kind} data-today="true">{row.since.kind === "checked" ? "오늘 점검함" : "오늘 정함"}</span>
        : <span data-testid="grow-row-since" data-kind={row.since.kind}>{row.since.kind === "checked" ? "점검일 대비" : "정한 날 대비"} <b className="font-semibold text-foreground">{pctText(row.since.pct)}</b></span>,
    });
  }
  if (row.dropNote) meta.push({ key: "drop", node: <span data-testid="grow-row-drop">{row.dropNote}</span> });
  return (
    <li data-testid="grow-row" data-key={row.key} data-kind={row.kind} data-ticker={row.labelKey ?? ""} data-label={row.labelState} data-due={row.due ? "true" : "false"}>
      <button
        type="button"
        data-testid="grow-row-toggle"
        aria-expanded={open}
        aria-controls={sheetId}
        aria-label={`${row.name}, 보유 ${row.holdText}, ${own ? "매입가 대비" : "평단 대비 수익률"} ${row.rate === null ? "없음" : pctText(row.rate)}${row.due ? ", 점검 차례" : ""}`}
        onClick={onToggle}
        className={`-mx-2 grid w-[calc(100%+1rem)] grid-cols-[minmax(0,1fr)_4.5rem_3.625rem_0.875rem] items-center gap-x-2 gap-y-0.5 px-2 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150 max-[359px]:grid-cols-[minmax(0,1fr)_3rem_3.625rem_0.875rem] ${open ? "rounded-t-lg bg-foreground/6" : "rounded-lg hover:bg-muted/40"}`}
      >
        <span className={`min-w-0 text-sm font-semibold text-foreground text-pretty break-keep ${own ? "col-span-2" : ""}`}>{row.name}</span>
        {own ? null : row.rate === null ? <span /> : <ZeroBar value={row.rate} scale={scale} className="h-2" />}
        <span data-testid="grow-row-rate" data-rate={row.rate === null ? "" : pctText(row.rate)} className={`text-right text-base font-bold tabular-nums ${row.rate === null ? "text-muted-foreground" : pctTone(row.rate)}`}>
          {row.rate === null ? (own ? "" : "—") : pctText(row.rate)}
        </span>
        <ChevronRight aria-hidden className={`row-span-2 size-3.5 self-center text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-90" : ""}`} />
        <span className={`flex min-w-0 flex-wrap items-center gap-x-1 text-xs text-muted-foreground tabular-nums ${row.due ? "col-span-2" : "col-span-3"}`}>
          {meta.map((p, i) => <span key={p.key} className="contents">{i > 0 && <span aria-hidden>·</span>}<span className="whitespace-nowrap">{p.node}</span></span>)}
        </span>
        {row.due && <span data-testid="grow-row-due" className={`whitespace-nowrap text-right text-xs ${DUE_TEXT}`}>점검 차례</span>}
      </button>
      {/* 행 버튼과 같은 폭(-mx-2)은 접힘 래퍼에 준다 — overflow-hidden 안쪽에 두면 좌우가 잘린다 */}
      <div id={sheetId} {...(open ? {} : { inert: true, "aria-hidden": true })} className={`-mx-2 ${FOLD} motion-safe:duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className="mb-2 rounded-b-[10px] bg-foreground/6 px-3 pb-3">{open && children}</div>
        </div>
      </div>
    </li>
  );
}

const VIEW_TEXT: Record<GrowView, { noun: string; list: string; right: string; guide: string }> = {
  stock: { noun: "주식", list: "내 종목", right: "평단 대비 수익률", guide: "종목을 누르면 장기 보유·점검 대상을 정할 수 있어요" },
  crypto: { noun: "코인", list: "내 코인", right: "평단 대비 수익률", guide: "눌러서 장기 보유·점검 대상을 정할 수 있어요" },
  own: { noun: "", list: "내 부동산·실물", right: "매입가 대비", guide: "눌러서 장기 보유·점검 대상을 정할 수 있어요" },
};

/**
 * 불리기 블록. 표시할 자산(주식·코인·부동산·실물)이 없으면 아무것도 그리지 않는다.
 * store = 화면(asset-report-view)이 같은 저장소 값으로 세그먼트를 그릴 때 넘기는 훅 결과 — 블록에서 고른 값이 세그먼트에 바로 반영된다
 */
export function StockLabelBlock({ store }: { store?: ReturnType<typeof useStockLabels> } = {}) {
  const { assetData, exchangeRates } = useAssetData();
  const own = useStockLabels();
  const s = store ?? own;
  const { labels, ready } = s;
  const [now] = useState(() => Date.now());
  // 화면 안에서 고른 종류 — 종목 페이지·수정 창에 다녀와도 그대로(세션 메모리). 허브로 새로 들어오면 규칙대로(resetReportTab)
  const [picked, setPicked] = useState<GrowView | null>(getGrowView);

  const boards = useMemo(
    () => buildGrowBoards(assetData, exchangeRates, labels, now),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 행에 쓰는 자산 배열만 본다(현금·대출 변경으로 다시 만들지 않는다)
    [assetData.stocks, assetData.crypto, assetData.realEstate, assetData.physicalAssets, assetData.transactions, assetData.cryptoTransactions, exchangeRates, labels, now],
  );
  const views = heldViews(boards);
  // 처음 열리는 보기 — 차례가 있는 종류 중 순서상 첫째, 없으면 가진 종류 중 첫째. 화면에 들어올 때 한 번 정한다
  const entryView = useRef<GrowView | null>(null);
  if (ready && views.length > 0 && (!entryView.current || !views.includes(entryView.current))) entryView.current = firstGrowView(boards);

  // 보조 지표 '다시 봄' — 화면을 연 시점의 저장소 값으로 마운트당 1회. preview 데모는 여기서, 체험은 track 안에서 막는다
  const revisitJudged = useRef(false);
  useEffect(() => {
    if (!ready || revisitJudged.current) return;
    revisitJudged.current = true;
    if (isPreviewEnv()) return;
    if (isStockLabelRevisit(labels, Date.now())) track("feature_use", { category: "grow_revisit" });
  }, [ready, labels]);

  // 주 지표 `·내 선택` — 값이 있는 패널을 처음 열 때 화면 로드당 1회(주식·코인 보기 공통). 종류·건수는 보내지 않는다
  const pickSent = useRef(false);
  const onPickOpen = () => {
    if (pickSent.current) return;
    pickSent.current = true;
    if (!isPreviewEnv()) track("feature_use", { category: "grow_pick" });
  };

  if (!ready || views.length === 0 || !entryView.current) return null;
  const view = picked && views.includes(picked) ? picked : entryView.current;
  const due = { stock: viewHasDue(boards, "stock"), crypto: viewHasDue(boards, "crypto"), own: viewHasDue(boards, "own") };

  return (
    <div data-testid="grow-block" data-view={view}>
      {views.length >= 2 && <GrowKindTabs views={views} value={view} due={due} onChange={(v) => { setPicked(v); setGrowView(v); }} />}
      {/* 보기를 바꾸면 내용만 바뀐다(슬라이드 없음). key로 다시 마운트해 열린 한 장·패널·거름을 닫는다 */}
      <GrowViewPanel key={view} view={view} rows={boards[view]} store={s} now={now} onPickOpen={onPickOpen} />
    </div>
  );
}

function GrowViewPanel({ view, rows, store, now, onPickOpen }: {
  view: GrowView;
  rows: BoardRow[];
  store: ReturnType<typeof useStockLabels>;
  now: number;
  onPickOpen: () => void;
}) {
  const { assetData, exchangeRates } = useAssetData();
  const { navigate } = useAssetNavigation();
  const setStockPageTarget = useStockPageStore((st) => st.setTarget);
  const setCryptoTxTarget = useCryptoTxViewStore((st) => st.setTarget);
  const { labels, record, setPlan, setCycle } = store;
  const [openAxis, setOpenAxis] = useState<BoardAxis | null>(null);
  const [filter, setFilter] = useState<{ axis: BoardAxis; key: string } | null>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const [pickFilter, setPickFilter] = useState<PickFilter | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [planOpenKey, setPlanOpenKey] = useState<string | null>(null);
  const [cycleOpen, setCycleOpen] = useState(false);
  const text = VIEW_TEXT[view];

  const total = useMemo(
    () => (view === "crypto" ? cryptoTotal(assetData.crypto ?? [], rows) : boardTotal(assetData.stocks, exchangeRates, rows)),
    [view, assetData.stocks, assetData.crypto, exchangeRates, rows],
  );
  const summary = useMemo(() => boardSummary(rows), [rows]);
  // 네 축의 묶음을 한 번에 만들어 막대 눈금을 하나로 정한다(축을 바꿔도 길이 비교 유지). 기준 4칸은 주식 보기에만 있다
  const axisGroups = useMemo(
    () => Object.fromEntries(BOARD_AXES.map((a) => [a.value, view === "stock" ? buildAxisGroups(a.value, rows) : []])) as Record<BoardAxis, BoardGroup[]>,
    [view, rows],
  );
  const scale = useMemo(
    () => boardScale([...Object.values(axisGroups).flatMap((gs) => gs.map((g) => g.rate)), ...rows.flatMap((r) => (r.rate === null ? [] : [r.rate]))]),
    [axisGroups, rows],
  );
  // 시세 없는 종목이 있으면 기준 4칸을 숨긴다(합계가 틀린다). 묶음이 1개뿐인 축은 비교할 것이 없어 숨긴다
  const axes = useMemo(() => (total.priced ? BOARD_AXES.filter((a) => axisGroups[a.value].length > 1) : []), [total.priced, axisGroups]);

  // `내 선택`(#242) — 주식·코인 보기 각각 따로 센다. 결론 줄·패널·이력 줄 값이 이 결과 하나에서 나온다
  const pick = useMemo(() => {
    if (view === "own") return null;
    const input = view === "stock" ? stockPickInput(assetData.stocks, assetData.transactions ?? []) : cryptoPickInput(assetData.crypto ?? [], assetData.cryptoTransactions ?? []);
    return computePick(labels, view, input, now);
  }, [view, assetData.stocks, assetData.transactions, assetData.crypto, assetData.cryptoTransactions, labels, now]);
  // 처음 쓰는 사람(정한 것 0)이고 값도 없으면 행을 그리지 않는다(안내 1줄만)
  const showPick = !!pick && !(summary.first && pick.state === "wait");
  const pickHasPanel = showPick && pick.state !== "wait";

  // 묶음 안 순서와 첫 사용자 기본 패널은 화면에 들어올 때 한 번 정한다(누른 뒤 행이 자리를 옮기지 않게)
  const entry = useRef<{ rank: Map<string, number> } | null>(null);
  if (rows.length > 0 && !entry.current) entry.current = { rank: boardRowRank(rows) };
  const firstPanelSet = useRef(false);
  useEffect(() => {
    if (firstPanelSet.current || rows.length === 0) return;
    firstPanelSet.current = true;
    if (summary.first && axes.length > 0) setOpenAxis(axes.some((a) => a.value === "hold") ? "hold" : axes[0].value);
  }, [rows.length, summary.first, axes]);

  if (rows.length === 0) return null;

  const activeFilter = filter && axes.some((a) => a.value === filter.axis) ? axisGroups[filter.axis].find((g) => g.key === filter.key) ?? null : null;
  // 패널 행 거름 — 그 기록이 있는 지금 가진 종목만(판 종목은 건수에만 있고 목록에 없다). 패널이 열려 있는 동안만 걸린다
  const pickKeys = pickHasPanel && pickOpen && pickFilter ? (pickFilter === "hit" ? pick.hit.keys : pickFilter === "buy" ? pick.buys.keys : pick.rows[pickFilter].keys) : null;
  const rank = entry.current?.rank ?? new Map<string, number>();
  const rankOf = (r: BoardRow, i: number) => rank.get(r.key) ?? rows.length + i;
  const visibleRows = (pickKeys ? rows.filter((r) => r.labelKey !== null && pickKeys.includes(r.labelKey)) : activeFilter ? rows.filter((r) => activeFilter.rowKeys.includes(r.key)) : rows)
    .map((r, i) => ({ r, k: rankOf(r, i) }))
    .sort((a, b) => a.k - b.k)
    .map(({ r }) => r);
  const buckets = BOARD_BUCKETS.map((b) => ({ ...b, rows: visibleRows.filter((r) => bucketOf(r) === b.value) })).filter((b) => b.rows.length > 0);

  const openPage = (row: BoardRow) => {
    if (row.kind === "crypto") {
      if (row.groupStockIds.length !== 1) { navigate({ type: "detail", tab: "crypto" }); return; }
      setCryptoTxTarget({ cryptoId: row.groupStockIds[0], name: row.name });
      navigate({ type: "detail", tab: "crypto-transactions" });
      return;
    }
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
  // 부동산·실물 값 고치기 — 기존 수정 창(성과 화면에서도 떠 있는 입력 컴포넌트가 받는다). 값을 고쳐도 점검 기록은 생기지 않는다
  const editValue = (row: BoardRow) => {
    if (!row.own) return;
    window.dispatchEvent(new CustomEvent(row.kind === "real" ? "trigger-edit-real-estate" : "trigger-edit-physical", { detail: { id: row.own.assetId } }));
  };
  // 점검 한 장의 선택 — 그때 시세·평단 대비 %를 기록과 함께 한 번에 쓴다. 정하는 순간의 기준값도 함께(저장 구조 유지).
  // 차례인 상태에서 누르면 그 이유(hit)가 기록에 남는다(입력 추가 0). 부동산·실물은 기준값(base)을 쓰지 않는다
  const onChoose = (row: BoardRow, choice: StockReviewChoice) => {
    if (!row.labelKey) return;
    const snap = row.own ? ownSnap(row) : row.nowPrice !== null && row.rate !== null ? { price: row.nowPrice, rate: row.rate } : null;
    const base = choice !== "keep" && choice !== "check" ? undefined
      : row.kind === "stock" ? buildLabelBase(assetData.stocks, exchangeRates, row.labelKey)
        : row.kind === "crypto" ? buildCryptoLabelBase(assetData.crypto ?? [], row.labelKey) : undefined;
    record(row.labelKey, choice, snap, base, hitOf(row.dueReason));
    setPlanOpenKey(null);
  };
  const onSavePlan = (row: BoardRow, plan: Pick<StockLabelPlan, "down" | "up" | "months" | "memo">) => { if (row.labelKey) setPlan(row.labelKey, plan); };
  // 한 번에 하나 — 기준 칸을 누르면 `내 선택` 패널이 닫히고(거름도 풀린다), `내 선택`을 열면 기준 패널이 닫힌다
  const closePick = () => { setPickOpen(false); setPickFilter(null); };
  const onAxis = (a: BoardAxis) => {
    closePick();
    if (activeFilter && filter?.axis === a) { setFilter(null); return; }
    setOpenAxis(openAxis === a ? null : a);
  };
  const onGroup = (g: BoardGroup) => {
    if (!openAxis) return;
    if (filter?.axis === openAxis && filter.key === g.key) { setFilter(null); return; }
    setFilter({ axis: openAxis, key: g.key });
    setOpenAxis(null);
  };
  const onPickToggle = () => {
    if (pickOpen) { closePick(); return; }
    setPickOpen(true);
    setOpenAxis(null);
    onPickOpen();
  };
  const onPickFilter = (f: PickFilter) => {
    setFilter(null);
    setPickFilter(pickFilter === f ? null : f);
  };
  const afterOf = pick ? (r: StockLabelReview) => pickAfterOf(pick, r.t, r.at) : undefined;
  const pickPanelId = `grow-pick-panel-${view}`;

  return (
    <div data-testid="grow-view" data-view={view} className={`grid gap-5 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 ${view === "own" ? "" : "lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-start"}`}>
      {/* ① 종합 카드 — 부동산·실물 보기에는 없다(값이 내가 넣은 숫자라 합계를 주식과 같은 잣대에 놓지 않는다) */}
      {view !== "own" && (
      <section data-testid="grow-total-card" className={`min-w-0 ${SECTION}`}>
        <div className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <span>평단 대비 수익 · 내 {text.noun} {rows.length}종목</span>
          <span data-screenshot-hide className="inline-flex">
            {view === "stock" ? (
              <InfoHint summary="판 종목의 손익은 넣지 않아요.">
                <p className="text-pretty break-keep">수익률은 평단 대비예요. 지금 가격이 내가 산 평균 가격보다 얼마나 오르내렸는지예요. 상세 › 주식 &apos;전체&apos;의 손익과 같은 값이에요.</p>
                <p className="text-pretty break-keep">배당은 올해 지급·예정 배당을 지금 가진 수량으로 계산한 가정이에요. 실제로 받는 금액과 다를 수 있어요.</p>
              </InfoHint>
            ) : (
              <InfoHint summary="판 코인의 손익은 넣지 않아요.">
                <p className="text-pretty break-keep">수익률은 평단 대비예요. 지금 가격이 내가 산 평균 가격보다 얼마나 오르내렸는지예요. 상세 › 암호화폐의 평가손익과 같은 값이에요.</p>
              </InfoHint>
            )}
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
        {summary.first && <p data-testid="grow-guide" className="text-sm text-pretty break-keep">{text.guide}</p>}
        {/* 라벨 행과 `내 선택` 패널은 한 덩어리 — 닫힌 패널이 카드 간격을 하나 더 만들지 않게 */}
        <div>
          <dl data-testid="grow-summary" className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-baseline gap-x-2 gap-y-1.5 text-sm">
            {!summary.first && (
              <>
                <dt className="text-xs text-muted-foreground">장기 보유</dt>
                <dd data-testid="grow-summary-keep" className="min-w-0 tabular-nums break-keep"><KeepLine s={summary.keep} /></dd>
                <dt className="text-xs text-muted-foreground">점검 대상</dt>
                <dd data-testid="grow-summary-check" className="min-w-0 tabular-nums break-keep"><CheckLine s={summary.check} /></dd>
              </>
            )}
            {view === "stock" && (
              <>
                <dt className="text-xs text-muted-foreground">배당</dt>
                <dd data-testid="grow-next-dividend" className="min-w-0 tabular-nums text-pretty break-keep"><DividendLine /></dd>
              </>
            )}
            {showPick && (
              <>
                <dt className="text-xs text-muted-foreground">내 선택</dt>
                <PickLine pick={pick} open={pickOpen} panelId={pickPanelId} onToggle={onPickToggle} />
              </>
            )}
          </dl>
          {pickHasPanel && (
            // 항상 마운트 + grid-rows 0fr↔1fr(재마운트 없음 — 중간에 다시 눌러도 그 자리에서 되돌아간다)
            <div id={pickPanelId} {...(pickOpen ? {} : { inert: true, "aria-hidden": true })} className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 ${pickOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
              <div className="min-h-0 overflow-hidden">
                <div className="pt-3"><PickPanel pick={pick} filter={pickOpen ? pickFilter : null} onFilter={onPickFilter} /></div>
              </div>
            </div>
          )}
        </div>
        {axes.length > 0 && (
          <div data-testid="grow-axes" role="group" aria-label="기준별로 보기" className="grid rounded-lg bg-muted/50 p-0.5" style={{ gridTemplateColumns: `repeat(${axes.length}, minmax(0, 1fr))` }}>
            {axes.map((a) => {
              const filtered = activeFilter && filter?.axis === a.value;
              return (
                <button
                  key={a.value}
                  type="button"
                  data-testid={`grow-axis-${a.value}`}
                  aria-expanded={openAxis === a.value}
                  aria-label={filtered ? `${activeFilter.label} 거르기 해제` : `${a.label}별로 보기`}
                  onClick={() => onAxis(a.value)}
                  className={`relative inline-flex min-h-9 min-w-0 items-center justify-center gap-0.5 rounded-md px-1 text-sm outline-none after:absolute after:inset-x-0 after:-inset-y-0.5 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-[transform,background-color] motion-safe:duration-150 max-[359px]:text-xs ${
                    filtered ? "bg-foreground font-bold text-card" : openAxis === a.value ? "bg-foreground/15 font-semibold text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span className="truncate">{filtered ? activeFilter.label : a.label}</span>
                  {filtered && <X aria-hidden className="size-3.5 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
        {pickKeys && pickFilter ? (
          <p data-testid="grow-filter-fact" data-pick={pickFilter} className="text-sm tabular-nums text-pretty break-keep">
            {visibleRows.length > 0
              ? `${PICK_FILTER_LABEL[pickFilter]} 기록이 있는 ${visibleRows.length}종목 · 지금 가진 종목만 보여요`
              : `${PICK_FILTER_LABEL[pickFilter]} 기록은 판 종목에만 있어요 · 지금 가진 종목만 보여요`}
          </p>
        ) : axes.length > 0 && activeFilter && (
          <p data-testid="grow-filter-fact" className="text-sm tabular-nums text-pretty break-keep">
            {activeFilter.label} {activeFilter.count}종목 {wonText(activeFilter.profit)} <b className={`font-bold ${pctTone(activeFilter.rate)}`}>{pctText(activeFilter.rate)}</b>
          </p>
        )}
        {axes.length > 0 && openAxis && axes.some((a) => a.value === openAxis) && (
          <AxisPanel key={openAxis} axis={openAxis} groups={axisGroups[openAxis]} total={{ count: rows.length, profit: total.profit, rate: total.rate }} scale={scale} filterKey={activeFilter && filter?.axis === openAxis ? activeFilter.key : null} onGroup={onGroup} />
        )}
      </section>
      )}

      {/* ② 내 종목 */}
      <section data-testid="grow-list" className={`min-w-0 ${SECTION}`}>
        <div className="flex min-h-7 items-center justify-between gap-2">
          <SectionHeader icon={List} title={text.list}>
            {view === "own" ? (
              <span data-testid="grow-own-hint" data-screenshot-hide className="inline-flex">
                <InfoHint summary="내가 넣은 값으로 계산해요.">
                  <p className="text-pretty break-keep">시세에 따라 자동으로 바뀌지 않아요. 대출과 보증금은 빼지 않은 값이에요.</p>
                </InfoHint>
              </span>
            ) : (
            <span data-testid="grow-score-hint" data-screenshot-hide className="inline-flex">
              <InfoHint summary="점수는 보유 기간 대비 수익을 5점 만점으로 매긴 거예요.">
                {/* 괄호 뒤 조사 금지(C114), 팝오버 높이를 줄이려 기준표는 한 문단 */}
                <p className="text-pretty break-keep">평단 대비 수익률을 1년 기준 연 환산 수익률로 바꿔 매겨요. 오래 가진 종목과 최근에 산 종목을 같은 잣대로 보기 위해서예요.</p>
                {/* 구간표 — 2열 격자(5점|4점 / 3점|2점 / 1점), 칸 높이 같음, 가운뎃점 없음(ui-review 재검수) */}
                <ul data-testid="grow-score-bands" className="grid grid-cols-2 gap-x-3 gap-y-0.5 tabular-nums">
                  {HOLD_SCORE_BANDS.map((b) => (
                    <li key={b.score} className="whitespace-nowrap">{b.score}점 {b.min === null ? "0% 미만" : `${b.min}% 이상`}</li>
                  ))}
                </ul>
                <p className="text-pretty break-keep">측정 중은 보유 기간이 {Math.round(SCORE_MIN_DAYS / 30.5)}개월이 안 된 종목이에요. 짧게 가진 종목일수록 몇 달의 변동이 점수에 크게 반영돼요. 보유 기간은 처음 매수한 날부터 세요. 구간은 자산 성적표 장기 순자산 성장과 같아요.</p>
                <p className="text-pretty break-keep">정한 날 대비는 장기 보유·점검 대상으로 정한 날의 가격부터, 점검일 대비는 마지막으로 그대로 두기를 누른 날의 가격부터 지금까지예요.</p>
                <p className="text-pretty break-keep">장기 보유·점검 대상은 내가 정한 묶음이에요. 보유 기간과는 따로예요.</p>
              </InfoHint>
            </span>
            )}
          </SectionHeader>
          <span className="whitespace-nowrap text-sm text-muted-foreground">{text.right}</span>
        </div>
        {/* 행 2줄 `N점`·`측정 중`의 기준을 목록 머리에서 바로(qa 권고, 상세는 ⓘ). 좁은 폭에서는 어절 단위로 감긴다. 부동산·실물은 점수가 없다 */}
        {view !== "own" && <p data-testid="grow-score-caption" className="-mt-1 text-xs text-muted-foreground tabular-nums text-pretty break-keep">점수 5점 만점 · 측정 중은 보유 {Math.round(SCORE_MIN_DAYS / 30.5)}개월 미만</p>}
        {view === "own" && summary.first && <p data-testid="grow-guide" className="text-sm text-pretty break-keep">{text.guide}</p>}
        <div data-testid="grow-buckets" className="flex flex-col gap-3">
          {buckets.map((b) => (
            <div key={b.value} data-testid="grow-bucket" data-bucket={b.value}>
              <h3 className="flex min-h-7 items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <BucketDot bucket={b.value} />
                {b.label}
                <span className="font-medium tabular-nums">{b.rows.length}{b.value === "none" && summary.first ? " · 눌러서 정해요" : ""}</span>
              </h3>
              <ul data-testid="grow-rows">
                {b.rows.map((row) => (
                  <BoardRowItem key={row.key} row={row} scale={scale} open={openKey === row.key} onToggle={() => { setOpenKey(openKey === row.key ? null : row.key); setPlanOpenKey(null); }}>
                    <ReviewSheet
                      row={row}
                      labels={labels}
                      nowMs={now}
                      planOpen={planOpenKey === row.key}
                      onPlanOpen={(o) => setPlanOpenKey(o ? row.key : null)}
                      onChoose={onChoose}
                      onSavePlan={onSavePlan}
                      onOpenPage={openPage}
                      afterOf={afterOf}
                      onEditValue={editValue}
                    />
                  </BoardRowItem>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* 점검할 기본 주기 — 목록 끝 설정 줄 1개. 누르면 그 자리에서 3·6·12개월을 고른다 */}
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
                <p data-testid="grow-cycle-caption" className="mt-1.5 text-xs text-muted-foreground text-pretty break-keep">다시 볼 조건에 기간을 정하지 않은 점검 대상은 이 기간이 지나면 점검 차례로 보여요.</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

/** 묶음 머리 점 — 무채색 3단(오래 둘 채움 / 점검할 옅게 / 아직 안 정함 테두리). 순위·평가 색이 아니다 */
function BucketDot({ bucket }: { bucket: BoardBucket }) {
  const cls = bucket === "keep" ? "bg-foreground/80" : bucket === "check" ? "bg-foreground/45" : "ring-[1.5px] ring-foreground/45 ring-inset";
  return <i aria-hidden className={`inline-block size-2 rounded-full ${cls}`} />;
}
