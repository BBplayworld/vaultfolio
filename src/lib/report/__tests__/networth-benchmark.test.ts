// 5.102 #201 가계 통계와 나란히 — 상수 검증·경계 귀속·문장 수치·라벨·실사용 픽스처 F1~F4. 판정은 가공 표(T·T2·T3)로만 돌린다.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EOK, MAN, HOUSEHOLD_NETWORTH_STATS, type HouseholdNetworthStats } from "@/config/household-networth-stats";
import {
  benchmarkSentence, bracketLabel, buildNetworthBenchmark, computeCounts, findBracketIndex, validateStats, type ValidNetworthStats,
} from "../networth-benchmark";
import { F1, F2, F3, F4, META, T, T2, T3, inputOf } from "./networth-benchmark-fixture";

const valid = (s: HouseholdNetworthStats): ValidNetworthStats => {
  const v = validateStats(s);
  if (!v) throw new Error("가공 표가 검증을 통과해야 한다");
  return v;
};
const build = (netAsset: number, realEstateCount = 1, stats: HouseholdNetworthStats = T) => buildNetworthBenchmark({ netAsset, realEstateCount, stats });
const withBrackets = (f: (b: HouseholdNetworthStats["brackets"][number], i: number) => Partial<HouseholdNetworthStats["brackets"][number]>): HouseholdNetworthStats =>
  ({ meta: META, brackets: T.brackets.map((b, i) => ({ ...b, ...f(b, i) })) });

describe("앱 상수(통계표 12 · 2025년 순자산 분위 경계값)", () => {
  const H = HOUSEHOLD_NETWORTH_STATS;
  it("검증을 통과하고 구간 10개·비중 모두 10·합 정확히 100", () => {
    expect(validateStats(H)).not.toBeNull();
    expect(H.brackets).toHaveLength(10);
    expect(H.brackets.every((b) => b.sharePct === 10)).toBe(true);
    expect(H.brackets.reduce((a, b) => a + b.sharePct, 0)).toBe(100);
    expect(H.meta).toMatchObject({ surveyYear: 2025, boundary: "lower-inclusive", referenceDate: null });
  });
  it("경계는 P10~P90 원 단위(만원 × 10,000), 양 끝은 열림", () => {
    const man = [1210, 5108, 10296, 16472, 23860, 33050, 46180, 69380, 110020];
    expect(H.brackets.map((b) => b.min)).toEqual([null, ...man.map((m) => m * MAN)]);
    expect(H.brackets.map((b) => b.max)).toEqual([...man.map((m) => m * MAN), null]);
  });
  it("10행 라벨이 공표 경계와 문자 단위로 같다(반올림 없음)", () => {
    expect(build(1, 1, H)!.rows.map((r) => r.label)).toEqual([
      "1,210만 미만", "1,210만~5,108만", "5,108만~1억 296만", "1억 296만~1억 6,472만", "1억 6,472만~2억 3,860만",
      "2억 3,860만~3억 3,050만", "3억 3,050만~4억 6,180만", "4억 6,180만~6억 9,380만", "6억 9,380만~11억 20만", "11억 20만 이상",
    ]);
    expect(build(1, 1, H)!.columnLabel).toBe("순자산 구간(가구 10%씩)");
  });
  it("경계 귀속(하한 포함) · 0 이하는 1구간 · P90은 최상위", () => {
    const at = (w: number) => build(w, 1, H)!.mineIndex;
    expect(at(110020 * MAN)).toBe(9);
    expect(at(110020 * MAN - 1)).toBe(8);
    expect(at(23860 * MAN - 1)).toBe(4);
    expect(at(23860 * MAN)).toBe(5);
    expect(at(0)).toBe(0);
    expect(at(-3 * EOK)).toBe(0);
  });
  it("문장 — 약 10곳 고정, M = 100 − 10×k, 최상위는 뒷절 없음", () => {
    const v = validateStats(H)!;
    H.brackets.forEach((_, i) => {
      const c = computeCounts(i, v);
      expect(c.nText).toBe("약 10곳");
      expect(c.m).toBe(100 - 10 * (i + 1));
    });
    expect(build(3 * EOK, 1, H)!.sentence).toBe("가구 100곳 중 약 10곳이 이 구간, 약 40곳이 이보다 높은 구간이에요."); // 2억 3,860만~3억 3,050만 = 6번째(k=6)
    expect(build(12 * EOK, 1, H)!.sentence).toBe("가구 100곳 중 약 10곳이 이 구간이에요.");
    expect(build(-1, 1, H)!.sentence).toBe("가구 100곳 중 약 10곳이 이 구간, 약 90곳이 이보다 높은 구간이에요.");
  });
  it("평균·점유율 값은 상수에 없다", () => {
    expect(readFileSync("src/config/household-networth-stats.ts", "utf8")).not.toMatch(/47143|47,143|152085|104592|1334|5125/);
  });
});

