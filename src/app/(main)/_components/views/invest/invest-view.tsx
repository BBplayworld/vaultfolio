"use client";

// 투자 탭 본문(#263): 지수 선택 → 머리 3줄 → 읽기 줄 → 그림 3층(+겹쳐 보기) → 크게 빠진 때 → 연도별 표 → ③ → 출처 4줄.
// 앱 투자 탭과 공개 가이드(`/guide/market-history`)가 이 컴포넌트 1벌을 그대로 쓴다. 데이터는 정적 번들(네트워크·저장 0).
// 앱에서는 next/dynamic으로 진입 때만 불러온다(invest-lazy.tsx) — 이 파일과 lib/invest 데이터는 첫 화면 번들에 넣지 않는다.
import { Check, ChevronDown } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { buildIndexView, INDEX_KEYS, INDEX_META } from "@/lib/invest/calc";
import type { IndexKey } from "@/lib/invest/types";
import { headlineLines, READOUT_HINT, readoutOf, sourceLines, fmtPct } from "@/lib/invest/text";
import { marketHistory } from "@/lib/invest/market-history";
import { getProfitLossColor } from "@/config/theme";
import { track } from "@/lib/analytics/ga";
import { CalcCard } from "./calc-card";
import { DropList, EpisodeDetail } from "./drop-list";
import { layoutMain, MainChart } from "./main-chart";
import { useElementWidth, useMediaQuery, useMounted } from "./use-width";
import { YearTable } from "./year-table";

const OVERLAY = {
  us: { label: "10년물", full: "미 10년물 국채 금리", def: "매달 마지막 날 값" },
  kr: { label: "10년물", full: "국고채 10년 금리", def: "매달 평균" },
} as const;
const INDEX_OPTIONS = INDEX_KEYS.map((k) => ({ value: k, label: INDEX_META[k].label, testId: `invest-index-${k}` }));

/** 층 높이를 고정한 스켈레톤(회색 면 3개, CLS 0) */
export function ChartSkeleton({ wide }: { wide: boolean }) {
  const h = layoutMain(buildIndexView(marketHistory, "spx"), 326, wide);
  return (
    <div data-testid="invest-chart-skeleton" aria-hidden className="flex flex-col gap-3" style={{ minHeight: h.H }}>
      <div className="rounded-xl bg-secondary" style={{ height: h.H1 }} />
      <div className="rounded-xl bg-secondary" style={{ height: h.H2 }} />
      <div className="rounded-xl bg-secondary" style={{ height: h.H3 }} />
    </div>
  );
}

