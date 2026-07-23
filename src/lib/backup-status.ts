// 백업 상태 — 이 앱은 localStorage 단일 저장소라 브라우저 데이터를 지우면 전부 사라진다.
// 마지막 백업 시점을 기록해 두고, 오래됐으면 사용자에게 백업을 권한다.
//
// 기기 로컬 전용: 백업 여부는 "이 기기의 사실"이므로 buildExportPayload·동기화 payload에 넣지 않는다.
// (A기기 백업 시각이 B기기로 건너가면 백업한 적 없는 B가 안전하다고 오인한다 — lastVisitDate와 같은 판단)

import { STORAGE_KEYS } from "@/lib/local-storage";

/** 백업 없이 지나도 넛지를 띄우지 않는 기간 */
const NUDGE_AFTER_DAYS = 30;
/** 백업 이력이 없는 신규 사용자 유예 — 자산을 만들자마자 괴롭히지 않는다 */
const NEW_USER_GRACE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const todayStr = (): string => new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

// 백업 메타 단일 키 캡슐화 — { lastBackupAt?: ISO, nudgeShownOn?: YYYY-MM-DD }
interface BackupMeta { lastBackupAt?: string; nudgeShownOn?: string }
function readBackupMeta(): BackupMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.backup);
    return raw ? (JSON.parse(raw) as BackupMeta) : {};
  } catch {
    return {};
  }
}
function writeBackupMeta(patch: Partial<BackupMeta>): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.backup, JSON.stringify({ ...readBackupMeta(), ...patch }));
  } catch { /* 기록 실패 무시 */ }
}

export function readLastBackupAt(): string | null {
  return readBackupMeta().lastBackupAt ?? null;
}

/**
 * 파일 내보내기 성공 시에만 호출한다.
 * 클라우드 push는 여기에 기록하지 않는다 — 자동 push가 갱신하면 사용자가 백업한 적 없는 날도
 * "마지막 백업: 오늘"로 보인다(동기화는 lastSyncedAt이 따로 담당).
 */
export function markBackedUp(): void {
  writeBackupMeta({ lastBackupAt: new Date().toISOString() });
}

/** 마지막 백업 이후 경과 일수. 이력이 없으면 null */
export function daysSinceBackup(): number | null {
  const raw = readLastBackupAt();
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / DAY_MS);
}

/** "마지막 백업: 3일 전" 같은 사람이 읽는 문구. 이력 없으면 null */
export function formatLastBackup(): string | null {
  const raw = readLastBackupAt();
  if (!raw) return null;
  const t = new Date(raw).getTime();
  if (Number.isNaN(t)) return null;
  // 오늘/어제 라벨은 경과 시간이 아니라 KST 달력일 차이로 판단한다.
  // (어제 저녁 백업 후 오늘 아침이면 경과 24h 미만이라 "오늘"로 오표시되던 버그)
  const kstDate = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  const backupDate = kstDate(t);
  const calDays = Math.round((Date.parse(`${todayStr()}T00:00:00Z`) - Date.parse(`${backupDate}T00:00:00Z`)) / DAY_MS);
  if (calDays <= 0) return `${backupDate} (오늘)`;
  if (calDays === 1) return `${backupDate} (어제)`;
  return `${backupDate} (${calDays}일 전)`;
}

/** 백업이 오래돼 경고 톤으로 표시해야 하는지 */
export function isBackupStale(): boolean {
  const days = daysSinceBackup();
  return days !== null && days >= NUDGE_AFTER_DAYS;
}

/**
 * 홈 배너 노출 여부. 아래를 모두 만족해야 한다.
 *  1. 자산이 있다
 *  2. 클라우드 동기화가 켜져 있지 않다 (동기화 중이면 이미 백업된 것)
 *  3. 백업이 30일 넘게 없었다 (이력이 없으면 자산 생성 후 7일 유예)
 *  4. 오늘 아직 안 띄웠다
 */
export function shouldShowBackupNudge(opts: {
  hasAssets: boolean;
  syncArmed: boolean;
  assetLastUpdated?: string;
}): boolean {
  if (typeof window === "undefined") return false;
  if (!opts.hasAssets || opts.syncArmed) return false;

  if (readBackupMeta().nudgeShownOn === todayStr()) return false;

  const days = daysSinceBackup();
  if (days === null) {
    // 백업 이력 없음 — 자산을 만든 지 얼마나 됐는지로 판단
    if (!opts.assetLastUpdated) return false;
    const since = Date.now() - new Date(opts.assetLastUpdated).getTime();
    return Number.isFinite(since) && since >= NEW_USER_GRACE_DAYS * DAY_MS;
  }
  return days >= NUDGE_AFTER_DAYS;
}

/** "모든 데이터 삭제" 전용 — clearAssetData는 이 키를 보존하므로 명시적으로 지운다 */
export function clearBackupStatus(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEYS.backup);
  } catch { /* 무시 */ }
}

/** 배너를 닫거나 노출했을 때 — 오늘은 다시 띄우지 않는다 */
export function markNudgeShown(): void {
  writeBackupMeta({ nudgeShownOn: todayStr() });
}
