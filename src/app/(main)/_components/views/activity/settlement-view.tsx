"use client";

// 자산 변화 · 전체 · 월 탭 = N월 결산(#32 r2). Hero(이름·증감·시작→끝·월 화살표, 기간 선택은 상위 고정) → 변화 원인 → 다음 달 준비.
// 계산은 전부 기기 안(로컬 스냅샷 + 엔진 래퍼). 서버로 보내는 값 없음 — GA는 source·result 열거형만.

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readExchangeHistory } from "@/lib/finance/profit-utils";
import { buildLiveAttributionCurr, computeAttributionBetween } from "@/lib/report/asset-report";
import {
  buildSettlementIcs, listSettlementMonths, mapSettlementCauses, pickSettlementMonth,
  resolveSettlementWindow, settlementGaResult, settlementRangeLabel,
  SETTLEMENT_CAUSE_LABEL, type SettlementCauses, type SettlementWindow,
} from "@/lib/report/settlement";
import { daysSinceRefresh, getStaleCategories, type RefreshCategory } from "@/lib/asset/asset-refresh-status";
import { track } from "@/lib/analytics/ga";
import { InfoHint } from "../../layout/ui/info-hint";
import { SECTION, GROUP_BADGE, SectionHeader, SpecRow } from "../../layout/ui/report-section";
import { CATEGORY_LABEL } from "../home/home-tip-box";
import { BODY_ENTER, ChangeHero, settlementDelta, settlementName } from "./change-hero";

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
const signed = (v: number) => `${v >= 0 ? "+" : ""}${formatPriceByMode(v)}`;
const BADGE = "shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground";
const CAPTION = "text-sm text-muted-foreground text-pretty";
const PREP_ID = "settlement-prep";

interface SettlementResult {
  window: SettlementWindow;
  prevValue: number;
  currValue: number;
  delta: number;
  pct: number | null;
  mapped: SettlementCauses;
  estimatedLabel: "예측" | "일부 예측";
}

