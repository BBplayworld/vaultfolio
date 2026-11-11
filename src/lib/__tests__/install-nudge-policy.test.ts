import { describe, it, expect } from "vitest";
import { shouldShowInstallNudge, type InstallNudgeInput } from "@/lib/pwa/install-nudge-policy";

const ok: InstallNudgeInput = {
  firstSave: true, dismissed: false, trial: false, inApp: false, isMobile: true,
  isIOS: true, isInstallable: false, isHome: true, assetCount: 1,
  wizardOpen: false, dialogOpen: false,
};

describe("shouldShowInstallNudge (#78)", () => {
  it("모든 조건 충족(iOS / 안드로이드 설치 가능)이면 노출", () => {
    expect(shouldShowInstallNudge(ok)).toBe(true);
    expect(shouldShowInstallNudge({ ...ok, isIOS: false, isInstallable: true })).toBe(true);
  });
  it.each<[string, Partial<InstallNudgeInput>]>([
    ["첫 저장 신호 없음", { firstSave: false }],
    ["이미 닫힘", { dismissed: true }],
    ["체험", { trial: true }],
    ["인앱", { inApp: true }],
    ["데스크톱", { isMobile: false }],
    ["폭 미확정", { isMobile: undefined }],
    ["iOS도 설치 가능도 아님", { isIOS: false, isInstallable: false }],
    ["홈 아님", { isHome: false }],
    ["자산 0건", { assetCount: 0 }],
    ["마법사 열림", { wizardOpen: true }],
    ["다이얼로그 열림", { dialogOpen: true }],
  ])("%s이면 미노출", (_n, patch) => {
    expect(shouldShowInstallNudge({ ...ok, ...patch })).toBe(false);
  });
});
