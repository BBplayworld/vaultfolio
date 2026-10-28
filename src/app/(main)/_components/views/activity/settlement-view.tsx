"use client";

// 자산 변화 · 전체 · 월 탭 = 월말 결산(#32). 블록 1 헤더 · 2 순자산 비교 · 3 변화 원인 · 7 다음 달 준비.
// 계산은 전부 기기 안(로컬 스냅샷 + 엔진 래퍼). 서버로 보내는 값 없음 — GA는 source·result 열거형만.

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, CalendarPlus, ChevronRight, ListChecks, Scale } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAssetData } from "@/contexts/asset-data-context";
import { formatPriceByMode } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import { readMonthlySnapshots } from "@/lib/asset/snapshot-storage";
import { readExchangeHistory } from "@/lib/finance/profit-utils";
import { buildLiveAttributionCurr, computeAttributionBetween } from "@/lib/report/asset-report";
import {
  buildSettlementIcs, formatSettlementPoint, listSettlementMonths, mapSettlementCauses, pickSettlementMonth,
  resolveSettlementWindow, settlementGaResult, settlementRangeLabel, settlementTitle,
  SETTLEMENT_CAUSE_LABEL, type SettlementCauses, type SettlementWindow,
} from "@/lib/report/settlement";
import { daysSinceRefresh, getStaleCategories, type RefreshCategory } from "@/lib/asset/asset-refresh-status";
import { track } from "@/lib/analytics/ga";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { InfoHint } from "../../layout/ui/info-hint";
import { SECTION, GROUP_BADGE, SectionHeader, SpecRow } from "../../layout/ui/report-section";
import { CATEGORY_LABEL } from "../home/home-tip-box";

