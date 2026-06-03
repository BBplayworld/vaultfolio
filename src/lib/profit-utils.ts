import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { STORAGE_KEYS, STORAGE_KEY_PREFIXES } from "@/lib/local-storage";
import type { Stock } from "@/types/asset";
import { normalizeTicker } from "@/lib/finance-service";
import { isUsEasternDST } from "@/lib/stock-cache-slot";

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

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
    // ET 거래일 = 동일 KST 날짜의 환율 (ET 마감=KST 새벽, FX 미개장 → 전일 환율 적용)
    const prevRate = rateFor(getRatesForDate(ref.prevDate, currentRates));
    const refRate = rateFor(getRatesForDate(ref.refDate, currentRates));
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

// 기간별 수익 종가 기준 옵션
// - sameBusinessDay(동일 영업일, 기본): 국내·해외 모두 해외(foreign) 영업일로 정렬
// - kstAccessDay(KST 접속일): 국내=domestic, 해외=foreign 독립 산출 (현행)
export type ProfitBasis = "sameBusinessDay" | "kstAccessDay";

export const DEFAULT_PROFIT_BASIS: ProfitBasis = "sameBusinessDay";

export function getProfitBasis(): ProfitBasis {
  if (typeof window === "undefined") return DEFAULT_PROFIT_BASIS;
  const v = localStorage.getItem(STORAGE_KEYS.profitBasis);
  return v === "kstAccessDay" || v === "sameBusinessDay" ? v : DEFAULT_PROFIT_BASIS;
}

export function setProfitBasis(basis: ProfitBasis): void {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEYS.profitBasis, basis); } catch { /* ignore */ }
}

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
    // 해외: 어제 KST 영업일 (마감 후 1시간까지는 한 칸 더 과거 — KIS 게시 지연 안전망)
    // 미국장 마감: DST(ET 16:00) = KST 05:00 → 컷오프 06:00, STD = KST 06:00 → 컷오프 07:00
    // 새벽 ET 장중 시간대에 요청 시 KIS가 직전 완료일을 반환하여 stale 매핑이 영구 저장되는 문제 방지
    const hhmm = nowKST.getUTCHours() * 100 + nowKST.getUTCMinutes();
    const cutoff = isUsEasternDST(new Date()) ? 600 : 700;
    ref.setUTCDate(ref.getUTCDate() - 1);
    rollbackToWeekday(ref);
    if (hhmm < cutoff) {
      ref.setUTCDate(ref.getUTCDate() - 1);
      rollbackToWeekday(ref);
    }
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

// 캐시 키의 기간 경계 토큰(날짜 부분). 캐시 키 생성과 옛 키 정리(prunePeriodProfitCache)가 공유
export function getProfitCacheToken(
  period: ProfitPeriod,
  basis: ProfitBasis = "kstAccessDay",
): string {
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().split("T")[0];
  if (period === "monthly") return todayStr.slice(0, 7);
  if (period === "yearly") return todayStr.slice(0, 4);
  if (period === "daily") {
    // 국내·해외 컷오프가 독립적(국내 16:00, 해외 06:00/07:00 KST)이므로 두 시장 기준일을 모두 포함
    // → kstAccessDay에서 해외 컷오프만 지나도(국내 16:00 전) 캐시가 무효화되어 해외 종가가 갱신됨
    // (sameBusinessDay는 둘 다 해외 기준이라 동일 값)
    const krRef = getDailyClosingRefDates(basis === "sameBusinessDay" ? "foreign" : "domestic").refDate;
    const usRef = getDailyClosingRefDates("foreign").refDate;
    return `${krRef}_${usRef}`;
  }
  return todayStr; // weekly 등
}

