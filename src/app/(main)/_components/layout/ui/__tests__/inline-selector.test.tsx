// InlineSelector 기본 경로 회귀 방지(#32 r2 S1) — fullWidth 미지정 렌더 HTML을 변경 전 기준으로 고정한다.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineSelector } from "../inline-selector";

const OPTS = [
  { value: "a", label: "가" },
  { value: "b", label: "나", testId: "opt-b" },
  { value: "c", label: "다", dataTutorial: "tut-c" },
] as const;
const noop = () => {};

describe("InlineSelector 기본 경로 스냅샷", () => {
  it("size sm", () => {
    expect(renderToStaticMarkup(<InlineSelector value="a" onChange={noop} options={OPTS} size="sm" ariaLabel="선택" />)).toMatchInlineSnapshot(`"<div role="radiogroup" aria-label="선택" class="inline-flex items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 p-0.5 "><button type="button" role="radio" aria-checked="true" class="text-[12px] sm:text-[13px] lg:text-sm px-1.5 py-1 whitespace-nowrap shrink-0 rounded transition-colors bg-background text-foreground font-semibold shadow-sm">가</button><button type="button" role="radio" aria-checked="false" data-testid="opt-b" class="text-[12px] sm:text-[13px] lg:text-sm px-1.5 py-1 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">나</button><button type="button" role="radio" aria-checked="false" data-tutorial="tut-c" class="text-[12px] sm:text-[13px] lg:text-sm px-1.5 py-1 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">다</button></div>"`);
  });
  it("size md(기본)", () => {
    expect(renderToStaticMarkup(<InlineSelector value="b" onChange={noop} options={OPTS} ariaLabel="선택" />)).toMatchInlineSnapshot(`"<div role="radiogroup" aria-label="선택" class="inline-flex items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 p-0.5 "><button type="button" role="radio" aria-checked="false" class="text-[13px] sm:text-sm lg:text-base px-2 py-1.5 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">가</button><button type="button" role="radio" aria-checked="true" data-testid="opt-b" class="text-[13px] sm:text-sm lg:text-base px-2 py-1.5 whitespace-nowrap shrink-0 rounded transition-colors bg-background text-foreground font-semibold shadow-sm">나</button><button type="button" role="radio" aria-checked="false" data-tutorial="tut-c" class="text-[13px] sm:text-sm lg:text-base px-2 py-1.5 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">다</button></div>"`);
  });
  it("size lg", () => {
    expect(renderToStaticMarkup(<InlineSelector value="c" onChange={noop} options={OPTS} size="lg" />)).toMatchInlineSnapshot(`"<div role="radiogroup" class="inline-flex items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 p-0.5 "><button type="button" role="radio" aria-checked="false" class="text-sm sm:text-base lg:text-lg px-3 py-2 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">가</button><button type="button" role="radio" aria-checked="false" data-testid="opt-b" class="text-sm sm:text-base lg:text-lg px-3 py-2 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">나</button><button type="button" role="radio" aria-checked="true" data-tutorial="tut-c" class="text-sm sm:text-base lg:text-lg px-3 py-2 whitespace-nowrap shrink-0 rounded transition-colors bg-background text-foreground font-semibold shadow-sm">다</button></div>"`);
  });
  it("size xl + className", () => {
    expect(renderToStaticMarkup(<InlineSelector value="a" onChange={noop} options={OPTS} size="xl" className="w-full" />)).toMatchInlineSnapshot(`"<div role="radiogroup" class="inline-flex items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 p-0.5 w-full"><button type="button" role="radio" aria-checked="true" class="text-lg sm:text-2xl lg:text-2xl font-bold px-3 py-1 lg:py-0.5 whitespace-nowrap shrink-0 rounded transition-colors bg-background text-foreground font-semibold shadow-sm">가</button><button type="button" role="radio" aria-checked="false" data-testid="opt-b" class="text-lg sm:text-2xl lg:text-2xl font-bold px-3 py-1 lg:py-0.5 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">나</button><button type="button" role="radio" aria-checked="false" data-tutorial="tut-c" class="text-lg sm:text-2xl lg:text-2xl font-bold px-3 py-1 lg:py-0.5 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">다</button></div>"`);
  });
  it("disabledValues + disabledTitle", () => {
    expect(renderToStaticMarkup(
      <InlineSelector value="a" onChange={noop} options={OPTS} disabledValues={["c"]} disabledTitle="사용 불가" ariaLabel="선택" />,
    )).toMatchInlineSnapshot(`"<div role="radiogroup" aria-label="선택" class="inline-flex items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 p-0.5 "><button type="button" role="radio" aria-checked="true" class="text-[13px] sm:text-sm lg:text-base px-2 py-1.5 whitespace-nowrap shrink-0 rounded transition-colors bg-background text-foreground font-semibold shadow-sm">가</button><button type="button" role="radio" aria-checked="false" data-testid="opt-b" class="text-[13px] sm:text-sm lg:text-base px-2 py-1.5 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground hover:text-foreground">나</button><button type="button" role="radio" aria-checked="false" disabled="" title="사용 불가" data-tutorial="tut-c" class="text-[13px] sm:text-sm lg:text-base px-2 py-1.5 whitespace-nowrap shrink-0 rounded transition-colors text-muted-foreground/40 cursor-not-allowed">다</button></div>"`);
  });
});
