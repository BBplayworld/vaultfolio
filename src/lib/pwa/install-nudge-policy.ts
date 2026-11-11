/**
 * pwa/install-nudge-policy.ts — 첫 저장 직후 설치 안내 노출 판정(순수 함수, #78).
 * 튜토리얼 진행 여부는 조건에 넣지 않는다(#4.85) — 튜토리얼을 끝내지 않은 첫 저장 세션에서 안내가 영영 안 뜨던 문제.
 * 말풍선과 동시에 노출하지 않는 것은 안내가 보이는 동안 TutorialOverlay가 양보해서 보장한다(first-save-signal nudgeVisible).
 */
export interface InstallNudgeInput {
  firstSave: boolean;
  dismissed: boolean;
  trial: boolean;
  inApp: boolean;
  isMobile: boolean | undefined;
  isIOS: boolean;
  isInstallable: boolean;
  isHome: boolean;
  assetCount: number;
  wizardOpen: boolean;
  dialogOpen: boolean;
}

export function shouldShowInstallNudge(i: InstallNudgeInput): boolean {
  return (
    i.firstSave &&
    !i.dismissed &&
    !i.trial &&
    !i.inApp &&
    i.isMobile === true &&
    (i.isIOS || i.isInstallable) &&
    i.isHome &&
    i.assetCount > 0 &&
    !i.wizardOpen &&
    !i.dialogOpen
  );
}
