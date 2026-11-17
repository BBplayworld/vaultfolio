// 5.124 #237 올해 결산 — 실사용 형태 픽스처 기대값·예측 구간 분리·3묶음·결론 규칙·날짜 경계·첫 해 시작점·금지어.
import { describe, expect, it, vi } from "vitest";
import { buildLiveAttributionCurr } from "../asset-report";
import { resolveYearChain, type SettlementCauses } from "../settlement";
import {
  YEAR_SETTLE_COPY, buildYearConclusion, groupYearSettlement, hasYearRows, pickYearEndSnapshot, resolveFirstYearChain, resolveYearTarget,
  splitYearChain, yearConclusionText, yearGrowthSingleHint, yearHeadText, yearIncomeHint, yearPeriodDateText, yearPeriodLabel, yearPeriodNoteText,
  yearPeriodPhrase, yearSettlementTitle,
} from "../year-settlement";
import { computeChainCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { buildYearSettlementModel } from "@/app/(main)/_components/views/activity/year-settlement-block";
import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { msOf } from "./first-record-fixture";
import {
  FIXTURE_TODAY, M, R0, R1, TX_DEC, decEnd, dep, fixtureMonthly, legacy, mkSnap, now, sDec, sNov, sOct, state, summaryOf,
} from "./year-settlement-fixture";

const model = (o: { data?: AssetData; monthly?: MonthlyAssetSnapshot[]; daily?: DailyAssetSnapshot[]; today?: string; rates?: typeof R0 } = {}) => {
  const data = o.data ?? now;
  const rates = o.rates ?? R1;
  const today = o.today ?? FIXTURE_TODAY;
  // 실시간 끝점(buildLiveAttributionCurr)이 오늘 날짜를 시계에서 읽는다 — 화면과 같게 시계를 고정
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${today}T03:00:00Z`));
  try {
    return buildYearSettlementModel({
      assetData: data, monthly: o.monthly ?? fixtureMonthly, daily: o.daily ?? [], rates, exchangeHistory: {}, summary: summaryOf(data, rates), today,
    });
  } finally {
    vi.useRealTimers();
  }
};
const rowsOf = (m: SettlementCauses) => Object.fromEntries(m.causes.map((c) => [c.key, c.amount]));
const mainCauses = (data: AssetData, monthly: MonthlyAssetSnapshot[], delta: number) => {
  const points = resolveYearChain(monthly, 2025, 100 * M, FIXTURE_TODAY)!;
  const live = { ...buildLiveAttributionCurr(data, R1, summaryOf(data, R1)), date: FIXTURE_TODAY, _date: FIXTURE_TODAY, _display: FIXTURE_TODAY };
  return computeChainCauses({ points, live: live as never, deltaNet: delta, endDate: FIXTURE_TODAY, liveCash: 34.9 * M, exchangeHistory: {}, assetData: data, rates: R1 });
};
// 보이는 행 합(묶음 + 기록 안 된 변화 + 기간 행)
const visibleSum = (m: NonNullable<ReturnType<typeof model>>) =>
  (m.groups?.income ?? 0) + (m.groups?.growth?.amount ?? 0) + (m.groups?.loan ?? 0) + (m.groups?.unrecorded?.amount ?? 0) + (m.period?.amount ?? 0);

describe("실사용 형태 픽스처 — 2026-12-15 (예측 섞임)", () => {
  const m = model()!;
  it("스냅샷 값이 spec 표와 같다", () => {
    expect([sOct.netAsset, sNov.netAsset]).toEqual([112 * M, 115 * M]);
  });
  it("main 현행 — 예측 구간 몫이 기록 안 된 변화에 섞이고 대출 행이 없다(대조용)", () => {
    expect(rowsOf(mainCauses(now, fixtureMonthly, 18 * M).mapped)).toEqual({ price: 3 * M, fx: 300_000, income: 3 * M, unrecorded: 11_700_000 });
  });
  it("분리 후 — 기간 행 +12,000,000(10/31 기록까지), 나머지는 11월 이후 몫만", () => {
    expect(m.state).toBe("mixed");
    expect(m.period).toEqual({ amount: 12 * M, month: 10, from: "2025-12-31", until: "2026-10-31" });
    expect(m.groups!.income).toBe(3 * M);
    expect(m.groups!.growth!.amount).toBe(3_300_000);
    expect(Object.fromEntries(m.groups!.growth!.rows.map((c) => [c.key, c.amount]))).toEqual({ price: 3 * M, fx: 300_000 });
    expect(m.groups!.loan).toBe(-200_000);
    expect(m.groups!.unrecorded!.amount).toBe(-100_000);
  });
  it("AC-3 보이는 행 합 = Hero 증감(원 단위), Hero와 같은 금액의 행은 없다", () => {
    expect(m.total).toBe(18 * M);
    expect(visibleSum(m)).toBe(18 * M);
    for (const v of [m.groups!.income, m.groups!.growth!.amount, m.groups!.loan, m.groups!.unrecorded!.amount, m.period!.amount]) expect(v).not.toBe(m.total);
  });
  it("결론 48% / 52%, 기간 `11월부터`, 제목·라벨·날짜", () => {
    expect(m.conclusion).toEqual({ n: 48, m: 52 });
    expect(m.phrase).toBe("11월부터");
    const t = yearConclusionText(m.phrase, m.conclusion!);
    expect(`${t.head} ${t.income} ${t.growth}`).toBe("11월부터 순자산을 늘린 금액은 넣은 돈 48%, 불어난 돈 52%예요");
    expect(m.title).toBe("올해 결산");
    expect(m.periodLabel).toBe("1~10월");
    expect(m.periodSub).toBe("월 기록 전 기간 · 10/31 기록까지");
    expect(m.periodNote).toBeNull(); // 결론 줄이 있으면 기간 캡션 없음
    expect(m.head).toBeNull();
    expect(m.incomeHint).toBe("11월부터 입금에서 출금을 뺀 금액이에요");
  });
  it("그 구간에 반영된 입출금이 없으면 도움말 1줄 없음", () => {
    expect(m.periodCashNote).toBe(false);
  });
});

describe("N월 기록 전에 적은 입출금(10절 a) — 2026-03 입금 1건", () => {
  const withMar = { ...now, cashTransactions: [dep("d0", "2026-03-10", 5 * M), ...TX_DEC] };
  const main = rowsOf(mainCauses(withMar, fixtureMonthly, 18 * M).mapped);
  const m = model({ data: withMar })!;
  it("main은 순유입 행에 3월 입금이 들어가고, 변경 후에는 넣은 돈에 들어가지 않고 기간 행 금액에 들어 있다(합은 같음)", () => {
    expect(main.income).toBe(8 * M);
    expect(m.groups!.income).toBe(3 * M);
    expect(m.period!.amount).toBe(12 * M);
    expect(Object.values(main).reduce((s, v) => s + v, 0)).toBe(18 * M);
    expect(visibleSum(m)).toBe(18 * M);
  });
  it("기간 행 도움말에 입출금 1줄 조건이 켜진다", () => {
    expect(m.periodCashNote).toBe(true);
  });
});

describe("같은 픽스처 — 2027-01-05 (1월 초, 끝점 = 12월 기록)", () => {
  const monthly = [sOct, sNov, sDec, mkSnap(decEnd, R1, "2027-01", "2027-01-05")];
  const m = model({ data: decEnd, monthly, today: "2027-01-05" })!;
  it("제목 `2026년 결산`, 머리 줄 `2025년 말 → 2026년 말 +19,000,000`", () => {
    expect(m.state).toBe("closed");
    expect(m.title).toBe("2026년 결산");
    expect(m.head).toEqual({ text: "2025년 말 → 2026년 말", delta: 19 * M });
  });
  it("기간 행 +12,000,000, 나머지 합 +7,000,000, 합 = 머리 줄 증감", () => {
    expect(m.period!.amount).toBe(12 * M);
    expect(visibleSum(m) - m.period!.amount).toBe(7 * M);
    expect([m.groups!.income, m.groups!.growth!.amount, m.groups!.loan, m.groups!.unrecorded!.amount]).toEqual([3 * M, 4_300_000, -200_000, -100_000]);
    expect(visibleSum(m)).toBe(m.head!.delta);
  });
  it("기간 표현에 해가 들어가고 현금 링크는 없다", () => {
    expect(m.phrase).toBe("2026년 11월부터");
    expect(m.showCashLink).toBe(false);
  });
  it("Hero가 문구 상태(2027 항목 없음)여도, 2027 항목이 있어도 같은 블록", () => {
    const with2027 = { ...decEnd, yearlyNetAssets: [...decEnd.yearlyNetAssets, { year: 2027, netAsset: 120 * M, note: "자동" }] };
    const b = model({ data: with2027, monthly, today: "2027-01-05" })!;
    expect([b.title, b.total, b.period!.amount]).toEqual([m.title, m.total, m.period!.amount]);
  });
  it("년도별 2026 항목을 손으로 고치면 차이는 기록 안 된 변화로 들어가고 합 = 머리 줄", () => {
    const edited = { ...decEnd, yearlyNetAssets: [{ year: 2025, netAsset: 100 * M, note: "" }, { year: 2026, netAsset: 121 * M, note: "" }] };
    const b = model({ data: edited, monthly, today: "2027-01-05" })!;
    expect(b.head!.delta).toBe(21 * M);
    expect(b.groups!.unrecorded!.amount).toBe(1_700_000); // 잔차가 양수가 되어 대출 행(−200,000)은 여기에 흡수된다(현행 규칙)
    expect(b.groups!.loan).toBeNull();
    expect(visibleSum(b)).toBe(21 * M);
  });
  it("그 해 enrich 월 기록이 없으면 전부 예측(머리 줄 + 안내만)", () => {
    const b = model({ data: decEnd, monthly: legacy, today: "2027-01-05" })!;
    expect(b.state).toBe("estimated-only");
    expect(hasYearRows(b.groups, b.period)).toBe(false);
    expect(b.head!.delta).toBe(19 * M);
  });
});

describe("날짜 경계 — resolveYearTarget", () => {
  const y = [{ year: 2025, netAsset: 1, note: "" }, { year: 2026, netAsset: 2, note: "자동" }];
  const y27 = [...y, { year: 2027, netAsset: 3, note: "자동" }];
  it.each(["2026-12-27", "2026-12-28", "2026-12-31"])("%s → 2026 열린 결산", (d) => {
    expect(resolveYearTarget(y, d)).toMatchObject({ year: 2026, closed: false, start: { year: 2025 } });
  });
  it.each(["2027-01-01", "2027-01-10"])("%s → 2026 닫힌 결산(2027 항목 유무 무관)", (d) => {
    expect(resolveYearTarget(y, d)).toMatchObject({ year: 2026, closed: true, start: { year: 2025 } });
    expect(resolveYearTarget(y27, d)).toMatchObject({ year: 2026, closed: true });
  });
  it("2027-01-11 → 현행(2027 항목 있으면 2027, 없으면 블록 없음)", () => {
    expect(resolveYearTarget(y27, "2027-01-11")).toMatchObject({ year: 2027, closed: false, start: { year: 2026 } });
    expect(resolveYearTarget(y, "2027-01-11")).toBeNull();
  });
  it("1월 초라도 직전 해 항목이 없으면 닫힌 결산이 아니다", () => {
    expect(resolveYearTarget([{ year: 2025, netAsset: 1, note: "" }], "2027-01-05")).toBeNull();
    expect(resolveYearTarget([{ year: 2027, netAsset: 1, note: "" }], "2027-01-05")).toMatchObject({ year: 2027, closed: false, start: null });
  });
  it("올해 값 없음(마지막 항목이 지난해, 결산 창 밖) → null", () => {
    expect(resolveYearTarget([{ year: 2025, netAsset: 1, note: "" }], "2026-12-15")).toBeNull();
    expect(resolveYearTarget([], "2026-12-15")).toBeNull();
  });
  it("닫힌 결산 끝점 = 그 해 마지막 enrich 월 기록", () => {
    expect(pickYearEndSnapshot([...legacy, sOct, sNov, sDec], 2026)).toBe(sDec);
    expect(pickYearEndSnapshot(legacy, 2026)).toBeNull();
  });
});

describe("상태별 — 실측만·전부 예측·해 건너뜀·N=1·현금 미등록·대출 없음", () => {
  it("실측만: 전년 12월 enrich 기록이 앵커면 기간 행 없이 `올해`", () => {
    const dec25 = mkSnap(state({ krwPrice: 50000, cash: 30 * M, loan: 10 * M, tx: [], y2026: 0 }), R0, "2025-12", "2025-12-30");
    const m = model({ monthly: [dec25, ...fixtureMonthly] })!;
    expect(m.state).toBe("measured");
    expect(m.period).toBeNull();
    expect(m.phrase).toBe("올해");
    expect(m.periodNote).toBeNull();
    expect(visibleSum(m)).toBe(m.total);
    expect(m.total).toBe(18 * M);
  });
  it("전부 예측: 올해 enrich 월 기록이 이번 달뿐이면 행 없음", () => {
    const m = model({ monthly: [...legacy, fixtureMonthly.at(-1)!] })!;
    expect(m.state).toBe("estimated-only");
    expect(m.groups).toBeNull();
    expect(m.period).toBeNull();
    expect(m.conclusion).toBeNull();
    expect(m.showCashLink).toBe(false);
    expect(hasYearRows(m.groups, m.period)).toBe(false);
  });
  it("전년 12월 레거시 기록이 년도별 값과 달라도 항등식 유지(기간 행은 Hero 시작값 기준)", () => {
    const legacyDec: MonthlyAssetSnapshot = { month: "2025-12", netAsset: 97 * M, financialAsset: 97 * M };
    const m = model({ monthly: [legacyDec, ...fixtureMonthly] })!;
    expect(m.period!.amount).toBe(12 * M);
    expect(visibleSum(m)).toBe(18 * M);
  });
  it("해 건너뜀(2024 다음 2026): 라벨 `10월 기록 전`, `1~N월` 없음, 결론 기간은 그대로", () => {
    const skip = { ...now, yearlyNetAssets: [{ year: 2024, netAsset: 100 * M, note: "" }, { year: 2026, netAsset: 118 * M, note: "자동" }] };
    const m = model({ data: skip })!;
    expect(m.periodLabel).toBe("10월 기록 전");
    expect(m.periodSub).toBe("10/31 기록까지");
    expect(m.phrase).toBe("11월부터");
    expect(visibleSum(m)).toBe(18 * M);
  });
  it("N=1이면 라벨 `1월`(`1~1월` 금지)", () => {
    const p = { amount: 1, month: 1, from: "2025-12-31", until: "2026-01-28" };
    expect(yearPeriodLabel(p, false)).toBe("1월");
    expect(yearPeriodLabel({ ...p, month: 2 }, false)).toBe("1~2월");
    expect(yearPeriodDateText(p)).toBe("1/28 기록까지");
    expect(yearPeriodNoteText(p)).toBe("2월부터 나눈 금액이에요");
  });
  it("현금 미등록: 넣은 돈 도움말이 둘째 문구, 현금 링크 없음", () => {
    const mk = (krwPrice: number, y: number) => state({ krwPrice, cash: 0, loan: 0, tx: [], y2026: y, noCashAccount: true, noLoan: true });
    const o = mk(60000, 0), n = mk(61000, 0), cur = mk(63000, 213 * M);
    cur.yearlyNetAssets = [{ year: 2025, netAsset: 200 * M, note: "" }, { year: 2026, netAsset: 214_500_000, note: "자동" }];
    const m = model({ data: cur, monthly: [mkSnap(o, R0, "2026-10", "2026-10-31"), mkSnap(n, R0, "2026-11", "2026-11-30")] })!;
    expect(m.incomeHint).toBe("입출금 기록이 없어 11월부터 사고판 금액의 차이로 계산했어요");
    expect(m.showCashLink).toBe(false);
    expect(m.groups!.loan).toBeNull();
    expect(visibleSum(m)).toBe(m.total);
  });
  it("대출 없음: 빠져나간 돈 묶음이 null", () => {
    const g = groupYearSettlement({ causes: [{ key: "price", amount: 5, estimated: false }, { key: "income", amount: 100, estimated: false }], deltaNet: 105, showUnrecordedHint: false });
    expect(g.loan).toBeNull();
  });
});

describe("3묶음 매핑 — groupYearSettlement", () => {
  const mapped = (causes: [string, number][]): SettlementCauses =>
    ({ causes: causes.map(([key, amount]) => ({ key, amount, estimated: false })) as SettlementCauses["causes"], deltaNet: causes.reduce((s, c) => s + c[1], 0), showUnrecordedHint: false });
  it("불어난 돈 = 시세 변동 + 평가 갱신 + 환율 효과, 하위 행 합 = 묶음 금액", () => {
    const g = groupYearSettlement(mapped([["price", 300], ["valuation", -50], ["fx", 20], ["income", 1000], ["loan", -30], ["unrecorded", 7_000]]));
    expect(g.growth!.amount).toBe(270);
    expect(g.growth!.rows.map((r) => r.key)).toEqual(["price", "valuation", "fx"]);
    expect(g.growth!.rows.reduce((s, r) => s + r.amount, 0)).toBe(g.growth!.amount);
    expect([g.income, g.loan, g.unrecorded!.amount]).toEqual([1000, -30, 7000]);
  });
  it("하위 행이 1개면 rows 1개(펼침 없음), 하위 합이 10원 미만이면 묶음 숨김", () => {
    expect(groupYearSettlement(mapped([["fx", 500]])).growth!.rows).toHaveLength(1);
    expect(groupYearSettlement(mapped([["price", 500], ["fx", -495]])).growth).toBeNull();
    expect(groupYearSettlement(mapped([["income", 500]])).growth).toBeNull();
  });
});

describe("결론 규칙(11절 ②) — 비율 문장만", () => {
  const g = (income: number | null, growth: number | null, unrecorded = 0) => ({
    income, loan: null,
    growth: growth === null ? null : { amount: growth, rows: [{ key: "price" as const, amount: growth, estimated: false }] },
    unrecorded: unrecorded ? { key: "unrecorded" as const, amount: unrecorded, estimated: false } : null,
  });
  it("둘 다 양수 + 1~99% → 비율", () => {
    expect(buildYearConclusion(g(3 * M, 3_300_000, -100_000))).toEqual({ n: 48, m: 52 });
  });
  it("부호 섞임·한쪽만·둘 다 없음 → null", () => {
    expect(buildYearConclusion(g(3 * M, -1 * M))).toBeNull();
    expect(buildYearConclusion(g(-3 * M, 1 * M))).toBeNull();
    expect(buildYearConclusion(g(null, 1 * M))).toBeNull();
    expect(buildYearConclusion(g(1 * M, null))).toBeNull();
    expect(buildYearConclusion(null)).toBeNull();
  });
  it("반올림 0% 또는 100% → null(금액 문장 갈래는 없다)", () => {
    expect(buildYearConclusion(g(1_000, 1_000 * M))).toBeNull();
    expect(buildYearConclusion(g(1_000 * M, 1_000))).toBeNull();
    expect(buildYearConclusion(g(1 * M, 99 * M))).toEqual({ n: 1, m: 99 });
  });
  it("규칙 3: |기록 안 된 변화| ≥ 넣은 돈 + 불어난 돈 → null", () => {
    expect(buildYearConclusion(g(1 * M, 1 * M, 2 * M))).toBeNull();
    expect(buildYearConclusion(g(1 * M, 1 * M, -2 * M))).toBeNull();
    expect(buildYearConclusion(g(1 * M, 1 * M, 1_999_999))).toEqual({ n: 50, m: 50 });
  });
  it("결론 줄이 없고 예측 섞임이면 기간 캡션 1줄", () => {
    const big = { ...now, yearlyNetAssets: [{ year: 2025, netAsset: 100 * M, note: "" }, { year: 2026, netAsset: 140 * M, note: "" }] };
    const m = model({ data: big })!;
    expect(m.conclusion).toBeNull();
    expect(m.periodNote).toBe("11월부터 나눈 금액이에요");
  });
});

describe("기간 표현·제목", () => {
  const p = { amount: 1, month: 10, from: "2025-12-31", until: "2026-10-31" };
  it("올해·11월부터·11/3부터·2026년에·2026년 11월부터", () => {
    expect(yearPeriodPhrase({ year: 2026, closed: false, period: null, firstStart: null })).toBe("올해");
    expect(yearPeriodPhrase({ year: 2026, closed: false, period: p, firstStart: null })).toBe("11월부터");
    expect(yearPeriodPhrase({ year: 2026, closed: false, period: null, firstStart: "2026-11-03" })).toBe("11/3부터");
    expect(yearPeriodPhrase({ year: 2026, closed: true, period: null, firstStart: null })).toBe("2026년에");
    expect(yearPeriodPhrase({ year: 2026, closed: true, period: p, firstStart: null })).toBe("2026년 11월부터");
  });
  it("제목: 올해 결산 / M/D 이후 결산 / 2026년 결산", () => {
    expect(yearSettlementTitle({ year: 2026, closed: false, firstStart: null })).toBe("올해 결산");
    expect(yearSettlementTitle({ year: 2026, closed: false, firstStart: "2026-11-03" })).toBe("11/3 이후 결산");
    expect(yearSettlementTitle({ year: 2026, closed: true, firstStart: null })).toBe("2026년 결산");
  });
  it("체인이 끝 달을 빼므로 `13월부터`는 나오지 않는다", () => {
    const pts = resolveYearChain([sOct, sNov, sDec], 2025, 100 * M, "2026-12-31")!;
    expect(Math.max(...pts.slice(1).map((s) => Number(s.month.slice(5))))).toBeLessThanOrEqual(11);
  });
});

describe("예측 구간 분리 — splitYearChain", () => {
  const run = (pts: MonthlyAssetSnapshot[], delta: number) => ({ n: pts.length, delta });
  const anchor: MonthlyAssetSnapshot = { month: "2025-12", date: "2025-12-31", netAsset: 100, financialAsset: 100 };
  it("앵커가 enrich면 분리 없음", () => {
    expect(splitYearChain([sOct, sNov], 0, 10.4, run)).toEqual({ kind: "measured", total: 10, period: null, measured: { n: 2, delta: 10 } });
  });
  it("앵커가 enrich가 아니고 점 1개면 전부 예측", () => {
    expect(splitYearChain([anchor], 100, 50, run)).toEqual({ kind: "estimated-only", total: 50, period: null, measured: null });
  });
  it("앵커가 enrich가 아니고 점 2개 이상이면 첫 구간을 기간 행으로 떼고 나머지를 다시 돈다(합 = 전체)", () => {
    const r = splitYearChain([anchor, sOct, sNov], 100 * M, 18 * M, run);
    expect(r).toMatchObject({ kind: "mixed", total: 18 * M, period: { amount: 12 * M, month: 10, until: "2026-10-31" }, measured: { n: 2, delta: 6 * M } });
  });
});

describe("첫 해 시작점 — resolveFirstYearChain", () => {
  const idData = (): AssetData => ({ ...now, stocks: now.stocks.map((s, i) => ({ ...s, id: `stock_${msOf("2026-11-02")}_${i}` })), cash: now.cash.map((c) => ({ ...c, id: `cash_${msOf("2026-11-02")}` })), loans: now.loans.map((l) => ({ ...l, id: `loan_${msOf("2026-11-02")}` })) });
  const dailyOf = (s: MonthlyAssetSnapshot, date: string): DailyAssetSnapshot => ({ date, netAsset: s.netAsset, financialAsset: s.financialAsset, breakdown: s.breakdown, fx: s.fx, fxBase: s.fxBase, cost: s.cost }) as DailyAssetSnapshot;
  it("① 올해 가장 이른 enrich 월 기록(끝 달 제외)부터, 그 뒤 enrich 월이 이어진다", () => {
    const c = resolveFirstYearChain([...legacy, sOct, sNov, sDec], [], now, 2026, FIXTURE_TODAY)!;
    expect(c.map((s) => s.month)).toEqual(["2026-10", "2026-11"]);
  });
  it("② 월 기록이 없으면 4.94 일별 시작점", () => {
    const c = resolveFirstYearChain([sDec], [dailyOf(sNov, "2026-11-03"), dailyOf(sNov, "2026-11-20")], idData(), 2026, FIXTURE_TODAY)!;
    expect(c).toHaveLength(1);
    expect(c[0].date).toBe("2026-11-03");
  });
  it("③ 시작점에서 끝까지 7일 미만이거나 시작점이 없으면 null", () => {
    expect(resolveFirstYearChain([sDec], [dailyOf(sNov, "2026-12-10")], idData(), 2026, FIXTURE_TODAY)).toBeNull();
    expect(resolveFirstYearChain([sDec], [], idData(), 2026, FIXTURE_TODAY)).toBeNull();
    expect(resolveFirstYearChain([], null, now, 2026, FIXTURE_TODAY)).toBeNull();
  });
  it("모델: 첫 해는 시작점 기록이 Hero 시작값이고 제목·기간이 같은 시작일(AC-8), 합 = 증감", () => {
    const firstYear = { ...now, yearlyNetAssets: [{ year: 2026, netAsset: 118 * M, note: "자동" }] };
    const m = model({ data: firstYear })!;
    expect(m.state).toBe("first-year");
    expect(m.firstStart).toBe("2026-10-31");
    expect(m.heroStart).toBe(112 * M);
    expect(m.title).toBe("10/31 이후 결산");
    expect(m.phrase).toBe("10/31부터");
    expect(m.period).toBeNull();
    expect(m.total).toBe(6 * M);
    expect(visibleSum(m)).toBe(6 * M);
    expect(m.periodNote).toBeNull();
  });
  it("모델: 첫 해 시작점이 없으면 블록 없음", () => {
    const firstYear = { ...now, yearlyNetAssets: [{ year: 2026, netAsset: 118 * M, note: "자동" }] };
    expect(model({ data: firstYear, monthly: [fixtureMonthly.at(-1)!] })).toBeNull();
  });
  it("1월 초 + 첫 해(10절 d): 월 기록 시작점만 쓰고, 없으면 블록 없음", () => {
    const d = { ...decEnd, yearlyNetAssets: [{ year: 2026, netAsset: 119 * M, note: "자동" }] };
    const m = model({ data: d, monthly: [sOct, sNov, sDec], today: "2027-01-05" })!;
    expect([m.title, m.head!.text, m.head!.delta]).toEqual(["10/31 이후 결산", "10/31 → 2026년 말", 7 * M]);
    expect(visibleSum(m)).toBe(7 * M);
    expect(model({ data: d, monthly: [sDec], daily: [dailyOf(sNov, "2026-11-03")], today: "2027-01-05" })).toBeNull();
  });
});

describe("문구 — 금지어·표현(AC-5·AC-6)", () => {
  const p = { amount: 1, month: 10, from: "2025-12-31", until: "2026-10-31" };
  const c = yearConclusionText("11월부터", { n: 48, m: 52 });
  const all = [
    ...Object.values(YEAR_SETTLE_COPY), c.head, c.income, c.growth, yearPeriodNoteText(p), yearIncomeHint("올해", true), yearIncomeHint("올해", false),
    yearGrowthSingleHint({ key: "price", amount: 1, estimated: false }), yearGrowthSingleHint({ key: "valuation", amount: 1, estimated: false }), yearGrowthSingleHint({ key: "fx", amount: 1, estimated: false }),
    yearPeriodLabel(p, false), yearPeriodLabel(p, true), yearPeriodDateText(p),
    yearSettlementTitle({ year: 2026, closed: false, firstStart: null }), yearHeadText({ year: 2026, closed: true, start: { year: 2025, netAsset: 1, note: "" }, end: { year: 2026, netAsset: 2, note: "" } }, null),
  ].join("\n");
  it("평가어·권유·전망 낱말이 없다", () => {
    // `나누지 못해요`·`불러오지 못했어요`는 할 수 없음을 알리는 서술(cto 확정 문안·현행 오류 문구)이라 평가어 `못` 검사에서만 뺀다
    const text = all.replace("나누지 못해요", "").replace("불러오지 못했어요", "");
    for (const w of ["잘", "못", "부족", "아쉽", "좋", "더 넣", "줄이", "해 보세요", "추천", "전망", "예상", "수익률"]) expect(text, w).not.toContain(w);
  });
  it("`기록이 없던`·`0원`·`올해 입출금을 기록하면`·빠져나간 돈을 넣은 결론 문장이 없다", () => {
    for (const w of ["기록이 없던", "0원", "올해 입출금을 기록하면"]) expect(all).not.toContain(w);
    expect(`${c.head} ${c.income} ${c.growth}`).not.toContain("빠져나간 돈");
    expect(`${c.head} ${c.income} ${c.growth}`).not.toMatch(/\d원/);
  });
});