// 1280 상세 패널: 패널 폭을 재서 확대 그림을 그린다(펼침 내용은 390 행 펼침과 같다)
function MeasuredDetail({ view, ep, index }: { view: ReturnType<typeof buildIndexView>; ep: ReturnType<typeof buildIndexView>["eps"][number]; index: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const w = useElementWidth(ref);
  return <div ref={ref} className="min-w-0 w-full">{w > 0 && <EpisodeDetail data={marketHistory} view={view} ep={ep} index={index} width={w} />}</div>;
}

export interface InvestViewProps {
  /** 공개 가이드면 SSR HTML에 지수 수준값을 넣지 않는다(그림·읽기·표는 마운트 뒤) */
  variant?: "app" | "guide";
  /** 기본 지수(내 자산 판정은 호출부가 한다 — 이 컴포넌트는 값을 저장·전송하지 않는다) */
  defaultIndex?: IndexKey;
  /** 진행 중 하락 모의(데이터 마지막 연도를 이 해로 자름). preview 점검용 */
  asof?: number;
}

type InvestCategory = "invest_index_spx" | "invest_index_ndx" | "invest_index_kospi" | "invest_overlay" | "invest_table" | "invest_calc";

export function InvestView({ variant = "app", defaultIndex = "spx", asof }: InvestViewProps) {
  const [idx, setIdx] = useState<IndexKey>(defaultIndex);
  const [sel, setSel] = useState<number | null>(null);
  const [yr, setYr] = useState<number | null>(null);
  const [ovOn, setOvOn] = useState(false);
  const [menu, setMenu] = useState(false);
  const mounted = useMounted();
  const wide = useMediaQuery("(min-width: 1280px)");
  const chartRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(chartRef);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const view = useMemo(() => buildIndexView(marketHistory, idx, asof), [idx, asof]);
  const deepest = useMemo(() => view.eps.reduce((b, e, k, a) => (e.dd < a[b].dd ? k : b), 0), [view]);
  const selEff = sel ?? (wide && view.eps.length ? deepest : null);
  const showLevels = variant === "app" || mounted;
  const head = headlineLines(view);
  const OV = OVERLAY[view.rate];
  const L = width > 0 ? layoutMain(view, width, wide) : null;

  // GA(spec 10절): page_title만(새 파라미터 0). 같은 동작은 진입당 1회, 기본 지수 선택은 보내지 않는다. 체험은 track이 no-op
  const sent = useRef(new Set<InvestCategory>());
  const once = (category: InvestCategory) => {
    if (sent.current.has(category)) return;
    sent.current.add(category);
    track("feature_use", { category });
  };
  const changeIndex = (k: IndexKey) => {
    if (k === idx) return;
    setIdx(k); setSel(null); setYr(null); setOvOn(false); setMenu(false);
    once(`invest_index_${k}`);
  };
  // 그림 바깥을 탭하면 해 선택 해제, 겹쳐 보기 목록은 바깥 탭·Esc로 닫는다
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Node;
      if (yr != null && chartRef.current && !chartRef.current.contains(t)) setYr(null);
      if (menu && !menuRef.current?.contains(t) && !btnRef.current?.contains(t)) setMenu(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape" && menu) { setMenu(false); btnRef.current?.focus(); } };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [yr, menu]);
  useEffect(() => { if (menu) menuRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.focus(); }, [menu]);

  const pickYear = (y: number) => {
    setYr(y);
    const k = view.eps.findIndex((e) => y > e.py && y <= e.ty);
    if (k >= 0) setSel(k);
  };
  const ro = yr != null ? readoutOf(view, yr) : null;
  const listW = width || 300;

  const chartCard = (
    <div className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none" data-testid="invest-sec1">
      <div data-testid="invest-headline">
        <p className="text-lg font-bold leading-snug text-balance break-keep">{head.l1}</p>
        {head.l2 && <p className="mt-1 text-sm text-muted-foreground text-pretty break-keep">{head.l2.lead}<b className="font-semibold text-foreground">{head.l2.bold}</b>{head.l2.rest}</p>}
        <p data-testid="invest-base" className="mt-2 text-2xs leading-snug text-muted-foreground text-pretty break-keep">{head.l3}</p>
      </div>
      <div data-testid="invest-readout" aria-live="polite" className="mt-2 min-h-7">
        {ro && showLevels ? (
          <>
            <div className="flex h-7 items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm">
              <span>{ro.year}년 말 <b className="font-bold tabular-nums">{ro.level}</b></span><span>·</span>
              <b className={`font-bold tabular-nums ${ro.ret == null ? "" : getProfitLossColor(ro.ret)}`}>{ro.ret == null ? "—" : fmtPct(ro.ret)}</b><span>·</span>
              <span className="text-muted-foreground">{ro.dir}</span>
              {ro.recession && <><span>·</span><span className="text-muted-foreground">경기침체</span></>}
            </div>
            {ro.events && <div className="pb-1 text-xs leading-snug"><span className="text-muted-foreground">사건</span> {ro.events}</div>}
          </>
        ) : <p className="flex h-7 items-center text-xs text-muted-foreground">{READOUT_HINT}</p>}
      </div>
      <div ref={chartRef} className="relative mt-1 min-w-0" data-testid="invest-chart-wrap">
        {L && showLevels ? (
          <>
            <MainChart data={marketHistory} view={view} width={width} wide={wide} selEp={selEff} selYear={yr} overlayOn={ovOn} onPickYear={pickYear} />
            <button
              ref={btnRef} type="button" aria-haspopup="listbox" aria-expanded={menu} data-testid="overlay-button"
              onClick={() => setMenu((m) => !m)}
              style={{ top: L.cap3 - 24 }} className="group absolute right-0 flex h-10 min-w-14 items-center justify-end outline-none"
            >
              <span className={`inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full pl-2.5 pr-1.5 text-xs font-semibold transition-[background-color,color,transform] duration-150 group-active:scale-[0.96] group-focus-visible:ring-2 group-focus-visible:ring-ring/50 ${ovOn ? "bg-brand/15 text-brand dark:text-indigo-300" : "bg-secondary text-foreground"}`}>
                {ovOn ? <><i aria-hidden className="inline-block h-0 w-3 rounded-[1px] border-t-2 border-brand" />{OV.label}</> : "겹쳐 보기"}
                <ChevronDown aria-hidden className={`size-3.5 ${ovOn ? "" : "text-muted-foreground"}`} />
              </span>
            </button>
            <div
              ref={menuRef} role="listbox" aria-label="겹쳐 보기 항목" data-testid="overlay-menu" {...(menu ? {} : { inert: true })}
              style={{ top: L.cap3 + 14 }}
              className={`absolute right-0 z-10 w-[236px] origin-top-right rounded-2xl bg-card p-1.5 shadow-[0_0_0_1px_var(--border),0_8px_24px_rgba(16,24,40,.14)] dark:bg-popover dark:shadow-[0_0_0_1px_var(--border),0_8px_24px_rgba(0,0,0,.45)] motion-safe:transition-[opacity,transform,visibility] motion-safe:duration-150 motion-safe:ease-out ${menu ? "visible scale-100 opacity-100" : "invisible -translate-y-1 scale-[0.98] opacity-0"}`}
            >
              {[false, true].map((on) => (
                <button
                  key={String(on)} type="button" role="option" aria-selected={ovOn === on} data-ov={on ? "1" : "0"}
                  onClick={() => { setOvOn(on); setMenu(false); btnRef.current?.focus(); if (on) once("invest_overlay"); }}
                  className={`flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${ovOn === on ? "bg-secondary" : ""}`}
                >
                  <span>{on ? OV.full : "겹쳐 보기 안 함"}{on && <small className="mt-px block text-2xs font-normal text-muted-foreground">{OV.def} · 오른쪽 축</small>}</span>
                  <Check aria-hidden className={`size-4 text-brand dark:text-indigo-300 ${ovOn === on ? "" : "invisible"}`} />
                </button>
              ))}
            </div>
          </>
        ) : <ChartSkeleton wide={wide} />}
      </div>
      {!wide && (
        <>
          <DropList data={marketHistory} view={view} sel={selEff} yr={yr} onSelect={setSel} inlineDetail width={listW} />
          <YearTable key={idx} view={view} onOpen={() => once("invest_table")} />
        </>
      )}
    </div>
  );

  const src = sourceLines(view, { spx: marketHistory.idx.spx.rev, ndx: marketHistory.idx.ndx.rev, kospi: marketHistory.idx.kospi.rev });
  return (
    <div data-testid="invest-view" data-variant={variant} className="flex min-w-0 flex-col gap-3 xl:gap-4">
      <InlineSelector fullWidth value={idx} onChange={changeIndex} options={INDEX_OPTIONS} ariaLabel="지수 선택" className="w-full" />
      {chartCard}
      {wide && (
        <>
          <div className="grid grid-cols-[400px_minmax(0,1fr)] items-start gap-4">
            <div className="min-w-0 rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none"><DropList data={marketHistory} view={view} sel={selEff} yr={yr} onSelect={setSel} inlineDetail={false} width={376} /></div>
            <div data-testid="invest-detail" className="sticky top-3 min-w-0 overflow-hidden rounded-2xl bg-card p-4 shadow-sm dark:shadow-none">
              {selEff != null && view.eps[selEff] ? (
                <>
                  <div className="mb-1.5 flex items-baseline gap-2 text-base font-bold">{view.eps[selEff].name}<small className="text-2xs font-normal text-muted-foreground">{view.eps[selEff].py}~{view.eps[selEff].ty}년</small></div>
                  <MeasuredDetail view={view} ep={view.eps[selEff]} index={selEff} />
                </>
              ) : <p className="text-sm text-muted-foreground">왼쪽에서 하락을 고르면 그 시기가 보여요</p>}
            </div>
          </div>
          <div className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none"><YearTable key={idx} view={view} onOpen={() => once("invest_table")} /></div>
        </>
      )}
      <div className={wide ? "max-w-[560px]" : ""}><CalcCard key={idx} view={view} onFirstChange={() => once("invest_calc")} /></div>
      <div data-testid="invest-source" className="mt-1 space-y-1.5 text-2xs leading-relaxed text-muted-foreground text-pretty break-keep">
        {src.map((t, i) => <p key={i}>{t}</p>)}
      </div>
    </div>
  );
}

export default InvestView;
