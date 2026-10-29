// cto 축소 판정 — 월 스냅샷 보존 상한 = 현재월(미래 달 수신·저장 차단)
import { describe, expect, it } from "vitest";
import { mergeMonthlySnapshots } from "../asset/asset-storage";
import { pruneMonthlySnapshots } from "../report/settlement";
import { scoreHabit } from "../report/asset-grade";
import type { AssetSummary, MonthlyAssetSnapshot } from "@/types/asset";

const snap = (month: string, netAsset = 100): MonthlyAssetSnapshot => ({ month, netAsset, financialAsset: netAsset });

describe("월 스냅샷 상한 = 현재월", () => {
  it("2026-11에 2027-01을 수신해도 병합·저장(롤링) 후 미래 달 0개", () => {
    const merged = mergeMonthlySnapshots([snap("2026-10"), snap("2026-11")], [snap("2027-01"), snap("2026-12")], "2026-11");
    expect(merged.map((s) => s.month)).toEqual(["2026-10", "2026-11"]);
    // 저장 단계(asset-data-context)와 같은 prune 재적용에도 미래 달 없음
    expect(pruneMonthlySnapshots(merged, "2026-11").filter((s) => s.month > "2026-11")).toHaveLength(0);
  });
  it("경계: 현재 달은 포함, 다음 달은 제외, 12개월 전은 포함·13개월 전은 제외", () => {
    const r = pruneMonthlySnapshots([snap("2025-10"), snap("2025-11"), snap("2026-11"), snap("2026-12")], "2026-11");
    expect(r.map((s) => s.month)).toEqual(["2025-11", "2026-11"]);
  });
  it("미래 달이 섞여 와도 습관 축 결과 = main 저장 범위(올해분·미래 없음) 결과", () => {
    const summary = { totalValue: 100_000_000, cashValue: 20_000_000 } as AssetSummary;
    const thisYear = [snap("2026-08", 90), snap("2026-09", 95), snap("2026-10", 93), snap("2026-11", 99)];
    const merged = mergeMonthlySnapshots([snap("2025-12", 50), ...thisYear], [snap("2027-01", 10)], "2026-11");
    expect(scoreHabit(summary, merged)).toEqual(scoreHabit(summary, thisYear));
  });
});
