// 자산 성적표 등급 모델 — 5축 별점(0~5, 0.5 단위) + 트로피 티어
// 투자 조언 아님 — 사용자 자산의 구조·습관을 자산관리 통념 기준으로 채점한 참고 지표.
// 각 축 산식의 컷은 코드 주석에 근거를 남긴다. 데이터가 없는 축은 null(측정불가)로 두고
// 종합 점수는 측정 가능한 축만 가중 재정규화한다 (신규 사용자도 등급 산출).

import type { AssetSummary, YearlyNetAsset, MonthlyAssetSnapshot, SnapshotGrade, SnapshotGradeTier } from "@/types/asset";
import type { AssetReport } from "./asset-report";

export type AxisKey = "growth" | "earningQuality" | "leverage" | "diversification" | "habit";

export interface AxisScore {
  key: AxisKey;
  label: string;
  score: number | null;   // null = 측정불가(회색 별)
  pending?: boolean;      // 배당·KIS 비동기 대기 중 → 잠정 점수 (별 스켈레톤/잠정 표기)
  reason: string;         // 왜 이 점수인가 1줄
  action: string;         // 무엇을 하면 오르는가 1줄
}

// 스냅샷 이력(SnapshotGrade)과 단일 소스 — 구조 동일, 기존 export 이름 유지
export type GradeTier = SnapshotGradeTier;

export interface AssetGrade {
  overall: number;        // 0.5 단위
  tier: GradeTier;
  axes: AxisScore[];
  measuredCount: number;  // 측정된 축 수 (pending 포함)
}

export interface AssetGradeInputs {
  summary: AssetSummary;
  report: AssetReport;
  yearlyNetAssets: YearlyNetAsset[];
  monthlySnapshots: MonthlyAssetSnapshot[];
  /** X-Ray theme 축 최대 버킷 비중 (0~1). 주식 없거나 미분류 전량이면 null */
  topShare: number | null;
  /** 환노출 합계 / 총자산 (%) */
  fxRatioSum: number;
  /** 올해 연간 배당(실적+예상) — 연중 실지급분만 쓰면 배당수익률이 N/12로 과소평가된다 */
  dividend: { annual: number; ready: boolean };
  /** 이자 커버리지 = 주식 최근 1년 수익 + 올해 연간 배당 − 연간 이자 */
  coverage: { value: number; ready: boolean };
  /** 이번 달 기록률 (0~1). null/미지정 = 측정 전(레거시 배점 유지) */
  recordRate?: number | null;
  /** 저축 규칙성 — 최근 windowMonths개월 중 현금 입금이 관측된 개월 수. null = 현금 거래 없음(순자산 상승 방식 폴백) */
  savingsRhythm?: { depositMonths: number; windowMonths: number } | null;
}

const AXIS_WEIGHTS: Record<AxisKey, number> = {
  growth: 0.3,          // 사용자 핵심 관점 "순자산이 긴 호흡으로 늘고 있는가"
  earningQuality: 0.2,
  leverage: 0.2,
  diversification: 0.2,
  habit: 0.1,           // 타 축과 부분 중복(투자비중↔분산)이라 최소 가중
};

// ── 채점 임계값(컷) — 튜닝·유지보수를 위해 한곳에 모음. 근거는 각 score 함수 주석 참조. ──
const GRADE_THRESHOLDS = {
  growth: { cagrExcellent: 15, cagrGood: 10, cagrReal: 5, streakYears: 3, streakBonus: 0.5 },
  earning: { rateHigh: 20, rateMid: 10, divYield: 1.5 },
  leverage: { debtRatioHigh: 60, debtRatioElevated: 40, avgRateHigh: 6, noDebtScore: 5 },
  diversification: {
    classShareHigh: 80, classShareElevated: 60,
    themeShareHigh: 0.6, themeShareElevated: 0.35,
    fxRatioHigh: 70, fxRatioElevated: 50,
  },
  habit: {
    investRatioHigh: 70, investRatioMid: 50, investRatioLow: 30,
    steadyStrong: 2 / 3, steadyWeak: 0.5,
    recordHigh: 0.8, recordMid: 0.5, recordScale: 0.8,
  },
  tier: { platinum: 4.5, gold: 3.5, silver: 2.5 },
} as const;

