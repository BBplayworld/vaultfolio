"use client";

// 월별 기록 블록(#127, 4.67 R3) — 월 탭 구성 블록 아래 SECTION 카드. 달마다 한 줄(월·기록일 / 순자산 원 단위 + 앞 기록 대비 변화 손익색),
// 줄을 누르면 자산군별 금액·순자산 기여 변화 펼침. 줄 조립 buildMonthlyLog, 변화 buildMonthlyLogChanges(lib/report/monthly-log.ts).
// 읽기 전용 — 저장·서버 전송 없음. 선택 달과 무관(월 화살표로 리마운트하지 않게 key 없이 마운트).

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Table2 } from "lucide-react";
import { getProfitLossColor } from "@/config/theme";
import { recordVisit } from "@/lib/feature-usage";
import {
  buildMonthlyLogChanges, formatMonthlyLogAmount, formatMonthlyLogDelta, MONTHLY_LOG_DEBT_KEYS, MONTHLY_LOG_LABELS,
  type MonthlyLog, type MonthlyLogChange, type MonthlyLogRow,
} from "@/lib/report/monthly-log";
import { GROUP_BADGE, SECTION, SectionHeader } from "../../layout/ui/report-section";
import { BODY_ENTER, settlementName } from "./change-hero";

export const MONTHLY_LOG_CAPTION = "금액 아래 숫자는 바로 앞 기록보다 늘거나 줄어든 금액이에요";
/** 처음 보이는 줄 수 — 그 뒤는 '이전 N개월 더 보기' */
export const MONTHLY_LOG_VISIBLE = 6;
const NOTE = "text-sm text-muted-foreground text-pretty break-keep";
const MUTED = "text-sm text-muted-foreground";

type RecordedRow = Exclude<MonthlyLogRow, { kind: "gap" }>;
type FullRow = Extract<MonthlyLogRow, { kind: "full" }>;

/** 변화 금액 색 — 0은 muted(부호·손익색 없음) */
const deltaTone = (v: number) => (Math.round(v) === 0 ? "font-normal text-muted-foreground" : `font-semibold ${getProfitLossColor(v)}`);

function RowDelta({ row, change, today }: { row: RecordedRow; change?: MonthlyLogChange; today: string }) {
  if (!change) {
    return <span data-testid={`monthly-log-delta-${row.month}`} data-first="" className="whitespace-nowrap text-sm text-muted-foreground">첫 기록</span>;
  }
  return (
    <span data-testid={`monthly-log-delta-${row.month}`} data-value={change.net} className="text-sm">
      <span className={`whitespace-nowrap ${deltaTone(change.net)}`}>{formatMonthlyLogDelta(change.net)}</span>
      {change.skipped && (
        <span className="inline-block whitespace-nowrap font-normal text-muted-foreground">&nbsp;· {settlementName(change.vsMonth, today, false)} 대비</span>
      )}
    </span>
  );
}

function RowBody({ row, change, today }: { row: RecordedRow; change?: MonthlyLogChange; today: string }) {
  return (
    <>
      <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-1.5">
        <span className="whitespace-nowrap font-semibold text-foreground">{settlementName(row.month, today, false)}</span>
        {row.current && <span className={`${GROUP_BADGE} whitespace-nowrap`}>진행 중</span>}
        <span className={`basis-full break-keep ${MUTED}`}>{row.recordLabel}</span>
      </span>
      <span className="flex min-w-0 flex-col items-end text-right tabular-nums">
        <span data-testid={`monthly-log-net-${row.month}`} className="whitespace-nowrap text-sm font-semibold text-foreground">
          {formatMonthlyLogAmount(row.netAsset, "full")}
        </span>
        <RowDelta row={row} change={change} today={today} />
      </span>
    </>
  );
}

/** 펼침 패널 — 자산군별 금액(부채 −+절댓값)과 순자산 기여 변화 */
function GroupPanel({ row, prev, change, columns }: {
  row: FullRow; prev?: RecordedRow; change?: MonthlyLogChange; columns: MonthlyLog["columns"];
}) {
  const prevFull = prev?.kind === "full" ? prev : undefined;
  const keys = columns.filter((k) => Math.round(row.values[k]) !== 0 || (prevFull && Math.round(prevFull.values[k]) !== 0));
  const groups = change?.groups ?? null;
  return (
    <div className="space-y-2 rounded-lg bg-muted/50 px-3 py-2">
      {keys.map((k) => {
        const d = groups?.[k];
        return (
          <div
            key={k}
            data-testid={`monthly-log-group-${row.month}-${k}`}
            data-delta={d}
            className="flex items-start justify-between gap-3"
          >
            <span className={`break-keep ${MUTED}`}>{MONTHLY_LOG_LABELS[k]}</span>
            <span className="flex flex-col items-end text-sm tabular-nums whitespace-nowrap sm:flex-row sm:items-baseline sm:gap-4">
              <span className="text-foreground sm:text-right">{formatMonthlyLogAmount(row.values[k], "full", MONTHLY_LOG_DEBT_KEYS.has(k))}</span>
              {/* sm↑ 한 줄 배치: 변화 열 최소 폭(+999,999,999원 ≈110px) → 금액·변화 우측 끝이 모든 줄에서 일치, 10억 이상 변화는 열이 늘어나 넘치지 않음(COO R3 F3). <sm 2줄 배치는 폭 고정 없음 */}
              {d !== undefined && <span className={`sm:min-w-28 sm:shrink-0 sm:text-right ${deltaTone(d)}`}>{formatMonthlyLogDelta(d)}</span>}
            </span>
          </div>
        );
      })}
      {change && !groups && (
        <p data-testid={`monthly-log-panel-note-${row.month}`} className={NOTE}>이전 기록에 종류별 값이 없어 금액만 보여요</p>
      )}
    </div>
  );
}

