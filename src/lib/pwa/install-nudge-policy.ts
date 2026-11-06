/**
 * pwa/install-nudge-policy.ts — 첫 저장 직후 설치 안내 노출 판정(순수 함수, #78).
 * 튜토리얼은 isTutorialFinished === true만 쓴다(초기값 activeStep === null 구멍 방지).
 * isTutorialFinished는 완료·건너뛰기(skipStep/skipAllTutorialSteps)로 pending이 없을 때 true가 된다.
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
  tutorialFinished: boolean;
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
    i.tutorialFinished === true &&
    !i.wizardOpen &&
    !i.dialogOpen
  );
}