const clamp5 = (v: number) => Math.min(5, Math.max(0, v));
const toHalf = (v: number) => Math.round(v * 2) / 2;

// ── ① 장기 순자산 성장 ────────────────────────────────────────────────
// CAGR 컷 근거: 한국 명목성장+물가 ≈ 4~5% → 5% 이상이어야 실질 증식(3점 기준).
function scoreGrowth(yearly: YearlyNetAsset[]): AxisScore {
  const label = "장기 순자산 성장";
  const sorted = [...yearly].sort((a, b) => a.year - b.year);
  // 최초 양수 연도부터 측정 (음수·0 시작은 CAGR 정의 불가)
  const firstPositiveIdx = sorted.findIndex((y) => y.netAsset > 0);
  const points = firstPositiveIdx >= 0 ? sorted.slice(firstPositiveIdx) : [];

  if (points.length < 2) {
    return {
      key: "growth", label, score: null,
      reason: "연도별 순자산 기록이 2개 이상 쌓여야 측정됩니다.",
      action: "연말마다 순자산이 자동 기록됩니다. 1년 뒤부터 측정돼요.",
    };
  }

  const first = points[0];
  const last = points[points.length - 1];
  const years = last.year - first.year;
  if (years <= 0 || last.netAsset <= 0) {
    return {
      key: "growth", label, score: 1,
      reason: "순자산이 마이너스이거나 기간 정보를 계산할 수 없습니다.",
      action: "부채를 줄여 순자산을 플러스로 만드는 것이 최우선입니다.",
    };
  }
  const cagr = (Math.pow(last.netAsset / first.netAsset, 1 / years) - 1) * 100;
  const G = GRADE_THRESHOLDS.growth;

  let score: number;
  if (cagr >= G.cagrExcellent) score = 5;
  else if (cagr >= G.cagrGood) score = 4;
  else if (cagr >= G.cagrReal) score = 3;
  else if (cagr >= 0) score = 2;
  else score = 1;

  // 연속 증가 3년 이상 보너스 — 꾸준함은 장기 복리의 전제
  let streak = 1;
  for (let i = points.length - 1; i > 0; i--) {
    if (points[i].netAsset > points[i - 1].netAsset) streak++;
    else break;
  }
  if (streak >= G.streakYears) score = clamp5(score + G.streakBonus);

  const cagrStr = `${cagr >= 0 ? "+" : ""}${cagr.toFixed(1)}%`;
  return {
    key: "growth", label, score: toHalf(score),
    reason: cagr >= G.cagrReal
      ? `연평균 ${cagrStr} 성장 — 물가·명목성장(약 5%)을 넘는 실질 증식입니다.${streak >= G.streakYears ? ` ${streak}년 연속 증가.` : ""}`
      : cagr >= 0
        ? `연평균 ${cagrStr} 성장 — 늘고는 있지만 물가 수준(약 5%)에 못 미칩니다.`
        : `연평균 ${cagrStr} — 순자산이 줄고 있습니다.`,
    action: cagr >= G.cagrExcellent
      ? "지금 흐름을 유지하세요. 급격한 전략 변경이 오히려 리스크입니다."
      : "매년 순자산 증가율 5% 이상을 목표로 저축·투자 원금을 늘려보세요.",
  };
}

