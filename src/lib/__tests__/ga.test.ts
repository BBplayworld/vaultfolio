import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import {
  track,
  trackScreen,
  trackAssetSave,
  trackParse,
  featureTitleOf,
  trackThemeMode,
  countAssets,
  toGaAssetType,
  screenPath,
  __resetGaStateForTest,
} from "@/lib/analytics/ga";
import { getFirstSave, __resetFirstSaveSignalForTest } from "@/lib/pwa/first-save-signal";
import { STORAGE_KEYS } from "@/lib/local-storage";
import { __resetTrialModeForTest, markTrialActive } from "@/lib/trial/trial-mode";

// S-4.28 GA4 래퍼 회귀(4.41 단순화) — node 환경에 window·localStorage 최소 스텁을 깔고 gtag 호출 인자를 검증한다.

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
const g = globalThis as unknown as { window?: unknown; localStorage?: Storage; sessionStorage?: Storage };

function installWindow(withGtag = true) {
  gtag = vi.fn();
  g.window = {
    location: { origin: "https://secretasset.xyz", pathname: "/", hash: "#share=share:abc_secretkey", search: "?url=x" },
    ...(withGtag ? { gtag } : {}),
  };
  g.localStorage = memoryStorage();
  g.sessionStorage = memoryStorage();
}

beforeEach(() => {
  __resetGaStateForTest();
  installWindow();
});

afterEach(() => {
  delete g.window;
  delete g.localStorage;
  delete g.sessionStorage;
});

describe("gtag 부재·예외", () => {
  it("gtag가 없으면 track·trackScreen이 예외 없이 무시된다", () => {
    installWindow(false);
    expect(() => track("asset_save", { asset_type: "stock" })).not.toThrow();
    expect(() => trackScreen("home")).not.toThrow();
  });

  it("window 자체가 없어도(SSR) 무시된다", () => {
    delete g.window;
    expect(() => track("share", { method: "save" })).not.toThrow();
  });

  it("gtag가 throw해도 호출부로 전파되지 않는다", () => {
    gtag.mockImplementation(() => { throw new Error("boom"); });
    expect(() => track("data_action", { method: "export" })).not.toThrow();
    expect(() => trackScreen("detail:stocks")).not.toThrow();
  });
});

