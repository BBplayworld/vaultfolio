import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  track,
  trackScreen,
  trackAssetSave,
  trackParse,
  setUserProps,
  sanitizeParams,
  countAssets,
  assetCountBucket,
  toGaAssetType,
  screenPath,
  labelOf,
  PARAM_VALUES,
  __resetGaStateForTest,
} from "@/lib/analytics/ga";
import { STORAGE_KEYS } from "@/lib/local-storage";

// S-4.28 GA4 래퍼 회귀 — node 환경에 window·localStorage 최소 스텁을 깔고 gtag 호출 인자를 검증한다.

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    key: (i) => Array.from(m.keys())[i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
}

type GtagMock = ReturnType<typeof vi.fn>;
let gtag: GtagMock;
const g = globalThis as unknown as { window?: unknown; localStorage?: Storage };

function installWindow(withGtag = true) {
  gtag = vi.fn();
  g.window = {
    location: { origin: "https://secretasset.xyz", pathname: "/", hash: "#share=share:abc_secretkey", search: "?url=x" },
    ...(withGtag ? { gtag } : {}),
  };
  g.localStorage = memoryStorage();
}

beforeEach(() => {
  __resetGaStateForTest();
  installWindow();
});

afterEach(() => {
  delete g.window;
  delete g.localStorage;
});

describe("AC1·AC4 gtag 부재·예외", () => {
  it("AC1 gtag가 없으면 track·trackScreen·setUserProps가 예외 없이 무시된다", () => {
    installWindow(false);
    expect(() => track("asset_save", { asset_type: "stock" })).not.toThrow();
    expect(() => trackScreen("home")).not.toThrow();
    expect(() => setUserProps({ app_mode: "web", asset_count_bucket: "0", sync_enabled: "n", onboarding_state: "new", theme: "dark" })).not.toThrow();
  });

  it("AC1 window 자체가 없어도(SSR) 무시된다", () => {
    delete g.window;
    expect(() => track("share", { method: "save" })).not.toThrow();
  });

  it("AC4 gtag가 throw해도 호출부로 전파되지 않는다", () => {
    gtag.mockImplementation(() => { throw new Error("boom"); });
    expect(() => track("data_action", { method: "export" })).not.toThrow();
    expect(() => trackScreen("detail:stocks")).not.toThrow();
  });
});

describe("AC2 sanitizer", () => {
  it("사전 외 키·값·비문자열은 제거하고 허용 enum만 남긴다", () => {
    const out = sanitizeParams({
      asset_type: "stock",
      method: "screenshot",
      result: "not-a-value",
      amount: 123456789,
      name: "삼성전자",
      ticker: "AAPL",
      source: { nested: true },
      step: 3,
    });
    expect(out).toEqual({ asset_type: "주식", method: "스크린샷" });
  });

  it("track 전송 파라미터에 사전 외 값이 실리지 않는다", () => {
    track("asset_save", { asset_type: "stock", method: "manual", result: "create", ...({ amount: 1e9, nickname: "x" } as object) });
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("asset_save");
    expect(payload).not.toHaveProperty("amount");
    expect(payload).not.toHaveProperty("nickname");
    expect(payload).toMatchObject({ asset_type: "주식", method: "직접 입력", result: "신규" });
  });

  it("settlement_view는 source·result 열거형만 싣고 금액·날짜는 버린다(#32)", () => {
    track("settlement_view", { source: "card", result: "settled", ...({ delta: 1e7, month: "2026-10" } as object) });
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("settlement_view");
    expect(payload).toMatchObject({ source: "결산 카드", result: "결산" });
    expect(payload).not.toHaveProperty("delta");
    expect(payload).not.toHaveProperty("month");
    expect(sanitizeParams({ source: "menu", result: "in_progress" })).toEqual({ source: "메뉴", result: "진행 중" });
    expect(sanitizeParams({ result: "first_month" })).toEqual({ result: "첫 달" });
  });
});

