# 타입 & 스키마 참조

> 파일: `src/types/asset.ts` | 마지막 업데이트: 2026-04-06

## 자산 5종 Zod 스키마 요약

### RealEstate (부동산)

```typescript
{
  id: string
  type: "apartment" | "house" | "land" | "commercial" | "other"
  name: string
  address?: string
  purchasePrice: number       // > 0
  currentValue: number        // > 0
  purchaseDate: string        // YYYY-MM-DD
  tenantDeposit?: number      // 임차인 보증금 (선택)
  description?: string
}
```

### Stock (주식)

```typescript
{
  id: string
  category: "domestic" | "foreign" | "irp" | "isa" | "pension" | "unlisted"
  name: string
  ticker: string
    // domestic: 6자리 숫자 (예: "005930")
    // foreign:  영문+숫자 1~10자 (예: "TSLA")
    // irp/isa/pension/unlisted: 제한 없음
  quantity: number            // 해외: 소수점 1자리 허용
  averagePrice: number        // 해외: 소수점 1자리 허용
  currentPrice: number
  currency: "KRW" | "USD" | "JPY"
  purchaseDate: string        // YYYY-MM-DD
  purchaseExchangeRate?: number  // 매입 시 환율 (해외주식 환차손익 계산용)
  baseDate?: string           // API 조회 기준일 (YYYY-MM-DD)
  description?: string
}
```

### Crypto (암호화폐)

```typescript
{
  id: string
  name: string
  symbol: string              // 예: "BTC", "ETH"
  quantity: number
  averagePrice: number
  currentPrice: number
  purchaseDate: string
  exchange?: string           // 거래소명 (cryptoExchanges 옵션 참조)
  description?: string
}
```

### Cash (현금/예금)

```typescript
{
  id: string
  type: "bank" | "cma" | "cash" | "deposit" | "savings"
  name: string
  balance: number
  currency: "KRW" | "USD" | "JPY"
  institution?: string        // 금융기관명
  description?: string
}
```

### Loan (대출)

```typescript
{
  id: string
  type: "credit" | "minus" | "mortgage-home" | "mortgage-stock"
       | "mortgage-insurance" | "mortgage-deposit" | "mortgage-other"
  name: string
  balance: number             // 잔액
  interestRate: number        // 연이율 (%)
  startDate: string           // YYYY-MM-DD
  endDate?: string
  institution?: string
  description?: string
  // 담보 자산 연계 (선택, 하나만)
  linkedRealEstateId?: string
  linkedCashId?: string
  linkedStockId?: string      // 주식담보대출용
}
```

### YearlyNetAsset (연도별 순자산 기록)

```typescript
{
  year: number                // 2000~2100
  netAsset: number
  note?: string
}
```

### AssetData (전체 컨테이너)

```typescript
{
  realEstate: RealEstate[]
  stocks: Stock[]
  crypto: Crypto[]
  cash: Cash[]
  loans: Loan[]
  yearlyNetAssets: YearlyNetAsset[]
  lastUpdated: string
}
```

## AssetSummary (계산 결과 타입)

`getAssetSummary()` 반환값. 직접 수정하지 않고 Context에서 계산.

```typescript
interface AssetSummary {
  // 전체
  totalValue: number          // 총자산 (부동산+주식+암호화폐+현금)
  totalCost: number
  totalProfit: number
  totalProfitRate: number

  // 부동산
  realEstateValue: number
  realEstateCost: number
  realEstateProfit: number

  // 주식
  stockValue: number
  stockCost: number
  stockProfit: number
  stockCurrencyGain: number   // 환차손익
  stockFxProfit: number       // 환평가손익

  // 암호화폐
  cryptoValue: number
  cryptoCost: number
  cryptoProfit: number

  // 현금
  cashValue: number

  // 부채
  loanBalance: number
  tenantDepositTotal: number  // 임차인 보증금 합계

  // 순자산
  netAsset: number            // totalValue - loanBalance - tenantDepositTotal

  // 카운트
  realEstateCount: number
  stockCount: number
  cryptoCount: number
  cashCount: number
  loanCount: number
}
```

## ID 생성 패턴

```typescript
// 각 자산 추가 시 클라이언트에서 생성
id: `stock_${Date.now()}`
id: `real_estate_${Date.now()}`
id: `crypto_${Date.now()}`
id: `cash_${Date.now()}`
id: `loan_${Date.now()}`
```