describe("featureTitleOf 매핑", () => {
  it.each([
    ["welcome_view", {}, "웰컴"],
    ["onboarding_action", { method: "wizard" }, "웰컴"],
    ["tutorial_begin", {}, "온보딩"],
    ["tutorial_step", { step: "2" }, "온보딩"],
    ["tutorial_complete", {}, "온보딩"],
    ["wizard_step", { step: "stock" }, "온보딩"],
    ["asset_add_start", {}, "자산 추가 시작"],
    ["asset_add_start", { asset_type: "stock", method: "manual" }, "자산 추가 시작·주식"],
    ["asset_save", { asset_type: "crypto" }, "자산 저장·암호화폐"],
    ["asset_save", { asset_type: "real_estate" }, "자산 저장·부동산"],
    ["first_asset_saved", { asset_type: "cash" }, "자산 저장·현금"],
    ["asset_save", { asset_type: "physical" }, "자산 저장·실물 자산"],
    ["asset_add_start", { asset_type: "physical", method: "manual" }, "자산 추가 시작·실물 자산"],
    ["first_asset_saved", { asset_type: "physical" }, "자산 저장·실물 자산"],
    ["screenshot_parse", { asset_type: "loan", result: "fail" }, "스크린샷 등록 실패·대출"],
    ["screenshot_parse", { asset_type: "stock", result: "empty" }, "스크린샷 등록 실패·주식"],
    ["screenshot_parse", { asset_type: "cash", result: "success" }, "스크린샷 등록·현금"],
    ["screenshot_parse", { asset_type: "crypto", result: "limit" }, "스크린샷 등록·암호화폐"],
    ["transaction_save", { asset_type: "stock" }, "거래 입력·주식"],
    ["share", { method: "save", content_type: "stock" }, "인증카드 저장"],
    ["share", { method: "copy" }, "공유"],
    ["share", { method: "link" }, "공유"],
    ["share_restore", { result: "success" }, "공유"],
    ["sync_action", { method: "push" }, "기기 동기화"],
    ["data_action", { method: "export" }, "백업"],
    ["data_action", { method: "import" }, "백업"],
    ["data_action", { method: "clear_all" }, "데이터 관리"],
    ["pwa_install", { method: "accepted" }, "앱 설치"],
    ["settlement_view", { source: "card" }, "월 결산"],
    ["feature_use", { category: "xray" }, "X-Ray"],
    ["feature_use", { category: "tax_sim" }, "절세 시뮬레이션"],
    ["feature_use", { category: "home_tip" }, "홈 팁"],
    ["feature_use", { category: "notice" }, "홈 팁"],
    ["feature_use", { category: "feedback" }, "의견 보내기"],
    ["feature_use", { category: "theme" }, "테마 변경"],
    ["feature_use", { category: "ai_prompt" }, "AI 프롬프트 복사"],
    ["feature_use", { category: "demo" }, "체험 모드"],
    ["feature_use", { category: "share_card" }, "인증카드 열기"],
    ["feature_use", { category: "app_guide" }, "앱 가이드 열기"],
    ["feature_use", { category: "install_nudge" }, "설치 안내"],
    ["feature_use", { category: "install_nudge_tap" }, "설치 안내 누름"],
    ["feature_use", { category: "sync_overwrite_notice" }, "동기화 덮임 알림"],
    ["feature_use", { category: "sync_overwrite_undo" }, "동기화 되돌리기"],
    ["feature_use", { category: "resync_start" }, "보유 현황 맞추기 시작"],
    ["feature_use", { category: "resync_apply" }, "보유 현황 맞추기 적용"],
    ["feature_use", { category: "resync_undo" }, "보유 현황 맞추기 되돌리기"],
    ["feature_use", { category: "balance_resync" }, "잔액 맞추기 저장"],
    ["feature_use", { category: "resync_continue" }, "이어서 맞추기"],
    ["feature_use", { category: "save_failed" }, "저장 실패"],
    ["feature_use", { category: "linked_trade" }, "거래 저장·계좌 함께 반영"],
    ["theme_mode", { theme: "dark" }, "다크 모드 사용"],
    ["theme_mode", { theme: "light" }, "라이트 모드 사용"],
  ] as const)("%s %j → %s", (name, params, title) => {
    expect(featureTitleOf(name, params, "home")).toBe(title);
  });

  it("매핑 없는 이벤트·카테고리는 현재 화면 title로", () => {
    expect(featureTitleOf("asset_delete", { asset_type: "stock" }, "detail:stocks")).toBe("상세·주식");
    expect(featureTitleOf("app_lock", { method: "enable" }, "settings")).toBe("설정");
    expect(featureTitleOf("feature_use", { category: "ratio_preview" }, "ratio")).toBe("비중 미리보기");
    expect(featureTitleOf("feature_use", {}, "tax")).toBe("세금 관리");
  });

  it("화면 title도 없으면 undefined", () => {
    expect(featureTitleOf("asset_delete", {}, "unknown-screen")).toBeUndefined();
  });
});

describe("전송 payload는 page_title·page_location만", () => {
  it("track은 page_title과 page_location 외 키를 보내지 않는다(의미 인자·잡값 제거)", () => {
    track("asset_save", { asset_type: "stock", method: "manual", result: "create", ...({ amount: 1e9, nickname: "x" } as object) });
    const [cmd, name, payload] = gtag.mock.calls[0];
    expect(cmd).toBe("event");
    expect(name).toBe("asset_save");
    expect(Object.keys(payload).sort()).toEqual(["page_location", "page_title"]);
    expect(payload.page_title).toBe("자산 저장·주식");
  });

  it("매핑 없고 화면 title도 없으면 page_title을 생략한다", () => {
    trackScreen("zzz-unknown");
    gtag.mockClear();
    track("asset_delete", { asset_type: "stock" });
    expect(Object.keys(gtag.mock.calls[0][2])).toEqual(["page_location"]);
  });

  it("화면 이동 후 매핑 없는 이벤트는 그 화면 title을 붙인다", () => {
    trackScreen("detail:stocks");
    track("asset_delete", { asset_type: "stock" });
    expect(gtag.mock.calls[1][2].page_title).toBe("상세·주식");
  });

  it("사용자 속성 gtag('set') 호출은 없다", () => {
    trackScreen("home");
    track("feature_use", { category: "theme", method: "toggle" });
    expect(gtag.mock.calls.filter((c) => c[0] === "set")).toHaveLength(0);
  });
});

