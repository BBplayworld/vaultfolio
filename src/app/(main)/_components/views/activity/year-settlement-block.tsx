"use client";

// 올해 결산 블록(5.124 #237) — 연 탭 Hero 아래 첫 블록. 넣은 돈 / 불어난 돈 / 빠져나간 돈 3묶음 + 기록 안 된 변화 + 월 기록 전 기간 행.
// 합계의 정본은 Hero다(블록에 합계·%·시작→끝을 다시 쓰지 않는다. 1월 초 머리 줄만 예외 — Hero는 새해 기준).
// 계산은 기존 연 체인·원인 함수를 그대로 부르고(`year-settlement.ts`가 구간만 나눈다) 저장·전송은 하지 않는다. views/activity 로컬 전용.

import { useId, useState } from "react";
import { ChevronDown, ListChecks } from "lucide-react";
import { getProfitLossColor } from "@/config/theme";
import { buildLiveAttributionCurr } from "@/lib/report/asset-report";
import { resolveYearChain, snapshotDate, type SettlementCause } from "@/lib/report/settlement";
import {
  YEAR_SETTLE_COPY, buildYearConclusion, groupYearSettlement, hasReflectedCashIn, hasYearRows, isYearCashTracked, pickYearEndSnapshot,
  resolveFirstYearChain, resolveYearTarget, splitYearChain, yearConclusionText, yearGrowthSingleHint, yearHeadText, yearIncomeHint,
  yearPeriodDateText, yearPeriodLabel, yearPeriodNoteText, yearPeriodPhrase, yearSettlementTitle,
  type YearGroups, type YearPeriodRow, type YearTarget,
} from "@/lib/report/year-settlement";
import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { InfoHint } from "../../layout/ui/info-hint";
import { useAssetNavigation } from "../../layout/navigation/navigation-context";
import { SECTION, SectionHeader } from "../../layout/ui/report-section";
import { BODY_ENTER, CAUSE_CAPTION, CAUSE_HINT, CauseRow, computeChainCauses, signed } from "./change-hero";

export type YearSettlementState = "measured" | "mixed" | "estimated-only" | "first-year" | "closed";

export interface YearSettlementModel {
  target: YearTarget;
  state: YearSettlementState;
  split: "measured" | "mixed" | "estimated-only";
  title: string;
  total: number;                                    // 숨김 전 합 = 대상 해 증감(원)
  heroStart: number;                                // 증감의 시작값(첫 해 = 시작점 기록)
  firstStart: string | null;                        // 첫 해 시작일
  head: { text: string; delta: number } | null;     // 1월 초 머리 줄
  groups: YearGroups | null;
  period: YearPeriodRow | null;
  periodLabel: string | null;
  periodSub: string | null;                         // 기간 행 둘째 줄
  periodCashNote: boolean;
  conclusion: { n: number; m: number } | null;
  phrase: string;
  periodNote: string | null;                        // 결론 줄이 없고 나눈 기간이 제목과 다를 때
  incomeHint: string;
  showCashLink: boolean;
}

type Live = ReturnType<typeof buildLiveAttributionCurr>;

/**
 * 연 탭 결산 모델. null = 블록 없음(올해 값 없음·첫 해 시작점 없음). 읽기 전용 — 인자로 받은 값만 쓴다.
 * 열린 해: 앵커 → 올해 enrich 월 → 실시간. 닫힌 해(1/1~1/10): 끝점 = 그 해 마지막 enrich 월 기록, 끝값 = 년도별 그 해 항목.
 */
