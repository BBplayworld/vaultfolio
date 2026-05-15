import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { STORAGE_KEYS, STORAGE_KEY_PREFIXES } from "@/lib/local-storage";
import type { Stock } from "@/types/asset";
import { normalizeTicker } from "@/lib/finance-service";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

// 한투 API가 반환하는 해외 거래일을 KST 일자 표기로 +1일 변환
// 환율 매칭에 사용 (스냅샷의 환율은 KST 일자 기준으로 저장됨)
function shiftUsDate(date: string | undefined): string | undefined {
  if (!date) return date;
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// 일별 수익 계산 — profit-chart daily와 stock-tab의 "전일 대비"가 같은 값을 쓰도록 통일
// 모든 종목의 종가 vs 종가 비교, 시점별 환율(prev=어제, ref=오늘) 적용
export function computeDailyStockProfit(
  stocks: Stock[],
  refData: ProfitRefResponse | undefined,
  currentRates: { USD: number; JPY: number },
): { dailyProfit: number | null; dailyProfitRate: number | null } {
  if (!refData) return { dailyProfit: null, dailyProfitRate: null };
  let profitSum = 0;
  let refSum = 0;
  let hasAny = false;
  for (const st of stocks) {
    if (!st.ticker || st.category === "unlisted" || !st.currentPrice) continue;
    const ticker = normalizeTicker(st);
    const ref = refData[ticker];
    if (!ref || ref.prevPrice === undefined || ref.prevDate === undefined) continue;
    const isUS = st.currency === "USD" && !DOMESTIC_CATEGORIES.has(st.category);
    const isJP = st.currency === "JPY" && !DOMESTIC_CATEGORIES.has(st.category);
    const rateFor = (rates: { USD: number; JPY: number }) =>
      isUS ? rates.USD : isJP ? rates.JPY / 100 : 1;
    // 해외는 한투 거래일 +1일이 KST 일자 → 환율 매칭
    const prevRateDate = (isUS || isJP) ? shiftUsDate(ref.prevDate) : ref.prevDate;
    const refRateDate = (isUS || isJP) ? shiftUsDate(ref.refDate) : ref.refDate;
    const prevRate = rateFor(getRatesForDate(prevRateDate!, currentRates));
    const refRate = rateFor(getRatesForDate(refRateDate!, currentRates));
    const currentValue = ref.refPrice * st.quantity * refRate;
    const refValue = ref.prevPrice * st.quantity * prevRate;
    profitSum += currentValue - refValue;
    refSum += refValue;
    hasAny = true;
  }
  if (!hasAny) return { dailyProfit: null, dailyProfitRate: null };
  return {
    dailyProfit: profitSum,
    dailyProfitRate: refSum > 0 ? (profitSum / refSum) * 100 : 0,
  };
}

export type ProfitPeriod = "daily" | "weekly" | "monthly" | "yearly";

function formatYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function rollbackToWeekday(d: Date): void {
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() - 1);
  }
}

// 일별 종가 비교쌍 산출 (KST, 시장별 보정 + 토/일 보정)
// - domestic: 16:00 컷오프 — 장후면 ref=오늘, 장중이면 ref=어제
// - foreign:  미국장이 같은 KST 일자에 다시 열려 한투 API가 장중 데이터를 줄 수 있으므로
//             항상 ref=어제 KST 영업일(=새벽에 완전 마감된 미국 종가)
// 일별 수익 = ref 종가 - prev 종가
export function getDailyClosingRefDates(market: "domestic" | "foreign"): { prevDate: string; refDate: string } {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayDow = nowKST.getUTCDay();

  const ref = new Date(nowKST);
  if (market === "foreign") {
    // 해외: 항상 어제 KST 영업일
    ref.setUTCDate(ref.getUTCDate() - 1);
    rollbackToWeekday(ref);
  } else {
    // 국내: 컷오프 이후 평일이면 오늘, 그 외엔 직전 영업일
    const hhmm = nowKST.getUTCHours() * 100 + nowKST.getUTCMinutes();
    const afterCutoffOnWeekday = hhmm >= 1600 && todayDow !== 0 && todayDow !== 6;
    if (!afterCutoffOnWeekday) {
      ref.setUTCDate(ref.getUTCDate() - 1);
      rollbackToWeekday(ref);
    }
  }
  const prev = new Date(ref);
  prev.setUTCDate(prev.getUTCDate() - 1);
  rollbackToWeekday(prev);

  return { prevDate: formatYmd(prev), refDate: formatYmd(ref) };
}

