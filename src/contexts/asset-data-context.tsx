"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { AssetData, RealEstate, Stock, Crypto, Cash, Loan, YearlyNetAsset, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot, AssetSnapshots, Transaction } from "@/types/asset";
import { getAssetData, saveAssetData, saveAssetDataRaw, STORAGE_KEYS, migrateStorageKeys, parseShareToken } from "@/lib/asset-storage";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import { normalizeTicker, resolveStockName, type StockClassificationPatch } from "@/lib/finance-service";
import { upsertClassifications } from "@/lib/xray/classification-store";
import { getStockCacheSlot } from "@/lib/stock-cache-slot";
import { pruneTransactions } from "@/lib/trade-utils";
import { persistNickname } from "@/hooks/use-nickname";
import { fetchProfitRef, recordTodayExchangeRate, mergeExchangeHistory, type ProfitBasis } from "@/lib/profit-utils";
import { prunePeriodProfitCache } from "@/lib/profit-cache-cleanup";
import { useProfitBasisStore } from "@/stores/profit-basis-store";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { toast } from "sonner";
import { updateThemeMode } from "@/lib/theme-utils";
import { setValueToCookie } from "@/server/server-actions";
import { usePreferencesStore } from "@/stores/preferences/preferences-provider";

// 토스트가 일정 시간 이상 노출 중일 경우 자동으로 닫히도록 타임스탬프 추적
let lastToastAt = 0;
const TOAST_STALE_MS = 4_000;

const dismissStaleToasts = () => {
  const now = Date.now();
  if (lastToastAt > 0 && now - lastToastAt > TOAST_STALE_MS) {
    toast.dismiss();
  }
  lastToastAt = now;
};

// /api/finance 응답에서 KIS 분류 patch 수확 → 클라 분류 캐시 머지
function harvestClassifications(stocksData: Record<string, { classification?: StockClassificationPatch }>): void {
  const patches: Record<string, Record<string, unknown>> = {};
  for (const [ticker, result] of Object.entries(stocksData)) {
    if (result?.classification) patches[ticker] = { ...result.classification } as Record<string, unknown>;
  }
  if (Object.keys(patches).length > 0) {
    upsertClassifications(patches);
  }
}
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Lock, Share2 } from "lucide-react";
import { MAIN_PALETTE } from "@/config/theme";

interface AssetDataContextType {
  assetData: AssetData;
  isDataLoaded: boolean;
  isSharePending: boolean;
  snapshotVersion: number;
  exchangeRates: { USD: number; JPY: number };
  exchangeRateDate: string;
  updateExchangeRate: (currency: "USD" | "JPY", rate: number, date?: string) => void;
  syncTodayExchangeRate: () => Promise<void>;
  refreshData: () => void;
  bumpSnapshotVersion: () => void;
  // 연결 코드(s:KEY_LOCALKEY 또는 원시 토큰) 수동 가져오기 — PWA 첫 실행 연동용
  importSharedByCode: (code: string) => Promise<void>;
  // 데이터 삭제/불러오기 시 증가. 진행 중인 /api/finance/profit 호출 abort 트리거로 사용
  dataResetVersion: number;
  initAndSync: (data: AssetData) => Promise<void>;
  saveData: (data: AssetData) => boolean;
  addRealEstate: (realEstate: RealEstate) => boolean;
  updateRealEstate: (id: string, realEstate: Partial<RealEstate>) => boolean;
  deleteRealEstate: (id: string) => boolean;
  addStock: (stock: Stock) => boolean;
  addStockRaw: (stock: Stock) => boolean;
  updateStock: (id: string, stock: Partial<Stock>) => boolean;
  deleteStock: (id: string) => boolean;
  addCrypto: (crypto: Crypto) => boolean;
  updateCrypto: (id: string, crypto: Partial<Crypto>) => boolean;
  deleteCrypto: (id: string) => boolean;
  addCash: (cash: Cash) => boolean;
  updateCash: (id: string, cash: Partial<Cash>) => boolean;
  deleteCash: (id: string) => boolean;
  addLoan: (loan: Loan) => boolean;
  updateLoan: (id: string, loan: Partial<Loan>) => boolean;
  deleteLoan: (id: string) => boolean;
  addYearlyNetAsset: (yearlyNetAsset: YearlyNetAsset) => boolean;
  updateYearlyNetAsset: (year: number, yearlyNetAsset: Partial<YearlyNetAsset>) => boolean;
  deleteYearlyNetAsset: (year: number) => boolean;
  getAssetSummary: () => AssetSummary;
  // 거래 내역
  addTransaction: (tx: Transaction) => boolean;
  deleteTransaction: (txId: string) => boolean;
  updateTransaction: (txId: string, tx: Partial<Transaction>) => boolean;
  // 거래 + 포지션 원자적 반영 (단일 저장으로 stale-closure 덮어쓰기 방지)
  addTransactionWithPosition: (tx: Transaction, stockId: string, patch: Partial<Stock>) => boolean;
  addTransactionsBatch: (txs: Transaction[], patches: { stockId: string; patch: Partial<Stock> }[], newStocks?: Stock[]) => boolean;
  deleteTransactionWithPosition: (txId: string, stockId: string, patch: Partial<Stock>) => boolean;
}

const AssetDataContext = createContext<AssetDataContextType | undefined>(undefined);

const STATIC_DEFAULT_ASSET_DATA: AssetData = {
  realEstate: [],
  stocks: [],
  crypto: [],
  cash: [],
  loans: [],
  yearlyNetAssets: [],
  transactions: [],
  lastUpdated: "",
  nickname: "",
};

// ─── [메세지 상수] ────────────────────────────────────────────────────────────
const MSG = {
  // 공유
  SHARED_DATA_LOADED: "공유된 자산 데이터를 불러왔습니다.",
  SHARE_LINK_EXPIRED: "공유 링크가 만료되었거나 유효하지 않습니다.",
  SHARE_TOKEN_INVALID: "잘못된 접근이거나 공유 토큰이 유효하지 않습니다. 올바른 전체 URL인지 확인해주세요.",
  // PIN
  PIN_INVALID_LENGTH: "PIN 번호는 4자리여야 합니다.",
  PIN_MISMATCH: "PIN 번호가 일치하지 않습니다.",
  // 주식/환율 동기화
  STOCK_UP_TO_DATE: "오늘의 주식 및 환율 정보가 모두 최신입니다.",
  STOCK_SYNC_COMPLETE: "오늘의 주식 및 환율 정보를 모두 업데이트했습니다.",
  STOCK_SYNC_FAILED: "[주식 현재가 갱신 실패]",
  EXCHANGE_SYNC_FAILED: "[환율 동기화 실패]",
} as const;