export function getProfitCacheKey(
  tickers: string,
  period: ProfitPeriod,
  basis: ProfitBasis = "kstAccessDay",
): string {
  const p = `${STORAGE_KEY_PREFIXES.profit}${basis}:`;
  return `${p}${period}:${getProfitCacheToken(period, basis)}:${tickers}`;
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

// 서버 3일치 환율 이력을 로컬에 보충 — 로컬에 없는 날짜만 추가(로컬 우선, 서버는 빈칸 보충)
// 해외 일별수익의 전날 환율을 미접속 기기에서도 동일하게 확보하기 위함
export function mergeExchangeHistory(server: Record<string, { USD: number; JPY: number }>): void {
  if (typeof window === "undefined" || !server) return;
  const history = readExchangeHistory();
  let changed = false;
  for (const [date, rates] of Object.entries(server)) {
    if (history[date]) continue; // 로컬 우선: 이미 있으면 보존
    if (!rates || typeof rates.USD !== "number") continue;
    history[date] = { USD: rates.USD, JPY: rates.JPY };
    changed = true;
  }
  if (changed) writeExchangeHistory(history);
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

// 현재가 갱신과 동일한 배치 패턴 (asset-data-context.tsx BATCH_SIZE/BATCH_DELAY_MS 참조)
// KIS rate limit 회피: 3개씩 묶어 1초 간격으로 순차 호출
const PROFIT_BATCH_SIZE = 3;
const PROFIT_BATCH_DELAY_MS = 1000;

interface FetchProfitRefOptions {
  // 배치 응답이 올 때마다 누적 결과를 콜백으로 전달 (점진 노출용)
  onProgress?: (partial: ProfitRefResponse) => void;
  // 모든 배치 완료(또는 캐시 hit) 시 호출. fromCache=true면 네트워크 호출 없이 즉시 반환된 것
  onComplete?: (fromCache: boolean) => void;
  // 중단 신호 (탭 전환 등). true 반환 시 다음 배치 전 종료
  signal?: AbortSignal;
  // 호출자 식별자 (signal 미전달 등 경고 로그에 사용)
  caller?: string;
  // 종가 기준 옵션. 미전달 시 kstAccessDay(legacy: 스냅샷·기존 호출 동작 보존)
  basis?: ProfitBasis;
}

// 동일 cacheKey로 진행 중인 호출을 추적 — 두 호출자가 동시에 캐시 miss 시 한쪽만 fetch하고 결과 공유
const inFlightFetches = new Map<string, Promise<ProfitRefResponse>>();

export async function fetchProfitRef(
  tickers: string,
  period: ProfitPeriod,
  options: FetchProfitRefOptions = {},
): Promise<ProfitRefResponse> {
  const { onProgress, onComplete, signal, caller = "unknown", basis = "kstAccessDay" } = options;
  const cacheKey = getProfitCacheKey(tickers, period, basis);
  if (!signal) {
    console.warn(`[PROFIT][${caller}] signal 미전달 — 이 호출은 abort 불가`);
  }
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as ProfitRefResponse;
      onProgress?.(cached);
      onComplete?.(true);
      return cached;
    }
  } catch { /* ignore */ }

  // 동일 cacheKey로 진행 중인 fetch가 있으면 그 결과를 공유 (네트워크 중복 호출 방지)
  // dedup된 호출자는 점진 노출 없이 최종 결과만 1회 받음 (캐시 hit과 동일 취급)
  const existing = inFlightFetches.get(cacheKey);
  if (existing) {
    const result = await existing;
    if (!signal?.aborted) {
      onProgress?.(result);
      onComplete?.(true);
    }
    return result;
  }

  // abort 가능한 sleep — signal abort 시 즉시 깨어나 다음 배치 진입을 차단
  const sleepAbortable = (ms: number) => new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });

  // abort 시 inFlightFetches에서 즉시 제거 — 후속 호출자가 죽은 promise에 묶이지 않도록
  const cleanupInFlight = () => {
    if (inFlightFetches.get(cacheKey) === promise) inFlightFetches.delete(cacheKey);
  };
  signal?.addEventListener("abort", cleanupInFlight, { once: true });

  const runFetch = async (): Promise<ProfitRefResponse> => {
    const tickerArr = tickers.split(",").filter(Boolean);
    const merged: ProfitRefResponse = {};
    for (let i = 0; i < tickerArr.length; i += PROFIT_BATCH_SIZE) {
      if (signal?.aborted) break;
      if (i > 0) await sleepAbortable(PROFIT_BATCH_DELAY_MS);
      if (signal?.aborted) break;
      const batchTickers = tickerArr.slice(i, i + PROFIT_BATCH_SIZE).join(",");
      try {
        const res = await fetch(`/api/finance/profit?tickers=${batchTickers}&period=${period}&basis=${basis}`, { signal });
        if (res.ok) {
          const data: ProfitRefResponse = await res.json();
          Object.assign(merged, data);
          onProgress?.({ ...merged });
        }
      } catch { /* abort 등 정상 흐름 */ }
    }
    // 모든 배치 완료 후에만 1회 저장 (부분 결과가 캐시 hit으로 오인되어 나머지 fetch가 안 되는 문제 방지)
    if (!signal?.aborted) {
      try { localStorage.setItem(cacheKey, JSON.stringify(merged)); } catch { /* ignore */ }
      onComplete?.(false);
    }
    return merged;
  };

  const promise = runFetch();
  inFlightFetches.set(cacheKey, promise);
  try {
    return await promise;
  } finally {
    cleanupInFlight();
  }
}