export function buildYearSettlementModel({ assetData, monthly, daily, rates, exchangeHistory, summary, today }: {
  assetData: AssetData;
  monthly: MonthlyAssetSnapshot[];
  daily: DailyAssetSnapshot[];
  rates: { USD: number; JPY: number };
  exchangeHistory: Record<string, { USD: number; JPY: number }>;
  summary: Parameters<typeof buildLiveAttributionCurr>[2];
  today: string;
}): YearSettlementModel | null {
  const target = resolveYearTarget(assetData.yearlyNetAssets ?? [], today);
  if (!target) return null;
  const { year, closed } = target;
  const endSnap = closed ? pickYearEndSnapshot(monthly, year) : null;
  const endDate = closed ? (endSnap ? snapshotDate(endSnap) : null) : today;
  const first = !target.start;

  // 체인 점 — 첫 해는 시작점 기록부터, 그 밖은 기존 연 체인(닫힌 해는 today 자리에 끝 기록일)
  let points: MonthlyAssetSnapshot[] | null = null;
  if (endDate) {
    points = first
      ? resolveFirstYearChain(monthly, closed ? null : daily, assetData, year, endDate)
      : resolveYearChain(monthly, target.start!.year, target.start!.netAsset, endDate);
  }
  if (first && !points) return null;

  const firstStart = first ? points![0].date! : null;
  const heroStart = first ? points![0].netAsset : target.start!.netAsset;
  const heroDelta = target.end.netAsset - heroStart;
  const live: Live | null = closed
    ? (endSnap ? ({ ...endSnap, _date: endDate, _display: endDate } as unknown as Live) : null)
    : buildLiveAttributionCurr(assetData, rates, summary);
  const liveCash = closed ? endSnap?.breakdown?.cash ?? 0 : summary.cashValue;
  const run = (pts: MonthlyAssetSnapshot[], deltaNet: number) =>
    computeChainCauses({ points: pts, live: live!, deltaNet, endDate: endDate!, liveCash, exchangeHistory, assetData, rates });
  const split = points && live
    ? splitYearChain(points, heroStart, heroDelta, run)
    : { kind: "estimated-only" as const, total: Math.round(heroDelta), period: null, measured: null };

  const groups = split.measured ? groupYearSettlement(split.measured.mapped) : null;
  const period = split.period;
  const skipped = !!target.start && target.start.year !== year - 1;
  const conclusion = buildYearConclusion(groups);
  const phrase = yearPeriodPhrase({ year, closed, period, firstStart });
  const measuredStart = points ? points[split.kind === "mixed" ? 1 : 0] : undefined;
  const hasGroupRows = hasYearRows(groups, null);
  return {
    target,
    state: split.kind === "estimated-only" ? "estimated-only" : closed ? "closed" : first ? "first-year" : split.kind,
    split: split.kind,
    title: yearSettlementTitle({ year, closed, firstStart }),
    total: split.total,
    heroStart,
    firstStart,
    head: closed ? { text: yearHeadText(target, firstStart), delta: split.total } : null,
    groups,
    period,
    periodLabel: period ? yearPeriodLabel(period, skipped) : null,
    periodSub: period ? (skipped ? yearPeriodDateText(period) : `${YEAR_SETTLE_COPY.periodSub} · ${yearPeriodDateText(period)}`) : null,
    periodCashNote: !!period && hasReflectedCashIn(assetData, period.from, period.until),
    conclusion,
    phrase,
    periodNote: !conclusion && period && hasGroupRows ? yearPeriodNoteText(period) : null,
    incomeHint: yearIncomeHint(phrase, isYearCashTracked(assetData, measuredStart, liveCash, endDate ?? today)),
    showCashLink: !closed && !!split.measured?.mapped.showUnrecordedHint && (assetData.cash?.length ?? 0) >= 1,
  };
}

const ROW_ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300";
const stagger = (i: number) => ({ animationDelay: `${Math.min(i, 5) * 40}ms`, animationFillMode: "backwards" as const });
const GROUP_NAME = "text-sm md:text-base font-bold text-foreground";
const GROUP_AMOUNT = "shrink-0 text-base md:text-lg font-bold tabular-nums";

