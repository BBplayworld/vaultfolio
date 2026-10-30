// #46 주식·대출 거래 입력의 "오늘"을 현금 입력과 같은 KST 기준(todayKst)으로 통일
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { todayKst } from "@/lib/tax-utils";

afterEach(() => {
  vi.useRealTimers();
});

describe("todayKst 고정 시각 (KST 00~09시 경계)", () => {
  it.each([
    ["KST 00:00 (UTC 전날 15:00)", "2026-10-14T15:00:00Z", "2026-10-15"],
    ["KST 08:59 (UTC 전날 23:59)", "2026-10-14T23:59:00Z", "2026-10-15"],
    ["KST 09:00 (UTC 00:00)", "2026-10-15T00:00:00Z", "2026-10-15"],
    ["월 경계 KST 11/1 01:30", "2026-10-31T16:30:00Z", "2026-11-01"],
    ["연 경계 KST 1/1 05:00", "2026-12-31T20:00:00Z", "2027-01-01"],
    ["KST 23:59 (UTC 14:59)", "2026-10-15T14:59:00Z", "2026-10-15"],
  ])("%s → %s", (_label, utc, expected) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(utc));
    expect(todayKst()).toBe(expected);
    // 수정 전 방식(UTC)은 같은 시각에 전날을 낸다 — 결함 재현 대조
    if (expected !== utc.slice(0, 10)) {
      expect(new Date().toISOString().split("T")[0]).not.toBe(expected);
    }
  });
});

describe("입력 폼 기본 날짜·상한이 todayKst를 쓴다", () => {
  const FORMS = path.resolve(__dirname, "../../app/(main)/_components/forms");
  it.each([
    "trade/trade-input.tsx",
    "asset-update/input/loan-tx-input.tsx",
    "asset-update/input/cash-tx-input.tsx",
  ])("%s", (rel) => {
    const src = readFileSync(path.join(FORMS, rel), "utf8");
    expect(src).toMatch(/date: todayKst\(\)/);
    expect(src).toMatch(/const todayStr = todayKst\(\)/);
    // UTC "오늘" 직접 계산이 기본값·상한에 남지 않음
    expect(src).not.toMatch(/date: new Date\(\)\.toISOString\(\)/);
    expect(src).not.toMatch(/todayStr = new Date\(/);
  });
});