export function SettlementView({ initialMonth, source }: { initialMonth?: string; source: "card" | "menu" }) {
  const { assetData, exchangeRates, getAssetSummary, snapshotVersion } = useAssetData();
  // getAssetSummary는 자산·환율이 바뀔 때만 새로 만들어지므로 요약도 그때만 다시 계산한다(매 렌더 재계산 방지)
  const summary = useMemo(() => getAssetSummary(), [getAssetSummary]);
  const today = kstToday();
  // snapshotVersion이 바뀌면(저장·복원) 다시 읽는다
  const monthly = useMemo(() => (snapshotVersion >= 0 ? readMonthlySnapshots() : []), [snapshotVersion]);
  const [month, setMonth] = useState(() => initialMonth ?? pickSettlementMonth(readMonthlySnapshots(), kstToday()));

  const computed = useMemo((): { ok: true; value: SettlementResult } | { ok: false } => {
    try {
      const w = resolveSettlementWindow(monthly, month, today);
      const start = w.start;
      const live = buildLiveAttributionCurr(assetData, exchangeRates, summary);
      const { prevValue, currValue, delta, pct } = settlementDelta(w, summary.netAsset);
      const attr = start ? computeAttributionBetween(start, w.end ?? live, readExchangeHistory(), assetData, exchangeRates) : null;
      // 결정 4-4 예외 판정: 시작·끝 현금이 모두 0이고 구간 안 입출금 기록도 없으면 현금 미등록 사용자
      const endCash = w.end ? w.end.breakdown?.cash ?? 0 : summary.cashValue;
      const hasCashRecords = (assetData.cashTransactions ?? []).some(
        (t) => !!w.startDate && t.date >= w.startDate && t.date <= w.endDate,
      );
      const cashTracked = (start?.breakdown?.cash ?? 0) > 0 || endCash > 0 || hasCashRecords;
      const mapped = mapSettlementCauses(
        // 끝점이 레거시라 분해할 수 없으면 전부 "기록 안 된 변화"(예측)로 둔다 — 합계 항등식은 유지
        attr ? attr.effects : [{ key: "cash", amount: delta, estimated: true }],
        { deltaNet: delta, cashTracked },
      );
      return { ok: true, value: { window: w, prevValue, currValue, delta, pct, mapped, estimatedLabel: !attr || attr.estimated ? "예측" : "일부 예측" } };
    } catch {
      return { ok: false };
    }
  }, [monthly, month, today, assetData, exchangeRates, summary]);

  // settlement_view — 월 탭 진입(마운트)당 1회. 월 화살표 이동으로는 다시 보내지 않는다.
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current || !computed.ok) return;
    sentRef.current = true;
    track("settlement_view", { source, result: settlementGaResult(computed.value.window) });
  }, [computed, source]);

  // 월 화살표 — 기록 없는 달은 건너뛰고, 끝(13개월 보존 범위·이번 달)에서는 비활성
  const enabledMonths = listSettlementMonths(monthly, today).filter((i) => i.enabled).map((i) => i.month);
  const prevMonth = [...enabledMonths].reverse().find((m) => m < month);
  const nextMonth = enabledMonths.find((m) => m > month);
  const arrows = (
    <div data-screenshot-hide className="flex items-center gap-1">
      <MonthArrow dir="prev" target={prevMonth} onMove={setMonth} />
      <MonthArrow dir="next" target={nextMonth} onMove={setMonth} />
    </div>
  );

  const hasAssets = assetData.stocks.length + assetData.crypto.length + assetData.cash.length + assetData.loans.length + assetData.realEstate.length > 0;

  if (monthly.length === 0 || !hasAssets) {
    return (
      <div data-testid="settlement-root" className="flex flex-col gap-3 sm:gap-4">
        <ChangeHero
          message={<span data-testid="settlement-empty">아직 기록된 달이 없어요. 앱을 계속 쓰면 다음 달부터 결산이 열려요</span>}
        />
      </div>
    );
  }

  if (!computed.ok) {
    return (
      <div data-testid="settlement-root" className="flex flex-col gap-3 sm:gap-4">
        <ChangeHero
          title={settlementName(month, today, false)}
          titleTestId="settlement-title"
          actions={arrows}
          message={<span data-testid="settlement-error">결산을 불러오지 못했어요. 다른 달을 선택해 보세요</span>}
          contentKey={month}
        />
      </div>
    );
  }

  const { window: w, prevValue, currValue, delta, pct, mapped, estimatedLabel } = computed.value;
  const stale = getStaleRows(assetData).length > 0;
  const firstMonth = w.kind === "first_month";

  return (
    <div data-testid="settlement-root" className="flex flex-col gap-3 sm:gap-4">
      <ChangeHero
        title={settlementName(w.month, today, w.kind === "settled" || w.kind === "range")}
        titleTestId="settlement-title"
        range={firstMonth ? undefined : settlementRangeLabel(w)}
        badge={w.kind === "in_progress" ? <span data-testid="settlement-inprogress" className={`${GROUP_BADGE} shrink-0`}>진행 중</span> : undefined}
        actions={arrows}
        delta={firstMonth ? null : delta}
        pct={pct}
        start={prevValue}
        end={currValue}
        message={<span data-testid="settlement-first-month">다음 달부터 결산이 열려요</span>}
        aside={stale && !firstMonth ? (
          <button
            type="button"
            data-testid="hero-stale-badge"
            data-screenshot-hide
            onClick={() => document.getElementById(PREP_ID)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="relative rounded bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:text-foreground after:absolute after:-inset-x-1 after:-inset-y-2.5 after:content-['']"
          >
            일부 이전 값
          </button>
        ) : undefined}
        note={w.longGap ? <span data-testid="settlement-gap-note">기록 간격이 길어 {w.gapDays}일 구간이에요</span> : undefined}
        contentKey={month}
      />

      {!firstMonth && <CauseBlock key={month} mapped={mapped} estimatedLabel={estimatedLabel} />}

      <PrepBlock />
    </div>
  );
}

// 월 이동 화살표 — 40×40 원형, 이동할 달이 없으면 비활성
function MonthArrow({ dir, target, onMove }: { dir: "prev" | "next"; target?: string; onMove: (m: string) => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      data-testid={dir === "prev" ? "settlement-prev-month" : "settlement-next-month"}
      aria-label={dir === "prev" ? "이전 달" : "다음 달"}
      title={target ? undefined : "기록이 없는 달이에요"}
      disabled={!target}
      onClick={() => target && onMove(target)}
      className="flex size-10 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 motion-safe:transition-[background-color,color,transform] motion-safe:duration-150 motion-safe:active:scale-[0.96] outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <Icon className="size-4" />
    </button>
  );
}

const CAUSE_TESTID: Record<string, string> = {
  price: "cause-row-price", valuation: "cause-row-valuation", fx: "cause-row-fx", income: "cause-row-income", unrecorded: "cause-row-unrecorded",
};

