"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { AssetData, RealEstate, Stock, Crypto, Loan, YearlyNetAsset, AssetSummary } from "@/types/asset";
import { getAssetData, saveAssetData } from "@/lib/asset-storage";

const EXCHANGE_RATE_KEY = "exchange-rate-usd-krw";

interface AssetDataContextType {
  assetData: AssetData;
  isLoading: boolean;
  exchangeRate: number;
  setExchangeRate: (rate: number) => void;
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
  addLoan: (loan: Loan) => boolean;
  updateLoan: (id: string, loan: Partial<Loan>) => boolean;
  deleteLoan: (id: string) => boolean;
  addYearlyNetAsset: (yearlyNetAsset: YearlyNetAsset) => boolean;
  updateYearlyNetAsset: (year: number, yearlyNetAsset: Partial<YearlyNetAsset>) => boolean;
  deleteYearlyNetAsset: (year: number) => boolean;
  getAssetSummary: () => AssetSummary;
}

const AssetDataContext = createContext<AssetDataContextType | undefined>(undefined);

export function AssetDataProvider({ children }: { children: ReactNode }) {
  const [assetData, setAssetData] = useState<AssetData>(() => getAssetData());
  const [isLoading, setIsLoading] = useState(false);
  const [exchangeRate, setExchangeRateState] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(EXCHANGE_RATE_KEY);
      return saved ? parseFloat(saved) : 1380; // 기본 환율 1380원
    }
    return 1380;
  });

  const setExchangeRate = useCallback((rate: number) => {
    setExchangeRateState(rate);
    if (typeof window !== "undefined") {
      localStorage.setItem(EXCHANGE_RATE_KEY, rate.toString());
    }
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
    const realEstateValue = assetData.realEstate.reduce((sum, item) => sum + item.currentValue, 0);
    const realEstateCost = assetData.realEstate.reduce((sum, item) => sum + item.purchasePrice, 0);
    const realEstateProfit = realEstateValue - realEstateCost;

    const stockValue = assetData.stocks.reduce((sum, item) => sum + item.quantity * item.currentPrice, 0);
    const stockCost = assetData.stocks.reduce((sum, item) => sum + item.quantity * item.averagePrice, 0);
    const stockProfit = stockValue - stockCost;

    const cryptoValue = assetData.crypto.reduce((sum, item) => sum + item.quantity * item.currentPrice, 0);
    const cryptoCost = assetData.crypto.reduce((sum, item) => sum + item.quantity * item.averagePrice, 0);
    const cryptoProfit = cryptoValue - cryptoCost;

    const loanBalance = assetData.loans.reduce((sum, item) => sum + item.balance, 0);
    const tenantDepositTotal = assetData.realEstate.reduce((sum, item) => sum + (item.tenantDeposit || 0), 0);

    const totalValue = realEstateValue + stockValue + cryptoValue;
    const totalCost = realEstateCost + stockCost + cryptoCost;
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
      loanBalance,
      tenantDepositTotal,
      netAsset,
      realEstateCount: assetData.realEstate.length,
      stockCount: assetData.stocks.length,
      cryptoCount: assetData.crypto.length,
      loanCount: assetData.loans.length,
    };
  }, [assetData]);

  // localStorage 변경 감지
  useEffect(() => {
    const handleStorageChange = () => {
      refreshData();
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [refreshData]);

  return (
    <AssetDataContext.Provider
      value={{
        assetData,
        isLoading,
        exchangeRate,
        setExchangeRate,
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
