// #60 인앱 감지 보강 — 양성(Threads·다음·밴드)과 음성(일반 브라우저) UA 고정.
// 오탐은 isInAppGateActive → isBackgroundWorkBlocked(시세·환율·스냅샷 갱신 중단)로 이어지므로 음성 샘플을 실제 UA 원문 형태로 고정한다.
// 실기기 UA 미수집(C9): 양성 샘플은 알려진 UA 형태 기준 추정.
import { afterEach, describe, expect, it, vi } from "vitest";
import { detectBrowserEnv, isInAppGateActive } from "@/lib/pwa/detect-browser";

const POSITIVE: [string, string][] = [
  ["Threads iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 323.0.0.29.104 (iPhone15,2; iOS 17_4; ko_KR; ko; scale=3.00; 1179x2556; 581853397)"],
  ["Threads Android", "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 Barcelona 326.0.0.42.92 Android (34/14; 450dpi; 1080x2340; samsung; SM-S918N; dm3q; qcom; ko_KR; 590034012)"],
  ["다음 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 DaumApps/8.6.2 DaumDevice/mobile"],
  ["다음 Android", "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 DaumApps/8.6.1 DaumDevice/mobile"],
  ["밴드 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 BAND/13.4.0 (iPhone; iOS 17.4; ko_KR)"],
  ["밴드 Android", "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36 BAND/13.4.1 (Android 14; SM-S918N)"],
  // 기존 토큰 회귀
  ["카카오톡 Android", "Mozilla/5.0 (Linux; Android 14; SM-S918N Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.6367.82 Mobile Safari/537.36;KAKAOTALK 2410430"],
];

const NEGATIVE: [string, string][] = [
  ["Chrome Android", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"],
  ["Chrome iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/124.0.6367.88 Mobile/15E148 Safari/604.1"],
  ["Safari iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"],
  ["Safari iPadOS(데스크톱 위장)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15"],
  ["삼성 인터넷", "Mozilla/5.0 (Linux; Android 14; SAMSUNG SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36"],
  ["웨일 Android", "Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Whale/3.25.1.4 Mobile Safari/537.36"],
  ["웨일 iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1 Whale/3.25.1"],
  ["Edge Android", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36 EdgA/124.0.2478.64"],
  ["Edge iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 EdgiOS/124.2478.71 Mobile/15E148 Safari/605.1.15"],
  ["Firefox Android", "Mozilla/5.0 (Android 14; Mobile; rv:125.0) Gecko/125.0 Firefox/125.0"],
  ["Firefox iOS", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/125.0 Mobile/15E148 Safari/605.1.15"],
  ["Chrome 데스크톱", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"],
  ["Edge 데스크톱", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80"],
];

describe("인앱 감지 양성", () => {
  it.each(POSITIVE)("%s → isInApp=true", (_name, ua) => {
    expect(detectBrowserEnv(ua, 5).isInApp).toBe(true);
  });
});

describe("인앱 감지 음성(오탐 0)", () => {
  it.each(NEGATIVE)("%s → isInApp=false", (_name, ua) => {
    expect(detectBrowserEnv(ua, 5).isInApp).toBe(false);
  });
});

describe("isInAppGateActive — PWA standalone이면 인앱 UA여도 false", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (ua: string, standalone: boolean) => {
    vi.stubGlobal("navigator", { userAgent: ua, maxTouchPoints: 5 });
    vi.stubGlobal("window", { matchMedia: () => ({ matches: standalone }), navigator: { standalone: false } });
  };
  it("Threads + 브라우저 탭 → true", () => {
    stub(POSITIVE[0][1], false);
    expect(isInAppGateActive()).toBe(true);
  });
  it("Threads + standalone → false", () => {
    stub(POSITIVE[0][1], true);
    expect(isInAppGateActive()).toBe(false);
  });
  it("Safari + 브라우저 탭 → false", () => {
    stub(NEGATIVE[2][1], false);
    expect(isInAppGateActive()).toBe(false);
  });
});
