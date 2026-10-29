"use client";

// 자산 변화 Hero(#32 r2) — 일·주·월·연·주식 5개 본문이 같은 4단 구조(이름 → 증감 → 시작→끝 → 기간 선택)로 그린다.
// 타이포는 홈 Hero(dashboard.tsx 순자산 헤더)와 같다. views/activity 로컬 전용(카탈로그 미등록).

import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ListChecks } from "lucide-react";
import { formatPriceByMode } from "@/lib/number-utils";
import { getProfitLossColor } from "@/config/theme";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";
import { computeAttributionBetween, type buildLiveAttributionCurr } from "@/lib/report/asset-report";
import { estimateLoanInterest, mapSettlementCauses, SETTLEMENT_CAUSE_LABEL, splitLoanCause, type SettlementCauses, type SettlementWindow } from "@/lib/report/settlement";
import { InfoHint } from "../../layout/ui/info-hint";
import { SECTION, SectionHeader, SpecRow } from "../../layout/ui/report-section";

// 본문 진입 — Hero 숫자는 자리 고정(fade만), Hero 아래 본문만 살짝 올라온다
export const BODY_ENTER = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-300";

const signed = (v: number) => `${v >= 0 ? "+" : ""}${formatPriceByMode(v)}`;

// 월 증감 단일 계산 — 허브 자산 변화 카드와 결산 Hero가 같은 함수를 쓴다(지표 대조표 #5)
export function settlementDelta(w: SettlementWindow, liveNet: number): { prevValue: number; currValue: number; delta: number; pct: number | null } {
  const prevValue = w.start?.netAsset ?? 0;
  const currValue = w.end ? w.end.netAsset : liveNet;
  const delta = currValue - prevValue;
  const pct = w.start && prevValue !== 0 ? (delta / Math.abs(prevValue)) * 100 : null;
  return { prevValue, currValue, delta, pct };
}

// 결산 이름 — "10월 결산"(진행 중·첫 달은 "11월"), 올해가 아니면 "25년 10월 결산"
export function settlementName(month: string, today: string, settled: boolean): string {
  const prefix = month.slice(0, 4) === today.slice(0, 4) ? "" : `${month.slice(2, 4)}년 `;
  return `${prefix}${Number(month.slice(5, 7))}월${settled ? " 결산" : ""}`;
}

export interface ChangeHeroProps {
  title?: ReactNode;         // 없으면 이름 줄 생략(빈 상태)
  titleTestId?: string;
  range?: ReactNode;         // 이름 옆 구간 "9/28 → 10/28"
  badge?: ReactNode;         // 이름 줄 배지(진행 중)
  actions?: ReactNode;       // 이름 줄 오른쪽 끝(월 화살표)
  delta?: number | null;     // null이면 증감 줄 대신 message
  pct?: number | null;
  start?: number;
  end?: number;
  loading?: ReactNode;       // 증감 자리 스켈레톤 + 문구
  message?: ReactNode;       // 오류·빈·첫 달·기록 부족
  aside?: ReactNode;         // 시작→끝 줄 오른쪽(일부 이전 값 배지)
  note?: ReactNode;          // Hero 아래 보조 문구(간격 안내)
  contentKey?: string;       // 바뀌면 숫자 영역만 fade-in(위치 고정)
  period?: ReactNode;        // 기간 선택 — ChangeHeroFrame 밖에서 단독으로 쓸 때만
}

// Hero 틀 — 자산 변화 화면이 1회 렌더한다. 본문(일·주·월·연·주식)의 ChangeHero 내용은 슬롯으로 포털되고
// 기간 선택은 틀 맨 아래에 고정돼 본문 전환에도 다시 마운트되지 않는다(썸이 칸 사이를 미끄러짐)
const HeroSlotContext = createContext<HTMLDivElement | null | undefined>(undefined);

export function ChangeHeroFrame({ period, children }: { period: ReactNode; children: ReactNode }) {
  const [slot, setSlot] = useState<HTMLDivElement | null>(null);
  return (
    <HeroSlotContext.Provider value={slot}>
      <section data-testid="change-hero" className={SECTION}>
        <div>
          <div ref={setSlot} />
          <div className="mt-4">{period}</div>
        </div>
      </section>
      {children}
    </HeroSlotContext.Provider>
  );
}

