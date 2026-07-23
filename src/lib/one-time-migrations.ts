/**
 * 1회성 마이그레이션 모음
 *
 * 각 마이그레이션은 고유 id를 가지며, 실행 완료 시 id가 `secretasset_migrations_done`에
 * 기록되어 다시 실행되지 않는다. 매 진입마다 done 체크 → 미실행 항목만 실행.
 *
 * 신규 마이그레이션 추가 방법:
 *   1. 아래 MIGRATIONS 배열에 { id, run } 항목 추가
 *   2. id는 영구 유지 (변경 시 사용자 기기에서 다시 실행됨)
 *   3. run은 idempotent하게 작성 (중복 실행돼도 안전하게)
 */

const DONE_KEY = "secretasset_migrations_done";

interface Migration {
  id: string;
  run: () => void;
}

function getDoneSet(): Set<string> {
  try {
    const raw = localStorage.getItem(DONE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function markDone(id: string): void {
  try {
    const done = getDoneSet();
    done.add(id);
    localStorage.setItem(DONE_KEY, JSON.stringify(Array.from(done)));
  } catch { /* ignore */ }
}

const MIGRATIONS: Migration[] = [
  {
    // 백업 메타 2키 → 단일 객체 통합
    // secretasset_last_backup_at + secretasset_backup_nudge_shown_on → secretasset_backup { lastBackupAt, nudgeShownOn }
    id: "consolidate-backup-keys",
    run: () => {
      const lastBackupAt = localStorage.getItem("secretasset_last_backup_at");
      const nudgeShownOn = localStorage.getItem("secretasset_backup_nudge_shown_on");
      if (lastBackupAt === null && nudgeShownOn === null) return; // 이관할 값 없음
      const meta: Record<string, string> = {};
      if (lastBackupAt !== null) meta.lastBackupAt = lastBackupAt;
      if (nudgeShownOn !== null) meta.nudgeShownOn = nudgeShownOn;
      // 이미 통합 키가 있으면 덮어쓰지 않고 병합(신규 값 우선은 아님 — idempotent, 옛 키 우선 이관)
      let existing: Record<string, string> = {};
      try { existing = JSON.parse(localStorage.getItem("secretasset_backup") ?? "{}"); } catch { existing = {}; }
      localStorage.setItem("secretasset_backup", JSON.stringify({ ...meta, ...existing }));
      localStorage.removeItem("secretasset_last_backup_at");
      localStorage.removeItem("secretasset_backup_nudge_shown_on");
    },
  },
  {
    // 공지 열람 키 통합: 죽은 "일주일 숨기기" 잔재 키 제거
    // (per-id secretasset_notice_seen_* 키의 이관·정리는 notice-dialog의 cleanExpiredNoticeKeys(NOTICE_ID)가 담당)
    id: "consolidate-notice-keys",
    run: () => {
      localStorage.removeItem("secretasset_notice_hide_until");
      localStorage.removeItem("secretasset-notice-hide-until");
    },
  },
  {
    // 환율 일자별 이력 도입:
    //  1) 사용 중단된 환율 이력 동기화 가드 키 제거 (exchangeSyncDate로 통합됨)
    //  2) 환율 이력 1회 초기화 + exchangeSyncDate 초기화 → 다음 진입에서 서버 2일치
    //     환율 이력(전날 포함)을 새로 받아 재구성 (오늘자만 있던 기기의 전날 환율 보충)
    id: "2026-05-22-exchange-history-resync-v3",
    run: () => {
      localStorage.removeItem("secretasset_exchange_history_sync_date");
      localStorage.removeItem("secretasset_exchange_history");
      localStorage.removeItem("secretasset_exchange_last_sync_date");
    },
  },
  {
    // 응답일 통일 + tickerList 정렬 + daily 캐시 키 단순화 후 옛 캐시 전체 청소
    // weekly/monthly/yearly의 응답일 통일 전 entry까지 한 번에 정리
    id: "2026-05-16-clear-profit-cache-final",
    run: () => {
      const PREFIX = "secretasset_profit:";
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) localStorage.removeItem(key);
      }
    },
  },
  {
    // 튜토리얼 step별 12개 키 → 단일 객체 키로 통합
    // secretasset_tutorial_step{0..5}_done / _skipped → secretasset_tutorial_status
    id: "merge-tutorial-status",
    run: () => {
      const TARGET = "secretasset_tutorial_status";
      let hasLegacy = false;
      for (let step = 0; step <= 5; step++) {
        if (
          localStorage.getItem(`secretasset_tutorial_step${step}_done`) !== null ||
          localStorage.getItem(`secretasset_tutorial_step${step}_skipped`) !== null
        ) {
          hasLegacy = true;
          break;
        }
      }
      if (!hasLegacy) return;

      const existing = localStorage.getItem(TARGET);
      const map: Record<string, "pending" | "done" | "skipped"> = existing
        ? (() => { try { return JSON.parse(existing); } catch { return {}; } })()
        : {};
      for (let step = 0; step <= 5; step++) {
        const doneKey = `secretasset_tutorial_step${step}_done`;
        const skippedKey = `secretasset_tutorial_step${step}_skipped`;
        if (localStorage.getItem(doneKey) === "1") {
          map[String(step)] = "done";
        } else if (localStorage.getItem(skippedKey) === "1") {
          if (map[String(step)] !== "done") map[String(step)] = "skipped";
        } else if (map[String(step)] === undefined) {
          map[String(step)] = "pending";
        }
        localStorage.removeItem(doneKey);
        localStorage.removeItem(skippedKey);
      }
      localStorage.setItem(TARGET, JSON.stringify(map));
    },
  },
];

export function runOneTimeMigrations(): void {
  if (typeof window === "undefined") return;
  const done = getDoneSet();
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    try {
      m.run();
      markDone(m.id);
    } catch (e) {
      console.error(`[Migration] ${m.id} 실패`, e);
    }
  }
}
