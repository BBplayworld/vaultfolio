// 5.177 #362 상세 카테고리 줄 넘침 — 7칸이 모두 눌리는가, 선택 칸을 줄 안으로 스크롤하는가, 막대 transition-all 0건.
// 테스트 환경이 node(DOM 없음)라서 훅은 작은 하네스로 흉내 내고, 요소 트리의 onClick을 직접 호출한다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";

const h = vi.hoisted(() => ({ refs: [] as { current: unknown }[], idx: 0, states: [] as unknown[], sidx: 0, effects: [] as (() => void)[], harness: false }));

vi.mock("react", async (importOriginal) => {
  const r = await importOriginal<typeof import("react")>();
  const useRef = ((init: unknown) => {
    if (!h.harness) return r.useRef(init);
    const i = h.idx++;
    if (!h.refs[i]) h.refs[i] = { current: init };
    return h.refs[i];
  }) as typeof r.useRef;
  const useEffect = ((fn: () => void, deps?: unknown[]) => (h.harness ? void h.effects.push(fn) : r.useEffect(fn, deps))) as typeof r.useEffect;
  const useState = ((init: unknown) => {
    if (!h.harness) return r.useState(init);
    const i = h.sidx++;
    if (!(i in h.states)) h.states[i] = init;
    const set = (v: unknown) => { h.states[i] = typeof v === "function" ? (v as (c: unknown) => unknown)(h.states[i]) : v; };
    return [h.states[i], set];
  }) as typeof r.useState;
  const useCallback = ((fn: unknown, deps?: unknown[]) => (h.harness ? fn : r.useCallback(fn as () => void, deps as unknown[]))) as typeof r.useCallback;
  const hooks = { useRef, useEffect, useState, useCallback };
  return { ...r, default: { ...r, ...hooks }, ...hooks };
});

import { CategoryScrollRow, ROW_CLASS, FADE_BOTH, FADE_END, FADE_START, FADE_MIN_OVERFLOW, edgeOf, fadeClass, scrollActiveIntoView, selectorClass } from "../category-scroll-row";
import { InlineSelector } from "../../../../layout/ui/inline-selector";

const SEVEN = ["all", "apt", "officetel", "villa", "house", "land", "etc"].map((v, i) => ({ value: v, label: `칸${i}` }));

type Props = Parameters<typeof CategoryScrollRow<string>>[0];
// 하네스 렌더 — 훅 순서대로 ref를 유지하고 effect를 모아 실행한다
function renderHarness(props: Props) {
  h.idx = 0;
  h.sidx = 0;
  h.effects = [];
  const el = CategoryScrollRow(props) as ReactElement<{ children: ReactElement }>;
  return el;
}
function buttonsOf(row: ReactElement<{ children: ReactElement }>) {
  const inner = row.props.children as ReactElement<{ children: ReactElement }>;
  const sel = inner.props.children as ReactElement<Parameters<typeof InlineSelector<string>>[0]>;
  const tree = InlineSelector(sel.props) as ReactElement<{ children: ReactElement<{ onClick: () => void; disabled: boolean }>[] }>;
  return tree.props.children;
}

beforeEach(() => {
  h.harness = false;
  h.refs = [];
  h.states = [];
});