export function ChangeHero({ title, titleTestId, range, badge, actions, delta = null, pct = null, start, end, loading, message, aside, note, contentKey, period }: ChangeHeroProps) {
  const slot = useContext(HeroSlotContext);
  const content = (
    <>
        {(title || actions) && <div className="flex min-h-10 items-center gap-2">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span data-testid={titleTestId ?? "change-hero-title"} className="text-sm font-semibold text-foreground">{title}</span>
            {range && <span className="text-sm text-muted-foreground tabular-nums">{range}</span>}
          </p>
          {badge}
          {actions && <div className="ml-auto sm:ml-2 flex shrink-0 items-center gap-1">{actions}</div>}
        </div>}

        <div key={contentKey} aria-live="polite" className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
          {loading ? (
            <div data-testid="change-hero-loading" className="mt-1">
              <div className="h-8 w-44 rounded-md bg-muted motion-safe:animate-pulse" />
              <p className="mt-1 text-sm text-muted-foreground">{loading}</p>
            </div>
          ) : delta === null ? (
            message && <div className="mt-1 text-sm text-muted-foreground text-pretty">{message}</div>
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                <p
                  data-testid="change-hero-delta"
                  data-value={Math.round(delta)}
                  className={`text-2xl sm:text-3xl font-bold tabular-nums leading-tight ${getProfitLossColor(delta)}`}
                >
                  {signed(delta)}
                </p>
                {pct !== null && (
                  <span className={`text-base font-bold tabular-nums ${getProfitLossColor(delta)}`}>
                    {pct >= 0 ? "+" : ""}{pct.toFixed(1)}%
                  </span>
                )}
              </div>
              {start !== undefined && end !== undefined && (
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-sm text-muted-foreground tabular-nums">
                    <span data-testid="change-hero-start" data-value={Math.round(start)}>{formatPriceByMode(start)}</span>
                    {" → "}
                    <span data-testid="change-hero-end" data-value={Math.round(end)}>{formatPriceByMode(end)}</span>
                  </p>
                  {aside}
                </div>
              )}
            </>
          )}
          {note && <p className="mt-1 text-sm text-muted-foreground text-pretty">{note}</p>}
        </div>
    </>
  );
  // 틀 안이면 슬롯으로 포털(슬롯 준비 전 첫 렌더는 비움), 틀 밖이면 단독 섹션
  if (slot !== undefined) return slot ? createPortal(content, slot) : null;
  return (
    <section data-testid="change-hero" className={SECTION}>
      <div>
        {content}
        {period && <div className="mt-4">{period}</div>}
      </div>
    </section>
  );
}

// ── 변화 원인(월 탭 = 그 달, 연 탭 = 올해) — 계산·표시 공용(#32 보완) ──

// 구간 (from, to] 현금 거래 존재 여부 — 시작일 당일은 앞 구간 몫(C15)
function hasCashIn(assetData: AssetData, from: string | null, to: string): boolean {
  return !!from && (assetData.cashTransactions ?? []).some((t) => t.date > from && t.date <= to);
}

// 대출 항목 후처리 — 이자 추정(현재 잔액×금리×구간 일수)과 엔진 대출 순증(B)으로 기록 안 된 변화에서 대출 몫만 뗀다
function withLoanCause(
  mapped: SettlementCauses,
  effects: readonly { key: string; amount: number; estimated?: boolean }[],
  assetData: AssetData,
  startDate: string | null,
  endDate: string,
  hasCashRecords: boolean,
): SettlementCauses {
  const debts = effects.filter((e) => e.key === "debt");
  const debtNet = debts.reduce((s, e) => s + e.amount, 0);
  return splitLoanCause(mapped, {
    interest: startDate ? estimateLoanInterest(assetData.loans ?? [], dayDiff(startDate, endDate)) : 0,
    debtIncrease: Math.max(0, -debtNet),
    debtEstimated: debts.some((e) => e.estimated),
    hasCashRecords,
  });
}

const MATCH_DAYS = 3;
const dayDiff = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/**
 * 기록된 출금 ↔ 기록된 매수(주식·코인)·대출 상환 짝짓기(qa R4·R5, cto 판정 b). 구간 (from, to]의 반영 거래만 본다.
 * 출금을 날짜순(같으면 id순)으로, 각 출금은 ±3일 안 후보 중 날짜가 가장 가까운 것부터(같으면 날짜·id순) 남은 금액 한도까지 짝짓는다.
 * 후보 금액은 여러 출금에 나눠 쓸 수 있으나 합계를 넘지 않는다. 금액 허용 오차·메모는 쓰지 않는다. 결정적.
 */
