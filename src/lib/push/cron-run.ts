import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { pushDueOn } from "./message";
import { isPushConfigured, sendPush } from "./send";
import type { PushSubRecord } from "./types";

// 날짜표 기반 알림 발송(#179, 4.91 'A 교체', 운영 Cron 전용). 중복 알림 금지 우선 — 종류·날짜 플래그를 먼저 잡고 실패해도 풀지 않는다.
// 시세 조회 없음. 응답은 건수만(구독·endpoint 정보 0).

const CHUNK = 50;
const NO_STORE = { "Cache-Control": "private, no-store" } as const;
const KST_MS = 9 * 60 * 60 * 1000;

export function isCronAuthorized(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authHeader) return false;
  const a = Buffer.from(authHeader);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

/** KST 기준 오늘 YYYY-MM-DD */
export function kstToday(nowMs: number): string {
  return new Date(nowMs + KST_MS).toISOString().slice(0, 10);
}

export async function runPushCron(req: Request): Promise<NextResponse> {
  if (!isCronAuthorized(req.headers.get("authorization"))) return json({ error: "unauthorized" }, 401);
  if (process.env.VERCEL_ENV !== "production") return new NextResponse(null, { status: 204 });

  // 키 미설정이면 복호화가 전부 실패해 고아 정리가 구독을 지우므로 플래그 전에 중단
  if (!isPushConfigured()) return json({ skipped: "not-configured" });

  const today = kstToday(Date.now());
  const due = pushDueOn(today);
  if (due.length === 0) return json({ skipped: "no-event" });

  const storage = getCacheStorage();
  let sent = 0;
  let failed = 0;
  let removed = 0;
  let duplicate = 0;
  for (const { kind, payload } of due) {
    if (!(await storage.markPushSent(kind, today))) {
      duplicate++;
      continue;
    }
    const ids = await storage.listPushSubIdsByTopics([kind]);
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const results = await Promise.allSettled(
        chunk.map(async (id) => {
          const rec: PushSubRecord | null = await storage.getPushSub(id);
          // 레코드가 없는 id(TTL 만료·복호화 불가)는 집합에 남은 고아 — 정리
          if (!rec) {
            await storage.deletePushSub(id);
            return "skip" as const;
          }
          const r = await sendPush(rec, payload);
          if (r === "gone") await storage.deletePushSub(id);
          return r;
        }),
      );
      for (const r of results) {
        if (r.status !== "fulfilled") failed++;
        else if (r.value === "ok") sent++;
        else if (r.value === "gone") removed++;
        else if (r.value === "fail") failed++;
      }
    }
  }
  return json({ sent, failed, removed, duplicate });
}
