// 5.178 — 주식 줄 CategoryScrollRow 이관, O-4(선택된 칸 재탭 nearest), physical 막대 motion-safe
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CategoryScrollRow, retapScroll } from "../category-scroll-row";
import { CATEGORY_TABS } from "../stock-tab";

const src = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");
// 클릭 시점 DOM(커밋 전) 흉내 — closest는 칸 자신 또는 칸 안 span에서 칸을 돌려준다
const radio = (checked: boolean) => {
  const el = { getAttribute: (k: string) => (k === "aria-checked" ? String(checked) : null), scrollIntoView: vi.fn() };
  return { el, target: { closest: (q: string) => (q === '[role="radio"]' ? el : null) } };
};

describe("O-4 재탭 스크롤(retapScroll)", () => {
  it("이미 선택된 칸을 다시 누르면 nearest로 줄 안에 보이게 한다", () => {
    const { el, target } = radio(true);
    retapScroll(target);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ inline: "nearest", block: "nearest" });
  });
  it("새 칸 클릭(커밋 전 aria-checked=false)은 건너뛴다 — 선택 effect가 맡아 이중 스크롤 0", () => {
    const { el, target } = radio(false);
    retapScroll(target);
    expect(el.scrollIntoView).not.toHaveBeenCalled();
  });
  it("칸 밖(트랙 여백)·closest 없는 대상·null은 안전", () => {
    expect(() => retapScroll({ closest: () => null })).not.toThrow();
    expect(() => retapScroll({})).not.toThrow();
    expect(() => retapScroll(null)).not.toThrow();
  });
  it("컨테이너 onClick에 연결 — 4탭 공통(같은 컴포넌트)", () => {
    expect(src("category-scroll-row.tsx")).toContain("onClick={(e) => retapScroll(e.target)}");
  });
});

describe("주식 줄 이관", () => {
  it("testId stock-category-row 유지, 7칸 조밀·페이드 준비(scroll-px-6)·히트 확장", () => {
    const html = renderToStaticMarkup(<CategoryScrollRow value="all" onChange={() => {}} options={CATEGORY_TABS} ariaLabel="주식 카테고리 선택" testId="stock-category-row" />);
    expect(html).toContain('data-testid="stock-category-row"');
    expect(html).toContain('aria-label="주식 카테고리 선택"');
    for (const c of ["scroll-px-6", "rounded-lg", "overflow-x-auto", "[&amp;&gt;button]:px-1.5", "[&amp;&gt;button]:after:-inset-y-1"]) expect(html).toContain(c);
    expect((html.match(/role="radio"/g) ?? []).length).toBe(7);
  });
  it("stock-tab에 자체 스크롤 ref·effect가 남지 않는다(중복 0)", () => {
    const s = src("stock-tab.tsx");
    expect(s).not.toContain("categoryScrollRef");
    expect(s).not.toContain("denseCategories");
    expect(s).toContain('<CategoryScrollRow value={activeCategory} onChange={setActiveCategory} options={visibleCategories} ariaLabel="주식 카테고리 선택" testId="stock-category-row" />');
  });
});

describe("physical-tab 막대", () => {
  it("transition-all 0, motion-safe:transition-[width]", () => {
    const s = src("physical-tab.tsx");
    expect(s).not.toContain("transition-all");
    expect(s).toContain('className="h-full motion-safe:transition-[width]"');
  });
});

describe("O-2 부동산 카드 펼침 ˅ 잘림", () => {
  it("금액 열은 shrink-0이 아니고(min-w-0), 손익 줄만 넘칠 때 줄바꿈(justify-end·gap-y-0), 금액 조각은 nowrap", () => {
    const s = src("real-estate-tab.tsx");
    const right = s.slice(s.indexOf('data-testid="re-row-right"'), s.indexOf("<ChevronDown"));
    expect(right).toContain('className="text-right min-w-0"');
    expect(right).not.toContain("ASSET_THEME.cardInfoRight");
    expect(right).toContain("flex-wrap justify-end gap-y-0");
    expect((right.match(/whitespace-nowrap/g) ?? []).length).toBe(3);
    // 반응형 경계 추가 0(C99)
    expect(right).not.toMatch(/(max|min)-\[|\bsm:|\bmd:/);
  });
});
