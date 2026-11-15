/**
 * pwa/persist-storage.ts — 브라우저 저장 보호 요청(5.115).
 * 자산이 있는 상태로 열면 페이지 로드당 1회 navigator.storage.persist()를 요청한다. 화면 변화 0, 저장 키 0.
 * 결과는 허용/거부 1비트만 GA(feature_use)로 보낸다. 프롬프트를 띄우는 Firefox는 제외한다.
 */
import { track } from "@/lib/analytics/ga";

let requested = false; // 페이지 로드당 1회(메모리 플래그)

export async function ensureStoragePersist(): Promise<void> {
  if (requested || typeof navigator === "undefined") return;
  if (typeof navigator.storage?.persist !== "function") return;
  if (/\bFirefox\//i.test(navigator.userAgent)) return;
  requested = true;
  try {
    if (typeof navigator.storage.persisted === "function" && (await navigator.storage.persisted())) return;
    const granted = await navigator.storage.persist();
    track("feature_use", { category: granted ? "persist_ok" : "persist_denied" });
  } catch {
    /* 무시 — 재시도·GA·화면 변화 0 */
  }
}

/** 테스트용 — 1회 플래그 초기화 */
export function resetStoragePersistForTest(): void {
  requested = false;
}
