import { describe, it, expect } from "vitest";
import {
  pruneMonthlySnapshots, shiftMonth, resolveSettlementWindow, pickSettlementMonth, pickSettlementCard,
  isSettlementCardPeriod, listSettlementMonths, settlementTitle, settlementCardTitle, settlementRangeLabel,
  settlementGaResult, mapSettlementCauses, buildWeekRows, buildSettlementIcs,
} from "../settlement";
import { computeAttributionBetween, type AttributionCauseKey } from "../asset-report";
import type { AssetData, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";

const m = (month: string, date?: string, netAsset = 100): MonthlyAssetSnapshot => ({
  month, netAsset, financialAsset: netAsset, ...(date ? { date } : {}),
});

describe("pruneMonthlySnapshots — 13개월 롤링 보존", () => {
  it("[2025-10, 2025-11, 2025-12] + 현재월 2026-01 → 4건 모두 유지(연 경계, 완료 기준 8)", () => {
    const all = [m("2025-10"), m("2025-11"), m("2025-12"), m("2026-01")];
    expect(pruneMonthlySnapshots(all, "2026-01").map((s) => s.month)).toEqual(["2025-10", "2025-11", "2025-12", "2026-01"]);
  });

  it("2026-01 경계: 2025-01까지 유지, 2024-12는 삭제", () => {
    const all = [m("2024-12"), m("2025-01"), m("2025-06"), m("2026-01")];
    expect(pruneMonthlySnapshots(all, "2026-01").map((s) => s.month)).toEqual(["2025-01", "2025-06", "2026-01"]);
  });

  it("2027-01 경계: 2026-01~2026-12 + 2027-01 = 13건, 그 앞 달은 삭제", () => {
    const months = ["2025-12", ...Array.from({ length: 12 }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`), "2027-01"];
    const out = pruneMonthlySnapshots(months.map((x) => m(x)), "2027-01");
    expect(out).toHaveLength(13);
    expect(out[0].month).toBe("2026-01");
    expect(out.map((s) => s.month)).not.toContain("2025-12");
  });

  it("14번째로 오래된 달은 삭제되고 현재월은 항상 남는다", () => {
    const months = Array.from({ length: 14 }, (_, i) => shiftMonth("2026-10", i - 13));
    const out = pruneMonthlySnapshots(months.map((x) => m(x)), "2026-10");
    expect(out).toHaveLength(13);
    expect(out.map((s) => s.month)).not.toContain(months[0]);
    expect(out.map((s) => s.month)).toContain("2026-10");
  });

  it("결과 건수는 입력보다 늘지 않고, 올해분만 있는 구버전 데이터는 그대로 유지된다", () => {
    const legacy = [m("2026-01"), m("2026-02"), m("2026-03")];
    const out = pruneMonthlySnapshots(legacy, "2026-03");
    expect(out).toEqual(legacy);
    expect(out.length).toBeLessThanOrEqual(legacy.length);
  });

  it("빈 입력·레거시(date 없음)·형식 깨진 항목", () => {
    expect(pruneMonthlySnapshots([], "2026-01")).toEqual([]);
    const broken = [m("2025-12"), { netAsset: 1 } as unknown as MonthlyAssetSnapshot];
    expect(pruneMonthlySnapshots(broken, "2026-01").map((s) => s.month)).toEqual(["2025-12"]);
  });

  it("shiftMonth 연 경계", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2027-01", -12)).toBe("2026-01");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });
});

describe("resolveSettlementWindow — 결산 기준일(§5-2)", () => {
  it("예시 ① 매일 접속, 12/5: 11월 결산 · 10/31 → 11/30, 12월은 11/30 → 오늘 진행 중", () => {
    const monthly = [m("2025-10", "2025-10-31"), m("2025-11", "2025-11-30"), m("2025-12", "2025-12-05")];
    const today = "2025-12-05";
    expect(pickSettlementMonth(monthly, today)).toBe("2025-11");
    const w = resolveSettlementWindow(monthly, "2025-11", today);
    expect(w.kind).toBe("settled");
    expect(settlementTitle(w)).toBe("11월 결산");
    expect(settlementRangeLabel(w)).toBe("10/31 → 11/30");
    expect(settlementCardTitle(w)).toBe("11월 결산이 준비됐어요");
    const dec = resolveSettlementWindow(monthly, "2025-12", today);
    expect(dec.kind).toBe("in_progress");
    expect(dec.end).toBeNull();
    expect(settlementRangeLabel(dec)).toBe("11/30 → 12/5");
    expect(settlementCardTitle(dec)).toBe("12월 변화 · 진행 중");
    expect(settlementGaResult(dec)).toBe("in_progress");
  });

  it("예시 ② 월 1회 접속(10/5, 11/5, 12/5): 카드는 11/5 → 12/5 변화(settled), 11월 선택 시 10/5 → 11/5", () => {
    const monthly = [m("2025-10", "2025-10-05"), m("2025-11", "2025-11-05"), m("2025-12", "2025-12-05")];
    const today = "2025-12-05";
    expect(pickSettlementMonth(monthly, today)).toBe("2025-12");
    const card = pickSettlementCard(monthly, today)!;
    expect(card.kind).toBe("range");
    expect(card.gapDays).toBe(30);
    expect(settlementCardTitle(card)).toBe("11/5 → 12/5 변화");
    expect(settlementTitle(card)).toBe("11/5 → 12/5 변화");
    expect(settlementGaResult(card)).toBe("settled");
    const nov = resolveSettlementWindow(monthly, "2025-11", today);
    expect(settlementRangeLabel(nov)).toBe("10/5 → 11/5");
  });

  it("예시 ③ 첫 달(스냅샷 1개): 카드 없음, 월 탭은 first_month", () => {
    const monthly = [m("2025-12", "2025-12-05")];
    expect(pickSettlementCard(monthly, "2025-12-29")).toBeNull();
    const w = resolveSettlementWindow(monthly, "2025-12", "2025-12-29");
    expect(w.kind).toBe("first_month");
    expect(settlementGaResult(w)).toBe("first_month");
  });

  it("1월 경계: 1/3에 12월 결산의 시작은 전년 11월", () => {
    const monthly = [m("2025-11", "2025-11-29"), m("2025-12", "2025-12-30"), m("2026-01", "2026-01-03")];
    expect(pickSettlementMonth(monthly, "2026-01-03")).toBe("2025-12");
    const w = resolveSettlementWindow(monthly, "2025-12", "2026-01-03");
    expect(w.start?.month).toBe("2025-11");
    expect(settlementRangeLabel(w)).toBe("11/29 → 12/30");
  });

  it("35일 초과 간격이면 longGap, 달이 건너뛰어도 직전 기록을 시작점으로", () => {
    const monthly = [m("2025-08", "2025-08-20"), m("2025-10", "2025-10-30")];
    const w = resolveSettlementWindow(monthly, "2025-10", "2025-11-02");
    expect(w.start?.month).toBe("2025-08");
    expect(w.gapDays).toBe(71);
    expect(w.longGap).toBe(true);
  });

  it("레거시 시작점은 날짜 대신 YYYY-MM 기록", () => {
    const monthly = [m("2025-07"), m("2025-08", "2025-08-28")];
    const w = resolveSettlementWindow(monthly, "2025-08", "2025-10-28");
    expect(w.startLegacy).toBe(true);
    expect(settlementRangeLabel(w)).toBe("2025-07 기록 → 8/28");
  });

  it("노출 창: 말일−3일 ~ 다음 달 10일", () => {
    expect(isSettlementCardPeriod("2026-10-27")).toBe(false);
    expect(isSettlementCardPeriod("2026-10-28")).toBe(true);
    expect(isSettlementCardPeriod("2026-10-31")).toBe(true);
    expect(isSettlementCardPeriod("2026-11-10")).toBe(true);
    expect(isSettlementCardPeriod("2026-11-11")).toBe(false);
    expect(isSettlementCardPeriod("2026-02-25")).toBe(true); // 2월 말일 28 − 3
    expect(isSettlementCardPeriod("2026-02-24")).toBe(false);
    const monthly = [m("2026-09", "2026-09-28"), m("2026-10", "2026-10-15")];
    expect(pickSettlementCard(monthly, "2026-10-20")).toBeNull();
  });

  it("전월 스냅샷 date가 21일 이후일 때만 전월 결산", () => {
    const monthly = [m("2025-10", "2025-10-20"), m("2025-11", "2025-11-21")];
    expect(pickSettlementMonth(monthly, "2025-12-10")).toBe("2025-11");
    const monthly2 = [m("2025-10", "2025-10-20"), m("2025-11", "2025-11-20")];
    expect(pickSettlementMonth(monthly2, "2025-12-10")).toBe("2025-12");
  });

  it("월 선택기: 최근 13개월, 저장된 달과 이번 달만 활성, 연 경계 정렬", () => {
    const items = listSettlementMonths([m("2025-11"), m("2025-12")], "2026-01-05");
    expect(items).toHaveLength(13);
    expect(items[0].month).toBe("2025-01");
    expect(items[12]).toEqual({ month: "2026-01", enabled: true });
    expect(items.filter((i) => i.enabled).map((i) => i.month)).toEqual(["2025-11", "2025-12", "2026-01"]);
  });
});

describe("mapSettlementCauses — 엔진 키 15종 → 결산 5항목(§5-3)", () => {
  const eff = (pairs: [AttributionCauseKey, number, boolean?][]) =>
    pairs.map(([key, amount, estimated]) => ({ key, amount, estimated }));
  const byKey = (r: ReturnType<typeof mapSettlementCauses>) => Object.fromEntries(r.causes.map((c) => [c.key, c.amount]));

  it("키 15종 각각의 귀속(현금 등록 사용자)", () => {
    const effects = eff([
      ["price", 1000], ["price:stock", 2000], ["price:crypto", 3000], ["price:realEstate", 4000], ["fx", 500],
      ["income", 7000],
      ["buy:stock", 100], ["sell:stock", -200], ["buy:crypto", 300], ["sell:crypto", -400],
      ["buy:realEstate", 500], ["sell:realEstate", -600], ["debt", 700], ["deposit", -800], ["cash", 1000],
    ]);
    const deltaNet = effects.reduce((s, e) => s + e.amount, 0);
    const r = mapSettlementCauses(effects, { deltaNet, cashTracked: true });
    expect(byKey(r)).toEqual({ price: 6000, valuation: 4000, fx: 500, income: 7000, unrecorded: 600 });
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(deltaNet);
  });

  it("현금 등록: 주식 매수와 현금 감소는 상쇄되어 표시되지 않는다", () => {
    const r = mapSettlementCauses(eff([["buy:stock", 5_000_000], ["cash", -5_000_000], ["price:stock", 300_000]]), { deltaNet: 300_000, cashTracked: true });
    expect(byKey(r)).toEqual({ price: 300_000 });
    expect(r.showUnrecordedHint).toBe(false);
  });

  it("현금 미등록: 주식 매수는 순유입으로 귀속", () => {
    const r = mapSettlementCauses(eff([["buy:stock", 5_000_000], ["price:stock", 300_000]]), { deltaNet: 5_300_000, cashTracked: false });
    expect(byKey(r)).toEqual({ price: 300_000, income: 5_000_000 });
  });

  it("현금 미등록이어도 대출 상환(debt)은 예외에 들어가지 않는다", () => {
    const r = mapSettlementCauses(eff([["debt", 2_000_000], ["price:stock", 100_000]]), { deltaNet: 2_100_000, cashTracked: false });
    expect(byKey(r)).toEqual({ price: 100_000, unrecorded: 2_000_000 });
    expect(r.showUnrecordedHint).toBe(true);
  });

  it("보증금 변동만 있는 달은 안내가 뜨지 않는다(내부 이동)", () => {
    const r = mapSettlementCauses(eff([["deposit", -10_000_000], ["cash", 10_000_000]]), { deltaNet: 0, cashTracked: true });
    expect(r.causes).toEqual([]);
    expect(r.showUnrecordedHint).toBe(false);
  });

  it("항등식: 표시 합계 = Δ순자산, 0원 항목 숨김, 예측 플래그 전파", () => {
    const effects = eff([["price", 123_456.7, true], ["fx", 0, true], ["income", 50_000], ["cash", 10_000.4]]);
    const deltaNet = 183_457.1;
    const r = mapSettlementCauses(effects, { deltaNet, cashTracked: true });
    expect(r.causes.map((c) => c.key)).toEqual(["price", "income", "unrecorded"]);
    expect(r.causes.reduce((s, c) => s + c.amount, 0)).toBe(Math.round(deltaNet));
    expect(r.causes.find((c) => c.key === "price")!.estimated).toBe(true);
    expect(r.causes.find((c) => c.key === "income")!.estimated).toBe(false);
  });
});

describe("computeAttributionBetween — 월 스냅샷 두 시점(R29 경계)", () => {
  const RATES = { USD: 1400, JPY: 900 };
  const data = (): AssetData => ({
    realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
    yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
    lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
  });
  const enriched = (month: string, date: string, cash: number, re: number, reCost: number): MonthlyAssetSnapshot => ({
    month, date, netAsset: cash + re, financialAsset: cash,
    breakdown: { realEstate: re, stocks: 0, crypto: 0, cash, loans: 0, tenantDeposit: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + reCost, stock: 0, crypto: 0, realEstate: reCost },
  });

  it("시작일 당일 입금은 포함, 구간 밖 입금은 제외 — key별 금액 단정", () => {
    const d = data();
    d.cashTransactions = [
      { id: "a", cashId: "c", date: "2025-10-05", type: "deposit", amount: 1_000_000, currency: "KRW", reflected: true },
      { id: "b", cashId: "c", date: "2025-10-04", type: "deposit", amount: 9_000_000, currency: "KRW", reflected: true },
      { id: "c", cashId: "c", date: "2025-11-06", type: "deposit", amount: 9_000_000, currency: "KRW", reflected: true },
    ] as AssetData["cashTransactions"];
    const prev = enriched("2025-10", "2025-10-05", 10_000_000, 500_000_000, 400_000_000);
    const curr = enriched("2025-11", "2025-11-05", 11_000_000, 520_000_000, 400_000_000);
    const attr = computeAttributionBetween(prev, curr, {}, d, RATES)!;
    const k = new Map(attr.effects.map((e) => [e.key, e.amount]));
    expect(attr.deltaNet).toBe(21_000_000);
    expect(k.get("income")).toBeCloseTo(1_000_000, 6);
    expect(k.get("price:realEstate")).toBeCloseTo(20_000_000, 6);
    expect(k.get("cash") ?? 0).toBeCloseTo(0, 6);
    expect(attr.estimated).toBe(false);
    const r = mapSettlementCauses(attr.effects, { deltaNet: attr.deltaNet, cashTracked: true });
    expect(r.causes.map((c) => [c.key, c.amount])).toEqual([["valuation", 20_000_000], ["income", 1_000_000]]);
  });

  it("레거시 시작점이면 구간 전체가 예측, 끝점이 레거시면 null", () => {
    const legacy = m("2025-09", undefined, 400_000_000);
    const curr = enriched("2025-10", "2025-10-05", 10_000_000, 500_000_000, 400_000_000);
    const attr = computeAttributionBetween(legacy, curr, {}, data(), RATES)!;
    expect(attr.estimated).toBe(true);
    expect(attr.effects.reduce((s, e) => s + e.amount, 0)).toBeCloseTo(attr.deltaNet, 6);
    expect(computeAttributionBetween(curr, legacy, {}, data(), RATES)).toBeNull();
  });
});

describe("buildWeekRows — 전체·주 목록", () => {
  const d = (date: string, netAsset: number): DailyAssetSnapshot => ({ date, netAsset, financialAsset: netAsset });
  it("최근 7일(오늘 포함) 행을 최신순으로, 7일 전 기준점 대비 증감", () => {
    const daily = [d("2026-10-20", 100), d("2026-10-22", 110), d("2026-10-26", 130), d("2026-10-28", 125)];
    const { rows, weekDiff } = buildWeekRows(daily, "2026-10-28");
    expect(rows.map((r) => r.date)).toEqual(["2026-10-28", "2026-10-26", "2026-10-22"]);
    expect(rows[0].diff).toBe(-5);
    expect(weekDiff).toBe(25); // 10/20(구간 밖 직전) → 10/28
  });
  it("기록 없음·1건", () => {
    expect(buildWeekRows([], "2026-10-28")).toEqual({ rows: [], weekDiff: null });
    expect(buildWeekRows([d("2026-10-28", 1)], "2026-10-28").weekDiff).toBeNull();
  });
});

describe("buildSettlementIcs — RFC 5545", () => {
  const ics = buildSettlementIcs(new Date("2026-10-28T03:00:00Z"));
  it("필수 속성·RRULE·CRLF", () => {
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    for (const p of ["VERSION:2.0", "PRODID:", "BEGIN:VEVENT", "END:VEVENT", "UID:", "DTSTAMP:20261028T030000Z", "DTSTART:20261031T120000Z", "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1", "SUMMARY:시크릿에셋 월말 결산"]) {
      expect(ics).toContain(p);
    }
    expect(ics.replace(/\r\n/g, "")).not.toMatch(/\n|\r/); // 모든 줄바꿈이 CRLF
    const VEVENTS = ics.match(/BEGIN:VEVENT/g) ?? [];
    expect(VEVENTS).toHaveLength(1);
  });
  it("금액·숫자 금액이 없고 줄 길이 75옥텟 이하", () => {
    expect(ics).not.toMatch(/원|₩|\d,\d{3}/);
    for (const line of ics.split("\r\n")) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
  });
});
