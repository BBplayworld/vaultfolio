// 4.94 #183 처음 맞는 결산(A) — 시작점 선택·구간·이름·GA·원인 비중. 픽스처 F1·F2·F3(first-record-fixture.ts).
import { describe, expect, it } from "vitest";
import {
  assetIdRegisteredDate, pickFirstRecordStart, pickSettlementCard, pickSettlementMonth, resolveSettlementWindow,
  settlementGaResult, settlementRangeLabel, settlementWindowName, UNRECORDED_HINT_RATIO,
} from "../settlement";
import type { AssetData } from "@/types/asset";
import { addDays, assetDataOn, causesOf, dailyOn, dailyRange, monthlyOf, msOf } from "./first-record-fixture";

const view = (monthly: ReturnType<typeof monthlyOf>[], today: string, fr: ReturnType<typeof pickFirstRecordStart>) =>
  resolveSettlementWindow(monthly, pickSettlementMonth(monthly, today), today, fr);
const hub = (monthly: ReturnType<typeof monthlyOf>[], today: string, fr: ReturnType<typeof pickFirstRecordStart>) =>
  pickSettlementCard(monthly, today, fr) ?? resolveSettlementWindow(monthly, today.slice(0, 7), today, fr);

describe("assetIdRegisteredDate — id 형식 7종 + 경계", () => {
  const today = "2026-11-27";
  const D = "2026-11-06";
  it("1. 입력 폼 id `stock_<ms>` → 등록일(KST)", () => expect(assetIdRegisteredDate(`stock_${msOf(D)}`, today)).toBe(D));
  it("2. 가져오기 `*_import_<ms>_<n>` → 첫 13자리만, 뒤 _idx 무시", () => expect(assetIdRegisteredDate(`stock_import_${msOf(D)}_3`, today)).toBe(D));
  it("3. `crypto_<ms>_<i>` → 등록일", () => expect(assetIdRegisteredDate(`crypto_${msOf(D)}_2`, today)).toBe(D));
  it("4. 데모 `demo_*` → 없음", () => expect(assetIdRegisteredDate("demo_st_samsung", today)).toBeNull());
  it("5. `preview-*` → 없음", () => expect(assetIdRegisteredDate("preview-nvda", today)).toBeNull());
  it("6. 범위 밖 ms(2024-01-01 이전·오늘+1일 이후) → 없음", () => {
    expect(assetIdRegisteredDate("stock_1500000000000", today)).toBeNull();
    expect(assetIdRegisteredDate(`stock_${msOf(addDays(today, 2))}`, today)).toBeNull();
    expect(assetIdRegisteredDate(`stock_${msOf(addDays(today, 1))}`, today)).toBe(addDays(today, 1));
  });
  it("7. 숫자만 있는 id: 13자리는 ms로, 12·14자리·짧은 숫자는 없음", () => {
    expect(assetIdRegisteredDate(String(msOf(D)), today)).toBe(D);
    expect(assetIdRegisteredDate("stock_173000000000", today)).toBeNull();
    expect(assetIdRegisteredDate("stock_17300000000000", today)).toBeNull();
    expect(assetIdRegisteredDate("12345", today)).toBeNull();
    expect(assetIdRegisteredDate(undefined, today)).toBeNull();
  });
  it("KST 날짜 경계: UTC 15시 이후는 다음 날", () => {
    expect(assetIdRegisteredDate(`x_${Date.parse("2026-11-06T15:30:00Z")}`, today)).toBe("2026-11-07");
  });
});

