/**
 * 1회성 마이그레이션 모음
 *
 * 배포 후 사용자의 localStorage·캐시·데이터 상태를 한 번만 정리해야 하는 경우 등록.
 * 각 마이그레이션은 고유 id를 가지며, 실행 완료 시 id가 `secretasset_migrations_done`에
 * 기록되어 다시 실행되지 않는다.
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
    // 2026-05-15: 한투 API stale 캐시 정리
    // 해외 종가 일자 시프트 로직 변경 + 서버 캐시 stale 데이터 가능성으로 인해
    // localStorage의 profit 캐시 일괄 제거. 새로 fetch되도록 강제.
    id: "2026-05-15-clear-profit-cache",
    run: () => {
      const PREFIX = "secretasset_profit:";
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    },
  },
  {
    // 2026-05-15-2: tickerList 정렬 도입으로 캐시 키가 바뀜 → 기존 캐시 모두 무효화
    // (이전 키는 ticker 입력 순서 의존, 신규 키는 알파벳 정렬)
    id: "2026-05-15-clear-profit-cache-v2",
    run: () => {
      const PREFIX = "secretasset_profit:";
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(PREFIX)) {
          localStorage.removeItem(key);
        }
      }
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
