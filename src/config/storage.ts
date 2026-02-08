/**
 * 자산 관리 로컬 스토리지 설정 및 유틸리티
 */

export const STORAGE_CONFIG = {
  keys: {
    assetData: "personal-asset-data",
    exchangeRate: "personal-asset-exchange-rate",
  },
  defaultExchangeRate: 1380,
} as const;
