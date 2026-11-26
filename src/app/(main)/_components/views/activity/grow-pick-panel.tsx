"use client";

// 자산 불리기 확장(#242, 5.127) — 점검 칸의 새 요소 3개: ① 종류 줄(주식·코인·부동산·실물 보기 전환) ② `내 선택` 결론 줄·펼침 패널 ③ 부동산·실물 한 장의 값 구획.
//  - `내 선택`은 건수만 말한다. 손익색·경고색·순위·좋은 순 정렬 없음, 굵은 것은 숫자뿐(`모두`·`없음`·`오름`은 같은 굵기), 행 순서는 값과 무관하게 고정
//  - 패널은 값이 있는 상태(count·buy)에만 있다 — 값 없는 상태(wait)는 글자만 있고 화살표·버튼·패널이 없다(빈 패널 없음)
//  - 칸 막대: 칸 1개 = 기록 1번, 채운 칸 = 오름(무채색 2단, 눈금·숫자 없음). 칸 폭이 4px 아래면 같은 자리에 이어진 막대
//  - 값 구획은 저장된 내 입력값과 참고값을 그대로 보여 줄 뿐이다 — 두 값의 차이·비율·방향 낱말 없음, 새 요청 0

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { PICK_ROWS, pickHeadline, pickTextOf, pickUpText, type PickKind, type PickResult, type PickTally, type PickText } from "@/lib/asset/grow-pick";
import { GROW_VIEWS, type GrowView } from "@/lib/asset/grow-kinds";
import type { BoardRow } from "@/lib/asset/grow-board";
import { formatPriceByMode } from "@/lib/number-utils";
import { InfoHint } from "../../layout/ui/info-hint";

const DUE_TEXT = "font-semibold text-indigo-600 dark:text-indigo-200";

// ─── ① 종류 줄 ──────────────────────────────────────────────────────

// testId의 data-kind — 부동산·실물 보기는 `real`
const KIND_ATTR: Record<GrowView, string> = { stock: "stock", crypto: "crypto", own: "real" };

/**
 * 종류 줄 — 가진 종류가 2개 이상일 때만. 숫자는 쓰지 않는다(수는 세그먼트와 행에 있다).
 * 꼬리 `점검 차례`는 그 보기에 차례 행이 있고 **선택하지 않은 칸**에만(선택한 칸은 바로 아래 카드·행이 같은 말을 한다)
 */
