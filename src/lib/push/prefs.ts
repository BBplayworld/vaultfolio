// 시장 알림 로컬 설정(#179) — 이 기기에서만 쓰는 단일 키. 자산 스키마·동기화·백업·공유 토큰에 넣지 않는다.
// 키가 없거나 깨져 있으면 기본값(off) — 손실 없음.
import { normalizePushTopics } from "./catalog";
import type { PushCond } from "./types";

// 점 접두 — clearAssetData(secretasset_* 삭제)·가져오기·복원·동기화 pull에 지워지지 않고, 구버전 롤백에도 보존된다(physicalAssets 선례).
export const PUSH_PREFS_KEY = "secretasset.push_prefs";
// 4.91 초기 키 — 있으면 1회 새 키로 옮기고 삭제한다.
export const LEGACY_PUSH_PREFS_KEY = "secretasset_push_prefs";

// v3(4.91): 알림 종류(morning·kr·settle·tax) + 큰 움직임 조건(cond). v3 단일 형식 — 못 읽는 값(구 v1·v2 포함)은 기본값(off·미선택)으로 읽는다.
// 운영 미머지 개발 중 형식이라 사용자 데이터가 없고, 켜져 있던 구독은 앱 로드 시 reconcilePush가 정리한다. 미리 체크하지 않는다(사용자가 고름).
export interface PushPrefs {
  v: 3;
  on: boolean;
  topics: string[];
  cond: PushCond;
}

export const defaultPushPrefs = (): PushPrefs => ({ v: 3, on: false, topics: [], cond: "daily" });

export function parsePushPrefs(raw: string | null): PushPrefs {
  if (!raw) return defaultPushPrefs();
  try {
    const p = JSON.parse(raw) as Partial<PushPrefs> | null;
    if (!p || p.v !== 3) return defaultPushPrefs();
    const topics = Array.isArray(p.topics) ? normalizePushTopics(p.topics) : [];
    return { v: 3, on: p.on === true && topics.length > 0, topics, cond: p.cond === "pm2" ? "pm2" : "daily" };
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

/** 시세 조건(큰 움직임)이 적용되는 종류 — 아침 시장 요약·국내 장 마감 */
export const PUSH_COND_TOPICS: readonly string[] = ["morning", "kr"];

/** 설정 행 요약 — `아침 시장 요약, 월 결산 열림`, 큰 움직임만 고른 경우 `… · 큰 움직임 있는 날만` */
export function summarizePushPrefs(prefs: Pick<PushPrefs, "topics" | "cond">, labelOf: (id: string) => string): string {
  const head = prefs.topics.map(labelOf).join(", ");
  return prefs.cond === "pm2" && prefs.topics.some((t) => PUSH_COND_TOPICS.includes(t)) ? `${head} · 큰 움직임 있는 날만` : head;
}

export type PushTarget = "morning" | "kr" | "settle" | "tax";
const PUSH_TARGETS: readonly string[] = ["morning", "kr", "settle", "tax"];

/** 알림 클릭 도착(`/?from=push&t=morning|kr|settle|tax`) 판별 — 플래그를 제거한 URL을 돌려준다(앱이 replaceState로 반영). t가 없거나 모르는 값이면 target null(홈 유지) */
export function consumePushFlag(url: string): { fromPush: boolean; target: PushTarget | null; cleanUrl: string } {
  try {
    const u = new URL(url, "http://localhost");
    if (u.searchParams.get("from") !== "push") return { fromPush: false, target: null, cleanUrl: url };
    const t = u.searchParams.get("t");
    u.searchParams.delete("from");
    u.searchParams.delete("t");
    return { fromPush: true, target: t && PUSH_TARGETS.includes(t) ? (t as PushTarget) : null, cleanUrl: `${u.pathname}${u.search}${u.hash}` };
  } catch {
    return { fromPush: false, target: null, cleanUrl: url };
  }
}
