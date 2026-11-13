// 4.95 #184 항목 2 — 320 막대 값 라벨 축약(F4)·배당 예정 칩 간격(F5). 정적 렌더(jsdom 없음)
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyAssetSnapshot } from "@/types/asset";
import { formatCompactKRW, formatShortCurrencyDecimal } from "@/lib/number-utils";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { WeekTrendCard } from "../dashboard";

const snap = (date: string, netAsset: number) => ({ date, netAsset, financialAsset: netAsset }) as DailyAssetSnapshot;

describe("formatCompactKRW", () => {
  it("억·만 단위, 10 미만 소수 1자리(버림), 이상 정수, 원 생략", () => {
    expect(formatCompactKRW(643_999_999)).toBe("6.4억");
    expect(formatCompactKRW(1_250_000_000)).toBe("12억");
    expect(formatCompactKRW(7_520_000)).toBe("752만");
    expect(formatCompactKRW(850_000)).toBe("85만");
    expect(formatCompactKRW(75_000)).toBe("7.5만");
    expect(formatCompactKRW(9_999)).toBe("9,999");
    expect(formatCompactKRW(0)).toBe("0");
  });
  it("음수는 U+2212 부호", () => {
    expect(formatCompactKRW(-643_000_000)).toBe("−6.4억");
    expect(formatCompactKRW(-12_300_000_000)).toBe("−123억");
  });
});

describe("WeekTrendCard 값 라벨 320 분기", () => {
  const dates = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];
  const html = renderToStaticMarkup(<WeekTrendCard snapshots={dates.map((d, i) => snap(d, 643_000_000 + i * 1_000_000))} />);
  it("360 이상은 기존 표기·클래스 그대로, 320 미만만 축약 span", () => {
    expect(html).toContain(formatShortCurrencyDecimal(643_000_000));
    expect(html).toContain("text-sm font-bold text-foreground leading-none mb-1 max-[359px]:hidden");
    expect(html.match(/text-\[11px\] font-bold tabular-nums whitespace-nowrap/g)).toHaveLength(7);
    expect(html).toContain(">6.4억<");
  });
});

import { formatCalendarDiff } from "@/lib/number-utils";
describe("formatCalendarDiff (일 탭 달력 칸 증감)", () => {
  it("ui 표 5건", () => {
    expect(formatCalendarDiff(10_770_000)).toBe("+0.1억");
    expect(formatCalendarDiff(-99_990_000)).toBe("−0.9억");
    expect(formatCalendarDiff(120_000_000)).toBe("+1.2억");
    expect(formatCalendarDiff(66_200)).toBe("+6.6만");
    expect(formatCalendarDiff(999)).toBe("+999");
  });
  it("경계", () => {
    expect(formatCalendarDiff(1_000)).toBe("+0.1만");
    expect(formatCalendarDiff(9_999_999)).toBe("+999만");
    expect(formatCalendarDiff(10_000_000)).toBe("+0.1억");
    expect(formatCalendarDiff(99_999_999)).toBe("+0.9억");
    expect(formatCalendarDiff(100_000_000)).toBe("+1억");
    expect(formatCalendarDiff(-999)).toBe("−999");
    expect(formatCalendarDiff(-1_200)).toBe("−0.1만");
  });
});