describe("validateStats", () => {
  it("가공 표 3종은 통과한다(합 99.9는 허용 오차 안)", () => {
    for (const s of [T, T2, T3]) expect(validateStats(s)).not.toBeNull();
  });
  it("meta 누락·필수 항목 빈 값이면 실패", () => {
    expect(validateStats({ meta: null, brackets: T.brackets })).toBeNull();
    expect(validateStats({ meta: { ...META, surveyName: " " }, brackets: T.brackets })).toBeNull();
    expect(validateStats({ meta: { ...META, agencies: [] }, brackets: T.brackets })).toBeNull();
    expect(validateStats({ meta: { ...META, surveyYear: 2099.5 }, brackets: T.brackets })).toBeNull();
    expect(validateStats({ meta: { ...META, referenceDate: "2099.03.31" }, brackets: T.brackets })).toBeNull();
    expect(validateStats({ meta: { ...META, tableSource: { name: "표", id: "", url: "u" } }, brackets: T.brackets })).toBeNull();
    expect(validateStats({ meta: { ...META, boundary: "x" as never }, brackets: T.brackets })).toBeNull();
  });
  it("구간 5개 미만이면 실패", () => {
    expect(validateStats({ meta: META, brackets: [{ min: null, max: 0, sharePct: 10 }, { min: 0, max: EOK, sharePct: 40 }, { min: EOK, max: 3 * EOK, sharePct: 30 }, { min: 3 * EOK, max: null, sharePct: 20 }] })).toBeNull();
  });
  it("열린 끝은 첫 구간 하한·마지막 구간 상한뿐", () => {
    expect(validateStats(withBrackets((_, i) => (i === 0 ? { min: -EOK } : {})))).toBeNull();
    expect(validateStats(withBrackets((_, i) => (i === 5 ? { max: 20 * EOK } : {})))).toBeNull();
    expect(validateStats(withBrackets((_, i) => (i === 2 ? { max: null } : {})))).toBeNull();
  });
  it("경계 빈틈·겹침·역전이면 실패", () => {
    expect(validateStats(withBrackets((_, i) => (i === 2 ? { min: 1.5 * EOK } : {})))).toBeNull(); // 빈틈
    expect(validateStats(withBrackets((_, i) => (i === 2 ? { min: 0.5 * EOK } : {})))).toBeNull(); // 겹침
    expect(validateStats(withBrackets((_, i) => (i === 3 ? { min: 5 * EOK, max: 3 * EOK } : {})))).toBeNull();
  });
  it("합이 허용 오차(구간 수 × 0.5 × 10^-소수자리)를 넘으면 실패", () => {
    // 6구간·소수 1자리 → 허용 ±0.3
    expect(validateStats(withBrackets((b, i) => (i === 1 ? { sharePct: b.sharePct + 0.4 } : {})))).not.toBeNull(); // 100.3
    expect(validateStats(withBrackets((b, i) => (i === 1 ? { sharePct: b.sharePct + 0.5 } : {})))).toBeNull();     // 100.4
    expect(validateStats(withBrackets((b, i) => (i === 1 ? { sharePct: b.sharePct - 0.3 } : {})))).toBeNull();     // 99.6
    expect(validateStats(withBrackets((b, i) => (i === 1 ? { sharePct: b.sharePct + 10 } : {})))).toBeNull();      // 자릿수 오기
  });
  it("비중이 음수·비유한·원문 소수 자리 초과면 실패", () => {
    expect(validateStats(withBrackets((_, i) => (i === 4 ? { sharePct: -0.3 } : {})))).toBeNull();
    expect(validateStats(withBrackets((_, i) => (i === 4 ? { sharePct: Number.NaN } : {})))).toBeNull();
    expect(validateStats(withBrackets((_, i) => (i === 4 ? { sharePct: 0.35 } : {})))).toBeNull();
  });
});

