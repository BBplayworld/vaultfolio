# API 참조

> 마지막 업데이트: 2026-04-18

## 내부 API 라우트

### GET /api/finance

주식 현재가 및 환율 조회. KST 기준 일일 캐시.

```
GET /api/finance?type=exchange
→ { USD: number, JPY: number, updated_at: string }

GET /api/finance?type=stock&tickers=005930,TSLA,AAPL
→ {
    "005930": { price: number, name: string, updated_at: string },
    "TSLA":   { price: number, name: string, updated_at: string },
    ...
  }
```

**처리 흐름:**
1. 캐시 확인 (키: `"TICKER-YYYY-MM-DD"` KST 기준)
2. 미캐시 항목만 한국투자증권 OpenAPI 호출
3. 응답 캐시 저장

**파일:** `src/app/api/finance/route.ts`

---

### POST /api/share

자산 데이터를 Short URL 키로 저장.

```
POST /api/share
Body: { token: "v71P...", owner_id?: string }
→ { key: "a3f8b2c1ab", owner_id: "uuid" }
```

**규칙:**
- `v71P` (PIN 있음)만 허용 — `v71N` 거부
- 키 생성: `sha256(token)[:10]` → 동일 데이터면 항상 동일 키
- `owner_id`로 이전 키 자동 삭제 (재공유 시 구 링크 무효화)
- IP Rate Limit: 분당 10회

---

### GET /api/share

Short URL 키로 토큰 조회.

```
GET /api/share?key=a3f8b2c1ab
→ { token: "v71P..." }
```

- GET 시마다 TTL 30일 리셋 (Sliding TTL)

**파일:** `src/app/api/share/route.ts`

---

### POST /api/parse-screenshot

증권·거래소·은행 앱 스크린샷을 Gemini AI로 분석해 자산 배열 반환. 주식·암호화폐·현금성자산·대출 4종 지원.

```
POST /api/parse-screenshot
Body: FormData {
  image: File,        // JPEG/PNG/WEBP/HEIC, 최대 10MB
  assetType: "stock" | "crypto" | "cash" | "loan"   // 기본값: "stock"
}

→ assetType="stock":  { stocks: Array<{...}>, rawText: string }
→ assetType="crypto": { cryptos: Array<{...}>, rawText: string }
→ assetType="cash":   { cashes: Array<{...}>, rawText: string }
→ assetType="loan":   { loans: Array<{...}>, rawText: string }
```

**stock 응답 필드:**
- id, name, ticker("" 미인식), quantity(미표시 시 1), currentPrice, averagePrice(손익률 역산), currency("KRW"), category, purchaseDate, section("국내"|"해외"|"기타")

**crypto 응답 필드:**
- id, name, symbol(대문자), quantity(소수점 8자리), averagePrice(미인식 시 currentPrice), averagePriceMissing(bool), currentPrice, exchange, purchaseDate

**cash 응답 필드:**
- id, name, type("bank"|"cma"|"cash"|"deposit"|"savings"), balance, currency("KRW"), institution

**loan 응답 필드:**
- id, name, type("credit"|"minus"|"mortgage-home"|...), balance, interestRate, institution, startDate(미인식 시 오늘), startDateMissing(bool)

**서버 한도:** 하루 200회 (`GEMINI_SERVER_DAILY_LIMIT`) — 초과 시 `429` 반환. 성공 호출만 카운트.
- FileCacheStorage: `finance-cache.json`의 `GEMINI_COUNT.{count, date}` 필드
- UpstashCacheStorage: Redis 키 `gemini:daily:YYYY-MM-DD` (자정 만료)

**처리 흐름:**
1. 서버 한도 체크 (`checkGeminiDailyLimit`)
2. Gemini `gemini-2.5-flash-lite`로 이미지 분석 (타입별 프롬프트·스키마 분기)
3. 성공 후 `incrementGeminiDailyCount`
4. stock: ticker-map.ts fallback (`lookupTicker`), 국내 ETF 강제 분류, 수량 미표시 처리

**`lookupTicker` 매칭 순서** (`ticker-map.ts`):
1. 정확한 일치 (normalizeName 후)
2. prefix 매칭 — 입력이 키의 앞부분인 경우 (잘린 텍스트 대응)
3. suffix 매칭 — 키가 입력의 앞부분인 경우

