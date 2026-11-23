// 5.142 D3(5.141 이월)·저장·서버·GA(소스 검사)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("D3·저장·서버·GA(소스 검사)", () => {
  const iv = read("app/(main)/_components/views/invest/invest-view.tsx");
  it("hashchange 구독(앱 전용), 전환은 replaceState만(push 0)", () => {
    expect(iv).toContain('window.addEventListener("hashchange", on)');
    expect(iv).toContain('window.removeEventListener("hashchange", on)');
    expect(iv).toContain('if (variant !== "app") return;');
    expect(iv).not.toContain("pushState");
  });
  it("새 UI 파일에 storage·fetch·track 0, invest-view의 track은 category만", () => {
    for (const f of ["lib/invest/three.ts", "lib/invest/period.ts", "app/(main)/_components/views/invest/three-view.tsx", "app/(main)/_components/views/invest/period-card.tsx", "app/(main)/_components/views/invest/pattern-section.tsx"]) expect(read(f), f).not.toMatch(/localStorage|sessionStorage|fetch\(|track\(|pushState/);
    expect([...iv.matchAll(/track\(([^)]*)\)/g)].map((m) => m[1])).toEqual(['"feature_use", { category }']);
    for (const c of ["invest_phase_table", "invest_recession", "invest_range", "invest_my_start", "invest_my_xray"]) expect(iv).toContain(`once("${c}")`);
    const lazy = read("app/(main)/_components/views/invest/invest-lazy.tsx");
    expect(lazy).not.toMatch(/track\(|fetch\(|localStorage\.setItem/);
    expect(lazy).toContain('setInitialAxis("region")');
  });
  it("T1 링크와 안전 문장 사이 간격 1단계(ml-1), 높이 0", () => {
    expect(read("app/(main)/_components/views/invest/period-card.tsx")).toContain('className="relative ml-1 inline-block whitespace-nowrap');
  });
});

