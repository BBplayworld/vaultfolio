# API 참조

> 마지막 업데이트: 2026-06-14

## 내부 API 라우트

> **공통 가드(S-4.28, `src/server/api-guard.ts`)** — 모든 공개 라우트는 `guardRequest`(cross-site 403·Content-Length 411/413·L1 429)로 시작하고, **캐시 미스일 때만** `guardRateLimit`(5.113부터 IP를 Redis에 쓰지 않는 L1 메모리 버킷, 창 ≤ 1분)·`withinUpstreamBudget`을 거친다. 429에는 `Retry-After`. 공개 시세류 성공 응답은 `cdnCacheHeaders()`(`Vercel-CDN-Cache-Control`). 상세는 [architecture.md](./architecture.md) "공개 API 보안".
>
> | 라우트 | L1/분 | L2(캐시 미스) | 입력 상한 |
> | --- | --- | --- | --- |
> | finance | 120 | 60/분 | `tickers` ≤3(형식 위반 제외) · `type` stock\|exchange |
> | finance/crypto | 120 | 60/분 | `symbols` ≤30(`SYMBOL_RE`) |
> | finance/profit | 120 | 30/분 | `tickers` ≤10 · `period` 4종 화이트리스트 |
> | finance/market-index | 60 | 10/분 | `period` 3종 · `basis` 2종 필수(그 밖·`yearly` 400), 종목코드·수량 없음 |
> | finance/price-history | 60 | 10/분 | `ticker` 1개(형식 위반·없음 400) · `range` `1y\|5y`만(그 밖 400), 수량·평단·날짜 없음 |
> | finance/dividend | 120 | 30/분 | `type` 2종, `excd`는 무시(서버 NAS 고정) |
> | ticker-search | 120 | — | `q` ≤50자 · `limit` ≤30 |
> | logo | 240 | 120/분 | `size` 버킷 스냅(32~512) · 업스트림 ≤512KB · SVG 거부 |
> | realestate | 60 | 20/분 | `op` resolve\|estimate · query ≤100자 · 음성 캐시 |
> | parse-screenshot | 20 | Gemini 예약(IP 30/일) | 본문 ≤10.5MB · 매직바이트 검사 |
> | xray-classify | 20 | Gemini 예약 | 본문 ≤256KB · items ≤200 |
> | share GET/POST | 60/20 | 30/10 per 분 | key `^[0-9a-f]{10}$` · POST `v72Z`만 · ≤900k자 |
> | feedback | 10 | 5/10분 | 본문 ≤16KB · Slack 이스케이프 |
>
> 삭제된 표면: `finance/debug-overseas`, `server-actions.ts`(Server Action), `realestate op=raw`, `/_next/image`.

### GET /api/finance
주식 현재가·환율 조회. KST 기준 시장 마감 시간별 + 장중 1시간 슬롯 캐시.

```
GET /api/finance?type=exchange
→ { USD: number, JPY: number, updated_at: string }

GET /api/finance?type=stock&tickers=005930,TSLA,AAPL
→ { "005930": { price, name, updated_at, market?, inactiveStatus?, inactiveReason? }, ... }
```

캐시 슬롯: `getStockCacheSlot("domestic"|"foreign")` ([stock-cache-slot.ts](../../src/lib/finance/stock-cache-slot.ts))
- 장중: `"TICKER-{date}-H{HH}"` (1시간 단위 갱신)
- 장외: `"TICKER-{effectiveDate}"` (다음 개장까지 유지)

해외주식 비활성 응답: `classifyOverseasInactive()` — delisted/halted 분류 + 가격 0으로 반환 (클라이언트가 상태 반영).

---

### GET /api/finance/crypto
암호화폐 현재가 (업비트). 명세 [S-4.20](../specs/4.20-upbit-crypto-price.md)

```
GET /api/finance/crypto?symbols=BTC,ETH,SOL
→ { "BTC": { price, market: "KRW-BTC", updated_at }, ... }
```

캐시 슬롯: `getCoinCacheSlot()` ([coin-cache-slot.ts](../../src/lib/finance/coin-cache-slot.ts)) — 코인은 24시간 무휴장이라 장중/장외·영업일 구분 없이 **항상** `"{date}-H{HH}"`(KST 1시간).

