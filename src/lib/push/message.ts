// 시장 알림 문구 생성(#179) — 순수 함수. 금액·'내'·'보유'·평가어·조언·끝 안내 문구 0.
// 부호·소수 1자리는 홈 '오늘 시장'과 같은 formatCompareRate를 쓴다(C80/C84).
import { formatCompareRate, rateTenths } from "@/lib/finance/market-compare";
import type { PushCond, PushMarket, PushPayload } from "./types";

export const PUSH_FALLBACK_TITLE = "시장 종가";
export const PUSH_FALLBACK_BODY = "오늘 시장 종가가 업데이트됐어요";
export const PUSH_PM2_TENTHS = 20; // ±2.0% 이상
const MAX_ITEMS = 4;
const MAX_BODY_CHARS = 56; // 잠금화면 2줄 기준 — 실기기 보정 대상

export interface PushItem {
  label: string;
  rate: number; // 전일 대비 %
}

/** '2026-11-12' → '11/12' */
export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function buildPushMessage(
  market: PushMarket,
  marketDate: string,
  items: readonly PushItem[],
  cond: PushCond,
): PushPayload | null {
  const picked = cond === "pm2" ? items.filter((i) => Math.abs(rateTenths(i.rate)) >= PUSH_PM2_TENTHS) : [...items];
  if (picked.length === 0) return null;

  const parts: string[] = [];
  let length = 0;
  for (const it of picked) {
    const part = `${it.label} ${formatCompareRate(it.rate)}`;
    const next = length + (parts.length > 0 ? 3 : 0) + part.length; // " · " 3자
    if (parts.length >= 1 && (parts.length >= MAX_ITEMS || next > MAX_BODY_CHARS)) break;
    parts.push(part);
    length = next;
  }
  const rest = picked.length - parts.length;
  const body = parts.join(" · ") + (rest > 0 ? ` 외 ${rest}개` : "");
  return { m: market, t: `${formatMonthDay(marketDate)} ${market === "kr" ? "국내" : "미국"} 종가`, b: body };
}
