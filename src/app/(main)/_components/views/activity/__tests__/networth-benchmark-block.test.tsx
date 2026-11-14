// 5.102 #201 가계 통계와 나란히 블록 — 상태별 렌더(가공 표 주입)·빈 상수 미표시·데이터 안전 정적 검사.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { EOK, HOUSEHOLD_NETWORTH_STATS } from "@/config/household-networth-stats";
import { F1, F2, F3, F4, T, T3, inputOf } from "@/lib/report/__tests__/networth-benchmark-fixture";
import { NetworthBenchmarkBlock } from "../networth-benchmark-block";

const DIR = "src/app/(main)/_components/views/activity";
const NEW_FILES = ["src/config/household-networth-stats.ts", "src/lib/report/networth-benchmark.ts", `${DIR}/networth-benchmark-block.tsx`];
const HIDDEN_NOTE = "부동산을 등록하지 않아 내 구간은 표시하지 않았어요. 통계의 순자산은 가구의 자산에서 부채를 뺀 값이에요.";

const html = (p: { netAsset: number; realEstateCount: number }, stats = T) => renderToStaticMarkup(<NetworthBenchmarkBlock {...p} stats={stats} />);
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
/** testId 요소의 글자만(태그 제거) */
const textOf = (s: string, id: string): string | null => {
  const m = s.match(new RegExp(`<(\\w+)[^>]*data-testid="${id}"[^>]*>(.*?)</\\1>`));
  return m ? m[2].replace(/<[^>]+>/g, "") : null;
};
const mineRow = (s: string): string | null => s.match(/data-testid="benchmark-row-(\d+)"[^>]*data-mine="true"/)?.[1] ?? null;

describe("앱 상수 렌더", () => {
  it("실제 상수로 10행·내 구간 1행·출처 줄(기준일 없음)", () => {
    const s = renderToStaticMarkup(<NetworthBenchmarkBlock netAsset={3 * EOK} realEstateCount={1} />);
    expect(count(s, /data-testid="benchmark-row-\d+"/g)).toBe(10);
    expect(mineRow(s)).toBe("5");
    expect(textOf(s, "benchmark-column")).toBe("순자산 구간(가구 10%씩)");
    expect(textOf(s, "benchmark-source")).toBe("자료: 국가데이터처·한국은행·금융감독원「가계금융복지조사」2025년(통계표 12)");
    expect(textOf(s, "benchmark-label")).toContain("2025년 조사");
    expect(s).not.toMatch(/benchmark-bar-|benchmark-value-/);
    expect(HOUSEHOLD_NETWORTH_STATS.brackets).toHaveLength(10);
  });
});
describe("검증 실패", () => {
  it("검증에 실패한 표는 그리지 않는다", () => {
    expect(html({ netAsset: EOK, realEstateCount: 1 }, { meta: null, brackets: T.brackets })).toBe("");
    expect(html({ netAsset: EOK, realEstateCount: 1 }, { meta: T.meta, brackets: T.brackets.slice(0, 3) })).toBe("");
  });
});

describe("상태별 표시", () => {
  it("F3 기본 — 강조 1행·칩·문장·라벨·출처", () => {
    const s = html(inputOf(F3));
    expect(mineRow(s)).toBe("3");
    expect(count(s, /data-mine="true"/g)).toBe(1);
    expect(count(s, /aria-current="true"/g)).toBe(1);
    expect(count(s, /data-testid="benchmark-mine-chip"/g)).toBe(1);
    expect(textOf(s, "benchmark-sentence")).toBe("가구 100곳 중 약 20곳이 이 구간, 약 20곳이 이보다 높은 구간이에요.");
    expect(textOf(s, "benchmark-title")).toBe("가계 통계와 나란히");
    expect(textOf(s, "benchmark-grade-note")).toBe("등급 점수에는 반영되지 않아요.");
    expect(textOf(s, "benchmark-label")).toBe("가구 기준· 등록한 자산 기준· 2099년 조사");
    expect(textOf(s, "benchmark-source")).toBe("자료: 가공기관A·가공기관B「가공 조사」2099년(2099-03-31 기준)(T-000)");
    expect(s).not.toContain("benchmark-hidden-note");
    expect(s).not.toContain("benchmark-top-note");
    expect(count(s, /data-testid="benchmark-row-\d+"/g)).toBe(6);
    expect(s).not.toMatch(/benchmark-bar-|benchmark-value-/);
  });
  it("F4 — 보증금을 뺀 구간에 강조", () => {
    expect(mineRow(html(inputOf(F4)))).toBe("2");
  });
  it("F1·F2 부동산 0건 — 강조·칩·문장 없음, 안내 문구가 글자까지 같다", () => {
    for (const f of [F1, F2]) {
      const s = html(inputOf(f));
      expect(count(s, /data-mine|aria-current|benchmark-mine-chip|benchmark-sentence|benchmark-top-note/g)).toBe(0);
      expect(textOf(s, "benchmark-hidden-note")).toBe(HIDDEN_NOTE);
      expect(textOf(s, "benchmark-label")).toContain("2099년 조사");
      expect(count(s, /data-testid="benchmark-row-\d+"/g)).toBe(6);
      expect(s).toContain("benchmark-source");
    }
  });
  it("최상위 — 뒷절 없음 + 최상위 안내", () => {
    const s = html({ netAsset: 12 * EOK, realEstateCount: 1 });
    expect(mineRow(s)).toBe("5");
    expect(textOf(s, "benchmark-sentence")).toBe("가구 100곳 중 약 20곳이 이 구간이에요.");
    expect(textOf(s, "benchmark-top-note")).toBe("통계 표에서 가장 높은 구간이라 이 위로는 더 나뉘지 않아요.");
    expect(s).not.toContain("이보다 높은");
  });
  it("순자산 0 이하 — 문형이 기본과 같고 최하 구간 강조", () => {
    const s = html({ netAsset: -0.5 * EOK, realEstateCount: 1 });
    expect(mineRow(s)).toBe("0");
    expect(textOf(s, "benchmark-sentence")).toBe("가구 100곳 중 약 3곳이 이 구간, 약 97곳이 이보다 높은 구간이에요.");
  });
  it("약 1곳 미만 — 앞절(T)·뒷절(T3)", () => {
    expect(textOf(html({ netAsset: 7 * EOK, realEstateCount: 1 }), "benchmark-sentence")).toBe("가구 100곳 중 약 1곳 미만이 이 구간, 약 20곳이 이보다 높은 구간이에요.");
    expect(textOf(html({ netAsset: 7 * EOK, realEstateCount: 1 }, T3), "benchmark-sentence")).toBe("가구 100곳 중 약 20곳이 이 구간, 약 1곳 미만이 이보다 높은 구간이에요.");
  });
});

