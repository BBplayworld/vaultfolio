# API 참조

> 마지막 업데이트: 2026-04-06

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

생성:
  generateShareToken(data, rates?, pin?, localKey?): string
  → JSON 직렬화 → LZ-string 압축 → XOR 암호화(PIN) → URI safe 인코딩

파싱:
  parseShareToken(token, pin?, localKey?): ParseResult
  → 역 변환 → "OK|" 접두사로 PIN 검증

인코딩 최적화:
  숫자: base36 인코딩 + K/M 접미사
  날짜: 2020-01-01 기준 일수 오프셋

하위 호환: v6.x, v7.0 토큰 파싱 지원
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
}

// 팩토리
getCacheStorage(): ICacheStorage
// KV_REST_API_URL 있으면 → UpstashStorage
// 없으면 → FileStorage (data/*.json)
```
