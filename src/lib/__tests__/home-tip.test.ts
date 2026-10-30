// #51 결산 창 홈 팁 — pickHomeTip 우선순위·창 경계(today 주입, KST)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const h = vi.hoisted(() => ({
  noticeUnseen: false,
  backup: false,
  tax: [] as unknown[],
  refresh: false,
  feature: null as null | { id: string },
  monthly: [] as unknown[],
}));

vi.mock("@/app/(main)/_components/layout/onboarding/notice", () => ({ NOTICE_ID: "n1" }));
vi.mock("../local-storage", () => ({
  readNoticeSeenId: () => (h.noticeUnseen ? null : "n1"),
  markNoticeSeen: () => {},
}));
vi.mock("../asset/backup-status", () => ({ shouldShowBackupNudge: () => h.backup, daysSinceBackup: () => 30 }));
vi.mock("../tax-utils", () => ({ isTaxNoticeDismissed: () => false, getAssetDrivenHighlights: () => h.tax }));
vi.mock("../asset/asset-refresh-status", () => ({ shouldShowRefreshNudge: () => h.refresh, getStaleCategories: () => ["stock"] }));
vi.mock("../feature-usage", () => ({ pickRecommendedFeature: () => h.feature }));
vi.mock("../asset/snapshot-storage", () => ({ readMonthlySnapshots: () => h.monthly }));

import { pickHomeTip } from "../home-tip";
import { PARAM_VALUES } from "../analytics/ga";

const assetData = { lastUpdated: "2026-11-01T00:00:00.000Z" } as AssetData;
const snap = (month: string, date: string): MonthlyAssetSnapshot => ({ month, date, netAsset: 1, financialAsset: 1 });
const TWO = [snap("2026-09", "2026-09-28"), snap("2026-10", "2026-10-28")];
const pick = (today?: string, hasAssets = true) => pickHomeTip({ assetData, hasAssets, syncArmed: false, today });

beforeEach(() => {
  Object.assign(h, { noticeUnseen: false, backup: false, tax: [], refresh: false, feature: null, monthly: TWO });
});
afterEach(() => vi.useRealTimers());

describe("결산 창 경계", () => {
  it("1. 창 시작일(말일−3일, 11/27) → settlement(이번 달 진행 중)", () => {
    const t = pick("2026-11-27");
    expect(t?.kind).toBe("settlement");
    if (t?.kind === "settlement") {
      expect(t.window.month).toBe("2026-11");
      expect(t.today).toBe("2026-11-27");
    }
  });
  it("1-1. 2월 말일−3일(2/25)도 창 시작", () => {
    h.monthly = [snap("2026-12", "2026-12-28"), snap("2027-01", "2027-01-28")];
    expect(pick("2027-02-25")?.kind).toBe("settlement");
    expect(pick("2027-02-24")?.kind).not.toBe("settlement");
  });
  it("2. 다음 달 10일 포함(전월 결산), 11일 제외", () => {
    const t = pick("2026-11-10");
    expect(t?.kind).toBe("settlement");
    if (t?.kind === "settlement") expect(t.window.month).toBe("2026-10");
    expect(pick("2026-11-11")).toBeNull();
  });
  it("3. 일반일(15일)은 결산 아님", () => {
    expect(pick("2026-11-15")).toBeNull();
  });
  it("4. 첫 달(비교할 직전 기록 없음)은 창 안이어도 아님", () => {
    h.monthly = [snap("2026-11", "2026-11-05")];
    expect(pick("2026-11-27")).toBeNull();
    h.monthly = [];
    expect(pick("2026-11-05")).toBeNull();
  });
  it("7. hasAssets=false면 아님", () => {
    expect(pick("2026-11-27", false)).toBeNull();
  });
  it("today 기본값 = 현재 KST(UTC 11/26 15:00 = KST 11/27 00:00)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-26T15:00:00Z"));
    expect(pick()?.kind).toBe("settlement");
    vi.setSystemTime(new Date("2026-11-26T14:59:00Z")); // KST 11/26 23:59 → 창 밖
    expect(pick()).toBeNull();
  });
});

describe("우선순위: 공지 > 백업 > 세금 > 결산 > 최신화 > 기능", () => {
  it("5. 공지·백업·세금이 결산보다 먼저", () => {
    h.noticeUnseen = true;
    expect(pick("2026-11-27")?.kind).toBe("notice");
    h.noticeUnseen = false; h.backup = true;
    expect(pick("2026-11-27")?.kind).toBe("backup");
    h.backup = false; h.tax = [{ event: {} }];
    expect(pick("2026-11-27")?.kind).toBe("tax");
  });
  it("6. 결산과 최신화가 동시에 참이면 결산", () => {
    h.refresh = true; h.feature = { id: "f" };
    expect(pick("2026-11-27")?.kind).toBe("settlement");
  });
  it("6-1. 결산이 없으면 최신화 → 기능 순서 기존과 동일", () => {
    h.refresh = true; h.feature = { id: "f" };
    expect(pick("2026-11-15")?.kind).toBe("refresh");
    h.refresh = false;
    expect(pick("2026-11-15")?.kind).toBe("feature");
  });
});

it("GA source 허용 값에 home_tip이 있다(새 값 추가 없음)", () => {
  expect(PARAM_VALUES.source).toContain("home_tip");
});
