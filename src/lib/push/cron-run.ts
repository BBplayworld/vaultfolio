import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { getCacheStorage } from "@/lib/cache-storage";
import { getKisAccessToken, recordKisFailure, recordKisSuccess } from "@/lib/finance/kis-token";
import { isKrBusinessDay } from "@/lib/finance/kr-holidays";
import { isUsBusinessDay } from "@/lib/finance/us-holidays";
import { withinUpstreamBudget } from "@/server/api-guard";
import { PUSH_CATALOG, topicsOfMarket } from "./catalog";
import { buildPushMessage, type PushItem } from "./message";
import { estimateKisCalls, fetchPushRates } from "./quotes";
import { sendPush } from "./send";
import type { PushMarket, PushSubRecord } from "./types";

// 거래일 종가 요약 발송(#179, 운영 Cron 전용). 중복 알림 금지 우선 — 회차 플래그를 먼저 잡고 실패해도 풀지 않는다.
// 응답은 건수만(구독·endpoint 정보 0).

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

/** 회차 판정 — 시각(KST)·거래일. 해당 없으면 사유 문자열 */
export function resolveCronWindow(
  market: PushMarket,
  nowMs: number,
): { ok: true; marketDate: string; todayStr: string } | { ok: false; reason: string } {
  const kst = new Date(nowMs + KST_MS);
  const todayStr = kst.toISOString().slice(0, 10);
  const hour = kst.getUTCHours();
  // 방어: kr은 KST 16시 이후, us는 KST 09시 이후(수동 호출·잘못된 설정 방어)
  if (market === "kr" && hour < 16) return { ok: false, reason: "too-early" };
  if (market === "us" && hour < 9) return { ok: false, reason: "too-early" };
  if (market === "kr") {
    return isKrBusinessDay(new Date(`${todayStr}T00:00:00Z`)) ? { ok: true, marketDate: todayStr, todayStr } : { ok: false, reason: "holiday" };
  }
  // 미국 장은 한국 시간 다음 날 새벽에 마감 → 알림 시점(KST 아침)의 전날이 미국 거래일
  const d = new Date(`${todayStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return isUsBusinessDay(d) ? { ok: true, marketDate: d.toISOString().slice(0, 10), todayStr } : { ok: false, reason: "holiday" };
}

export async function runPushCron(req: Request, market: PushMarket): Promise<NextResponse> {
  if (!isCronAuthorized(req.headers.get("authorization"))) return json({ error: "unauthorized" }, 401);
  if (process.env.VERCEL_ENV !== "production") return new NextResponse(null, { status: 204 });

  const win = resolveCronWindow(market, Date.now());
  if (!win.ok) return json({ skipped: win.reason });

  const storage = getCacheStorage();
  if (!(await storage.markPushSent(market, win.marketDate))) return json({ skipped: "duplicate" });

  const marketTopics = PUSH_CATALOG.filter((t) => t.market === market);
  const ids = await storage.listPushSubIdsByTopics(marketTopics.map((t) => t.id));
  if (ids.length === 0) return json({ skipped: "no-subscribers" });

  const subs: { id: string; rec: PushSubRecord }[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const recs = await Promise.all(chunk.map((id) => storage.getPushSub(id)));
    recs.forEach((rec, j) => rec && subs.push({ id: chunk[j], rec }));
  }
  if (subs.length === 0) return json({ skipped: "no-subscribers" });

  const needed = new Set(subs.flatMap((s) => s.rec.topics));
  const neededTopics = marketTopics.filter((t) => needed.has(t.id));
  if (neededTopics.length === 0) return json({ skipped: "no-topics" });

  const { token, unavailable } = await getKisAccessToken(win.todayStr);
  if (!token) return json({ skipped: unavailable ? "kis-unavailable" : "no-token" });
  if (!(await withinUpstreamBudget("kis", estimateKisCalls(neededTopics)))) return json({ skipped: "budget" });

  const rates = await fetchPushRates(neededTopics, {
    market,
    marketDate: win.marketDate,
    todayStr: win.todayStr,
    accessToken: token,
    appKey: process.env.KIS_APP_KEY ?? "",
    appSecret: process.env.KIS_APP_SECRET ?? "",
  });
  if (Object.keys(rates).length === 0) {
    await recordKisFailure();
    return json({ skipped: "no-quotes" });
  }
  await recordKisSuccess();

  let sent = 0;
  let failed = 0;
  let removed = 0;
  for (let i = 0; i < subs.length; i += CHUNK) {
    const chunk = subs.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      chunk.map(async ({ id, rec }) => {
        const items: PushItem[] = topicsOfMarket(rec.topics, market)
          .filter((t) => t.id in rates)
          .map((t) => ({ label: t.label, rate: rates[t.id] }));
        const payload = buildPushMessage(market, win.marketDate, items, rec.cond);
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
    }
  }
  return json({ sent, failed, removed });
}
