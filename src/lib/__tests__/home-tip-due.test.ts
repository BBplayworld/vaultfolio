// #245(5.130) 홈 팁 `점검 차례` 순위 — 백업 > 임박 세금 > 결산 > 점검 차례 > 새 소식 > 끊긴 거래 > 그 외 세금 > 자산 최신화 > 알림 > 기능.
// 팁은 호출부가 넘긴 값(차례 수 ≥ 1)으로만 뜬다 — pickHomeTip은 순위만 정하고 차례를 다시 판정하지 않는다(AC-8).
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const h = vi.hoisted(() => ({
  record: null as null | { id: string; seenAt: number },
  backup: false,
  tax: [] as unknown[],
  refresh: false,
  feature: null as null | { id: string },
  monthly: [] as unknown[],
}));
vi.mock("../local-storage", async (orig) => ({ ...(await orig<typeof import("../local-storage")>()), readNoticeSeen: () => h.record, markNoticeSeen: () => {} }));
vi.mock("../asset/backup-status", () => ({ shouldShowBackupNudge: () => h.backup, daysSinceBackup: () => 30 }));
vi.mock("../tax-utils", async (orig) => ({ ...(await orig<typeof import("../tax-utils")>()), isTaxNoticeDismissed: () => false, getAssetDrivenHighlights: () => h.tax }));
vi.mock("../asset/asset-refresh-status", async (orig) => ({ ...(await orig<typeof import("../asset/asset-refresh-status")>()), shouldShowRefreshNudge: () => h.refresh, getStaleCategories: () => ["stock"] }));
vi.mock("../feature-usage", () => ({ pickRecommendedFeature: () => h.feature }));
vi.mock("../asset/snapshot-storage", () => ({ readMonthlySnapshots: () => h.monthly, readDailySnapshots: () => [] }));

import { pickHomeTip } from "../home-tip";

const assetData = { lastUpdated: "2026-11-01T00:00:00.000Z" } as AssetData;
const snap = (month: string, date: string): MonthlyAssetSnapshot => ({ month, date, netAsset: 1, financialAsset: 1 });
const due = { count: 2, unit: "종목" as const, reason: "평단 대비 −15% 이하에 닿았어요" };
const MID = "2026-11-19"; // 결산 창 밖(말일−3일~다음 달 10일이 아님)
const pick = (o: Partial<Parameters<typeof pickHomeTip>[0]> = {}) => pickHomeTip({ assetData, hasAssets: true, syncArmed: false, today: MID, whatsNewOk: true, ...o });
const tax = (month: number, dueLabel: string) => ({ event: { id: `t${month}${dueLabel}`, month, dueLabel, severity: "high" }, reasons: ["x"] });

beforeEach(() => {
  Object.assign(h, { record: null, backup: false, tax: [], refresh: false, feature: null, monthly: [snap("2026-09", "2026-09-28"), snap("2026-10", "2026-10-28")] });
});

describe("점검 차례 팁 — 뜨는 조건", () => {
  it("차례 입력이 있으면 `due`, 값은 넘긴 그대로(수·단위·이유)", () => {
    h.record = { id: "seen", seenAt: Date.now() };
    expect(pick({ due, whatsNewOk: false })).toEqual({ kind: "due", ...due });
  });
  it("차례 입력이 없으면(미전달·null·0) 기존 판정과 같다 — 미정 기기 홈 diff 0", () => {
    for (const setup of [() => {}, () => { h.refresh = true; }, () => { h.feature = { id: "xray" }; }, () => { h.tax = [tax(12, "~12/10")]; }]) {
      setup();
      const none = pick();
      expect(pick({ due: null })).toEqual(none);
      expect(pick({ due: { ...due, count: 0 } })).toEqual(none);
      expect(none?.kind).not.toBe("due");
    }
  });
  it("자산이 없으면 뜨지 않는다", () => {
    expect(pick({ due, hasAssets: false })?.kind).not.toBe("due");
  });
});

describe("점검 차례 팁 — 순위", () => {
  it("백업이 위", () => {
    h.backup = true;
    expect(pick({ due })?.kind).toBe("backup");
  });
  it("임박 세금(이번 달 마감 0~6일)이 위, 그 외 세금은 아래", () => {
    h.tax = [tax(11, "~11/20")];
    expect(pick({ due })?.kind).toBe("tax");
    h.tax = [tax(12, "~12/10")];
    expect(pick({ due })?.kind).toBe("due");
  });
  it("결산 창 안이면 결산이 위", () => {
    expect(pick({ due, today: "2026-12-03" })?.kind).toBe("settlement");
    expect(pick({ due, today: MID })?.kind).toBe("due");
  });
  it("새 소식·끊긴 거래·자산 최신화·알림·기능보다 위(차례가 남아 있는 동안 아래 순위를 가린다)", () => {
    expect(pick()?.kind).toBe("whats_new"); // 안 본 소식이 있는 기기
    expect(pick({ due })?.kind).toBe("due");
    h.refresh = true;
    h.feature = { id: "xray" };
    expect(pick({ due, hasRelink: true, notifyOk: true })?.kind).toBe("due");
  });
  it("차례가 풀리면(입력 없음) 아래 순위 팁이 정상으로 뜬다(AC-9)", () => {
    h.record = { id: "seen", seenAt: Date.now() };
    h.refresh = true;
    expect(pick({ due, whatsNewOk: false })?.kind).toBe("due");
    expect(pick({ due: null, whatsNewOk: false })?.kind).toBe("refresh");
  });
});

describe("팁 쪽 재판정 0(AC-8)", () => {
  it("home-tip.ts는 점검 칸·이름표 모듈을 불러오지 않는다", () => {
    const src = readFileSync(path.resolve(__dirname, "../home-tip.ts"), "utf8");
    const imports = src.split("\n").filter((l) => l.startsWith("import "));
    expect(imports.join("\n")).not.toMatch(/grow-|stock-labels/);
    expect(src).not.toMatch(/dueOf|labelFactsOf|pctAckOf/);
  });
  it("HomeTipBox는 허브 카드와 같은 함수(buildGrowBoards → dueTipOf)로 값을 만들고 이름표를 읽은 뒤에만 판정한다", () => {
    const box = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/home/home-tip-box.tsx"), "utf8");
    expect(box).toContain("labelsReady ? dueTipOf(buildGrowBoards(assetData, exchangeRates, labels, growNow)) : null");
    expect(box).toContain("if (!labelsReady) return;");
    expect(box).toContain("due: eligible ? dueTip : null"); // 체험·앱 잠금이면 넘기지 않는다
    expect(box.indexOf("if (!labelsReady) return;")).toBeLessThan(box.indexOf("const picked = pickHomeTip("));
    expect(box).not.toMatch(/dueOf|labelFactsOf|pctAckOf/);
  });
});
