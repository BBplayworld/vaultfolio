import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

import { buildRatioList } from "@/lib/ratio-preview/ratio-list";
import { RATIO_SAMPLE_RATES, RATIO_SAMPLE_STOCKS } from "@/lib/ratio-preview/ratio-sample";
import krEtf from "@/lib/data/kr-etf-master.json";
import usEtf from "@/lib/data/us-etf-master.json";
import { RATIO_SAMPLE } from "../ratio-copy";

// "예시로 먼저 보기"(#66) — 데이터 값·서버 호출 0·상태 전이 정적 검증(vitest node 환경)
const preview = readFileSync(join(__dirname, "..", "ratio-preview.tsx"), "utf8");
const handler = (name: string) => {
  const m = preview.match(new RegExp(`const ${name} = \\(\\) => \\{[\\s\\S]*?\\n  \\};`));
  return m ? m[0] : "";
};

describe("예시 데이터", () => {
  const r = buildRatioList(RATIO_SAMPLE_STOCKS, RATIO_SAMPLE_RATES);
  it("6종목, 비중 28/22/16/14/12/8, 그 외 행 없음", () => {
    expect(r.totalCount).toBe(6);
    expect(r.zeroPriceCount).toBe(0);
    expect(r.rows.map((x) => x.pct)).toEqual([28, 22, 16, 14, 12, 8]);
    expect(r.rows.some((x) => x.isEtc)).toBe(false);
    expect(r.rows.reduce((a, x) => a + x.pct, 0)).toBeCloseTo(100, 5);
  });
  it("국내 58.0%·3종목 / 해외 42.0%·3종목", () => {
    expect(r.split).toEqual([
      { kind: "domestic", pct: 58, count: 3 },
      { kind: "foreign", pct: 42, count: 3 },
    ]);
  });
  it("티커 없음, ETF 마스터 이름과 겹치지 않음", () => {
    expect(RATIO_SAMPLE_STOCKS.every((s) => !s.ticker && !s.brokerHint)).toBe(true);
    const names = new Set([...(krEtf as { name: string }[]), ...(usEtf as { name: string }[])].map((e) => e.name));
    for (const s of RATIO_SAMPLE_STOCKS) expect(names.has(s.name)).toBe(false);
  });
  it("문구 상수 4개", () => {
    expect(Object.keys(RATIO_SAMPLE)).toEqual(["button", "label", "cta", "caption"]);
  });
});

describe("예시 모드 동작(정적)", () => {
  const sample = handler("handleSample");
  const exit = handler("handleSampleExit");
  it("핸들러 추출", () => {
    expect(sample.length).toBeGreaterThan(0);
    expect(exit.length).toBeGreaterThan(0);
  });
  it("서버 호출·한도 소모·인계 저장 없음", () => {
    for (const src of [sample, exit]) {
      expect(src).not.toMatch(/fetch\(|fetchRates|geminiUsage|setHandoff|localStorage|sessionStorage|router\./);
    }
  });
  it("GA는 sample 1건만, 연타·로딩 중 무시", () => {
    expect([...sample.matchAll(/track\(/g)]).toHaveLength(1);
    expect(sample).toContain('method: "sample"');
    expect(sample).toContain('status === "loading" || status === "sample"');
    expect(exit).not.toContain("track(");
  });
  it("복귀: 한도 오류만 복원, 파일창 자동 열림 없음", () => {
    expect(sample).toMatch(/errorKind === "limit" \|\| errorKind === "device"/);
    expect(exit).not.toContain(".click()");
    expect(exit).toContain("focusWhenVisible(() => dropzoneRef.current)");
  });
  it("예시에서 저장·인앱·재선택·노트 DOM 분기 제외", () => {
    expect(preview).toContain("{isSample ? (");
    expect(preview).toContain("!isSample && (result.zeroPriceCount");
    expect(preview).toContain('data-testid="ratio-sample-btn"');
  });
});

describe("포커스 이동(U1)", () => {
  it("열림 직후 hidden 거부를 activeElement 확인 재시도로 처리", () => {
    expect(preview).toContain("document.activeElement !== el");
    expect(preview).toContain("focusWhenVisible(() => (status === \"sample\"");
  });
});
