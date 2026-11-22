"use client";

// 투자 탭 본문(#263): 지수 선택 → 머리 3줄 → 읽기 줄 → 그림 3층(+겹쳐 보기) → 크게 빠진 때 → 연도별 표 → ③ → 출처 4줄.
// 앱 투자 탭과 공개 가이드(`/guide/market-history`)가 이 컴포넌트 1벌을 그대로 쓴다. 데이터는 정적 번들(네트워크·저장 0).
// 앱에서는 next/dynamic으로 진입 때만 불러온다(invest-lazy.tsx) — 이 파일과 lib/invest 데이터는 첫 화면 번들에 넣지 않는다.
import { Check, ChevronDown, ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useMemo, useRef, useState } from "react";
import { InlineSelector } from "../../layout/ui/inline-selector";
import { buildIndexView, INDEX_KEYS, INDEX_META } from "@/lib/invest/calc";
import type { IndexKey } from "@/lib/invest/types";
import { QUESTION_HEAD, headlineLines, READOUT_HINT, readoutOf, sourceLines, fmtPct } from "@/lib/invest/text";
import { marketHistory } from "@/lib/invest/market-history";
import { getProfitLossColor } from "@/config/theme";
import { track } from "@/lib/analytics/ga";
import { PeriodCard } from "./period-card";
import { NOWRAP_TAIL, NOWRAP_YEAR_SUFFIX, NoBreak, ReadoutChips } from "./nowrap";
import { YearGrid } from "./year-grid";
import { defaultPeriod } from "@/lib/invest/period";
import { DropList, EpisodeDetail } from "./drop-list";
import { capWidth, layoutMain, MainChart } from "./main-chart";
import { useElementWidth, useMediaQuery, useMounted } from "./use-width";
import { YearTable } from "./year-table";
import { PatternSection } from "./pattern-section";
import { RiseDetail, RiseList } from "./rise-list";
import { buildPattern } from "@/lib/invest/pattern";

const OVERLAY = {
  us: { label: "10년물", full: "미 10년물 국채 금리", def: "매달 마지막 날 값" },
  kr: { label: "10년물", full: "국고채 10년 금리", def: "매달 평균" },
} as const;
const INDEX_OPTIONS = INDEX_KEYS.map((k) => ({ value: k, label: INDEX_META[k].label, testId: `invest-index-${k}` }));

