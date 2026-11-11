"use client";

// 성과 › 자산 변화 › 시장과 비교(#132) — 지금 보유한 종목의 하루·1주·1개월·올해 가격 등락을 코스피·S&P 500 옆에 둔다.
// 계산은 market-compare.ts(순수 함수), 종목 기준가는 기존 fetchProfitRef 캐시(같은 티커 목록·같은 종가 기준 → 자산 변화와 같은 키),
// 지수는 /api/finance/market-index(기간·종가 기준만 보냄)를 react-query 메모리에만 둔다. 저장 호출·새 저장 키 0, 금액 표시 0.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useAssetData } from "@/contexts/asset-data-context";
import { ASSET_THEME, getProfitLossColor } from "@/config/theme";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { fetchProfitRef, type ProfitBasis } from "@/lib/finance/profit-utils";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import {
  COMPARE_PERIODS,
  COMPARE_PERIOD_LABEL,
  MARKET_INDEX_NAME,
  cellRange,
  classifyHoldings,
  computeMarketCompare,
  computeNotComparedRows,
  formatCompareDiff,
  formatCompareRate,
  rateTenths,
  summarizeCompare,
  type ClassifiedHoldings,
  type CompareMarket,
  type ComparePeriod,
  type CompareRow,
  type CompareSummary,
  type MarketCompareBlock,
  type PeriodCell,
  type PeriodRefs,
} from "@/lib/finance/market-compare";
import { useCompareBasis, useDailyRefToken, useKospiPeerCodes, useMarketIndexRefs } from "@/hooks/use-market-compare";
import { useAssetNavigation, type ChangePeriod } from "../../layout/navigation/navigation-context";
import { InfoHint } from "../../layout/ui/info-hint";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { GROUP_BADGE, SECTION } from "../../layout/ui/report-section";
import { getMultiplier } from "../detail/asset-detail-tabs";

const HAIRLINE = "border-border dark:border-border/40";
const SKELETON = "inline-block h-4 rounded bg-muted motion-safe:animate-pulse";
const LIST_PERIODS = COMPARE_PERIODS.map((p) => ({ value: p, label: COMPARE_PERIOD_LABEL[p], testId: `market-list-period-${p}` }));
// 올해는 자산 변화 연(최근 1년)과 기간이 달라 금액 링크를 두지 않는다
const TO_CHANGE_PERIOD: Record<Exclude<ComparePeriod, "ytd">, ChangePeriod> = { daily: "day", weekly: "week", monthly: "month" };
const YTD_PENDING = "— 올해 첫 종가가 나오면 보여드려요";
const BLOCK_HEAD: Record<CompareMarket, string> = { kr: "코스피와 비교한 국내 주식", us: "S&P 500과 비교한 미국 주식" };
const GROUP_LABEL: Record<CompareMarket, string> = { kr: "국내", us: "미국 (달러)" };
// `자산·채권·금리형` 가운뎃점 양옆 U+2060(WORD JOINER), `S&P 500`은 U+00A0 — 320에서 줄이 `·금리형`으로 시작하지 않게(ui.md r2)
const NOT_COMPARED_REASON = {
  krNonEquity: "해외 자산\u2060·\u2060채권\u2060·\u2060금리형 ETF는 코스피와 비교하지 않아요",
  foreignNonUs: "미국 밖 해외 종목은 S&P\u00A0500과 비교하지 않아요",
} as const;
const BASIS_DETAILS = [
  "기간 중에 산 종목은 사기 전 등락도 들어가요.",
  "미국 종목은 달러 가격 기준이에요. 환율이 빠져서 자산 변화의 하루 값과 달라요.",
  "국내는 주식과 국내 주식형 ETF만 코스피와 비교해요.",
  "코스닥 종목도 코스피와 비교해요.",
  "자산 변화의 국내에는 해외형 ETF가 들어 있어 값이 달라요.",
  "올해는 작년 마지막 거래일 종가부터예요. 올해 산 종목도 1월부터 들고 있던 것으로 계산해요.",
  "자산 변화의 연은 최근 1년 기준이라 올해 값과 달라요.",
];
const KIS_UNAVAILABLE = "점검 중 · 외부 증권 API 점검으로 정보를 불러올 수 없어요";
// 기준가 키가 빠졌으면(요청 한도 등) 60초 뒤 최대 2회 다시 부른다 — 그동안은 조회 중(제외로 세지 않음, A8)
const RETRY_DELAY_MS = 60_000;
const MAX_RETRY = 2;

