import { z } from "zod";
import { transactionSchema, cashTransactionSchema, loanTransactionSchema } from "./transaction";

// 부동산 자산 스키마
export const realEstateSchema = z.object({
  id: z.string(),
  // officetel·villa는 S-4.21에서 가법 추가 (기존 값 불변 — 마이그레이션 불필요)
  type: z.enum(["apartment", "officetel", "villa", "house", "land", "commercial", "other"]),
  name: z.string().min(1, "이름을 입력해주세요"),
  address: z.string().optional(),
  purchasePrice: z.number().min(0, "매입가는 0 이상이어야 합니다").refine((val) => val > 0, "매입가를 입력해주세요"),
  currentValue: z.number().min(0, "현재가는 0 이상이어야 합니다").refine((val) => val > 0, "현재가를 입력해주세요"),
  purchaseDate: z.string().min(1, "매입일을 선택해주세요"),
  tenantDeposit: z.number().min(0, "임차인 보증금은 0 이상이어야 합니다").optional().default(0), // 임차인 보증금
  description: z.string().optional(),
  // ── 실거래가 연동 (S-4.21) — 전부 optional. 주소·동·호 검색으로 자동 세팅 ──
  regionCode: z.string().optional(),        // 법정동코드 시군구 5자리 (LAWD_CD)
  legalDong: z.string().optional(),         // 법정동명
  addressDetail: z.string().optional(),     // 상세주소(동·호) — 주소검색은 건물 단위까지만 주므로 별도 입력
  // 구 입력 필드 — 더 이상 렌더하지 않되 기존 데이터 유실 방지를 위해 스키마에 유지(폼에서 addressDetail로 병합 표시)
  dongName: z.string().optional(),          // 동
  hoName: z.string().optional(),            // 호수
  exclusiveArea: z.number().optional(),     // 사용자 면적 (㎡) — 종류별로 전용/연면적/건물면적
  areaUnitPreference: z.enum(["sqm", "pyeong"]).optional(), // 면적 입력 단위 토글 상태
  complexName: z.string().optional(),       // 단지/건물명 (매칭 키)
  marketEstimate: z.number().optional(),    // 실거래 추정 시세 (원) — 파생값, sync 비교 제외
  marketEstimateDate: z.string().optional(),// 근거 실거래일 (YYYY-MM-DD)
  marketEstimateSource: z.string().optional(), // 매칭 근거 (예: "apt 단지명·전용면적")
  // 실제 매칭된 거래 레코드의 값(검색 키인 complexName/legalDong과 다를 수 있음 — 특히 matchBy=면적일 때는
  // 단지명 필터 없이 매칭되므로 검색한 건물과 다른 단지의 거래가 근거가 될 수 있어 실제값을 별도 저장)
  marketEstimateComplexName: z.string().optional(),
  marketEstimateLegalDong: z.string().optional(),
  marketEstimateFloor: z.number().optional(),
  marketEstimateArea: z.number().optional(),   // 매칭된 거래의 면적 (㎡) — 사용자 입력 exclusiveArea와 분리
  marketEstimateGrade: z.enum(["exact", "similar", "approx", "estimated"]).optional(), // 추정 신뢰도 등급
  marketEstimateSampleCount: z.number().optional(), // 단가 중앙값 추정 시 표본 건수
});

// 주식 자산 스키마
export const stockSchema = z.object({
  id: z.string(),
  category: z.enum(["domestic", "foreign", "irp", "isa", "pension", "unlisted"]),
  name: z.string().min(1, "종목명을 입력해주세요"),
  ticker: z.string().optional(),
  quantity: z.number().min(0, "수량은 0 이상이어야 합니다").refine((val) => val > 0, "수량을 입력해주세요"),
  averagePrice: z.number().min(0, "평단가는 0 이상이어야 합니다").refine((val) => val > 0, "평단가를 입력해주세요"),
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
  // 거래 반영 관련 — 포지션 출처 추적
  positionSource: z.enum(["manual", "computed"]).optional(),
  positionEffectiveDate: z.string().optional(),
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
  // 업비트 시세 슬롯 도장 (주식의 baseDate와 동일 역할) — 같은 슬롯이면 재조회 스킵.
  // optional 필수: 구버전 백업 JSON이 parse를 통과해야 복구 가능
  baseDate: z.string().optional(),
});

// 대출 스키마
export const loanSchema = z.object({
  id: z.string(),
  type: z.enum(["credit", "minus", "mortgage-home", "mortgage-stock", "mortgage-insurance", "mortgage-deposit", "mortgage-other"]),
  name: z.string().min(1, "대출명을 입력해주세요"),
  balance: z.number().min(0, "현재 잔액은 0 이상이어야 합니다"), // 0 = 완납(상환 거래내역으로 도달 가능, S-4.24)
  interestRate: z.number().min(0, "금리는 0 이상이어야 합니다"),
  startDate: z.string().min(1, "대출일을 선택해주세요"),
  endDate: z.string().optional(),
  institution: z.string().optional(), // 금융기관
  description: z.string().optional(),
  linkedRealEstateId: z.string().optional(), // 담보대출 연계 부동산 ID
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
  transactions: z.array(transactionSchema).default([]),
  cashTransactions: z.array(cashTransactionSchema).default([]),
  loanTransactions: z.array(loanTransactionSchema).default([]),
  lastUpdated: z.string(),
  nickname: z.string().optional().default(""),
});