describe("AC3 page_location에 해시·쿼리 미포함", () => {
  it("trackScreen은 가상 경로 /v/<화면>을 보내고 URL 해시·쿼리를 쓰지 않는다", () => {
    trackScreen("detail:stocks", "initial");
    const [cmd, name, payload] = gtag.mock.calls[0];
    expect(cmd).toBe("event");
    expect(name).toBe("page_view");
    expect(payload.page_location).toBe("https://secretasset.xyz/v/detail/stocks");
    expect(payload.page_path).toBe("/v/detail/stocks");
    expect(payload.page_title).toBe("상세·주식");
    expect(payload.nav_source).toBe("첫 진입");
    expect(JSON.stringify(payload)).not.toMatch(/[#?]|secretkey|share=/);
  });

  it("일반 이벤트의 page_location도 현재 화면 가상 경로로 고정된다", () => {
    trackScreen("activity:change");
    track("share", { method: "link", content_type: "link" });
    const payload = gtag.mock.calls[1][2];
    expect(payload.page_location).toBe("https://secretasset.xyz/v/activity/change");
  });

  it("화면 키 형식이 아니면 무시한다", () => {
    trackScreen("share=abc#x");
    expect(gtag).not.toHaveBeenCalled();
  });

  it("screenPath는 콜론을 경로 구분자로 바꾼다", () => {
    expect(screenPath("home")).toBe("/v/home");
    expect(screenPath("detail:stocks-xray")).toBe("/v/detail/stocks-xray");
  });
});

describe("AC7 화면 전환 page_view", () => {
  it("같은 화면 연속 호출은 1회만 보낸다", () => {
    trackScreen("home", "initial");
    trackScreen("home", "tap");
    trackScreen("detail:hub", "tap");
    trackScreen("home", "back");
    expect(gtag.mock.calls.map((c) => c[2].page_path)).toEqual(["/v/home", "/v/detail/hub", "/v/home"]);
  });
});

describe("AC8 first_asset_saved 기기당 1회", () => {
  const names = () => gtag.mock.calls.map((c) => c[1]);

  it("저장 전 0건 + 생성이면 asset_save와 함께 first_asset_saved를 1회 보낸다", () => {
    trackAssetSave({ asset_type: "stock", method: "screenshot", result: "create" }, 0);
    expect(names()).toEqual(["asset_save", "first_asset_saved"]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.gaFlags)!)).toEqual({ firstAssetSent: true });
  });

  it("플래그가 이미 있으면 다시 0건에서 저장해도 보내지 않는다(복원·전체 삭제 후 재입력)", () => {
    trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, 0);
    trackAssetSave({ asset_type: "cash", method: "manual", result: "create" }, 0);
    expect(names().filter((n) => n === "first_asset_saved")).toHaveLength(1);
  });

  it("기존 자산이 있거나 수정이면 보내지 않는다", () => {
    trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, 3);
    trackAssetSave({ asset_type: "stock", method: "manual", result: "update" }, 0);
    expect(names()).toEqual(["asset_save", "asset_save"]);
  });
});

describe("AC10 사용자 속성", () => {
  it("값이 바뀔 때만 user_properties를 설정한다", () => {
    const p = { app_mode: "pwa", asset_count_bucket: "1", sync_enabled: "n", onboarding_state: "new", theme: "dark" } as const;
    setUserProps(p);
    setUserProps(p);
    setUserProps({ ...p, asset_count_bucket: "2-5" });
    expect(gtag.mock.calls.filter((c) => c[0] === "set")).toHaveLength(2);
    expect(gtag.mock.calls[0]).toEqual([
      "set",
      "user_properties",
      { app_mode: "PWA 앱", asset_count_bucket: "1개", sync_enabled: "미사용", onboarding_state: "신규", theme: "다크" },
    ]);
  });

  it("버킷·건수 유틸", () => {
    expect([0, 1, 2, 5, 6, 40].map(assetCountBucket)).toEqual(["0", "1", "2-5", "2-5", "6+", "6+"]);
    expect(countAssets({ stocks: [{}, {}], crypto: [{}], cash: [], loans: [{}], realEstate: [] } as never)).toBe(4);
    expect(countAssets(null)).toBe(0);
  });
});

describe("AC11 디버그 플래그", () => {
  it("ga-debug=1이면 모든 이벤트에 debug_mode:true를 붙인다", () => {
    localStorage.setItem("ga-debug", "1");
    track("feature_use", { category: "xray" });
    trackScreen("tax");
    expect(gtag.mock.calls[0][2].debug_mode).toBe(true);
    expect(gtag.mock.calls[1][2].debug_mode).toBe(true);
  });

  it("플래그가 없으면 debug_mode를 보내지 않는다", () => {
    track("feature_use", { category: "xray" });
    expect(gtag.mock.calls[0][2]).not.toHaveProperty("debug_mode");
  });
});

describe("매핑 유틸", () => {
  it("toGaAssetType은 kebab 타입을 GA 값으로, 사전 외는 undefined", () => {
    expect(toGaAssetType("real-estate")).toBe("real_estate");
    expect(toGaAssetType("yearly-net-asset")).toBe("yearly_net_asset");
    expect(toGaAssetType("stock")).toBe("stock");
    expect(toGaAssetType("unknown")).toBeUndefined();
  });

  it("trackParse는 거래 스크린샷을 주식·코인으로 집계한다", () => {
    trackParse("trade", "success");
    trackParse("crypto-trade", "limit");
    expect(gtag.mock.calls.map((c) => [c[1], c[2].asset_type, c[2].result])).toEqual([
      ["screenshot_parse", "주식", "성공"],
      ["screenshot_parse", "암호화폐", "한도 초과"],
    ]);
  });
});

describe("한국어 라벨", () => {
  it("사전의 모든 값에 비어 있지 않은 라벨이 있고 매개변수 안에서 중복되지 않는다", () => {
    for (const [key, codes] of Object.entries(PARAM_VALUES)) {
      const labels = (codes as readonly string[]).map((c) => labelOf(key as never, c as never));
      for (const l of labels) expect(typeof l === "string" && l.length > 0 && l.length <= 100).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("같은 코드도 매개변수별로 다르게 라벨링된다", () => {
    expect(labelOf("asset_type", "stock")).toBe("주식");
    expect(labelOf("content_type", "stock")).toBe("주식 카드");
    expect(labelOf("step", "stock")).toBe("주식 단계");
  });
});