const kstToday = () => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
const signed = (v: number) => `${v >= 0 ? "+" : ""}${formatPriceByMode(v)}`;
const BADGE = "shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground";
const CAPTION = "text-sm text-muted-foreground text-pretty";

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
  const summary = getAssetSummary();
  const today = kstToday();
  // snapshotVersion이 바뀌면(저장·복원) 다시 읽는다
  const monthly = useMemo(() => (snapshotVersion >= 0 ? readMonthlySnapshots() : []), [snapshotVersion]);
  const [month, setMonth] = useState(() => initialMonth ?? pickSettlementMonth(readMonthlySnapshots(), kstToday()));

  const computed = useMemo((): { ok: true; value: SettlementResult } | { ok: false } => {
    try {
      const w = resolveSettlementWindow(monthly, month, today);
      const start = w.start;
      const live = buildLiveAttributionCurr(assetData, exchangeRates, summary);
      const prevValue = start?.netAsset ?? 0;
      const currValue = w.end ? w.end.netAsset : summary.netAsset;
      const delta = currValue - prevValue;
      const pct = start && prevValue !== 0 ? (delta / Math.abs(prevValue)) * 100 : null;
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

  // settlement_view — 월 탭 진입(마운트)당 1회. 월 선택기 변경으로는 다시 보내지 않는다.
  const sentRef = useRef(false);
  useEffect(() => {
    if (sentRef.current || !computed.ok) return;
    sentRef.current = true;
    track("settlement_view", { source, result: settlementGaResult(computed.value.window) });
  }, [computed, source]);

  const monthItems = listSettlementMonths(monthly, today);
  const currentYear = today.slice(0, 4);
  const monthOptions = monthItems.map((i) => ({
    value: i.month,
    label: i.month.startsWith(currentYear) ? `${Number(i.month.slice(5))}월` : `${i.month.slice(2, 4)}년 ${Number(i.month.slice(5))}월`,
    testId: "settlement-month-item",
  }));
  const selectorRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // 최신 달이 오른쪽 끝이라 처음 열 때 끝으로 스크롤
    const el = selectorRef.current?.firstElementChild as HTMLElement | null;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  const monthSelector = (
    <div ref={selectorRef} data-testid="settlement-month-select" data-screenshot-hide className="w-full">
      <InlineSelector
        value={month}
        onChange={setMonth}
        options={monthOptions}
        size="lg"
        className="max-w-full overflow-x-auto"
        ariaLabel="결산 달 선택"
        disabledValues={monthItems.filter((i) => !i.enabled).map((i) => i.month)}
        disabledTitle="기록이 없는 달이에요"
      />
    </div>
  );

  const hasAssets = assetData.stocks.length + assetData.crypto.length + assetData.cash.length + assetData.loans.length + assetData.realEstate.length > 0;

  if (!computed.ok) {
    return (
      <div data-testid="settlement-root" className="flex flex-col gap-3">
        {monthSelector}
        <p data-testid="settlement-error" className={`${SECTION} text-center ${CAPTION}`}>결산을 불러오지 못했어요. 다른 달을 선택해 보세요</p>
      </div>
    );
  }

  const { window: w, prevValue, currValue, delta, pct, mapped, estimatedLabel } = computed.value;
  const stale = getStaleRows(assetData).length > 0;

  if (monthly.length === 0 || !hasAssets) {
    return (
      <div data-testid="settlement-root" className="flex flex-col gap-3">
        <p data-testid="settlement-empty" className={`${SECTION} text-center ${CAPTION}`}>
          아직 기록된 달이 없어요. 앱을 계속 쓰면 다음 달부터 결산이 열려요
        </p>
      </div>
    );
  }

  return (
    <div data-testid="settlement-root" className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {/* 블록 1 — 헤더 */}
      <section className={SECTION}>
        <SectionHeader icon={CalendarCheck} title={settlementTitle(w)} titleTestId="settlement-title">
          {w.kind === "in_progress" && (
            <span data-testid="settlement-inprogress" className={GROUP_BADGE}>진행 중</span>
          )}
        </SectionHeader>
        {w.kind !== "first_month" && (
          <p data-testid="settlement-range" className={`${CAPTION} tabular-nums`}>{settlementRangeLabel(w)} 기준</p>
        )}
        {w.longGap && (
          <p data-testid="settlement-gap-note" className={CAPTION}>기록 간격이 길어 {w.gapDays}일 구간이에요</p>
        )}
        {monthSelector}
      </section>

      {w.kind === "first_month" ? (
        <p data-testid="settlement-first-month" className={`${SECTION} text-center ${CAPTION}`}>다음 달부터 결산이 열려요</p>
      ) : (
        <>
          <ComparisonBlock window={w} prevValue={prevValue} currValue={currValue} delta={delta} pct={pct} stale={stale} />
          <CauseBlock mapped={mapped} estimatedLabel={estimatedLabel} />
        </>
      )}

      <PrepBlock />
    </div>
  );
}

// 블록 2 — 순자산 비교
function ComparisonBlock({ window, prevValue, currValue, delta, pct, stale }: {
  window: SettlementWindow; prevValue: number; currValue: number; delta: number; pct: number | null; stale: boolean;
}) {
  const prevLabel = formatSettlementPoint(window.startDate, window.startLegacy ? window.start!.month : undefined);
  const currLabel = formatSettlementPoint(window.endDate, window.endLegacy ? window.end!.month : undefined);
  return (
    <section className={SECTION}>
      <SectionHeader icon={Scale} title="순자산 비교" tone="important" />
      <SpecRow label={`지난 기록 (${prevLabel})`}>
        <span data-testid="settlement-prev-value" data-value={Math.round(prevValue)}>{formatPriceByMode(prevValue)}</span>
      </SpecRow>
      <SpecRow label={`이번 기록 (${currLabel})`}>
        <span data-testid="settlement-curr-value" data-value={Math.round(currValue)} className="font-bold">{formatPriceByMode(currValue)}</span>
      </SpecRow>
      <div className="border-t border-border/40 pt-3">
        <p data-testid="settlement-delta" data-value={Math.round(delta)} className={`text-lg font-bold tabular-nums ${getProfitLossColor(delta)}`}>
          {signed(delta)}{pct !== null && ` (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%)`}
        </p>
        {stale && <p data-testid="settlement-stale-note" className={`${CAPTION} mt-1`}>일부 자산은 이전 값 기준이에요</p>}
      </div>
    </section>
  );
}

const CAUSE_TESTID: Record<string, string> = {
  price: "cause-row-price", valuation: "cause-row-valuation", fx: "cause-row-fx", income: "cause-row-income", unrecorded: "cause-row-unrecorded",
};

// 블록 3 — 변화 원인(5항목). 매수·매도·상환 문구는 쓰지 않는다.
function CauseBlock({ mapped, estimatedLabel }: { mapped: SettlementCauses; estimatedLabel: string }) {
  return (
    <section className={SECTION}>
      <SectionHeader icon={ListChecks} title="변화 원인" badge={<span className={GROUP_BADGE}>무엇이 바꿨나요</span>} />
      {mapped.causes.length === 0 ? (
        <p className={CAPTION}>뚜렷한 변화 원인이 없어요</p>
      ) : (
        mapped.causes.map((c) => (
          <div key={c.key} data-testid={CAUSE_TESTID[c.key]} data-value={c.amount}>
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
    <section className={SECTION} data-screenshot-hide>
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
