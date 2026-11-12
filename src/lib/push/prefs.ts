// 시장 알림 로컬 설정(#179) — 이 기기에서만 쓰는 단일 키. 자산 스키마·동기화·백업·공유 토큰에 넣지 않는다.
// 키가 없거나 깨져 있으면 기본값(off) — 손실 없음.
import { PUSH_DEFAULT_TOPICS, normalizePushTopics } from "./catalog";
import type { PushCond } from "./types";

// 점 접두 — clearAssetData(secretasset_* 삭제)·가져오기·복원·동기화 pull에 지워지지 않고, 구버전 롤백에도 보존된다(physicalAssets 선례).
export const PUSH_PREFS_KEY = "secretasset.push_prefs";
// 4.91 초기 키 — 있으면 1회 새 키로 옮기고 삭제한다.
export const LEGACY_PUSH_PREFS_KEY = "secretasset_push_prefs";

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

/** 구버전 키 → 새 키 1회 이전(새 키가 이미 있으면 새 키 우선, 구 키는 삭제) */
export function migrateLegacyPushPrefs(): void {
  try {
    const legacy = localStorage.getItem(LEGACY_PUSH_PREFS_KEY);
    if (legacy === null) return;
    if (localStorage.getItem(PUSH_PREFS_KEY) === null) localStorage.setItem(PUSH_PREFS_KEY, legacy);
    localStorage.removeItem(LEGACY_PUSH_PREFS_KEY);
  } catch {
    /* 무시 — 다음 읽기에서 재시도 */
  }
}

export function readPushPrefs(): PushPrefs {
  try {
    migrateLegacyPushPrefs();
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
    localStorage.removeItem(LEGACY_PUSH_PREFS_KEY);
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