// 중요 이벤트: toast + console 동시 출력
const notify = {
  success: (msg: string) => { dismissStaleToasts(); toast.success(msg); console.log(`[SUCCESS] ${msg}`); },
  error: (msg: string) => { dismissStaleToasts(); toast.error(msg); console.error(`[ERROR] ${msg}`); },
  info: (msg: string) => { dismissStaleToasts(); toast.info(msg); console.log(`[INFO] ${msg}`); },
};

// 순자산·항목별 합계 공통 계산기
// getAssetSummary와 saveSnapshots가 동일 수식을 공유하도록 모듈 스코프 헬퍼로 분리
export interface NetAssetBreakdown {
  stockValue: number;
  cryptoValue: number;
  cashValue: number;
  realEstateValue: number;
  loanBalance: number;
  tenantDepositTotal: number;
  financialAsset: number;
  totalValue: number;
  netAsset: number;
}

export function computeNetAsset(
  data: AssetData,
  rates: { USD: number; JPY: number },
  priceOf: (s: Stock) => number = (s) => s.currentPrice,
): NetAssetBreakdown {
  const mul = (currency?: string) => {
    if (currency === "USD") return rates.USD;
    if (currency === "JPY") return rates.JPY / 100; // 100엔당
    return 1;
  };
  // 상장폐지(delisted) 종목은 자산 평가에서 완전 제외, 거래정지(halted)는 마지막 가격 그대로 포함
  const stockValue = data.stocks.reduce((sum, s) => {
    if (s.inactiveStatus === "delisted") return sum;
    return sum + s.quantity * priceOf(s) * mul(s.currency);
  }, 0);
  const cryptoValue = data.crypto.reduce((sum, c) => sum + c.quantity * c.currentPrice, 0);
  const cashValue = data.cash ? data.cash.reduce((sum, c) => sum + c.balance * mul(c.currency), 0) : 0;
  const realEstateValue = data.realEstate.reduce((sum, r) => sum + r.currentValue, 0);
  const loanBalance = data.loans.reduce((sum, l) => sum + l.balance, 0);
  const tenantDepositTotal = data.realEstate.reduce((sum, r) => sum + (r.tenantDeposit ?? 0), 0);
  const financialAsset = stockValue + cryptoValue + cashValue;
  const totalValue = realEstateValue + financialAsset;
  const netAsset = totalValue - loanBalance - tenantDepositTotal;
  return { stockValue, cryptoValue, cashValue, realEstateValue, loanBalance, tenantDepositTotal, financialAsset, totalValue, netAsset };
}

// Short URL(s:KEY_LOCALKEY)을 전체 토큰으로 변환하는 순수 유틸
// state·hook 의존성 없음 → 모듈 스코프에 정의
const resolveShareToken = async (raw: string): Promise<{ token: string; localKey?: string } | null> => {
  if (!raw.startsWith("s:")) return { token: raw };

  const rawKey = raw.substring(2);
  const parts = rawKey.split("_");
  const serverKey = parts[0];
  const localKey = parts[1];

  try {
    const res = await fetch(`/api/share?key=${serverKey}`);
    const json = await res.json() as { token?: string };
    if (!json.token) return null;
    return { token: json.token, localKey };
  } catch {
    return null;
  }
};

