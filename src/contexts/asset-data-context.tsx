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
  useEffect(() => { assetDataRef.current = assetData; }, [assetData]);
  useEffect(() => { exchangeRatesRef.current = exchangeRates; }, [exchangeRates]);

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

  // 클라이언트 마운트 후 단일 초기화 흐름
  // 마운트 즉시: storedRates로 UI 표시 + initAssetData로 자산 데이터 표시
  // 2초 후 비동기:
  //   1. syncTodayExchangeRate: 오늘자 환율 확인/갱신 (자기완결)
  //   2. syncTodayStockPrices: 오늘자 주식 현재가 갱신
  // 30초 주기: 미갱신 항목 있을 때만 1+2 반복
  useEffect(() => {
    // 마운트 즉시: localStorage 환율을 state에 반영 (즉각적인 UI 표시용)
    // syncTodayExchangeRate가 자기완결적으로 환율 state를 보장하지만,
    // 2초 지연 전에 UI가 기본값(1430/930)으로 표시되는 것을 방지하기 위함
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

    // 10초 주기 sync: 주식 자산이 없으면 interval 자체를 해제, 있을 때만 API 호출
    intervalRef.current = setInterval(() => {
      if (assetDataRef.current.stocks.length === 0) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      void (async () => {
        await syncTodayExchangeRate();
        await syncTodayStockPrices(assetDataRef.current, false);
      })();
    }, 10 * 1000);

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
        initAssetData(newResult.data);
        void (async () => {
          await syncTodayExchangeRate();
          await syncTodayStockPrices(newResult.data);
        })();
        toast.success("공유된 자산 데이터를 불러왔습니다.");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        toast.error("공유 토큰이 유효하지 않거나 데이터가 올바르지 않습니다.");
      }
    };

    window.addEventListener("hashchange", handleHashChange);

    // 초기 진입 분기 (Short URL 지원 — async IIFE)
    void (async () => {
      const hash = window.location.hash.substring(1);
      const shareTokenRaw = new URLSearchParams(hash).get("share");

      if (!shareTokenRaw) {
        const localData = getAssetData();
        initAssetData(localData);
        setTimeout(async () => {
          await syncTodayExchangeRate();
          await syncTodayStockPrices(localData);
        }, 1000);
        return;
      }

      // URLSearchParams는 '+'를 공백으로 변환하므로 복구 후 Short URL 해소
      const rawToken = shareTokenRaw.replace(/ /g, "+");
      const shareToken = await resolveShareToken(rawToken);

      if (!shareToken) {
        toast.error("공유 링크가 만료되었거나 유효하지 않습니다.");
        const localData = getAssetData();
        initAssetData(localData);
        setTimeout(async () => {
          await syncTodayExchangeRate();
          await syncTodayStockPrices(localData);
        }, 1000);
        return;
      }

      const result = parseShareToken(shareToken);

      if (result && "pinRequired" in result) {
        // PIN 케이스: 기존 localStorage 데이터로 UI 표시, PIN 확인 후 나머지 흐름 처리
        initAssetData(getAssetData());
        setPendingToken(shareToken);
        setShowPinPrompt(true);
        return;
      }

      if (result && "data" in result) {
        saveAssetData(result.data);
        initAssetData(result.data);
        setTimeout(async () => {
          await syncTodayExchangeRate();
          await syncTodayStockPrices(result.data);
        }, 1000);
        toast.success("공유된 자산 데이터를 불러왔습니다.");
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      } else {
        toast.error("공유 토큰이 유효하지 않거나 데이터가 올바르지 않습니다.");
        const localData = getAssetData();
        initAssetData(localData);
        setTimeout(async () => {
          await syncTodayExchangeRate();
          await syncTodayStockPrices(localData);
        }, 1000);
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
      initAssetData(result.data);
      void (async () => {
        await syncTodayExchangeRate();
        await syncTodayStockPrices(result.data);
      })();
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
