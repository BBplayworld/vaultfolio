/**
 * [임시 진단] PWA 빈 자산 이슈 원인 판별용 로거.
 * iOS standalone은 콘솔 접근이 어려우므로 화면 오버레이(PwaDebugOverlay)로 노출한다.
 * 원인 확정 후 이 파일과 계측 호출·오버레이를 제거할 것.
 */

const STORAGE_KEY = "secretasset_pwa_debug";
const MAX_ENTRIES = 60;

export interface PwaDebugEntry {
  t: string; // HH:MM:SS.mmm
  tag: string;
  msg: string;
}

/** standalone 또는 ?pwadebug=1 일 때만 기록 (일반 사용자 영향 없음) */
function isDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    const flagged = new URLSearchParams(window.location.search).get("pwadebug") === "1";
    return standalone || flagged;
  } catch {
    return false;
  }
}

function read(): PwaDebugEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PwaDebugEntry[]) : [];
  } catch {
    return [];
  }
}

export function pwaDebugLog(tag: string, msg: string): void {
  if (!isDebugEnabled()) return;
  try {
    const now = new Date();
    const t = `${now.toTimeString().slice(0, 8)}.${String(now.getMilliseconds()).padStart(3, "0")}`;
    const entries = read();
    entries.push({ t, tag, msg });
    if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    window.dispatchEvent(new Event("pwa-debug-log"));
    // eslint-disable-next-line no-console
    console.log(`[pwa-debug] ${tag}: ${msg}`);
  } catch {
    /* 무시 */
  }
}

export function getPwaDebugLog(): PwaDebugEntry[] {
  return read();
}

export function clearPwaDebugLog(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("pwa-debug-log"));
  } catch {
    /* 무시 */
  }
}