export function AssetDataProvider({ children }: { children: ReactNode }) {
  const setThemeMode = usePreferencesStore((s) => s.setThemeMode);
  // Start with static empty defaults to avoid SSR/client mismatch.
  // Real data is loaded from localStorage in useEffect after hydration.

  // ─── [State] ────────────────────────────────────────────────────────────────
  const [assetData, setAssetData] = useState<AssetData>(STATIC_DEFAULT_ASSET_DATA);
  const [exchangeRates, setExchangeRatesState] = useState<{ USD: number; JPY: number }>({ USD: 1430, JPY: 930 });
  const [exchangeRateDate, setExchangeRateDate] = useState<string>("");

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  // 데이터 삭제·불러오기 시 +1. 자식 컴포넌트는 이 값 변화로 진행 중 profit fetch를 abort
  const [dataResetVersion, setDataResetVersion] = useState(0);

  // PIN 인증 상태
  const [isSharePending, setIsSharePending] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingToken, setPendingToken] = useState<{ token: string; localKey?: string } | null>(null);
  const [inputPin, setInputPin] = useState("");

  const INITIAL_SYNC_DELAY_MS = 1_000;

  // 최신 환율을 비동기 콜백 밖에서도 동기적으로 읽기 위한 ref
  const exchangeRatesRef = useRef<{ USD: number; JPY: number }>({ USD: 1430, JPY: 930 });

  // 진행 중 주식 동기화 취소용 — 데이터 삭제/불러오기 시 이전 sync를 무효화
  const stockSyncEpochRef = useRef(0);
  const stockSyncAbortRef = useRef<AbortController | null>(null);
  // saveSnapshots 내부의 fetchProfitRef 호출 취소용
  // 동시 다발 호출(initAndSync + 0→양수 useEffect)도 모두 추적해야 하므로 Set 사용
  const profitFetchAbortSetRef = useRef<Set<AbortController>>(new Set());
  // saveSnapshots 차단 플래그 — refreshData 후 새 동기화 시작 전까지 saveSnapshots 진입 자체를 막음
  const saveSnapshotsBlockedRef = useRef(false);
  const abortAllProfitFetches = (_reason: string) => {
    for (const c of profitFetchAbortSetRef.current) c.abort();
    profitFetchAbortSetRef.current.clear();
  };

  // ─── [동기화 헬퍼] ──────────────────────────────────────────────────────────

  // 환율 state + localStorage 갱신
  const updateExchangeRate = useCallback((currency: "USD" | "JPY", rate: number, date?: string) => {
    setExchangeRatesState(prev => {
      const newRates = { ...prev, [currency]: rate };
      exchangeRatesRef.current = newRates;
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.exchangeRate, JSON.stringify(newRates));
        if (date) {
          localStorage.setItem(STORAGE_KEYS.exchangeSyncDate, date);
          setExchangeRateDate(date);
        }
      }
      return newRates;
    });
  }, []);

  // Step 1. 오늘자 환율 조회 (자기완결)
  // - 오늘자 localStorage 캐시 있음: 캐시를 state에 반영 후 return (API 호출 없음)
  // - 없으면: /api/finance?type=exchange 호출 → state + localStorage 갱신
  const syncTodayExchangeRate = useCallback(async () => {
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

    // exchangeSyncDate 하나로 "오늘 환율 동기화(현재환율 + 2일치 이력)" 완료 여부를 관리
    // 신규 fetch 한 번으로 현재환율과 서버 이력을 함께 처리하므로 별도 가드 키 불필요
    if (localStorage.getItem(STORAGE_KEYS.exchangeSyncDate) === todayStr) {
      const savedRates = localStorage.getItem(STORAGE_KEYS.exchangeRate);
      if (savedRates) {
        try {
          const parsed = JSON.parse(savedRates);
          const rates = { USD: parsed.USD || 1380, JPY: parsed.JPY };
          exchangeRatesRef.current = rates;
          setExchangeRatesState(rates);
          setExchangeRateDate(todayStr);
        } catch { /* 파싱 실패 시 기존 state 유지 */ }
      }
      return;
    }

    try {
      const res = await fetch("/api/finance?type=exchange");
      const data = await res.json();
      if (data && !data.error) {
        // 서버 2일치 이력을 로컬에 보충(없는 날짜만) — 미접속 기기에서도 전날 환율 확보
        if (data.history) mergeExchangeHistory(data.history);
        updateExchangeRate("USD", data.USD, data.updated_at ?? todayStr); // exchangeSyncDate=today 기록
        if (data.JPY) updateExchangeRate("JPY", data.JPY);
      }
    } catch (e) {
      notify.error(MSG.EXCHANGE_SYNC_FAILED);
      console.error(e);
    }
  }, [updateExchangeRate]);

  // Step 2. 자산 데이터 초기화 (순수하게 state에 반영만 수행)
  const initAssetData = useCallback((data: AssetData) => {
    // 보존 기간(3년) 초과 거래 로그 방어적 정리
    const transactions = data.transactions ? pruneTransactions(data.transactions) : data.transactions;
    setAssetData(transactions === data.transactions ? data : { ...data, transactions });
  }, []);

  // Step 3. 주식 현재가 배치 조회
  // - outdated 판단: s.baseDate !== currentSlot (장중 1시간 단위, 장외 날짜 단위)
  // - 해외 주식 우선, 3개씩 배치 순차 호출, 배치 간 1초 지연
  // - 갱신 완료 시 toast 알림
  const syncTodayStockPrices = useCallback(async (data: AssetData): Promise<AssetData> => {
    // 진행 중인 직전 sync를 무효화하고 이번 sync의 epoch·AbortController 발급
    // (데이터 삭제/불러오기 → refreshData/initAndSync 재호출 시 이전 sync는 즉시 중단)
    stockSyncAbortRef.current?.abort();
    abortAllProfitFetches("syncTodayStockPrices 진입");
    saveSnapshotsBlockedRef.current = false;
    setDataResetVersion(v => v + 1);
    const mySyncEpoch = ++stockSyncEpochRef.current;
    const controller = new AbortController();
    stockSyncAbortRef.current = controller;
    const isCanceled = () => mySyncEpoch !== stockSyncEpochRef.current || controller.signal.aborted;
    const sleepAbortable = (ms: number) => new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, ms);
      controller.signal.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
    });

    // 장중에는 1시간 슬롯("2026-05-15-H14"), 장외에는 날짜("2026-05-15")를 반환
    const slotDomestic = getStockCacheSlot("domestic");
    const slotForeign = getStockCacheSlot("foreign");
    // ticker 단위 outdated 판정: 같은 ticker 엔트리 중 하나라도 currentSlot과 어긋나면 그 ticker 전체를 갱신 대상에 포함
    // (broker별 엔트리가 서로 다른 baseDate를 가진 채 시작해도 한 번에 일관되게 동기화)
    const outdatedTickers = new Map<string, Stock>();
    for (const s of data.stocks) {
      const ticker = normalizeTicker(s);
      if (!ticker) continue;
      const isForeignStock = s.category === "foreign";
      const currentSlot = isForeignStock ? slotForeign : slotDomestic;
      if (s.baseDate === currentSlot) continue;
      if (!outdatedTickers.has(ticker)) outdatedTickers.set(ticker, s);
    }
    const outdatedStocks = Array.from(outdatedTickers.values())
      .sort((a, b) => (a.category === "foreign" ? -1 : 1) - (b.category === "foreign" ? -1 : 1));

    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 1 * 1000;

    // stockMarkets가 비어있으면 오늘자 캐시가 있더라도 market 정보를 채우기 위해 재조회
    const hasMarketCache = (() => {
      try { return Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}")).length > 0; } catch { return false; }
    })();

    if (outdatedStocks.length === 0) {
      if (hasMarketCache) {
        if (isCanceled()) return data;
        notify.info(MSG.STOCK_UP_TO_DATE);
        return data;
      }
      // market 캐시 없음: 오늘자 ticker로 1회 조회해 stockMarkets만 채움
      const tickersWithTicker = [...new Set(
        data.stocks.filter(s => normalizeTicker(s)).map(s => normalizeTicker(s))
      )];
      for (let i = 0; i < tickersWithTicker.length; i += BATCH_SIZE) {
        if (isCanceled()) return data;
        if (i > 0) {
          try { await sleepAbortable(BATCH_DELAY_MS); } catch { return data; }
        }
        if (isCanceled()) return data;
        const tickersParam = tickersWithTicker.slice(i, i + BATCH_SIZE).join(",");
        try {
          const res = await fetch(`/api/finance?type=stock&tickers=${tickersParam}`, { signal: controller.signal });
          const stocksData = await res.json();
          if (isCanceled()) return data;
          if (stocksData && !stocksData.error) {
            try {
              const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}") as Record<string, string>;
              for (const [ticker, result] of Object.entries(stocksData as Record<string, { market?: string }>)) {
                if (result.market) saved[ticker] = result.market;
              }
              localStorage.setItem(STORAGE_KEYS.stockMarkets, JSON.stringify(saved));
            } catch { /* ignore */ }
            harvestClassifications(stocksData);
          }
        } catch { /* abort 또는 네트워크 오류: 다음 반복에서 isCanceled가 차단 */ }
      }
      if (isCanceled()) return data;
      notify.info(MSG.STOCK_UP_TO_DATE);
      return data;
    }

    let current = data;

    for (let i = 0; i < outdatedStocks.length; i += BATCH_SIZE) {
      if (isCanceled()) return current;
      if (i > 0) {
        try { await sleepAbortable(BATCH_DELAY_MS); } catch { return current; }
      }
      if (isCanceled()) return current;
      const batch = outdatedStocks.slice(i, i + BATCH_SIZE);
      const tickersParam = batch.map(normalizeTicker).join(",");

      try {
        const res = await fetch(`/api/finance?type=stock&tickers=${tickersParam}`, { signal: controller.signal });
        const stocksData = await res.json();
        // 취소된 sync의 응답은 절대 state·localStorage에 반영하지 않음 (삭제된 데이터 부활 방지)
        if (isCanceled()) return current;
        if (stocksData && !stocksData.error) {
          try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}") as Record<string, string>;
            for (const [ticker, result] of Object.entries(stocksData as Record<string, { market?: string }>)) {
              if (result.market) saved[ticker] = result.market;
            }
            localStorage.setItem(STORAGE_KEYS.stockMarkets, JSON.stringify(saved));
          } catch { /* ignore */ }
          harvestClassifications(stocksData);
          const updatedStocks = current.stocks.map(stock => {
            const ticker = normalizeTicker(stock);
            const result = stocksData[ticker] as {
              price?: number;
              updated_at?: string;
              name?: string;
              inactiveStatus?: "delisted" | "halted";
              inactiveReason?: string;
            } | undefined;
            if (result?.price !== undefined && result?.updated_at) {
              const isForeignStock = stock.category === "foreign";
              // 거래정지(halted): 기존 currentPrice 유지 (마지막 알려진 가격 보존)
              // 상장폐지(delisted): API가 준 0으로 덮어쓰기 (평가에서 어차피 제외됨)
              // 활성 회복: result.price로 갱신 + inactiveStatus undefined로 리셋
              const isHalted = result.inactiveStatus === "halted";
              return {
                ...stock,
                currentPrice: isHalted ? stock.currentPrice : result.price,
                baseDate: isForeignStock ? slotForeign : slotDomestic,
                name: resolveStockName(stock.category, result.name ?? "", stock.name),
                inactiveStatus: result.inactiveStatus,
                inactiveReason: result.inactiveReason,
                inactiveCheckedAt: result.updated_at,
              };
            }
            return stock;
          });
          current = { ...current, stocks: updatedStocks };
          if (isCanceled()) return current;
          setAssetData(current);
          saveAssetData(current);
        }
      } catch (e) {
        // AbortError는 정상 취소 — toast 표시 없이 종료
        if (controller.signal.aborted || (e instanceof Error && e.name === "AbortError")) return current;
        notify.error(MSG.STOCK_SYNC_FAILED);
        console.error(e);
      }
    }

    if (isCanceled()) return current;
    notify.info(MSG.STOCK_SYNC_COMPLETE);
    return current;
  }, []);

  // 오늘자 일별·월별 자산 스냅샷 저장 (주식/환율 갱신 완료 후 호출)
  // 일별: 이번 달 한 달치만 유지, 월별: 올해 12개월치 유지
  // 주식가치는 종가(ref) 기준 — 실시간이 아닌 기준 영업일 종가로 평가
  const saveSnapshots = useCallback(async (latestData: AssetData, latestRates: { USD: number; JPY: number }) => {
    // refreshData 후 새 sync가 시작되기 전까지는 진입 자체 차단
    if (saveSnapshotsBlockedRef.current) return;

    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const currentMonth = todayStr.substring(0, 7);
    const currentYear = currentMonth.substring(0, 4);

    // 종가 기준 주식가치: /api/finance/profit daily의 refPrice 사용
    // ref 종가 조회 실패 시 해당 종목은 실시간 currentPrice로 폴백
    const eligibleStocks = latestData.stocks.filter(s => s.ticker && s.category !== "unlisted" && s.currentPrice && s.currentPrice > 0 && s.inactiveStatus !== "delisted");
    // 다른 컴포넌트(profit-chart, stock-tab)와 동일한 캐시 키 보장 — 반드시 정렬
    const tickerList = Array.from(new Set(eligibleStocks.map(normalizeTicker).filter(Boolean))).sort().join(",");
    let refMap: ProfitRefResponse = {};
    let profitCtrl: AbortController | null = null;
    if (tickerList) {
      profitCtrl = new AbortController();
      profitFetchAbortSetRef.current.add(profitCtrl);
      try {
        refMap = await fetchProfitRef(tickerList, "daily", { signal: profitCtrl.signal, caller: "saveSnapshots" });
      } catch { /* 무시: 실패 시 실시간으로 폴백 */ }
      finally {
        profitFetchAbortSetRef.current.delete(profitCtrl);
      }
    }
    // 데이터 삭제로 취소되었거나 차단된 경우 스냅샷 저장 자체를 스킵
    if (profitCtrl?.signal.aborted || saveSnapshotsBlockedRef.current) return;

    // 공통 헬퍼로 동일 수식 사용 — 단가 함수만 다름
    // refDate는 getDailyClosingRefDates에서 시장별로 안전하게 산출됨
    // (해외=항상 어제, 국내=장후면 오늘/장중이면 어제) → ref 그대로 사용
    const closePriceOf = (s: Stock): number => {
      const t = normalizeTicker(s);
      const entry = t ? refMap[t] : null;
      return entry?.refPrice ?? s.currentPrice;
    };
    const { financialAsset, netAsset } = computeNetAsset(latestData, latestRates, closePriceOf);
    const dayOfWeek = new Date(todayStr).getDay();

    try {
      // ── 일별: 이번 달만 유지 ──
      const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
      const allDaily: DailyAssetSnapshot[] = rawDaily ? JSON.parse(rawDaily) : [];
      const cutoff = new Date(Date.now() + 9 * 60 * 60 * 1000);
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      // 평일(월~토) 기록
      if (dayOfWeek !== 0) {
        const filteredDaily = allDaily.filter(s => s.date >= cutoffStr && s.date !== todayStr);
        filteredDaily.push({
          date: todayStr,
          netAsset,
          financialAsset,
        });
        localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(filteredDaily));
        // 환율 이력은 별도 storage로 관리 (스냅샷과 분리)
        recordTodayExchangeRate(latestRates);
      } else {
        // 일요일: 전날(토요일) 데이터가 없는 경우 토요일 날짜로 스냅샷 보완 기록
        const saturday = new Date(now);
        saturday.setDate(now.getDate() - 1);
        const saturdayStr = saturday.toISOString().split("T")[0];
        const hasSaturdaySnapshot = allDaily.some(s => s.date === saturdayStr);

        if (!hasSaturdaySnapshot) {
          const filteredDaily = allDaily.filter(s => s.date >= cutoffStr && s.date !== saturdayStr);
          filteredDaily.push({
            date: saturdayStr,
            netAsset,
            financialAsset,
          });
          localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(filteredDaily));
          // 환율 이력은 별도 storage로 관리 (스냅샷과 분리)
          recordTodayExchangeRate(latestRates);
        }
      }

      // ── 월별: 올해 12개월치 유지 (이번 달 업서트) ──
      const rawMonthly = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
      const allMonthly: MonthlyAssetSnapshot[] = rawMonthly ? JSON.parse(rawMonthly) : [];
      const filteredMonthly = allMonthly.filter(s => s.month.startsWith(currentYear) && s.month !== currentMonth);
      filteredMonthly.push({ month: currentMonth, netAsset, financialAsset });
      filteredMonthly.sort((a, b) => a.month.localeCompare(b.month));
      localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(filteredMonthly));

      // ── 년도별: 올해 항목 종가 기준 업서트 ──
      const currentYearNum = parseInt(currentYear);
      setAssetData(prev => {
        const others = prev.yearlyNetAssets.filter(y => y.year !== currentYearNum);
        const updated = [...others, { year: currentYearNum, netAsset, note: "자동" }]
          .sort((a, b) => a.year - b.year);
        const next = { ...prev, yearlyNetAssets: updated };
        saveAssetData(next);
        return next;
      });

      setSnapshotVersion(v => v + 1);
    } catch (e) {
      console.error("[Snapshot] 저장 실패", e);
    }
  }, []);

  // 모든 진입 경로 공통 헬퍼
  // 순서: initAssetData → INITIAL_SYNC_DELAY_MS 대기 → 환율 → 주식 현재가 → 스냅샷
  const initAndSync = useCallback(async (data: AssetData, { skipSnapshots = false }: { skipSnapshots?: boolean } = {}) => {
    const hasAssets =
      data.stocks.length > 0 ||
      data.realEstate.length > 0 ||
      data.crypto.length > 0 ||
      data.cash.length > 0 ||
      data.loans.length > 0;
    prevHasAssetsRef.current = hasAssets;
    initAssetData(data);
    setIsDataLoaded(true);
    if (!hasAssets) return;
    await new Promise<void>(r => setTimeout(r, INITIAL_SYNC_DELAY_MS));
    await syncTodayExchangeRate();

    // 하위호환 마이그레이션: foreign + KRW → USD 자동 변환
    const usdRateForMigration = exchangeRatesRef.current.USD;
    if (usdRateForMigration > 0) {
      setAssetData(prev => {
        const dirty = prev.stocks.filter(s => s.category === "foreign" && s.currency === "KRW");
        if (dirty.length === 0) return prev;
        const fixed = prev.stocks.map(s => {
          if (s.category !== "foreign" || s.currency !== "KRW") return s;
          return {
            ...s,
            currency: "USD" as const,
            averagePrice: Math.round(s.averagePrice / usdRateForMigration * 10000) / 10000,
            currentPrice: 0,
            baseDate: undefined,
            purchaseExchangeRate: usdRateForMigration,
          };
        });
        const newData = { ...prev, stocks: fixed };
        saveAssetData(newData);
        return newData;
      });
    }

    if (!skipSnapshots) {
      const finalData = await syncTodayStockPrices(data);
      await saveSnapshots(finalData, exchangeRatesRef.current);
    }
  }, [initAssetData, syncTodayExchangeRate, syncTodayStockPrices, saveSnapshots]);

  // 0→양수 전환 감지: 웰컴 가이드에서 최초 자산 추가 시 전체 동기화 실행
  const prevHasAssetsRef = useRef(false);
  useEffect(() => {
    if (!isDataLoaded) return;
    const hasAssets =
      assetData.stocks.length > 0 ||
      assetData.realEstate.length > 0 ||
      assetData.crypto.length > 0 ||
      assetData.cash.length > 0 ||
      assetData.loans.length > 0;
    if (hasAssets && !prevHasAssetsRef.current) {
      const doSync = async () => {
        await syncTodayExchangeRate();
        const finalData = await syncTodayStockPrices(assetData);
        await saveSnapshots(finalData, exchangeRatesRef.current);
      };
      void doSync();
    }
    prevHasAssetsRef.current = hasAssets;
  }, [assetData, isDataLoaded, syncTodayExchangeRate, syncTodayStockPrices, saveSnapshots]);

  const checkAndApplyThemeMode = useCallback(() => {
    if (typeof window === "undefined") return;
    const urlParams = new URLSearchParams(window.location.hash.substring(1));
    const themeParam = urlParams.get("theme");
    if (themeParam === "light" || themeParam === "dark") {
      updateThemeMode(themeParam);
      setThemeMode(themeParam);
      void setValueToCookie("theme_mode", themeParam);
    }
  }, [setThemeMode]);

  // 공유 데이터 반영 공통 헬퍼
  // - 저장 → 즉시 toast → initAndSync 백그라운드 (주식 현재가 toast는 syncTodayStockPrices가 별도 표시)
  const applySharedData = useCallback((data: AssetData, snapshots?: AssetSnapshots, profitBasis?: ProfitBasis, nickname?: string) => {
    saveAssetData(data);
    if (snapshots) {
      try {
        localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(snapshots.daily));
        localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(snapshots.monthly));
      } catch { /* 무시 */ }
    }
    // 공유자가 선택한 종가 기준 옵션 적용 (localStorage + store 동시 갱신)
    if (profitBasis) useProfitBasisStore.getState().setBasis(profitBasis);
    // 공유자 프로필(닉네임) 적용
    if (typeof nickname === "string") persistNickname(nickname);
    notify.success(MSG.SHARED_DATA_LOADED);
    setSnapshotVersion(v => v + 1);
    skipAllTutorialSteps();
    tutorialStore.getState().initTutorial();
    checkAndApplyThemeMode();
    void initAndSync(data);
  }, [initAndSync, checkAndApplyThemeMode]);

  // ─── [이벤트 핸들러] ────────────────────────────────────────────────────────

  // 공유 토큰 처리 공통 함수: 토큰 해소 → 파싱 → PIN/데이터/실패 분기
  const processShareToken = useCallback(async (rawTokenStr: string) => {
    setIsSharePending(true);
    // URLSearchParams는 '+'를 공백으로 변환하므로 복구 후 Short URL 해소
    const rawToken = rawTokenStr.replace(/ /g, "+");
    const shareTokenRes = await resolveShareToken(rawToken);

    if (!shareTokenRes) {
      window.location.replace("/invalid-access");
      return;
    }

    const result = parseShareToken(shareTokenRes.token, undefined, shareTokenRes.localKey);

    if (result && "pinRequired" in result) {
      setPendingToken(shareTokenRes);
      setShowPinPrompt(true);
      return;
    }

    if (result && "data" in result) {
      applySharedData(result.data, result.snapshots, result.profitBasis, result.nickname);
      setIsSharePending(false);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      window.location.replace("/invalid-access");
    }
  }, [applySharedData]);

  // hashchange: 마운트 이후 URL 해시 변경 감지 (Short URL 지원)
  const handleHashChange = useCallback(async () => {
    checkAndApplyThemeMode();
    const shareTokenRaw = new URLSearchParams(window.location.hash.substring(1)).get("share");
    if (!shareTokenRaw) return;
    await processShareToken(shareTokenRaw);
  }, [processShareToken, checkAndApplyThemeMode]);

  // storage: 다른 탭에서 localStorage 변경 감지
  const handleStorageChange = useCallback(() => {
    setAssetData(getAssetData());
  }, []);

  // PIN Dialog 확인
  const handlePinConfirm = useCallback(() => {
    if (!pendingToken) return;
    if (inputPin.length !== 4) {
      notify.error(MSG.PIN_INVALID_LENGTH);
      return;
    }

    const result = parseShareToken(pendingToken.token, inputPin, pendingToken.localKey);
    if (result && "data" in result) {
      applySharedData(result.data, result.snapshots, result.profitBasis, result.nickname);
      setIsSharePending(false);
      setShowPinPrompt(false);
      setPendingToken(null);
      setInputPin("");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else if (pendingToken.token.startsWith("v72Z")) {
      // v72Z: PIN + localKey 조합 복호화 — localKey 손상 시 올바른 PIN을 입력해도 항상 실패하므로 재시도 없이 invalid-access로 이동
      window.location.replace("/invalid-access");
    } else {
      notify.error(MSG.PIN_MISMATCH);
      setInputPin("");
    }
  }, [pendingToken, inputPin, applySharedData]);

  const handlePinCancel = useCallback(() => {
    setShowPinPrompt(false);
    setPendingToken(null);
    setInputPin("");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    setIsSharePending(false);
    initAndSync(getAssetData());
  }, [initAndSync]);

  // ─── [이벤트 리스너 등록] ───────────────────────────────────────────────────

  // 마운트 초기화 + hashchange 리스너 등록
  // - 마운트 즉시: localStorage 환율을 state에 반영 (플래시 방지)
  // - 이후: 진입 경로별 분기 후 initAndSync 실행
  useEffect(() => {
    migrateStorageKeys();
    prunePeriodProfitCache(); // 옛 기간별 수익 캐시 키 정리 (현재 유효 토큰만 유지)
    // 마운트 즉시: localStorage 환율을 state에 반영
    // syncTodayExchangeRate가 자기완결적으로 환율 state를 보장하지만,
    // INITIAL_SYNC_DELAY_MS 지연 전에 기본값(1430/930)이 표시되는 것을 방지
    const savedRates = localStorage.getItem(STORAGE_KEYS.exchangeRate);
    if (savedRates) {
      try {
        const parsed = JSON.parse(savedRates);
        if (typeof parsed === "number") {
          setExchangeRatesState({ USD: parsed, JPY: 930 });
        } else {
          setExchangeRatesState({ USD: parsed.USD || 1380, JPY: parsed.JPY || 930 });
        }
      } catch {
        setExchangeRatesState({ USD: parseFloat(savedRates) || 1380, JPY: 930 });
      }
    }
    const savedDate = localStorage.getItem(STORAGE_KEYS.exchangeSyncDate);
    if (savedDate) setExchangeRateDate(savedDate);

    // 원타임 마이그레이션: 기존 dailySnapshots에서 monthlySnapshots 초기 생성
    if (!localStorage.getItem(STORAGE_KEYS.monthlySnapshots)) {
      try {
        const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
        if (rawDaily) {
          const allDaily: DailyAssetSnapshot[] = JSON.parse(rawDaily);
          const currentYear = new Date().getFullYear().toString();
          const monthMap = new Map<string, DailyAssetSnapshot>();
          allDaily.filter(s => s.date.startsWith(currentYear)).forEach(s => {
            const month = s.date.substring(0, 7);
            const existing = monthMap.get(month);
            if (!existing || s.date > existing.date) monthMap.set(month, s);
          });
          const monthly: MonthlyAssetSnapshot[] = Array.from(monthMap.entries()).map(([month, snap]) => ({
            month, netAsset: snap.netAsset, financialAsset: snap.financialAsset,
          }));
          localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(monthly));
        }
      } catch { /* 마이그레이션 실패 무시 */ }
    }

    window.addEventListener("hashchange", handleHashChange);

    // 초기 진입 분기 (Short URL 및 PWA Share Target 지원)
    void (async () => {
      if (typeof window !== "undefined") {
        try {
          const searchParams = new URLSearchParams(window.location.search);
          const sharedUrl = searchParams.get("url") || searchParams.get("text") || "";
          if (sharedUrl) {
            const hashIdx = sharedUrl.indexOf("#");
            if (hashIdx >= 0) {
              window.location.hash = sharedUrl.substring(hashIdx);
            }
          }
        } catch (_) { /* 무시 */ }
      }

      checkAndApplyThemeMode();
      const shareTokenRaw = new URLSearchParams(window.location.hash.substring(1)).get("share");
      if (!shareTokenRaw) {
        // 케이스 1: 공유 토큰 없음 (일반 진입)
        await initAndSync(getAssetData());
        return;
      }
      // 케이스 2~5: 공유 토큰 처리
      await processShareToken(shareTokenRaw);
    })();

    return () => {
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, [handleHashChange, processShareToken, initAndSync]);

  // storage 변경 감지 리스너 등록
  useEffect(() => {
    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [handleStorageChange]);

  // ─── [자산 데이터 CRUD] ──────────────────────────────────────────────────────

  // 저장
  const saveData = useCallback((data: AssetData) => {
    const success = saveAssetData(data);
    if (success) {
      setAssetData({ ...data, lastUpdated: new Date().toISOString() });
    }
    return success;
  }, []);

  // 새로고침 — 모든 데이터 삭제/외부 리셋 경로에서 호출됨
  // 진행 중인 주식 동기화 + profit ref 호출을 모두 취소해
  // 응답이 빈 state를 덮어쓰거나 stale 캐시를 만드는 것을 방지
  const refreshData = useCallback(() => {
    stockSyncEpochRef.current++;
    stockSyncAbortRef.current?.abort();
    abortAllProfitFetches("refreshData");
    saveSnapshotsBlockedRef.current = true;
    setDataResetVersion(v => v + 1);
    setAssetData(getAssetData());
  }, []);

  // 외부에서 localStorage 스냅샷을 직접 갱신한 뒤 차트 재구독을 트리거할 때 사용
  const bumpSnapshotVersion = useCallback(() => {
    setSnapshotVersion(v => v + 1);
  }, []);

  // 부동산
  const addRealEstate = useCallback(
    (realEstate: RealEstate) => {
      const newData = { ...assetData, realEstate: [...assetData.realEstate, realEstate] };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const updateRealEstate = useCallback(
    (id: string, realEstate: Partial<RealEstate>) => {
      const newData = {
        ...assetData,
        realEstate: assetData.realEstate.map((item) => (item.id === id ? { ...item, ...realEstate } : item)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteRealEstate = useCallback(
    (id: string) => {
      const newData = { ...assetData, realEstate: assetData.realEstate.filter((item) => item.id !== id) };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 주식
  const addStock = useCallback(
    (stock: Stock) => {
      const newData = { ...assetData, stocks: [...assetData.stocks, stock] };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 스크린샷 가져오기 전용: ticker 없는 종목도 허용 (superRefine 우회)
  const addStockRaw = useCallback(
    (stock: Stock) => {
      const newData = { ...assetData, stocks: [...assetData.stocks, stock] };
      return saveAssetDataRaw(newData);
    },
    [assetData]
  );

  const updateStock = useCallback(
    (id: string, stock: Partial<Stock>) => {
      const newData = {
        ...assetData,
        stocks: assetData.stocks.map((item) => (item.id === id ? { ...item, ...stock } : item)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteStock = useCallback(
    (id: string) => {
      const newData = { ...assetData, stocks: assetData.stocks.filter((item) => item.id !== id) };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 코인
  const addCrypto = useCallback(
    (crypto: Crypto) => {
      const newData = { ...assetData, crypto: [...assetData.crypto, crypto] };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const updateCrypto = useCallback(
    (id: string, crypto: Partial<Crypto>) => {
      const newData = {
        ...assetData,
        crypto: assetData.crypto.map((item) => (item.id === id ? { ...item, ...crypto } : item)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteCrypto = useCallback(
    (id: string) => {
      const newData = { ...assetData, crypto: assetData.crypto.filter((item) => item.id !== id) };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 현금
  const addCash = useCallback(
    (cash: Cash) => {
      const newData = { ...assetData, cash: [...assetData.cash, cash] };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const updateCash = useCallback(
    (id: string, cash: Partial<Cash>) => {
      const newData = {
        ...assetData,
        cash: assetData.cash.map((item) => (item.id === id ? { ...item, ...cash } : item)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteCash = useCallback(
    (id: string) => {
      const newData = { ...assetData, cash: assetData.cash.filter((item) => item.id !== id) };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 대출
  const addLoan = useCallback(
    (loan: Loan) => {
      const newData = { ...assetData, loans: [...assetData.loans, loan] };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const updateLoan = useCallback(
    (id: string, updatedLoan: Partial<Loan>) => {
      const newData = {
        ...assetData,
        loans: assetData.loans.map((item) => (item.id === id ? { ...item, ...updatedLoan } : item)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteLoan = useCallback(
    (id: string) => {
      const newData = { ...assetData, loans: assetData.loans.filter((item) => item.id !== id) };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 년도별 순자산
  const addYearlyNetAsset = useCallback(
    (yearlyNetAsset: YearlyNetAsset) => {
      const newData = {
        ...assetData,
        yearlyNetAssets: [
          ...assetData.yearlyNetAssets.filter(y => y.year !== yearlyNetAsset.year),
          yearlyNetAsset,
        ].sort((a, b) => a.year - b.year),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const updateYearlyNetAsset = useCallback(
    (year: number, yearlyNetAsset: Partial<YearlyNetAsset>) => {
      const newData = {
        ...assetData,
        yearlyNetAssets: assetData.yearlyNetAssets.map((item) =>
          item.year === year ? { ...item, ...yearlyNetAsset } : item
        ),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteYearlyNetAsset = useCallback(
    (year: number) => {
      const newData = {
        ...assetData,
        yearlyNetAssets: assetData.yearlyNetAssets.filter((item) => item.year !== year),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // ─── [거래 내역] ─────────────────────────────────────────────────────────────

  const addTransaction = useCallback(
    (tx: Transaction) => {
      const newData = {
        ...assetData,
        // 보존 기간(3년) 초과 로그는 저장 시 자동 정리
        transactions: pruneTransactions([...(assetData.transactions || []), tx]),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const deleteTransaction = useCallback(
    (txId: string) => {
      const newData = {
        ...assetData,
        transactions: (assetData.transactions || []).filter((t) => t.id !== txId),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  const updateTransaction = useCallback(
    (txId: string, tx: Partial<Transaction>) => {
      const newData = {
        ...assetData,
        transactions: (assetData.transactions || []).map((t) =>
          t.id === txId ? { ...t, ...tx } : t
        ),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 거래 추가 + 종목 포지션 갱신을 단일 저장으로 처리 (두 번 saveData 시 stale-closure가
  // 먼저 저장한 transactions를 덮어쓰는 문제 방지)
  const addTransactionWithPosition = useCallback(
    (tx: Transaction, stockId: string, patch: Partial<Stock>) => {
      const newData = {
        ...assetData,
        transactions: pruneTransactions([...(assetData.transactions || []), tx]),
        stocks: assetData.stocks.map((s) => (s.id === stockId ? { ...s, ...patch } : s)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 여러 거래 + 다종목 포지션 갱신을 단일 저장으로 처리 (스크린샷 일괄 등록 — 루프 stale-closure 방지)
  // newStocks: 증권사 분할 등으로 새로 생성된 보유 종목(이미 최종 포지션이 반영된 상태)
  const addTransactionsBatch = useCallback(
    (
      txs: Transaction[],
      patches: { stockId: string; patch: Partial<Stock> }[],
      newStocks: Stock[] = []
    ) => {
      const patchMap = new Map(patches.map((p) => [p.stockId, p.patch]));
      const newData = {
        ...assetData,
        transactions: pruneTransactions([...(assetData.transactions || []), ...txs]),
        stocks: [
          ...assetData.stocks.map((s) => (patchMap.has(s.id) ? { ...s, ...patchMap.get(s.id)! } : s)),
          ...newStocks,
        ],
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 거래 삭제 + 포지션 롤백을 단일 저장으로 처리 (동일 사유)
  const deleteTransactionWithPosition = useCallback(
    (txId: string, stockId: string, patch: Partial<Stock>) => {
      const newData = {
        ...assetData,
        transactions: (assetData.transactions || []).filter((t) => t.id !== txId),
        stocks: assetData.stocks.map((s) => (s.id === stockId ? { ...s, ...patch } : s)),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // ─── [자산 요약 계산] ────────────────────────────────────────────────────────

  const getAssetSummary = useCallback((): AssetSummary => {
    const getMultiplier = (currency?: string) => {
      if (currency === "USD") return exchangeRates.USD;
      if (currency === "JPY") return exchangeRates.JPY / 100; // 100엔당 환율
      return 1;
    };

    // 합산값은 공통 헬퍼 사용 — saveSnapshots와 동일 수식 보장
    const breakdown = computeNetAsset(assetData, exchangeRates);
    const { stockValue, cryptoValue, cashValue, realEstateValue, loanBalance, tenantDepositTotal, totalValue, netAsset } = breakdown;

    const realEstateCost = assetData.realEstate.reduce((sum, item) => sum + item.purchasePrice, 0);
    const realEstateProfit = realEstateValue - realEstateCost;

    const getPurchaseRatePerUnit = (currency?: string, purchaseExchangeRate?: number): number => {
      if (!purchaseExchangeRate || purchaseExchangeRate <= 0) return getMultiplier(currency);
      return currency === "JPY" ? purchaseExchangeRate / 100 : purchaseExchangeRate;
    };

    // 상장폐지(delisted) 종목은 매입원가/환차익 계산에서도 제외 — 평가액 제외와 일관성
    const stockCost = assetData.stocks.reduce((sum, item) => {
      if (item.inactiveStatus === "delisted") return sum;
      return sum + item.quantity * item.averagePrice * getMultiplier(item.currency);
    }, 0);
    const stockProfit = stockValue - stockCost;

    const stockCurrencyGain = assetData.stocks
      .filter((s) => s.category === "foreign" && s.currency !== "KRW" && s.inactiveStatus !== "delisted")
      .reduce((sum, s) => {
        const curr = getMultiplier(s.currency);
        const purchase = getPurchaseRatePerUnit(s.currency, s.purchaseExchangeRate);
        return sum + (curr - purchase) * s.quantity * s.averagePrice;
      }, 0);
    const stockFxProfit = stockProfit + stockCurrencyGain;

    const cryptoCost = assetData.crypto.reduce((sum, item) => sum + item.quantity * item.averagePrice, 0);
    const cryptoProfit = cryptoValue - cryptoCost;

    const totalCost = realEstateCost + stockCost + cryptoCost + cashValue; // 현금은 원금=현재가로 취급
    const totalProfit = totalValue - totalCost;
    const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;

    return {
      totalValue,
      totalCost,
      totalProfit,
      totalProfitRate,
      realEstateValue,
      realEstateCost,
      realEstateProfit,
      stockValue,
      stockCost,
      stockProfit,
      stockCurrencyGain,
      stockFxProfit,
      cryptoValue,
      cryptoCost,
      cryptoProfit,
      cashValue,
      loanBalance,
      tenantDepositTotal,
      netAsset,
      realEstateCount: assetData.realEstate.length,
      stockCount: assetData.stocks.filter((s) => s.inactiveStatus !== "delisted").length,
      cryptoCount: assetData.crypto.length,
      cashCount: assetData.cash ? assetData.cash.length : 0,
      loanCount: assetData.loans.length,
    };
  }, [assetData, exchangeRates]);

  return (
    <AssetDataContext.Provider
      value={{
        assetData,
        isDataLoaded,
        isSharePending,
        snapshotVersion,
        dataResetVersion,
        exchangeRates,
        exchangeRateDate,
        updateExchangeRate,
        syncTodayExchangeRate,
        refreshData,
        bumpSnapshotVersion,
        importSharedByCode: processShareToken,
        initAndSync,
        saveData,
        addRealEstate,
        updateRealEstate,
        deleteRealEstate,
        addStock,
        addStockRaw,
        updateStock,
        deleteStock,
        addCrypto,
        updateCrypto,
        deleteCrypto,
        addCash,
        updateCash,
        deleteCash,
        addLoan,
        updateLoan,
        deleteLoan,
        addYearlyNetAsset,
        updateYearlyNetAsset,
        deleteYearlyNetAsset,
        getAssetSummary,
        addTransaction,
        deleteTransaction,
        updateTransaction,
        addTransactionWithPosition,
        addTransactionsBatch,
        deleteTransactionWithPosition,
      }}
    >
      {children}

      <Dialog open={showPinPrompt} onOpenChange={(open) => { if (!open) handlePinCancel(); }}>
        <DialogContent className="sm:max-w-md touch-pan-y">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="size-5 text-primary" />
              보안된 데이터 접근
            </DialogTitle>
            <DialogDescription>
              이 데이터는 PIN 번호로 보호되어 있습니다.<br />
              액세스하려면 4자리 PIN을 입력하세요.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center space-y-4 py-4">
            <div className="flex flex-col items-center gap-3 space-y-2">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Lock className="size-3.5 text-primary" />
                PIN 번호 입력 (4자리 숫자)
              </Label>
              <InputOTP
                maxLength={4}
                value={inputPin}
                onChange={(value) => setInputPin(value)}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                </InputOTPGroup>
              </InputOTP>
            </div>
          </div>
          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button onClick={handlePinConfirm} type="button" style={{ backgroundColor: MAIN_PALETTE[0] }} className="text-white hover:opacity-90 border-none">
              데이터 불러오기
            </Button>
            <Button variant="outline" onClick={handlePinCancel}>
              취소
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AssetDataContext.Provider>
  );
}

export function useAssetData() {
  const context = useContext(AssetDataContext);
  if (context === undefined) {
    throw new Error("useAssetData must be used within an AssetDataProvider");
  }
  return context;
}
