"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { InlineSelector } from "../../../layout/ui/inline-selector";

// 상세 탭 카테고리 줄(#362) — 칸이 많으면 줄 안에서만 가로 스크롤(페이지 넘침 0), 스크롤바 숨김.
// 6칸 이상이면 칸 좌우 여백 8→6px. 칸 위아래 히트 영역을 after로 4px씩 넓혀 40px, 컨테이너 py-0.5/-my-0.5로 담아 레이아웃 높이 변화 0.
// -my-0.5를 부모 space-y 자식에 직접 두면 space-y 간격(:where, 특이도 0)을 덮어 카드가 줄어들어 한 겹 감싼다.
// 트랙 rounded-md(10) + 세로 여백 2 = rounded-lg(12) 동심. 주식 줄(stock-category-row)은 별도 유지.
// 넘침 힌트(5.177 D-1): 칸 사이 간격·둥근 끝에서 잘리면 숨은 칸 단서가 없어 넘치는 쪽 끝에만 24px 마스크 페이드.
// scroll-px-6 — 선택·포커스로 옮긴 칸이 페이드 밖에 놓이고 다음 칸이 일부 보이게.
export const DENSE_MIN = 6;
export const ROW_CLASS = "-my-0.5 min-w-0 overflow-x-auto rounded-lg py-0.5 scroll-px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const HIT_CLASS = "[&>button]:relative [&>button]:after:absolute [&>button]:after:inset-x-0 [&>button]:after:-inset-y-1";

// 페이드 정적 클래스 3종 — 전환 없음(즉시)
export const FADE_END = "[mask-image:linear-gradient(to_right,#000_calc(100%-24px),transparent)]";
export const FADE_START = "[mask-image:linear-gradient(to_left,#000_calc(100%-24px),transparent)]";
export const FADE_BOTH = "[mask-image:linear-gradient(to_right,transparent,#000_24px,#000_calc(100%-24px),transparent)]";

export type Edge = { start: boolean; end: boolean };
const NO_EDGE: Edge = { start: false, end: false };

export function selectorClass(count: number): string {
  return count >= DENSE_MIN ? `${HIT_CLASS} [&>button]:px-1.5` : HIT_CLASS;
}

// 시작·끝 쪽에 가려진 내용이 있는가(1px 오차 허용). 넘치지 않으면 둘 다 false
export function edgeOf(el: Pick<HTMLElement, "scrollLeft" | "clientWidth" | "scrollWidth">): Edge {
  return { start: el.scrollLeft > 1, end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1 };
}

export function fadeClass(edge: Edge): string {
  if (edge.start && edge.end) return FADE_BOTH;
  if (edge.end) return FADE_END;
  if (edge.start) return FADE_START;
  return "";
}

// 선택 칸을 줄 안에 보이게 — 즉시 이동(smooth 아님, 연타해도 마지막 선택으로 수렴)
export function scrollActiveIntoView(container: Pick<HTMLElement, "querySelector"> | null): void {
  container?.querySelector('[aria-checked="true"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
}

// 키보드 포커스 칸만 nearest 스크롤(마우스 포커스는 클릭 뒤 선택 effect가 맡는다)
export function focusScroll(target: Pick<Element, "matches" | "scrollIntoView">): void {
  if (target.matches(":focus-visible")) target.scrollIntoView({ inline: "nearest", block: "nearest" });
}

export function CategoryScrollRow<T extends string>({ value, onChange, options, ariaLabel, testId }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly { value: T; label: ReactNode }[];
  ariaLabel: string;
  testId: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prev = useRef(value);
  const [edge, setEdge] = useState<Edge>(NO_EDGE);
  const syncEdge = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const next = edgeOf(el);
    setEdge((cur) => (cur.start === next.start && cur.end === next.end ? cur : next));
  }, []);
  // 마운트 때는 스크롤하지 않고, 선택이 바뀔 때만
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    scrollActiveIntoView(ref.current);
  }, [value]);
  // 컨테이너·트랙 크기 변화, 칸 수 변화 때 페이드 다시 계산
  useEffect(() => {
    syncEdge();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(syncEdge);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [syncEdge, options.length]);
  return (
    // 바깥 div는 부모 space-y 간격을 그대로 받고, 안쪽 -my-0.5는 바깥과 마진 상쇄(collapse)되어 높이 변화 0
    <div>
      {/* Tab 포커스 칸도 줄 안에 완전히 — 브라우저는 몇 px만 잘린 칸은 스크롤하지 않는다(320 현금 '실물현금' 3px 잘림 실측).
          키보드 포커스(:focus-visible)만 — 마우스는 mousedown 포커스 때 줄이 움직이면 mouseup이 다른 칸에 떨어져 클릭이 사라진다(scroll-px-6 실측) */}
      <div
        ref={ref}
        data-testid={testId}
        className={`${ROW_CLASS} ${fadeClass(edge)}`}
        onScroll={syncEdge}
        onFocus={(e) => focusScroll(e.target)}
      >
        <InlineSelector value={value} onChange={onChange} options={options} ariaLabel={ariaLabel} className={selectorClass(options.length)} />
      </div>
    </div>
  );
}