describe("F1 — 11/3 2건 + 11/6 3건 등록 후 시세만 변동", () => {
  const daily = dailyRange("2026-11-03", "2026-11-27");
  const data = assetDataOn("2026-11-27");
  const fr = pickFirstRecordStart(daily, data, "2026-11-27");
  const monthly = [monthlyOf(daily[daily.length - 1])];

  it("시작점 = 11/7(등록 당일 11/6 제외)", () => expect(fr?.date).toBe("2026-11-07"));

  it("11/27: 진행 중 — 이름 '11월'+진행 중, 구간 11/7 → 11/27, 카드·결산 같은 구간, GA first_month", () => {
    const w = view(monthly, "2026-11-27", fr);
    expect(w.kind).toBe("in_progress");
    expect(w.firstRecord).toBe(true);
    expect(settlementRangeLabel(w)).toBe("11/7 → 11/27");
    expect(settlementWindowName(w, "2026-11-27")).toEqual({ name: "11월", inProgress: true });
    expect(settlementGaResult(w)).toBe("first_month");
    const card = pickSettlementCard(monthly, "2026-11-27", fr)!;
    expect(card.startDate).toBe(w.startDate);
    expect(card.endDate).toBe(w.endDate);
  });

  it("11/27: 기록 안 된 변화 < 전체 |증감|의 50%, 부호 반전 없음, 원인 합 = Hero 증감, 힌트 없음", () => {
    const w = view(monthly, "2026-11-27", fr);
    const c = causesOf(w, data, "2026-11-27");
    expect(c.delta).not.toBe(0);
    expect(Math.abs(c.unrecorded)).toBeLessThan(Math.abs(c.delta) * UNRECORDED_HINT_RATIO);
    expect(c.unrecorded * c.delta).toBeGreaterThanOrEqual(0);
    expect(c.sum).toBe(c.delta);
    expect(c.mapped.showUnrecordedHint).toBe(false);
  });

  it("12/2: 끝이 11월 월 기록 → range '11/7 → 11/28 변화'(11월 결산 아님), 팁·허브·결산 구간·증감 원 단위 일치", () => {
    const d2 = dailyRange("2026-11-03", "2026-12-02");
    const data2 = assetDataOn("2026-12-02");
    const fr2 = pickFirstRecordStart(d2, data2, "2026-12-02");
    const m2 = [monthlyOf(dailyOn("2026-11-28")), monthlyOf(d2[d2.length - 1])];
    const v = view(m2, "2026-12-02", fr2);
    const h = hub(m2, "2026-12-02", fr2);
    const tip = pickSettlementCard(m2, "2026-12-02", fr2)!; // 홈 팁(pickHomeTip)이 쓰는 함수 그대로
    expect(v.kind).toBe("range");
    expect(settlementWindowName(v, "2026-12-02").name).toBe("11/7 → 11/28 변화");
    expect(settlementWindowName(v, "2026-12-02").name).not.toContain("결산");
    for (const w of [h, tip]) {
      expect([w.startDate, w.endDate]).toEqual([v.startDate, v.endDate]);
      expect(w.month).toBe(v.month);
    }
    const cv = causesOf(v, data2, "2026-12-02");
    expect(causesOf(h, data2, "2026-12-02").delta).toBe(cv.delta);
    expect(Math.abs(cv.unrecorded)).toBeLessThan(Math.abs(cv.delta) * UNRECORDED_HINT_RATIO);
    expect(cv.sum).toBe(cv.delta);
  });
});

describe("F2 — 11/6 추가분 1건을 현금 계좌 잔액으로 매수(현금 감소 + 주식 증가)", () => {
  const opts = { cashBuy: true };
  it("11/27: 구간이 11/7 이후라 등록 시 이동이 구간 밖 — 기록 안 된 변화 < 50%, 부호 반전 없음", () => {
    const daily = dailyRange("2026-11-03", "2026-11-27", opts);
    const data = assetDataOn("2026-11-27", opts);
    const fr = pickFirstRecordStart(daily, data, "2026-11-27");
    expect(fr?.date).toBe("2026-11-07");
    expect(fr!.breakdown!.cash).toBe(20_000_000 - 15 * 200 * 1400);
    const c = causesOf(view([monthlyOf(daily[daily.length - 1])], "2026-11-27", fr), data, "2026-11-27");
    expect(Math.abs(c.unrecorded)).toBeLessThan(Math.abs(c.delta) * UNRECORDED_HINT_RATIO);
    expect(c.unrecorded * c.delta).toBeGreaterThanOrEqual(0);
    expect(c.sum).toBe(c.delta);
  });
  it("12/2도 동일", () => {
    const daily = dailyRange("2026-11-03", "2026-12-02", opts);
    const data = assetDataOn("2026-12-02", opts);
    const fr = pickFirstRecordStart(daily, data, "2026-12-02");
    const m = [monthlyOf(dailyOn("2026-11-28", opts)), monthlyOf(daily[daily.length - 1])];
    const c = causesOf(view(m, "2026-12-02", fr), data, "2026-12-02");
    expect(Math.abs(c.unrecorded)).toBeLessThan(Math.abs(c.delta) * UNRECORDED_HINT_RATIO);
    expect(c.unrecorded * c.delta).toBeGreaterThanOrEqual(0);
  });
});