// 단일 기준일 반환 — 기존 호출처 호환용 (ref 날짜만 사용)
export function getDailyClosingRefDate(market: "domestic" | "foreign"): string {
  return getDailyClosingRefDates(market).refDate;
}

export function getProfitCacheKey(tickers: string, period: ProfitPeriod): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  if (period === "monthly") return `${STORAGE_KEY_PREFIXES.profit}monthly:${todayStr.slice(0, 7)}:${tickers}`;
  if (period === "yearly") return `${STORAGE_KEY_PREFIXES.profit}yearly:${todayStr.slice(0, 4)}:${tickers}`;
  if (period === "daily") {
    // 시장별 기준일을 키에 포함 → 장중/장후 전환 시 자동 캐시 무효화
    const kr = getDailyClosingRefDates("domestic").refDate;
    const us = getDailyClosingRefDates("foreign").refDate;
    return `${STORAGE_KEY_PREFIXES.profit}daily:${kr}_${us}:${tickers}`;
  }
  return `${STORAGE_KEY_PREFIXES.profit}${period}:${todayStr}:${tickers}`;
}

// 환율 이력 (날짜별 USD/JPY)
type ExchangeHistory = Record<string, { USD: number; JPY: number }>;

function readExchangeHistory(): ExchangeHistory {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.exchangeHistory);
    return raw ? (JSON.parse(raw) as ExchangeHistory) : {};
  } catch {
    return {};
  }
}

function writeExchangeHistory(h: ExchangeHistory): void {
  try {
    localStorage.setItem(STORAGE_KEYS.exchangeHistory, JSON.stringify(h));
  } catch { /* ignore */ }
}

// 오늘자 환율 기록 (입장 시 1회 호출). 한 달치만 유지.
export function recordTodayExchangeRate(rates: { USD: number; JPY: number }): void {
  if (typeof window === "undefined") return;
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  const history = readExchangeHistory();
  history[todayStr] = { USD: rates.USD, JPY: rates.JPY };
  // 30일 이전 항목 정리
  const cutoff = new Date(nowKST);
  cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  for (const date of Object.keys(history)) {
    if (date < cutoffStr) delete history[date];
  }
  writeExchangeHistory(history);
}

// 특정 일자의 환율 조회. 없으면 fallback.
// 클라이언트 전용 (localStorage 접근)
export function getRatesForDate(
  date: string,
  fallback: { USD: number; JPY: number },
): { USD: number; JPY: number } {
  if (typeof window === "undefined") return fallback;
  const history = readExchangeHistory();
  const found = history[date];
  if (!found) return fallback;
  return { USD: found.USD, JPY: found.JPY };
}

export async function fetchProfitRef(tickers: string, period: ProfitPeriod): Promise<ProfitRefResponse> {
  const cacheKey = getProfitCacheKey(tickers, period);
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) return JSON.parse(raw) as ProfitRefResponse;
  } catch { /* ignore */ }
  const res = await fetch(`/api/finance/profit?tickers=${tickers}&period=${period}`);
  if (!res.ok) return {};
  const data: ProfitRefResponse = await res.json();
  try { localStorage.setItem(cacheKey, JSON.stringify(data)); } catch { /* ignore */ }
  return data;
}
