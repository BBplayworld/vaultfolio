"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/ga";
import { reconcilePush } from "@/lib/push/client";
import { consumePushFlag } from "@/lib/push/prefs";
import { isTrialMode } from "@/lib/trial/trial-mode";
import { useAssetNavigation } from "../layout/navigation/navigation-context";

/**
 * 알림(#179, 4.91) 앱 로드 처리 — 렌더 없음.
 * ① 알림 클릭으로 열린 경우(`?from=push&t=morning|kr|settle|tax`) GA `알림·누름·아침|국내|결산|세금` 1회 + 주소에서 플래그 제거(replaceState)
 *    + 종류에 맞는 화면으로 바로 이동(아침·국내→홈 '오늘' 카드, 결산→월 결산, 세금→세금 관리). 홈 팁에 가려지지 않게 홈을 거치지 않는다(C80)
 * ② 구독 만료·교체 보정(로컬 on인데 기기 구독이 없으면 재구독·서버 갱신, 구버전 설정 구독 정리)
 * 체험 모드에서는 아무것도 하지 않는다(서버 구독을 만들지 않게).
 */
export function PushHost() {
  const { navigate } = useAssetNavigation();
  useEffect(() => {
    if (isTrialMode()) return;
    const { fromPush, target, cleanUrl } = consumePushFlag(window.location.pathname + window.location.search + window.location.hash);
    if (fromPush) {
      window.history.replaceState(window.history.state, "", cleanUrl);
      if (target) {
        track("feature_use", { category: `push_click_${target}` as const });
        // 내비게이션 Provider의 초기 해시 복원(부모 effect)이 끝난 뒤 이동한다
        setTimeout(() => {
          if (target === "tax") navigate({ type: "tax" });
          else if (target === "morning" || target === "kr") navigate({ type: "home" }); // 홈 '오늘' 카드(같은 종가일, C80)
          else navigate({ type: "activity", tab: "change", init: { scope: "all", period: "month", source: "push" } });
        }, 0);
      }
    }
    void reconcilePush();
  }, [navigate]);
  return null;
}
