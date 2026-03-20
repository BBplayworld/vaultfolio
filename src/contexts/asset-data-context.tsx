"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import { AssetData, RealEstate, Stock, Crypto, Cash, Loan, YearlyNetAsset, AssetSummary } from "@/types/asset";
import { getAssetData, saveAssetData, STORAGE_KEYS, parseShareToken } from "@/lib/asset-storage";
import { syncFinanceData, STORAGE_KEY_EXCHANGE_SYNC_DATE, getStockSyncStatus, normalizeTicker } from "@/lib/finance-service";
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
  isLoading: boolean;
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
  const [isLoading, setIsLoading] = useState(true);
  const [exchangeRates, setExchangeRatesState] = useState<{ USD: number; JPY: number }>({ USD: 1430, JPY: 930 });
  const [exchangeRateDate, setExchangeRateDate] = useState<string>("");

  // PIN 인증을 위한 상태
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [inputPin, setInputPin] = useState("");

  // 최신 값을 항상 참조하기 위한 ref (stale closure 방지)
  const assetDataRef = useRef(assetData);
  const exchangeRatesRef = useRef(exchangeRates);
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

  // 클라이언트 마운트 후 localStorage에서 초기 데이터 로드 및 해시 감지
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.exchangeRate);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (typeof parsed === "number") {
          setExchangeRatesState({ USD: parsed, JPY: 900 });
        } else {
          setExchangeRatesState({ USD: parsed.USD || 1380, JPY: parsed.JPY || 900 });
        }
      } catch {
        setExchangeRatesState({ USD: parseFloat(saved) || 1380, JPY: 900 });
      }
    }

    const savedDate = localStorage.getItem(STORAGE_KEY_EXCHANGE_SYNC_DATE);
    if (savedDate) setExchangeRateDate(savedDate);

    const handleHashShare = () => {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const shareTokenRaw = params.get("share");

      if (shareTokenRaw) {
        // URLSearchParams는 '+'를 공백으로 변환하므로 복구
        const shareToken = shareTokenRaw.replace(/ /g, "+");
        const result = parseShareToken(shareToken);

        if (result && "pinRequired" in result) {
          // PIN이 필요한 경우
          setPendingToken(shareToken);
          setShowPinPrompt(true);
          return;
        }

        if (result && "data" in result) {
          saveAssetData(result.data);
          setAssetData(result.data);

          // 공유된 환율 정보가 있으면 반영
          if (result.rates) {
            updateExchangeRate("USD", result.rates.USD);
            updateExchangeRate("JPY", result.rates.JPY);
          }

          toast.success("공유된 자산 데이터를 불러왔습니다.");

          // 데이터 불러온 후 해시 제거 (깔끔한 URL 유지)
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        } else {
          toast.error("공유 토큰이 유효하지 않거나 데이터가 올바르지 않습니다.");
        }
      } else {
        setAssetData(getAssetData());
      }
      setIsLoading(false);
    };

    // 초기 로드 시 실행
    handleHashShare();

    // URL 해시 변경 시 자동 감지
    window.addEventListener("hashchange", handleHashShare);
    return () => window.removeEventListener("hashchange", handleHashShare);
  }, []);


  // 자산 및 환율 데이터 실시간성 관리 (초기 진입 시 1회 자동 동기화 및 10분마다 미갱신 항목 자동 갱신)
  useEffect(() => {
    if (isLoading || !assetData.stocks) return;

    const performSync = async (isInitial: boolean = false) => {
      const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];

      // 환율: localStorage 동기화 날짜 키로 판단
      const needExchangeSync = localStorage.getItem(STORAGE_KEY_EXCHANGE_SYNC_DATE) !== todayStr;

      // 주식: 자산 데이터와 분리된 별도 sync status 키 기준으로 판단
      const syncStatus = getStockSyncStatus();
      const outdatedStocksCount = assetDataRef.current.stocks.filter((s) => {
        const ticker = normalizeTicker(s);
        // sync status에 있거나, 이미 오늘 baseDate로 갱신된 종목은 제외
        return ticker !== "" && !syncStatus.synced.includes(ticker) && s.baseDate !== todayStr;
      }).length;

      if (!needExchangeSync && outdatedStocksCount === 0) {
        if (isInitial) console.log("[Auto Sync] 모든 금융 데이터가 최신입니다.");
        return;
      }

      console.log(`[Auto Sync] 시작 - 환율 갱신 필요: ${needExchangeSync}, 미갱신 주식: ${outdatedStocksCount}개`);
      const result = await syncFinanceData(assetDataRef.current, exchangeRatesRef.current);

      if (result.synced) {
        // 환율 업데이트
        if (result.updatedExchangeRates.updated_at) {
          updateExchangeRate("USD", result.updatedExchangeRates.USD, result.updatedExchangeRates.updated_at);
          updateExchangeRate("JPY", result.updatedExchangeRates.JPY, result.updatedExchangeRates.updated_at);
        } else {
          updateExchangeRate("USD", result.updatedExchangeRates.USD);
          updateExchangeRate("JPY", result.updatedExchangeRates.JPY);
        }

        // 주식 업데이트: 함수형 업데이트로 최신 prev에 병합하여 stale closure로 인한 데이터 손실 방지
        if (result.syncedTickers.length > 0) {
          const syncedSet = new Set(result.syncedTickers);
          setAssetData(prev => {
            const updatedStocks = prev.stocks.map(stock => {
              const ticker = normalizeTicker(stock);
              if (!syncedSet.has(ticker)) return stock;
              const synced = result.updatedStocks.find(s => normalizeTicker(s) === ticker);
              return synced
                ? { ...stock, currentPrice: synced.currentPrice, baseDate: synced.baseDate, name: synced.name }
                : stock;
            });
            const newData = { ...prev, stocks: updatedStocks };
            saveAssetData(newData);
            return newData;
          });
        }

        if (isInitial) toast.info("오늘의 주식 및 환율 정보를 업데이트했습니다.");
        else console.log("[Auto Sync] 금융 데이터 갱신 완료.");
      }
    };

    // 초기 진입 시 2초 뒤 1회 실행
    const initialTimeout = setTimeout(() => performSync(true), 2000);

    // 10분마다 반복 실행 (미갱신 항목이 있을 때만 실제 API 호출)
    const intervalId = setInterval(() => performSync(false), 10 * 60 * 1000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [isLoading, assetData.stocks]);

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
      setAssetData(result.data);
      if (result.rates) {
        updateExchangeRate("USD", result.rates.USD);
        updateExchangeRate("JPY", result.rates.JPY);
      }
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
        isLoading,
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
