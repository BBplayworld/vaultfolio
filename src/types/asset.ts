import { z } from "zod";

// 부동산 자산 스키마
export const realEstateSchema = z.object({
  id: z.string(),
  type: z.enum(["apartment", "house", "land", "commercial", "other"]),
  name: z.string().min(1, "이름을 입력해주세요"),
  address: z.string().optional(),
  purchasePrice: z.number().min(0, "매입가는 0 이상이어야 합니다").refine((val) => val > 0, "매입가를 입력해주세요"),
  currentValue: z.number().min(0, "현재가는 0 이상이어야 합니다").refine((val) => val > 0, "현재가를 입력해주세요"),
  purchaseDate: z.string().min(1, "매입일을 선택해주세요"),
  tenantDeposit: z.number().min(0, "임차인 보증금은 0 이상이어야 합니다").optional().default(0), // 임차인 보증금
  description: z.string().optional(),
});

// 주식 자산 스키마
export const stockSchema = z.object({
  id: z.string(),
  category: z.enum(["domestic", "foreign", "irp", "isa", "pension", "unlisted"]),
  name: z.string().min(1, "종목명을 입력해주세요"),
  ticker: z.string().optional(),
  quantity: z.number().min(0, "수량은 0 이상이어야 합니다").refine((val) => val > 0, "수량을 입력해주세요"),
  averagePrice: z.number().min(0, "평균단가는 0 이상이어야 합니다").refine((val) => val > 0, "평균단가를 입력해주세요"),
  currentPrice: z.number().min(0, "현재가는 0 이상이어야 합니다").refine((val) => val > 0, "현재가를 입력해주세요"),
  // 해외주식용 USD 가격 (선택)
  averagePriceUSD: z.number().optional(),
  currentPriceUSD: z.number().optional(),
  purchaseDate: z.string().min(1, "매수일을 선택해주세요"),
  description: z.string().optional(),
});

// 코인 자산 스키마
export const cryptoSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "코인명을 입력해주세요"),
  symbol: z.string().min(1, "심볼을 입력해주세요"),
  quantity: z.number().min(0, "수량은 0 이상이어야 합니다").refine((val) => val > 0, "수량을 입력해주세요"),
  averagePrice: z.number().min(0, "평균단가는 0 이상이어야 합니다").refine((val) => val > 0, "평균단가를 입력해주세요"),
  currentPrice: z.number().min(0, "현재가는 0 이상이어야 합니다").refine((val) => val > 0, "현재가를 입력해주세요"),
  purchaseDate: z.string().min(1, "매수일을 선택해주세요"),
  exchange: z.string().optional(),
  description: z.string().optional(),
});

// 대출 스키마
export const loanSchema = z.object({
  id: z.string(),
  type: z.enum(["credit", "minus", "mortgage-home", "mortgage-stock", "mortgage-insurance", "mortgage-deposit", "mortgage-other"]),
  name: z.string().min(1, "대출명을 입력해주세요"),
  balance: z.number().min(0, "현재 잔액은 0 이상이어야 합니다").refine((val) => val > 0, "현재 잔액을 입력해주세요"),
  interestRate: z.number().min(0, "금리는 0 이상이어야 합니다"),
  startDate: z.string().min(1, "대출일을 선택해주세요"),
  endDate: z.string().optional(),
  institution: z.string().optional(), // 금융기관
  description: z.string().optional(),
});

// 년도별 순자산 히스토리 스키마
export const yearlyNetAssetSchema = z.object({
  year: z.number().min(2000).max(2100),
  netAsset: z.number(),
  note: z.string().optional(),
});

// 전체 자산 데이터 스키마
export const assetDataSchema = z.object({
  realEstate: z.array(realEstateSchema),
  stocks: z.array(stockSchema),
  crypto: z.array(cryptoSchema),
  loans: z.array(loanSchema).default([]),
  yearlyNetAssets: z.array(yearlyNetAssetSchema).default([]),
  lastUpdated: z.string(),
});

// 타입 추출
export type RealEstate = z.infer<typeof realEstateSchema>;
export type Stock = z.infer<typeof stockSchema>;
export type Crypto = z.infer<typeof cryptoSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type YearlyNetAsset = z.infer<typeof yearlyNetAssetSchema>;
export type AssetData = z.infer<typeof assetDataSchema>;

// 자산 요약 타입
export interface AssetSummary {
  totalValue: number;
  totalCost: number;
  totalProfit: number;
  totalProfitRate: number;
  realEstateValue: number;
  realEstateCost: number;
  realEstateProfit: number;
  stockValue: number;
  stockCost: number;
  stockProfit: number;
  cryptoValue: number;
  cryptoCost: number;
  cryptoProfit: number;
  loanBalance: number;
  tenantDepositTotal: number; // 임차인 보증금 합계
  netAsset: number; // 순자산 (총 자산 - 대출 잔액 - 임차인 보증금)
  realEstateCount: number;
  stockCount: number;
  cryptoCount: number;
  loanCount: number;
}