describe("page_location에 해시·쿼리 미포함", () => {
  it("trackScreen은 가상 경로를 보내고 화면 page_title은 기존과 동일, nav_source는 보내지 않는다", () => {
    trackScreen("detail:stocks");
    const [cmd, name, payload] = gtag.mock.calls[0];
    expect(cmd).toBe("event");
    expect(name).toBe("page_view");
    expect(payload.page_location).toBe("https://secretasset.xyz/v/detail/stocks");
    expect(payload.page_path).toBe("/v/detail/stocks");
    expect(payload.page_title).toBe("상세·주식");
    expect(payload).not.toHaveProperty("nav_source");
    expect(JSON.stringify(payload)).not.toMatch(/[#?]|secretkey|share=/);
  });

  it("종목 한 장(#157)은 상세·주식·종목 page_view 1회, 가상 경로에 종목명·티커가 없다", () => {
    trackScreen("detail:stocks-item");
    trackScreen("detail:stocks-item");
    expect(gtag).toHaveBeenCalledTimes(1);
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("page_view");
    expect(payload.page_title).toBe("상세·주식·종목");
    expect(payload.page_location).toBe("https://secretasset.xyz/v/detail/stocks-item");
    expect(JSON.stringify(payload)).not.toMatch(/005930|AAPL|삼성/);
  });

  it("화면 title 전수 불변", () => {
    const expected: Record<string, string> = {
      home: "홈", ratio: "비중 미리보기", more: "더보기", settings: "설정", tax: "세금 관리",
      "detail:hub": "상세", "detail:stocks": "상세·주식", "detail:stocks-xray": "상세·주식 X-Ray",
      "detail:stocks-trades": "상세·주식 거래내역", "detail:real-estate": "상세·부동산", "detail:crypto": "상세·암호화폐",
      "detail:crypto-transactions": "상세·암호화폐 거래내역", "detail:cash": "상세·현금", "detail:cash-transactions": "상세·현금 거래내역",
      "detail:loans": "상세·대출", "detail:loan-transactions": "상세·대출 거래내역",
      "activity:hub": "성과", "activity:change": "성과·자산 변화", "activity:change:composition": "성과·자산 변화·구성", "activity:dividend": "성과·배당", "activity:report": "성과·자산 성적표",
    };
    for (const [key, title] of Object.entries(expected)) {
      expect(featureTitleOf("asset_delete", {}, key)).toBe(title);
    }
  });

  it("일반 이벤트의 page_location도 현재 화면 가상 경로로 고정된다", () => {
    trackScreen("activity:change");
    track("share", { method: "link", content_type: "link" });
    expect(gtag.mock.calls[1][2].page_location).toBe("https://secretasset.xyz/v/activity/change");
  });

  it("구성 카드 화면은 가상 경로·title을 보내고, 매핑 없는 이벤트는 같은 title로 폴백한다", () => {
    trackScreen("activity:change:composition");
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("page_view");
    expect(payload.page_location).toBe("https://secretasset.xyz/v/activity/change/composition");
    expect(payload.page_title).toBe("성과·자산 변화·구성");
    expect(featureTitleOf("asset_delete", {}, "activity:change:composition")).toBe("성과·자산 변화·구성");
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

describe("화면 전환 page_view", () => {
  it("같은 화면 연속 호출은 1회만 보낸다", () => {
    trackScreen("home");
    trackScreen("home");
    trackScreen("detail:hub");
    trackScreen("home");
    expect(gtag.mock.calls.filter((c) => c[1] === "page_view").map((c) => c[2].page_path)).toEqual(["/v/home", "/v/detail/hub", "/v/home"]);
  });
});

describe("체험 모드", () => {
  it("체험 중에는 track·trackScreen 전송 0", () => {
    markTrialActive();
    track("feature_use", { category: "xray" });
    trackScreen("home");
    expect(gtag).not.toHaveBeenCalled();
    __resetTrialModeForTest();
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

describe("#58 실물 자산 GA — page_title·page_location만, 이름·유형 세부·금액 없음", () => {
  it("실물 저장(첫 자산)은 asset_save·first_asset_saved 모두 page_title '자산 저장·실물 자산'", () => {
    trackAssetSave({ asset_type: "physical", method: "manual", result: "create", ...({ name: "골드바", type: "gold", currentValue: 123456789 } as object) }, 0);
    expect(gtag.mock.calls.map((c) => c[1])).toEqual(["asset_save", "first_asset_saved"]);
    for (const [, , payload] of gtag.mock.calls) {
      expect(Object.keys(payload).sort()).toEqual(["page_location", "page_title"]);
      expect(payload.page_title).toBe("자산 저장·실물 자산");
      expect(JSON.stringify(payload)).not.toMatch(/골드바|gold|123456789/);
    }
  });
  it("toGaAssetType('physical')이 통과한다", () => {
    expect(toGaAssetType("physical")).toBe("physical");
  });
});

describe("건수 유틸", () => {
  it("countAssets는 보유 자산 건수만 센다", () => {
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

  it("trade 스크린샷 실패는 실패 title로 집계된다", () => {
    trackParse("trade", "fail");
    expect(gtag.mock.calls.map((c) => c[2].page_title)).toEqual(["스크린샷 등록 실패·주식"]);
    expect(Object.keys(gtag.mock.calls[0][2]).sort()).not.toContain("file_name");
  });

  it("trackParse는 거래 스크린샷을 주식·코인으로 집계해 title에 반영한다", () => {
    trackParse("trade", "success");
    trackParse("crypto-trade", "limit");
    expect(gtag.mock.calls.map((c) => [c[1], c[2].page_title])).toEqual([
      ["screenshot_parse", "스크린샷 등록·주식"],
      ["screenshot_parse", "스크린샷 등록·암호화폐"],
    ]);
  });
});

describe("#63 /ratio UTM 귀속", () => {
  const setLoc = (pathname: string, search: string) => {
    (g.window as { location: { pathname: string; search: string } }).location.pathname = pathname;
    (g.window as { location: { pathname: string; search: string } }).location.search = search;
  };
  it("/ratio에서만 허용 UTM이 page_location에 붙는다", () => {
    setLoc("/ratio", "?utm_source=threads&utm_medium=social&utm_campaign=nov&foo=1");
    trackScreen("ratio");
    expect(gtag.mock.calls.at(-1)?.[2].page_location).toBe(
      "https://secretasset.xyz/v/ratio?utm_source=threads&utm_medium=social&utm_campaign=nov",
    );
    track("feature_use", { category: "ratio_preview", method: "submit", result: "success" });
    expect(gtag.mock.calls.at(-1)?.[2].page_location).toContain("utm_source=threads");
  });
  it("/로 이동하면 UTM이 붙지 않는다", () => {
    setLoc("/", "?utm_source=threads");
    trackScreen("home");
    expect(gtag.mock.calls.at(-1)?.[2].page_location).toBe("https://secretasset.xyz/v/home");
  });
  it("/ratio의 ratio_preview 이벤트 title은 화면 title(비중 미리보기)", () => {
    trackScreen("ratio");
    track("feature_use", { category: "ratio_preview", method: "sample" });
    expect(gtag.mock.calls.at(-1)?.[2].page_title).toBe("비중 미리보기");
  });
});

describe("테마 모드 계측(#4.42)", () => {
  it("세션당 모드별 1회만 보내고 page_title만 싣는다", () => {
    trackThemeMode("dark");
    trackThemeMode("dark");
    expect(gtag).toHaveBeenCalledTimes(1);
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("theme_mode");
    expect(payload.page_title).toBe("다크 모드 사용");
    expect(Object.keys(payload).sort()).toEqual(["page_location", "page_title"]);
  });

  it("테마를 전환하면 새 모드로 1회 다시 보낸다", () => {
    trackThemeMode("dark");
    trackThemeMode("light");
    expect(gtag).toHaveBeenCalledTimes(2);
    expect(gtag.mock.calls[1][2].page_title).toBe("라이트 모드 사용");
  });

  it("체험 모드에서는 전송하지 않는다", () => {
    markTrialActive();
    try {
      trackThemeMode("dark");
      expect(gtag).not.toHaveBeenCalled();
    } finally {
      __resetTrialModeForTest();
    }
  });
});

describe("설치 안내 첫 저장 신호 (#78)", () => {
  beforeEach(() => __resetFirstSaveSignalForTest());

  it("첫 저장 판정이면 신호가 켜지고, 기존 보유·수정·플래그 있음이면 켜지지 않는다", () => {
    trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, 3);
    trackAssetSave({ asset_type: "stock", method: "manual", result: "update" }, 0);
    expect(getFirstSave()).toBe(false);
    trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, 0);
    expect(getFirstSave()).toBe(true);
    __resetFirstSaveSignalForTest();
    trackAssetSave({ asset_type: "cash", method: "manual", result: "create" }, 0); // 플래그 이미 있음
    expect(getFirstSave()).toBe(false);
  });

  it("gtag가 없어도 신호는 켜진다", () => {
    const g = (window as unknown as { gtag?: unknown }).gtag;
    (window as unknown as { gtag?: unknown }).gtag = undefined;
    trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, 0);
    expect(getFirstSave()).toBe(true);
    (window as unknown as { gtag?: unknown }).gtag = g;
  });
});

describe("화면 전환 시 직전 화면 참여 시간 귀속(#131)", () => {
  it("첫 화면은 page_view만 보낸다(직전 화면 없음)", () => {
    trackScreen("home");
    expect(gtag.mock.calls.map((c) => c[1])).toEqual(["page_view"]);
  });

  it("전환하면 직전 화면 title·경로의 screen_leave가 새 page_view보다 먼저 나간다", () => {
    trackScreen("home");
    trackScreen("detail:stocks");
    expect(gtag.mock.calls.map((c) => c[1])).toEqual(["page_view", "screen_leave", "page_view"]);
    const flush = gtag.mock.calls[1][2];
    expect(flush.page_title).toBe("홈");
    expect(flush.page_path).toBe("/v/home");
    expect(flush.page_location).toBe("https://secretasset.xyz/v/home");
    const pv = gtag.mock.calls[2][2];
    expect(pv.page_title).toBe("상세·주식");
    expect(pv.page_location).toBe("https://secretasset.xyz/v/detail/stocks");
  });

  it("같은 화면 연속 호출은 아무것도 보내지 않아 조회수가 늘지 않는다", () => {
    trackScreen("home");
    trackScreen("detail:stocks");
    trackScreen("detail:stocks");
    expect(gtag.mock.calls.filter((c) => c[1] === "page_view")).toHaveLength(2);
    expect(gtag.mock.calls.filter((c) => c[1] === "screen_leave")).toHaveLength(1);
  });

  it("해시·쿼리는 flush에도 실리지 않고 ga-debug면 debug_mode가 붙는다", () => {
    localStorage.setItem("ga-debug", "1");
    trackScreen("home");
    trackScreen("more");
    const flush = gtag.mock.calls[1][2];
    expect(JSON.stringify(flush)).not.toMatch(/[#?]|secretkey|share=/);
    expect(flush.debug_mode).toBe(true);
  });

  it("체험 모드·gtag 부재에서는 보내지 않는다", () => {
    trackScreen("home");
    gtag.mockClear();
    markTrialActive();
    trackScreen("more");
    expect(gtag).not.toHaveBeenCalled();
  });
});