export function GrowKindTabs({ views, value, due, onChange }: {
  views: GrowView[];
  value: GrowView;
  due: Record<GrowView, boolean>;
  onChange: (v: GrowView) => void;
}) {
  const refs = useRef<Partial<Record<GrowView, HTMLButtonElement | null>>>({});
  const onKey = (e: React.KeyboardEvent, v: GrowView) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next = views[(views.indexOf(v) + (e.key === "ArrowRight" ? 1 : views.length - 1)) % views.length];
    onChange(next);
    refs.current[next]?.focus();
  };
  return (
    <div data-testid="grow-kinds" role="tablist" aria-label="자산 종류" className="-mt-2 mb-2 flex gap-1">
      {GROW_VIEWS.filter((k) => views.includes(k.value)).map((k) => {
        const on = k.value === value;
        return (
          <button
            key={k.value}
            ref={(el) => { refs.current[k.value] = el; }}
            type="button"
            role="tab"
            data-testid="grow-kind"
            data-kind={KIND_ATTR[k.value]}
            data-due={due[k.value] ? "true" : "false"}
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(k.value)}
            onKeyDown={(e) => onKey(e, k.value)}
            className={`relative inline-flex min-h-8 min-w-min flex-[0_1_auto] flex-wrap items-center justify-center gap-x-1 rounded-2xl px-2 py-0.5 outline-none after:absolute after:inset-x-0 after:-inset-y-1 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-[transform,background-color] motion-safe:duration-150 sm:px-3 ${on ? "bg-muted font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            <span className="whitespace-nowrap text-sm">{k.label}</span>
            {due[k.value] && !on && <span className={`whitespace-nowrap text-2xs ${DUE_TEXT}`}>점검 차례</span>}
          </button>
        );
      })}
    </div>
  );
}

// ─── ② 내 선택 ──────────────────────────────────────────────────────

/** 굵은 조각은 숫자뿐 */
const Parts = ({ parts, bold = "font-bold" }: { parts: PickText; bold?: string }) => (
  <>{parts.map((p, i) => (p.b ? <b key={i} className={bold}>{p.t}</b> : <span key={i}>{p.t}</span>))}</>
);

export type PickFilter = PickKind | "hit" | "buy";

/** 종합 카드 넷째 라벨 행의 dd — 값이 있으면 펼침 버튼, 없으면(wait) 글자만 */
export function PickLine({ pick, open, panelId, onToggle }: { pick: PickResult; open: boolean; panelId: string; onToggle: () => void }) {
  const parts = pickHeadline(pick);
  if (pick.state === "wait") {
    return (
      <dd data-testid="grow-pick" data-state="wait" data-n={pick.records} className="min-w-0 tabular-nums text-muted-foreground">
        {/* 가운뎃점 뒤에서만 줄이 바뀐다(조각마다 nowrap) */}
        <span className="flex flex-wrap gap-x-1">{parts.map((p, i) => <span key={i} className="whitespace-nowrap">{p.t}</span>)}</span>
      </dd>
    );
  }
  const n = pick.state === "count" ? pick.n : pick.buys.n;
  const up = pick.state === "count" ? pick.up : pick.buys.up;
  return (
    <dd data-testid="grow-pick" data-state={pick.state} data-n={n} data-up={up} className="min-w-0 tabular-nums break-keep">
      <button
        type="button"
        data-testid="grow-pick-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`내 선택, ${pickTextOf(parts)}, ${open ? "접기" : "펼치기"}`}
        onClick={onToggle}
        className="relative flex w-full items-start justify-between gap-2 text-left text-sm outline-none after:absolute after:-inset-y-2.5 after:-left-[4.75rem] after:-right-2 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 text-balance break-keep"><Parts parts={parts} /></span>
        <ChevronDown aria-hidden className={`mt-0.5 size-4 shrink-0 text-muted-foreground motion-safe:transition-transform motion-safe:duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
    </dd>
  );
}

// 칸 폭 하한(px) — 이보다 좁아지면 이어진 막대
const CELL_MIN = 4;
const CELL_GAP = 2;

/** 칸 막대 — 한 줄에 scale칸. 칸이 4px보다 좁아지는 폭에서는 길이 = 번 수 몫, 채움 = 오름 몫인 이어진 막대 */
function Tally({ n, up, scale }: { n: number; up: number; scale: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [dense, setDense] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const judge = () => setDense((el.clientWidth - (scale - 1) * CELL_GAP) / scale < CELL_MIN);
    judge();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(judge);
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);
  return (
    <span ref={ref} aria-hidden data-testid="grow-pick-tally" data-dense={dense ? "true" : "false"} className="flex h-2 min-w-0 gap-0.5">
      {dense ? (
        <i className="relative block h-2 min-w-1 overflow-hidden rounded-[2px] bg-foreground/14" style={{ width: `${(n / scale) * 100}%` }}>
          <i className="absolute inset-y-0 left-0 block rounded-[2px] bg-foreground/60" style={{ width: `${(up / n) * 100}%` }} />
        </i>
      ) : (
        Array.from({ length: n }, (_, i) => (
          <i key={i} data-on={i < up ? "true" : "false"} className={`block h-2 flex-none rounded-[2px] ${i < up ? "bg-foreground/60" : "bg-foreground/14"}`} style={{ width: `calc((100% - ${(scale - 1) * CELL_GAP}px) / ${scale})` }} />
        ))
      )}
    </span>
  );
}

const ROW_COLS = "grid grid-cols-[7rem_minmax(0,1fr)_4.5rem] items-center gap-x-2 max-[360px]:grid-cols-[7rem_minmax(0,1fr)_4rem] max-[360px]:gap-x-1.5";
const ROW_BTN = "-mx-2 w-[calc(100%+1rem)] rounded-md px-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[background-color] motion-safe:duration-150";
const FILTER_HINT = "누르면 아래 종목을 이 기록이 있는 종목으로 걸러요";

/**
 * `내 선택` 펼침 패널 — 머리 + 위 묶음(정함 / 그대로 두기·바꾸기 + 주석 줄 + 안내 줄) + 구분선 + 매수 행.
 * 합 규칙: 위 묶음 3행의 번 수 합 = 결론 줄 N, 오름 합 = M. 매수 행은 다른 축이라 구분선 아래에 둔다. 0번인 행은 그리지 않는다
 */
export function PickPanel({ pick, filter, onFilter }: { pick: PickResult; filter: PickFilter | null; onFilter: (f: PickFilter) => void }) {
  const rows = pick.state === "count" ? PICK_ROWS.map((r) => ({ ...r, tally: pick.rows[r.kind] })).filter((r) => r.tally.n > 0) : [];
  const scale = Math.max(8, ...rows.map((r) => r.tally.n));
  const hit = pick.state === "count" && pick.hit.n > 0 ? pick.hit : null;
  const row = (r: { kind: PickKind; label: string; tally: PickTally }) => {
    const right = pickUpText(r.tally);
    return (
      <button
        key={r.kind}
        type="button"
        data-testid="grow-pick-row"
        data-kind={r.kind}
        data-n={r.tally.n}
        data-up={r.tally.up}
        aria-pressed={filter === r.kind}
        aria-label={`${r.label} ${r.tally.n}번, ${pickTextOf(right)}, ${FILTER_HINT}`}
        onClick={() => onFilter(r.kind)}
        className={`${ROW_COLS} ${ROW_BTN} min-h-10 ${filter === r.kind ? "bg-foreground/9" : "hover:bg-muted/40"}`}
      >
        <span className="flex min-w-0 items-baseline gap-1.5 whitespace-nowrap">
          <span className="text-sm font-semibold">{r.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{r.tally.n}번</span>
        </span>
        <Tally n={r.tally.n} up={r.tally.up} scale={scale} />
        <span className="whitespace-nowrap text-right text-sm tabular-nums"><Parts parts={right} /></span>
      </button>
    );
  };
  const head = rows.filter((r) => r.kind === "set");
  const rest = rows.filter((r) => r.kind !== "set");
  const buyRight = pickUpText(pick.buys, "건");
  return (
    <div data-testid="grow-pick-panel" data-state={pick.state} className="rounded-lg bg-foreground/6 px-3 pt-1 pb-1.5">
      <div className="flex min-h-8 items-center gap-1.5">
        <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">선택한 날 가격보다 오른 횟수</span>
        <span data-testid="grow-pick-hint" data-screenshot-hide className="inline-flex">
          <InfoHint summary="가격이 오른 기록 수예요. 시장 전체가 오르내린 영향도 들어 있어요.">
            <p className="text-pretty break-keep">정하거나 점검한 날의 가격과, 그다음 점검한 날(없으면 지금)의 가격을 비교해요. 30일이 지난 선택이 3번 되면 보여요. 가격이 같으면 오른 것으로 세지 않아요. 이 앱에 기록한 매수는 지금 가격이 매수가보다 높은 건수예요.</p>
            <p className="text-pretty break-keep">판 종목은 이 앱에 매도를 기록했을 때만 매도가까지 넣어요. 처음 정한 종목을 나중에 바꾸면 바꾸기로 세요.</p>
            <p className="text-pretty break-keep">부동산과 실물은 넣지 않아요.</p>
          </InfoHint>
        </span>
      </div>
      {rows.length === 0 ? (
        <p data-testid="grow-pick-empty" className="flex min-h-9 items-center text-sm text-muted-foreground break-keep">30일이 지난 선택이 3번 되면 보여요</p>
      ) : (
        <>
          {head.map(row)}
          {rest.length > 0 && (
            // 주석 줄이 가리키는 두 행(그대로 두기·바꾸기)을 왼쪽 세로선 하나로 묶는다
            <div data-testid="grow-pick-rail" className={hit ? "relative before:absolute before:top-2.5 before:bottom-[9px] before:-left-[7px] before:w-0.5 before:rounded-sm before:bg-foreground/22" : undefined}>
              {rest.map(row)}
              {hit && (
                <button
                  type="button"
                  data-testid="grow-pick-hit"
                  data-n={hit.n}
                  data-up={hit.up}
                  aria-pressed={filter === "hit"}
                  aria-label={`위 두 가지 중 내 조건에 닿아 점검 ${hit.n}번, ${pickTextOf(pickUpText(hit, "번", true))}, ${FILTER_HINT}`}
                  onClick={() => onFilter("hit")}
                  className={`relative flex w-full flex-wrap gap-x-1 rounded-md py-1.5 text-left text-xs text-muted-foreground tabular-nums outline-none after:absolute after:inset-x-0 after:-inset-y-1.5 focus-visible:ring-2 focus-visible:ring-ring/50 ${filter === "hit" ? "bg-foreground/9" : ""}`}
                >
                  {/* 가운뎃점 뒤에서만 줄이 바뀐다 */}
                  <span className="whitespace-nowrap">위 두 가지 중 내 조건에 닿아 점검 <b className="font-semibold text-foreground">{hit.n}번</b> <span aria-hidden>·</span></span>
                  <span className="whitespace-nowrap"><Parts parts={pickUpText(hit, "번", true)} bold="font-semibold text-foreground" /></span>
                </button>
              )}
            </div>
          )}
          {pick.late > 0 && (
            <p data-testid="grow-pick-late" data-n={pick.late} className="pt-0.5 pb-1.5 text-xs text-muted-foreground tabular-nums break-keep">30일이 안 된 기록 {pick.late}번은 아직 넣지 않았어요</p>
          )}
        </>
      )}
      {pick.buys.n > 0 && (
        <>
          <div aria-hidden className="mt-1.5 mb-0.5 h-px bg-border" />
          <button
            type="button"
            data-testid="grow-pick-buy"
            data-n={pick.buys.n}
            data-up={pick.buys.up}
            aria-pressed={filter === "buy"}
            aria-label={`이 앱에 기록한 매수 ${pick.buys.n}건, ${pickTextOf(buyRight)}, 누르면 아래 종목을 매수 기록이 있는 종목으로 걸러요`}
            onClick={() => onFilter("buy")}
            className={`${ROW_COLS} ${ROW_BTN} min-h-12 ${filter === "buy" ? "bg-foreground/9" : "hover:bg-muted/40"}`}
          >
            <span className="min-w-0 whitespace-nowrap">
              <span className="block text-xs text-muted-foreground">이 앱에 기록한</span>
              <span className="block"><span className="text-sm font-semibold">매수</span> <span className="text-xs text-muted-foreground tabular-nums">{pick.buys.n}건</span></span>
            </span>
            <Tally n={pick.buys.n} up={pick.buys.up} scale={Math.max(8, pick.buys.n)} />
            <span className="whitespace-nowrap text-right text-sm tabular-nums"><Parts parts={buyRight} /></span>
          </button>
        </>
      )}
    </div>
  );
}

/** 패널 행 거름의 사실 줄 낱말 — `{낱말} 기록이 있는 N종목` */
export const PICK_FILTER_LABEL: Record<PickFilter, string> = {
  set: "정함",
  same: "그대로 두기",
  move: "바꾸기",
  hit: "내 조건에 닿아 점검한",
  buy: "매수",
};

// ─── ③ 부동산·실물 값 구획 ──────────────────────────────────────────

/**
 * 한 장의 값 구획 — 내가 넣은 시세(실물은 평가액)와 수정 창으로 가는 유일한 진입 1개. 금액은 상세 카드와 같은 포맷 함수.
 * 실거래 추정 줄은 추정가가 저장된 부동산에만(없으면 줄 자체가 없다)
 */
/**
 * 수정 창이 닫히면(저장·X·바깥 누름·Esc 무엇이든) 포커스를 누른 버튼으로 되돌린다(ui-review R-2).
 * 수정 창은 이 버튼을 트리거로 알지 못해(이벤트로 연다) 스스로 돌려주지 못한다 — body에 창이 붙었다 떨어지는 것을 보고 돌린다
 */
function focusBackAfterDialog(btn: HTMLElement) {
  if (typeof MutationObserver === "undefined") return;
  let seen = false;
  const mo = new MutationObserver(() => {
    const open = !!document.querySelector('[role="dialog"]');
    if (open) { seen = true; return; }
    if (!seen) return;
    mo.disconnect();
    // 창이 스스로 포커스를 돌려놓은 경우(Esc)는 건드리지 않는다
    requestAnimationFrame(() => { if (btn.isConnected && (!document.activeElement || document.activeElement === document.body)) btn.focus(); });
  });
  mo.observe(document.body, { childList: true, subtree: true });
  // 창이 열리지 않은 채 남지 않게
  window.setTimeout(() => { if (!seen) mo.disconnect(); }, 5000);
}

export function OwnValueBox({ row, onEdit }: { row: BoardRow; onEdit: (row: BoardRow) => void }) {
  if (!row.own) return null;
  const word = row.kind === "physical" ? "평가액" : "시세";
  return (
    <div data-testid="grow-value" className="flex flex-col gap-1.5 rounded-lg bg-background px-3 py-2.5 shadow-[inset_0_0_0_1px] shadow-foreground/14">
      {/* 금액은 한 줄(nowrap) — 좁은 폭(320)에서 금액과 버튼이 한 줄에 안 들어가면 버튼이 아래 줄로 내려간다(숫자와 `원`이 갈리지 않게, C130) */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span>
          <span className="block text-xs text-muted-foreground">내가 넣은 {word}</span>
          <span data-testid="grow-value-mine" className="block whitespace-nowrap text-base font-bold tabular-nums">{formatPriceByMode(row.own.value)}</span>
        </span>
        <button
          type="button"
          data-testid="grow-value-edit"
          aria-label={`${row.name} ${word} 고치기`}
          onClick={(e) => { focusBackAfterDialog(e.currentTarget); onEdit(row); }}
          className="ml-auto inline-flex min-h-10 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg bg-muted pr-2.5 pl-3 text-sm font-semibold outline-none hover:bg-muted/80 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.96] motion-safe:transition-[transform,background-color] motion-safe:duration-150"
        >
          {word} 고치기 <ChevronRight aria-hidden className="size-3.5 text-muted-foreground" />
        </button>
      </div>
      {row.own.estimate !== undefined && (
        <p data-testid="grow-value-estimate" className="flex flex-wrap gap-x-1.5 text-xs text-muted-foreground tabular-nums">
          <span className="whitespace-nowrap">실거래 추정 {formatPriceByMode(row.own.estimate)}{row.own.estimateDate ? <> <span aria-hidden>·</span></> : null}</span>
          {row.own.estimateDate && <span className="whitespace-nowrap">{row.own.estimateDate} 기준</span>}
        </p>
      )}
    </div>
  );
}