// 타입 추출
export type RealEstate = z.infer<typeof realEstateSchema>;
export type Stock = z.infer<typeof stockSchema>;
export type Crypto = z.infer<typeof cryptoSchema>;
export type Cash = z.infer<typeof cashSchema>;
export type Loan = z.infer<typeof loanSchema>;
export type YearlyNetAsset = z.infer<typeof yearlyNetAssetSchema>;
export type AssetData = z.infer<typeof assetDataSchema>;
export type { Transaction, CashTransaction, LoanTransaction, PositionSnapshot, PositionPreview, GuardResult, GuardLevel } from "./transaction";

// 스냅샷 시점 박제용 파생 정보 (성적표·원인분해 델타용, v2)
// 구버전 스냅샷 호환을 위해 모두 optional.
// 기기 동기화·데이터 내보내기(buildExportPayload)는 스냅샷 원본 JSON을 그대로 직렬화하므로 v2 필드 포함 연동됨.
// 공유 URL 토큰(packV7 계열)만 용량상 netAsset/financialAsset 축약 — v2 미포함.
export interface SnapshotBreakdown {
  realEstate: number;
  stocks: number;
  crypto: number;
  cash: number;
  loans: number; // 대출 잔액(부채)
  // v4(optional, 하위호환): netAsset은 임차보증금을 차감해 산출되는데(computeNetAsset) 이 필드가
  // 없으면 breakdown 합만으로는 netAsset을 복원할 수 없어 그 차액이 원인분해 잔차로 흘러간다.
  // 과거 스냅샷(필드 부재)은 여전히 잔차 처리된다 — 소급 불가.
  tenantDeposit?: number;
}
export interface SnapshotCost {
  total: number;      // 총 투입원가 (현금은 원금=현재가로 취급)
  stock: number;
  crypto: number;
  realEstate: number;
}

// v3: 자산 성적표 이력 — 성적표 뷰가 등급 확정(전 축 non-pending) 시점에 기록.
// asset-grade.ts가 이 타입을 import하므로 순환 방지를 위해 여기(types)에 정의.
export type SnapshotGradeTier = "bronze" | "silver" | "gold" | "platinum";
export type SnapshotGradeAxisKey = "growth" | "earningQuality" | "leverage" | "diversification" | "habit";
export interface SnapshotGrade {
  overall: number;                 // 0.5 단위
  tier: SnapshotGradeTier;
  axes: Partial<Record<SnapshotGradeAxisKey, number | null>>; // null = 측정불가
}

// 일별 자산 스냅샷 (이번 달 일별 차트용)
// 환율 이력은 별도 storage(secretasset_exchange_history)로 관리
export interface DailyAssetSnapshot {
  date: string;          // YYYY-MM-DD
  netAsset: number;
  financialAsset: number; // 금융자산 총액 (주식+코인+현금)
  breakdown?: SnapshotBreakdown; // v2: 자산군별 종가 평가액
  fx?: { USD: number; JPY: number }; // v2: 스냅샷 시점 환율
  fxBase?: { USD: number; JPY: number }; // v2: 통화별 외화노출 기준액(KRW 환산) — 환율효과 분리용
  cost?: SnapshotCost;   // v2: 자산군별 투입원가
  grade?: SnapshotGrade; // v3: 당일 성적표 (뷰가 확정 시 기록)
}

// 월별 자산 스냅샷 (올해 12개월치 차트용)
export interface MonthlyAssetSnapshot {
  month: string;          // YYYY-MM
  netAsset: number;
  financialAsset: number;
  breakdown?: SnapshotBreakdown;
  fx?: { USD: number; JPY: number };
  fxBase?: { USD: number; JPY: number };
  cost?: SnapshotCost;
  grade?: SnapshotGrade; // v3: 이번 달 성적표 (뷰가 확정 시 기록)
}

// 일별 스냅샷 장기 아카이브 — 30일 롤링에서 밀려난 일별 기록의 월 단위 압축 보관
// d: 일(day) 배열, n: netAsset, f: financialAsset (병렬 배열, 일 오름차순)
// v2 enrich는 미보관 — 장기 구간 원인분해는 monthly 스냅샷이 담당
export type DailyArchive = Record<string, { d: number[]; n: number[]; f: number[] }>; // key: YYYY-MM

// 공유 토큰에 포함되는 스냅샷 묶음
export interface AssetSnapshots {
  daily: DailyAssetSnapshot[];
  monthly: MonthlyAssetSnapshot[];
  // 장기 아카이브 — 내보내기·동기화에만 포함(공유 토큰 packV7 미포함)
  dailyArchive?: DailyArchive;
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