describe("CategoryScrollRow (#362)", () => {
  it("7칸 — 모든 칸이 비활성 없이 그려지고, 눌린 칸 값이 onChange로 간다", () => {
    h.harness = true;
    const onChange = vi.fn();
    const buttons = buttonsOf(renderHarness({ value: "all", onChange, options: SEVEN, ariaLabel: "부동산 카테고리 선택", testId: "realestate-category-row" }));
    expect(buttons).toHaveLength(7);
    buttons.forEach((b) => {
      expect(b.props.disabled).toBe(false);
      b.props.onClick();
    });
    expect(onChange.mock.calls.map((c) => c[0])).toEqual(SEVEN.map((o) => o.value));
  });

  it("스크롤 컨테이너 — 줄 안 가로 스크롤·스크롤바 숨김·radius 12·높이 상쇄, 칸 히트 확장", () => {
    const html = renderToStaticMarkup(<CategoryScrollRow value="all" onChange={() => {}} options={SEVEN} ariaLabel="부동산 카테고리 선택" testId="realestate-category-row" />);
    expect(html).toContain('data-testid="realestate-category-row"');
    for (const c of ["overflow-x-auto", "min-w-0", "rounded-lg", "py-0.5", "-my-0.5", "[scrollbar-width:none]", "[&amp;::-webkit-scrollbar]:hidden"]) expect(html).toContain(c);
    expect((html.match(/role="radio"/g) ?? []).length).toBe(7);
    expect(ROW_CLASS).not.toMatch(/transition-all/);
    expect(selectorClass(7)).toContain("[&>button]:after:-inset-y-1");
  });

  it("6칸 이상이면 조밀(px-1.5), 5칸 이하는 기본", () => {
    expect(selectorClass(5)).not.toContain("px-1.5");
    expect(selectorClass(6)).toContain("[&>button]:px-1.5");
    expect(selectorClass(7)).toContain("[&>button]:px-1.5");
  });

  it("선택이 바뀔 때만 선택 칸을 nearest로 줄 안에 스크롤한다(마운트 때는 안 함)", () => {
    h.harness = true;
    const scroll = vi.fn();
    const container = { querySelector: vi.fn(() => ({ scrollIntoView: scroll })) };
    const props: Props = { value: "all", onChange: () => {}, options: SEVEN, ariaLabel: "a", testId: "t" };
    renderHarness(props);
    h.refs[0].current = container;
    h.effects.forEach((f) => f());
    expect(scroll).not.toHaveBeenCalled();

    renderHarness({ ...props, value: "etc" });
    h.effects.forEach((f) => f());
    expect(container.querySelector).toHaveBeenCalledWith('[aria-checked="true"]');
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(scroll).toHaveBeenCalledWith({ inline: "nearest", block: "nearest" });

    // 같은 값으로 다시 그리면 스크롤하지 않는다
    renderHarness({ ...props, value: "etc" });
    h.effects.forEach((f) => f());
    expect(scroll).toHaveBeenCalledTimes(1);

    // 칸이 줄어 all로 되돌아갈 때도 스크롤
    renderHarness({ ...props, value: "all" });
    h.effects.forEach((f) => f());
    expect(scroll).toHaveBeenCalledTimes(2);
  });

  it("Tab(키보드) 포커스 칸만 nearest로 줄 안에 스크롤한다", () => {
    h.harness = true;
    const row = renderHarness({ value: "all", onChange: () => {}, options: SEVEN, ariaLabel: "a", testId: "t" });
    const inner = row.props.children as unknown as ReactElement<{ onFocus: (e: unknown) => void }>;
    const scroll = vi.fn();
    inner.props.onFocus({ target: { matches: (q: string) => q === ":focus-visible", scrollIntoView: scroll } });
    expect(scroll).toHaveBeenCalledWith({ inline: "nearest", block: "nearest" });
    // 마우스 포커스(:focus-visible 아님)는 스크롤하지 않는다 — mousedown 중 줄이 움직이면 클릭이 사라짐
    const mouse = vi.fn();
    inner.props.onFocus({ target: { matches: () => false, scrollIntoView: mouse } });
    expect(mouse).not.toHaveBeenCalled();
  });

  it("넘침 페이드 — edgeOf·fadeClass: 넘치지 않거나 ≤4px이면 0, 시작/끝/양쪽 3종", () => {
    expect(edgeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 300 })).toEqual({ start: false, end: false });
    expect(edgeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 301 })).toEqual({ start: false, end: false }); // 1px 오차
    // 5.180 임계값(5.178 ui-review 관찰 A): 넘침 ≤4px이면 숨은 칸이 없어 페이드 생략. 5.177 때는 2~4px도 끝 페이드였다(320 주식 줄 2px·현금 줄 ≤2.5px)
    expect(FADE_MIN_OVERFLOW).toBe(4);
    expect(edgeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 302 })).toEqual({ start: false, end: false }); // 320 주식 줄 2px
    expect(edgeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 304 })).toEqual({ start: false, end: false }); // 경계 4px
    expect(edgeOf({ scrollLeft: 4, clientWidth: 300, scrollWidth: 304 })).toEqual({ start: false, end: false }); // 끝까지 밀어도 시작 페이드 0
    expect(edgeOf({ scrollLeft: 0, clientWidth: 300, scrollWidth: 305 })).toEqual({ start: false, end: true }); // 5px부터 페이드
    expect(edgeOf({ scrollLeft: 5, clientWidth: 300, scrollWidth: 305 })).toEqual({ start: true, end: false });
    expect(edgeOf({ scrollLeft: 0, clientWidth: 296, scrollWidth: 380 })).toEqual({ start: false, end: true });
    expect(edgeOf({ scrollLeft: 40, clientWidth: 296, scrollWidth: 380 })).toEqual({ start: true, end: true });
    expect(edgeOf({ scrollLeft: 84, clientWidth: 296, scrollWidth: 380 })).toEqual({ start: true, end: false });
    expect(fadeClass({ start: false, end: false })).toBe("");
    expect(fadeClass({ start: false, end: true })).toBe(FADE_END);
    expect(fadeClass({ start: true, end: false })).toBe(FADE_START);
    expect(fadeClass({ start: true, end: true })).toBe(FADE_BOTH);
    for (const c of [FADE_END, FADE_START, FADE_BOTH]) expect(c).toContain("24px");
    expect(ROW_CLASS).toContain("scroll-px-6");
  });

  it("넘침 페이드 상태 전이 — 마운트·스크롤에 따라 끝 → 양쪽 → 시작 → 넘침 해소 시 0", () => {
    h.harness = true;
    const el = { scrollLeft: 0, clientWidth: 296, scrollWidth: 380, firstElementChild: null, querySelector: () => null };
    const props: Props = { value: "all", onChange: () => {}, options: SEVEN, ariaLabel: "a", testId: "t" };
    type Inner = ReactElement<{ className: string; onScroll: () => void }>;
    const inner = () => renderHarness(props).props.children as unknown as Inner;
    // 첫 렌더는 페이드 없음(SSR과 같음)
    expect(inner().props.className).not.toContain("mask-image");
    h.refs[0].current = el;
    h.effects.forEach((f) => f());
    expect(inner().props.className).toContain(FADE_END);
    el.scrollLeft = 40;
    inner().props.onScroll();
    expect(inner().props.className).toContain(FADE_BOTH);
    el.scrollLeft = 84;
    inner().props.onScroll();
    const cls = inner().props.className;
    expect(cls).toContain(FADE_START);
    expect(cls).not.toContain(FADE_BOTH);
    // 넓어져 넘치지 않으면 페이드 0
    el.scrollLeft = 0;
    el.clientWidth = 1184;
    inner().props.onScroll();
    expect(inner().props.className).not.toContain("mask-image");
  });

  it("넘치지 않는 줄(SSR·4칸)은 mask-image 0", () => {
    const html = renderToStaticMarkup(<CategoryScrollRow value="all" onChange={() => {}} options={SEVEN.slice(0, 4)} ariaLabel="a" testId="t" />);
    expect(html).not.toContain("mask-image");
  });

  it("scrollActiveIntoView — 컨테이너·선택 칸이 없어도 안전", () => {
    expect(() => scrollActiveIntoView(null)).not.toThrow();
    expect(() => scrollActiveIntoView({ querySelector: () => null })).not.toThrow();
  });
});

describe("탭 적용 범위 (#362)", () => {
  const src = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

  it("부동산·현금·대출·주식(5.178 이관) 모두 CategoryScrollRow", () => {
    expect(src("real-estate-tab.tsx")).toContain('testId="realestate-category-row"');
    expect(src("cash-tab.tsx")).toContain('testId="cash-category-row"');
    expect(src("loan-tab.tsx")).toContain('testId="loan-category-row"');
    expect(src("stock-tab.tsx")).toContain('testId="stock-category-row"');
    expect(src("stock-tab.tsx")).not.toContain('data-testid="stock-category-row"');
  });

  it("카드 하단 막대 4곳 — transition-all 0건, motion-safe:transition-[width]", () => {
    for (const f of ["cash-tab.tsx", "crypto-tab.tsx", "loan-tab.tsx", "real-estate-tab.tsx"]) {
      const s = src(f);
      expect(s, f).not.toContain("transition-all");
      expect(s, f).toContain('className="h-full motion-safe:transition-[width]"');
    }
  });
});
