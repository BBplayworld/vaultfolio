# 타입 & 스키마 참조

> 파일: `src/types/asset.ts` | 마지막 업데이트: 2026-05-16

## 자산 5종 Zod 스키마

```typescript
RealEstate: { id, type("apartment"|"house"|"land"|"commercial"|"other"), name, address?, purchasePrice, currentValue, purchaseDate, tenantDeposit?, description? }

Stock: {
  id, name, ticker, quantity, averagePrice, currentPrice,
  category: "domestic"|"foreign"|"irp"|"isa"|"pension"|"unlisted",
  currency: "KRW"|"USD"|"JPY",
  purchaseDate, purchaseExchangeRate?, baseDate?, description?, broker?,
  // 비활성 상태 — KIS 응답 기반 자동 감지 (assetData 저장 + 공유 토큰 v7.2 직렬화)
  inactiveStatus?: "delisted" | "halted",
  inactiveReason?: string,
  inactiveCheckedAt?: string,   // updated_at 그대로
  // domestic ticker: 6자리 숫자, foreign: 영문+숫자 1~10자
  // 해외: quantity/averagePrice 소수점 2자리 허용
}

Crypto: { id, name, symbol, quantity, averagePrice, currentPrice, purchaseDate, exchange?, description? }

Cash: { id, type("bank"|"cma"|"cash"|"deposit"|"savings"), name, balance, currency("KRW"|"USD"|"JPY"), institution?, description? }

Loan: {
  id, type("credit"|"minus"|"mortgage-home"|"mortgage-stock"|"mortgage-insurance"|"mortgage-deposit"|"mortgage-other"),
  name, balance, interestRate, startDate, endDate?, institution?, description?,
  linkedRealEstateId?, linkedCashId?, linkedStockId?
}

YearlyNetAsset: { year(2000~2100), netAsset, note? }

AssetData: { realEstate[], stocks[], crypto[], cash[], loans[], yearlyNetAssets[], lastUpdated }
```

## 비활성 종목 정책 (inactiveStatus)

| status | 자산 평가 | 매입원가 | 환차익 | 카운트 | 배당 | 가격 갱신 |
|--------|----------|----------|--------|--------|------|-----------|
| `delisted` (상장폐지) | **제외** | 제외 | 제외 | 제외 | 제외 | API 응답 0 그대로 |
| `halted` (거래정지) | 포함 (마지막 가격 유지) | 포함 | 포함 | 포함 | 포함 | **기존 currentPrice 유지** |
| `undefined` (활성) | 포함 | 포함 | 포함 | 포함 | 포함 | API price로 갱신 |

분기 위치: `computeNetAsset`, `getAssetSummary` ([asset-data-context.tsx](../../src/contexts/asset-data-context.tsx)), `useFilteredStockData`, `DividendCard`, `MonthlyDividendStocks`, `ProfitCard` tickerList.

UI 표시: `StockRowHeader` — 거래정지(amber Badge) / 상장폐지(red Badge).

## AssetSummary (getAssetSummary() 반환)

```typescript
{
  totalValue, totalCost, totalProfit, totalProfitRate,
  realEstateValue, realEstateCost, realEstateProfit,
  stockValue, stockCost, stockProfit, stockCurrencyGain, stockFxProfit,
  cryptoValue, cryptoCost, cryptoProfit,
  cashValue,
  loanBalance, tenantDepositTotal,
  netAsset,  // totalValue - loanBalance - tenantDepositTotal
  realEstateCount, stockCount, cryptoCount, cashCount, loanCount
  // stockCount는 inactiveStatus !== "delisted" 종목만 카운트
}
```

## 스냅샷 타입

```typescript
DailyAssetSnapshot: { date: string, netAsset: number, financialAsset: number }
  // localStorage: "secretasset_daily_snapshots" — 이번 달 한 달치

MonthlyAssetSnapshot: { month: string, netAsset: number, financialAsset: number }
  // localStorage: "secretasset_monthly_snapshots" — 올해 12개월치

AssetSnapshots: { daily: DailyAssetSnapshot[], monthly: MonthlyAssetSnapshot[] }
  // 공유 토큰 포함 시 generateShareToken의 snapshots 파라미터로 전달
```

## 배당 관련 타입 (`src/lib/finance-service.ts`)

```typescript
DividendFrequency = "annual" | "semiannual" | "quarterly" | "monthly"
InactiveStatus = "delisted" | "halted"

DividendPayoutResult: {
  payoutDate: string           // YYYY-MM-DD
  amountPerShare: number       // 원화(국내) 또는 외화(해외)
  amountForeign?: number       // 외화 주당 금액 (해외)
  currency?: string            // "KRW" | "USD" 등
  frequency?: DividendFrequency
}

StockPriceResult: {
  price: number; name: string; updated_at: string;
  market?: "NASDAQ"|"NYSE"|"AMEX";
  inactiveStatus?: InactiveStatus;
  inactiveReason?: string;
}
```

## ID 생성 패턴

```typescript
id: `stock_${Date.now()}`       // real_estate_, crypto_, cash_, loan_ 동일 패턴
```

## 통화 계산 패턴

```typescript
// JPY는 100엔 기준이므로 /100 적용
const getMultiplier = (currency?: string) =>
  currency === "USD" ? exchangeRates.USD :
  currency === "JPY" ? exchangeRates.JPY / 100 : 1;

// 환차손익 (해외주식)
const currencyGain = (currentMultiplier - purchaseMultiplier) * quantity * averagePrice;
```
