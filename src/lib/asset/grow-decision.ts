/**
 * asset/grow-decision.ts
 * 내 종목 화면이 내 결정을 안다(#245, 5.130) — 상세·주식 행 표시, 종목 한 장 머리 문장, 홈 팁, `내 자산 점검` 타일 값 줄(순수 함수).
 *  - 값은 전부 점검 칸이 만든 행(grow-board.buildBoardRows · grow-kinds.buildGrowBoards)을 이름표 키로 찾아 읽기만 한다. 새 판정·새 계산 0
 *  - 차례 여부·이유는 행의 due·dueReason 그대로(문장은 dueReasonText). 여기서 차례를 다시 판정하지 않는다
 *  - 앱은 종목을 고르거나 권하지 않는다 — 여기서 만드는 문자열은 내가 정한 결정·조건에서 나온 사실뿐이다
 */

import { boardStatus, dueReasonText, nextCheckDateText, pctText, type BoardRow } from "@/lib/asset/grow-board";
import { growStatus, type GrowBoards } from "@/lib/asset/grow-kinds";
import type { StockLabels } from "@/lib/asset/stock-labels";

export type DecisionKind = "keep" | "check" | "due";
export const DECISION_TEXT: Record<DecisionKind, string> = { keep: "장기 보유", check: "점검 대상", due: "점검 차례" };

/**
 * 이름표 키 → 정한 종목의 행. 장기 보유·점검 대상 행만 담는다 —
 * 이름표 없음·`정하지 않음`·티커 없는 종목·상장폐지·수량 0은 들어가지 않아 화면이 아무것도 그리지 않는다(미정 기기 diff 0)
 */
export function decisionRowsOf(rows: BoardRow[]): Map<string, BoardRow> {
  const map = new Map<string, BoardRow>();
  for (const r of rows) if (r.labelKey && (r.labelState === "keep" || r.labelState === "check")) map.set(r.labelKey, r);
  return map;
}

/** 행 표시 — 차례면 `점검 차례` 하나만(`점검 대상`과 같이 쓰지 않는다) */
export const decisionKindOf = (row: BoardRow): DecisionKind => (row.due ? "due" : row.labelState === "keep" ? "keep" : "check");

/** 차례 진입 문장 — 점검 한 장 이유 줄과 글자까지 같다 */
export const dueEntryText = (row: BoardRow): string | null => (row.due && row.dueReason ? `점검 차례 · ${dueReasonText(row.dueReason)}` : null);

export interface HeadDecision {
  kind: "keep" | "check";
  /** `장기 보유` / `점검 대상` */
  label: string;
  /** 둘째 조각 — 기준 가격이 없으면 none(조각 자체가 없다. `—`·`0%` 없음) */
  since:
    | { state: "set" | "checked"; label: string; pct: number; text: string }
    | { state: "today"; text: string }
    | { state: "none" };
  /** 조건 절 — 장기 보유에는 없다. both = 하한·상한 둘 다(360 미만에서 생략하는 경우) */
  plan: { prefix: string; value: string; both: boolean } | null;
}

/**
 * 종목 한 장 머리 문장의 조각 — `{내 결정} · {정한 날 대비|점검일 대비} {%} · {조건 절}`.
 * 차례인 행은 문장 대신 진입(dueEntryText)을 그리므로 null. 값 없는 조각은 통째로 뺀다
 */