export function matchRecordedTransfers(assetData: AssetData, from: string | null, to: string, rates: { USD: number; JPY: number }): number {
  if (!from) return 0;
  const inWin = (d: string) => d > from && d <= to;
  const krw = (cur: string | undefined) => (cur === "USD" ? rates.USD : cur === "JPY" ? rates.JPY / 100 : 1);
  const outs = (assetData.cashTransactions ?? [])
    .filter((t) => t.reflected && t.type === "withdrawal" && inWin(t.date))
    .map((t) => ({ id: t.id, date: t.date, left: t.amount * krw(t.currency) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const cands = [
    ...(assetData.transactions ?? []).filter((t) => t.reflected && t.type === "buy" && inWin(t.date)).map((t) => ({
      id: `s:${t.id}`, date: t.date,
      // 엔진 reflectedTradeFlow와 같은 환산 — 체결 환율 우선(JPY 100엔당), 없으면 현재 환율
      left: t.quantity * t.price * (t.exchangeRate && t.exchangeRate > 0 ? (t.currency === "JPY" ? t.exchangeRate / 100 : t.currency === "KRW" ? 1 : t.exchangeRate) : krw(t.currency)),
    })),
    ...(assetData.cryptoTransactions ?? []).filter((t) => t.reflected && t.type === "buy" && inWin(t.date)).map((t) => ({ id: `c:${t.id}`, date: t.date, left: t.quantity * t.price })),
    ...(assetData.loanTransactions ?? []).filter((t) => t.reflected && t.type === "repay" && inWin(t.date)).map((t) => ({ id: `l:${t.id}`, date: t.date, left: t.amount })),
  ];
  let matched = 0;
  for (const o of outs) {
    const near = cands
      .filter((c) => c.left > 0 && dayDiff(c.date, o.date) <= MATCH_DAYS)
      .sort((a, b) => dayDiff(a.date, o.date) - dayDiff(b.date, o.date) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (const c of near) {
      if (o.left <= 0) break;
      const m = Math.min(o.left, c.left);
      o.left -= m; c.left -= m; matched += m;
    }
  }
  return matched;
}

/**
 * 구간 원인 5항목 — 월·연이 같은 규칙을 쓴다. 시작일 당일 거래는 앞 구간(앞 달 결산·12월 결산)에 이미 포함이라
 * 제외(includeStartDay=false, C15). deltaNet은 화면 Hero 증감 — 스냅샷 효과와의 차이는 "기록 안 된 변화"로 흡수.
 * 시작이 없거나 끝이 레거시라 분해할 수 없으면 전액을 "기록 안 된 변화"(예측)로 둔다(합계 항등식 유지).
 */
export function computeSettlementCauses({ start, end, live, deltaNet, startDate, endDate, liveCash, exchangeHistory, assetData, rates }: {
  start: MonthlyAssetSnapshot | null;
  end: MonthlyAssetSnapshot | null;          // null = 끝이 오늘 실시간
  live: ReturnType<typeof buildLiveAttributionCurr>;
  deltaNet: number;
  startDate: string | null;
  endDate: string;
  liveCash: number;
  exchangeHistory: Record<string, { USD: number; JPY: number }>;
  assetData: AssetData;
  rates: { USD: number; JPY: number };
}): { mapped: SettlementCauses; estimatedLabel: "예측" | "일부 예측" } {
  const attr = start ? computeAttributionBetween(start, end ?? live, exchangeHistory, assetData, rates, false) : null;
  // 결정 4-4 예외 판정: 시작·끝 현금이 모두 0이고 구간 안 입출금 기록도 없으면 현금 미등록 사용자
  const endCash = end ? end.breakdown?.cash ?? 0 : liveCash;
  const hasCashRecords = (assetData.cashTransactions ?? []).some(
    (t) => !!startDate && t.date >= startDate && t.date <= endDate,
  );
  const cashTracked = (start?.breakdown?.cash ?? 0) > 0 || endCash > 0 || hasCashRecords;
  const effects = attr ? attr.effects : [{ key: "cash" as const, amount: deltaNet, estimated: true }];
  const hasCash = hasCashIn(assetData, startDate, endDate);
  const mapped = withLoanCause(mapSettlementCauses(
    effects,
    {
      deltaNet, cashTracked, matchedTransfer: matchRecordedTransfers(assetData, startDate, endDate, rates),
      hasCashRecords: hasCash, estimatedPriceAsUnrecorded: true,
    },
  ), effects, assetData, startDate, endDate, hasCash);
  return { mapped, estimatedLabel: !attr || attr.estimated ? "예측" : "일부 예측" };
}

/**
 * 연 탭 원인 — 체인 점(앵커 → 올해 enrich 월 …) → 실시간을 구간마다 월 탭과 같은 함수·경계(시작일 제외)로 분해해
 * effects를 이어 붙인다. 실측 구간의 원인은 해당 달 월 탭 원인의 합과 같다. 합계는 deltaNet(Hero 증감)으로 맞춘다.
 */
export function computeChainCauses({ points, live, deltaNet, endDate, liveCash, exchangeHistory, assetData, rates }: {
  points: MonthlyAssetSnapshot[];
  live: ReturnType<typeof buildLiveAttributionCurr>;
  deltaNet: number;
  endDate: string;
  liveCash: number;
  exchangeHistory: Record<string, { USD: number; JPY: number }>;
  assetData: AssetData;
  rates: { USD: number; JPY: number };
}): { mapped: SettlementCauses; estimatedLabel: "예측" | "일부 예측" } {
  const effects: Parameters<typeof mapSettlementCauses>[0] = [];
  let estimatedSegments = 0;
  for (let i = 0; i < points.length; i++) {
    const attr = computeAttributionBetween(points[i], points[i + 1] ?? live, exchangeHistory, assetData, rates, false);
    if (!attr) continue; // 끝점 레거시(체인은 enrich만이라 실시간 끝 외엔 없음) — 차이는 기록 안 된 변화로 흡수
    if (attr.estimated) estimatedSegments++;
    effects.push(...attr.effects);
  }
  const start = points[0];
  const startDate = start ? (start.date ?? null) : null;
  const hasCash = hasCashIn(assetData, startDate, endDate);
  const cashTracked = (start?.breakdown?.cash ?? 0) > 0 || liveCash > 0 || hasCash;
  const mapped = withLoanCause(mapSettlementCauses(
    effects.length ? effects : [{ key: "cash", amount: deltaNet, estimated: true }],
    {
      deltaNet, cashTracked, matchedTransfer: matchRecordedTransfers(assetData, startDate, endDate, rates),
      hasCashRecords: hasCash, estimatedPriceAsUnrecorded: true,
    },
  ), effects, assetData, startDate, endDate, hasCash);
  return { mapped, estimatedLabel: effects.length === 0 || estimatedSegments === points.length ? "예측" : "일부 예측" };
}

const CAUSE_TESTID: Record<string, string> = {
  price: "cause-row-price", valuation: "cause-row-valuation", fx: "cause-row-fx", income: "cause-row-income", loan: "cause-row-loan", unrecorded: "cause-row-unrecorded",
};
// 항목 설명(InfoHint) — 대출에는 "상환"·"매수" 문구를 쓰지 않는다(앱 안 이동은 원인이 아님)
const CAUSE_HINT: Partial<Record<string, string>> = {
  income: "입금에서 출금을 뺀 금액이에요",
  loan: "대출 이자(추정)와, 늘어난 대출 중 자산에 남지 않은 몫이에요",
  unrecorded: "시세·환율·입출금·대출로 설명되지 않고 자산 잔액만 바뀐 금액만 남아요",
};
const CAUSE_BADGE = "shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs font-semibold text-muted-foreground";
const CAUSE_CAPTION = "text-sm text-muted-foreground text-pretty";

// 변화 원인 블록(5항목). 매수·매도·상환 문구는 쓰지 않는다. 다른 점은 입출금 안내의 기간 표현("이번 달"/"올해")뿐
export function CauseBlock({ scope, mapped, estimatedLabel, status }: {
  scope: "month" | "year";
  mapped?: SettlementCauses;
  estimatedLabel?: string;
  status?: "insufficient" | "error";
}) {
  // 예측 행이 2개 이상이면 행마다 같은 배지를 반복하지 않고 제목 옆에 1개만 둔다(연 탭 B안은 첫 구간이 늘 예측, ui-review)
  const groupEstimated = !status && (mapped?.causes.filter((c) => c.estimated).length ?? 0) >= 2;
  return (
    <section data-testid="cause-block" data-scope={scope} className={`${SECTION} ${BODY_ENTER}`}>
      <SectionHeader
        icon={ListChecks}
        title="변화 원인"
        badge={groupEstimated ? <span data-testid="cause-estimated-badge" className={CAUSE_BADGE}>{estimatedLabel}</span> : undefined}
      />
      {status === "insufficient" ? (
        <p data-testid="cause-insufficient" className={CAUSE_CAPTION}>올해 기록이 쌓이면 원인을 나눠 보여드려요</p>
      ) : status === "error" || !mapped ? (
        <p data-testid="cause-error" className={CAUSE_CAPTION}>변화 원인을 불러오지 못했어요</p>
      ) : mapped.causes.length === 0 ? (
        <p className={CAUSE_CAPTION}>뚜렷한 변화 원인이 없어요</p>
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
                  {CAUSE_HINT[c.key] && (
                    <span data-screenshot-hide><InfoHint summary={CAUSE_HINT[c.key]!} /></span>
                  )}
                  {c.estimated && !groupEstimated && <span data-testid="cause-estimated-badge" className={CAUSE_BADGE}>{estimatedLabel}</span>}
                </span>
              }
            >
              <span className={getProfitLossColor(c.amount)}>{signed(c.amount)}</span>
            </SpecRow>
          </div>
        ))
      )}
      {!status && mapped?.showUnrecordedHint && (
        <p data-testid="cause-unrecorded-hint" className={CAUSE_CAPTION}>{scope === "year" ? "올해" : "이번 달"} 입출금을 기록하면 더 정확해져요</p>
      )}
    </section>
  );
}