describe("findBracketIndex — 경계 귀속", () => {
  const t = valid(T);
  it("하한 포함: 경계값은 위 구간", () => {
    expect(findBracketIndex(3 * EOK, t)).toBe(3);
    expect(findBracketIndex(3 * EOK - 1, t)).toBe(2);
    expect(findBracketIndex(0, t)).toBe(1);
    expect(findBracketIndex(-1, t)).toBe(0);
    expect(findBracketIndex(10 * EOK, t)).toBe(5);
    expect(findBracketIndex(12 * EOK, t)).toBe(5);
  });
  it("음수는 원문 음수 구간, 없으면 최하 구간(전용 분기 없음)", () => {
    expect(findBracketIndex(-5000 * MAN, t)).toBe(0);
    expect(findBracketIndex(-5000 * MAN, valid(T2))).toBe(0);
    expect(findBracketIndex(0, valid(T2))).toBe(0);
  });
  it("비교값은 화면 표시와 같은 원 단위 정수(Math.round)", () => {
    expect(findBracketIndex(299_999_999.6, t)).toBe(3); // 표시 3억 → 3억 구간
    expect(findBracketIndex(299_999_999.4, t)).toBe(2);
    expect(findBracketIndex(-0.4, t)).toBe(1);          // 표시 0원
    expect(findBracketIndex(-0.6, t)).toBe(0);
  });
  it("상한 포함 표는 경계값이 아래 구간", () => {
    const u = valid({ meta: { ...META, boundary: "upper-inclusive" }, brackets: T.brackets });
    expect(findBracketIndex(3 * EOK, u)).toBe(2);
    expect(findBracketIndex(3 * EOK + 1, u)).toBe(3);
    expect(findBracketIndex(0, u)).toBe(0);
  });
  it("비유한값은 null", () => {
    for (const v of [Number.NaN, Infinity, -Infinity]) expect(findBracketIndex(v, t)).toBeNull();
  });
});

describe("computeCounts — N = U − L, M = 100 − U", () => {
  const t = valid(T);
  it("가공 표 T 전 구간", () => {
    // 누적 3.4 / 29.9 / 60.3 / 79.6 / 79.9 / 99.9 → 반올림 3 / 30 / 60 / 80 / 80 / (최상위 100)
    expect(T.brackets.map((_, i) => { const c = computeCounts(i, t); return [c.n, c.m]; })).toEqual([[3, 97], [27, 70], [30, 40], [20, 20], [0, 20], [20, 0]]);
  });
  it("N이 막대 값의 반올림과 1 달라도 누적 반올림의 차를 쓴다(19.3 → 약 20곳)", () => {
    expect(computeCounts(3, t).nText).toBe("약 20곳");
  });
  it("N=0 또는 비중 0.5 미만이면 '약 1곳 미만'", () => {
    expect(computeCounts(4, t).nText).toBe("약 1곳 미만");
    // 누적이 .5를 넘는 자리에 걸려 N=1이 되는 0.1% 구간
    const s = valid({ meta: META, brackets: [{ min: null, max: 0, sharePct: 3.4 }, { min: 0, max: EOK, sharePct: 0.1 }, { min: EOK, max: 3 * EOK, sharePct: 56.5 }, { min: 3 * EOK, max: 5 * EOK, sharePct: 20.0 }, { min: 5 * EOK, max: null, sharePct: 20.0 }] });
    expect(computeCounts(1, s).n).toBe(1);
    expect(computeCounts(1, s).nText).toBe("약 1곳 미만");
  });
  it("최상위는 구간 순번으로 판정, U=100 고정, 뒷절 없음", () => {
    const c = computeCounts(5, t);
    expect(c).toMatchObject({ isTop: true, n: 20, m: 0, mText: null });
    expect(benchmarkSentence(c)).toBe("가구 100곳 중 약 20곳이 이 구간이에요.");
  });
  it("최상위가 아닌데 M=0이면 뒷절을 '약 1곳 미만'으로(T3)", () => {
    const c = computeCounts(4, valid(T3));
    expect(c).toMatchObject({ isTop: false, m: 0, mText: "약 1곳 미만" });
    expect(benchmarkSentence(c)).toBe("가구 100곳 중 약 20곳이 이 구간, 약 1곳 미만이 이보다 높은 구간이에요.");
    expect(computeCounts(5, valid(T3)).nText).toBe("약 1곳 미만"); // 최상위 0.4
  });
  it("모든 표·모든 구간에서 N + M ≤ 100, 음수 없음, '약 0곳' 없음", () => {
    const over = withBrackets((b, i) => (i === 1 ? { sharePct: b.sharePct + 0.4 } : {})); // 합 100.3
    for (const s of [T, T2, T3, over]) {
      const v = valid(s);
      v.brackets.forEach((_, i) => {
        const c = computeCounts(i, v);
        expect(c.n).toBeGreaterThanOrEqual(0);
        expect(c.m).toBeGreaterThanOrEqual(0);
        expect(c.n + c.m).toBeLessThanOrEqual(100);
        expect(benchmarkSentence(c)).not.toContain("약 0곳");
        expect(benchmarkSentence(c).includes("이보다 높은")).toBe(i !== v.brackets.length - 1);
      });
    }
  });
});

