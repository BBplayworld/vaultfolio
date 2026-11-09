// #103 A — 홈 헤더 내부 이동 상쇄: 픽스처 S1·S3·S4·S5·부분 상쇄·외화, 항등식, 인자 없음 = 기존, 결산 결과 diff 0
import { describe, expect, it } from "vitest";
import { matchRecordedTransferDetail, matchRecordedTransfers } from "@/app/(main)/_components/views/activity/change-hero";
import { computeAttributionBetween, formatAttributionSentence, getAttributionItems, getAttributionOffset, CAUSE_DISPLAY_MIN, type AttributionTransfer } from "../asset-report";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const M = 1_000_000;
const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});
const snap = (month: string, date: string, o: { cash: number; stock: number; stockCost: number; loans?: number }): MonthlyAssetSnapshot => {
  const { cash, stock, stockCost, loans = 30 * M } = o;
  return {
    month, date, netAsset: cash + stock - loans, financialAsset: cash + stock,
    breakdown: { realEstate: 0, stocks: stock, crypto: 0, cash, loans, tenantDeposit: 0, physical: 0 },
    fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
    cost: { total: cash + stockCost, stock: stockCost, crypto: 0, realEstate: 0, physical: 0 },
  };
};
const START = snap("2026-10", "2026-10-31", { cash: 10 * M, stock: 20 * M, stockCost: 20 * M });
const D1 = "2026-11-03", D2 = "2026-11-05";
const end = (o: { cash: number; stock: number; stockCost: number; loans?: number }) => snap("2026-11", D2, o);
const buyTx = (amount: number, date = D1) => ({ id: "b1", stockId: "s", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: amount, currency: "KRW", date, reflected: true, createdAt: date }) as AssetData["transactions"][number];
const sellTx = (amount: number, date = D1) => ({ ...buyTx(amount, date), id: "s1", type: "sell" }) as AssetData["transactions"][number];
const wd = (amount: number, date = D1) => ({ id: "w1", cashId: "c", date, type: "withdrawal", amount, currency: "KRW", reflected: true }) as AssetData["cashTransactions"][number];

function run(d: AssetData, e: MonthlyAssetSnapshot) {
  const attr = computeAttributionBetween(START, e, {}, d, RATES, true)!;
  const transfer: AttributionTransfer = matchRecordedTransferDetail(d, attr.windowFrom ?? attr.fromDate, attr.windowTo ?? attr.toDate, RATES);
  const items = getAttributionItems(attr, transfer);
  return { attr, transfer, items, texts: items.map((i) => `${i.label} ${i.text}`), sum: items.reduce((s, i) => s + i.amount, 0) };
}
const FORBIDDEN = /매수|매도|상환|추가 대출/;

describe("S1·S4·S5: 기록 없이 옮긴 돈은 잔차 짝으로 사라지고 시세만 남는다", () => {
  it("S1 매수 기록 + 현금 맞추기: 주식 시세 상승만 + 캡션 조건", () => {
    const r = run(data(), end({ cash: 9 * M, stock: 22 * M, stockCost: 21 * M }));
    expect(r.texts).toEqual(["주식 시세 상승 +100만원"]);
    expect(Math.abs(r.sum - r.attr.deltaNet)).toBeLessThan(CAUSE_DISPLAY_MIN);
    expect(getAttributionOffset(r.attr, r.transfer)).toBeGreaterThanOrEqual(CAUSE_DISPLAY_MIN);
  });
  it("S4 매도 기록 + 현금 맞추기: 시세만", () => {
    const r = run(data({ transactions: [sellTx(1 * M)] }), end({ cash: 11 * M, stock: 20 * M, stockCost: 19 * M }));
    expect(r.texts).toEqual(["주식 시세 상승 +100만원"]);
    expect(r.texts.join()).not.toMatch(/매도|신규 현금/);
  });
  it("S5 매도 기록 + 대출 맞추기: 시세만, 대출 상환 0", () => {
    const r = run(data({ transactions: [sellTx(1 * M)] }), end({ cash: 10 * M, stock: 20 * M, stockCost: 19 * M, loans: 29 * M }));
    expect(r.texts).toEqual(["주식 시세 상승 +100만원"]);
    expect(r.texts.join()).not.toMatch(/대출 상환/);
  });
});

describe("S3: 맞추기 후 같은 금액 출금 기록(이중 반영) — 값 오류는 그대로 보인다", () => {
  it("출금↔매수 기록 짝은 상쇄되고 현금 정리 −100만이 남는다", () => {
    const d = data({ transactions: [buyTx(1 * M)], cashTransactions: [wd(1 * M)] });
    const e = end({ cash: 8 * M, stock: 22 * M, stockCost: 21 * M });
    const r = run(d, e);
    expect(r.transfer.out.stock).toBe(1 * M);
    expect(r.texts).toEqual(["주식 시세 상승 +100만원", "현금 정리 -100만원".replace("-", "−")]);
    expect(Math.abs(r.sum - r.attr.deltaNet)).toBeLessThan(CAUSE_DISPLAY_MIN);
  });
});

