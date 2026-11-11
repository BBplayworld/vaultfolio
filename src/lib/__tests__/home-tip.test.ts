// #51 결산 창 홈 팁 — pickHomeTip 우선순위·창 경계(today 주입, KST)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";
import { WHATS_NEW } from "@/config/whats-new";

const h = vi.hoisted(() => ({
  record: null as null | { id: string; seenAt: number },
  backup: false,
  tax: [] as unknown[],
  refresh: false,
  feature: null as null | { id: string },
  monthly: [] as unknown[],
  taxDismissed: false,
  seen: [] as unknown[][],
  tracked: [] as unknown[][],
  held: undefined as unknown,
}));

vi.mock("../local-storage", async (orig) => ({
  ...(await orig<typeof import("../local-storage")>()),
  readNoticeSeen: () => h.record,
  markNoticeSeen: (id: string) => { h.record = { id, seenAt: Date.now() }; }, // 실제 쓰기 경로(markWhatsNewSeen)가 만든 기록을 판정에 그대로 사용
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
vi.mock("../asset/asset-refresh-status", async (orig) => ({
  ...(await orig<typeof import("../asset/asset-refresh-status")>()),
  shouldShowRefreshNudge: (o: { held?: unknown }) => { h.held = o.held; return h.refresh; },
  getStaleCategories: () => ["stock"],
}));
vi.mock("../feature-usage", () => ({ pickRecommendedFeature: () => h.feature }));
vi.mock("../asset/snapshot-storage", () => ({ readMonthlySnapshots: () => h.monthly }));

import { pickHomeTip } from "../home-tip";
import { markWhatsNewSeen, newBadgeIds } from "../whats-new";
import { PARAM_VALUES } from "../analytics/ga";

const assetData = { lastUpdated: "2026-11-01T00:00:00.000Z" } as AssetData;
const snap = (month: string, date: string): MonthlyAssetSnapshot => ({ month, date, netAsset: 1, financialAsset: 1 });
const TWO = [snap("2026-09", "2026-09-28"), snap("2026-10", "2026-10-28")];
const tax = (month: number, dueLabel: string) => ({ event: { id: `t${month}${dueLabel}`, month, dueLabel, severity: "high" }, reasons: ["x"] });
const pick = (today?: string, hasAssets = true) => pickHomeTip({ assetData, hasAssets, syncArmed: false, today });
const pickWn = (today?: string, hasAssets = true, hasRelink = false) => pickHomeTip({ assetData, hasAssets, syncArmed: false, today, whatsNewOk: true, hasRelink });
const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  Object.assign(h, { record: null, backup: false, tax: [], refresh: false, feature: null, monthly: TWO, taxDismissed: false, seen: [], tracked: [] });
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

describe("우선순위: 백업 > 임박 세금 > 결산 > 새 소식 > relink > 세금 > 최신화 > 기능", () => {
  it("5. 백업·임박 세금이 결산보다 먼저", () => {
    h.backup = true;
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

describe("최신화 팁 보유 자산군만(#99 p2-1)", () => {
  it("7. 보유 자산군만 held로 넘기고, 오래된 게 미보유뿐이라 refresh가 꺼지면 기능 팁으로 이어진다", () => {
    h.feature = { id: "f" };
    const stocksOnly = { ...assetData, stocks: [{}], crypto: [], cash: [], loans: [] } as unknown as AssetData;
    const tip = pickHomeTip({ assetData: stocksOnly, hasAssets: true, syncArmed: false, today: "2026-11-15" });
    expect(h.held).toEqual(["stock"]);
    expect(tip?.kind).toBe("feature");
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

describe("새 소식 팁(#159) 우선순위·조건", () => {
  it("기록 없음 + 자산 있음 → whats_new(시드 전부, 맨 위 항목 제목)", () => {
    const t = pickWn("2026-11-15");
    expect(t).toMatchObject({ kind: "whats_new", count: WHATS_NEW.length, title: "합친 평단을 가격 흐름 위에서 봐요" });
  });
  it("whatsNewOk가 없으면(체험·잠금·로드 전) 뜨지 않는다", () => {
    expect(pick("2026-11-15")).toBeNull();
  });
  it("자산 0건이면 뜨지 않는다", () => {
    expect(pickWn("2026-11-15", false)).toBeNull();
  });
  it("결산 창 안(결산 팁 뜸)이면 결산이 먼저, 창 밖이면 새 소식(C82)", () => {
    expect(pickWn("2026-11-27")?.kind).toBe("settlement");
    expect(pickWn("2026-12-10")?.kind).toBe("settlement");
    expect(pickWn("2026-11-26")?.kind).toBe("whats_new");
    expect(pickWn("2026-12-11")?.kind).toBe("whats_new");
  });
  it("결산 창이어도 결산 팁이 없으면(스냅샷 없음) 새 소식", () => {
    h.monthly = [];
    expect(pickWn("2026-11-27")?.kind).toBe("whats_new");
  });
  it("백업·임박 세금이 새 소식보다 먼저", () => {
    h.backup = true;
    expect(pickWn("2026-11-15")?.kind).toBe("backup");
    h.backup = false; h.tax = [tax(11, "~11/18")];
    expect(pickWn("2026-11-15")?.kind).toBe("tax");
  });
  it("relink·비임박 세금·최신화·기능보다 새 소식이 먼저, 읽은 뒤엔 relink", () => {
    h.tax = [tax(12, "12/31")]; h.refresh = true; h.feature = { id: "f" };
    expect(pickWn("2026-11-15", true, true)?.kind).toBe("whats_new");
    markWhatsNewSeen(); // 실제 쓰기 경로
    expect(h.record?.id).toBe("20261111-12"); // 같은 날 NN 최대값이 최신(D1)
    expect(pickWn("2026-11-15", true, true)?.kind).toBe("relink");
  });
  it("7일 경계: 6일 23시간 59분 전 읽음은 없음, 7일 정각이면 새 항목 1개만 안 본 것", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T00:00:00Z"));
    const now = Date.now();
    h.record = { id: "20261111-07", seenAt: now - 7 * DAY + 60_000 };
    expect(pickWn("2026-11-15")).toBeNull();
    h.record = { id: "20261111-07", seenAt: now - 7 * DAY };
    expect(pickWn("2026-11-15")).toMatchObject({ kind: "whats_new", count: WHATS_NEW.length - 7, title: "작은 비중 표시·억 단위 반올림 등을 고쳤어요" });
  });
  it("읽음 처리(실제 쓰기) 뒤 시트 재열기 '새' 0, 8일 후에도 팁 없음(D1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-12T00:00:00Z"));
    expect(newBadgeIds(undefined, null, "2026-11-12").size).toBe(WHATS_NEW.length); // 팁 N과 같은 개수
    markWhatsNewSeen();
    expect(newBadgeIds(undefined, h.record, "2026-11-12").size).toBe(0);
    vi.setSystemTime(new Date("2026-11-20T00:00:00Z"));
    expect(pickWn("2026-11-20")).toBeNull();
  });
  it("홈 팁 X·클릭 배선(grep): X = 읽음 + home_tip close, 클릭 = 시트 열기 이벤트, 강제 노출 분기·notice 잔존 0", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/home/home-tip-box.tsx"), "utf8");
    const close = src.slice(src.indexOf("const close ="), src.indexOf("const activate ="));
    expect(close).toContain('if (tip.kind === "whats_new") markWhatsNewSeen();');
    expect(close).toContain('track("feature_use", { category: "home_tip", method: "close" })');
    expect(src).toContain('dispatchOpenWhatsNew("home_tip")');
    expect(src).toContain("if (!isDataLoaded) return;");
    expect(src).not.toMatch(/NOTICE_SHOWN_SESSION_KEY|isNoticeUnseen|markCurrentNoticeSeen|"notice"/);
  });
});

describe("노출 GA 중복 방지 키(#4.36 qa R2)", () => {
  it("같은 종류·같은 결산 월은 같은 키, 달·기능이 다르면 다른 키", async () => {
    const { homeTipViewKey } = await import("@/app/(main)/_components/views/home/home-tip-box");
    const s = (month: string) => ({ kind: "settlement", window: { month }, today: "2026-11-05" }) as unknown as Parameters<typeof homeTipViewKey>[0];
    expect(homeTipViewKey(s("2026-10"))).toBe(homeTipViewKey(s("2026-10")));
    expect(homeTipViewKey(s("2026-10"))).not.toBe(homeTipViewKey(s("2026-11")));
    const f = (id: string) => ({ kind: "feature", feature: { id } }) as unknown as Parameters<typeof homeTipViewKey>[0];
    expect(homeTipViewKey(f("a"))).not.toBe(homeTipViewKey(f("b")));
    expect(homeTipViewKey({ kind: "whats_new", count: 1, title: "t" })).toBe("whats_new");
  });
  it("effect의 view 전송은 ref 키가 바뀔 때만(grep)", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/home/home-tip-box.tsx"), "utf8");
    expect(src.match(/method: "view"/g)?.length).toBe(1);
    expect(src).toMatch(/if \(lastViewKey\.current !== key\) \{\s*lastViewKey\.current = key;\s*track\("feature_use", \{ category: "home_tip", method: "view" \}\);/);
  });
});

describe("끊긴 거래 다시 잇기 팁(#147) — 결산 창 아래, 세금·최신화·기능 위", () => {
  const withRelink = (today?: string) => pickHomeTip({ assetData, hasAssets: true, syncArmed: false, today, hasRelink: true });
  it("결산 창이 아니면 relink가 세금(비임박)·최신화·기능보다 먼저", () => {
    h.tax = [tax(12, "12/31")]; h.refresh = true; h.feature = { id: "f" };
    expect(withRelink("2026-11-12")?.kind).toBe("relink");
    expect(pick("2026-11-12")?.kind).not.toBe("relink"); // hasRelink 없으면 기존 순서 그대로
  });
  it("결산 창 날짜(11/27)에는 결산 팁이 먼저 — relink가 가리지 않는다", () => {
    expect(withRelink("2026-11-27")?.kind).toBe("settlement");
  });
  it("백업·임박 세금은 relink보다 위", () => {
    h.backup = true;
    expect(withRelink("2026-11-12")?.kind).toBe("backup");
  });
});
