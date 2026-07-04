/**
 * kis-token.ts
 * KIS access_token 발급 공유 헬퍼 + 서킷 브레이커.
 *
 * 토큰은 하루 1개를 전 사용자가 공유하므로, 발급 실패도 서버 공유 캐시로 카운트한다.
 * 5회 이상 연속 실패(timeout/발급 오류) 시 쿨다운(10분) 동안 외부 호출을 멈추고
 * unavailable=true를 반환 → 라우트가 X-KIS-Unavailable 헤더로 클라이언트에 전달.
 */

import { fetchKisToken } from "@/lib/finance-service";
import { getCacheStorage } from "@/lib/cache-storage";
import { sendAdminSlack } from "@/lib/slack";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

const KIS_FAIL_THRESHOLD = 3; // 이 횟수 이상 실패 시 서킷 open
const KIS_CIRCUIT_COOLDOWN_SEC = 600; // 쿨다운 10분 (경과 후 1회 재시도)

export interface KisTokenResult {
  token: string | null;
  unavailable: boolean; // true = 외부 API 일시 오류 (3회 이상 실패)
}

// 오늘자 캐시 확인 → 없으면 신규 발급. 5회 이상 실패 시 서킷 open으로 외부 호출 차단.
export async function getKisAccessToken(todayStr: string): Promise<KisTokenResult> {
  const storage = getCacheStorage();

  const cached = await storage.getKisToken(todayStr);
  if (cached) {
    await storage.clearKisFailState();
    return { token: cached, unavailable: false };
  }

  const now = Date.now();
  const state = await storage.getKisFailState();
  // 서킷 open: 쿨다운 동안 외부 호출 없이 즉시 일시 오류 반환
  if (state && state.openUntil > now) {
    return { token: null, unavailable: true };
  }

  const token = await fetchKisToken(KIS_APP_KEY, KIS_APP_SECRET);
  if (token) {
    await storage.setKisToken(token, todayStr);
    if (state) await storage.clearKisFailState();
    return { token, unavailable: false };
  }

  // 실패: count 증가 (쿨다운 지난 재시도면 이전 count 유지)
  const count = (state?.count ?? 0) + 1;
  const open = count >= KIS_FAIL_THRESHOLD;
  await storage.setKisFailState(
    { count, openUntil: open ? now + KIS_CIRCUIT_COOLDOWN_SEC * 1000 : 0 },
    KIS_CIRCUIT_COOLDOWN_SEC + 60
  );
  // 서킷이 처음 open되는 전환 시점에만 관리자 Slack 1회 전송 (같은 장애 구간 재알림 방지)
  if (count === KIS_FAIL_THRESHOLD) {
    const nowKST = new Date(now + 9 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
    await sendAdminSlack(
      `*[secretasset] 외부 증권 API(KIS) 점검·오류 감지*\n` +
        `토큰 발급 ${KIS_FAIL_THRESHOLD}회 연속 실패 → 서킷 open (쿨다운 ${KIS_CIRCUIT_COOLDOWN_SEC / 60}분)\n` +
        `시각(KST): ${nowKST}`
    );
  }
  return { token: null, unavailable: open };
}