// ── ② 수익의 질 ──────────────────────────────────────────────────────
// 자산가는 시세차익 단일 의존이 아닌 복수 수익 원천(시세·환차·배당)을 확보한다.
function scoreEarningQuality(
  report: AssetReport,
  summary: AssetSummary,
  dividend: { annual: number; ready: boolean },
): AxisScore {
  const label = "수익의 질";
  const rate = report.totalProfitRate;
  const E = GRADE_THRESHOLDS.earning;

  // base: 수익률 자체
  let base: number;
  if (rate >= E.rateHigh) base = 2.5;
  else if (rate >= E.rateMid) base = 2;
  else if (rate >= 0) base = 1.5;
  else base = Math.max(0.5, 1.5 + rate / 20); // 음수는 체감 (−20%에 0.5)

  // 수익 원천 다변화: 활성 원천당 +0.5 (최대 +1.5)
  const sources: string[] = [];
  if (report.priceGain > 0) sources.push("시세차익");
  if (report.currencyGain !== 0) sources.push("환차익");
  if (dividend.annual > 0) sources.push("배당");
  let score = base + Math.min(1.5, sources.length * 0.5);

  // 현금흐름 가점: 배당수익률 ≥1.5% → +1 (코스피 평균 배당수익률 수준 상회)
  const divYield = summary.totalValue > 0 ? (dividend.annual / summary.totalValue) * 100 : 0;
  if (divYield >= E.divYield) score += 1;
  else if (divYield > 0) score += 0.5;

  const sourceStr = sources.length > 0 ? sources.join("·") : "없음";
  return {
    key: "earningQuality", label,
    score: toHalf(clamp5(score)),
    pending: !dividend.ready,
    reason: sources.length >= 2
      ? `수익 원천이 ${sourceStr}으로 분산돼 있습니다 (수익률 ${rate >= 0 ? "+" : ""}${rate.toFixed(1)}%).`
      : sources.length === 1
        ? `수익이 ${sourceStr} 하나에 의존하고 있습니다 (수익률 ${rate >= 0 ? "+" : ""}${rate.toFixed(1)}%).`
        : `아직 플러스 수익 원천이 없습니다 (수익률 ${rate >= 0 ? "+" : ""}${rate.toFixed(1)}%).`,
    action: dividend.annual > 0
      ? "배당 등 현금흐름 원천을 더 키우면 시세 하락기에도 수익이 방어됩니다."
      : "배당주·해외자산 등으로 시세차익 외 수익 원천을 하나 더 만들어보세요.",
  };
}

// ── ③ 레버리지 건전성 ─────────────────────────────────────────────────
// 부채비율 40% 이하 건전(가계부채 통념), 금리 6% 초과는 주식 장기 기대수익(~7%)을 잠식.
function scoreLeverage(
  report: AssetReport,
  summary: AssetSummary,
  coverage: { value: number; ready: boolean },
): AxisScore {
  const label = "레버리지 건전성";

  if (report.equity <= 0 && summary.loanBalance > 0) {
    return {
      key: "leverage", label, score: 0.5,
      reason: "부채가 투입 원금을 초과한 자본잠식 상태입니다.",
      action: "고금리 대출부터 상환해 자기자본을 플러스로 회복하세요.",
    };
  }

  const L = GRADE_THRESHOLDS.leverage;

  if (summary.loanBalance <= 0) {
    // 무부채 = 건전성 만점(5.0): 이 축은 레버리지 "활용도"가 아니라 "건전성(리스크)"을 재므로
    // 부채 0 = 리스크 0 = 만점이 직관과 일치. 레버리지 활용은 별개 관점이라 액션으로 안내.
    return {
      key: "leverage", label, score: L.noDebtScore,
      reason: "부채가 없어 이자 부담 리스크가 0입니다 — 건전성 만점입니다.",
      action: "감당 가능한 저금리 레버리지는 자산 증식 속도를 높일 수 있습니다.",
    };
  }

  let score = 5;
  const notes: string[] = [];

  if (report.debtRatio > L.debtRatioHigh) { score -= 3; notes.push(`부채비율 ${report.debtRatio.toFixed(0)}%로 과도`); }
  else if (report.debtRatio > L.debtRatioElevated) { score -= 1.5; notes.push(`부채비율 ${report.debtRatio.toFixed(0)}%로 다소 높음`); }
  else notes.push(`부채비율 ${report.debtRatio.toFixed(0)}%로 건전`);

  // 가중평균 금리 = 연이자 / 잔액
  const avgRate = summary.loanBalance > 0 ? (report.annualInterest / summary.loanBalance) * 100 : 0;
  if (avgRate > L.avgRateHigh) { score -= 1; notes.push(`평균 금리 ${avgRate.toFixed(1)}%로 높음`); }

  // 이자 커버리지: 주식 1년 수익+배당이 연이자를 감당하는가
  let pending = false;
  if (coverage.ready) {
    if (coverage.value >= 0) { score += 0.5; notes.push("투자 수익이 이자를 상쇄"); }
    else { score -= 1; notes.push("투자 수익으로 이자를 못 채움"); }
  } else {
    pending = true;
  }

  return {
    key: "leverage", label,
    score: toHalf(clamp5(score)),
    pending,
    reason: `${notes.join(", ")}.`,
    action: report.debtRatio > L.debtRatioElevated || avgRate > L.avgRateHigh
      ? "부채비율 40% 이하, 금리 6% 이하로 재조정하면 점수가 오릅니다."
      : "현재 수준을 유지하면서 이자보다 높은 수익률을 지키는 게 핵심입니다.",
  };
}