// 묶음 행 — 이름 뒤에 도움말(또는 펼침 화살표), 금액은 오른쪽 끝 고정
function YearGroupRow({ testId, name, amount, hint, i }: { testId: string; name: string; amount: number; hint?: string; i: number }) {
  return (
    <div data-testid={testId} data-value={amount} className={`flex min-h-10 items-center justify-between gap-3 ${ROW_ENTER}`} style={stagger(i)}>
      <span className={`inline-flex min-w-0 items-center gap-1.5 ${GROUP_NAME}`}>
        {name}
        {hint && <span data-screenshot-hide className="inline-flex"><InfoHint summary={hint} /></span>}
      </span>
      <span className={`${GROUP_AMOUNT} ${getProfitLossColor(amount)}`}>{signed(amount)}</span>
    </div>
  );
}

// 불어난 돈 — 0원 아닌 하위 행이 2개 이상일 때만 행 전체가 펼침 버튼(화살표는 이름 바로 뒤). 열림 상태는 블록이 가진다
function GrowthRow({ growth, i, open, onToggle }: { growth: NonNullable<YearGroups["growth"]>; i: number; open: boolean; onToggle: () => void }) {
  const panelId = useId();
  if (growth.rows.length < 2) {
    return <YearGroupRow testId="year-settle-group-grow" name={YEAR_SETTLE_COPY.growth} amount={growth.amount} hint={yearGrowthSingleHint(growth.rows[0])} i={i} />;
  }
  return (
    <div data-testid="year-settle-group-grow" data-value={growth.amount} className={ROW_ENTER} style={stagger(i)}>
      <button
        type="button"
        data-testid="year-settle-grow-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${YEAR_SETTLE_COPY.growth} ${signed(growth.amount)}`}
        onClick={onToggle}
        className="-mx-2 flex min-h-10 w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-lg px-2 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150"
      >
        <span className={`inline-flex min-w-0 items-center gap-1.5 ${GROUP_NAME}`}>
          {YEAR_SETTLE_COPY.growth}
          <span data-screenshot-hide aria-hidden className="flex size-4 shrink-0">
            <ChevronDown className={`size-4 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
          </span>
        </span>
        <span className={`${GROUP_AMOUNT} ${getProfitLossColor(growth.amount)}`}>{signed(growth.amount)}</span>
      </button>
      <div
        id={panelId}
        data-testid="year-settle-grow-panel"
        {...(open ? {} : { inert: true, "aria-hidden": true })}
        className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mb-2 ml-1 space-y-2 border-l border-border py-1 pl-3 dark:border-border/40">
            {growth.rows.map((c: SettlementCause) => <CauseRow key={c.key} c={c} i={0} hints={{}} groupEstimated animate={false} />)}
          </div>
        </div>
      </div>
    </div>
  );
}

export function YearSettlementBlock({ model, status }: { model?: YearSettlementModel | null; status?: "error" }) {
  const { navigate } = useAssetNavigation();
  const [open, setOpen] = useState(false);
  const hasRows = !!model && hasYearRows(model.groups, model.period);

  if (status === "error" || !model) {
    return (
      <section data-testid="year-settle" data-state="error" className={`${SECTION} ${BODY_ENTER}`}>
        <SectionHeader icon={ListChecks} title="올해 결산" titleTestId="year-settle-title" />
        <p data-testid="cause-error" className={CAUSE_CAPTION}>{YEAR_SETTLE_COPY.error}</p>
      </section>
    );
  }

  const { groups, period, conclusion } = model;
  const text = conclusion ? yearConclusionText(model.phrase, conclusion) : null;
  let i = 0; // 행 등장 순서(결론 0 → 묶음 → 기록 안 된 변화 → 기간 행)
  return (
    <section data-testid="year-settle" data-state={model.state} data-split={model.split} className={`${SECTION} ${BODY_ENTER}`}>
      <SectionHeader icon={ListChecks} title={model.title} titleTestId="year-settle-title">
        <span data-testid="year-settle-help" data-screenshot-hide className="inline-flex"><InfoHint summary={YEAR_SETTLE_COPY.help} /></span>
      </SectionHeader>

      {model.head && (
        <div data-testid="year-settle-head">
          <p className="text-sm text-muted-foreground tabular-nums">{model.head.text}</p>
          <p data-testid="year-settle-head-delta" data-value={model.head.delta} className={`mt-0.5 text-xl md:text-2xl font-bold tabular-nums leading-tight ${getProfitLossColor(model.head.delta)}`}>
            {signed(model.head.delta)}
          </p>
        </div>
      )}

      {!hasRows ? (
        <p data-testid="year-settle-empty" className={CAUSE_CAPTION}>
          {model.split === "estimated-only" ? YEAR_SETTLE_COPY.empty : "뚜렷한 변화 원인이 없어요"}
        </p>
      ) : (
        <>
          {text && (
            <p data-testid="year-settle-conclusion" data-rule="ratio" className={`text-sm font-medium leading-relaxed text-foreground text-pretty break-keep ${ROW_ENTER}`} style={stagger(i++)}>
              {text.head}{" "}
              <span className="whitespace-nowrap">{YEAR_SETTLE_COPY.income} <span className="font-semibold tabular-nums">{conclusion!.n}%</span>,</span>{" "}
              <span className="whitespace-nowrap">{YEAR_SETTLE_COPY.growth} <span className="font-semibold tabular-nums">{conclusion!.m}%</span>예요</span>
            </p>
          )}
          {model.periodNote && <p data-testid="year-settle-period-note" className={`${CAUSE_CAPTION} break-keep`}>{model.periodNote}</p>}

          {groups && (groups.income !== null || groups.growth || groups.loan !== null || groups.unrecorded) && (
            <div>
              {groups.income !== null && <YearGroupRow testId="year-settle-group-in" name={YEAR_SETTLE_COPY.income} amount={groups.income} hint={model.incomeHint} i={i++} />}
              {groups.growth && <GrowthRow growth={groups.growth} i={i++} open={open} onToggle={() => setOpen((v) => !v)} />}
              {groups.loan !== null && <YearGroupRow testId="year-settle-group-out" name={YEAR_SETTLE_COPY.loan} amount={groups.loan} hint={YEAR_SETTLE_COPY.loanHint} i={i++} />}
              {groups.unrecorded && (
                <div className={`flex min-h-8 flex-col justify-center ${ROW_ENTER}`} style={stagger(i++)}>
                  <CauseRow c={groups.unrecorded} i={0} hints={CAUSE_HINT.year} groupEstimated animate={false} />
                </div>
              )}
              {model.showCashLink && (
                <button
                  type="button"
                  data-testid="year-settle-cash-link"
                  onClick={() => navigate({ type: "detail", tab: "cash" })}
                  className="inline-flex min-h-10 items-center text-left text-sm font-medium text-brand underline underline-offset-2 dark:text-indigo-300"
                >
                  {YEAR_SETTLE_COPY.cashLink}
                </button>
              )}
            </div>
          )}

          {period && (
            <div data-testid="year-settle-period-row" data-value={period.amount} className={`-mx-2 rounded-lg bg-muted/30 px-2 py-2.5 ${ROW_ENTER}`} style={stagger(i++)}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground tabular-nums">
                  <span data-testid="year-settle-period-label">{model.periodLabel}</span>
                  <span data-screenshot-hide className="inline-flex">
                    <InfoHint summary={YEAR_SETTLE_COPY.periodHint}>
                      {model.periodCashNote && <p data-testid="year-settle-period-cash-note" className="text-pretty break-keep">{YEAR_SETTLE_COPY.periodCashNote}</p>}
                    </InfoHint>
                  </span>
                </span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${getProfitLossColor(period.amount)}`}>{signed(period.amount)}</span>
              </div>
              <p data-testid="year-settle-period-date" className="mt-0.5 text-sm text-muted-foreground break-keep">
                {model.target.start && model.target.start.year !== model.target.year - 1
                  ? <span className="whitespace-nowrap">{model.periodSub}</span>
                  : <>{YEAR_SETTLE_COPY.periodSub} <span className="whitespace-nowrap">· {yearPeriodDateText(period)}</span></>}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
