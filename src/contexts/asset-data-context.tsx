"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { AssetData, RealEstate, Stock, Crypto, Cash, Loan, YearlyNetAsset, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot, AssetSnapshots } from "@/types/asset";
import { getAssetData, saveAssetData, saveAssetDataRaw, STORAGE_KEYS, migrateStorageKeys, parseShareToken } from "@/lib/asset-storage";
import { skipAllTutorialSteps } from "@/lib/local-storage";
import { tutorialStore } from "@/stores/tutorial/tutorial-store";
import { normalizeTicker, resolveStockName } from "@/lib/finance-service";
import { toast } from "sonner";

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
}

const AssetDataContext = createContext<AssetDataContextType | undefined>(undefined);

const STATIC_DEFAULT_ASSET_DATA: AssetData = {
  realEstate: [],
  stocks: [],
  crypto: [],
  cash: [],
  loans: [],
  yearlyNetAssets: [],
  lastUpdated: "",
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
  // Start with static empty defaults to avoid SSR/client mismatch.
  // Real data is loaded from localStorage in useEffect after hydration.

  // ─── [State] ────────────────────────────────────────────────────────────────
  const [assetData, setAssetData] = useState<AssetData>(STATIC_DEFAULT_ASSET_DATA);
  const [exchangeRates, setExchangeRatesState] = useState<{ USD: number; JPY: number }>({ USD: 1430, JPY: 930 });
  const [exchangeRateDate, setExchangeRateDate] = useState<string>("");

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [snapshotVersion, setSnapshotVersion] = useState(0);

  // PIN 인증 상태
  const [isSharePending, setIsSharePending] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingToken, setPendingToken] = useState<{ token: string; localKey?: string } | null>(null);
  const [inputPin, setInputPin] = useState("");

  const INITIAL_SYNC_DELAY_MS = 1_000;

  // 최신 환율을 비동기 콜백 밖에서도 동기적으로 읽기 위한 ref
  const exchangeRatesRef = useRef<{ USD: number; JPY: number }>({ USD: 1430, JPY: 930 });

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
        updateExchangeRate("USD", data.USD, data.updated_at ?? todayStr);
        if (data.JPY) updateExchangeRate("JPY", data.JPY);
      }
    } catch (e) {
      notify.error(MSG.EXCHANGE_SYNC_FAILED);
      console.error(e);
    }
  }, [updateExchangeRate]);

  // Step 2. 자산 데이터 초기화 (순수하게 state에 반영만 수행)
  const initAssetData = useCallback((data: AssetData) => {
    setAssetData(data);
  }, []);

  // Step 3. 주식 현재가 배치 조회
  // - outdated 판단: s.baseDate !== today (오늘자 미갱신 항목만 대상)
  // - 해외 주식 우선, 3개씩 배치 순차 호출, 배치 간 1초 지연
  // - 갱신 완료 시 toast 알림
  const syncTodayStockPrices = useCallback(async (data: AssetData): Promise<AssetData> => {
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    // 동일 ticker는 broker별로 중복될 수 있으므로 ticker 단위로 dedup
    const seenTickers = new Set<string>();
    const outdatedStocks = data.stocks
      .filter(s => {
        const ticker = normalizeTicker(s);
        if (!ticker || s.baseDate === todayStr) return false;
        if (seenTickers.has(ticker)) return false;
        seenTickers.add(ticker);
        return true;
      })
      .sort((a, b) => (a.category === "foreign" ? -1 : 1) - (b.category === "foreign" ? -1 : 1));

    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 1 * 1000;

    // stockMarkets가 비어있으면 오늘자 캐시가 있더라도 market 정보를 채우기 위해 재조회
    const hasMarketCache = (() => {
      try { return Object.keys(JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}")).length > 0; } catch { return false; }
    })();

    if (outdatedStocks.length === 0) {
      if (hasMarketCache) {
        notify.info(MSG.STOCK_UP_TO_DATE);
        return data;
      }
      // market 캐시 없음: 오늘자 ticker로 1회 조회해 stockMarkets만 채움
      const tickersWithTicker = [...new Set(
        data.stocks.filter(s => normalizeTicker(s)).map(s => normalizeTicker(s))
      )];
      for (let i = 0; i < tickersWithTicker.length; i += BATCH_SIZE) {
        if (i > 0) await new Promise<void>(r => setTimeout(r, BATCH_DELAY_MS));
        const tickersParam = tickersWithTicker.slice(i, i + BATCH_SIZE).join(",");
        try {
          const res = await fetch(`/api/finance?type=stock&tickers=${tickersParam}`);
          const stocksData = await res.json();
          if (stocksData && !stocksData.error) {
            try {
              const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}") as Record<string, string>;
              for (const [ticker, result] of Object.entries(stocksData as Record<string, { market?: string }>)) {
                if (result.market) saved[ticker] = result.market;
              }
              localStorage.setItem(STORAGE_KEYS.stockMarkets, JSON.stringify(saved));
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }
      }
      notify.info(MSG.STOCK_UP_TO_DATE);
      return data;
    }

    console.log(`[Sync] 주식 현재가 갱신 대상: ${outdatedStocks.length}개`);
    let current = data;

    for (let i = 0; i < outdatedStocks.length; i += BATCH_SIZE) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, BATCH_DELAY_MS));
      const batch = outdatedStocks.slice(i, i + BATCH_SIZE);
      const tickersParam = batch.map(normalizeTicker).join(",");

      try {
        const res = await fetch(`/api/finance?type=stock&tickers=${tickersParam}`);
        const stocksData = await res.json();
        if (stocksData && !stocksData.error) {
          try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.stockMarkets) ?? "{}") as Record<string, string>;
            for (const [ticker, result] of Object.entries(stocksData as Record<string, { market?: string }>)) {
              if (result.market) saved[ticker] = result.market;
            }
            localStorage.setItem(STORAGE_KEYS.stockMarkets, JSON.stringify(saved));
          } catch { /* ignore */ }
          const updatedStocks = current.stocks.map(stock => {
            const ticker = normalizeTicker(stock);
            const result = stocksData[ticker];
            if (result?.price !== undefined && result?.updated_at) {
              return {
                ...stock,
                currentPrice: result.price,
                baseDate: result.updated_at,
                name: resolveStockName(stock.category, result.name, stock.name),
              };
            }
            return stock;
          });
          current = { ...current, stocks: updatedStocks };
          setAssetData(current);
          saveAssetData(current);
        }
      } catch (e) {
        notify.error(MSG.STOCK_SYNC_FAILED);
        console.error(e);
      }
    }

    notify.info(MSG.STOCK_SYNC_COMPLETE);
    return current;
  }, []);

  // 오늘자 일별·월별 자산 스냅샷 저장 (주식/환율 갱신 완료 후 호출)
  // 일별: 이번 달 한 달치만 유지, 월별: 올해 12개월치 유지
  const saveSnapshots = useCallback((latestData: AssetData, latestRates: { USD: number; JPY: number }) => {
    const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const todayStr = now.toISOString().split("T")[0];
    const currentMonth = todayStr.substring(0, 7);
    const currentYear = currentMonth.substring(0, 4);

    const getMultiplier = (currency?: string) => {
      if (currency === "USD") return latestRates.USD;
      if (currency === "JPY") return latestRates.JPY / 100;
      return 1;
    };
    const stockValue = latestData.stocks.reduce((sum, s) => sum + s.quantity * s.currentPrice * getMultiplier(s.currency), 0);
    const cryptoValue = latestData.crypto.reduce((sum, c) => sum + c.quantity * c.currentPrice, 0);
    const cashValue = latestData.cash.reduce((sum, c) => sum + c.balance * getMultiplier(c.currency), 0);
    const realEstateValue = latestData.realEstate.reduce((sum, r) => sum + r.currentValue, 0);
    const loanBalance = latestData.loans.reduce((sum, l) => sum + l.balance, 0);
    const tenantDepositTotal = latestData.realEstate.reduce((sum, r) => sum + (r.tenantDeposit ?? 0), 0);
    const financialAsset = stockValue + cryptoValue + cashValue;
    const netAsset = realEstateValue + financialAsset - loanBalance - tenantDepositTotal;
    const dayOfWeek = new Date(todayStr).getDay();

    try {
      // ── 일별: 이번 달만 유지 ──
      const rawDaily = localStorage.getItem(STORAGE_KEYS.dailySnapshots);
      const allDaily: DailyAssetSnapshot[] = rawDaily ? JSON.parse(rawDaily) : [];
      const cutoff = new Date(Date.now() + 9 * 60 * 60 * 1000);
      cutoff.setDate(cutoff.getDate() - 30);
      const cutoffStr = cutoff.toISOString().split("T")[0];

      if (dayOfWeek !== 0) {
        // 일요일 제외: 월~토 기록
        const filteredDaily = allDaily.filter(s => s.date >= cutoffStr && s.date !== todayStr);
        filteredDaily.push({ date: todayStr, netAsset, financialAsset });
        localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(filteredDaily));
      }

      // ── 월별: 올해 12개월치 유지 (이번 달 업서트) ──
      const rawMonthly = localStorage.getItem(STORAGE_KEYS.monthlySnapshots);
      const allMonthly: MonthlyAssetSnapshot[] = rawMonthly ? JSON.parse(rawMonthly) : [];
      const filteredMonthly = allMonthly.filter(s => s.month.startsWith(currentYear) && s.month !== currentMonth);
      filteredMonthly.push({ month: currentMonth, netAsset, financialAsset });
      filteredMonthly.sort((a, b) => a.month.localeCompare(b.month));
      localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(filteredMonthly));
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
      saveSnapshots(finalData, exchangeRatesRef.current);
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
        saveSnapshots(finalData, exchangeRatesRef.current);
      };
      void doSync();
    }
    prevHasAssetsRef.current = hasAssets;
  }, [assetData, isDataLoaded, syncTodayExchangeRate, syncTodayStockPrices, saveSnapshots]);

  // 공유 데이터 반영 공통 헬퍼
  // - 저장 → 즉시 toast → initAndSync 백그라운드 (주식 현재가 toast는 syncTodayStockPrices가 별도 표시)
  const applySharedData = useCallback((data: AssetData, snapshots?: AssetSnapshots) => {
    saveAssetData(data);
    if (snapshots) {
      try {
        localStorage.setItem(STORAGE_KEYS.dailySnapshots, JSON.stringify(snapshots.daily));
        localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(snapshots.monthly));
      } catch { /* 무시 */ }
    }
    notify.success(MSG.SHARED_DATA_LOADED);
    setSnapshotVersion(v => v + 1);
    skipAllTutorialSteps();
    tutorialStore.getState().initTutorial();
    void initAndSync(data);
  }, [initAndSync]);

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
      applySharedData(result.data, result.snapshots);
      setIsSharePending(false);
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      window.location.replace("/invalid-access");
    }
  }, [applySharedData]);

  // hashchange: 마운트 이후 URL 해시 변경 감지 (Short URL 지원)
  const handleHashChange = useCallback(async () => {
    const shareTokenRaw = new URLSearchParams(window.location.hash.substring(1)).get("share");
    if (!shareTokenRaw) return;
    await processShareToken(shareTokenRaw);
  }, [processShareToken]);

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
      applySharedData(result.data, result.snapshots);
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

    // 초기 진입 분기 (Short URL 지원)
    void (async () => {
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

  // 새로고침
  const refreshData = useCallback(() => {
    setAssetData(getAssetData());
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

  // ─── [자산 요약 계산] ────────────────────────────────────────────────────────

  const getAssetSummary = useCallback((): AssetSummary => {
    const getMultiplier = (currency?: string) => {
      if (currency === "USD") return exchangeRates.USD;
      if (currency === "JPY") return exchangeRates.JPY / 100; // 100엔당 환율
      return 1;
    };

    const realEstateValue = assetData.realEstate.reduce((sum, item) => sum + item.currentValue, 0);
    const realEstateCost = assetData.realEstate.reduce((sum, item) => sum + item.purchasePrice, 0);
    const realEstateProfit = realEstateValue - realEstateCost;

    const getPurchaseRatePerUnit = (currency?: string, purchaseExchangeRate?: number): number => {
      if (!purchaseExchangeRate || purchaseExchangeRate <= 0) return getMultiplier(currency);
      return currency === "JPY" ? purchaseExchangeRate / 100 : purchaseExchangeRate;
    };

    const stockValue = assetData.stocks.reduce((sum, item) => sum + item.quantity * item.currentPrice * getMultiplier(item.currency), 0);
    const stockCost = assetData.stocks.reduce((sum, item) => sum + item.quantity * item.averagePrice * getMultiplier(item.currency), 0);
    const stockProfit = stockValue - stockCost;

    const stockCurrencyGain = assetData.stocks
      .filter((s) => s.category === "foreign" && s.currency !== "KRW")
      .reduce((sum, s) => {
        const curr = getMultiplier(s.currency);
        const purchase = getPurchaseRatePerUnit(s.currency, s.purchaseExchangeRate);
        return sum + (curr - purchase) * s.quantity * s.averagePrice;
      }, 0);
    const stockFxProfit = stockProfit + stockCurrencyGain;

    const cryptoValue = assetData.crypto.reduce((sum, item) => sum + item.quantity * item.currentPrice, 0); // 코인은 원화 기준으로 입력
    const cryptoCost = assetData.crypto.reduce((sum, item) => sum + item.quantity * item.averagePrice, 0);
    const cryptoProfit = cryptoValue - cryptoCost;

    const cashValue = assetData.cash ? assetData.cash.reduce((sum, item) => sum + item.balance * getMultiplier(item.currency), 0) : 0;

    const loanBalance = assetData.loans.reduce((sum, item) => sum + item.balance, 0);
    const tenantDepositTotal = assetData.realEstate.reduce((sum, item) => sum + (item.tenantDeposit || 0), 0);

    const totalValue = realEstateValue + stockValue + cryptoValue + cashValue;
    const totalCost = realEstateCost + stockCost + cryptoCost + cashValue; // 현금은 원금=현재가로 취급
    const totalProfit = totalValue - totalCost;
    const totalProfitRate = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    const netAsset = totalValue - loanBalance - tenantDepositTotal;

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
      stockCount: assetData.stocks.length,
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
        exchangeRates,
        exchangeRateDate,
        updateExchangeRate,
        syncTodayExchangeRate,
        refreshData,
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
          <DialogFooter className="sm:justify-end">
            <Button variant="outline" onClick={handlePinCancel}>
              취소
            </Button>
            <Button onClick={handlePinConfirm} type="button" style={{ backgroundColor: MAIN_PALETTE[0] }}>
              데이터 불러오기
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
