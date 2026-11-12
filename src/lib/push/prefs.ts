// 시장 알림 로컬 설정(#179) — 이 기기에서만 쓰는 단일 키. 자산 스키마·동기화·백업·공유 토큰에 넣지 않는다.
// 키가 없거나 깨져 있으면 기본값(off) — 손실 없음.
import { PUSH_DEFAULT_TOPICS, normalizePushTopics } from "./catalog";
import type { PushCond } from "./types";

export const PUSH_PREFS_KEY = "secretasset_push_prefs";

export interface PushPrefs {
  v: 1;
  on: boolean;
  topics: string[];
  cond: PushCond;
}

export const defaultPushPrefs = (): PushPrefs => ({ v: 1, on: false, topics: [...PUSH_DEFAULT_TOPICS], cond: "daily" });

export function parsePushPrefs(raw: string | null): PushPrefs {
  if (!raw) return defaultPushPrefs();
  try {
    const p = JSON.parse(raw) as Partial<PushPrefs> | null;
    if (!p || p.v !== 1) return defaultPushPrefs();
    const topics = Array.isArray(p.topics) ? normalizePushTopics(p.topics) : [];
    return {
      v: 1,
      on: p.on === true,
      topics: topics.length > 0 ? topics : [...PUSH_DEFAULT_TOPICS],
      cond: p.cond === "pm2" ? "pm2" : "daily",
    };
  } catch {
    return defaultPushPrefs();
  }
}

export function readPushPrefs(): PushPrefs {
  try {
    return parsePushPrefs(localStorage.getItem(PUSH_PREFS_KEY));
  } catch {
    return defaultPushPrefs();
  }
}

export function writePushPrefs(prefs: PushPrefs): void {
  try {
    localStorage.setItem(PUSH_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* 저장 실패는 무시 — 다음 로드에서 기본값 */
  }
}

export function clearPushPrefs(): void {
  try {
    localStorage.removeItem(PUSH_PREFS_KEY);
  } catch {
    /* 무시 */
  }
}

/** 설정 행 요약 — `코스피, S&P 500 · 매 거래일`, 5개 이상 `코스피 외 3개 · 매 거래일`, ±2% `… · ±2% 이상만` */
export function summarizePushPrefs(prefs: Pick<PushPrefs, "topics" | "cond">, labelOf: (id: string) => string): string {
  const names = prefs.topics.map(labelOf);
  const head = names.length >= 5 ? `${names[0]} 외 ${names.length - 1}개` : names.join(", ");
  return `${head} · ${prefs.cond === "pm2" ? "±2% 이상만" : "매 거래일"}`;
}

/** 알림 클릭 도착(`/?from=push`) 판별 — 플래그를 제거한 URL을 돌려준다(앱이 replaceState로 반영) */
export function consumePushFlag(url: string): { fromPush: boolean; cleanUrl: string } {
  try {
    const u = new URL(url, "http://localhost");
    if (u.searchParams.get("from") !== "push") return { fromPush: false, cleanUrl: url };
    u.searchParams.delete("from");
    return { fromPush: true, cleanUrl: `${u.pathname}${u.search}${u.hash}` };
  } catch {
    return { fromPush: false, cleanUrl: url };
  }
}