describe("규약 — 조작 0·중립 색·금지어·내 금액 없음", () => {
  const states = [html(inputOf(F1)), html(inputOf(F2)), html(inputOf(F3)), html(inputOf(F4)), html({ netAsset: 12 * EOK, realEstateCount: 1 }), html({ netAsset: -1, realEstateCount: 1 })];
  it("버튼·링크·탭 정지 0", () => {
    for (const s of states) expect(s).not.toMatch(/<button|<a[\s>]|role="button"|tabindex/i);
  });
  it("손익색·주황·brand 0, 전환·hover 효과 0", () => {
    for (const s of states) {
      // 제목 아이콘(SectionHeader tone=brand의 text-primary 1건)은 공용 헤더 규약 — 그 밖의 계산 색은 0
      expect(s.replace(/<svg[^>]*>.*?<\/svg>/, "")).not.toMatch(/rose|red-|blue-|orange|amber|primary|brand|sky-/);
      expect(s).not.toMatch(/transition|hover:|active:|cursor-/);
    }
  });
  it("평가어·권유·느낌표 0, 내 순자산 금액 0", () => {
    for (const s of states) {
      const text = s.replace(/<[^>]+>/g, " ");
      expect(text).not.toMatch(/상위|하위|평균|부자|부족|목표|축하|아쉽|!|약 0곳/);
      expect(text).not.toMatch(/390,000,000|3\.9억|260,000,000|2\.6억|56,042|127,000,000/);
    }
  });
});

describe("데이터 안전 — 정적 검사", () => {
  it("신규 3파일에 서버 전송·저장·계측·화면 상태 코드 0", () => {
    for (const f of NEW_FILES) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/fetch\(|localStorage|sessionStorage|track\(|trackScreen|useEffect|useState|navigator\.|indexedDB|XMLHttpRequest|sendBeacon/);
    }
  });
  it("블록·판정 함수에 연도·기관명 문자열을 직접 쓰지 않는다(상수 파생)", () => {
    for (const f of NEW_FILES.slice(1)) expect(readFileSync(f, "utf8"), f).not.toMatch(/20\d\d/);
  });
  it("성적표는 import 1줄 + JSX 1줄로만 블록을 쓰고, 순자산은 요약값 그대로 넘긴다", () => {
    const src = readFileSync(`${DIR}/asset-report-view.tsx`, "utf8");
    expect(count(src, /NetworthBenchmarkBlock/g)).toBe(2);
    expect(src).toContain("<NetworthBenchmarkBlock netAsset={summary.netAsset} realEstateCount={assetData.realEstate.length} />");
    // 위치: 5축 측정 뒤, AI 평가 프롬프트 앞
    expect(src.indexOf('title="5축 측정"')).toBeLessThan(src.indexOf("<NetworthBenchmarkBlock"));
    expect(src.indexOf("<NetworthBenchmarkBlock")).toBeLessThan(src.indexOf("{/* ── AI 평가 프롬프트 ── */}"));
  });
  it("등급 계산·AI 프롬프트·공유 카드는 구간을 읽지 않는다", () => {
    for (const f of ["src/lib/report/asset-grade.ts", "src/lib/ai-prompts.ts", "src/contexts/asset-data-context.tsx"]) {
      expect(readFileSync(f, "utf8"), f).not.toMatch(/networth-benchmark|household-networth/);
    }
  });
});