describe("F3 — 경계·비대상", () => {
  const today = "2026-11-27";
  const noFirst = (daily: ReturnType<typeof dailyRange>, data: AssetData, t = today) => pickFirstRecordStart(daily, data, t);

  it("등록 당일(11/6)만 기록 → 시작점 없음, 카드 null, 결산 first_month", () => {
    const daily = [dailyOn("2026-11-06")];
    const data = assetDataOn("2026-11-06");
    expect(noFirst(daily, data, "2026-11-06")).toBeNull();
    const m = [monthlyOf(daily[0])];
    expect(pickSettlementCard(m, "2026-11-27", null)).toBeNull();
    expect(view(m, "2026-11-27", null).kind).toBe("first_month");
  });

  it("id에 ms 없는 항목이 하나라도 있으면 A 미적용(createdAt 없는 항목 대체 규칙)", () => {
    const data = assetDataOn(today);
    const legacy = { ...data, stocks: [...data.stocks, { ...data.stocks[0], id: "legacy-1" }] } as AssetData;
    expect(noFirst(dailyRange("2026-11-03", today), legacy)).toBeNull();
  });

  it("자산이 0건이면 시작점 없음", () => {
    expect(noFirst(dailyRange("2026-11-03", today), { stocks: [], crypto: [], cash: [], realEstate: [], loans: [] } as unknown as AssetData)).toBeNull();
  });

  it("실물자산(`ph_<ms>`) id도 등록일 계산에 들어간다", () => {
    const data = { ...assetDataOn("2026-11-06"), physicalAssets: [{ id: `ph_${msOf("2026-11-20")}`, type: "gold", name: "금", currentValue: 1, purchasePrice: 1 }] } as unknown as AssetData;
    expect(noFirst(dailyRange("2026-11-03", today), data)?.date).toBe("2026-11-21");
  });

  it("date·breakdown 없는 레거시 일별 기록은 시작점 후보에서 제외", () => {
    const data = assetDataOn(today);
    const legacy = dailyRange("2026-11-07", today).map((d) => ({ ...d, breakdown: undefined }));
    expect(noFirst(legacy, data)).toBeNull();
    const noDate = dailyRange("2026-11-07", today).map((d) => ({ ...d, date: undefined as unknown as string }));
    expect(noFirst(noDate, data)).toBeNull();
  });

  it("끝 월 기록에 date가 없으면(레거시) A 미적용", () => {
    const daily = dailyRange("2026-11-03", "2026-12-02");
    const fr = pickFirstRecordStart(daily, assetDataOn("2026-12-02"), "2026-12-02");
    const legacyEnd = { month: "2026-11", netAsset: 1, financialAsset: 1 };
    expect(resolveSettlementWindow([legacyEnd], "2026-11", "2026-12-02", fr).kind).toBe("first_month");
  });

  it("시작점 후 6일은 지금 문구(first_month), 7일은 열림", () => {
    const d = dailyRange("2026-11-03", "2026-11-14");
    const m = (t: string) => [monthlyOf(dailyOn(t))];
    const six = "2026-11-13"; // 11/7 → 11/13 = 6일
    expect(view(m(six), six, pickFirstRecordStart(d, assetDataOn(six), six)).kind).toBe("first_month");
    const seven = "2026-11-14";
    const w = view(m(seven), seven, pickFirstRecordStart(d, assetDataOn(seven), seven));
    expect(w.kind).toBe("in_progress");
    expect(w.gapDays).toBe(7);
  });

  it("창 중 새 자산 등록(11/25): 시작점이 11/26으로 갱신 → 7일 미만 → 세 경로 모두 first_month", () => {
    const opts = { extra: [{ id: `stock_${msOf("2026-11-25")}`, date: "2026-11-25" }] };
    const daily = dailyRange("2026-11-03", today, opts);
    const data = assetDataOn(today, opts);
    const fr = pickFirstRecordStart(daily, data, today);
    expect(fr?.date).toBe("2026-11-26");
    const m = [monthlyOf(daily[daily.length - 1])];
    expect(view(m, today, fr).kind).toBe("first_month");
    expect(pickSettlementCard(m, today, fr)).toBeNull();
    expect(hub(m, today, fr).kind).toBe("first_month");
  });

  it("30일 롤링으로 앞 기록이 밀리면 남은 가장 이른 기록이 시작점, 7일 미만이면 문구 복귀", () => {
    const data = assetDataOn(today);
    const rolled = dailyRange("2026-11-14", today);
    expect(pickFirstRecordStart(rolled, data, today)?.date).toBe("2026-11-14");
    const m = [monthlyOf(dailyOn(today))];
    expect(view(m, today, pickFirstRecordStart(dailyRange("2026-11-22", today), data, today)).kind).toBe("first_month");
  });

  it("수용 한계 ① 새 종목을 매수하면 그 날로 R이 다시 잡혀 구간이 초기화된다", () => {
    const opts = { extra: [{ id: `stock_${msOf("2026-11-20")}`, date: "2026-11-20" }] };
    const fr = pickFirstRecordStart(dailyRange("2026-11-03", today, opts), assetDataOn(today, opts), today);
    expect(fr?.date).toBe("2026-11-21");
  });

  it("수용 한계 ② 가장 늦게 등록한 자산을 지우면 R이 앞당겨져 시작점이 더 이르다 — 세 경로 구간은 같다", () => {
    const daily = dailyRange("2026-11-03", today);
    const full = assetDataOn(today);
    const trimmed = { ...full, stocks: full.stocks.slice(0, 1), crypto: [], loans: [] } as AssetData;
    const fr = pickFirstRecordStart(daily, trimmed, today);
    expect(fr?.date).toBe("2026-11-04");
    const m = [monthlyOf(dailyOn(today))];
    const v = view(m, today, fr);
    const h = hub(m, today, fr);
    expect([h.startDate, h.endDate]).toEqual([v.startDate, v.endDate]);
  });

  it("월 기록이 있는 기존 사용자는 firstRecord 인자를 줘도 결과가 같다(diff 0)", () => {
    const monthly = [monthlyOf(dailyOn("2026-10-28")), monthlyOf(dailyOn(today))];
    const fr = pickFirstRecordStart(dailyRange("2026-11-03", today), assetDataOn(today), today);
    expect(fr).not.toBeNull();
    expect(resolveSettlementWindow(monthly, "2026-11", today, fr)).toEqual(resolveSettlementWindow(monthly, "2026-11", today));
    expect(resolveSettlementWindow(monthly, "2026-11", today, fr).firstRecord).toBeUndefined();
  });

  it("끝이 이번 달 25일 이상이면 range(날짜 구간 이름)", () => {
    const daily = dailyRange("2026-11-03", "2026-12-10");
    const t = "2026-12-10";
    const fr = pickFirstRecordStart(daily, assetDataOn(t), t);
    const m = [monthlyOf(dailyOn(t))]; // 11월 월 기록이 없는 경우(첫 구간이 25일 이상으로 이어짐)
    const w = view(m, t, fr);
    expect(w.kind).toBe("range");
    expect(settlementWindowName(w, t).name).toBe("11/7 → 12/10 변화");
  });
});
