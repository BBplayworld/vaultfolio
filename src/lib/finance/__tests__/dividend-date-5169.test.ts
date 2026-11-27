// #339(5.169) 현금 입금 폼 `M/D 지급일로` 후보 — 확정·오늘 이전 지급 중 가장 늦은 1건(C162: isEstimated 없음·false·true × 과거·오늘·미래)
import { describe, expect, it } from "vitest";
import { latestPaidPayout, payoutMonthDay } from "../dividend-calc";
import type { DividendPayoutResult } from "../finance-service";

const TODAY = "2026-11-27";
const MIN = "2023-11-27";
const p = (payoutDate: string, isEstimated?: boolean): DividendPayoutResult =>
  ({ payoutDate, amountPerShare: 361, ...(isEstimated === undefined ? {} : { isEstimated }) }) as DividendPayoutResult;

describe("latestPaidPayout", () => {
  it("isEstimated 3값 × 과거·오늘·미래 — 확정(없음·false)이고 오늘 이하인 것 중 가장 늦은 날", () => {
    const rows = [
      p("2026-04-18"), // 과거·필드 없음
      p("2026-05-20", false), // 과거·false
      p("2026-08-15", true), // 과거·추정 → 제외
      p("2026-11-27", true), // 오늘·추정 → 제외
      p("2026-12-15", true), // 미래·추정 → 제외
      p("2026-12-01", false), // 미래·false → 제외
      p("2026-12-02"), // 미래·없음 → 제외
    ];
    expect(latestPaidPayout(rows, TODAY, MIN)?.payoutDate).toBe("2026-05-20");
  });
  it("오늘 날짜 확정 지급은 후보(없음·false 둘 다)", () => {
    expect(latestPaidPayout([p("2026-04-18"), p("2026-11-27")], TODAY, MIN)?.payoutDate).toBe("2026-11-27");
    expect(latestPaidPayout([p("2026-11-27", false), p("2026-04-18")], TODAY, MIN)?.payoutDate).toBe("2026-11-27");
  });
  it("추정만·미래만·빈 배열이면 null(버튼 없음)", () => {
    expect(latestPaidPayout([p("2026-03-15", true), p("2026-06-15", true)], TODAY, MIN)).toBeNull();
    expect(latestPaidPayout([p("2026-12-20"), p("2027-01-05", false)], TODAY, MIN)).toBeNull();
    expect(latestPaidPayout([], TODAY, MIN)).toBeNull();
  });
  it("같은 날 중복 지급은 그 날 1건, 입력 순서와 무관", () => {
    const a = p("2026-04-18"), b = p("2026-04-18", false), c = p("2026-02-10");
    expect(latestPaidPayout([c, a, b], TODAY, MIN)?.payoutDate).toBe("2026-04-18");
    expect(latestPaidPayout([b, c, a], TODAY, MIN)?.payoutDate).toBe("2026-04-18");
  });
  it("폼 min(3년 보관) 미만은 후보가 아니다", () => {
    expect(latestPaidPayout([p("2023-11-26")], TODAY, MIN)).toBeNull();
    expect(latestPaidPayout([p("2023-11-27")], TODAY, MIN)?.payoutDate).toBe("2023-11-27");
  });
  it("빈 payoutDate는 무시", () => {
    expect(latestPaidPayout([p(""), p("2026-01-09")], TODAY, MIN)?.payoutDate).toBe("2026-01-09");
  });
});

describe("payoutMonthDay", () => {
  it("앞자리 0 없이 월·일, 시간대와 무관한 문자열 분해", () => {
    expect(payoutMonthDay("2026-04-08")).toEqual([4, 8]);
    expect(payoutMonthDay("2026-12-28")).toEqual([12, 28]);
    expect(payoutMonthDay("2026-01-01")).toEqual([1, 1]);
  });
});
