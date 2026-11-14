// 5.109 핫픽스 — 접힌 자세히 패널의 sr-only(absolute) 자손이 문서 높이를 늘리지 않도록 clip 박스가 containing block이어야 한다.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { BenchmarkMore } from "../benchmark-more";

describe("BenchmarkMore 접힘 높이", () => {
  const s = renderToStaticMarkup(<BenchmarkMore><table><caption className="sr-only">x</caption></table></BenchmarkMore>);
  it("접힘은 grid-rows-[0fr]·inert", () => {
    expect(s).toMatch(/data-open="false"[^>]*inert/);
    expect(s).toContain("grid-rows-[0fr]");
  });
  it("clip 박스는 relative + min-h-0 + overflow-hidden (sr-only 누수 방지)", () => {
    expect(s).toMatch(/class="relative min-h-0 overflow-hidden"/);
  });
});