function MonthRow({ row, prev, change, columns, today, open, onToggle }: {
  row: MonthlyLogRow; prev?: RecordedRow; change?: MonthlyLogChange; columns: MonthlyLog["columns"]; today: string;
  open: boolean; onToggle: (month: string) => void;
}) {
  const hairline = "border-b border-border dark:border-border/40 last:border-b-0";
  if (row.kind === "gap") {
    return (
      <li data-testid={`monthly-log-row-${row.month}`} data-kind="gap" className={`flex min-h-10 items-center gap-2 py-2 ${hairline}`}>
        <span className="flex-1 whitespace-nowrap font-semibold text-foreground">{settlementName(row.month, today, false)}</span>
        <span className={`whitespace-nowrap ${MUTED}`}>기록 없음</span>
        <span aria-hidden className="size-4 shrink-0" />
      </li>
    );
  }
  const rowAttrs = { "data-testid": `monthly-log-row-${row.month}`, "data-kind": row.kind, "data-current": row.current ? "" : undefined };
  if (row.kind === "net-only") {
    return (
      <li {...rowAttrs} className={`py-3 ${hairline}`}>
        <div className="flex items-center gap-2">
          <RowBody row={row} change={change} today={today} />
          <span aria-hidden className="size-4 shrink-0" />
        </div>
        <p className={`mt-1 ${NOTE}`}>종류별 기록 없음</p>
      </li>
    );
  }
  const panelId = `monthly-log-panel-${row.month}`;
  return (
    <li {...rowAttrs} className={hairline}>
      <button
        type="button"
        data-testid={`monthly-log-toggle-${row.month}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onToggle(row.month)}
        className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-2 rounded-lg px-2 py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150"
      >
        <RowBody row={row} change={change} today={today} />
        <span data-screenshot-hide aria-hidden className="flex size-4 shrink-0">
          <ChevronDown className={`size-4 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
        </span>
      </button>
      {/* 항상 마운트 + grid-rows 0fr↔1fr(연타·중간 방향 전환 OK), 접힘은 inert·aria-hidden */}
      <div
        id={panelId}
        data-testid={panelId}
        {...(open ? {} : { inert: true, "aria-hidden": true })}
        className={`grid ease-out motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-3">
            <GroupPanel row={row} prev={prev} change={change} columns={columns} />
          </div>
        </div>
      </div>
    </li>
  );
}

export function MonthlyLogBlock({ log, today }: { log: MonthlyLog; today: string }) {
  const { rows, columns } = log;
  const changes = useMemo(() => buildMonthlyLogChanges(rows), [rows]);
  // 기본: 최신(이번 달) 줄만 펼침. 다중 펼침 허용
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(rows[0]?.kind === "full" ? [rows[0].month] : []));
  const [showAll, setShowAll] = useState(false);
  // 월별 기록 방문(4.83) — 카드가 50% 이상 처음 보일 때 화면 진입당 1회(홈 팁·`새` 표시가 읽는 visitKey `monthly-log`)
  const sectionRef = useRef<HTMLElement>(null);
  const hasRows = rows.length > 0;
  useEffect(() => {
    const el = sectionRef.current;
    if (!hasRows || !el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.5)) {
        recordVisit("monthly-log");
        io.disconnect();
      }
    }, { threshold: [0.5] });
    io.observe(el);
    return () => io.disconnect();
  }, [hasRows]);
  if (rows.length === 0) return null;
  const byMonth = new Map(rows.map((r) => [r.month, r]));
  const toggle = (m: string) => setOpenSet((s) => {
    const next = new Set(s);
    if (next.has(m)) next.delete(m); else next.add(m);
    return next;
  });
  const visible = showAll ? rows : rows.slice(0, MONTHLY_LOG_VISIBLE);
  const hidden = rows.length - visible.length;
  return (
    <section
      id="monthly-log-block"
      data-testid="monthly-log-block"
      ref={sectionRef}
      aria-labelledby="monthly-log-title"
      className={`${SECTION} ${BODY_ENTER}`}
      style={{ animationDelay: "120ms", animationFillMode: "backwards" }}
    >
      <div className="space-y-1">
        <SectionHeader icon={Table2} tone="info" title="월별 기록" titleTestId="monthly-log-title" />
        <p data-testid="monthly-log-caption" className={NOTE}>{MONTHLY_LOG_CAPTION}</p>
        {log.atLimit && <p data-testid="monthly-log-note-limit" className={NOTE}>최근 13개월까지 보여요</p>}
      </div>
      <ul data-testid="monthly-log-rows">
        {visible.map((r) => {
          const change = changes.get(r.month);
          const prev = change ? byMonth.get(change.vsMonth) : undefined;
          return (
            <MonthRow
              key={r.month}
              row={r}
              prev={prev?.kind === "gap" ? undefined : prev}
              change={change}
              columns={columns}
              today={today}
              open={openSet.has(r.month)}
              onToggle={toggle}
            />
          );
        })}
      </ul>
      {hidden > 0 && (
        <button
          type="button"
          data-testid="monthly-log-more"
          data-screenshot-hide
          onClick={() => setShowAll(true)}
          className="w-full min-h-10 rounded-lg text-sm font-medium text-muted-foreground outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150"
        >
          이전 {hidden}개월 더 보기
        </button>
      )}
    </section>
  );
}
