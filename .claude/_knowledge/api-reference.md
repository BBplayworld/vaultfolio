# API 참조

> 마지막 업데이트: 2026-05-16

## 내부 API 라우트

### GET /api/finance
주식 현재가·환율 조회. KST 기준 시장 마감 시간별 + 장중 1시간 슬롯 캐시.

```
GET /api/finance?type=exchange
→ { USD: number, JPY: number, updated_at: string }

GET /api/finance?type=stock&tickers=005930,TSLA,AAPL
→ { "005930": { price, name, updated_at, market?, inactiveStatus?, inactiveReason? }, ... }
```

캐시 슬롯: `getStockCacheSlot("domestic"|"foreign")` ([stock-cache-slot.ts](../../src/lib/stock-cache-slot.ts))
- 장중: `"TICKER-{date}-H{HH}"` (1시간 단위 갱신)
- 장외: `"TICKER-{effectiveDate}"` (다음 개장까지 유지)

해외주식 비활성 응답: `classifyOverseasInactive()` — delisted/halted 분류 + 가격 0으로 반환 (클라이언트가 상태 반영).

---

### GET /api/finance/profit
기준가(과거 종가) 조회. 기간별 수익 계산용.

```
GET /api/finance/profit?tickers=005930,TSLA&period=daily|weekly|monthly|yearly
→ ProfitRefResponse: Record<ticker, { refPrice, refDate, prevPrice?, prevDate? }>
```

**서버 캐시 2단:**
1. `getRefDateForRequest(ticker, requestDate, period)` — 요청일→실거래일(KIS 응답일) 매핑
2. `getRefPrice(ticker, actualDate)` — 실거래일 기준 가격 (period별 차등 TTL)

→ 휴장/공휴일로 요청일과 응답일이 달라도 다음 호출부터 영구 hit.

**해외 EXCD 사전 조회:** STOCKS 캐시(`{ticker}-{slot}` 또는 `{ticker}-{effectiveDate}`)에서 market 필드 → NAS/NYS/AMS 매핑 → `fetchOverseasHistoricalPrice(...preferredExcd)`에 전달. EXCD 미상이면 NAS→NYS→AMS 순 fallback.

**클라이언트 캐시:** `profit-utils.ts` → `secretasset_profit:{period}:{date}:{tickers}` (localStorage)
- daily 키 date: `krRefDate`만 (us는 KST 자정에 kr과 함께 변경)
- 캐시 miss 시 BATCH_SIZE=3, BATCH_DELAY_MS=1000 배치 호출
- 같은 cacheKey 동시 요청은 `inFlightFetches` Map으로 dedup
- 모든 배치 완료 후에만 캐시 저장 (부분 결과 캐시 hit 회귀 방지)

---

### GET /api/logo
종목 로고 이미지 프록시.

```
GET /api/logo?ticker=AAPL          # 해외 주식 (Clearbit 또는 대체 소스)
GET /api/logo?domain=www.samsung.com  # 도메인 기반 (ETF, 국내 주식)
```

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
fetchStocksFromKorea(tickers, todayStr, token, key, secret)       // 국내 주식
fetchStocksFromKisOverseas(tickers, todayStr, token, key, secret) // 해외 주식 (NAS→NYS→AMS 순 시도, 비활성 시 즉시 종료)
fetchExchangeRateFromKis(token, key, secret, todayStr)            // 환율 (USD, JPY)
fetchDividendDomestic(ticker, fdt, tdt, token, key, secret)       // 국내 배당 [국내주식-145]
fetchDividendOverseas(ticker, excd, fdt, tdt, token, key, secret) // 해외 배당 [해외주식-052]
fetchDomesticHistoricalPrice(ticker, dateStr, token, key, secret) // 국내 과거 종가 (roll-back 5일, 실패 시 진단 로그)
fetchOverseasHistoricalPrice(ticker, dateStr, token, key, secret, preferredExcd?) // 해외 과거 종가

normalizeTicker({ ticker, category }): string
classifyTickers(tickers[]): { usTickers, krTickers }
resolveStockName(category, apiName, existingName): string
classifyOverseasInactive(output): { status: "delisted"|"halted"|null, reason }
```

**해외 비활성 판정 우선순위:**
1. `lstg_abol_dt` / `lstg_abol_item_yn=Y` / `lstg_yn≠Y` → **delisted**
2. `ovrs_stck_tr_stop_dvsn_cd ≠ "01"` 또는 `ovrs_stck_stop_rson_cd ≠ "00"` → **halted**
3. `last_rcvg_dtime` 30일 초과 → **halted**

---

## 공유 토큰 시스템 v7.2 (`src/lib/asset-storage.ts`)

```
프리픽스: v71P(PIN 있음, 공유 가능) / v71N(PIN 없음, 로컬만) / v72Z(PIN+localKey, Zero-Knowledge)

generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
parseShareToken(token, pin?, localKey?): ParseResult

stocks 필드 12개: [cat, name, ticker(name과 같으면 "*"), qty, avgPrice, currentPrice, currency, purchaseDate, description, purchaseRate, broker, inactiveStatus]
  // inactiveStatus: "d"=delisted, "h"=halted, ""=활성
```

**v72Z Zero-Knowledge:** PIN + localKey 조합 암호화. 서버에는 암호화된 데이터만 저장,
localKey는 URL 해시에 포함 → 서버 관리자도 단독 복호화 불가.

---

## 캐시 스토리지 추상화 (`src/lib/cache-storage.ts`)

```typescript
interface ICacheStorage {
  getExchange(date) / setExchange(date, data)
  getStock(key) / setStock(key, data)                  // key: getStockCacheSlot 결과
  getKisToken() / setKisToken(token, expiresIn)
  getShareToken(key) / setShareToken(key, token) / deleteShareToken(key)
  getOwnerKey(ownerId) / setOwnerKey(ownerId, key)
  checkRateLimit(ip): boolean

  getDividend(cacheKey) / setDividend(cacheKey, data)
  getRefPrice(ticker, actualDate) / setRefPrice(ticker, actualDate, price, period)
    // dateStr은 KIS 실거래일 (res.date) — 응답일 기준 저장
  getRefDateForRequest(ticker, requestDate, period) / setRefDateForRequest(...)
    // 요청일 → 응답일 매핑. 휴장으로 요청일≠응답일이어도 다음 호출 영구 hit

  getGeminiDailyCount(date) / incrementGeminiDailyCount(date) / checkGeminiDailyLimit(date, limit)
}

getCacheStorage(): ICacheStorage
// KV_REST_API_URL 있으면 → UpstashStorage (Redis)
// 없으면 → FileStorage (data/*.json)

// 파일 캐시 필드:
// STOCKS, EXCHANGE, DIVIDENDS, REF_PRICES, REF_DATE_MAP, GEMINI_COUNT
// REF_DATE_MAP 키: "{ticker}:{period}:{requestDate}" → actualDate
```

**클라이언트 한도:** `src/hooks/use-gemini-usage.ts` — localStorage `secretasset_gemini_usage`, 하루 15회