// ── ④ 분산·비중 적절성 ────────────────────────────────────────────────
// 감점제. X-Ray 집중도 컷(0.6/0.35 — classifyConcentration과 동일) 재사용.
function scoreDiversification(
  report: AssetReport,
  summary: AssetSummary,
  topShare: number | null,
  fxRatioSum: number,
): AxisScore {
  const label = "분산·비중";
  const D = GRADE_THRESHOLDS.diversification;
  let score = 5;
  const notes: string[] = [];

  // 단일 자산군 쏠림
  const classes = report.perClass.filter((c) => c.value > 0);
  if (summary.totalValue > 0 && classes.length > 0) {
    const top = classes.reduce((m, c) => (c.value > m.value ? c : m), classes[0]);
    const topRatio = (top.value / summary.totalValue) * 100;
    if (topRatio >= D.classShareHigh) { score -= 1.5; notes.push(`${top.label} ${topRatio.toFixed(0)}% 쏠림`); }
    else if (topRatio >= D.classShareElevated) { score -= 0.75; notes.push(`${top.label} ${topRatio.toFixed(0)}%로 다소 집중`); }
  }

  // 주식 테마 집중 (X-Ray topShare)
  if (topShare !== null) {
    if (topShare >= D.themeShareHigh) { score -= 1.5; notes.push(`주식이 단일 분야 ${(topShare * 100).toFixed(0)}% 집중`); }
    else if (topShare >= D.themeShareElevated) { score -= 0.75; notes.push(`주식 분야 집중도 ${(topShare * 100).toFixed(0)}%`); }
  }

  // 환노출 편중
  if (fxRatioSum >= D.fxRatioHigh) { score -= 1; notes.push(`외화 비중 ${fxRatioSum.toFixed(0)}%로 환리스크 큼`); }
  else if (fxRatioSum >= D.fxRatioElevated) { score -= 0.5; notes.push(`외화 비중 ${fxRatioSum.toFixed(0)}%`); }

  // 자산 1종뿐이면 바닥점 보정
  if (classes.length <= 1 && summary.cashValue <= 0) score = Math.max(0.5, Math.min(score, 2));

  return {
    key: "diversification", label,
    score: toHalf(clamp5(score)),
    reason: notes.length > 0 ? `${notes.join(", ")}.` : "자산군·분야·통화가 고루 분산돼 있습니다.",
    action: notes.length > 0
      ? "가장 큰 쏠림부터 줄이세요. 단일 자산·분야 60% 이상은 위기 시 방어가 어렵습니다."
      : "리밸런싱 주기(예: 연 1회)를 정해 현재의 분산을 유지하세요.",
  };
}

