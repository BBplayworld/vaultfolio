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
  taxDismissed: false,
  seen: [] as unknown[][],
  tracked: [] as unknown[][],
}));

vi.mock("@/app/(main)/_components/layout/onboarding/notice", () => ({ NOTICE_ID: "n1" }));
vi.mock("../local-storage", () => ({
  readNoticeSeenId: () => (h.noticeUnseen ? null : "n1"),
  markNoticeSeen: (...a: unknown[]) => void h.seen.push(a),
}));
vi.mock("../asset/backup-status", () => ({ shouldShowBackupNudge: () => h.backup, daysSinceBackup: () => 30 }));
// isImminentTaxMatch·todayKst는 실제 구현 사용(경계 검증), 노출 대상 목록만 스텁
vi.mock("../tax-utils", async (orig) => ({
  ...(await orig<typeof import("../tax-utils")>()),
  isTaxNoticeDismissed: () => h.taxDismissed,
  getAssetDrivenHighlights: () => h.tax,
}));
vi.mock("../analytics/ga", async (orig) => ({
  ...(await orig<typeof import("../analytics/ga")>()),
  track: (...a: unknown[]) => void h.tracked.push(a),
}));
vi.mock("../asset/asset-refresh-status", () => ({ shouldShowRefreshNudge: () => h.refresh, getStaleCategories: () => ["stock"] }));
vi.mock("../feature-usage", () => ({ pickRecommendedFeature: () => h.feature }));
vi.mock("../asset/snapshot-storage", () => ({ readMonthlySnapshots: () => h.monthly }));

import { pickHomeTip, markCurrentNoticeSeen } from "../home-tip";
import { PARAM_VALUES } from "../analytics/ga";

const assetData = { lastUpdated: "2026-11-01T00:00:00.000Z" } as AssetData;
const snap = (month: string, date: string): MonthlyAssetSnapshot => ({ month, date, netAsset: 1, financialAsset: 1 });
const TWO = [snap("2026-09", "2026-09-28"), snap("2026-10", "2026-10-28")];
const tax = (month: number, dueLabel: string) => ({ event: { id: `t${month}${dueLabel}`, month, dueLabel, severity: "high" }, reasons: ["x"] });
const pick = (today?: string, hasAssets = true) => pickHomeTip({ assetData, hasAssets, syncArmed: false, today });

beforeEach(() => {
  Object.assign(h, { noticeUnseen: false, backup: false, tax: [], refresh: false, feature: null, monthly: TWO, taxDismissed: false, seen: [], tracked: [] });
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
  it("5. 공지·백업·임박 세금이 결산보다 먼저", () => {
    h.noticeUnseen = true;
    expect(pick("2026-11-27")?.kind).toBe("notice");
    h.noticeUnseen = false; h.backup = true;
    expect(pick("2026-11-27")?.kind).toBe("backup");
    h.backup = false; h.tax = [tax(11, "~11/30")];
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

describe("세금 임박 경계(결산 창 11/5 = 10월 결산)", () => {
  it("① 다음 달 일정만 → settlement", () => {
    h.tax = [tax(12, "~12/10")];
    expect(pick("2026-11-05")?.kind).toBe("settlement");
  });
  it("② 이번 달 마감 D-6 → tax, D-7 → settlement", () => {
    h.tax = [tax(11, "~11/11")];
    expect(pick("2026-11-05")?.kind).toBe("tax");
    h.tax = [tax(11, "~11/12")];
    expect(pick("2026-11-05")?.kind).toBe("settlement");
    h.tax = [tax(11, "~11/05")]; // 당일(D-0) 포함
    expect(pick("2026-11-05")?.kind).toBe("tax");
  });
  it("③ 마감일 지남 → settlement", () => {
    h.tax = [tax(11, "~11/03")];
    expect(pick("2026-11-05")?.kind).toBe("settlement");
  });
  it("④ 창 밖 + 세금(다음 달) → tax(기존 노출 유지)", () => {
    h.tax = [tax(12, "~12/10")];
    expect(pick("2026-11-15")?.kind).toBe("tax");
  });
  it("⑤ 세금 닫힘 → settlement", () => {
    h.tax = [tax(11, "~11/08")]; h.taxDismissed = true;
    expect(pick("2026-11-05")?.kind).toBe("settlement");
  });
  it("⑥ 마감일 없는 월 전체 일정 → settlement", () => {
    h.tax = [tax(11, "11월 중")];
    expect(pick("2026-11-05")?.kind).toBe("settlement");
  });
  it("임박 세금이면 표시 내용은 매치 전체(기존 tax 팁 그대로)", () => {
    h.tax = [tax(11, "~11/08"), tax(12, "~12/10")];
    const t = pick("2026-11-05");
    expect(t?.kind === "tax" && t.matches.length).toBe(2);
  });
});

describe("공지 X = 읽음(#4.36)", () => {
  it("markCurrentNoticeSeen({track:false})는 열람 기록만, GA notice view 0회", () => {
    markCurrentNoticeSeen({ track: false });
    expect(h.seen[0]?.[0]).toBe("n1");
    expect(h.tracked).toHaveLength(0);
  });
  it("기본 호출(공지 열기·더보기)은 기존대로 notice view 1회", () => {
    markCurrentNoticeSeen();
    expect(h.tracked).toEqual([["feature_use", { category: "notice", method: "view" }]]);
  });
  it("19. 미열람 공지는 여전히 최우선(결산 창·임박 세금보다 먼저)", () => {
    h.noticeUnseen = true; h.tax = [tax(11, "~11/08")];
    expect(pick("2026-11-05")?.kind).toBe("notice");
  });
  it("홈 팁 X: notice면 track:false 열람 처리 + home_tip close, 최초 1회 강제 노출 바이패스 유지(grep)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/home/home-tip-box.tsx"), "utf8");
    const close = src.slice(src.indexOf("const close ="), src.indexOf("const activate ="));
    expect(close).toContain('if (tip.kind === "notice") markCurrentNoticeSeen({ track: false });');
    expect(close).toContain('track("feature_use", { category: "home_tip", method: "close" })');
    expect(src).toMatch(/if \(!\(isNoticeUnseen\(\) && !noticeShownThisSession\)\)/);
  });
});
