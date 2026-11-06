// #59 체험 모드 가드 — GA no-op·trackThenNavigate·동기화/백그라운드 차단·숨김 목록·인라인 GA 플래그(정적 검사).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { track, trackScreen, trackThenNavigate, NAVIGATE_TRACK_TIMEOUT_MS, __resetGaStateForTest } from "@/lib/analytics/ga";
import { __resetTrialModeForTest, markTrialActive } from "@/lib/trial/trial-mode";
import { isCloudSyncEnabled } from "@/lib/cloud-sync/config";
import { isBackgroundWorkBlocked } from "@/lib/pwa/background-gate";

let gtag: ReturnType<typeof vi.fn>;
const store = new Map<string, string>();
const ls = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

beforeEach(() => {
  __resetTrialModeForTest();
  __resetGaStateForTest();
  store.clear();
  gtag = vi.fn();
  vi.stubGlobal("localStorage", ls);
  vi.stubGlobal("window", { gtag, location: { origin: "https://secretasset.test" } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  __resetTrialModeForTest();
});

describe("GA 체험 중 no-op", () => {
  it("체험 아님: 기존대로 전송", () => {
    track("settlement_view", { result: "settled" });
    trackScreen("activity:report");
    expect(gtag).toHaveBeenCalledTimes(2);
  });
  it("체험 중: track·trackScreen 호출 0(settlement_view·page_view 포함)", () => {
    markTrialActive();
    track("settlement_view", { result: "settled" });
    track("feature_use", { category: "xray" });
    trackScreen("home");
    trackScreen("activity:report");
    expect(gtag).not.toHaveBeenCalled();
  });
});

describe("trackThenNavigate", () => {
  it("event_callback이 오면 그때 1회 이동(타임아웃이 와도 중복 없음)", () => {
    vi.useFakeTimers();
    const nav = vi.fn();
    trackThenNavigate("feature_use", { category: "xray" }, "/?trial=1", nav);
    expect(gtag).toHaveBeenCalledTimes(1);
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("feature_use");
    expect(payload.page_title).toBe("X-Ray");
    expect(payload).not.toHaveProperty("category");
    expect(payload.event_timeout).toBe(NAVIGATE_TRACK_TIMEOUT_MS);
    expect(nav).not.toHaveBeenCalled();
    payload.event_callback();
    vi.advanceTimersByTime(1000);
    expect(nav).toHaveBeenCalledTimes(1);
    expect(nav).toHaveBeenCalledWith("/?trial=1");
  });
  it("callback이 없으면 300ms 뒤 이동", () => {
    vi.useFakeTimers();
    const nav = vi.fn();
    trackThenNavigate("feature_use", { category: "xray" }, "/?trial=1", nav);
    vi.advanceTimersByTime(NAVIGATE_TRACK_TIMEOUT_MS - 1);
    expect(nav).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(nav).toHaveBeenCalledTimes(1);
  });
  it("gtag 없으면 즉시 이동, 체험 중이면 전송 없이 즉시 이동", () => {
    const nav = vi.fn();
    vi.stubGlobal("window", { location: { origin: "https://secretasset.test" } });
    trackThenNavigate("feature_use", { category: "xray" }, "/x", nav);
    expect(nav).toHaveBeenCalledTimes(1);
    vi.stubGlobal("window", { gtag, location: { origin: "https://secretasset.test" } });
    markTrialActive();
    trackThenNavigate("feature_use", { category: "xray" }, "/y", nav);
    expect(gtag).not.toHaveBeenCalled();
    expect(nav).toHaveBeenLastCalledWith("/y");
  });
});

describe("체험 GA 값(진입·시작 2값)", () => {
  it("feature_use{category: demo}·onboarding_action{method: trial_start} page_title", () => {
    track("feature_use", { category: "demo" });
    track("onboarding_action", { method: "trial_start" });
    expect(gtag.mock.calls.map((c) => [c[1], c[2].page_title])).toEqual([
      ["feature_use", "체험 모드"],
      ["onboarding_action", "웰컴"],
    ]);
  });
});

describe("동기화·백그라운드 차단", () => {
  it("체험 중 isCloudSyncEnabled=false, isBackgroundWorkBlocked=true", () => {
    vi.stubEnv("NEXT_PUBLIC_VERCEL_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_CLOUD_SYNC", "on");
    expect(isCloudSyncEnabled()).toBe(true);
    expect(isBackgroundWorkBlocked()).toBe(false);
    markTrialActive();
    expect(isCloudSyncEnabled()).toBe(false);
    expect(isBackgroundWorkBlocked()).toBe(true);
  });
});

describe("정적 검사 — 숨김 목록·인라인 GA 플래그", () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, "../..", rel), "utf8");
  it("루트 layout 인라인 GA 스크립트: trial=1이면 ga-disable", () => {
    expect(read("app/layout.tsx")).toContain("if (params.get('trial') === '1') window['ga-disable-' + GA_ID] = true;");
  });
  it("FAB·상단 더보기/설치·하단 update/more 가드", () => {
    expect(read("app/(main)/page.tsx")).toContain("{!isTrialMode() && <FloatingAddButton />}");
    const top = read("app/(main)/_components/header-menu/top-bar.tsx");
    expect(top).toContain('const showMore = view.type === "home" && !isWelcomeGuide && !trial;');
    expect(top).toContain("const showInstall = !trial;");
    expect(read("app/(main)/_components/pwa/bottom-nav.tsx")).toContain('NAV_ITEMS.filter(({ id }) => id !== "update" && id !== "more")');
  });
  it("인앱 게이트에 isTrialMode() 전달", () => {
    expect(read("app/(main)/_components/pwa/in-app-browser-gate.tsx")).toContain("resolveInAppGate({ isTrial: isTrialMode(),");
  });
});