// 등락 색: 표시 반올림 0이면 부호 없이 muted, 그 밖은 손익색
const rateTone = (rate: number) => (rateTenths(rate) === 0 ? "text-muted-foreground" : getProfitLossColor(rate));

// 종목 기준가 — 기간을 순차로(하루→1주→1개월→올해) 기존 fetchProfitRef로 받는다. 키 없음 = 조회 중
function useStockRefs(tickerList: string, basis: ProfitBasis, enabled: boolean, resetVersion: number, dailyToken: string) {
  const [state, setState] = useState<{ key: string; refs: PeriodRefs; kisUnavailable: boolean }>({ key: "", refs: {}, kisUnavailable: false });
  const [attempt, setAttempt] = useState(0);
  const key = `${basis}:${dailyToken}:${tickerList}:${resetVersion}`;

  useEffect(() => {
    if (!enabled || !tickerList) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const merge = (period: ComparePeriod, partial: ProfitRefResponse) =>
      setState((prev) => {
        const base = prev.key === key ? prev : { key, refs: {}, kisUnavailable: false };
        return { ...base, refs: { ...base.refs, [period]: { ...base.refs[period], ...partial } } };
      });
    const run = async () => {
      const tickers = tickerList.split(",");
      let missing = false;
      for (const period of COMPARE_PERIODS) {
        if (controller.signal.aborted) return;
        let unavailable = false;
        const data = await fetchProfitRef(tickerList, period, {
          signal: controller.signal,
          caller: `market-compare:${period}`,
          basis,
          onProgress: (partial) => merge(period, partial),
          onKisUnavailable: () => {
            unavailable = true;
            setState((prev) => ({ ...(prev.key === key ? prev : { key, refs: {} }), kisUnavailable: true }));
          },
        });
        if (controller.signal.aborted || unavailable) return;
        merge(period, data);
        if (tickers.some((t) => !(t in data))) missing = true;
      }
      if (missing && attempt < MAX_RETRY) timer = setTimeout(() => setAttempt((a) => a + 1), RETRY_DELAY_MS);
    };
    void run();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [enabled, tickerList, basis, key, attempt]);

  const current = state.key === key ? state : { refs: {}, kisUnavailable: false };
  return { refs: current.refs as PeriodRefs, kisUnavailable: current.kisUnavailable };
}

export function MarketCompareView() {
  const { assetData, exchangeRates, dataResetVersion } = useAssetData();
  const { navigate } = useAssetNavigation();
  const { basis, hydrated: basisHydrated } = useCompareBasis();
  const dailyToken = useDailyRefToken();
  const peerCodes = useKospiPeerCodes();

  // 자산 변화(profit-chart)와 같은 티커 목록 → 같은 캐시 키(상장폐지·비상장 제외)
  const tickerList = useMemo(
    () => Array.from(new Set(
      assetData.stocks
        .filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted")
        .map((s) => normalizeTicker(s))
        .filter(Boolean),
    )).sort().join(","),
    [assetData.stocks],
  );

  // 묶음 안 기본 순서 = 평가금 순(휴장 칸·비교하지 않은 종목의 기준가 없음 줄)
  const classified = useMemo<ClassifiedHoldings | null>(() => {
    if (!peerCodes) return null;
    const value = (s: (typeof assetData.stocks)[number]) => s.quantity * (s.currentPrice || 0) * getMultiplier(s.currency, exchangeRates);
    return classifyHoldings([...assetData.stocks].sort((a, b) => value(b) - value(a)), peerCodes);
  }, [assetData, peerCodes, exchangeRates]);

  const { refs: stockRefs, kisUnavailable } = useStockRefs(tickerList, basis, basisHydrated && !!classified, dataResetVersion, dailyToken);
  const indexRefs = useMarketIndexRefs(basis, basisHydrated, dailyToken);

  const blocks = useMemo(
    () => (classified ? computeMarketCompare(classified, stockRefs, indexRefs) : []),
    [classified, stockRefs, indexRefs],
  );
  const summary = useMemo(() => (classified ? summarizeCompare(classified, blocks) : null), [classified, blocks]);

  const [listPeriod, setListPeriod] = useState<ComparePeriod>("weekly");
  const [basisOpen, setBasisOpen] = useState(false);

  const nothingToCompare = !!classified && blocks.length === 0;

  return (
    <div className={`flex flex-col gap-3 sm:gap-4 ${ASSET_THEME.contentPad} motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500`}>
      <div>
        <div className="flex h-11 items-center gap-1.5">
          <h2 className="text-base sm:text-lg lg:text-2xl font-bold text-foreground text-balance">시장과 비교</h2>
          <InfoHint summary="지금 수량을 기간 내내 들고 있었다고 보고 계산해요.">
            <p className="text-pretty break-keep">종목마다 시작 종가 기준 평가액 비중으로 합쳤어요.</p>
            <p className="text-pretty break-keep">배당은 보유 종목과 시장 모두 넣지 않았어요.</p>
          </InfoHint>
        </div>
        <p data-testid="market-definition" className="text-sm leading-relaxed text-muted-foreground text-pretty break-keep">
          지금 보유한 종목을 그대로 들고 있었다고 보고 계산한 가격 등락이에요
        </p>
      </div>

      <section data-testid="market-compare" className={SECTION}>
        {kisUnavailable ? (
          <p className="text-sm text-muted-foreground text-pretty break-keep">{KIS_UNAVAILABLE}</p>
        ) : nothingToCompare ? (
          <>
            <p data-testid="market-empty" className="text-sm font-semibold text-foreground text-pretty break-keep">시장과 비교할 종목이 없어요</p>
            {summary && <CompareNotice summary={summary} />}
          </>
        ) : (
          <>
            <div className={`grid grid-cols-1 gap-y-4 ${blocks.length > 1 ? "sm:grid-cols-2 sm:gap-x-8" : "sm:max-w-md"}`}>
              {blocks.length === 0 ? (
                <MarketBlock market={null} loadingNote={false} />
              ) : (
                blocks.map((b, i) => (
                  <div key={b.market} className={i > 0 ? `border-t ${HAIRLINE} pt-4 sm:border-t-0 sm:border-l sm:pl-8 sm:pt-0` : undefined}>
                    <MarketBlock market={b.market} block={b} count={summary?.blockCounts[b.market]} loadingNote={false} />
                  </div>
                ))
              )}
            </div>
            {/* 조회 중 안내는 카드에 1회(블록마다 그리지 않음, ui-review 권고) */}
            {!summary && <p data-testid="market-loading" className="text-sm text-muted-foreground">기준가 조회 중…</p>}
            {summary && <CompareNotice summary={summary} />}
          </>
        )}
      </section>

      {!kisUnavailable && classified && (blocks.length > 0 || classified.notCompared.length > 0) && (
        <section data-testid="market-list" className={SECTION}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm sm:text-base font-bold text-foreground">종목별</h3>
            <InlineSelector fullWidth value={listPeriod} onChange={setListPeriod} options={LIST_PERIODS} ariaLabel="종목별 기간 선택" className="w-[200px] shrink-0" />
          </div>
          <div key={listPeriod} className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <MarketList blocks={blocks} classified={classified} period={listPeriod} stockRefs={stockRefs} />
          </div>
          {listPeriod !== "ytd" && (
            <button
              type="button"
              data-testid="market-to-change"
              onClick={() => navigate({ type: "activity", tab: "change", init: { scope: "stock", period: TO_CHANGE_PERIOD[listPeriod] } })}
              className={`-mb-2 flex w-full min-h-10 items-center justify-between border-t ${HAIRLINE} pt-1 text-left text-sm text-muted-foreground rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50`}
            >
              <span className="break-keep">금액은 <span className="font-medium text-foreground">자산 변화 › 주식</span>에서</span>
              <ChevronRight aria-hidden className="size-4 shrink-0" />
            </button>
          )}
        </section>
      )}

      <div>
        <button
          type="button"
          data-testid="market-basis-toggle"
          aria-expanded={basisOpen}
          aria-controls="market-basis-detail"
          onClick={() => setBasisOpen((o) => !o)}
          className="inline-flex min-h-10 items-center gap-1 rounded-sm text-sm text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <ChevronDown aria-hidden className={`size-4 motion-safe:transition-transform motion-safe:duration-200 ${basisOpen ? "rotate-180" : ""}`} />
          비교 기준 자세히
        </button>
        <div
          id="market-basis-detail"
          data-testid="market-basis-detail"
          {...(basisOpen ? {} : { inert: true, "aria-hidden": true })}
          className={`grid ease-out motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ${basisOpen ? "grid-rows-[1fr] opacity-100 visible" : "grid-rows-[0fr] opacity-0 invisible"}`}
        >
          <div className="min-h-0 overflow-hidden">
            <ul className="list-disc space-y-1.5 pl-5 pt-1 text-sm leading-relaxed text-muted-foreground break-keep">
              {BASIS_DETAILS.map((t) => <li key={t} className="text-pretty">{t}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 시장 블록(3기간 장부형 표) ───────────────────────────────────

// loadingNote: `기준가 조회 중…`을 이 블록 아래에 그릴지(페이지는 카드에 1회만 그리므로 false로 넘긴다)
export function MarketBlock({ market, block, count, loadingNote = true }: { market: CompareMarket | null; block?: MarketCompareBlock; count?: number; loadingNote?: boolean }) {
  const cells = block ? COMPARE_PERIODS.map((p) => block.periods[p]) : null;
  const loading = !cells || cells.some((c) => c.state === "loading") || count === undefined;
  const indexName = market ? MARKET_INDEX_NAME[market] : "시장";
  const head = !market ? "시장과 비교" : loading ? BLOCK_HEAD[market] : `${BLOCK_HEAD[market]} ${count}종목${market === "us" ? " (달러)" : ""}`;
  const anyFailed = !loading && cells!.some((c) => c.state === "ok" && c.indexState === "failed");
  const anyMismatch = !loading && cells!.some((c) => c.state === "ok" && c.indexState === "dateMismatch");
  const ytdPending = !loading && block?.periods.ytd.state === "pending";

  return (
    <div data-testid="market-block" data-market={market ?? undefined} className="space-y-3">
      {market && !loading && (
        <p className="flex flex-wrap items-baseline gap-x-1.5 break-keep">
          <span className="text-sm font-semibold text-foreground">{BLOCK_HEAD[market]}</span>
          <span className="whitespace-nowrap text-sm text-muted-foreground tabular-nums">{count}종목{market === "us" ? " (달러)" : ""}</span>
        </p>
      )}
      <div
        role="table"
        aria-label={head}
        className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-baseline gap-x-1 gap-y-3 min-[375px]:gap-x-1.5 sm:max-w-md"
      >
        <div role="row" className="contents">
          <span role="columnheader" aria-label="구분" />
          <span role="columnheader" className="text-right text-sm text-muted-foreground">보유 종목</span>
          <span role="columnheader" className="text-right text-sm text-muted-foreground">{indexName}</span>
          <span role="columnheader" className="text-right text-sm text-muted-foreground">차이</span>
        </div>
        <div role="none" className="col-span-4 h-px bg-border dark:bg-border/40" />
        {COMPARE_PERIODS.map((p, i) => {
          const c = loading ? null : cells![i];
          const holdingsOk = c && c.state === "ok" && c.holdingsRate !== null;
          const indexOk = c && c.state === "ok" && c.indexState === "ok" && c.indexRate !== null;
          return (
            <div key={p} role="row" data-period={p} className="contents">
              <div role="rowheader">
                <span className="text-sm font-semibold text-foreground">{COMPARE_PERIOD_LABEL[p]}</span>
                <RowRange cell={c} period={p} />
              </div>
              <ValueCell loading={loading} width="w-12">
                {holdingsOk ? <span className={`text-base font-bold tabular-nums max-[359px]:text-sm ${rateTone(c.holdingsRate!)}`}>{formatCompareRate(c.holdingsRate!)}</span> : <Dash />}
              </ValueCell>
              <ValueCell loading={loading} width="w-10">
                {indexOk ? <span className={`text-sm font-medium tabular-nums ${rateTone(c.indexRate!)}`}>{formatCompareRate(c.indexRate!)}</span> : <Dash />}
              </ValueCell>
              <ValueCell loading={loading} width="w-12">
                {c && c.diffTenths !== null ? <span className="text-sm font-semibold text-foreground tabular-nums">{formatCompareDiff(c.diffTenths)}</span> : <Dash />}
              </ValueCell>
            </div>
          );
        })}
      </div>
      {loading ? (
        loadingNote && <p data-testid="market-loading" className="text-sm text-muted-foreground">기준가 조회 중…</p>
      ) : (anyFailed || anyMismatch || ytdPending) && (
        <div className="space-y-0.5">
          {anyFailed && <p className="text-sm text-muted-foreground text-pretty break-keep">시장 값을 불러오지 못했어요</p>}
          {anyMismatch && <p className="text-sm text-muted-foreground text-pretty break-keep">— 기준일이 달라 비교하지 않았어요</p>}
          {ytdPending && <p data-testid="market-ytd-pending" className="text-sm text-muted-foreground text-pretty break-keep">{YTD_PENDING}</p>}
        </div>
      )}
    </div>
  );
}

// 행 머리 아래 기준 종가 구간 — 375 미만은 `11/3→` / `11/10` 두 줄 고정, 375 이상 한 줄. 자리는 상태와 무관하게 같은 높이로 잡는다.
// 올해는 `25.12.30→26.11.10`(연도 포함), 연초 휴장이면 `집계 전`
function RowRange({ cell, period }: { cell: PeriodCell | null; period: ComparePeriod }) {
  const r = cell ? cellRange(cell, period) : null;
  const cls = "block whitespace-nowrap text-[11px] leading-4 text-muted-foreground tabular-nums";
  if (r?.kind === "holiday") return <span className={cls}>휴장<span className="max-[374px]:block">&nbsp;</span></span>;
  if (r?.kind === "pending") return <span className={cls}>집계 전<span className="max-[374px]:block">&nbsp;</span></span>;
  if (r?.kind === "range") return <span className={cls}>{r.parts[0]}<span className="max-[374px]:block">{r.parts[1]}</span></span>;
  return <span aria-hidden className={`${cls} invisible`}>00.0.0→<span className="max-[374px]:block">00.0.0</span></span>;
}

function ValueCell({ loading, width, children }: { loading: boolean; width: string; children: ReactNode }) {
  return (
    <span role="cell" className="text-right">
      {loading ? <span aria-hidden className={`${SKELETON} ${width} align-middle`} /> : children}
    </span>
  );
}

const Dash = () => <span className="text-sm text-muted-foreground">—</span>;

// 카드 맨 아래 안내 줄 — 비교하지 않은 종목·제외(사유별). 해당할 때만
export function CompareNotice({ summary }: { summary: CompareSummary }) {
  const { notCompared, excluded } = summary;
  if (notCompared.count === 0 && excluded.count === 0) return null;
  return (
    <div data-testid="market-notice" className={`space-y-1 border-t ${HAIRLINE} pt-3`}>
      {notCompared.count > 0 && (
        <p className="text-sm text-muted-foreground text-pretty break-keep">
          <span className="whitespace-nowrap font-semibold text-foreground">비교하지 않은 종목 {notCompared.count}</span>
          {notCompared.reasons.length === 1 ? (
            // 320(359px 이하)은 `비교하지 않은 종목 N` / 이유 줄로 나눈다(어절 `해외`/`자산` 갈림 방지, 4.72 D3). 360 이상은 한 문단 그대로
            <>
              <span className="max-[359px]:hidden"> · </span>
              <span className="max-[359px]:block">{NOT_COMPARED_REASON[notCompared.reasons[0]]}</span>
            </>
          ) : (
            // 이유가 2개면 구분점으로 잇지 않고 이유마다 줄을 나눈다(첫 줄은 개수만)
            notCompared.reasons.map((r) => <span key={r} className="block">{NOT_COMPARED_REASON[r]}</span>)
          )}
        </p>
      )}
      {excluded.count > 0 && (
        <p className="text-sm text-muted-foreground text-pretty break-keep">
          <span className="whitespace-nowrap font-semibold text-foreground">제외 {excluded.count}</span>
          {" · "}
          {excluded.reasons.map((r, i) => (
            <span key={r.label} className="whitespace-nowrap">{i > 0 ? " · " : ""}{r.label} {r.count}</span>
          ))}
        </p>
      )}
    </div>
  );
}

// ── 종목별 목록(시장 줄이 등락률 순서 안에) ──────────────────────

export function MarketList({ blocks, classified, period, stockRefs }: {
  blocks: readonly MarketCompareBlock[];
  classified: ClassifiedHoldings;
  period: ComparePeriod;
  stockRefs: PeriodRefs;
}) {
  const ncRows = computeNotComparedRows(classified.notCompared, period, stockRefs);
  const loading = blocks.some((b) => b.periods[period].state === "loading") || (classified.notCompared.length > 0 && ncRows === null);
  if (loading) {
    return (
      <ul aria-busy className="space-y-0">
        {[0, 1, 2, 3].map((i) => (
          <li key={i} className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? `border-t ${HAIRLINE}` : ""}`}>
            <span className={`${SKELETON} w-24`} />
            <span className={`${SKELETON} w-12`} />
          </li>
        ))}
      </ul>
    );
  }
  const groups: { key: string; label: string; range: ReactNode; rows: CompareRow[] }[] = [];
  for (const b of blocks) {
    const cell = b.periods[period];
    if (cell.rows.length === 0) continue;
    const r = cellRange(cell, period);
    groups.push({
      key: b.market,
      label: GROUP_LABEL[b.market],
      range: r?.kind === "holiday" ? "휴장" : r?.kind === "pending" ? "집계 전" : r?.kind === "range" ? r.parts.join("") : null,
      rows: cell.rows,
    });
  }
  if (ncRows && ncRows.length > 0) groups.push({ key: "nc", label: "비교하지 않은 종목", range: null, rows: ncRows });

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
      {groups.map((g) => (
        <div key={g.key} data-testid="market-list-group" data-group={g.key}>
          <div className="flex items-center justify-between pb-1">
            <span className={GROUP_BADGE}>{g.label}</span>
            {g.range && <span className="text-sm text-muted-foreground tabular-nums">{g.range}</span>}
          </div>
          <ul>
            {g.rows.map((row, i) => {
              if (row.kind === "index") {
                return (
                  <li key="index" data-testid="market-list-index" className="-mx-2 my-1 flex items-center justify-between gap-3 rounded-md bg-muted/40 px-2 py-2">
                    <span className="text-sm font-medium text-muted-foreground">{row.name}</span>
                    {row.rate !== null && <span className={`shrink-0 text-sm font-semibold tabular-nums ${rateTone(row.rate)}`}>{formatCompareRate(row.rate)}</span>}
                  </li>
                );
              }
              const prevIsStock = i > 0 && g.rows[i - 1].kind === "stock";
              return (
                <li key={row.ticker ?? row.name} data-testid="market-list-row" className={`flex items-center justify-between gap-3 py-2.5 ${prevIsStock ? `border-t ${HAIRLINE}` : ""}`}>
                  <span className="min-w-0 truncate text-sm font-semibold text-foreground">{row.name}</span>
                  {row.rate === null ? (
                    <span className="shrink-0 text-sm text-muted-foreground">—</span>
                  ) : (
                    <span className={`shrink-0 text-sm font-medium tabular-nums ${rateTone(row.rate)}`}>{formatCompareRate(row.rate)}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