- **캐시 1키 겸용(2026-08)**: `finance:coin:{market}`(slot·값·updatedAtMs를 한 레코드에 저장, TTL 3시간) — `getCoin(market, slot)`은 slot 일치로 신선 판정, `getCoinStale(market)`은 레코드 존재(=TTL 이내)로 stale 판정. `setCoin`은 SET 1회(과거엔 슬롯 키+stale 키 2개라 SET 2회였음). 파일 캐시는 `COINS` 단일 버킷(구 `COINS_LAST` 폐기) — **`STOCKS`와 반드시 분리**(prune이 주식 유효일 문자열 매칭이라 같은 버킷이면 코인이 삭제됨).
- **rate limit 방어**(업비트 IP 기준 10 req/s의 20%만 사용): 슬롯 캐시 → stale 즉시 반환 + `after()` 백그라운드 갱신 → 최초만 동기 대기. 외부 호출은 `finance:upbit:lock`(SET NX EX 5s) 직렬화 + 최소 500ms 간격. 로컬은 모듈 스코프 in-flight dedup.
- **무효 심볼 방어**: `market/all`(1일 캐시)과 교집합 후 조회 — 미상장 심볼이 섞이면 요청 **전체가 400 실패**. 응답에 없는 코인은 클라이언트가 수동값 유지.
- 429·418 → 재시도 없이 stale 유지 + `X-Upbit-Unavailable` 헤더.
- **인증 불필요**하지만 **Origin 헤더가 붙으면 10초당 1회**로 제한되므로 브라우저 직접 호출 금지 — 반드시 이 라우트로 프록시.

---

### GET /api/finance/profit
기준가(과거 종가) 조회. 기간별 수익 계산용.

```
GET /api/finance/profit?tickers=005930,TSLA&period=daily|weekly|monthly|yearly&basis=sameBusinessDay|kstAccessDay
→ ProfitRefResponse: Record<ticker, { refPrice, refDate, prevPrice?, prevDate?, chipPair? }>
```

