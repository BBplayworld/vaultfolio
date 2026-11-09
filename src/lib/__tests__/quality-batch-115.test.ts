// #115 품질 정돈 묶음 2 — (A) 홈 팁 유지 keepShown, (B) 손익 0 헬퍼, (C) 되돌린 맞추기 원복, (D·E) 정적 배선
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const h = vi.hoisted(() => ({
  backup: false,
  refresh: false,
  monthly: [] as unknown[],
  backupOpts: [] as unknown[],
  refreshOpts: [] as unknown[],
}));

vi.mock("@/app/(main)/_components/layout/onboarding/notice", () => ({ NOTICE_ID: "n1" }));
vi.mock("../local-storage", async (orig) => ({
  ...(await orig<typeof import("../local-storage")>()),
  readNoticeSeenId: () => "n1",
}));
// 실제 구현처럼 keepShown이면 '오늘 노출' 검사를 건너뛴다: shownToday=true 상황을 모사
vi.mock("../asset/backup-status", () => ({
  shouldShowBackupNudge: (o: { keepShown?: boolean }) => { h.backupOpts.push(o); return h.backup && (o.keepShown === true); },
  daysSinceBackup: () => 30,
}));
vi.mock("../tax-utils", async (orig) => ({
  ...(await orig<typeof import("../tax-utils")>()),
  isTaxNoticeDismissed: () => true,
  getAssetDrivenHighlights: () => [],
}));
vi.mock("../asset/asset-refresh-status", async (orig) => ({
  ...(await orig<typeof import("../asset/asset-refresh-status")>()),
  shouldShowRefreshNudge: (o: { keepShown?: boolean }) => { h.refreshOpts.push(o); return h.refresh && (o.keepShown === true); },
  getStaleCategories: () => ["stock"],
}));
vi.mock("../feature-usage", () => ({ pickRecommendedFeature: () => null }));
vi.mock("../asset/snapshot-storage", () => ({ readMonthlySnapshots: () => h.monthly }));

import { pickHomeTip } from "../home-tip";
import { profitTone } from "@/app/(main)/_components/views/detail/detail-summary-header";
import { getProfitLossColor } from "@/config/theme";
import { lastRefreshedAt, markCategoryRefreshed, restoreCategoryRefreshed } from "../asset/asset-refresh-status";
import { shouldNotifyResyncClose } from "../asset/resync-return";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const assetData = { lastUpdated: "2026-11-01T00:00:00.000Z" } as AssetData;
const snap = (month: string, date: string): MonthlyAssetSnapshot => ({ month, date, netAsset: 1, financialAsset: 1 });
const TWO = [snap("2026-09", "2026-09-28"), snap("2026-10", "2026-10-28")];
const pick = (today: string, keepShown?: "backup" | "refresh") => pickHomeTip({ assetData, hasAssets: true, syncArmed: false, today, keepShown });

describe("A. keepShown", () => {
  beforeEach(() => { Object.assign(h, { backup: false, refresh: false, monthly: TWO, backupOpts: [], refreshOpts: [] }); });

  it("미지정이면 '오늘 노출' 검사를 그대로 건너뛰지 않는다(현행)", () => {
    h.backup = true; h.refresh = true;
    expect(pick("2026-11-15")).toBeNull(); // 모사: 오늘 이미 노출 → 둘 다 false
    expect(h.backupOpts.every((o) => (o as { keepShown: boolean }).keepShown === false)).toBe(true);
    expect(h.refreshOpts.every((o) => (o as { keepShown: boolean }).keepShown === false)).toBe(true);
  });
  it("keepShown=backup이면 백업 팁이, refresh면 최신화 팁이 유지된다", () => {
    h.backup = true;
    expect(pick("2026-11-15", "backup")?.kind).toBe("backup");
    h.backup = false; h.refresh = true;
    expect(pick("2026-11-15", "refresh")?.kind).toBe("refresh");
  });
  it("승자가 아닌 종류에는 적용하지 않는다", () => {
    h.refresh = true;
    expect(pick("2026-11-15", "backup")).toBeNull(); // backup 유지 요청이지만 refresh는 keepShown=false
  });
  it("결산 판정은 keepShown 유무·결산 창 안/밖과 무관하게 같다", () => {
    for (const today of ["2026-11-27", "2026-11-10", "2026-11-15", "2026-11-11"]) {
      const base = pick(today);
      for (const k of [undefined, "backup", "refresh"] as const) {
        expect(pick(today, k)?.kind === "settlement").toBe(base?.kind === "settlement");
      }
    }
  });
  it("결산 창 안에서 백업 팁이 유지되면 결산보다 우선(원래 우선순위)이고, 유지가 없으면 결산", () => {
    h.backup = true;
    expect(pick("2026-11-27", "backup")?.kind).toBe("backup");
    expect(pick("2026-11-27")?.kind).toBe("settlement");
  });
  it("shouldShow*Nudge는 선택 옵션 keepShown만 추가했다(정적)", () => {
    expect(read("lib/asset/backup-status.ts")).toContain("!opts.keepShown && readBackupMeta().nudgeShownOn === todayStr()");
    expect(read("lib/asset/asset-refresh-status.ts")).toContain("!opts.keepShown && readMeta().nudgeShownOn === todayStr()");
  });
});

