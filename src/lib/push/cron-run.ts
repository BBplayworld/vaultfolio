import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";
import { isKrBusinessDay, rollbackToBusinessDay } from "@/lib/finance/kr-holidays";
import { rollbackToUsBusinessDay } from "@/lib/finance/us-holidays";
import { withinUpstreamBudget } from "@/server/api-guard";
import { buildKrCloseMessage, buildMorningMessage, isRepeatedClose, mergePushPayloads, pushDueOn } from "./message";
import { estimateKisCalls, fetchKrQuotes, fetchUsQuotes, shiftDate, type PushQuote } from "./quotes";
import { isPushConfigured, sendPush } from "./send";
import type { PushKind, PushPayload, PushSubRecord } from "./types";

// 알림 발송(#179, 4.91, 운영 Cron 전용). Cron 2개: morning(00:00 UTC = KST 09:00) · kr(07:00 UTC = KST 16:00).
// 중복 알림 금지 우선 — 종류·날짜 플래그를 보내기 직전에 잡고 실패해도 풀지 않는다(시세 조회 실패로 못 보낸 종류는 플래그를 잡지 않는다).
// 응답·로그는 건수·항목 상태만(구독·endpoint 정보 0). 중단 스위치: Vercel 대시보드 Cron Jobs의 Disable(재배포 불필요).

export type CronRound = "morning" | "kr";

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

/** 시세 조회(운영 Cron·preview 테스트 공용) — 직전 거래일 종가(미국·국내), kr 회차는 오늘 국내 종가. 토큰·예산 실패면 빈 배열 + status */
export async function loadPushQuotes(today: string, needUs: boolean, needKr: boolean, round: CronRound): Promise<{ us: PushQuote[]; kr: PushQuote[]; status: Record<string, string> }> {
  let us: PushQuote[] = [];
  let kr: PushQuote[] = [];
  const status: Record<string, string> = {};
  if (!needUs && !needKr) return { us, kr, status };
  const { token } = await getKisAccessToken(today);
  if (!token || !(await withinUpstreamBudget("kis", estimateKisCalls(needUs, needKr)))) {
    status.kis = token ? "budget" : "no-token";
    return { us, kr, status };
  }
  const ctx = { accessToken: token, appKey: process.env.KIS_APP_KEY ?? "", appSecret: process.env.KIS_APP_SECRET ?? "" };
  const first = { first: true };
  const yesterday = new Date(`${shiftDate(today, -1)}T00:00:00Z`);
  if (needUs) {
    const seg = await fetchUsQuotes(rollbackToUsBusinessDay(yesterday).toISOString().slice(0, 10), ctx, first);
    us = seg.quotes;
    for (const [k, v] of Object.entries(seg.status)) status[`us.${k}`] = v;
  }
  if (needKr) {
    const krDate = round === "kr" ? today : rollbackToBusinessDay(yesterday).toISOString().slice(0, 10);
    const seg = await fetchKrQuotes(krDate, ctx, first);
    kr = seg.quotes;
    for (const [k, v] of Object.entries(seg.status)) status[`kr.${k}`] = v;
  }
  if (us.length + kr.length === 0) await recordKisFailure();
  else await recordKisSuccess();
  return { us, kr, status };
}

export async function runPushCron(req: Request, round: CronRound = "morning"): Promise<NextResponse> {
  if (!isCronAuthorized(req.headers.get("authorization"))) return json({ error: "unauthorized" }, 401);
  if (process.env.VERCEL_ENV !== "production") return new NextResponse(null, { status: 204 });

  // 키 미설정이면 복호화가 전부 실패해 고아 정리가 구독을 지우므로 플래그 전에 중단
  if (!isPushConfigured()) return json({ skipped: "not-configured" });

  const today = kstToday(Date.now());
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const staticDue = round === "morning" ? pushDueOn(today) : [];
  const dueKinds: PushKind[] = staticDue.map((d) => d.kind);
  if (round === "morning" && weekday >= 1 && weekday <= 5) dueKinds.push("morning"); // 한국 휴장일에도 발송
  if (round === "kr" && isKrBusinessDay(new Date(`${today}T00:00:00Z`))) dueKinds.push("kr");
  if (dueKinds.length === 0) return json({ skipped: "no-event" });

  const storage = getCacheStorage();
  const ids = await storage.listPushSubIdsByTopics(dueKinds);
  const subs: { id: string; rec: PushSubRecord }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const recs = await Promise.all(chunk.map((id) => storage.getPushSub(id)));
    // 레코드가 없는 id(TTL 만료·복호화 불가)는 집합에 남은 고아 — 정리
    for (let j = 0; j < recs.length; j++) {
      const rec = recs[j];
      if (rec) {
        subs.push({ id: chunk[j], rec });
        await storage.capLegacyPushTtl(chunk[j]); // 구 형식이면 만료를 30일로 1회 축소
      } else await storage.deletePushSub(chunk[j]);
    }
  }
  if (subs.length === 0) return json({ skipped: "no-subscribers" });
  const needed = new Set(dueKinds.filter((k) => subs.some((s) => s.rec.topics.includes(k))));

  // 시세 — 아침(미국·국내 직전 거래일 종가)·국내(오늘 종가). 실패해도 결산·세금은 그대로 보낸다
  // 직전 아침 요약과 같은 거래일이면 조회하지 않는다(같은 종가 반복 방지, 날짜 계산만)
  const needUs = needed.has("morning") && !isRepeatedClose(today, "us");
  const needKr = (needed.has("morning") && !isRepeatedClose(today, "kr")) || needed.has("kr");
  const { us, kr, status } = await loadPushQuotes(today, needUs, needKr, round);

  // 종류·날짜 중복 방지 플래그 — 보낼 내용이 있는 종류만 잡는다(시세가 전부 없으면 시장 종류는 잡지 않음)
  const alive = new Set<PushKind>();
  let duplicate = 0;
  for (const kind of needed) {
    const hasContent = kind === "morning" ? us.length + kr.length > 0 : kind === "kr" ? kr.length > 0 : true;
    if (!hasContent) continue;
    if (await storage.markPushSent(kind, today)) alive.add(kind);
    else duplicate++;
  }

  const staticByKind = new Map(staticDue.map((d) => [d.kind, d.payload]));
  const payloadFor = (rec: PushSubRecord): PushPayload | null => {
    const list: PushPayload[] = [];
    for (const k of rec.topics) {
      if (!alive.has(k as PushKind)) continue;
      const p =
        k === "morning" ? buildMorningMessage(today, us, kr, rec.cond) : k === "kr" ? buildKrCloseMessage(today, kr, rec.cond) : staticByKind.get(k as PushKind);
      if (p) list.push(p);
    }
    return mergePushPayloads(list);
  };

  let sent = 0;
  let failed = 0;
  let removed = 0;
  let skipped = 0;
  for (let i = 0; i < subs.length; i += CHUNK) {
    const results = await Promise.allSettled(
      subs.slice(i, i + CHUNK).map(async ({ id, rec }) => {
        const payload = payloadFor(rec);
        if (!payload) return "skip" as const;
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
      else skipped++;
    }
  }
  // 운영 첫 실행 확인(C96) — 대상별 성공·제외 상태와 건수. endpoint·키 0
  console.info(`[push-cron] round=${round} date=${today} kinds=${[...alive].join(",") || "-"} quotes=${JSON.stringify(status)} sent=${sent} failed=${failed} removed=${removed} skipped=${skipped} duplicate=${duplicate}`);
  return json({ sent, failed, removed, skipped, duplicate, quotes: status });
}
