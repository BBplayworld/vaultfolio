// #335(5.167) E2 — 실물 행 메타 `유형 · %`를 nowrap 조각 2개로 나눠 360·375 금액 열 겹침 해소(C152)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const src = readFileSync(path.resolve(__dirname, "../tabs/physical-tab.tsx"), "utf8");

describe("physical-tab 메타 조각 분리", () => {
  it("유형명·`· %`가 각각 whitespace-nowrap 조각이고 바깥은 줄바꿈 허용", () => {
    expect(src).toContain('<span className="whitespace-nowrap">{type.shortLabel}</span>{" "}<span className="whitespace-nowrap">· <span className="font-semibold text-primary tabular-nums">{pct.toFixed(1)}%</span></span>');
    // 360 경계 통째 nowrap(겹침 원인) 제거
    expect(src).not.toContain("min-[360px]:whitespace-nowrap");
    expect(src).not.toContain("max-[360px]:whitespace-normal");
  });
});