describe("부분 상쇄·외화", () => {
  it("매수 100만·현금 −60만 → 기록 안 된 변화 +40만(결산과 같은 라벨), 매수/상환 라벨 없음", () => {
    const r = run(data(), end({ cash: 9.4 * M, stock: 22 * M, stockCost: 21 * M }));
    expect(r.texts).toEqual(["주식 시세 상승 +100만원", "기록 안 된 변화 +40만원"]);
    expect(r.items.map((i) => i.label).filter((l) => FORBIDDEN.test(l))).toEqual([]);
    expect(r.items[1].key).toBe("unrecorded");
    expect(r.items[1].dateLabel).toBeUndefined();
  });
  it("외화 매매: 환율 차 잔여 2만은 기록 안 된 변화, 1만 미만(0.5만)은 흡수되어 항등식 유지", () => {
    // 매수 다리 142만(체결 환율) vs 현금 −140만 → 남는 몫 +2만
    const a = run(data(), end({ cash: 8.6 * M, stock: 22.42 * M, stockCost: 21.42 * M }));
    expect(a.texts).toEqual(["주식 시세 상승 +100만원", "기록 안 된 변화 +2만원"]);
    expect(Math.abs(a.sum - a.attr.deltaNet)).toBeLessThan(CAUSE_DISPLAY_MIN);
    // 매수 100.5만 vs 현금 −100만 → 남는 몫 0.5만은 숨김(항등식은 1만 미만 오차 허용)
    const b = run(data(), end({ cash: 9.0 * M, stock: 22.005 * M, stockCost: 21.005 * M }));
    expect(b.items.every((i) => Math.abs(i.amount) >= CAUSE_DISPLAY_MIN)).toBe(true);
    expect(Math.abs(b.sum - b.attr.deltaNet)).toBeLessThan(CAUSE_DISPLAY_MIN);
  });
});

describe("상쇄하지 않는 경우·불변", () => {
  it("단방향(매수 기록만, 현금 그대로)은 기존 결과와 같고 캡션 대상(상쇄 0)도 아니다", () => {
    const r = run(data(), end({ cash: 10 * M, stock: 22 * M, stockCost: 21 * M }));
    expect(r.items).toEqual(getAttributionItems(r.attr));
    expect(getAttributionOffset(r.attr, r.transfer)).toBe(0);
    expect(r.texts).toContain("주식 매수 +100만원");
  });
  it("같은 부호 다리끼리는 지우지 않는다(매수 + 현금 증가)", () => {
    const r = run(data(), end({ cash: 11 * M, stock: 22 * M, stockCost: 21 * M }));
    expect(r.items).toEqual(getAttributionItems(r.attr));
  });
  it("transfer 인자 없는 호출 = 기존 결과(항목·문장)", () => {
    const e = end({ cash: 9 * M, stock: 22 * M, stockCost: 21 * M });
    const attr = computeAttributionBetween(START, e, {}, data(), RATES, true)!;
    const noOffset: AttributionTransfer = { out: { stock: 0, crypto: 0, physical: 0, loan: 0 }, in: { stock: 0, crypto: 0 } };
    expect(getAttributionItems(attr)).toEqual(getAttributionItems(attr, undefined));
    expect(formatAttributionSentence(attr)).toBe(getAttributionItems(attr).map((i) => `${i.label} ${i.text}`).join(" · "));
    expect(getAttributionOffset(attr)).toBe(0);
    void noOffset;
  });
  it("실물 등록 + 현금 맞추기도 같은 풀에서 상쇄(실물 합류)", () => {
    const e: MonthlyAssetSnapshot = { ...end({ cash: 9 * M, stock: 21 * M, stockCost: 20 * M }), breakdown: { realEstate: 0, stocks: 21 * M, crypto: 0, cash: 9 * M, loans: 30 * M, tenantDeposit: 0, physical: 1 * M }, netAsset: 9 * M + 21 * M + 1 * M - 30 * M, cost: { total: 9 * M + 20 * M + 1 * M, stock: 20 * M, crypto: 0, realEstate: 0, physical: 1 * M } };
    const attr = computeAttributionBetween(START, e, {}, data(), RATES, true)!;
    const items = getAttributionItems(attr, { out: { stock: 0, crypto: 0, physical: 0, loan: 0 }, in: { stock: 0, crypto: 0 } });
    expect(items.map((i) => i.key)).toEqual(["price:stock"]);
  });
});

describe("결산 결과 diff 0 (A 단독)", () => {
  it("matchRecordedTransfers 래퍼 = 출금 짝 합, 입금 짝(in)은 항상 0", () => {
    const d = data({ transactions: [buyTx(1 * M), sellTx(2 * M)], cashTransactions: [wd(1 * M), { ...wd(2 * M), id: "dep", type: "deposit" } as never] });
    const detail = matchRecordedTransferDetail(d, "2026-10-31", D2, RATES);
    expect(detail.in).toEqual({ stock: 0, crypto: 0 });
    expect(matchRecordedTransfers(d, "2026-10-31", D2, RATES)).toBe(detail.out.stock + detail.out.crypto + detail.out.physical + detail.out.loan);
    expect(matchRecordedTransfers(d, "2026-10-31", D2, RATES)).toBe(1 * M);
  });
});
