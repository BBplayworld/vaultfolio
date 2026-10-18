/**
 * kis-token.ts
 * KIS access_token 발급 공유 헬퍼 + 서킷 브레이커.
 *
 * 토큰은 하루 1개를 전 사용자가 공유하므로, 발급 실패도 서버 공유 캐시로 카운트한다.
 * 3회 이상 연속 실패(timeout/발급 오류) 시 쿨다운(10분) 동안 외부 호출을 멈추고
 * unavailable=true를 반환 → 라우트가 X-KIS-Unavailable 헤더로 클라이언트에 전달.
 */

import { fetchKisToken } from "@/lib/finance/finance-service";
import { getCacheStorage } from "@/lib/cache-storage";
import { sendAdminSlack } from "@/lib/slack";

const KIS_APP_KEY = process.env.KIS_APP_KEY || "";
const KIS_APP_SECRET = process.env.KIS_APP_SECRET || "";

const KIS_FAIL_THRESHOLD = 3; // 이 횟수 이상 실패 시 서킷 open
const KIS_CIRCUIT_COOLDOWN_SEC = 600; // 쿨다운 10분 (경과 후 1회 재시도)
// 토큰 발급 single-flight — 동시 캐시 미스 시 인스턴스 내 1회 + 인스턴스 간 Redis 락으로 발급 폭주 방지
const KIS_TOKEN_LOCK_KEY = "finance:kis_token:lock";
const KIS_TOKEN_LOCK_TTL_SEC = 15;
const KIS_TOKEN_WAIT_POLLS = 10;
const KIS_TOKEN_WAIT_MS = 300;

let inflightIssue: Promise<{ token: string | null; waited: boolean }> | null = null;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// 실제 발급 — 락 획득자만 KIS 호출, 미획득자는 다른 인스턴스가 저장할 토큰을 짧게 대기
async function issueKisToken(todayStr: string): Promise<{ token: string | null; waited: boolean }> {
  const storage = getCacheStorage();
  const lock = await storage.acquireLock(KIS_TOKEN_LOCK_KEY, KIS_TOKEN_LOCK_TTL_SEC);
  if (!lock) {
    for (let i = 0; i < KIS_TOKEN_WAIT_POLLS; i++) {
      await sleep(KIS_TOKEN_WAIT_MS);
      const t = await storage.getKisToken(todayStr);
      if (t) return { token: t, waited: true };
    }
    return { token: null, waited: true };
  }
  try {
    const token = await fetchKisToken(KIS_APP_KEY, KIS_APP_SECRET);
    if (token) await storage.setKisToken(token, todayStr);
    return { token, waited: false };
  } finally {
    await storage.releaseLock(KIS_TOKEN_LOCK_KEY, lock);
  }
}

export interface KisTokenResult {
  token: string | null;
  unavailable: boolean; // true = 외부 API 일시 오류 (3회 이상 실패)
}

// KIS 호출 실패 기록 — 실패 카운트 증가, 임계치 도달 시 서킷 open + 관리자 Slack 1회 알림.
// 토큰 발급 실패뿐 아니라, 토큰은 유효하나 다운스트림(가격·배당 등) 조회가 전량 실패하는
// 경우(토큰 발급 이후·만료 전에 KIS 점검이 시작된 경우)에도 재사용해 서킷에 반영한다.
export async function recordKisFailure(): Promise<boolean> {
  const storage = getCacheStorage();
  const now = Date.now();
  const state = await storage.getKisFailState();
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
      `*[시크릿에셋] 외부 증권 API(KIS) 점검·오류 감지*\n` +
        `연속 실패 ${KIS_FAIL_THRESHOLD}회 → 서킷 open (쿨다운 ${KIS_CIRCUIT_COOLDOWN_SEC / 60}분)\n` +
        `시각(KST): ${nowKST}`
    );
  }
  return open;
}

// KIS 호출 성공 기록 — 실패 상태 클리어 (존재할 때만 write).
export async function recordKisSuccess(): Promise<void> {
  const storage = getCacheStorage();
  const state = await storage.getKisFailState();
  if (state) await storage.clearKisFailState();
}

// 오늘자 캐시 확인 → 없으면 신규 발급(single-flight). 3회 이상 실패 시 서킷 open으로 외부 호출 차단.
export async function getKisAccessToken(todayStr: string): Promise<KisTokenResult> {
  const storage = getCacheStorage();

  const cached = await storage.getKisToken(todayStr);
  if (cached) {
    await recordKisSuccess();
    return { token: cached, unavailable: false };
  }

  const now = Date.now();
  const state = await storage.getKisFailState();
  // 서킷 open: 쿨다운 동안 외부 호출 없이 즉시 일시 오류 반환
  if (state && state.openUntil > now) {
    return { token: null, unavailable: true };
  }

  if (!inflightIssue) {
    inflightIssue = issueKisToken(todayStr).finally(() => {
      inflightIssue = null;
    });
  }
  const { token, waited } = await inflightIssue;
  if (token) {
    await recordKisSuccess();
    return { token, unavailable: false };
  }
  // 다른 인스턴스 발급을 기다리다 시간 초과 — 발급 실패가 아니므로 서킷에 반영하지 않고 이번 요청만 일시 오류
  if (waited) return { token: null, unavailable: false };

  const open = await recordKisFailure();
  return { token: null, unavailable: open };
}
