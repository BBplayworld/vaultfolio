"use client";

// 월별 기록 시트(#127, 4.67) — 달마다 한 줄(월·기록일·가진 자산군 금액·순자산), 최신순. 읽기 전용(닫기 외 누를 것 없음).
// 줄 조립은 buildMonthlyLog(lib/report/monthly-log.ts). 증감·%·비중·손익 색 없음. 서버 전송·저장 없음.

import { Fragment } from "react";
import { XIcon } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Z_LAYER } from "@/config/theme";
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
const LINE = "border-border/10";
// sticky 겹침 순서(§3.4 Z_LAYER): 양끝 머리 칸 > 머리줄·양끝 열 > 본문
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
      className={`sticky left-0 w-14 min-w-14 px-1 py-2 text-left align-top font-normal whitespace-normal break-keep border-r ${LINE} ${SURFACE}`}
      style={Z_EDGE}
    >
      <span className="block font-medium text-foreground">{settlementName(row.month, today, false)}</span>
      {/* 'YYYY-MM 기록'이 하이픈에서 끊기지 않게 낱말 단위로만 줄바꿈 */}
      {row.kind !== "gap" && (
        <span className="block text-xs text-muted-foreground">
          {row.recordLabel.split(" ").map((w, i) => <Fragment key={i}>{i > 0 && " "}<span className="whitespace-nowrap">{w}</span></Fragment>)}
        </span>
      )}
      {row.kind !== "gap" && row.current && <span className={`${GROUP_BADGE} mt-0.5 whitespace-nowrap`}>진행 중</span>}
    </th>
  );
}

function LogRow({ row, columns, today, last }: { row: MonthlyLogRow; columns: MonthlyLogKey[]; today: string; last: boolean }) {
  const cell = `px-1 py-2 align-top ${last ? "" : `border-b ${LINE}`}`;
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
      {columns.map((k) => (
        row.kind === "full" ? (
          <td key={k} data-testid={`monthly-log-cell-${row.month}-${k}`} className={`${cell} min-w-[56px] text-right text-foreground`}>
            <Amount value={row.values[k]} debt={MONTHLY_LOG_DEBT_KEYS.has(k)} />
          </td>
        ) : (
          <td key={k} data-testid={`monthly-log-cell-${row.month}-${k}`} aria-label="종류별 기록 없음" className={`${cell} min-w-[56px] text-right text-muted-foreground`}>—</td>
        )
      ))}
      <td
        data-testid={`monthly-log-cell-${row.month}-netAsset`}
        className={`${cell} sticky right-0 text-right font-semibold text-foreground border-l ${LINE} ${SURFACE}`}
        style={Z_EDGE}
      >
        <Amount value={row.netAsset} />
      </td>
    </tr>
  );
}

/** 표 본체(단일 스크롤 컨테이너 — sticky 머리줄·양끝 열). 시트 열린 채 갱신돼도 key 없이 같은 노드라 스크롤 유지 */
export function MonthlyLogTable({ log, today }: { log: MonthlyLog; today: string }) {
  const { rows, columns } = log;
  const head = `sticky top-0 px-1 py-2 text-xs font-medium text-muted-foreground border-b ${LINE} ${SURFACE}`;
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
            <th scope="col" data-testid="monthly-log-head-month" className={`${head} left-0 w-14 min-w-14 text-left border-r`} style={Z_CORNER}>월</th>
            {columns.map((k) => (
              <th
                key={k}
                scope="col"
                data-testid={`monthly-log-head-${k}`}
                className={`${head} min-w-[56px] text-right whitespace-normal break-keep`}
                style={Z_EDGE}
              >
                {k === "tenantDeposit" ? <>임차<wbr />보증금</> : MONTHLY_LOG_LABELS[k]}
              </th>
            ))}
            <th scope="col" data-testid="monthly-log-head-netAsset" className={`${head} right-0 text-right border-l`} style={Z_CORNER}>순자산</th>
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
        className="max-h-[85dvh] gap-0 pb-[max(1rem,env(safe-area-inset-bottom))] motion-reduce:animate-none!"
      >
        {/* 닫기 X — 기본 X와 같은 위치·크기, 히트영역만 40px로 확장. Tab 순서상 표보다 앞 */}
        <SheetClose
          className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-ring/50 after:absolute after:-inset-2.5 after:content-['']"
          aria-label="닫기"
        >
          <XIcon className="size-5 sm:size-6" aria-hidden />
        </SheetClose>
        <div className="mx-auto flex w-full max-w-[1040px] min-h-0 flex-col">
          <SheetHeader className="gap-0 p-0 px-4 pt-4 lg:px-6">
            <SheetTitle className="pr-10 text-base font-bold text-balance">월별 기록</SheetTitle>
            <SheetDescription data-testid="monthly-log-caption" className={NOTE}>{MONTHLY_LOG_CAPTION}</SheetDescription>
            {log.hasNetOnly && <p data-testid="monthly-log-note-legacy" className={NOTE}>—인 달은 순자산만 기록돼 있어요</p>}
            {log.atLimit && <p data-testid="monthly-log-note-limit" className={NOTE}>최근 13개월까지 보여요</p>}
          </SheetHeader>
          <div className="mt-3 px-2 lg:px-6">
            <MonthlyLogTable log={log} today={today} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
