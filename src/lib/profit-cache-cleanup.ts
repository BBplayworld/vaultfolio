/**
 * profit-cache-cleanup.ts
 * 기간별 수익(profit) localStorage 캐시 정리 전용 모듈.
 *
 * 캐시 키 형식: `secretasset_profit:{basis}:{period}:{token}:{tickers}`
 * - basis:  sameBusinessDay | kstAccessDay
 * - period: daily | weekly | monthly | yearly
 * - token:  기간 경계 식별자 (getProfitCacheToken). daily=`{krRef}_{usRef}`, weekly=YYYY-MM-DD, monthly=YYYY-MM, yearly=YYYY
 *
 * 날짜·주·월·년이 바뀌면 token이 달라져 옛 키가 고아로 남으므로,
 * 진입 시 각 (basis, period)의 현재 유효 token만 남기고 나머지를 제거한다.
 */

import { STORAGE_KEY_PREFIXES } from "@/lib/local-storage";
import { getProfitCacheToken, type ProfitBasis, type ProfitPeriod } from "@/lib/profit-utils";

const BASES: ProfitBasis[] = ["sameBusinessDay", "kstAccessDay"];
const PERIODS: ProfitPeriod[] = ["daily", "weekly", "monthly", "yearly"];

// 현재 유효 토큰을 벗어난 옛 profit 캐시 키 제거. 제거한 키 개수 반환.
export function prunePeriodProfitCache(): number {
  if (typeof window === "undefined") return 0;
  const prefix = STORAGE_KEY_PREFIXES.profit; // "secretasset_profit:"

  // (basis:period) → 현재 유효 토큰
  const validToken = new Map<string, string>();
  for (const basis of BASES) {
    for (const period of PERIODS) {
      validToken.set(`${basis}:${period}`, getProfitCacheToken(period, basis));
    }
  }

  let removed = 0;
  for (const key of Object.keys(localStorage)) {
    if (!key.startsWith(prefix)) continue;
    // key 구조: {prefix}{basis}:{period}:{token}:{tickers}
    const [basis, period, token] = key.slice(prefix.length).split(":");
    const expected = validToken.get(`${basis}:${period}`);
    if (expected === undefined) continue; // 알 수 없는 형식은 보존
    if (token !== expected) {
      localStorage.removeItem(key);
      removed++;
    }
  }
  return removed;
}
