// 4.95 #184 항목 2 — 320 막대 값 라벨 축약(F4)·배당 예정 칩 간격(F5). 정적 렌더(jsdom 없음)
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { DailyAssetSnapshot } from "@/types/asset";
import { formatShortCurrencyDecimal } from "@/lib/number-utils";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { WeekTrendCard } from "../dashboard";

const snap = (date: string, netAsset: number) => ({ date, netAsset, financialAsset: netAsset }) as DailyAssetSnapshot;
describe("WeekTrendCard 값 라벨 640 미만 분기(4.96)", () => {
  const dates = ["2026-11-06", "2026-11-07", "2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"];
  const html = renderToStaticMarkup(<WeekTrendCard snapshots={dates.map((d, i) => snap(d, 643_000_000 + i * 1_000_000))} />);
  it("640 이상은 기존 표기, 640 미만은 원 없는 11px span 2종", () => {
    expect(html).toContain(formatShortCurrencyDecimal(643_000_000));
    expect(html).toContain("text-sm font-bold text-foreground leading-none mb-1 sm:inline");
    expect(html.match(/text-\[11px\] font-bold tabular-nums whitespace-nowrap/g)).toHaveLength(14);
    expect(html).toContain(">6.43억<");
  });
});

import { formatNarrowKRW } from "@/lib/number-utils";
const T = { signed: true, tiny: true } as const;
const N = { signed: true } as const;
describe("formatNarrowKRW (640 미만 칸·막대)", () => {
  it("1천만 미만 증감은 전 폭에서 4.95와 같은 문자열", () => {
    for (const o of [T, N]) {
      expect(formatNarrowKRW(66_200, o)).toBe("+6.6만");
      expect(formatNarrowKRW(999, o)).toBe("+999");
      expect(formatNarrowKRW(-999, o)).toBe("\u2212999");
      expect(formatNarrowKRW(1_000, o)).toBe("+0.1만");
      expect(formatNarrowKRW(-1_200, o)).toBe("\u22120.1만");
      expect(formatNarrowKRW(9_999, o)).toBe("+0.9만");
      expect(formatNarrowKRW(8_770_000, o)).toBe("+877만");
      expect(formatNarrowKRW(9_999_999, o)).toBe("+999만");
      expect(formatNarrowKRW(662_000, o)).toBe("+66만");
    }
  });
  it("tiny(<375): 4.95와 같은 억 1자리", () => {
    expect(formatNarrowKRW(10_770_000, T)).toBe("+0.1억");
    expect(formatNarrowKRW(-99_990_000, T)).toBe("\u22120.9억");
    expect(formatNarrowKRW(120_000_000, T)).toBe("+1.2억");
    expect(formatNarrowKRW(-88_000_000, T)).toBe("\u22120.8억");
    expect(formatNarrowKRW(99_999_999, T)).toBe("+0.9억");
    expect(formatNarrowKRW(100_000_000, T)).toBe("+1억");
    expect(formatNarrowKRW(1e9, T)).toBe("+10억");
  });
  it("기본(375~639): 1천만~1억 억 2자리", () => {
    expect(formatNarrowKRW(19_990_000, N)).toBe("+0.19억");
    expect(formatNarrowKRW(10_770_000, N)).toBe("+0.1억");
    expect(formatNarrowKRW(-88_000_000, N)).toBe("\u22120.88억");
    expect(formatNarrowKRW(99_990_000, N)).toBe("+0.99억");
    expect(formatNarrowKRW(99_999_999, N)).toBe("+0.99억");
    expect(formatNarrowKRW(10_000_000, N)).toBe("+0.1억");
    expect(formatNarrowKRW(100_000_000, N)).toBe("+1억");
    expect(formatNarrowKRW(1e9, N)).toBe("+10억");
  });
  it("순자산(부호 없음)", () => {
    expect(formatNarrowKRW(567_000_000)).toBe("5.67억");
    expect(formatNarrowKRW(567_000_000, { tiny: true })).toBe("5.67억");
    expect(formatNarrowKRW(1_234_000_000, { tiny: true })).toBe("12.3억");
    expect(formatNarrowKRW(1_234_000_000)).toBe("12.34억");
    expect(formatNarrowKRW(88_000_000)).toBe("0.88억");
    expect(formatNarrowKRW(88_000_000, { tiny: true })).toBe("0.88억");
    expect(formatNarrowKRW(643_000_000)).toBe("6.43억");
  });
  it("0·음수 순자산", () => {
    expect(formatNarrowKRW(0, N)).toBe("0");
    expect(formatNarrowKRW(-567_000_000)).toBe("\u22125.67억");
  });
});
