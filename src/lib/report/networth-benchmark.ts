// 가계 통계와 나란히(#201, 5.102) — 통계 상수 검증·내 구간 판정·문장 수치·구간 라벨. 순수 함수만(화면·저장·전송 없음).
// 순자산은 호출부가 넘긴 값(getAssetSummary().netAsset)을 그대로 쓴다 — 새 환산·합계를 만들지 않는다.
import type { HouseholdNetworthBracket, HouseholdNetworthMeta, HouseholdNetworthStats } from "@/config/household-networth-stats";

export const MIN_BRACKETS = 5; // 구간이 이보다 적으면 표시하지 않는다(재판정 대상)

export interface ValidNetworthStats {
  meta: HouseholdNetworthMeta;
  brackets: readonly HouseholdNetworthBracket[];
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const filled = (s: unknown): s is string => typeof s === "string" && s.trim().length > 0;

/** 비중을 원문 소수 자리 기준 정수로 — 부동소수 합 오차 없이 누적하기 위함 */
function shareUnits(sharePct: number, decimals: number): number {
  return Math.round(sharePct * 10 ** decimals);
}

/**
 * 상수 검증 — 실패하면 null(블록 미표시). 빈 상수(원문 전)와 옮겨 적기 오류를 같은 가드로 막는다.
 * 합 허용 오차 = 구간 수 × 0.5 × 10^-shareDecimals(구간별 반올림 오차 상한).
 */
export function validateStats(stats: HouseholdNetworthStats): ValidNetworthStats | null {
  const { meta, brackets } = stats;
  if (!meta || !Array.isArray(brackets) || brackets.length < MIN_BRACKETS) return null;
  if (!filled(meta.surveyName) || !Array.isArray(meta.agencies) || meta.agencies.length === 0 || !meta.agencies.every(filled)) return null;
  if (!Number.isInteger(meta.surveyYear) || (meta.referenceDate !== null && !DATE_RE.test(meta.referenceDate)) || !DATE_RE.test(meta.transcribedAt)) return null;
  if (!meta.tableSource || !filled(meta.tableSource.name) || !filled(meta.tableSource.id) || (meta.tableSource.url !== undefined && !filled(meta.tableSource.url)) || !filled(meta.sourceUnit)) return null;
  if (!Number.isInteger(meta.shareDecimals) || meta.shareDecimals < 0 || meta.shareDecimals > 4) return null;
  if (meta.boundary !== "lower-inclusive" && meta.boundary !== "upper-inclusive") return null;

  const last = brackets.length - 1;
  const scale = 10 ** meta.shareDecimals;
  let sum = 0;
  for (let i = 0; i <= last; i++) {
    const b = brackets[i];
    // 열린 끝은 첫 구간의 하한·마지막 구간의 상한뿐
    if ((b.min === null) !== (i === 0) || (b.max === null) !== (i === last)) return null;
    if (b.min !== null && !Number.isFinite(b.min)) return null;
    if (b.max !== null && !Number.isFinite(b.max)) return null;
    if (b.min !== null && b.max !== null && b.min >= b.max) return null;       // 경계 단조 증가
    if (i > 0 && brackets[i - 1].max !== b.min) return null;                    // 빈틈·겹침 0
    if (!Number.isFinite(b.sharePct) || b.sharePct < 0) return null;
    if (Math.abs(b.sharePct * scale - shareUnits(b.sharePct, meta.shareDecimals)) > 1e-6) return null; // 소수 자리 초과
    if (b.label !== undefined && !filled(b.label)) return null;
    sum += shareUnits(b.sharePct, meta.shareDecimals);
  }
  if (Math.abs(sum - 100 * scale) > brackets.length * 0.5) return null;
  return { meta, brackets };
}

/**
 * 순자산이 속한 구간 순번. 비교값은 화면 표시와 같은 원 단위 정수(Math.round) — 외화 환산 소수로
 * 홈 헤더 표기와 다른 구간에 들어가는 것을 막는다. 음수 전용 분기 없음(null 경계가 열린 끝).
 */
export function findBracketIndex(netAsset: number, stats: ValidNetworthStats): number | null {
  if (!Number.isFinite(netAsset)) return null;
  const v = Math.round(netAsset);
  const lower = stats.meta.boundary === "lower-inclusive";
  const idx = stats.brackets.findIndex((b) => {
    const aboveMin = b.min === null || (lower ? v >= b.min : v > b.min);
    const belowMax = b.max === null || (lower ? v < b.max : v <= b.max);
    return aboveMin && belowMax;
  });
  return idx >= 0 ? idx : null;
}

export interface BenchmarkCounts {
  n: number;            // 100곳 중 이 구간 가구 수(누적 반올림의 차)
  m: number;            // 100곳 중 이보다 높은 구간 가구 수
  isTop: boolean;       // 통계 표의 마지막(위로 열린) 구간
  nText: string;        // '약 N곳' 또는 '약 1곳 미만'
  mText: string | null; // 최상위면 null(뒷절 생략)
}

const UNDER_ONE = "약 1곳 미만";

/**
 * 문장 수치 — 구간 아래 누적 L·구간 포함 누적 U를 공표값으로 합산한 뒤 각각 정수 반올림, N = U − L, M = 100 − U.
 * 최상위는 구간 순번으로 판정하고 U를 100으로 고정한다(원문 합이 100이 아니어도 N + M ≤ 100). '약 0곳'은 쓰지 않는다.
 */
export function computeCounts(index: number, stats: ValidNetworthStats): BenchmarkCounts {
  const d = stats.meta.shareDecimals;
  const scale = 10 ** d;
  const isTop = stats.brackets[index].max === null;
  let below = 0;
  for (let i = 0; i < index; i++) below += shareUnits(stats.brackets[i].sharePct, d);
  const through = below + shareUnits(stats.brackets[index].sharePct, d);
  const l = Math.min(100, Math.round(below / scale));
  const u = isTop ? 100 : Math.min(100, Math.round(through / scale));
  const n = Math.max(0, u - l);
  const m = 100 - u;
  return {
    n, m, isTop,
    nText: n === 0 || stats.brackets[index].sharePct < 0.5 ? UNDER_ONE : `약 ${n}곳`,
    mText: isTop ? null : m === 0 ? UNDER_ONE : `약 ${m}곳`,
  };
}

/** 결론 문장(한 줄 문자열) — 화면은 같은 조각을 줄바꿈 묶음으로 나눠 그린다 */
export function benchmarkSentence(c: BenchmarkCounts): string {
  return c.mText === null
    ? `가구 100곳 중 ${c.nText}이 이 구간이에요.`
    : `가구 100곳 중 ${c.nText}이 이 구간, ${c.mText}이 이보다 높은 구간이에요.`;
}

// 경계 금액 표기 — 공표값(만원 단위) 그대로 '억 만' 표기. 반올림·버림 없음(1억 296만, 11억 20만). 0은 '0원'
const boundaryText = (won: number): string => {
  if (won === 0) return "0원";
  const man = Math.floor(won / 10_000);
  const eok = Math.floor(man / 10_000);
  const rest = man % 10_000;
  return [eok > 0 ? `${eok.toLocaleString("ko-KR")}억` : "", rest > 0 ? `${rest.toLocaleString("ko-KR")}만` : ""].filter(Boolean).join(" ");
};

/** 구간 라벨 — 원문 표기(label)가 있으면 그대로, 없으면 경계 금액에서 파생 */
export function bracketLabel(b: HouseholdNetworthBracket, boundary: HouseholdNetworthMeta["boundary"]): string {
  if (b.label) return b.label;
  const lower = boundary === "lower-inclusive";
  if (b.min === null && b.max !== null) return `${boundaryText(b.max)} ${lower ? "미만" : "이하"}`;
  if (b.max === null && b.min !== null) return `${boundaryText(b.min)} ${lower ? "이상" : "초과"}`;
  return `${boundaryText(b.min ?? 0)}~${boundaryText(b.max ?? 0)}`;
}

export interface BenchmarkRow {
  label: string;
  mine: boolean;
}

export interface NetworthBenchmarkView {
  rows: BenchmarkRow[];
  columnLabel: string;              // 열 머리 — 구간 비중이 모두 같으면 '(가구 10%씩)'을 붙인다
  mineIndex: number | null;
  hidden: boolean;                  // 부동산 0건 — 내 구간을 표시하지 않고 안내만
  counts: BenchmarkCounts | null;   // 내 구간이 있을 때만
  sentence: string | null;
  labelParts: [string, string, string]; // 가구 기준 · 등록한 자산 기준 · {연도}년 조사
  sourceParts: string[]; // 자료: {기관} / 「{조사명}」 / {연도}년[({기준일} 기준)] / ({통계표})
}

/**
 * 블록에 필요한 값 전부. 상수 검증 실패(빈 상수 포함)면 null.
 * 부동산 0건 판정이 음수 판정보다 먼저다 — 부동산이 없으면 순자산 부호와 무관하게 내 구간을 표시하지 않는다.
 */
export function buildNetworthBenchmark(input: { netAsset: number; realEstateCount: number; stats: HouseholdNetworthStats }): NetworthBenchmarkView | null {
  const stats = validateStats(input.stats);
  if (!stats) return null;
  const { meta, brackets } = stats;
  const hidden = !(input.realEstateCount > 0);
  const mineIndex = hidden ? null : findBracketIndex(input.netAsset, stats);
  const counts = mineIndex === null ? null : computeCounts(mineIndex, stats);
  const equal = brackets.every((b) => b.sharePct === brackets[0].sharePct);
  return {
    rows: brackets.map((b, i) => ({
      label: bracketLabel(b, meta.boundary),
      mine: i === mineIndex,
    })),
    columnLabel: equal ? `순자산 구간(가구 ${brackets[0].sharePct}%씩)` : "순자산 구간",
    mineIndex,
    hidden,
    counts,
    sentence: counts ? benchmarkSentence(counts) : null,
    labelParts: ["가구 기준", "· 등록한 자산 기준", `· ${meta.surveyYear}년 조사`],
    sourceParts: [`자료: ${meta.agencies.join("·")}`, `「${meta.surveyName}」`, `${meta.surveyYear}년${meta.referenceDate ? `(${meta.referenceDate} 기준)` : ""}`, ...(meta.tableSource.id ? [`(${meta.tableSource.id})`] : [])],
  };
}
