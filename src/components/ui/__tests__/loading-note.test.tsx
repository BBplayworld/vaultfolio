// 4.84 E — 공통 로딩 UI: 스켈레톤 색(카드와 구분)·LoadingNote 구조(sr-only status 1개, 시각 문구는 0.5초 뒤)·구 문구 0
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { LoadingNote, LOADING_LABEL, SLOW_LABEL } from "../loading-note";
import { Skeleton, SKELETON_FILL } from "../skeleton";

describe("Skeleton", () => {
  it("카드와 구분되는 foreground 13% + motion-safe pulse(reduced-motion이면 정지), 기존 animate-pulse 문자열 유지", () => {
    expect(SKELETON_FILL).toBe("bg-foreground/[0.13] motion-safe:animate-pulse");
    const html = renderToStaticMarkup(<Skeleton className="h-4 w-12" />);
    expect(html).toContain("bg-foreground/[0.13]");
    expect(html).toContain("animate-pulse");
    expect(html).not.toContain("bg-accent");
  });
});

describe("LoadingNote", () => {
  it("첫 렌더(0초): role=status sr-only 문구 1개만, 시각 문구(loading-note)는 아직 없다 — 빠른 응답은 깜빡임 0", () => {
    const html = renderToStaticMarkup(<LoadingNote active label={LOADING_LABEL.price} />);
    expect(html.match(/role="status"/g)).toHaveLength(1);
    expect(html).toContain('class="sr-only"');
    expect(html).toContain("시세를 불러오는 중…");
    expect(html).not.toContain("loading-note");
    expect(html).toContain("min-h-6"); // 자리 예약
  });
  it("비활성이면 아무것도 그리지 않는다(완료 후 aria-busy·status 잔류 0)", () => {
    expect(renderToStaticMarkup(<LoadingNote active={false} label="x" />)).toBe("");
  });
  it("문구 상수: 시세·가격 흐름·배당·지연", () => {
    expect(LOADING_LABEL).toEqual({ price: "시세를 불러오는 중…", flow: "가격 흐름을 불러오는 중…", dividend: "배당 정보를 불러오는 중…" });
    expect(SLOW_LABEL).toBe("평소보다 오래 걸려요. 잠시만 기다려 주세요");
  });
});

// E3 — 구 문구 화면 0(주석·테스트 제외). `점검 중`과 오류 토스트 `조회 중 오류가`는 다른 의미라 대상이 아니다
function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) {
      if (n !== "__tests__") walk(p, out);
    } else if (/\.tsx?$/.test(n)) out.push(p);
  }
  return out;
}
describe("구 로딩 문구 0 (E3)", () => {
  it("`기준가 조회 중`·`조회 중…`·`조회 중...` 문자열이 src 코드에 없다", () => {
    const hits = walk("src").filter((f) => /기준가 조회 중|조회 중…|조회 중\.\.\./.test(readFileSync(f, "utf8")));
    expect(hits).toEqual([]);
  });
  it("`점검 중`·`조회 중 오류가` 문구는 그대로", () => {
    expect(readFileSync("src/app/(main)/_components/views/activity/asset-report-view.tsx", "utf8")).toContain('"점검 중"');
    expect(readFileSync("src/app/(main)/_components/forms/asset-update/input/stock-input.tsx", "utf8")).toContain("조회 중 오류가 발생했습니다.");
  });
});