// ── ⑤ 투자 습관 ──────────────────────────────────────────────────────
// recordRate(이번 달 기록률) 측정 가능 시: 비중 2.0 + 꾸준함 2.0 + 기록률 1.0 배점.
// 미측정(null)이면 기존 배점(2.5+2.5) 유지 — 하위호환.
function scoreHabit(
  summary: AssetSummary,
  monthly: MonthlyAssetSnapshot[],
  recordRate?: number | null,
  savingsRhythm?: { depositMonths: number; windowMonths: number } | null,
): AxisScore {
  const label = "투자 습관";
  if (summary.totalValue <= 0) {
    return {
      key: "habit", label, score: null,
      reason: "자산이 등록되면 측정됩니다.",
      action: "자산을 등록해보세요.",
    };
  }

  const H = GRADE_THRESHOLDS.habit;
  const hasRecordRate = recordRate !== null && recordRate !== undefined;
  const scale = hasRecordRate ? H.recordScale : 1; // 2.5 만점 → 2.0 만점으로 축소해 기록률 1.0 자리 확보

  // 투자자산 비중 = 현금 외 자산 / 총자산 — 돈이 일하게 하는가
  const investRatio = ((summary.totalValue - summary.cashValue) / summary.totalValue) * 100;
  let ratioScore: number;
  if (investRatio >= H.investRatioHigh) ratioScore = 2.5;
  else if (investRatio >= H.investRatioMid) ratioScore = 2;
  else if (investRatio >= H.investRatioLow) ratioScore = 1.5;
  else if (investRatio > 0) ratioScore = 1;
  else ratioScore = 0.5;
  // 현금 0원 = 비상금 부재 감점
  const noCash = summary.cashValue <= 0 && summary.totalValue > 0;
  if (noCash) ratioScore -= 0.5;
  ratioScore *= scale;

  // 꾸준함: 저축 규칙성(현금 입금 관측 개월) 우선, 없으면 순자산 상승 개월로 폴백.
  // 저축은 직접 관측이 시세상승과 뒤섞이지 않아 더 정확 → 둘 다 있으면 높은 쪽을 택한다.
  const sorted = [...monthly].sort((a, b) => a.month.localeCompare(b.month)).slice(-7); // 비교쌍 6개
  const hasSavings = !!savingsRhythm && savingsRhythm.windowMonths >= 3;
  const savingsRatio = hasSavings ? savingsRhythm!.depositMonths / savingsRhythm!.windowMonths : null;
  let score: number;
  let steadyNote: string;
  if (sorted.length >= 3 || hasSavings) {
    let upRatio = 0;
    let pairs = 0;
    if (sorted.length >= 3) {
      let ups = 0;
      for (let i = 1; i < sorted.length; i++) if (sorted[i].netAsset > sorted[i - 1].netAsset) ups++;
      pairs = sorted.length - 1;
      upRatio = ups / pairs;
    }
    // 저축 규칙성과 순자산 상승 중 높은 비율을 '꾸준함' 근거로
    const bestRatio = Math.max(upRatio, savingsRatio ?? 0);
    const steady = (bestRatio >= H.steadyStrong ? 2.5 : bestRatio >= H.steadyWeak ? 1.5 : 0.5) * scale;
    score = ratioScore + steady;
    steadyNote = hasSavings
      ? `② 꾸준히 모으는가: 최근 ${savingsRhythm!.windowMonths}개월 중 ${savingsRhythm!.depositMonths}개월 입금`
      : `② 꾸준히 모으는가: 최근 ${pairs}개월 중 ${Math.round(upRatio * pairs)}개월 순자산 증가`;
  } else {
    // 월별 기록·저축 모두 부족 시 비중 점수만으로 스케일
    score = ratioScore * 2;
    steadyNote = "② 꾸준히 모으는가: 월별 기록 3개월 또는 현금 입금 기록부터 반영";
  }

  // 기록 습관: 이번 달 기록률 ≥80% → +1 / ≥50% → +0.5 (접속할수록 오르는 축)
  let recordNote = "";
  if (hasRecordRate) {
    const pct = Math.round(recordRate * 100);
    score += recordRate >= H.recordHigh ? 1 : recordRate >= H.recordMid ? 0.5 : 0;
    recordNote = ` — ③ 기록 습관: 이번 달 기록률 ${pct}%`;
  }

  // 측정 항목을 사용자에게 그대로 노출: ①돈이 일하는 비율 ②꾸준히 모으는가 ③기록 습관
  return {
    key: "habit", label,
    score: toHalf(clamp5(score)),
    reason: `① 돈이 일하는 비율(현금 뺀 투자자산 ÷ 총자산): ${investRatio.toFixed(0)}%${noCash ? " · 비상 현금 0원" : ""} — ${steadyNote}${recordNote}.`,
    action: investRatio < 50
      ? "노는 현금의 일부를 투자자산으로 옮겨 돈이 일하게 하세요 (비상금은 남기고)."
      : noCash
        ? "생활비 3~6개월치 비상 현금은 남겨두는 것이 안전합니다."
        : "매달 일정액을 자동으로 투자하는 습관이 복리를 만듭니다.",
  };
}