**에러 응답:**
- `400`: 이미지 없음 / 크기 초과 / 지원 않는 형식
- `422`: Gemini 응답 파싱 실패
- `429`: 서버 하루 한도(200회) 초과
- `500`: GEMINI_API_KEY 미설정 / AI 오류 (503 혼잡, 429 한도 초과)

**클라이언트 한도:** `src/hooks/use-gemini-usage.ts` — localStorage `secretasset-gemini-YYYY-MM-DD` (KST 기준), 하루 10회 제한. 각 스크린샷 다이얼로그에서 `useGeminiUsage()` hook으로 체크·증가.

**파일:** `src/app/api/parse-screenshot/route.ts`

---

## 외부 API — 한국투자증권 OpenAPI

| 용도 | 함수 | 파일 |
|------|------|------|
| KIS 토큰 발급 | (내부 처리) | `finance-service.ts` |
| 국내 주식 현재가 | `fetchStocksFromKorea(token, tickers)` | `finance-service.ts` |
| 해외 주식 현재가 | `fetchStocksFromKisOverseas(token, tickers)` | `finance-service.ts` |
| 환율 조회 | `fetchExchangeRateFromKis(token, key, secret, date)` | `finance-service.ts` |

**티커 정규화:** `normalizeTicker({ ticker, category }): string`
- domestic: 6자리 숫자 그대로
- foreign: 대문자 영문자로 정규화

**국내/해외 분류:** `classifyTickers(tickers[]): { usTickers, krTickers }`

---

## 공유 토큰 시스템 (v7.1)

**파일:** `src/lib/asset-storage.ts`

```
프리픽스:
  v71P — PIN 있음 (서버 공유 가능)
  v71N — PIN 없음 (서버 거부, 로컬만 사용)
  v72Z — Zero-Knowledge (PIN + localKey 조합)

생성:
  generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
  → packV7(data, rates, snapshots) → LZ-string 압축 → XOR 암호화(PIN) → URI safe 인코딩
  snapshots: AssetSnapshots — 일별·월별 스냅샷 포함 (선택). packV7 섹션[8]에 저장.

파싱:
  parseShareToken(token, pin?, localKey?): ParseResult
  → 역 변환 → "OK|" 접두사로 PIN 검증
  ParseResult = { data, rates?, snapshots? } | { pinRequired: true } | null

인코딩 최적화:
  숫자: base36 인코딩 + K/M 접미사
  날짜: 2020-01-01 기준 일수 오프셋
  월: 2020-01 기준 경과 월수 base36

하위 호환: v6.x, v7.0 토큰 파싱 지원 (snapshots=undefined 반환)
```

---

## 캐시 스토리지 추상화

**파일:** `src/lib/cache-storage.ts`

```typescript
interface ICacheStorage {
  // 금융 데이터
  getExchange(date: string): Promise<ExchangeRates | null>
  setExchange(date: string, data: ExchangeRates): Promise<void>
  getStock(key: string): Promise<StockData | null>   // key: "TICKER-YYYY-MM-DD"
  setStock(key: string, data: StockData): Promise<void>
  getKisToken(): Promise<string | null>
  setKisToken(token: string, expiresIn: number): Promise<void>

  // 공유 URL
  getShareToken(key: string): Promise<string | null>
  setShareToken(key: string, token: string): Promise<void>
  deleteShareToken(key: string): Promise<void>
  getOwnerKey(ownerId: string): Promise<string | null>
  setOwnerKey(ownerId: string, key: string): Promise<void>

  // Rate Limit
  checkRateLimit(ip: string): Promise<boolean>

  // Gemini 사용량 (스크린샷 파싱 한도 관리)
  getGeminiDailyCount(date: string): Promise<number>
  incrementGeminiDailyCount(date: string): Promise<void>
  checkGeminiDailyLimit(date: string, limit: number): Promise<boolean>
  // FileCacheStorage: finance-cache.json의 GEMINI_COUNT.{count, date} 필드
  // UpstashCacheStorage: Redis 키 gemini:daily:YYYY-MM-DD (자정 만료)
}

// 유효 캐시 날짜 계산 (시장 마감 시간 기준)
getEffectiveDateStr(type: "exchange" | "stock-us" | "stock-kr"): string
// KST 기준: 해외주식 07:00, 국내주식 16:00, 환율 09:00 이전이면 전일 날짜 반환

// 팩토리
getCacheStorage(): ICacheStorage
// KV_REST_API_URL 있으면 → UpstashStorage
// 없으면 → FileStorage (data/*.json)
```