**`chipPair?`(#4.73 U7, 선택 필드)** — `period=daily&basis=kstAccessDay`에서만. 서버 시각 `getTodayChipSession(market)`이 closed이고 그 종가쌍이 (refDate, prevDate)와 다를 때만 `{ closeDate, closePrice, baseDate, basePrice }`. 두 가격 모두 실제 종가일 = 요청일(롤백 값 금지). 캐시 먼저, 없는 날짜만 KIS(캐시 hit 경로는 이때만 L2·예산·토큰 확인). 실패·예산 초과면 필드만 생략하고 그 응답은 CDN 캐시 헤더 없음. 평일 정상 시각 KIS 추가 호출 0. 날짜 산출은 `profit-dates.ts` `resolveRefDates`(지수 라우트와 공용).

**basis 옵션 (기본 kstAccessDay):**
- `sameBusinessDay`(동일 영업일): `krDates = usDates = getDates(period,"foreign")` — 국내·해외 같은 영업일
- `kstAccessDay`(KST 접속일): 국내=domestic, 해외=foreign 독립 (기존 동작)

**서버 캐시 2단:**
1. `getRefDateForRequest(ticker, requestDate, period)` — 요청일→실거래일(KIS 응답일) 매핑
2. `getRefPrice(ticker, actualDate, adj?)` — 실거래일 기준 가격 (period별 차등 TTL, ytd는 다음 자정). `adj`=미국 ytd 수정주가(MODP=1) 키 `finance:refprice:adj:*`로 분리(#4.78). `period=ytd`는 profit·market-index 모두 허용

→ 휴장/공휴일로 요청일과 응답일이 달라도 다음 호출부터 영구 hit.
매핑 저장 가드: `res.date === task.date || !reqIsBusinessDay`(요청일이 비영업일=휴장/주말이면 폴백 확정값이라 저장). 요청일이 **영업일인데 응답일이 더 이른**(장중 미확정) 경우만 미저장 → stale 매핑 영구 hit 방지.

**해외 EXCD 사전 조회:** STOCKS 캐시(`{ticker}-{slot}` 또는 `{ticker}-{effectiveDate}`)에서 market 필드 → NAS/NYS/AMS 매핑 → `fetchOverseasHistoricalPrice(...preferredExcd)`에 전달. EXCD 미상이면 NAS→NYS→AMS 순 fallback.

**클라이언트 캐시:** `profit-utils.ts` → `secretasset_profit:{basis}:{period}:{date}:{tickers}` (localStorage)
- daily 키 date: sameBusinessDay=foreign refDate / kstAccessDay=domestic refDate (basis별 분리)
- 캐시 miss 시 BATCH_SIZE=3, BATCH_DELAY_MS=1000 배치 호출
- 같은 cacheKey 동시 요청은 `inFlightFetches` Map으로 dedup
- 모든 배치 완료 후에만 캐시 저장 (부분 결과 캐시 hit 회귀 방지)

---

### GET /api/finance/market-index (#4.73 #132)
코스피·S&P 500 기준 종가 — 시장과 비교 페이지·진입 글줄.

```
GET /api/finance/market-index?period=daily|weekly|monthly&basis=sameBusinessDay|kstAccessDay   # 둘 다 필수
→ { KOSPI: ProfitRefEntry | null, SPX: ProfitRefEntry | null }   # profit 응답과 같은 모양(지수 = 종목 1개짜리 바구니)
```
- 날짜는 종목과 같은 `resolveRefDates`(휴장 명목일 포함) + `pickCloseOnOrBefore`(요청일 이하 최근 종가, 국내 5일 롤백). KIS 코스피 `FHKUP03500100`(업종 0001)·S&P 500 `FHKST03030100`(시장 N, 코드 `SPX`) 기간 시계열 1회씩.
- 두 값이 다 있을 때만 `cdnCacheHeaders(secondsUntilNextHour())`. Redis 키 0. 서킷 open·예산 초과는 `X-KIS-Unavailable`. 클라이언트는 react-query 메모리만(`hooks/use-market-compare.ts`, localStorage 0).

---

### GET /api/finance/price-history (#4.81 #157)
종목 한 장 가격 흐름 — 수정주가 종가 시계열.

```
GET /api/finance/price-history?ticker=005930&range=1y|5y     # 둘 다 필수, 그 밖 쿼리 키는 읽지 않음
→ { ticker, range, currency: "KRW"|"USD", interval: "D"|"W", from: "YYYY-MM-DD", points: [{ d, c }], listedFrom? }   # 오름차순·날짜 중복 제거·c>0
```
- 국내 `FHKST03010100`(`FID_PERIOD_DIV_CODE` 1년 D·5년 W, `FID_ORG_ADJ_PRC=0`=수정주가), 해외 `HHDFS76240000`(`GUBN` 0/1, `MODP=1`, **`NCNT` 없음** → 회차 100행). 회차마다 종료일 = 직전 회차 가장 오래된 날짜 − 1일, 시작일 도달·100행 미만이면 중단, 회차 상한 4(`MAX_PAGES`). 해외 EXCD는 `getUsExchange`(마스터), 없으면 첫 회차 NAS→NYS→AMS 후 고정. `fetchPriceHistory`·`collectPages`·`buildPricePoints`(`src/lib/finance/price-history.ts`).
- `from` = 창 시작일(서버 기준) — 클라이언트 창 밖 매수 판정이 CDN 캐시 응답과 같은 기준을 쓰게. `listedFrom` = 첫 점이 시작일보다 10일 넘게 늦고 100행 미만으로 끝났을 때(상장 이후 기간만).
- 성공: `cdnCacheHeaders(6h, swr 1h)`, Redis 키 0. 실패·빈 points·시장 판별 불가 = `no-store`. 예산(`withinUpstreamBudget("kis", 4)`)·토큰·호출 실패 = 503(+`X-KIS-Unavailable`), 클라이언트는 `hooks/use-price-history.ts` react-query 메모리만(저장 0).

---

### GET /api/logo
종목 로고 이미지 프록시.

```
GET /api/logo?ticker=AAPL&theme=dark&size=192   # 해외 주식 — logo.dev /ticker
GET /api/logo?domain=www.samsung.com&theme=light&size=192
                                   # 국내 — logo.dev 도메인 조회
                                   # theme: light|dark(로고가 올라갈 배경 밝기), size: ~512
                                   # 내부적으로 format=png(투명)·retina=true·fallback=404 고정
                                   #   → retina로 반환 PNG는 요청 size의 2배. 호출부는
                                   #     captureLogoSize(표시px)=표시px*1.5 로 요청(과대 요청 시
                                   #     모바일 WebView가 로고 디코드 실패, 2026-09)
                                   # 실패는 항상 404(과거 302 리다이렉트 제거 — 크로스오리진이라
                                   # 인증카드 캡처의 dataURL 인라인이 CORS로 실패했음)
                                   # upstream fetch 타임아웃 8s + 진행 중 요청 cacheKey로 dedup
                                   #   (모듈 Map inFlight) — 캡처 시 동일 로고 동시 콜드 요청
                                   #   stampede로 일부가 404 되던 것 방지
                                   # Redis 캐시 키 v2:{d|t}:{key}:{size}:{theme}, TTL 1년
                                   # ※ Brandfetch(cdn.brandfetch.io)는 사용 불가 — Logo Link
                                   #   가이드라인이 서버 측 fetch·프록시·캐싱을 금지하며
                                   #   (x-bf-error: automated_traffic로 302) 브라우저 <img>
                                   #   직접 hotlink만 허용. 캡처용 same-origin 바이트와 비호환
GET /api/logo?domain=www.samsung.com  # 도메인 기반 (ETF, 국내 주식)
```

---

### POST /api/share — 자산 데이터 Short URL 저장
```
Body: { token: "v73A...", owner_id?: string }
→ { key: "a3f8b2c1ab", owner_id: "uuid" }
```
- **`v73A`(AES-GCM, PIN+URL키)만 저장**, 그 외(v72Z·v71N·v71P) 400. 토큰 ≤900k자, 본문 ≤1MB
- 키: `sha256(token)[:10]` (salt·nonce 무작위라 같은 자산도 매번 새 키)
- `owner_id`(UUID 형식만, 아니면 신규 발급)로 이전 키 자동 삭제, L1 분당 10회 + 하루 전역 5000(`rl:share-post:global:{날짜}`) — IP 미저장(5.113)

### GET /api/share?key=a3f8b2c1ab
```
→ { token: "v73A..." }  (구 v72Z도 읽기 허용, `BLOCK_LEGACY_V72Z_GET=true`면 410)
```
- `key`는 `^[0-9a-f]{10}$`만 허용(그 외 400 — `rl:` 등 내부 키 접근 차단), L2 분당 30회
v73A만 GET 시 TTL 30일 리셋(Sliding), v72Z는 연장 안 함(30일 내 자연 소멸)

---

### POST /api/parse-screenshot
스크린샷 Gemini AI 분석. **파일:** `src/app/api/parse-screenshot/route.ts`
**작은 이미지 가드(#4.60):** 가로·세로 모두 200px 미만(긴 변 < 200px)이면 Gemini를 부르지 않고(`reserveGeminiCalls` 앞, 한도 차감 0) Gemini 빈 배열과 같은 응답(`{stocks|cryptos|cashes|loans|trades|cryptoTrades: []}`)을 돌려준다. 판독(`image-size.ts`)은 PNG·JPEG·WEBP(VP8·VP8L·VP8X), 실패·HEIC는 통과. 크기·바이트 로그 금지.

```
Body: FormData { image: File(JPEG/PNG/WEBP/HEIC, 최대 10MB), assetType: "stock"|"crypto"|"cash"|"loan" }
→ { stocks|cryptos|cashes|loans: Array<{...}> }   // rawText 미반환(S-4.28)
```

**주요 응답 필드:**
- stock: id, name, ticker, quantity, currentPrice, averagePrice, currency, category, section, originalCurrency
- crypto: id, name, symbol, quantity, averagePrice, averagePriceMissing, currentPrice, exchange
- cash: id, name, type, balance, currency, institution
- loan: id, name, type, balance, interestRate, institution, startDate, startDateMissing

**서버 한도:** 하루 1500회 (`GEMINI_SERVER_DAILY_LIMIT`) + IP 없는 시간당 전역 150(`rl:gemini:global:{KST 시}`) + L1 분당 5 + 기기당 30(클라이언트 `use-gemini-usage`) — `reserveGeminiCalls` 원자 예약, 초과 시 429. /ratio 입구 풀 일 60(IP 한도 없음)
**에러:** 400(이미지 오류) / 422(파싱 실패) / 429(한도) / 500(키 미설정/AI 오류)

**Gemini 설정:** `gemini-2.5-flash-lite`, `temperature:0`, `maxOutputTokens:2048`, `thinkingBudget:0`, `responseMimeType:"application/json"`

### POST /api/xray-classify
X-Ray 종목 분류(NDJSON 스트리밍). **파일:** `src/app/api/xray-classify/route.ts`

```
Body: { items: { ticker, name?, market?, category? }[] }
→ NDJSON 라인들: { type: "meta"|"chunk"|"done"|"error", ... }
```

- 응답 분류 필드: `sector`(산업, 단일)·**`stockType`(종목 유형=투자 성격, 단일, #4.24)**·`themes`(다중)·`themePrimary`·`industry`·`region`·`marketCapTier`·`indices`(다중).
- `stockType` 7종: 성장주/배당성장주/배당주/지수투자/가치주/채권·현금성/기타 — `sector`와 나란히 매 종목 필수 응답.
- 서버 캐시(Redis, 90일 TTL, `v2:...` 키) — `themes`·`sector`·`stockType`·`indices` **모두 있어야 유효**, 하나라도 없으면 캐시 미스로 간주해 재분류(신규 필드 도입 시 점진적 백필).
- 서버 일일 한도 `GEMINI_SERVER_DAILY_LIMIT` + IP 한도, 배치 수만큼 `reserveGeminiCalls` 원자 예약, 초과 시 429.
- 프롬프트의 종목명은 **서버 마스터(kr/us-master) 이름**만 사용(클라이언트 `name` 무시 → 캐시 오염 차단), 요청에 포함된 티커만 캐시 저장.

### PUT /api/sync — E2EE 클라우드 동기화 업로드
```
Headers: x-sync-auth: base64url({ assetId, ts, nonce, sig })  // Ed25519 서명, 신선도 300초
Body: { iv: string, ciphertext: string, baseVersion: number, pubKey: string }
→ 200: { version: number }
→ 409: { asset: { version: number } }  // conflict — 원격이 더 새로움
→ 401: 서명 검증 실패 / 토큰 형식 불량
→ 429: PUT 인증 전 L1 IP당 분당 60(메모리) · 서명 통과 후 금고 id별 분당 20(`rl:sync-put:{assetId}:{분}`) · 신규 금고 하루 전역 1000(`rl:sync-new:global:{날짜}`)
```
- 토큰 형식(4.53): assetId `[A-Za-z0-9_-]{8,128}`·nonce `[A-Za-z0-9_-]{1,64}`·sig ≤200자·ts 유한 숫자 — 저장소 조회·서명 검증 **전에** 401. IP는 `api-guard.getClientIp`(x-vercel-forwarded-for 우선, XFF 우측)
- 서버 저장: `csync:asset:{assetId}` (Upstash Redis or 파일). 구조: `AssetEnvelope { pubKey, iv, ciphertext, version, updatedAt }`
- TOFU(처음 PUT이면 pubKey 등록), 이후 PUT은 등록된 pubKey로 서명 검증
- `baseVersion` < 서버 version → 409 conflict 반환

### GET /api/sync — E2EE 클라우드 동기화 다운로드
```
Headers: x-sync-auth: base64url({ assetId, ts, nonce, sig })
→ 200: { asset: { iv, ciphertext, version, pubKey, updatedAt } }
→ 404: 금고 미존재 (첫 pull)
→ 401: 서명 검증 실패 / 토큰 형식 불량
→ 429: IP당 분당 120회 초과(L1 `guardL1Only`, Redis 호출 전 차단 — 폴링 `fetchRemoteVersion`은 429를 null로 무시)

GET /api/sync?meta=1
→ 200: { version: number }  // 폴링용 버전 조회만
```

### 자동 push 트리거 (`src/lib/cloud-sync/cloud-sync-provider.tsx`)

**사용자 편집 신호만** push를 트리거한다(2026-10 — 파생값 제외 payload 비교 `getComparablePayloadString`·`lastPushedRef`·`skipNextChangeRef` 제거).

- 신호: `ASSET_USER_EDIT_EVENT`(`asset-data-context.tsx` — `saveData` 자산 CRUD·`addStockRaw`, 우회 저장 경로는 `notifyAssetUserEdit()`: 무티커 스크린샷 등록·파일 가져오기·공유 링크 반영) + `NICKNAME_EVENT` → `userEditRef=true`·`changeTick++` → 2.5s 디바운스 push. push 성공·pull 성공 시 해제.
- 파생 갱신(시세·코인·스냅샷·성적표 등급·부동산 실거래 추정·연도 순자산 자동값·마이그레이션)은 `saveAssetData`를 직접 호출해 신호가 없다 → push하지 않고 **다음 사용자 편집 push에 함께 실린다**(payload는 `buildExportPayload` 전체 그대로).
- **비교 트리거를 없앤 이유**: 제외 목록 방식은 파생 필드가 늘 때마다 샜다(2026-07 `baseDate` 매시간 핑퐁, 2026-10 날짜가 바뀐 조회 기기의 daily 30일 롤링 절단·`dailyArchive` 이관 → 조회만 한 기기가 push → 편집 기기에 "다른 기기의 변경을 반영했습니다." 토스트). 재도입 금지(R14).
- ⚠️ **성공한 pull은 `userEditRef`를 지운다**(로컬을 통째로 덮어썼으므로). 그래서 `autoPullIfNewer`가 `userEditAtRef`(마지막 편집 시각) 기준 최근이면 pull을 **보류**한다(`USER_EDIT_PULL_HOLD_MS`=10s 상한 — boolean으로 막으면 push 실패 시 타 기기 변경이 영구히 안 들어온다). 409 충돌 화해는 `force:true`로 우회.
- pull 병합으로 로컬 신규분을 되살렸으면(`mergedAdditions`) `runPushRef.current(true)`로 즉시 재-push.

**새 사용자 편집 경로를 만들 때**: `saveData`를 경유하거나, 우회 저장이면 `notifyAssetUserEdit()`를 반드시 호출(누락 시 다른 기기로 동기화 안 됨). 새 파생 필드는 별도 조치 불필요.

---

### POST /api/feedback — 의견·요청 Slack 전달
사용자 의견을 Slack Incoming Webhook으로 전달. **서버 저장 없음.** **파일:** `src/app/api/feedback/route.ts`

```
Body: { message: string(필수, 최대 2000자 절단), nickname?: string, contact?: string }
→ { ok: true }
```

- `SLACK_WEBHOOK_URL` 환경변수로 `{ text }` POST (`*[secretasset 의견·요청]*` + 닉네임/연락처/본문)
- `guardRequest`(본문 ≤16KB) + L2 `rl:feedback` 10분 5회. Slack `& < >` 이스케이프(멘션 무력화)
- **에러:** 400(message 공백/잘못된 요청) / 429(rate limit) / 500(`SLACK_WEBHOOK_URL` 미설정) / 502(웹훅 실패)
- 호출처: [tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/tool-menu.tsx) 더보기 > "의견·요청 보내기"

---

## 외부 API — 한국투자증권 OpenAPI (`src/lib/finance/finance-service.ts`)

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

## 공유 토큰 시스템 v7.2 (`src/lib/asset/asset-storage.ts`)

```
프리픽스: v71P(PIN 있음, 공유 가능) / v71N(PIN 없음, 로컬만) / v72Z(PIN+localKey, Zero-Knowledge)

generateShareToken(data, rates?, pin?, localKey?, snapshots?): string
parseShareToken(token, pin?, localKey?): ParseResult

stocks 필드 12개: [cat, name, ticker(name과 같으면 "*"), qty, avgPrice, currentPrice, currency, purchaseDate, description, purchaseRate, broker, inactiveStatus]
  // inactiveStatus: "d"=delisted, "h"=halted, ""=활성

realEstate 필드 14개: [type, name, address, purchasePrice, currentValue, purchaseDate, tenantDeposit, description,
                       regionCode, legalDong, complexName, addressDetail, exclusiveArea, areaUnitPreference("p"=평, ""=㎡)]
  // f[8]~f[13] = 실거래가 연동 검색 키(S-4.21). marketEstimate*(추정치·근거)는 파생값이라 미포함 —
  // 이관 후 접속 시 asset-data-context의 자동 갱신이 다시 채운다.
```

**섹션 필드 추가 규칙:** `row()`가 trailing 빈 값을 pop하므로 **섹션 끝에만** 필드를 덧붙인다.
그러면 구버전 토큰(필드 부족 → undefined)과 구버전 앱(잉여 필드 무시) 양방향 하위호환이 유지된다.
unpack 시 빈 문자열·0을 그대로 넣지 말고 조건부 스프레드로 생략해야 "미설정" 판정이 흐려지지 않는다.

packV7 parts[9]: 종가 기준 옵션 (`"k"`=kstAccessDay, ""/없음=sameBusinessDay). 구버전 토큰은 parts[9] 부재 → 기본값. `generateShareToken(...,profitBasis?)` / `parseShareToken` 결과 `profitBasis?` / 내보내기 JSON `profitBasis` 동일 직렬화.

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
  incrementCounter(key, by, ttlSec): number            // Lua INCR+EXPIRE 원자(TTL 없는 키 방지) — L2·업스트림 예산
  acquireLock(key, ttlSec): token|null / releaseLock(key, token)   // 소유자 토큰 확인 후 해제
  acquireUpbitLock(ttlSec): string|null / releaseUpbitLock(token)
  reserveGeminiDaily(todayStr, n, limit): number|null     // Lua 원자 예약(null=한도 초과)

  getDividend(cacheKey) / setDividend(cacheKey, data, ttlSec?)   // 키 v12(type 포함), 빈 결과 TTL 600
  getRefPrice(ticker, actualDate, adj?) / setRefPrice(ticker, actualDate, price, period, adj?)
    // dateStr은 KIS 실거래일 (res.date) — 응답일 기준 저장
  getRefDateForRequest(ticker, requestDate, period) / setRefDateForRequest(...)
    // 요청일 → 응답일 매핑. 휴장으로 요청일≠응답일이어도 다음 호출 영구 hit

  getGeminiDailyCount(date) / incrementGeminiDailyCount(date) / checkGeminiDailyLimit(date, limit)

  // E2EE 클라우드 동기화 (AssetEnvelope)
  getAssetEnvelope(assetId): AssetEnvelope | null
  setAssetEnvelope(assetId, envelope: AssetEnvelope): void
  // Redis 키: csync:asset:{assetId}
}

getCacheStorage(): ICacheStorage
// KV_REST_API_URL 있으면 → UpstashStorage (Redis)
// 없으면 → FileStorage (data/*.json) — 단 VERCEL_ENV production·preview면 throw(fail-closed)
// setStock은 전체 SCAN 없음, share 토큰 맵은 Object.create(null)

// 파일 캐시 필드:
// STOCKS, EXCHANGE, DIVIDENDS, REF_PRICES, REF_DATE_MAP, GEMINI_COUNT
// REF_DATE_MAP 키: "{ticker}:{period}:{requestDate}" → actualDate
```

**클라이언트 한도:** `src/hooks/use-gemini-usage.ts` — localStorage `secretasset_gemini_usage`, 하루 15회

### 알림 API (#4.91)
- `POST|DELETE /api/push/subscribe` — body `{endpoint,p256dh,auth,topics,standalone:true}`(DELETE는 `{endpoint}`). body에 `cond:"daily"|"pm2"` 필수. topics는 `morning|kr|settle|tax`만 허용, 그 외 ID는 400·추가 필드 폐기. 검증 실패 400·키 미설정 503·IP 30/시간. Redis에는 endpoint 해시(HMAC) 키 + 암호화 블롭 + 종류 ID·cond·날짜만.
- `GET /api/push/cron` — 09시 KST Cron(`0 0 * * *`): 아침 시장 요약(월~금, 한국 휴장일 포함)·결산·세금, 09시 회차는 구독자별 1건으로 합침(결산>세금>아침). `GET /api/push/cron/kr` — 16시 KST Cron(`0 7 * * *`): 국내 장 마감(평일·국내 영업일). 둘 다 CRON_SECRET·운영 전용, KIS 일봉(지수 4개+환율 `X`/`FX@KRW`) 날짜 검증 통과 항목만, 응답·로그는 건수·항목 상태만(C96). 중단 스위치 = Vercel 대시보드 Cron Jobs Disable.
- `POST /api/push/test` — preview·로컬 전용(운영 404). 본인 구독 1건에 고정 샘플, 구독당 1분 1회·IP 10/시간.
- 환경 변수: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`·`VAPID_PRIVATE_KEY`·`VAPID_SUBJECT`·`PUSH_STORE_KEY`(base64 32바이트)·`CRON_SECRET`(운영).
**클라이언트 한도:** `src/hooks/use-gemini-usage.ts` — localStorage `secretasset_gemini_usage`, 하루 30회
