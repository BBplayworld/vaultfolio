"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { AssetData, RealEstate, Stock, Crypto, Cash, Loan, YearlyNetAsset, AssetSummary } from "@/types/asset";
import { getAssetData, saveAssetData, STORAGE_KEYS, parseShareToken } from "@/lib/asset-storage";
import { STORAGE_KEY_EXCHANGE_SYNC_DATE, normalizeTicker, resolveStockName } from "@/lib/finance-service";
import { toast } from "sonner";
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

interface AssetDataContextType {
  assetData: AssetData;
  exchangeRates: { USD: number; JPY: number };
  exchangeRateDate: string;
  updateExchangeRate: (currency: "USD" | "JPY", rate: number, date?: string) => void;
  refreshData: () => void;
  saveData: (data: AssetData) => boolean;
  addRealEstate: (realEstate: RealEstate) => boolean;
  updateRealEstate: (id: string, realEstate: Partial<RealEstate>) => boolean;
  deleteRealEstate: (id: string) => boolean;
  addStock: (stock: Stock) => boolean;
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

export function AssetDataProvider({ children }: { children: ReactNode }) {
  // Start with static empty defaults to avoid SSR/client mismatch.
  // Real data is loaded from localStorage in useEffect after hydration.
  const [assetData, setAssetData] = useState<AssetData>(STATIC_DEFAULT_ASSET_DATA);
  const [exchangeRates, setExchangeRatesState] = useState<{ USD: number; JPY: number }>({ USD: 1430, JPY: 930 });
  const [exchangeRateDate, setExchangeRateDate] = useState<string>("");

  // PIN 인증을 위한 상태
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [inputPin, setInputPin] = useState("");

  // 최신 값을 항상 참조하기 위한 ref (stale closure 방지)
  const assetDataRef = useRef(assetData);
  const exchangeRatesRef = useRef(exchangeRates);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncingRef = useRef(false);
  useEffect(() => { assetDataRef.current = assetData; }, [assetData]);
  useEffect(() => { exchangeRatesRef.current = exchangeRates; }, [exchangeRates]);

  const INITIAL_SYNC_DELAY_MS = 1_000;
  const PERIODIC_INTERVAL_MS = 5_000;

  const updateExchangeRate = useCallback((currency: "USD" | "JPY", rate: number, date?: string) => {
    setExchangeRatesState(prev => {
      const newRates = { ...prev, [currency]: rate };
      if (typeof window !== "undefined") {
        localStorage.setItem(STORAGE_KEYS.exchangeRate, JSON.stringify(newRates));
        if (date) {
          localStorage.setItem(STORAGE_KEY_EXCHANGE_SYNC_DATE, date);
          setExchangeRateDate(date);
        }
      }
      return newRates;
    });
  }, []);

  // ─── Step 1. 오늘자 환율 조회 (자기완결) ───────────────────────────────────
  // - 오늘자 localStorage 캐시 존재: 캐시 값을 state에 반영 후 return (API 호출 없음)
  // - 없으면: /api/finance?type=exchange 호출 → state + localStorage 갱신
  // - 외부 초기화(setExchangeRatesState)에 의존하지 않고 스스로 환율 state를 보장
  const syncTodayExchangeRate = useCallback(async () => {
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

    if (localStorage.getItem(STORAGE_KEY_EXCHANGE_SYNC_DATE) === todayStr) {
      // 오늘자 환율이 localStorage에 있음: 캐시 값을 state에 반영 (API 호출 없음)
      const savedRates = localStorage.getItem(STORAGE_KEYS.exchangeRate);
      if (savedRates) {
        try {
          const parsed = JSON.parse(savedRates);
          setExchangeRatesState({ USD: parsed.USD || 1380, JPY: parsed.JPY || 900 });
          setExchangeRateDate(todayStr);
        } catch { /* 파싱 실패 시 기존 state 유지 */ }
      }
      return;
    }

    // 오늘자 없음: API 호출 후 state + localStorage 갱신
    try {
      const res = await fetch("/api/finance?type=exchange");
      const data = await res.json();
      if (data && !data.error) {
        updateExchangeRate("USD", data.USD, data.updated_at ?? todayStr);
        updateExchangeRate("JPY", data.JPY, data.updated_at ?? todayStr);
      }
    } catch (e) {
      console.error("[환율 동기화 실패]:", e);
    }
  }, [updateExchangeRate]);

  // ─── Step 2. 에셋 데이터 로드 ──────────────────────────────────────────────
  // 순수하게 자산 데이터만 state에 반영 (환율 없음)
  const initAssetData = useCallback((data: AssetData) => {
    setAssetData(data);
  }, []);

  // ─── Step 3. 주식 현재가 조회 ──────────────────────────────────────────────
  // - outdated 판단: s.baseDate !== today 단독 조건 (syncStatus 제거)
  //   → 데이터 불러오기로 어제자 데이터 로드 시에도 무조건 갱신 수행
  // - 3개씩 배치 순차 호출, 배치 간 10초 지연
  const syncTodayStockPrices = useCallback(async (data: AssetData, isInitial = true) => {
    const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    const outdatedStocks = data.stocks
      .filter(s => normalizeTicker(s) !== "" && s.baseDate !== todayStr)
      .sort((a, b) => (a.category === "foreign" ? -1 : 1) - (b.category === "foreign" ? -1 : 1)); // 해외 우선

    if (outdatedStocks.length === 0) {
      if (isInitial) toast.info("오늘의 주식 및 환율 정보가 모두 최신입니다.");
      return;
    }

    console.log(`[Sync] 주식 현재가 갱신 대상: ${outdatedStocks.length}개`);
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 10 * 1000;

    for (let i = 0; i < outdatedStocks.length; i += BATCH_SIZE) {
      if (i > 0) await new Promise<void>(r => setTimeout(r, BATCH_DELAY_MS));
      const batch = outdatedStocks.slice(i, i + BATCH_SIZE);
      const tickersParam = batch.map(normalizeTicker).join(",");

      try {
        const res = await fetch(`/api/finance?type=stock&tickers=${tickersParam}`);
        const stocksData = await res.json();

        if (stocksData && !stocksData.error) {
          setAssetData(prev => {
            const updatedStocks = prev.stocks.map(stock => {
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
            const newData = { ...prev, stocks: updatedStocks };
            saveAssetData(newData);
            return newData;
          });
        }
      } catch (e) {
        console.error("[주식 현재가 갱신 실패]:", e);
      }
    }

    if (isInitial) toast.info("오늘의 주식 및 환율 정보를 모두 업데이트했습니다.");
  }, []);

  // ─── 주기적 sync 시작 ──────────────────────────────────────────────────────
  // - 초기 sync 완료 후 호출 (useEffect에서 즉시 등록하지 않음)
  // - 기존 interval 있으면 정리 후 재등록 (hashchange 등 재진입 안전)
  // - isSyncingRef === true이면 tick skip (이전 sync 진행 중 중복 실행 방지)
  // - stocks이 없어도 interval 유지 — 환율은 항상 갱신, 주식 sync만 조건부 skip
  const startPeriodicSync = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      if (isSyncingRef.current) return;

      void (async () => {
        isSyncingRef.current = true;
        try {
          await syncTodayExchangeRate();
          if (assetDataRef.current.stocks.length > 0) {
            await syncTodayStockPrices(assetDataRef.current, false);
          }
        } finally {
          isSyncingRef.current = false;
        }
      })();
    }, PERIODIC_INTERVAL_MS);
  }, [syncTodayExchangeRate, syncTodayStockPrices]);

  // ─── 초기화 + sync 통합 헬퍼 ───────────────────────────────────────────────
  // 모든 진입 경로(일반, share token, PIN 확인, hashchange)에서 공통으로 사용
  // 순서: initAssetData → INITIAL_SYNC_DELAY_MS 대기 → sync → startPeriodicSync
  const initAndSync = useCallback(async (data: AssetData) => {
    initAssetData(data);
    await new Promise<void>(r => setTimeout(r, INITIAL_SYNC_DELAY_MS));
    isSyncingRef.current = true;
    try {
      await syncTodayExchangeRate();
      await syncTodayStockPrices(data);
    } finally {
      isSyncingRef.current = false;
    }
    startPeriodicSync();
  }, [initAssetData, syncTodayExchangeRate, syncTodayStockPrices, startPeriodicSync]);

  // 클라이언트 마운트 후 단일 초기화 흐름
  // 마운트 즉시: storedRates로 UI 표시 (플래시 방지)
  // INITIAL_SYNC_DELAY_MS 후: 환율 + 주식 현재가 갱신 (initAndSync 내부)
  // 초기 sync 완료 후: startPeriodicSync로 PERIODIC_INTERVAL_MS 주기 갱신 시작
  useEffect(() => {
    // 마운트 즉시: localStorage 환율을 state에 반영 (즉각적인 UI 표시용)
    // syncTodayExchangeRate가 자기완결적으로 환율 state를 보장하지만,
    // 지연 전에 UI가 기본값(1430/930)으로 표시되는 것을 방지하기 위함
    const savedRates = localStorage.getItem(STORAGE_KEYS.exchangeRate);
    if (savedRates) {
      try {
        const parsed = JSON.parse(savedRates);
        if (typeof parsed === "number") {
          setExchangeRatesState({ USD: parsed, JPY: 900 });
        } else {
          setExchangeRatesState({ USD: parsed.USD || 1380, JPY: parsed.JPY || 900 });
        }
      } catch {
        setExchangeRatesState({ USD: parseFloat(savedRates) || 1380, JPY: 900 });
      }
    }
    const savedDate = localStorage.getItem(STORAGE_KEY_EXCHANGE_SYNC_DATE);
    if (savedDate) setExchangeRateDate(savedDate);

    // Short URL(s:KEY)을 전체 토큰으로 변환하는 헬퍼
    const resolveShareToken = async (raw: string): Promise<string | null> => {
      if (!raw.startsWith("s:")) return raw;
      const key = raw.substring(2);
      try {
        const res = await fetch(`/api/share?key=${key}`);
        const json = await res.json() as { token?: string };
        return json.token ?? null;
      } catch {
        return null;
      }
    };

    // hashchange 리스너: 마운트 이후 URL 해시 변경 감지 (Short URL 지원)
    const handleHashChange = async () => {
      const newHash = window.location.hash.substring(1);
      const newShareTokenRaw = new URLSearchParams(newHash).get("share");
      if (!newShareTokenRaw) return;

      const rawToken = newShareTokenRaw.replace(/ /g, "+");
      const newShareToken = await resolveShareToken(rawToken);

      if (!newShareToken) {
        toast.error("공유 링크가 만료되었거나 유효하지 않습니다.");
        return;
      }

      const newResult = parseShareToken(newShareToken);

      if (newResult && "pinRequired" in newResult) {
        setPendingToken(newShareToken);
        setShowPinPrompt(true);
        return;
      }

      if (newResult && "data" in newResult) {
        saveAssetData(newResult.data);
        await initAndSync(newResult.data);
        toast.success("공유된 자산 데이터를 불러왔습니다.");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        toast.error("공유 토큰이 유효하지 않거나 데이터가 올바르지 않습니다.");
      }
    };

    window.addEventListener("hashchange", handleHashChange);

    // 초기 진입 분기 (Short URL 지원 — async IIFE)
    // interval은 initAndSync → startPeriodicSync 체인으로만 시작 (즉시 등록 없음)
    void (async () => {
      const hash = window.location.hash.substring(1);
      const shareTokenRaw = new URLSearchParams(hash).get("share");

      if (!shareTokenRaw) {
        // 케이스 1: 공유 토큰 없음 (일반 진입)
        await initAndSync(getAssetData());
        return;
      }

      // URLSearchParams는 '+'를 공백으로 변환하므로 복구 후 Short URL 해소
      const rawToken = shareTokenRaw.replace(/ /g, "+");
      const shareToken = await resolveShareToken(rawToken);

      if (!shareToken) {
        // 케이스 2: Short URL 만료/실패
        toast.error("공유 링크가 만료되었거나 유효하지 않습니다.");
        await initAndSync(getAssetData());
        return;
      }

      const result = parseShareToken(shareToken);

      if (result && "pinRequired" in result) {
        // 케이스 3: PIN 보호 토큰 — 기존 데이터로 UI 표시 후 PIN 입력 대기
        // PIN 대기 중에도 환율 갱신이 필요하므로 startPeriodicSync 즉시 시작
        initAssetData(getAssetData());
        startPeriodicSync();
        setPendingToken(shareToken);
        setShowPinPrompt(true);
        return;
      }

      if (result && "data" in result) {
        // 케이스 4: 유효한 공유 데이터
        saveAssetData(result.data);
        await initAndSync(result.data);
        toast.success("공유된 자산 데이터를 불러왔습니다.");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        // 케이스 5: 토큰 파싱 실패
        toast.error("공유 토큰이 유효하지 않거나 데이터가 올바르지 않습니다.");
        await initAndSync(getAssetData());
      }
    })();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener("hashchange", handleHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 자산 데이터 새로고침
  const refreshData = useCallback(() => {
    setAssetData(getAssetData());
  }, []);

  // 자산 데이터 저장
  const saveData = useCallback((data: AssetData) => {
    const success = saveAssetData(data);
    if (success) {
      setAssetData(data);
    }
    return success;
  }, []);

  // 부동산 추가
  const addRealEstate = useCallback(
    (realEstate: RealEstate) => {
      const newData = {
        ...assetData,
        realEstate: [...assetData.realEstate, realEstate],
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 부동산 수정
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

  // 부동산 삭제
  const deleteRealEstate = useCallback(
    (id: string) => {
      const newData = {
        ...assetData,
        realEstate: assetData.realEstate.filter((item) => item.id !== id),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 주식 추가
  const addStock = useCallback(
    (stock: Stock) => {
      const newData = {
        ...assetData,
        stocks: [...assetData.stocks, stock],
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 주식 수정
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

  // 주식 삭제
  const deleteStock = useCallback(
    (id: string) => {
      const newData = {
        ...assetData,
        stocks: assetData.stocks.filter((item) => item.id !== id),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 코인 추가
  const addCrypto = useCallback(
    (crypto: Crypto) => {
      const newData = {
        ...assetData,
        crypto: [...assetData.crypto, crypto],
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 코인 수정
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

  // 코인 삭제
  const deleteCrypto = useCallback(
    (id: string) => {
      const newData = {
        ...assetData,
        crypto: assetData.crypto.filter((item) => item.id !== id),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 현금 추가
  const addCash = useCallback(
    (cash: Cash) => {
      const newData = {
        ...assetData,
        cash: [...assetData.cash, cash],
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 현금 수정
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

  // 현금 삭제
  const deleteCash = useCallback(
    (id: string) => {
      const newData = {
        ...assetData,
        cash: assetData.cash.filter((item) => item.id !== id),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 대출 추가
  const addLoan = useCallback(
    (loan: Loan) => {
      const newData = { ...assetData, loans: [...assetData.loans, loan] };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 대출 수정
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

  // 대출 삭제
  const deleteLoan = useCallback(
    (id: string) => {
      const newData = {
        ...assetData,
        loans: assetData.loans.filter((item) => item.id !== id),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 년도별 순자산 추가
  const addYearlyNetAsset = useCallback(
    (yearlyNetAsset: YearlyNetAsset) => {
      const newData = {
        ...assetData,
        yearlyNetAssets: [...assetData.yearlyNetAssets.filter(y => y.year !== yearlyNetAsset.year), yearlyNetAsset].sort((a, b) => a.year - b.year),
      };
      return saveData(newData);
    },
    [assetData, saveData]
  );

  // 년도별 순자산 수정
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

  // 년도별 순자산 삭제
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

  // 자산 요약 계산
  const getAssetSummary = useCallback((): AssetSummary => {
    const getMultiplier = (currency?: string) => {
      if (currency === "USD") return exchangeRates.USD;
      if (currency === "JPY") return exchangeRates.JPY / 100; // 100엔당 환율
      return 1;
    };

    const realEstateValue = assetData.realEstate.reduce((sum, item) => sum + item.currentValue, 0);
    const realEstateCost = assetData.realEstate.reduce((sum, item) => sum + item.purchasePrice, 0);
    const realEstateProfit = realEstateValue - realEstateCost;

    const stockValue = assetData.stocks.reduce((sum, item) => sum + item.quantity * item.currentPrice * getMultiplier(item.currency), 0);
    const stockCost = assetData.stocks.reduce((sum, item) => sum + item.quantity * item.averagePrice * getMultiplier(item.currency), 0);
    const stockProfit = stockValue - stockCost;

    const cryptoValue = assetData.crypto.reduce((sum, item) => sum + item.quantity * item.currentPrice, 0); // 코인은 기본적으로 원화 기준치로 입력받음
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

  // localStorage 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      refreshData();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshData]);

  const handlePinConfirm = () => {
    if (!pendingToken) return;
    if (inputPin.length !== 4) {
      toast.error("PIN 번호는 4자리여야 합니다.");
      return;
    }

    const result = parseShareToken(pendingToken, inputPin);
    if (result && "data" in result) {
      saveAssetData(result.data);
      void initAndSync(result.data);
      toast.success("공유된 자산 데이터를 불러왔습니다.");
      setShowPinPrompt(false);
      setPendingToken(null);
      setInputPin("");
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    } else {
      toast.error("PIN 번호가 일치하지 않습니다.");
      setInputPin("");
    }
  };

  return (
    <AssetDataContext.Provider
      value={{
        assetData,
        exchangeRates,
        exchangeRateDate,
        updateExchangeRate,
        refreshData,
        saveData,
        addRealEstate,
        updateRealEstate,
        deleteRealEstate,
        addStock,
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

      <Dialog open={showPinPrompt} onOpenChange={setShowPinPrompt}>
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
            <Button variant="outline" onClick={() => {
              setShowPinPrompt(false);
              setPendingToken(null);
              setInputPin("");
              window.history.replaceState(null, "", window.location.pathname + window.location.search);
            }}>
              취소
            </Button>
            <Button onClick={handlePinConfirm} type="button">
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
