import { describe, expect, it } from "vitest";
import { kstDateOfIso, shouldWarnTxAfterResync, applyBalanceEdits, orderBalanceRows, checkBalanceRow, formatBalanceText, maxDecimalsOf, parseBalanceText, sanitizeBalanceText } from "../balance-edits";
import type { Cash, Loan } from "@/types/asset";

const cash = (id: string, balance: number, extra: Partial<Cash> = {}): Cash => ({
  id, type: "bank", name: `계좌${id}`, balance, currency: "KRW", institution: "은행", description: `메모${id}`, ...extra,
});
const loan = (id: string, balance: number): Loan => ({
  id, type: "credit", name: `대출${id}`, balance, interestRate: 4.5, startDate: "2025-01-01", endDate: "2027-01-01", institution: "은행", linkedCashId: "c1",
});

describe("applyBalanceEdits (C37 저장 1회용 교체)", () => {
  it("3행 변경 → 3행 모두 반영, balance 외 필드는 깊은 동등", () => {
    const list = [cash("a", 100), cash("b", 200, { currency: "USD" }), cash("c", 300)];
    const before = structuredClone(list);
    const r = applyBalanceEdits(list, { a: 150, b: 250.5, c: 10 });
    expect(r.applied).toBe(3);
    expect(r.list.map((x) => x.balance)).toEqual([150, 250.5, 10]);
    expect(r.list.map(({ balance: _b, ...rest }) => rest)).toEqual(before.map(({ balance: _b, ...rest }) => rest));
    expect(list).toEqual(before); // 입력 불변
  });
  it("저장 시점 목록에 없는 id는 건너뜀(되살리지 않음), applied는 실제 반영 건수", () => {
    const r = applyBalanceEdits([cash("a", 100)], { a: 120, gone: 999 });
    expect(r.applied).toBe(1);
    expect(r.list.map((x) => x.id)).toEqual(["a"]);
  });
  it("같은 값·편집 없음 → applied 0, 원본 목록 그대로", () => {
    const list = [cash("a", 100)];
    expect(applyBalanceEdits(list, { a: 100 })).toEqual({ list, applied: 0 });
    expect(applyBalanceEdits(list, {})).toEqual({ list, applied: 0 });
  });
  it("대출 0(완납) 허용, 나머지 필드(연계 id·금리·날짜) 보존", () => {
    const r = applyBalanceEdits([loan("l", 5_000_000)], { l: 0 });
    expect(r.applied).toBe(1);
    expect(r.list[0]).toEqual({ ...loan("l", 5_000_000), balance: 0 });
  });
});

describe("checkBalanceRow (spec 5절)", () => {
  it("빈 칸·현재와 같은 값은 변경 아님", () => {
    expect(checkBalanceRow("cash", 100, null)).toEqual({ changed: false, issue: null });
    expect(checkBalanceRow("cash", 100, 100)).toEqual({ changed: false, issue: null });
    expect(checkBalanceRow("cash", 100.5, 100.5)).toEqual({ changed: false, issue: null });
  });
  it("현금 0 → 차단, 대출 0 → 허용(경고 없음)", () => {
    expect(checkBalanceRow("cash", 100, 0)).toEqual({ changed: true, issue: "cash-zero" });
    expect(checkBalanceRow("loan", 100, 0)).toEqual({ changed: true, issue: null });
  });
  it("10배 이상·1/10 이하는 경고(경계 포함), 그 사이는 정상", () => {
    expect(checkBalanceRow("cash", 100, 1000).issue).toBe("magnitude");
    expect(checkBalanceRow("cash", 100, 10).issue).toBe("magnitude");
    expect(checkBalanceRow("cash", 100, 999).issue).toBeNull();
    expect(checkBalanceRow("cash", 100, 11).issue).toBeNull();
  });
  it("현재 값 0(완납 대출)은 비율 경고 생략, 같은 통화 단위 비교", () => {
    expect(checkBalanceRow("loan", 0, 5_000_000)).toEqual({ changed: true, issue: null });
    expect(checkBalanceRow("cash", 1000, 20_000).issue).toBe("magnitude"); // USD 1,000 → 20,000
  });
});

describe("입력 문자열", () => {
  it("원화는 정수만(문자·음수·점 제거), 쉼표 제거", () => {
    expect(sanitizeBalanceText("-1,234.5abc", 0)).toBe("12345");
    expect(sanitizeBalanceText("0012", 0)).toBe("12");
  });
  it("USD는 소수 2자리까지, 점은 1개", () => {
    expect(maxDecimalsOf("USD")).toBe(2);
    expect(maxDecimalsOf("KRW")).toBe(0);
    expect(sanitizeBalanceText("12.345", 2)).toBe("12.34");
    expect(sanitizeBalanceText("1.2.3", 2)).toBe("1.23");
    expect(sanitizeBalanceText(".5", 2)).toBe("0.5");
    expect(sanitizeBalanceText("12.", 2)).toBe("12.");
  });
  it("파싱·표시", () => {
    expect(parseBalanceText("")).toBeNull();
    expect(parseBalanceText(".")).toBeNull();
    expect(parseBalanceText("12.")).toBe(12);
    expect(parseBalanceText("1234.56")).toBe(1234.56);
    expect(formatBalanceText("1234567")).toBe("1,234,567");
    expect(formatBalanceText("1234.5")).toBe("1,234.5");
    expect(formatBalanceText("12.")).toBe("12.");
    expect(formatBalanceText("")).toBe("");
  });
});

describe("orderBalanceRows (상세 탭 순서)", () => {
  const mul = (c?: string) => (c === "USD" ? 1400 : 1);
  it("현금은 원화 환산액 큰 순", () => {
    const r = orderBalanceRows("cash", [cash("a", 1_000_000), cash("u", 1000, { currency: "USD" }), cash("b", 3_000_000)], mul);
    expect(r.map((x) => x.id)).toEqual(["b", "u", "a"]);
  });
  it("대출은 잔액 큰 순, 완납(0)은 맨 뒤", () => {
    const r = orderBalanceRows("loan", [loan("z", 0), loan("a", 100), loan("b", 300)], mul);
    expect(r.map((x) => x.id)).toEqual(["b", "a", "z"]);
  });
});

describe("shouldWarnTxAfterResync (맞춘 뒤 입출금 기록 이중 반영 경고)", () => {
  it("KST 날짜 변환: UTC 15시 이후는 다음 날", () => {
    expect(kstDateOfIso("2026-11-28T14:59:00.000Z")).toBe("2026-11-28");
    expect(kstDateOfIso("2026-11-28T15:00:00.000Z")).toBe("2026-11-29");
    expect(kstDateOfIso("bad")).toBeNull();
    expect(kstDateOfIso(null)).toBeNull();
  });
  it("거래일 이후(같은 날 포함) 맞춘 기록 + 즉시 반영이면 경고, 그 외 없음", () => {
    const at = "2026-11-28T03:00:00.000Z";
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-27", reflected: true, refreshedAtIso: at })).toBe(true);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-28", reflected: true, refreshedAtIso: at })).toBe(true);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-29", reflected: true, refreshedAtIso: at })).toBe(false);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-27", reflected: false, refreshedAtIso: at })).toBe(false);
    expect(shouldWarnTxAfterResync({ txDate: "", reflected: true, refreshedAtIso: at })).toBe(false);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-27", reflected: true, refreshedAtIso: undefined })).toBe(false);
  });
});