describe("B. profitTone", () => {
  it("금액 반올림 0이면 회색·부호 없음·-0 방지", () => {
    for (const v of [0, 0.4, -0.4]) {
      const t = profitTone(v, v === 0 ? 0 : -0.0001);
      expect(t.isZero).toBe(true);
      expect(t.sign).toBe("");
      expect(t.colorClass).toBe("text-muted-foreground");
      expect(Object.is(t.amount, 0)).toBe(true);
      expect(t.rate.toFixed(1)).toBe("0.0");
    }
  });
  it("±1원 이상은 현행 색·부호", () => {
    const up = profitTone(1, 0.04), down = profitTone(-1, -0.04);
    expect(up).toMatchObject({ isZero: false, sign: "+", colorClass: getProfitLossColor(1) });
    expect(up.rate).toBe(0.04); // 수익률만 0.0%로 반올림되는 경우는 현행 유지
    expect(down).toMatchObject({ isZero: false, sign: "", colorClass: getProfitLossColor(-1) });
  });
  it("수익률 값 자체 판정(digits=1): 0.04%는 0, 0.05%는 +0.1%", () => {
    expect(profitTone(0.04, 0.04, 1).isZero).toBe(true);
    expect(profitTone(0.06, 0.06, 1)).toMatchObject({ isZero: false, sign: "+" });
    expect(profitTone(-5, -5, 1).sign).toBe("");
  });
  it("theme.ts는 헬퍼를 알지 못한다(공용 불변): 상세 전용 위치", () => {
    expect(read("config/theme.ts")).not.toContain("profitTone");
    expect(read("app/(main)/_components/views/detail/detail-summary-header.tsx")).toContain("export function profitTone");
  });
  it("10곳 적용: 카드 행에 직접 getProfitLossColor가 남지 않는다(상세 탭·허브)", () => {
    const tabs = ["crypto-tab", "real-estate-tab", "physical-tab"].map((n) => read(`app/(main)/_components/views/detail/tabs/${n}.tsx`));
    for (const t of tabs) expect(t).not.toContain("getProfitLossColor");
    expect(read("app/(main)/_components/views/detail/detail-hub.tsx")).not.toContain("getProfitLossColor");
    const stock = read("app/(main)/_components/views/detail/tabs/stock-tab.tsx");
    expect(stock.match(/getProfitLossColor\(/g)).toHaveLength(3); // 환차손익(:141·:666)·등락 칩(:274)만 남는다
  });
});

describe("C. 되돌린 맞추기 원복", () => {
  const store = new Map<string, string>();
  const events: unknown[] = [];
  beforeEach(() => {
    store.clear(); events.length = 0;
    vi.stubGlobal("window", { dispatchEvent: (e: Event) => { events.push(e.type); return true; } });
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-09T03:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
  const meta = () => JSON.parse(store.get("secretasset_asset_refresh") ?? "{}") as { categories?: Record<string, string>; nudgeShownOn?: string };
  const apply = (kind: "stock" | "crypto" = "stock") => {
    const prev = lastRefreshedAt(kind);
    vi.advanceTimersByTime(1000);
    const appliedAt = markCategoryRefreshed(kind, { notify: false });
    return { prev, appliedAt, kind, done: false };
  };

  it("① 결과 화면 되돌리기 → 닫기: 원복 + 복귀 신호 없음", () => {
    store.set("secretasset_asset_refresh", JSON.stringify({ categories: { stock: "2026-10-01T00:00:00.000Z" }, nudgeShownOn: "2026-11-09" }));
    const u = apply();
    expect(restoreCategoryRefreshed(u.kind, u.prev, u.appliedAt)).toBe(true);
    u.done = true;
    expect(meta().categories?.stock).toBe("2026-10-01T00:00:00.000Z");
    expect(shouldNotifyResyncClose("result", u)).toBe(false);
    expect(events).toEqual([]);
  });
  it("② 닫은 뒤 토스트 되돌리기: 같은 사본으로 원복", () => {
    const u = apply();
    expect(shouldNotifyResyncClose("result", u)).toBe(true); // 닫을 때는 신호
    expect(restoreCategoryRefreshed(u.kind, u.prev, u.appliedAt)).toBe(true);
    expect(meta().categories?.stock).toBeUndefined();
  });
  it("③ 되돌리기 실패(done 복구): 원복 호출 없음·신호 있음", () => {
    const u = apply();
    const before = meta().categories?.stock;
    u.done = false; // 실패 시 복구
    expect(shouldNotifyResyncClose("result", u)).toBe(true);
    expect(meta().categories?.stock).toBe(before);
  });
  it("④ 이전 값 null: 그 자산군 키만 삭제, nudgeShownOn·다른 자산군 보존", () => {
    store.set("secretasset_asset_refresh", JSON.stringify({ categories: { crypto: "2026-10-05T00:00:00.000Z" }, nudgeShownOn: "2026-11-09" }));
    const u = apply("stock");
    expect(u.prev).toBeNull();
    expect(restoreCategoryRefreshed("stock", null, u.appliedAt)).toBe(true);
    expect(meta()).toEqual({ categories: { crypto: "2026-10-05T00:00:00.000Z" }, nudgeShownOn: "2026-11-09" });
  });
  it("appliedAt 불일치(그 사이 다시 맞춤)면 원복하지 않는다", () => {
    const u = apply();
    vi.advanceTimersByTime(5000);
    const later = markCategoryRefreshed("stock", { notify: false });
    expect(restoreCategoryRefreshed("stock", u.prev, u.appliedAt)).toBe(false);
    expect(meta().categories?.stock).toBe(later);
  });
  it("결과 화면이 아니거나 사본이 없으면 신호 없음", () => {
    expect(shouldNotifyResyncClose("preview", { done: false })).toBe(false);
    expect(shouldNotifyResyncClose("result", null)).toBe(false);
  });
  it("saveData 경로·새 저장 키 변경 없음(정적): 원복은 refresh 메타 키만", () => {
    const src = read("lib/asset/asset-refresh-status.ts");
    expect(src.match(/STORAGE_KEYS\.\w+/g)?.every((k) => k === "STORAGE_KEYS.assetRefresh")).toBe(true);
    const dlg = read("app/(main)/_components/forms/asset-update/screenshot/holdings-resync-dialog.tsx");
    expect(dlg).toContain("restoreCategoryRefreshed(u.kind, u.prevRefreshedAt, u.appliedAt)");
    expect(dlg).toContain("shouldNotifyResyncClose(step, u)");
  });
});

describe("D·E. 정적 배선", () => {
  it("D: FAB 시트만 onCloseAutoFocus, 방법 선택 플래그는 복귀 생략", () => {
    const fab = read("app/(main)/_components/layout/floating/floating-add-button.tsx");
    expect(fab).toContain("onCloseAutoFocus={restoreSheetFocus}");
    expect(fab.match(/handoffRef\.current = true/g)).toHaveLength(3);
    expect(fab).toContain("restoreFocusAfterDialog(openerRef.current, { skipIfOtherDialog: true })");
    expect(read("lib/restore-focus.ts").indexOf("findVisibleFab()")).toBeLessThan(read("lib/restore-focus.ts").indexOf("connected"));
  });
  it("E: 도움말 <p>에 break-keep text-pretty", () => {
    for (const f of ["cash-tx-input", "loan-tx-input"]) {
      const t = read(`app/(main)/_components/forms/asset-update/input/${f}.tsx`);
      expect(t).toMatch(/data-testid="tx-help"[^>]*break-keep text-pretty[^>]*>해제 시 기록만 남기고 잔액은 변경하지 않습니다 \(과거 소급용\)/);
    }
  });
});
