import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { trackAssetSave, __resetGaStateForTest } from "@/lib/analytics/ga";
import {
  getFirstSave,
  getNudgeVisible,
  setNudgeVisible,
  dismissInstallNudge,
  getDismissed,
  __resetFirstSaveSignalForTest,
} from "@/lib/pwa/first-save-signal";
import { shouldShowInstallNudge, type InstallNudgeInput } from "@/lib/pwa/install-nudge-policy";
import { readTutorialStatus } from "@/lib/local-storage";

// 실제 쓰기 경로(trackAssetSave → first-save-signal → 노출 판정) 픽스처 — 튜토리얼이 끝나지 않은 첫 저장 세션(#4.85)

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
const g = globalThis as unknown as { window?: unknown; localStorage?: Storage; sessionStorage?: Storage };

beforeEach(() => {
  __resetGaStateForTest();
  __resetFirstSaveSignalForTest();
  g.window = { location: { origin: "https://secretasset.xyz", pathname: "/", hash: "", search: "" }, gtag: () => {} };
  g.localStorage = memoryStorage();
  g.sessionStorage = memoryStorage();
});

// 마법사 저장 직후 홈: 자산 1건, 튜토리얼은 전부 pending(저장 키 형식 불변)
const homeAfterWizardSave = (): InstallNudgeInput => ({
  firstSave: getFirstSave(), dismissed: getDismissed(), trial: false, inApp: false, isMobile: true,
  isIOS: true, isInstallable: false, isHome: true, assetCount: 1, wizardOpen: false, dialogOpen: false,
});

describe("첫 저장 세션 설치 안내 1회 노출(튜토리얼 미종료)", () => {
  it("마법사 저장 → 홈: 튜토리얼 5단계가 모두 pending이어도 안내가 노출된다", () => {
    expect(Object.values(readTutorialStatus()).every((v) => v === "pending")).toBe(true);
    trackAssetSave({ asset_type: "stock", method: "screenshot", result: "create" }, 0);
    expect(getFirstSave()).toBe(true);
    expect(shouldShowInstallNudge(homeAfterWizardSave())).toBe(true);
  });

  it("닫으면(나중에·추가하기·홈 이탈) 같은 세션에 다시 노출되지 않는다", () => {
    trackAssetSave({ asset_type: "stock", method: "screenshot", result: "create" }, 0);
    dismissInstallNudge();
    expect(shouldShowInstallNudge(homeAfterWizardSave())).toBe(false);
  });

  it("두 번째 저장은 첫 저장 신호를 다시 켜지 않는다(기기당 1회)", () => {
    trackAssetSave({ asset_type: "stock", method: "manual", result: "create" }, 0);
    __resetFirstSaveSignalForTest();
    trackAssetSave({ asset_type: "cash", method: "manual", result: "create" }, 0);
    expect(getFirstSave()).toBe(false);
  });

  it("안내가 보이는 동안 튜토리얼 말풍선이 양보한다(동시 노출 방지)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/tutorial/tutorial-overlay.tsx"), "utf8");
    expect(src).toMatch(/if \(nudgeVisible\) return null;/);
    expect(getNudgeVisible()).toBe(false);
    setNudgeVisible(true);
    expect(getNudgeVisible()).toBe(true);
    setNudgeVisible(false);
    expect(getNudgeVisible()).toBe(false);
  });
});

// QA·UI 수정 클래스 계약(#4.85): 말풍선 아이콘 대비·닫기 히트영역·320 어절 줄바꿈
describe("4.85 QA·UI 수정 클래스 계약", () => {
  const read = (p: string) => readFileSync(path.resolve(__dirname, "../../app/(main)/_components", p), "utf8");
  it("튜토리얼 말풍선: 아이콘 흰색, X 버튼 aria-label·히트영역, 다음 버튼 min-h-10", () => {
    const src = read("tutorial/tutorial-overlay.tsx");
    expect(src).toContain('<Icon className="size-3.5 text-white" />');
    expect(src).toContain('aria-label="튜토리얼 닫기"');
    expect(src).toContain("after:-inset-3");
    expect(src).toContain("min-h-10");
  });
  it("도움말 선택기 설명은 break-keep text-pretty", () => {
    const src = read("header-menu/tool-menu.tsx");
    expect(src).toContain('className="text-left break-keep text-pretty"');
    expect(src.match(/leading-relaxed break-keep text-pretty/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
