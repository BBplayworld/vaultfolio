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
