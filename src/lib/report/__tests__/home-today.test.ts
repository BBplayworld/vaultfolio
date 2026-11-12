// 4.90 #175 홈 '오늘' 순수 함수 — 가장 큰 원인 1개, 7일 카드 제목(C84 사실성)
import { describe, expect, it } from "vitest";
import type { AttributionDisplayItem } from "../asset-report";
import { pickTopCause, weekTrendTitle } from "../home-today";

const c = (key: string, amount: number): AttributionDisplayItem =>
  ({ key, label: key, sentence: key, amount, text: `${amount}` }) as AttributionDisplayItem;

describe("pickTopCause", () => {
  it("|amount| 최대(음수 포함)", () => {
    expect(pickTopCause([c("a", 100), c("b", -500), c("c", 300)])?.key).toBe("b");
  });
  it("최대가 첫 행이 아니다: 시세 -100 vs 입금 +500", () => {
    expect(pickTopCause([c("stock", -100), c("cash", 500)])?.key).toBe("cash");
  });
  it("동률은 앞 항목(정렬 순서) 유지", () => {
    expect(pickTopCause([c("a", 200), c("b", -200)])?.key).toBe("a");
  });
  it("원인 1개·0개", () => {
    expect(pickTopCause([c("only", 5)])?.key).toBe("only");
    expect(pickTopCause([])).toBeNull();
  });
});

describe("weekTrendTitle — 기록 N개가 연속 날짜면 최근 N일, 아니면 최근 기록 N일", () => {
  const d = (...dates: string[]) => dates.map((date) => ({ date }));
  it("매일 접속 7개 연속(기본 경로)", () => {
    expect(weekTrendTitle(d("2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"))).toBe("순자산 추이 (최근 7일)");
  });
  it("월 경계를 넘는 연속 2개", () => {
    expect(weekTrendTitle(d("2026-10-31", "2026-11-01"))).toBe("순자산 추이 (최근 2일)");
  });
  it("띄엄띄엄 7개가 20일에 걸치면 기록 N일", () => {
    expect(weekTrendTitle(d("2026-10-24", "2026-10-27", "2026-10-30", "2026-11-02", "2026-11-06", "2026-11-09", "2026-11-12"))).toBe("순자산 추이 (최근 기록 7일)");
  });
  it("1개는 현행 문구", () => {
    expect(weekTrendTitle(d("2026-11-12"))).toBe("순자산 추이 (최근 1일)");
  });
});
