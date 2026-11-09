"use client";

// 월별 기록 시트(#127, 4.67) — 달마다 한 줄(월·기록일·가진 자산군 금액·순자산), 최신순. 읽기 전용(닫기 외 누를 것 없음).
// 줄 조립은 buildMonthlyLog(lib/report/monthly-log.ts). 증감·%·비중·손익 색 없음. 서버 전송·저장 없음.

import { XIcon } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Z_LAYER } from "@/config/theme";
import { cn } from "@/lib/utils";
import {
  formatMonthlyLogAmount, MONTHLY_LOG_DEBT_KEYS, MONTHLY_LOG_LABELS,
  type MonthlyLog, type MonthlyLogKey, type MonthlyLogRow,
} from "@/lib/report/monthly-log";
import { GROUP_BADGE } from "../../layout/ui/report-section";
import { settlementName } from "./change-hero";

export const MONTHLY_LOG_CAPTION = "그 달 마지막으로 앱을 연 날, 그때까지 맞춘 값이에요";
const NOTE = "text-sm text-muted-foreground text-pretty break-keep mt-1";
// sticky 칸·머리줄은 시트 면과 같은 불투명 면(가로·세로 스크롤 시 뒤 글자가 비치지 않게)
const SURFACE = "bg-background dark:bg-popover";
// 경계선 2종(ui-review): 고정 칸·머리줄 경계 = 불투명 border(가로 스크롤 시 겹침 경계), 행 구분 = 중립 헤어라인.
// 한 칸에 두 경계가 겹쳐도 색이 섞이지 않게 변(side)별 색 클래스로 지정
const EDGE_R = "border-r border-r-border";
const EDGE_B = "border-b border-b-border";
const ROW_B = "border-b border-b-border dark:border-b-border/40";
// sticky 겹침 순서(§3.4 Z_LAYER): 월 머리 칸 > 머리줄·월 열 > 본문
const Z_EDGE = { zIndex: Z_LAYER.base };
const Z_CORNER = { zIndex: Z_LAYER.raised };

function Amount({ value, debt }: { value: number; debt?: boolean }) {
  return (
    <>
      <span className="sm:hidden">{formatMonthlyLogAmount(value, "short", debt)}</span>
      <span className="hidden sm:inline">{formatMonthlyLogAmount(value, "full", debt)}</span>
    </>
  );
}

function MonthCell({ row, today }: { row: MonthlyLogRow; today: string }) {
  return (
    <th
      scope="row"
      className={`sticky left-0 w-14 min-w-14 px-1 py-2 text-left align-top font-normal whitespace-normal break-keep ${EDGE_R} ${SURFACE}`}
      style={Z_EDGE}
    >
      <span className="block font-medium text-foreground">{settlementName(row.month, today, false)}</span>
      {/* 레거시 'YYYY-MM 기록'은 56px 열에서 '2026-'/'08 기록'으로 줄바꿈 허용(nowrap이면 열이 63px로 넓어져 375 무스크롤 깨짐) */}
      {row.kind !== "gap" && <span className="block text-xs text-muted-foreground">{row.recordLabel}</span>}
      {/* 배지 기본 px-1.5 → px-1: 월 열이 56px 안에 들어가 375px 자산군 4개 무스크롤 유지 */}
      {row.kind !== "gap" && row.current && <span className={cn(GROUP_BADGE, "mt-0.5 whitespace-nowrap px-1")}>진행 중</span>}
    </th>
  );
}

function LogRow({ row, columns, today, last }: { row: MonthlyLogRow; columns: MonthlyLogKey[]; today: string; last: boolean }) {
  const cell = `px-1 py-2 align-top ${last ? "" : ROW_B}`;
  if (row.kind === "gap") {
    return (
      <tr data-testid={`monthly-log-row-${row.month}`} data-kind="gap">
        <MonthCell row={row} today={today} />
        <td colSpan={columns.length + 1} className={`${cell} text-left text-muted-foreground`}>
          <span className={`sticky left-14 inline-block px-1 ${SURFACE}`}>기록 없음</span>
        </td>
      </tr>
    );
  }
  return (
    <tr data-testid={`monthly-log-row-${row.month}`} data-kind={row.kind} data-current={row.current ? "" : undefined}>
      <MonthCell row={row} today={today} />
      <td
        data-testid={`monthly-log-cell-${row.month}-netAsset`}
        className={`${cell} text-right font-semibold text-foreground ${EDGE_R}`}
      >
        <Amount value={row.netAsset} />
      </td>
      {columns.map((k) => (
        row.kind === "full" ? (
          <td key={k} data-testid={`monthly-log-cell-${row.month}-${k}`} className={`${cell} min-w-[52px] text-right text-foreground`}>
            <Amount value={row.values[k]} debt={MONTHLY_LOG_DEBT_KEYS.has(k)} />
          </td>
        ) : (
          <td key={k} data-testid={`monthly-log-cell-${row.month}-${k}`} aria-label="종류별 기록 없음" className={`${cell} min-w-[52px] text-right text-muted-foreground`}>—</td>
        )
      ))}
    </tr>
  );
}

