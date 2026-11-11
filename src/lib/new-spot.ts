// `새` 표시 판정(4.83) — 순수 함수. 켜짐 = 연결 새 소식 항목 게시일(KST)부터 30일(WHATS_NEW_UNSEEN_DAYS와 같은 판정),
// 꺼짐(먼저 오는 것) = 그 visitKey의 lastVisitedAt이 게시일 00:00 KST 이후이거나 30일 초과. 시트를 읽은 것(seen 기록)은 영향 없음.
import { WHATS_NEW } from "@/config/whats-new";
import { NEW_SPOTS, type NewSpot } from "@/config/new-spots";
import { WHATS_NEW_UNSEEN_DAYS, ageDays, parseEntryId } from "./whats-new";

const KST_MS = 9 * 60 * 60 * 1000;

// 방문 시각(ISO) → KST 날짜 숫자(YYYYMMDD). 해석 불가는 null
function kstDateNumber(iso: string): number | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Number(new Date(t + KST_MS).toISOString().slice(0, 10).replaceAll("-", ""));
}

export function isSpotNew(spot: NewSpot, today: string, lastVisitedAt: string | undefined): boolean {
  const cfg = NEW_SPOTS[spot];
  const entry = WHATS_NEW.find((e) => e.id === cfg.entryId);
  const parsed = entry ? parseEntryId(entry.id) : null;
  if (!entry || !parsed) return false;
  const age = ageDays(entry, today);
  if (age < 0 || age > WHATS_NEW_UNSEEN_DAYS) return false;
  if (lastVisitedAt) {
    const visited = kstDateNumber(lastVisitedAt);
    if (visited !== null && visited >= parsed.date) return false;
  }
  return true;
}

// 한 화면 1개 — 보이는 자리(우선순위 순)만 넘기면 첫 번째로 켜진 자리를 돌려준다. 방문 기록으로만 결정(결정적)
export function pickNewSpot(order: readonly NewSpot[], today: string, lastVisited: (visitKey: string) => string | undefined): NewSpot | null {
  return order.find((s) => isSpotNew(s, today, lastVisited(NEW_SPOTS[s].visitKey))) ?? null;
}