export function headDecisionOf(row: BoardRow | undefined, labels: StockLabels, nowMs: number): HeadDecision | null {
  if (!row || !row.labelKey || row.due || (row.labelState !== "keep" && row.labelState !== "check")) return null;
  const since: HeadDecision["since"] = !row.since
    ? { state: "none" }
    : row.since.today
      ? { state: "today", text: row.since.kind === "checked" ? "오늘 점검함" : "오늘 정함" }
      : { state: row.since.kind === "checked" ? "checked" : "set", label: row.since.kind === "checked" ? "점검일 대비" : "정한 날 대비", pct: row.since.pct, text: pctText(row.since.pct) };
  let plan: HeadDecision["plan"] = null;
  if (row.labelState === "check") {
    const p = labels.items[row.labelKey]?.plan;
    // 점검 한 장 요약 줄(`다시 볼 조건`)과 같은 낱말. 조건 안쪽은 가운뎃점이 아니라 `또는`(가운뎃점은 조각 구분에만)
    const parts = [p?.down !== undefined ? `−${p.down}% 이하` : null, p?.up !== undefined ? `+${p.up}% 이상` : null].filter((v): v is string => v !== null);
    if (parts.length > 0) plan = { prefix: "다시 볼 조건 평단 대비", value: parts.join(" 또는 "), both: parts.length === 2 };
    else if (row.nextCheckMs !== null) plan = { prefix: "다음 점검", value: nextCheckDateText(row.nextCheckMs, nowMs), both: false };
  }
  return { kind: row.labelState, label: DECISION_TEXT[row.labelState], since, plan };
}

/** 머리 문장 한 줄(테스트·aria용) — 조각을 ` · `로 이은 글 */
export function headDecisionText(h: HeadDecision): string {
  return [
    h.label,
    h.since.state === "none" ? null : h.since.state === "today" ? h.since.text : `${h.since.label} ${h.since.text}`,
    h.plan ? `${h.plan.prefix} ${h.plan.value}` : null,
  ].filter(Boolean).join(" · ");
}

export interface DueTip {
  /** 점검 차례 수 — 허브 셋째 카드와 같은 값(growStatus().due) */
  count: number;
  unit: "종목" | "개";
  /** 이유 1줄 — 종목명·금액·수량은 쓰지 않는다 */
  reason: string;
}

/**
 * 홈 팁 `점검 차례` 내용 — 차례 수 ≥ 1일 때만(그 밖의 판정 없음). 수·단위는 허브 카드와 같은 growStatus.
 * 이유: N=1·모두 같은 문장이면 그 문장, ±% 이유끼리 다르면 `내가 정한 조건에 닿았어요`, 기간 이유가 섞여 다르면 `내가 정한 조건·기간에 닿았어요`
 */
export function dueTipOf(boards: GrowBoards): DueTip | null {
  const status = growStatus(boards);
  if (status.due < 1) return null;
  const reasons = [...boards.stock, ...boards.crypto, ...boards.own].flatMap((r) => (r.due && r.dueReason ? [r.dueReason] : []));
  const texts = new Set(reasons.map(dueReasonText));
  const reason = texts.size === 1
    ? [...texts][0]
    : reasons.some((r) => r.kind === "date") ? "내가 정한 조건·기간에 닿았어요" : "내가 정한 조건에 닿았어요";
  return { count: status.due, unit: status.unit, reason };
}

export interface GrowTileValue {
  kind: "due" | "labeled" | "first";
  due: number;
  keep: number;
  check: number;
  count: number;
  /** 값 줄 조각 — 화면은 조각 사이에 가운뎃점을 둔다. 줄은 조각 사이에서만 바뀐다 */
  parts: string[];
}

/**
 * `내 자산 점검` 타일 값 줄 — 주식 행 기준(boardStatus). 주식 행이 없으면 null(타일 없음).
 * 앞의 `주식`은 허브·세그먼트(전 종류 합)와 수가 달라 보이지 않게 하는 범위 낱말. 처음 상태는 수가 없어 붙이지 않는다
 */
export function growTileValueOf(rows: BoardRow[]): GrowTileValue | null {
  const s = boardStatus(rows);
  if (s.kind === "empty") return null;
  const parts = s.kind === "due"
    ? [`주식 점검 차례 ${s.due}종목`]
    : s.kind === "labeled" ? [`주식 장기 보유 ${s.keep}`, `점검 대상 ${s.check}`] : ["장기 보유", "점검 대상 정하기 전"];
  return { kind: s.kind, due: s.due, keep: s.keep, check: s.check, count: s.count, parts };
}