/** 층 높이를 고정한 스켈레톤(회색 면 3개, CLS 0) */
export function ChartSkeleton({ wide }: { wide: boolean }) {
  const h = layoutMain(buildIndexView(marketHistory, "spx"), 326, wide);
  return (
    <div data-testid="invest-chart-skeleton" aria-hidden className="flex flex-col gap-3" style={{ minHeight: h.H + 44 }}>
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

/** 캡션 옆 ⓘ — 마우스 오버가 아니라 탭·키보드로 여는 설명(Popover). 눈에 보이는 크기 24px, 버튼(히트영역) 40×40 */
function InfoDot({ left, top, label, children }: { left: number; top: number; label: string; children: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" aria-label={label} data-testid="invest-info" style={{ left: left - 8, top: top - 8 }} className="group absolute z-[1] inline-flex size-10 items-center justify-center rounded-full text-muted-foreground outline-none">
          <span className="inline-flex size-6 items-center justify-center rounded-full group-focus-visible:ring-2 group-focus-visible:ring-ring/50"><Info aria-hidden className="size-3.5" /></span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 text-xs leading-relaxed text-pretty break-keep">{children}</PopoverContent>
    </Popover>
  );
}

function SourcePanel({ lines }: { lines: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1">
      <button type="button" aria-expanded={open} aria-controls="invest-source-panel" data-testid="invest-source-button" onClick={() => setOpen((o) => !o)} className="inline-flex min-h-10 items-center gap-1 rounded-md text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
        출처·라이선스 · <span className="whitespace-nowrap">CC BY-SA 4.0</span><Info aria-hidden className="size-3.5" />
        <ChevronDown aria-hidden className={`size-3.5 motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div id="invest-source-panel" {...(open ? {} : { inert: true })} className={`grid motion-safe:transition-[grid-template-rows,visibility] motion-safe:duration-200 ${open ? "visible grid-rows-[1fr]" : "invisible grid-rows-[0fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div data-testid="invest-source" className="space-y-1.5 pb-1 pt-1 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">
            {lines.map((t, i) => <p key={i}><NoBreak text={t} /></p>)}
          </div>
        </div>
      </div>
    </div>
  );
}

export interface InvestViewProps {
  /** 공개 가이드면 SSR HTML에 지수 수준값을 넣지 않는다(그림·읽기·표는 마운트 뒤) */
  variant?: "app" | "guide";
  /** 기본 지수(내 자산 판정은 호출부가 한다 — 이 컴포넌트는 값을 저장·전송하지 않는다) */
  defaultIndex?: IndexKey;
  /** 진행 중 하락 모의(데이터 마지막 연도를 이 해로 자름). preview 점검용 */
  asof?: number;
}

type InvestCategory = "invest_rise_tab" | "invest_pattern" | "invest_index_spx" | "invest_index_ndx" | "invest_index_kospi" | "invest_overlay" | "invest_table" | "invest_calc" | "invest_year_pick" | "invest_drop_open";

export function InvestView({ variant = "app", defaultIndex = "spx", asof }: InvestViewProps) {
  const [idx, setIdx] = useState<IndexKey>(defaultIndex);
  const [sel, setSel] = useState<number | null>(null);
  const [yr, setYr] = useState<number | null>(null);
  const [ovOn, setOvOn] = useState(false);
  const [menu, setMenu] = useState(false);
  const [listTab, setListTab] = useState<"drop" | "rise">("drop");
  const [riseSel, setRiseSel] = useState<number | null>(null);
  const [periodOverride, setPeriodOverride] = useState<{ sy: number; ey: number } | null>(null);
  const mounted = useMounted();
  const wide = useMediaQuery("(min-width: 1280px)");
  const chartRef = useRef<HTMLDivElement>(null);
  const width = useElementWidth(chartRef);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const view = useMemo(() => buildIndexView(marketHistory, idx, asof), [idx, asof]);
  const pattern = useMemo(() => buildPattern(marketHistory, view), [view]);
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
    setIdx(k); setSel(null); setYr(null); setOvOn(false); setMenu(false); setRiseSel(null); setPeriodOverride(null);
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
    setYr(y); once("invest_year_pick");
    const k = view.eps.findIndex((e) => y > e.py && y <= e.ty);
    if (k >= 0) setSel(k);
  };
  // 하락 행 펼침(닫기는 집계하지 않는다) — 연도·금액 인자 없음
  const openDrop = (k: number | null) => { setSel(k); if (k != null) once("invest_drop_open"); };
  // D-1: 해 스테퍼 — 기존 pickYear만 호출한다(상태 신설 0). 선택이 없으면 어느 쪽이든 마지막 해부터
  const stepYear = (d: 1 | -1) => pickYear(yr == null ? view.last : Math.max(view.start + 1, Math.min(view.last, yr + d)));
  const stepCls = "inline-flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground outline-none motion-safe:transition-[background-color,transform] motion-safe:duration-150 active:scale-[0.96] focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-40 disabled:active:scale-100";
  const ro = yr != null ? readoutOf(view, yr) : null;
  const listW = width || 300;

  const changeTab = (t: "drop" | "rise") => { setListTab(t); if (t === "rise") once("invest_rise_tab"); };
  const riseDetailYear = riseSel ?? pattern.rise[pattern.rise.length - 1]?.y ?? null;
  const period = periodOverride ?? defaultPeriod(view);
  const onPeriod = (p: { sy: number; ey: number }) => { setPeriodOverride(p); once("invest_calc"); };
  const listSegment = (
    <div>
      <InlineSelector fullWidth value={listTab} onChange={changeTab} ariaLabel="목록 선택" options={[{ value: "drop", label: `크게 빠진 때 ${view.eps.length}`, testId: "list-tab-drop" }, { value: "rise", label: `크게 오른 해 ${pattern.rise.length}`, testId: "list-tab-rise" }]} />
    </div>
  );
  const listBody = (inline: boolean) => (listTab === "drop"
    ? <DropList data={marketHistory} view={view} sel={selEff} yr={yr} onSelect={openDrop} inlineDetail={inline} width={inline ? listW : 376} bare />
    : <RiseList view={view} pattern={pattern} selYear={inline ? riseSel : riseDetailYear} onSelect={setRiseSel} inlineDetail={inline} />);

  const chartCard = (
    <div className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none" data-testid="invest-sec1">
      <div data-testid="invest-headline">
        <p className="text-lg font-bold leading-snug text-balance break-keep">{head.l1}</p>
        {head.l2 && <p className="mt-1 text-sm text-muted-foreground text-pretty break-keep">{head.l2.lead}<b className="font-semibold text-foreground">{head.l2.bold}</b>{head.l2.rest}</p>}
        {/* R3: 모바일은 base 줄을 `크게 빠진 때` 카드 각주로 옮긴다(첫 화면 숫자 예산). 1280은 현행 */}
        {wide && <p data-testid="invest-base" className="mt-2 text-xs leading-snug text-muted-foreground text-pretty break-keep">{head.l3}</p>}
      </div>
      <div data-testid="invest-readout" aria-live="polite" className="mt-2 min-h-12 max-[359px]:min-h-16">
        {ro && showLevels ? (
          <>
            <div className="flex flex-wrap items-center gap-x-1.5 text-sm" data-testid="readout-main">
              <ReadoutChips ro={ro} />
              {ro.events && <div className="basis-full pt-0.5 text-xs leading-snug break-keep"><span className="text-muted-foreground">사건</span> <NoBreak text={ro.events} phrases={[]} tails={NOWRAP_YEAR_SUFFIX} /></div>}
            </div>
          </>
        ) : <p className="flex h-7 items-center text-xs text-muted-foreground">{READOUT_HINT}</p>}
      </div>
      <div ref={chartRef} className="relative mt-1 min-w-0" data-testid="invest-chart-wrap">
        {L && showLevels ? (
          <>
            <MainChart data={marketHistory} view={view} width={width} wide={wide} selEp={selEff} selYear={yr} overlayOn={ovOn} onPickYear={pickYear} />
            <InfoDot left={capWidth(`지수 · 해마다 연말 값 · ${view.last}년 말까지`) + 2} top={-2} label="지수 값 설명">가격 지수(배당 제외)이고, 해마다 마지막 날(연말) 종가 기준이에요. 한 해 안의 움직임은 담지 않아요.</InfoDot>
            <InfoDot left={capWidth(`${view.rate === "us" ? "미국 기준금리" : "한국 기준금리"} · 매달 값`) + 2} top={L.cap3 - 14} label="기준금리 설명">{view.rate === "us" ? "연준 목표금리(범위면 상단)를 매달 이어서 그렸어요. 1982년 9월부터 자료가 있어요." : "한국은행 기준금리를 매달 이어서 그렸어요(2008년 3월 전은 콜금리 목표). 1999년 5월부터 자료가 있어요."}</InfoDot>
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
                  <span>{on ? OV.full : "겹쳐 보기 안 함"}{on && <small className="mt-px block text-xs font-normal text-muted-foreground">{OV.def} · 오른쪽 축</small>}</span>
                  <Check aria-hidden className={`size-4 text-brand dark:text-indigo-300 ${ovOn === on ? "" : "invisible"}`} />
                </button>
              ))}
            </div>
            <div
              role="group" aria-label="해 이동" data-testid="year-stepper" className="mt-1 flex h-10 items-center justify-center gap-2"
              onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); stepYear(e.key === "ArrowLeft" ? -1 : 1); } }}
            >
              <button type="button" aria-label="이전 해" data-testid="year-prev" disabled={yr != null && yr <= view.start + 1} onClick={() => stepYear(-1)} className={stepCls}><ChevronLeft aria-hidden className="size-5" /></button>
              <span data-testid="year-stepper-label" className={yr != null ? "min-w-[4.5rem] text-center text-base font-semibold tabular-nums" : "min-w-[4.5rem] text-center text-xs text-muted-foreground"}>{yr != null ? `${yr}년` : "해 고르기"}</span>
              <button type="button" aria-label="다음 해" data-testid="year-next" disabled={yr != null && yr >= view.last} onClick={() => stepYear(1)} className={stepCls}><ChevronRight aria-hidden className="size-5" /></button>
            </div>
          </>
        ) : <ChartSkeleton wide={wide} />}
      </div>
    </div>
  );

  const src = sourceLines(view, { spx: marketHistory.idx.spx.rev, ndx: marketHistory.idx.ndx.rev, kospi: marketHistory.idx.kospi.rev });
  const dropsCard = (
    <div data-testid="invest-drops" className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none">
      <p data-testid="q-drops" className="mb-2 text-xs text-muted-foreground text-balance break-keep">{QUESTION_HEAD.drops}</p>
      <h3 className="text-base font-bold">크게 빠진 때</h3>
      <DropList data={marketHistory} view={view} sel={selEff} yr={yr} onSelect={setSel} inlineDetail width={listW} bare />
      <p data-testid="invest-base" className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty break-keep">{head.l3}</p>
      <div className="mt-4 border-t border-border/60 pt-3">
        <h3 className="text-base font-bold">크게 오른 해<small className="ml-2 text-xs font-normal text-muted-foreground">한 해에 20% 넘게 오른 해 {pattern.rise.length}번</small></h3>
        <RiseList view={view} pattern={pattern} selYear={riseSel} onSelect={setRiseSel} inlineDetail limit={1} onMore={() => once("invest_rise_tab")} />
        <p data-testid="rise-answer" className="mt-2 text-xs leading-relaxed text-muted-foreground text-pretty break-keep"><NoBreak text={pattern.lines[2]} phrases={[]} tails={NOWRAP_TAIL} /></p>
      </div>
    </div>
  );
  const deeperCard = (
    <div data-testid="invest-deeper" className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none">
      <h3 className="text-base font-bold">더 깊이 보기</h3>
      <PatternSection key={`p-${idx}`} pattern={pattern} last={view.last} onOpen={() => once("invest_pattern")} />
      <YearTable key={idx} view={view} onOpen={() => once("invest_table")} />
    </div>
  );
  const gridNode = <YearGrid key={`g-${idx}`} onYear={() => once("invest_year_pick")} view={view} period={period} showLevels={showLevels} question={QUESTION_HEAD.grid} />;
  const periodNode = <PeriodCard key={`c-${idx}`} view={view} period={period} onChange={onPeriod} question={QUESTION_HEAD.period} />;
  // 모바일(<768) 섹션 순서 = 질문 순서(P2). 순서·기본 펼침은 이 배열 한 곳에서만 바꾼다(R4.2 결과 반영용).
  // 기본 펼침 4개(P3): 첫 화면·크게 빠진 때·격자·기간 카드. `deeper`(하락 전 12개월·크게 오른 해, 연도별 표)는 접힘(저장 0)
  const MOBILE_SECTIONS: { id: string; node: React.ReactNode }[] = [
    { id: "first", node: chartCard },
    { id: "drops", node: dropsCard },
    { id: "grid", node: gridNode },
    { id: "period", node: periodNode },
    { id: "deeper", node: deeperCard },
  ];
  return (
    <div data-testid="invest-view" data-variant={variant} className="flex min-w-0 flex-col gap-3 xl:mx-auto xl:w-full xl:max-w-[960px] xl:gap-4">
      {/* P4: 지수 선택기 상단 고정(모바일). 체험 배너·PWA safe-area 아래에 붙는다 */}
      <div data-testid="invest-index-sticky" className="sticky top-[max(var(--trial-bar-h,0px),env(safe-area-inset-top,0px))] z-20 -mx-3 -mt-1 bg-background/95 px-3 py-0.5 shadow-[0_1px_0_0_var(--border)] backdrop-blur-md xl:static xl:mx-0 xl:mt-0 xl:shadow-none xl:bg-transparent xl:px-0 xl:py-0 xl:backdrop-blur-none">
        <InlineSelector fullWidth value={idx} onChange={changeIndex} options={INDEX_OPTIONS} ariaLabel="지수 선택" className="w-full" />
      </div>
      {!wide && MOBILE_SECTIONS.map((sec) => <div key={sec.id} data-section={sec.id} className="min-w-0">{sec.node}</div>)}
      {wide && (
        <>
          {chartCard}
          <div className="grid grid-cols-[400px_minmax(0,1fr)] items-stretch gap-4">
            <div className="min-w-0 h-full rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none">{listSegment}{listBody(false)}</div>
            <div data-testid="invest-detail" className="h-full min-w-0 overflow-hidden rounded-2xl bg-card p-4 shadow-sm dark:shadow-none">
              {listTab === "rise" ? (
                pattern.rise.find((r) => r.y === riseDetailYear) ? (
                  <>
                    <div className="mb-1.5 flex items-baseline gap-2 text-base font-bold">{riseDetailYear}년<small className="text-xs font-normal text-muted-foreground">크게 오른 해</small></div>
                    <RiseDetail view={view} r={pattern.rise.find((r) => r.y === riseDetailYear)!} />
                  </>
                ) : <p className="text-sm text-muted-foreground">크게 오른 해가 없었어요</p>
              ) : selEff != null && view.eps[selEff] ? (
                <>
                  <div className="mb-1.5 flex items-baseline gap-2 text-base font-bold">{view.eps[selEff].name}<small className="text-xs font-normal text-muted-foreground">{view.eps[selEff].py}~{view.eps[selEff].ty}년</small></div>
                  <MeasuredDetail view={view} ep={view.eps[selEff]} index={selEff} />
                </>
              ) : <p className="text-sm text-muted-foreground">왼쪽에서 하락을 고르면 그 시기가 보여요</p>}
            </div>
          </div>
          <div className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none"><PatternSection key={`p-${idx}`} pattern={pattern} last={view.last} onOpen={() => once("invest_pattern")} /></div>
          <div className="rounded-2xl bg-card p-4 pb-3 shadow-sm dark:shadow-none"><YearTable key={idx} view={view} onOpen={() => once("invest_table")} /></div>
          <div className="grid grid-cols-[440px_minmax(0,1fr)] items-stretch gap-4"><div className="min-w-0 [&>section]:h-full">{gridNode}</div><div className="min-w-0 [&>section]:h-full">{periodNode}</div></div>
        </>
      )}
      <SourcePanel lines={src} />
    </div>
  );
}

export default InvestView;
