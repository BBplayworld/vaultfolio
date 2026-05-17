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
    // KR refDate만 키에 포함 → KR 컷오프(16:00 KST) 전후 자동 무효화
    // us_refDate는 KST 자정에 kr_refDate와 함께 변경되므로 키에서 빠져도 동기화 동일
    const kr = getDailyClosingRefDates("domestic").refDate;
    return `${STORAGE_KEY_PREFIXES.profit}daily:${kr}:${tickers}`;
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
  // 디버그용: 호출자 식별자 (콘솔 로그에 [PROFIT][caller] 형식으로 표시)
  caller?: string;
}

// 호출 일련번호 (디버그 추적용)
let profitCallSeq = 0;
const DEBUG_PROFIT = typeof window !== "undefined";
const dlog = (caller: string, callId: number, msg: string, ...rest: unknown[]) => {
  if (!DEBUG_PROFIT) return;
  console.log(`[PROFIT][#${callId}][${caller}] ${msg}`, ...rest);
};

// 동일 cacheKey로 진행 중인 호출을 추적 — 두 호출자가 동시에 캐시 miss 시 한쪽만 fetch하고 결과 공유
const inFlightFetches = new Map<string, Promise<ProfitRefResponse>>();

export async function fetchProfitRef(
  tickers: string,
  period: ProfitPeriod,
  options: FetchProfitRefOptions = {},
): Promise<ProfitRefResponse> {
  const { onProgress, onComplete, signal, caller = "unknown" } = options;
  const callId = ++profitCallSeq;
  const cacheKey = getProfitCacheKey(tickers, period);
  dlog(caller, callId, `start period=${period} tickers=${tickers.slice(0, 50)}${tickers.length > 50 ? "..." : ""} signalAttached=${!!signal}`);
  if (!signal) {
    console.warn(`[PROFIT][#${callId}][${caller}] signal 미전달 — 이 호출은 abort 불가`);
  }
  signal?.addEventListener("abort", () => dlog(caller, callId, "signal aborted"), { once: true });
  try {
    const raw = localStorage.getItem(cacheKey);
    if (raw) {
      const cached = JSON.parse(raw) as ProfitRefResponse;
      onProgress?.(cached);
      onComplete?.(true);
      dlog(caller, callId, "cache hit (localStorage)");
      return cached;
    }
  } catch { /* ignore */ }

  // 동일 cacheKey로 진행 중인 fetch가 있으면 그 결과를 공유 (네트워크 중복 호출 방지)
  // dedup된 호출자는 점진 노출 없이 최종 결과만 1회 받음 (캐시 hit과 동일 취급)
  const existing = inFlightFetches.get(cacheKey);
  if (existing) {
    dlog(caller, callId, "dedup: 진행 중 fetch에 합류");
    const result = await existing;
    if (!signal?.aborted) {
      onProgress?.(result);
      onComplete?.(true);
    }
    dlog(caller, callId, `dedup 종료 aborted=${!!signal?.aborted}`);
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
      if (signal?.aborted) { dlog(caller, callId, `batch ${i} 진입 차단 (aborted)`); break; }
      if (i > 0) {
        dlog(caller, callId, `batch ${i} sleep 시작`);
        await sleepAbortable(PROFIT_BATCH_DELAY_MS);
        dlog(caller, callId, `batch ${i} sleep 종료 aborted=${!!signal?.aborted}`);
      }
      if (signal?.aborted) { dlog(caller, callId, `batch ${i} sleep 후 abort 감지 → break`); break; }
      const batchTickers = tickerArr.slice(i, i + PROFIT_BATCH_SIZE).join(",");
      dlog(caller, callId, `batch ${i} fetch 시작 [${batchTickers}]`);
      try {
        const res = await fetch(`/api/finance/profit?tickers=${batchTickers}&period=${period}`, { signal });
        if (res.ok) {
          const data: ProfitRefResponse = await res.json();
          Object.assign(merged, data);
          onProgress?.({ ...merged });
          dlog(caller, callId, `batch ${i} fetch 완료 (응답 반영)`);
        }
      } catch (e) {
        dlog(caller, callId, `batch ${i} fetch 예외`, (e as Error)?.name ?? e);
      }
    }
    // 모든 배치 완료 후에만 1회 저장 (부분 결과가 캐시 hit으로 오인되어 나머지 fetch가 안 되는 문제 방지)
    if (!signal?.aborted) {
      try { localStorage.setItem(cacheKey, JSON.stringify(merged)); } catch { /* ignore */ }
      onComplete?.(false);
      dlog(caller, callId, "전체 완료 + 캐시 저장");
    } else {
      dlog(caller, callId, "전체 종료 (aborted, 캐시 저장 스킵)");
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