/** 표 본체(단일 스크롤 컨테이너 — sticky 머리줄·월 열만 고정, 순자산(월 다음 2번째 열)·자산군은 함께 가로 이동). 시트 열린 채 갱신돼도 key 없이 같은 노드라 스크롤 유지 */
export function MonthlyLogTable({ log, today }: { log: MonthlyLog; today: string }) {
  const { rows, columns } = log;
  const head = `sticky top-0 px-1 py-2 text-xs font-medium text-muted-foreground ${EDGE_B} ${SURFACE}`;
  return rows.length === 0 ? (
    <p data-testid="monthly-log-empty" className="py-8 text-center text-sm text-muted-foreground">기록된 달이 없어요</p>
  ) : (
    <div
      data-testid="monthly-log-table"
      tabIndex={0}
      aria-label="월별 기록 표"
      className="max-h-[60dvh] overflow-auto rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 sm:max-h-[65dvh]"
    >
      <table className="w-full border-separate border-spacing-0 text-sm tabular-nums whitespace-nowrap">
        <caption className="sr-only">월별 자산군 금액</caption>
        <thead>
          <tr>
            <th scope="col" data-testid="monthly-log-head-month" className={`${head} left-0 w-14 min-w-14 text-left ${EDGE_R}`} style={Z_CORNER}>월</th>
            <th scope="col" data-testid="monthly-log-head-netAsset" className={`${head} text-right ${EDGE_R}`} style={Z_EDGE}>순자산</th>
            {columns.map((k) => (
              <th
                key={k}
                scope="col"
                data-testid={`monthly-log-head-${k}`}
                className={`${head} min-w-[52px] text-right whitespace-normal break-keep`}
                style={Z_EDGE}
              >
                {k === "tenantDeposit" ? <>임차<wbr />보증금</> : MONTHLY_LOG_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <LogRow key={r.month} row={r} columns={columns} today={today} last={i === rows.length - 1} />)}
        </tbody>
      </table>
    </div>
  );
}

export function MonthlyLogSheet({ open, onOpenChange, log, today }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: MonthlyLog;
  today: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        hideClose
        data-testid="monthly-log-sheet"
        className="max-h-[85dvh] gap-0 overflow-x-clip pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:animate-none!"
      >
        {/* 닫기 X — 기본 X와 같은 위치·크기, 히트영역만 40px로 확장. Tab 순서상 표보다 앞 */}
        <SheetClose
          className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 after:absolute after:-inset-2.5 after:content-['']"
          aria-label="닫기"
        >
          <XIcon className="size-5 sm:size-6" aria-hidden />
        </SheetClose>
        <div className="mx-auto flex w-full max-w-[1040px] min-h-0 min-w-0 flex-col overflow-x-clip">
          <SheetHeader className="gap-0 p-0 px-4 pt-4 lg:px-6">
            <SheetTitle className="pr-10 text-base font-bold text-balance">월별 기록</SheetTitle>
            <SheetDescription data-testid="monthly-log-caption" className={NOTE}>{MONTHLY_LOG_CAPTION}</SheetDescription>
            {log.hasNetOnly && <p data-testid="monthly-log-note-legacy" className={NOTE}>—인 달은 순자산만 기록돼 있어요</p>}
            {log.atLimit && <p data-testid="monthly-log-note-limit" className={NOTE}>최근 13개월까지 보여요</p>}
          </SheetHeader>
          <div className="mt-3 min-w-0 overflow-x-clip px-2 lg:px-6">
            <MonthlyLogTable log={log} today={today} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