// ── 종합 ─────────────────────────────────────────────────────────────
const TIER_LABELS: Record<GradeTier, string> = {
  bronze: "브론즈", silver: "실버", gold: "골드", platinum: "플래티넘",
};
export function tierLabel(tier: GradeTier): string {
  return TIER_LABELS[tier];
}

export function computeAssetGrade(inputs: AssetGradeInputs): AssetGrade {
  const axes: AxisScore[] = [
    scoreGrowth(inputs.yearlyNetAssets),
    scoreEarningQuality(inputs.report, inputs.summary, inputs.dividend),
    scoreLeverage(inputs.report, inputs.summary, inputs.coverage),
    scoreDiversification(inputs.report, inputs.summary, inputs.topShare, inputs.fxRatioSum),
    scoreHabit(inputs.summary, inputs.monthlySnapshots, inputs.recordRate, inputs.savingsRhythm),
  ];

  // 측정 가능한 축만 가중 재정규화
  const measured = axes.filter((a) => a.score !== null);
  const weightSum = measured.reduce((s, a) => s + AXIS_WEIGHTS[a.key], 0);
  const overall = weightSum > 0
    ? toHalf(measured.reduce((s, a) => s + a.score! * AXIS_WEIGHTS[a.key], 0) / weightSum)
    : 0;

  const T = GRADE_THRESHOLDS.tier;
  const tier: GradeTier = overall >= T.platinum ? "platinum" : overall >= T.gold ? "gold" : overall >= T.silver ? "silver" : "bronze";

  return { overall, tier, axes, measuredCount: measured.length };
}

// ── 성적표 변화 비교 (스냅샷 이력 vs 현재) ───────────────────────────
const TIER_ORDER: Record<GradeTier, number> = { bronze: 0, silver: 1, gold: 2, platinum: 3 };

export interface GradeDelta {
  overallDiff: number;                       // 현재 − 이전 (0.5 단위)
  tierChange: "up" | "down" | null;
  axisDiffs: Partial<Record<AxisKey, number>>; // 변화 있는 축만 (양쪽 측정된 축 한정)
  baseDate: string;                          // 비교 기준일 (YYYY-MM-DD 또는 YYYY-MM)
}

export function diffGrade(prev: SnapshotGrade, curr: AssetGrade, baseDate: string): GradeDelta {
  const axisDiffs: Partial<Record<AxisKey, number>> = {};
  for (const axis of curr.axes) {
    const prevScore = prev.axes[axis.key];
    if (axis.score === null || prevScore === null || prevScore === undefined) continue;
    const d = axis.score - prevScore;
    if (d !== 0) axisDiffs[axis.key] = d;
  }
  const tierGap = TIER_ORDER[curr.tier] - TIER_ORDER[prev.tier];
  return {
    overallDiff: curr.overall - prev.overall,
    tierChange: tierGap > 0 ? "up" : tierGap < 0 ? "down" : null,
    axisDiffs,
    baseDate,
  };
}

// AssetGrade → 스냅샷 기록용 SnapshotGrade 변환
export function toSnapshotGrade(grade: AssetGrade): SnapshotGrade {
  return {
    overall: grade.overall,
    tier: grade.tier,
    axes: Object.fromEntries(grade.axes.map((a) => [a.key, a.score])),
  };
}
