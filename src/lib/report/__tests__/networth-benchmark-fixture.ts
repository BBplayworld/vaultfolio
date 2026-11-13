// 5.102 #201 가계 통계 블록 테스트 픽스처 — 전부 가공값(실제 통계 값 아님). 테스트 전용(운영 번들 미포함).
// 판정 테스트는 앱 상수가 아니라 이 가공 표로 돌린다(통계 교체 때 테스트가 깨지지 않게).
import type { AssetData } from "@/types/asset";
import { computeNetAsset } from "@/contexts/asset-data-context";
import { EOK, MAN, type HouseholdNetworthBracket, type HouseholdNetworthMeta, type HouseholdNetworthStats } from "@/config/household-networth-stats";

export const META: HouseholdNetworthMeta = {
  surveyName: "가공 조사", agencies: ["가공기관A", "가공기관B"], surveyYear: 2099, referenceDate: "2099-03-31",
  tableSource: { name: "가공 표", id: "T-000", url: "https://example.invalid/table" },
  transcribedAt: "2099-12-01", sourceUnit: "만원", shareDecimals: 1, boundary: "lower-inclusive",
};

const table = (rows: [number | null, number | null, number][]): HouseholdNetworthBracket[] => rows.map(([min, max, sharePct]) => ({ min, max, sharePct }));

/** T: 음수 구간 있음, 합 99.9(반올림 표), N=0 경로(0.3), 누적 반올림 차로 N이 막대 값과 1 다른 구간(19.3 → 20) */
export const T: HouseholdNetworthStats = {
  meta: META,
  brackets: table([[null, 0, 3.4], [0, EOK, 26.5], [EOK, 3 * EOK, 30.4], [3 * EOK, 5 * EOK, 19.3], [5 * EOK, 10 * EOK, 0.3], [10 * EOK, null, 20.0]]),
};
/** T2: 음수 구간 없음(최하 구간이 아래로 열림) */
export const T2: HouseholdNetworthStats = {
  meta: META,
  brackets: table([[null, EOK, 29.9], [EOK, 3 * EOK, 30.4], [3 * EOK, 5 * EOK, 19.3], [5 * EOK, 10 * EOK, 0.3], [10 * EOK, null, 20.0]]),
};
/** T3: 최상위 0.4 → 그 아래 구간은 최상위가 아닌데 M=0 */
export const T3: HouseholdNetworthStats = {
  meta: META,
  brackets: table([[null, 0, 3.4], [0, EOK, 26.5], [EOK, 3 * EOK, 30.4], [3 * EOK, 5 * EOK, 19.3], [5 * EOK, 10 * EOK, 20.0], [10 * EOK, null, 0.4]]),
};

export const RATES = { USD: 1400.5, JPY: 900 };

function data(p: Partial<Record<"realEstate" | "stocks" | "cash" | "loans", unknown[]>>): AssetData {
  return {
    realEstate: [], stocks: [], crypto: [], cash: [], loans: [], physicalAssets: [],
    yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
    lastUpdated: "2099-01-01T00:00:00.000Z", ...p,
  } as unknown as AssetData;
}
const krwStock = (won: number) => ({ id: "stock_1", category: "domestic", name: "국내주", ticker: "005930", quantity: 100, averagePrice: won / 100, currentPrice: won / 100, currency: "KRW" });
const cash = (won: number) => ({ id: "cash_1", type: "bank", name: "생활비", balance: won, currency: "KRW" });
const home = (won: number, tenantDeposit?: number) => ({ id: "re_1", type: "apartment", name: "집", purchasePrice: won, currentValue: won, ...(tenantDeposit ? { tenantDeposit } : {}) });
const loan = (type: string, won: number) => ({ id: "loan_1", type, name: "대출", balance: won, interestRate: 4 });

/** 실사용 형태 4종 — 순자산은 저장 코드와 같은 computeNetAsset으로 구한다(홈 헤더와 같은 값) */
export const F1 = data({ // 주식만(국내 + 해외 소수 환산) + 현금
  stocks: [krwStock(3000 * MAN), { id: "stock_2", category: "foreign", name: "해외주", ticker: "AAPL", quantity: 100, averagePrice: 150.25, currentPrice: 150.25, currency: "USD" }],
  cash: [cash(500 * MAN)],
});
export const F2 = data({ stocks: [krwStock(2000 * MAN)], cash: [cash(300 * MAN)], loans: [loan("credit", 1.5 * EOK)] }); // 세입자 + 신용대출
export const F3 = data({ realEstate: [home(6 * EOK)], loans: [loan("mortgage", 2.5 * EOK)], stocks: [krwStock(4000 * MAN)] }); // 집 + 담보대출
export const F4 = data({ realEstate: [home(7 * EOK, 4.5 * EOK)], cash: [cash(1000 * MAN)] }); // 임대인 보증금

export const inputOf = (d: AssetData) => ({ netAsset: computeNetAsset(d, RATES).netAsset, realEstateCount: d.realEstate.length });
