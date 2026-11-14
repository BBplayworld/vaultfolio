import "server-only";
import { loadPushQuotes, kstToday } from "./cron-run";
import { buildKrCloseMessage, buildMorningMessage, buildSettleMessage, nearestTaxMessage } from "./message";
import type { PushCond, PushPayload } from "./types";

// preview 테스트 발송(4.91) — 운영 Cron과 같은 시세 조회·메시지 생성 함수를 호출한다.
// 테스트 전용 분기는 '날짜 판정(발송일·직전 종가 반복 방지)을 건너뛰고 즉시 생성' 하나뿐.
// 조건 pm2 미충족이면 운영에선 안 가므로 제목 앞에 표시를 붙여 1건 보낸다. 시세 실패·검증 실패 구간은 운영처럼 생략.
export const PUSH_PREVIEW_UNMET = "[미리보기·오늘은 조건 미충족]";

export async function buildTestPayloads(topics: readonly string[], cond: PushCond, nowMs = Date.now()): Promise<PushPayload[]> {
  const today = kstToday(nowMs);
  const needMorning = topics.includes("morning");
  const needKr = topics.includes("kr");
  const out: PushPayload[] = [];
  const quotes = needMorning || needKr ? await loadPushQuotes(today, needMorning, needMorning || needKr, "morning") : { us: [], kr: [] };
  const withCond = (build: (c: PushCond) => PushPayload | null) => {
    const p = build(cond);
    if (p) return p;
    const unmet = cond === "pm2" ? build("daily") : null; // 조건만 미충족이고 내용은 있는 경우
    return unmet ? { ...unmet, t: `${PUSH_PREVIEW_UNMET} ${unmet.t}` } : null;
  };
  for (const kind of ["morning", "kr", "settle", "tax"] as const) {
    if (!topics.includes(kind)) continue;
    const p =
      kind === "morning" ? withCond((c) => buildMorningMessage(today, quotes.us, quotes.kr, c))
      : kind === "kr" ? withCond((c) => buildKrCloseMessage(today, quotes.kr, c))
      : kind === "settle" ? buildSettleMessage(today)
      : nearestTaxMessage(today);
    if (p) out.push(p);
  }
  return out;
}