// 블록 3 — 변화 원인(5항목). 매수·매도·상환 문구는 쓰지 않는다.
function CauseBlock({ mapped, estimatedLabel }: { mapped: SettlementCauses; estimatedLabel: string }) {
  return (
    <section className={`${SECTION} ${BODY_ENTER}`}>
      <SectionHeader icon={ListChecks} title="변화 원인" />
      {mapped.causes.length === 0 ? (
        <p className={CAPTION}>뚜렷한 변화 원인이 없어요</p>
      ) : (
        mapped.causes.map((c, i) => (
          // 원인 행 40ms 간격 등장(motion-safe) — 지연 동안은 첫 프레임 상태로 둔다
          <div
            key={c.key}
            data-testid={CAUSE_TESTID[c.key]}
            data-value={c.amount}
            className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300"
            style={{ animationDelay: `${i * 40}ms`, animationFillMode: "backwards" }}
          >
            <SpecRow
              label={
                <span className="inline-flex flex-wrap items-center gap-1.5">
                  {SETTLEMENT_CAUSE_LABEL[c.key]}
                  {c.key === "income" && (
                    <span data-screenshot-hide><InfoHint summary="입금에서 출금을 뺀 금액이에요" /></span>
                  )}
                  {c.estimated && <span data-testid="cause-estimated-badge" className={BADGE}>{estimatedLabel}</span>}
                </span>
              }
            >
              <span className={getProfitLossColor(c.amount)}>{signed(c.amount)}</span>
            </SpecRow>
          </div>
        ))
      )}
      {mapped.showUnrecordedHint && (
        <p data-testid="cause-unrecorded-hint" className={CAPTION}>이번 달 입출금을 기록하면 더 정확해져요</p>
      )}
    </section>
  );
}

// 갱신이 필요한 자산 — 홈 넛지와 같은 기준(getStaleCategories). 보유하지 않은 카테고리는 뺀다.
function getStaleRows(assetData: ReturnType<typeof useAssetData>["assetData"]): { category: RefreshCategory; days: number | null }[] {
  const owned: Record<RefreshCategory, boolean> = {
    stock: assetData.stocks.length > 0,
    crypto: assetData.crypto.length > 0,
    cash: assetData.cash.length > 0,
    loan: assetData.loans.length > 0,
  };
  return getStaleCategories(assetData.lastUpdated)
    .filter((c) => owned[c])
    .map((category) => ({ category, days: daysSinceRefresh(category) }));
}

// 블록 7 — 다음 달 준비(개인 조작 요소라 공유 캡처에서 숨김)
function PrepBlock() {
  const { assetData } = useAssetData();
  const rows = getStaleRows(assetData);
  const downloadIcs = () => {
    try {
      const blob = new Blob([buildSettlementIcs()], { type: "text/calendar;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "secretasset-monthly-settlement.ics";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast.error("일정 파일을 만들지 못했어요");
    }
  };
  return (
    <section id={PREP_ID} className={`${SECTION} scroll-mt-20`} data-screenshot-hide>
      <SectionHeader icon={CalendarPlus} title="다음 달 준비" tone="info" />
      {rows.length === 0 ? (
        <p data-testid="prep-stale-empty" className={CAPTION}>모든 자산이 최근 값이에요</p>
      ) : (
        <div className="flex flex-col">
          {rows.map((r) => (
            <button
              key={r.category}
              type="button"
              data-testid="prep-stale-row"
              onClick={() => window.dispatchEvent(new CustomEvent("open-add-asset-sheet", { detail: { category: r.category } }))}
              className="flex min-h-10 items-center justify-between gap-3 rounded-lg px-1 py-2 text-left hover:bg-muted/40 active:scale-[0.98] transition-[background-color,transform] duration-150"
            >
              <span className="text-sm font-medium text-foreground">{CATEGORY_LABEL[r.category]}</span>
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {r.days !== null ? `${r.days}일 전 값 기준` : "갱신 기록 없음"}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      <Button data-testid="prep-ics-button" variant="brand" className="w-full min-h-10" onClick={downloadIcs}>
        캘린더에 매월 결산일 추가
      </Button>
      <p data-testid="prep-ics-note" className={CAPTION}>캘린더 앱에서 매월 말일 저녁에 반복 일정을 추가해 주세요</p>
    </section>
  );
}
