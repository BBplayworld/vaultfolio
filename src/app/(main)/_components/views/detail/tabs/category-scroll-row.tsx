"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { InlineSelector } from "../../../layout/ui/inline-selector";

// 상세 탭 카테고리 줄(#362) — 칸이 많으면 줄 안에서만 가로 스크롤(페이지 넘침 0), 스크롤바 숨김.
// 6칸 이상이면 칸 좌우 여백 8→6px. 칸 위아래 히트 영역을 after로 4px씩 넓혀 40px, 컨테이너 py-0.5/-my-0.5로 담아 레이아웃 높이 변화 0.
// -my-0.5를 부모 space-y 자식에 직접 두면 space-y 간격(:where, 특이도 0)을 덮어 카드가 줄어들어 한 겹 감싼다.
// 트랙 rounded-md(10) + 세로 여백 2 = rounded-lg(12) 동심. 주식 줄(stock-category-row)은 별도 유지.
export const DENSE_MIN = 6;
export const ROW_CLASS = "-my-0.5 min-w-0 overflow-x-auto rounded-lg py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const HIT_CLASS = "[&>button]:relative [&>button]:after:absolute [&>button]:after:inset-x-0 [&>button]:after:-inset-y-1";

export function selectorClass(count: number): string {
  return count >= DENSE_MIN ? `${HIT_CLASS} [&>button]:px-1.5` : HIT_CLASS;
}

// 선택 칸을 줄 안에 보이게 — 즉시 이동(smooth 아님, 연타해도 마지막 선택으로 수렴)
export function scrollActiveIntoView(container: Pick<HTMLElement, "querySelector"> | null): void {
  container?.querySelector('[aria-checked="true"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
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
  // 마운트 때는 스크롤하지 않고, 선택이 바뀔 때만
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    scrollActiveIntoView(ref.current);
  }, [value]);
  return (
    // 바깥 div는 부모 space-y 간격을 그대로 받고, 안쪽 -my-0.5는 바깥과 마진 상쇄(collapse)되어 높이 변화 0
    <div>
      {/* Tab 포커스 칸도 줄 안에 완전히 — 브라우저는 몇 px만 잘린 칸은 스크롤하지 않는다(320 현금 '실물현금' 3px 잘림 실측) */}
      <div ref={ref} data-testid={testId} className={ROW_CLASS} onFocus={(e) => e.target.scrollIntoView({ inline: "nearest", block: "nearest" })}>
        <InlineSelector value={value} onChange={onChange} options={options} ariaLabel={ariaLabel} className={selectorClass(options.length)} />
      </div>
    </div>
  );
}
