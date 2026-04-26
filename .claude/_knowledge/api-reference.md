# API 참조

> 마지막 업데이트: 2026-04-25

## 내부 API 라우트

### GET /api/finance
주식 현재가·환율 조회. KST 기준 시장 마감 시간별 캐시.

```
GET /api/finance?type=exchange
→ { USD: number, JPY: number, updated_at: string }

GET /api/finance?type=stock&tickers=005930,TSLA,AAPL
→ { "005930": { price, name, updated_at }, "TSLA": {...}, ... }
```

캐시 키: `"TICKER-YYYY-MM-DD"` — `getEffectiveDateStr(type)` 기준 (해외 07:00, 국내 16:00, 환율 09:00 이전이면 전일)

---

### POST /api/share — 자산 데이터 Short URL 저장
```
Body: { token: "v71P...|v72Z...", owner_id?: string }
→ { key: "a3f8b2c1ab", owner_id: "uuid" }
```
- `v71N`(PIN 없음) 거부, `v71P`(PIN) / `v72Z`(PIN+localKey) 허용
- 키: `sha256(token)[:10]`
- `owner_id`로 이전 키 자동 삭제, IP Rate Limit 분당 10회

### GET /api/share?key=a3f8b2c1ab
```
→ { token: "v71P..." }
```
GET 시마다 TTL 30일 리셋 (Sliding TTL)

---

### POST /api/parse-screenshot
스크린샷 Gemini AI 분석. **파일:** `src/app/api/parse-screenshot/route.ts`

```
Body: FormData { image: File(JPEG/PNG/WEBP/HEIC, 최대 10MB), assetType: "stock"|"crypto"|"cash"|"loan" }
→ { stocks|cryptos|cashes|loans: Array<{...}>, rawText: string }
```

**주요 응답 필드:**
- stock: id, name, ticker, quantity, currentPrice, averagePrice, currency, category, section, originalCurrency
- crypto: id, name, symbol, quantity, averagePrice, averagePriceMissing, currentPrice, exchange
- cash: id, name, type, balance, currency, institution
- loan: id, name, type, balance, interestRate, institution, startDate, startDateMissing

**서버 한도:** 하루 300회 (`GEMINI_SERVER_DAILY_LIMIT`), 초과 시 429
**에러:** 400(이미지 오류) / 422(파싱 실패) / 429(한도) / 500(키 미설정/AI 오류)

**Gemini 설정:** `gemini-2.5-flash-lite`, `temperature:0`, `maxOutputTokens:2048`, `thinkingBudget:0`, `responseMimeType:"application/json"`

---

## 외부 API — 한국투자증권 OpenAPI (`src/lib/finance-service.ts`)

```typescript
fetchStocksFromKorea(token, tickers)         // 국내 주식
fetchStocksFromKisOverseas(token, tickers)   // 해외 주식
fetchExchangeRateFromKis(token, key, secret, date)  // 환율

normalizeTicker({ ticker, category }): string
classifyTickers(tickers[]): { usTickers, krTickers }
```

---

## 공유 토큰 시스템 v7.1 (`src/lib/asset-storage.ts`)

```
프리픽스: v71P(PIN 있음, 공유 가능) / v71N(PIN 없음, 로컬만) / v72Z(PIN+localKey)

generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
parseShareToken(token, pin?, localKey?): ParseResult
  = { data, rates?, snapshots? } | { pinRequired: true } | null

하위 호환: v6.x, v7.0 파싱 지원
```

---

## 캐시 스토리지 추상화 (`src/lib/cache-storage.ts`)

```typescript
interface ICacheStorage {
  getExchange(date): ExchangeRates|null
  setExchange(date, data): void
  getStock(key): StockData|null        // key: "TICKER-YYYY-MM-DD"
  setStock(key, data): void
  getKisToken(): string|null
  setKisToken(token, expiresIn): void
  getShareToken(key): string|null
  setShareToken(key, token): void
  deleteShareToken(key): void
  getOwnerKey(ownerId): string|null
  setOwnerKey(ownerId, key): void
  checkRateLimit(ip): boolean
  getGeminiDailyCount(date): number
  incrementGeminiDailyCount(date): void
  checkGeminiDailyLimit(date, limit): boolean
}

getCacheStorage(): ICacheStorage
// KV_REST_API_URL 있으면 → UpstashStorage (Redis)
// 없으면 → FileStorage (data/*.json)

getEffectiveDateStr(type: "exchange"|"stock-us"|"stock-kr"): string
```

**클라이언트 한도:** `src/hooks/use-gemini-usage.ts` — localStorage `secretasset-gemini-YYYY-MM-DD`, 하루 15회
