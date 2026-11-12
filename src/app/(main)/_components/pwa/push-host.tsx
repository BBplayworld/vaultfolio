"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics/ga";
import { reconcilePush } from "@/lib/push/client";
import { consumePushFlag } from "@/lib/push/prefs";
import { isTrialMode } from "@/lib/trial/trial-mode";

/**
 * 시장 알림(#179) 앱 로드 처리 — 렌더 없음.
 * ① 알림 클릭으로 열린 경우(`?from=push`) GA `알림·누름` 1회 + 주소에서 플래그 제거(replaceState)
 * ② 구독 만료·교체 보정(로컬 on인데 기기 구독이 없으면 재구독·서버 갱신)
 * 체험 모드에서는 아무것도 하지 않는다(서버 구독을 만들지 않게).
 */
export function PushHost() {
  useEffect(() => {
    if (isTrialMode()) return;
    const { fromPush, cleanUrl } = consumePushFlag(window.location.pathname + window.location.search + window.location.hash);
    if (fromPush) {
      track("feature_use", { category: "push_click" });
      window.history.replaceState(window.history.state, "", cleanUrl);
    }
    void reconcilePush();
  }, []);
  return null;
}