describe("라벨·값 표기", () => {
  it("구간 라벨은 경계 금액에서 파생, 원문 표기(label)가 있으면 그대로", () => {
    expect(build(0)!.rows.map((r) => r.label)).toEqual(["0원 미만", "0원~1억", "1억~3억", "3억~5억", "5억~10억", "10억 이상"]);
    expect(bracketLabel({ min: 5000 * MAN, max: EOK, sharePct: 1 }, "lower-inclusive")).toBe("5,000만~1억");
    expect(bracketLabel({ min: null, max: 0, sharePct: 1, label: "원문 표기" }, "lower-inclusive")).toBe("원문 표기");
    expect(bracketLabel({ min: null, max: EOK, sharePct: 1 }, "upper-inclusive")).toBe("1억 이하");
    expect(bracketLabel({ min: 10 * EOK, max: null, sharePct: 1 }, "upper-inclusive")).toBe("10억 초과");
  });
  it("라벨 연도·출처는 meta에서 파생한다", () => {
    const v = buildNetworthBenchmark({ netAsset: 0, realEstateCount: 1, stats: { meta: { ...META, surveyYear: 2101 }, brackets: T.brackets } })!;
    expect(v.labelParts).toEqual(["가구 기준", "· 등록한 자산 기준", "· 2101년 조사"]);
    expect(buildNetworthBenchmark({ netAsset: 0, realEstateCount: 1, stats: { meta: { ...META, referenceDate: null }, brackets: T.brackets } })!.sourceParts[2]).toBe("2099년"); // 기준일 미확인이면 생략
    expect(v.sourceParts).toEqual(["자료: 가공기관A·가공기관B", "「가공 조사」", "2101년(2099-03-31 기준)", "(T-000)"]);
  });
});

describe("실사용 형태 픽스처(computeNetAsset 값 그대로)", () => {
  it("F1 주식만 — 부동산 0건: 강조·문장 없음", () => {
    expect(inputOf(F1).netAsset).toBe(56_042_512.5); // 해외주식 × 환율 소수(홈 헤더와 같은 값, C65)
    const v = buildNetworthBenchmark({ ...inputOf(F1), stats: T })!;
    expect(v).toMatchObject({ hidden: true, mineIndex: null, counts: null, sentence: null });
    expect(v.rows.some((r) => r.mine)).toBe(false);
    expect(v.rows).toHaveLength(6);
  });
  it("F2 세입자 + 신용대출 — 순자산이 음수여도 부동산 0건이 먼저", () => {
    expect(inputOf(F2).netAsset).toBe(-127_000_000);
    expect(buildNetworthBenchmark({ ...inputOf(F2), stats: T })).toMatchObject({ hidden: true, mineIndex: null, sentence: null });
  });
  it("F3 집 + 담보대출 — 3억~5억, N=20·M=20", () => {
    expect(inputOf(F3).netAsset).toBe(390_000_000);
    const v = buildNetworthBenchmark({ ...inputOf(F3), stats: T })!;
    expect(v).toMatchObject({ hidden: false, mineIndex: 3, counts: { n: 20, m: 20 } });
    expect(v.sentence).toBe("가구 100곳 중 약 20곳이 이 구간, 약 20곳이 이보다 높은 구간이에요.");
    expect(v.rows.filter((r) => r.mine)).toHaveLength(1);
  });
  it("F4 임대인 보증금 — 보증금을 뺀 1억~3억(미차감이면 5억~10억)", () => {
    expect(inputOf(F4).netAsset).toBe(260_000_000);
    expect(buildNetworthBenchmark({ ...inputOf(F4), stats: T })!.mineIndex).toBe(2);
  });
  it("F3 변형 — 경계·최상위·0 이하·약 1곳 미만", () => {
    expect(build(3 * EOK)!.mineIndex).toBe(3);
    expect(build(299_999_999)!.mineIndex).toBe(2);
    expect(build(12 * EOK)).toMatchObject({ mineIndex: 5, sentence: "가구 100곳 중 약 20곳이 이 구간이에요." });
    expect(build(0)!.mineIndex).toBe(1);
    expect(build(-5000 * MAN)).toMatchObject({ mineIndex: 0, sentence: "가구 100곳 중 약 3곳이 이 구간, 약 97곳이 이보다 높은 구간이에요." });
    expect(build(-5000 * MAN, 1, T2)!.mineIndex).toBe(0);
    expect(build(7 * EOK)!.sentence).toBe("가구 100곳 중 약 1곳 미만이 이 구간, 약 20곳이 이보다 높은 구간이에요.");
  });
  it("부동산이 있어도 순자산이 비유한값이면 강조·문장·안내 모두 없다", () => {
    expect(build(Number.NaN)).toMatchObject({ hidden: false, mineIndex: null, sentence: null });
  });
});
