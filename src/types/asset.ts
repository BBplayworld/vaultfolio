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
  // 해외주식용 화폐 단위 (KRW 기본)
  currency: z.enum(["KRW", "USD", "JPY"]).default("KRW"),
  purchaseDate: z.string().min(1, "매수일을 선택해주세요"),
  description: z.string().optional(),
  baseDate: z.string().optional(),
  purchaseExchangeRate: z.number().optional(), // 매입 환율 (USD: 원/달러, JPY: 원/100엔)
  broker: z.string().optional(), // 증권사명
  // 비활성 상태 — KIS API 응답 기반 자동 감지
  // delisted=상장폐지 (자산 평가 완전 제외), halted=거래정지 (마지막 가격 유지 + 표기)
  inactiveStatus: z.enum(["delisted", "halted"]).optional(),
  inactiveReason: z.string().optional(),
  inactiveCheckedAt: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.category === "domestic" || data.category === "foreign") {
    const ticker = data.ticker?.trim() || "";

    if (ticker === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "국내 및 해외주식은 티커(종목코드) 입력이 필수입니다.",
        path: ["ticker"],
      });
      return;
    }

    if (data.category === "domestic") {
      // 국내 주식: 정확히 6자리 영문 대문자·숫자 (또는 코스닥 접미사 :XKOS, :XKRX 포함)
      const domesticRegex = /^[A-Z0-9]{6}(:XKRX|:XKOS)?$/;
      if (!domesticRegex.test(ticker.toUpperCase())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "국내 주식은 영문·숫자 6자리 코드로 입력해야 합니다. (예: 005930, 0117V0)",
          path: ["ticker"],
        });
      }
    } else if (data.category === "foreign") {
      // 해외 주식: 영문 대문자와 숫자, 점(.)만 허용, 1~8자
      const foreignRegex = /^[A-Za-z0-9.]+$/;
      if (!foreignRegex.test(ticker)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "해외 주식 티커는 영문 대문자, 숫자, 점(.)만 가능합니다. (예: AAPL, BRK.B)",
          path: ["ticker"],
        });
      }
      if (ticker.length > 8) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "해외 티커는 8자 이하로 입력해 주세요.",
          path: ["ticker"],
        });
      }
    }
  }
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
  linkedRealEstateId: z.string().optional(), // 주택담보대출 연계 부동산 ID
  linkedCashId: z.string().optional(), // 예금담보대출 연계 현금성 자산 ID
  linkedStockId: z.string().optional(), // 주식담보대출 연계 주식 ID
});

// 현금 스키마
export const cashSchema = z.object({
  id: z.string(),
  type: z.enum(["bank", "cma", "cash", "deposit", "savings"]),
  name: z.string().min(1, "계좌/자산명을 입력해주세요"),
  balance: z.number().min(0, "금액은 0 이상이어야 합니다").refine((val) => val > 0, "금액을 입력해주세요"),
  currency: z.enum(["KRW", "USD", "JPY"]).default("KRW"),
  institution: z.string().optional(),
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
  cash: z.array(cashSchema).default([]),
  loans: z.array(loanSchema).default([]),
  yearlyNetAssets: z.array(yearlyNetAssetSchema).default([]),
  lastUpdated: z.string(),
});

// 타입 추출
export type RealEstate = z.infer<typeof realEstateSchema>;
export type Stock = z.infer<typeof stockSchema>;
export type Crypto = z.infer<typeof cryptoSchema>;
export type Cash = z.infer<typeof cashSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type YearlyNetAsset = z.infer<typeof yearlyNetAssetSchema>;
export type AssetData = z.infer<typeof assetDataSchema>;

// 일별 자산 스냅샷 (이번 달 일별 차트용)
// 환율 이력은 별도 storage(secretasset_exchange_history)로 관리
export interface DailyAssetSnapshot {
  date: string;          // YYYY-MM-DD
  netAsset: number;
  financialAsset: number; // 금융자산 총액 (주식+코인+현금)
}

// 월별 자산 스냅샷 (올해 12개월치 차트용)
export interface MonthlyAssetSnapshot {
  month: string;          // YYYY-MM
  netAsset: number;
  financialAsset: number;
}

// 공유 토큰에 포함되는 스냅샷 묶음
export interface AssetSnapshots {
  daily: DailyAssetSnapshot[];
  monthly: MonthlyAssetSnapshot[];
}

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
  stockCurrencyGain: number; // 해외주식 환차손익 합계
  stockFxProfit: number;     // 환평가손익 (stockProfit + stockCurrencyGain)
  cryptoValue: number;
  cryptoCost: number;
  cryptoProfit: number;
  cashValue: number;
  loanBalance: number;
  tenantDepositTotal: number; // 임차인 보증금 합계
  netAsset: number; // 순자산 (총 자산 - 대출 잔액 - 임차인 보증금)
  realEstateCount: number;
  stockCount: number;
  cryptoCount: number;
  cashCount: number;
  loanCount: number;
}
