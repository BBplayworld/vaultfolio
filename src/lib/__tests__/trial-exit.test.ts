// #249 체험 → 복귀 웰컴 전달값: 허용 목록·1회 소비·GA 꼬리·체험 중 gtag 0건·저장 키 무변경(정적 검사).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { resolveTrialExit, writeTrialExit, consumeTrialExit } from "@/lib/trial/trial-exit";
import { TRIAL_EXIT_FROM_KEY, TRIAL_EXIT_KEY, __resetTrialModeForTest, markTrialActive } from "@/lib/trial/trial-mode";
import { featureTitleOf, track, __resetGaStateForTest } from "@/lib/analytics/ga";
import { STORAGE_KEYS } from "@/lib/local-storage";

const fakeStorage = () => {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

describe("resolveTrialExit — 화면 키 허용 목록(spec 3-2)", () => {
  it.each([
    ["detail:stocks", "stock", { asset_type: "stock" }],
    ["detail:stocks-xray", "stock", { asset_type: "stock" }],
    ["detail:stocks-trades", "stock", { asset_type: "stock" }],
    ["detail:stocks-item", "stock", { asset_type: "stock" }],
    ["detail:crypto", "crypto", { asset_type: "crypto" }],
    ["detail:crypto-transactions", "crypto", { asset_type: "crypto" }],
    ["detail:cash", "cash", { asset_type: "cash" }],
    ["detail:cash-transactions", "cash", { asset_type: "cash" }],
    ["detail:loans", "loan", { asset_type: "loan" }],
    ["detail:loan-transactions", "loan", { asset_type: "loan" }],
    ["detail:real-estate", "real-estate", { asset_type: "real_estate" }],
    ["detail:physical", null, { asset_type: "physical" }],
    ["activity:hub", null, { source: "activity" }],
    ["activity:change", null, { source: "activity" }],
    ["activity:change-market", null, { source: "activity" }],
    ["activity:dividend", null, { source: "activity" }],
    ["activity:report", null, { source: "activity" }],
    ["detail:hub", null, { source: "detail" }],
    ["tax", null, { source: "detail" }],
  ])("%s → 등록 칸 %s", (key, asset, ga) => {
    expect(resolveTrialExit(key)).toEqual({ asset, ga });
  });
  it.each(["home", "more", "settings", "", "detail:foo", "constructor", "__proto__", "toString", "hasOwnProperty", " detail:stocks", "DETAIL:STOCKS"])(
    "%j → 없음(현행)",
    (key) => expect(resolveTrialExit(key)).toEqual({ asset: null, ga: null }),
  );
  it.each([null, undefined, 1, {}, []])("문자열 아님 %j → 없음", (v) => {
    expect(resolveTrialExit(v)).toEqual({ asset: null, ga: null });
  });
});

describe("전달값 쓰기·1회 소비(spec 3-1, 3-3)", () => {
  it("쓰기: 화면 키 + trial_exit=1, 2개 키뿐", () => {
    const s = fakeStorage();
    writeTrialExit(s, "detail:stocks-item");
    expect(Object.fromEntries(s.m)).toEqual({ [TRIAL_EXIT_FROM_KEY]: "detail:stocks-item", [TRIAL_EXIT_KEY]: "1" });
  });
  it("복귀: 두 키를 함께 지우고 값 반환, 두 번째 읽기는 복귀 아님(새로고침 재전송 0)", () => {
    const s = fakeStorage();
    writeTrialExit(s, "detail:cash");
    expect(consumeTrialExit(s)).toEqual({ returned: true, from: "detail:cash" });
    expect(s.m.size).toBe(0);
    expect(consumeTrialExit(s)).toEqual({ returned: false, from: null });
  });
  it("trial_exit=1만(둘째 값 쓰기 실패·옛 번들) → 복귀, 값 없음", () => {
    const s = fakeStorage();
    s.setItem(TRIAL_EXIT_KEY, "1");
    expect(consumeTrialExit(s)).toEqual({ returned: true, from: null });
  });
  it("둘째 값만 남음 → 읽지 않고 삭제, 복귀 아님", () => {
    const s = fakeStorage();
    s.setItem(TRIAL_EXIT_FROM_KEY, "detail:stocks");
    const get = vi.spyOn(s, "getItem");
    expect(consumeTrialExit(s)).toEqual({ returned: false, from: null });
    expect(get).not.toHaveBeenCalledWith(TRIAL_EXIT_FROM_KEY);
    expect(s.m.size).toBe(0);
  });
  it("저장소 예외 → 복귀 아님(현행 catch)", () => {
    const bad = { getItem: () => { throw new Error("x"); }, setItem: () => {}, removeItem: () => {} };
    expect(consumeTrialExit(bad)).toEqual({ returned: false, from: null });
  });
  it("둘째 키는 STORAGE_KEYS 밖, 상수는 trial-mode.ts(조건 7)", () => {
    expect(Object.values(STORAGE_KEYS)).not.toContain(TRIAL_EXIT_FROM_KEY);
    const src = readFileSync(path.resolve(__dirname, "../trial/trial-mode.ts"), "utf8");
    expect(src).toContain('export const TRIAL_EXIT_FROM_KEY = "trial_exit_from";');
  });
});

describe("GA title 꼬리(spec 5절, AC-8)", () => {
  const title = (p: object) => featureTitleOf("onboarding_action", { method: "trial_start", ...p }, "home");
  it("꼬리 없음 = 웰컴·체험(현행)", () => expect(title({})).toBe("웰컴·체험"));
  it.each([
    [{ asset_type: "stock" }, "웰컴·체험·주식"],
    [{ asset_type: "crypto" }, "웰컴·체험·암호화폐"],
    [{ asset_type: "cash" }, "웰컴·체험·현금"],
    [{ asset_type: "loan" }, "웰컴·체험·대출"],
    [{ asset_type: "real_estate" }, "웰컴·체험·부동산"],
    [{ asset_type: "physical" }, "웰컴·체험·실물 자산"],
    [{ source: "activity" }, "웰컴·체험·성과"],
    [{ source: "detail" }, "웰컴·체험·상세"],
  ])("%j → %s", (p, t) => expect(title(p)).toBe(t));
  it("허용 목록 전 값의 GA 인자가 8종 title 안에 든다", () => {
    const keys = ["detail:stocks", "detail:crypto", "detail:cash", "detail:loans", "detail:real-estate", "detail:physical", "activity:report", "tax"];
    const titles = new Set(keys.map((k) => title(resolveTrialExit(k).ga!)));
    expect(titles.size).toBe(8);
  });
  it("다른 method는 꼬리 인자가 와도 기존 title 그대로", () => {
    expect(featureTitleOf("onboarding_action", { method: "wizard", source: "activity" }, "home")).toBe("웰컴·스크린샷 등록");
    expect(featureTitleOf("onboarding_action", { method: "manual", asset_type: "stock" }, "home")).toBe("웰컴·직접 입력");
  });
});

describe("체험 중 gtag 0건(AC-10)", () => {
  let gtag: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    __resetTrialModeForTest();
    __resetGaStateForTest();
    gtag = vi.fn();
    vi.stubGlobal("window", { gtag, location: { origin: "https://secretasset.test" } });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    __resetTrialModeForTest();
  });
  it("체험 아님: 복귀 2건 전송(웰컴·체험 → 웰컴·체험·주식)", () => {
    track("onboarding_action", { method: "trial_start" });
    track("onboarding_action", { method: "trial_start", ...resolveTrialExit("detail:stocks-item").ga! });
    expect(gtag.mock.calls.map((c) => c[2].page_title)).toEqual(["웰컴·체험", "웰컴·체험·주식"]);
    expect(gtag.mock.calls.every((c) => Object.keys(c[2]).sort().join() === "page_location,page_title")).toBe(true);
  });
  it("체험 중: 꼬리 포함 track 호출 0", () => {
    markTrialActive();
    for (const k of ["detail:stocks", "activity:change", "tax", "detail:physical"]) {
      track("onboarding_action", { method: "trial_start", ...resolveTrialExit(k).ga! });
    }
    expect(gtag).not.toHaveBeenCalled();
  });
});
