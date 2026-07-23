// 일별 스냅샷 장기 아카이브 — 30일 롤링에서 밀려난 일별 기록을 월 단위로 압축 보관.
// 소비처: 기록 스트릭(장기), 데이터 내보내기·클라우드 동기화(merge 복원).
// 공유 URL 토큰(packV7)에는 미포함.

import type { DailyArchive, DailyAssetSnapshot } from "@/types/asset";
import { STORAGE_KEYS } from "@/lib/local-storage";

export function readDailyArchive(): DailyArchive {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.dailyArchive);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as DailyArchive) : {};
  } catch {
    return {};
  }
}

export function writeDailyArchive(archive: DailyArchive): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEYS.dailyArchive, JSON.stringify(archive));
  } catch { /* 저장 실패 무시 */ }
}

// 두 아카이브 병합 (로컬 ∪ 수신) — 동일 월·동일 일은 base 우선 유지.
// 구버전 앱이 archive 없는 payload를 push해도 신버전 기기의 로컬 아카이브가 유실되지 않도록
// 가져오기/동기화 복원은 반드시 merge로 수행한다.
export function mergeDailyArchives(base: DailyArchive, incoming: DailyArchive): DailyArchive {
  const result: DailyArchive = { ...base };
  for (const [month, inc] of Object.entries(incoming)) {
    if (!inc || !Array.isArray(inc.d)) continue;
    const cur = result[month];
    if (!cur) {
      result[month] = { d: [...inc.d], n: [...inc.n], f: [...inc.f] };
      continue;
    }
    const days = new Set(cur.d);
    const merged = cur.d.map((day, i) => ({ day, n: cur.n[i], f: cur.f[i] }));
    inc.d.forEach((day, i) => {
      if (!days.has(day)) merged.push({ day, n: inc.n[i], f: inc.f[i] });
    });
    merged.sort((a, b) => a.day - b.day);
    result[month] = {
      d: merged.map((m) => m.day),
      n: merged.map((m) => m.n),
      f: merged.map((m) => m.f),
    };
  }
  return result;
}

// 롤링 삭제 대상 스냅샷을 아카이브로 이관 (월별 upsert, 중복 호출에도 동일 결과)
// 일요일 기록은 저장 규칙상 존재하지 않지만 방어적으로 제외
export function archiveDailySnapshots(expired: DailyAssetSnapshot[]): void {
  if (typeof window === "undefined" || expired.length === 0) return;
  const archive = readDailyArchive();
  let changed = false;
  for (const s of expired) {
    if (!s?.date || new Date(`${s.date}T00:00:00Z`).getUTCDay() === 0) continue;
    const month = s.date.substring(0, 7);
    const day = parseInt(s.date.substring(8), 10);
    if (!Number.isFinite(day)) continue;
    const entry = archive[month] ?? { d: [], n: [], f: [] };
    const idx = entry.d.indexOf(day);
    if (idx >= 0) {
      if (entry.n[idx] === s.netAsset && entry.f[idx] === s.financialAsset) continue;
      entry.n[idx] = s.netAsset;
      entry.f[idx] = s.financialAsset;
    } else {
      const insertAt = entry.d.findIndex((d) => d > day);
      const at = insertAt < 0 ? entry.d.length : insertAt;
      entry.d.splice(at, 0, day);
      entry.n.splice(at, 0, s.netAsset);
      entry.f.splice(at, 0, s.financialAsset);
    }
    archive[month] = entry;
    changed = true;
  }
  if (changed) writeDailyArchive(archive);
}

// 아카이브에 기록된 날짜 목록 (YYYY-MM-DD, 오름차순) — 기록 스트릭 장기 계산용
export function listArchivedDates(): string[] {
  const archive = readDailyArchive();
  const dates: string[] = [];
  for (const [month, entry] of Object.entries(archive)) {
    if (!entry || !Array.isArray(entry.d)) continue;
    for (const day of entry.d) dates.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return dates.sort();
}
