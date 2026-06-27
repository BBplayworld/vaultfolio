# 전체 기능 QA 테스트 계획 (secretasset)

> 앱 **전체 기능**의 회귀 테스트 + **UI 품질 유지** 상시 체크리스트. 릴리즈 전·대형 변경 후 이 문서를 단일 출처로 일괄 점검한다.
> 원칙: **라이브 프리뷰 검증 제외**(CLAUDE.md). ⚙ 자동·코드레벨 검증은 직접 수행, 👤 앱 수동 항목은 사용자 실행 체크리스트로 산출한다.
> 사용법: 변경 범위에 해당하는 섹션만 골라 점검하거나, 릴리즈 전 전체를 순회한다. 발견 이슈는 P0(데이터 손실/크래시)·P1(기능 오작동)·P2(UX·표시)로 분류.

---

## Phase 0 — 자동 베이스라인 (항상 먼저)

```bash
npx tsc --noEmit        # 타입 0 errors
npx vitest run          # 단위 테스트 전부 pass (trade-utils, validate-reflection)
npm run lint            # ESLint 0 errors (기존 warning 외 신규 무발생)
npm run build           # 프로덕션 빌드 + 전체 라우트 생성
```

- [ ] tsc 0 errors
- [ ] vitest 전부 pass
- [ ] lint 0 errors (신규 warning 없음)
- [ ] build 성공 (모든 라우트 생성)

> 실패 시 해당 기능 Phase로 내려가 코드 경로를 추적한다(추측 패치 금지 — 근본 원인부터).

---

## Phase 1 — 기능별 테스트 매트릭스

각 기능: **핵심 / 엣지·경계 / 회귀**. ⚙=자동·코드레벨, 👤=앱 수동.

### F-ASSET. 자산 CRUD (주식·암호화폐·부동산·현금·대출·년도별 순자산)
- ⚙ add/update/delete가 `saveData` 단일 저장 경로 사용, 삭제 후 합계 재계산 ([asset-data-context](../../src/contexts/asset-data-context.tsx) `getAssetSummary`)
- 👤 각 자산 유형 추가→수정→삭제, 순자산/총자산/총부채 즉시 갱신
- 👤 비종목 자산(부동산·대출·현금) 카드 접힘행 왼쪽=`이름 / 비중%`만, 상세 펼침에 종류·매입가(부동산)·금리·금융기관(대출) 노출 — 주식 카드 패턴과 통일
- 👤 주식 보유종목 스크린샷 가져오기 미리보기([stock-screenshot-import.tsx](../../src/app/(main)/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx)) 카드 레이아웃 그리드 정렬 및 증권사 드롭다운 텍스트 짤림 방지 확인
- 👤 주식 스샷 **공통/개별 적용 토글**: 기본 "공통 적용"(카테고리·증권사 1세트 → 전 종목 일괄), "개별 선택" 전환 시 종목별 드롭다운 노출. 공통 카테고리 변경 시 해외↔국내 가격/통화 환산이 개별 변경과 동일한지
- ⚙ `convertStockCategory` 단일 헬퍼로 `updateCategory`·`applyCommonCategory` 환산 로직 일원화(중복 제거), 파싱 직후 다수=해외→`foreign`/그 외 도메스틱·`activeTab` 기준 공통 기본값 설정 + `matchBrokerHint` 증권사 자동 매칭
- 엣지: 0개 상태(웰컴가이드 노출), 단일 항목 표시(`length > 0` 규칙)
- 회귀: 부동산 임차보증금(tenantDeposit) 순자산 차감, 대출 잔액 차감

### F-STOCK. 주식 상세 탭 ([stock-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/stock-tab.tsx))
- 👤 종목 카드 펼침/접힘, 증권사별 분할(`SubStockCard`)·나누기 다이얼로그, 주식담보대출 연결 표시
- 👤 비활성: 상장폐지(red)·거래정지(amber) Badge, delisted 평가 제외 / halted 마지막가 유지
- 👤 요약 헤더 평가손익·전일 대비, 해외 상세 환차손익(금액/수익률 2줄, 우측 매입환율 영역 미침범)
- ⚙ `computeStockMetrics`·`mergeStockGroup`·`groupStocksByTicker` 동일 ticker 병합(1회 집계)
- 엣지: 해외주식 원화/달러 평단 입력 분기, 환차익 계산
- 회귀: delisted 종목이 stockCount·stockCost·환차익에서 제외

### F-TRADE. 주식 거래내역 (매매 로그) ([trade-input.tsx](../../src/app/(main)/_components/forms/trade/trade-input.tsx) · [stock-trades-view.tsx](../../src/app/(main)/_components/views/detail/trades/stock-trades-view.tsx))
- 👤 거래 입력(매수/매도), 반영 ON/OFF, 반영 후 예상 포지션 인라인 미리보기, 중복 거래 인라인 확인
- 👤 거래 삭제 → 미반영 즉시삭제 / 반영 롤백 다이얼로그
- ⚙ `trade-utils`: 가중평균 평단·환율, 매도 차감, 미반영 스킵, **역산 롤백(수동 보유분 보존)**, `findDuplicateTransaction`, `pruneTransactions` 3년 롤링
- ⚙ `validate-reflection`: oversell/중복반영 restrict, manual_override/backdated confirm
- 엣지: 수동 보유분+반영거래 삭제 시 보유분 보존(P1 회귀), 전량매도 평단 0, 보유초과 매도 차단, 미래·보존기간(3년) 밖 날짜 차단
- 회귀: `addTransactionWithPosition`/`deleteTransactionWithPosition` 단일 저장(stale-closure 방지)

### F-TRADE-SS. 거래 스크린샷 가져오기 ([trade-screenshot-import.tsx](../../src/app/(main)/_components/forms/trade/trade-screenshot-import.tsx))
- 👤 스크린샷 업로드→인식→선택 등록, 다종목 일괄(`addTransactionsBatch`)
- 엣지: 통화 KRW/USD 분기, 중복 거래 처리, 매칭 실패 종목 제외

### F-XRAY. 주식 X-Ray ([stock-xray-view.tsx](../../src/app/(main)/_components/views/detail/xray/stock-xray-view.tsx) · [lib/xray](../../src/lib/xray))
- 👤 5축(핵심분야·시가총액·지수·지역·통화) 전환, 분포바·집중도 등급, AI 분류 진행률, 프롬프트 확인·복사
- ⚙ `stock-xray` `computeBreakdown` 단일배정·합 100%, 미분류 처리, 레버리지/인버스 ETF 지수매핑(TQQQ·QLD→NASDAQ100, UPRO·SSO→S&P500)
- ⚙ `fetch-classifications` 캐시 hit 스킵·dedup·스트리밍, 실패 토스트 폴백, `classification-store` localStorage 90일
- 엣지: 전량 미분류 시 "준비 중", 집중도 임계값 0.6/0.35, delisted 가치 0
- 회귀: ticker 병합 후 집계(1회 노출)

### F-ACTIVITY. 성과 (순자산·수익·배당) ([views/activity](../../src/app/(main)/_components/views/activity))
- 👤 순자산 차트(현재+전년 대비), 수익 차트(기간별 일/주/월/연, basis 토글), 배당 차트(연간+월평균, 예상/실제)·월별 배당 종목
- 👤 수익 차트 "기준 종가 비교": 시작 종가가 휴장으로 직전 영업일에 폴백되면 "휴장제외" 최소 표시 — 일별=시작~종료 사이 휴장(`hasHolidayBetween`), 주/월/연=명목 기준 시작일 자체가 휴장(`isKr/UsHoliday`)
- ⚙ `fetchProfitRef` + `getProfitCacheKey`: **tickerList `.sort()` 필수**(캐시 중복 회귀 다발), basis별 캐시 분리
- ⚙ `computeDailyStockProfit` 전일 종가 대비, `ProfitBasis`(sameBusinessDay/kstAccessDay), `getDailyClosingRefDates` 시장별 컷오프(국내16:00·해외06:00/07:00 KST)
- ⚙ 휴장 폴백 캐시: 요청일이 비영업일(`isKrBusinessDay`/`isUsBusinessDay`)일 때만 응답일 기준 ref-date 매핑 저장(churn 제거), 영업일+장중 미확정은 미저장(stale 방지) ([route.ts](../../src/app/api/finance/profit/route.ts))
- 엣지: 전년 데이터 없음, 조회 중 상태, 배당 매수일 이전 payout 제외
- 회귀: 2단 캐시(REF_DATE_MAP/REF_PRICES) 휴장일 영구 hit, daily 캐시 키, 일별 표시값(국내 휴장 시 직전 영업일 종가) 불변

### F-HUB. 집중도·허브·대시보드
- 👤 `detail-hub`(카테고리별 평가손익·건수), `performance-hub`(순자산·수익·배당 KPI), `dashboard` 도넛/금융자산 바
- 엣지: 빈 카테고리 클릭 비활성, 단일 종목, 0·음수 값
- ⚙ `assignColors` 최대값=MAIN_PALETTE[0]

### F-SHARE. 공유 (Zero-Knowledge) ([header-menu/share](../../src/app/(main)/_components/header-menu/share) · [api/share](../../src/app/api/share))
- 👤 공유 URL 생성·로드, Short URL(s:KEY), PIN 보호(4자리), 잘못된 토큰→invalid-access
- 👤 공유 시 발신 기기의 테마가 라이트 모드이면 URL 뒤에 `&theme=light` 파라미터가 포함되며, 수신 기기에서 이 링크로 진입 시 즉시 라이트 모드로 전환 및 쿠키 동기화되는지 확인
- 👤 공유 테마 링크 진입 시, 자바스크립트(Hydration) 로드 이전 HTML 극초기 렌더링 단계에서 테마 깜빡임(Flash) 현상 없이 즉시 송신 측 배경색(bg)으로 표시되는지 확인
- ⚙ packV7/v7.2/v72Z 직렬화·복호화, 스냅샷·profitBasis·nickname 포함
- 엣지: PIN 불일치 재시도, v72Z localKey 손상 시 즉시 invalid, URLSearchParams `+`→공백 복구
- 회귀: **공유 토큰 버전 호환**(신규 필드 추가가 기존 URL 파싱 안 깨뜨리는지), 스냅샷 구분자 충돌

### F-SCREENSHOT. 인증샷 (share-card) ([share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx))
- 👤 인증샷 생성, 섹션 선택(도넛·주식), 금액/카테고리 숨김 마스킹, 핵심 포트폴리오 강조
- 👤 주식 섹션: 비중바·포트폴리오(범례) 하단에 종목 리스트(헤더+비중 그라데이션 바) 노출, 요약 헤더는 전일 대비/구분선 제거·평가손익이 평가금액과 동일 행 정렬
- ⚙ `screenshotMode` 본문과 시각 일치, `maskFn` 적용
- 엣지: 카테고리 필터(전체/해외 등), 빈 섹션

### F-IMPORT-EXPORT. 데이터 내보내기/가져오기
- 👤 JSON 내보내기→가져오기 라운드트립, 자산·스냅샷·옵션 보존
- ⚙ `use-asset-import`, 스키마·`validate-reflection` 검증, 악성·손상 JSON 방어
- 회귀: 가져오기 후 `dataResetVersion`++로 진행 중 fetch abort

### F-CLOUD-SYNC. E2EE 클라우드 동기화 ([cloud-sync](../../src/lib/cloud-sync) · [api/sync](../../src/app/api/sync/route.ts))

#### 코드레벨(⚙)
- ⚙ 용어 표준화 — `AssetEnvelope`(구 VaultEnvelope), `assetId`(구 syncId), `pushAsset/pullAsset`, Redis 키 `csync:asset:{assetId}`. **URL 해시 `#sync=<assetId>`, `SYNC_HASH_PARAM = "sync"`**(구 `#asset=`/`#vault=` 진입 호환 — provider `detect`·`clearPendingConnect` 모두 신구 처리) ([config.ts:27](../../src/lib/cloud-sync/config.ts) · [provider:153,291-295](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **3-상태 모델**: `none`(금고 미설정) / `locked`(assetId만 보유, 이번 세션 미무장) / `armed`(키 메모리 보유→자동 동기화). 마운트 시 `loadRememberedMaster` unwrap 성공+assetId 존재 → 자동 `armed`, 아니면 `locked`/`none` ([provider:124-146](../../src/lib/cloud-sync/cloud-sync-provider.tsx))
- ⚙ **자동 동기화** — 송신: 자산(`assetData`)·닉네임(`NICKNAME_EVENT`→`changeTick`) 변경 → `AUTO_PUSH_DEBOUNCE_MS=2500` 디바운스 무음 push. 수신: `POLL_INTERVAL_MS=30000`(30s) 폴링(`document.visibilityState==="visible"`일 때만)+`focus`+`visibilitychange` → `fetchRemoteVersion > getVersion()`이면 자동 pull.
- ⚙ `crypto.ts` 키 파생(결정적): `deriveSalt = SHA-256("secretasset-salt|"+assetId)[:16]`(서버 미전송, 접두 불변) → `masterBits = PBKDF2(passphrase, salt, 200k, SHA-256, 32B)` → `encKey = HKDF(info"enc")`(AES-256-GCM) + `ed25519Seed = HKDF(info"ed25519")`(Ed25519 키쌍). `generateAssetId()` 128비트 base64url. 전송=iv·ciphertext·pubKey(1회)·서명뿐
- ⚙ `device-key.ts`: remember 시 `masterBits`만 **기기 비추출(non-extractable) AES-GCM 키**(IndexedDB `secretasset_kv`)로 wrap → `rememberedKey`(평문 금지). IndexedDB는 `clearAssetData`(localStorage 한정)에 안 지워짐
- ⚙ `sync-state.ts`: `SYNC_STATE_KEY = "secretasset_sync"` 단일 키. `assetId/version/lastSyncedAt/rememberedKey`. salt·privKey·pubKey 미저장
- ⚙ `sync-client.ts` `makeAuthToken`: canonical=`[method, assetId, ...extra, ts, nonce].join("|")`. nonce 12바이트 base64url, ts 초단위
- ⚙ `pushAsset`: AES-GCM 암호화 → PUT `/api/sync`. canonical extra=`[baseVersion, sha256(ciphertext)]`. 409 → `{status:"conflict", remoteVersion}`
- ⚙ `pullAsset`: GET `/api/sync` → AES-GCM 복호화 → `applyImportedPayload`(검증 실패 throw→기존 보존). 404→`empty`, 401/복호화 실패→error
- ⚙ `fetchRemoteVersion`: GET `/api/sync?meta=1` — 미존재/오류 → `null`
- ⚙ **서버([route.ts](../../src/app/api/sync/route.ts))**: TOFU 최초 등록은 `body.pubKey`로 검증, 기존 금고는 저장된 pubKey로만 검증 + `pubKey` 교체 시도 시 **403**. `current.version > baseVersion` → **409**(낙관적 동시성, version+1). `SIG_FRESHNESS_SEC=300`(±5분), `MAX_CIPHERTEXT=4MB`→**413**, PUT만 `checkRateLimit`(IP)→**429**. Redis `csync:asset:{assetId}` + `CSYNC_TTL_SECONDS` 슬라이딩 만료(get 시 expire 갱신) ([cache-storage.ts:548-558](../../src/lib/cache-storage.ts))

#### 정밀 실행 시나리오(👤 단계별 — 사전조건→단계→기대)
- **S1 신규 금고(none→armed)**: 더보기>기기 동기화 → 금고 암호(8~50자, **영문 소문자+숫자+특수문자 필수** `validatePassphrase`) → "동기화 시작"(`enableSync`: generateAssetId→clearSyncState→첫 push TOFU) → armed, 복구 링크/QR/`sync:` 코드 노출
- **S2 링크 진입 연결**: 다른 기기에서 `#sync=<assetId>` 열기 → `CloudSyncConnectDialog` 자동(pendingConnectAssetId, sync 코드 readOnly) → 금고 암호만 입력 → `connect`→pull→armed, 자산 동일·튜토리얼 전체 스킵(`skipAllTutorialSteps`)
- **S3 수동 코드 연결**: none 화면 "기존 기기 동기화 연결" → `sync:xxxx`(assetId 정규식 `^[A-Za-z0-9-_]{20,24}$`) → 연결. `/`·`#`·`?` 포함 시 "복구 링크는 주소창에" 거부
- **S4 PWA 첫 실행 연결**: standalone+자산 0개 → `PwaConnectPrompt` 전체화면 → `sync:` 붙여넣기 → `#sync=` 해시 설정 → 금고 암호 모달. `share:` 코드는 `importSharedByCode`(PIN 경로)
- **S5 잠금 해제(locked→armed)**: rememberedKey 없는 재진입 → locked → 금고 암호 → `unlock`(armWithPull). remember 재선택 가능
- **S6 충돌(409)**: A push 후 B가 stale baseVersion push → conflict → "클라우드가 더 최신…" 토스트 + 자동 pull(`autoPullRef.current()`)로 수렴
- **S7 암호 오류**: 틀린 금고 암호 → pull 401/복호화 실패 → "금고 암호가 올바르지 않습니다." + **기존 로컬 데이터 보존**(keysRef null 복귀)
- **S8 기억/해제**: remember ON→`saveRememberedMaster`→재진입 무암호 자동 armed. armed 화면 "이 기기 연결 끊기"(`forget`)→clearSyncState→none
- **S9 pull 후 자격 재기록(R-신규)**: pull의 `applyImportedPayload`(clearAssetData)가 `secretasset_sync` 삭제 → `runPushAfterRestoreFix`로 assetId·rememberedKey 재기록 → assetId 유실 없음
- **S10 push-loop/동시성 가드**: pull 직후 `skipNextChangeRef`로 디바운스 push 미발생, `busyRef` 뮤텍스로 push/pull 동시 실행 차단("동기화 중입니다.")

#### 엣지·회귀
- 엣지: 첫 pull(404→`empty`), 서명 만료(ts±300s 초과→401), assetId 없는 상태 push/pull 차단("잠금 해제가 필요합니다."), 4MB 초과(413), 동일 출처 XSS는 device-key decrypt 호출 가능(완전 방어 아님, 표준 완화)
- 회귀: `clearAssetData` 후 `SYNC_STATE_KEY` 재기록(S9), `getComparablePayloadString()`이 `lastUpdated` 제외 비교로 무한 push 루프 차단

### F-SYNC. 가격·환율 동기화
- 👤 종목 현재가·환율(USD/JPY) 자동 갱신, 갱신 완료 토스트
- ⚙ `getStockCacheSlot` 장중 1시간/장외 날짜 슬롯, outdated 판정, 3개씩 배치+1초 간격
- 엣지: 데이터 삭제/불러오기 중 sync abort(epoch+AbortController), 취소된 응답 미반영
- 회귀: foreign+KRW→USD 마이그레이션, market 캐시 비었을 때 재조회

### F-SNAPSHOT. 자산 스냅샷
- ⚙ 일별(이번 달)·월별(올해 12개월)·년도별 종가 기준 저장, 토/일 보완
- 회귀: `saveSnapshotsBlockedRef` 차단, tickerList 정렬, 종가(refPrice) 폴백

### F-NAV. 네비게이션 (drill-down)
- 👤 `#detail/stocks` 직접진입·새로고침·뒤로가기, InlineSelector 탭 전환, scrollTo(0,0)
- 엣지: 잘못된 hash 폴백, `back()` 항상 홈 복귀, 웰컴가이드 시 헤더 미노출

### F-PWA. PWA 설치 및 오프라인 접근성 ([pwa](../../src/app/(main)/_components/pwa))
- ⚙ `manifest.ts` (/manifest.webmanifest) 동적 JSON 응답 및 `share_target` 매핑 설정 정상 동작 확인
- ⚙ `layout.tsx` `appleWebApp` 메타데이터(`capable: true`, `statusBarStyle: "black-translucent"`) 및 `icons.apple`(`/icons/icon-192x192.png` 180×180) 포함 출력 확인
- ⚙ 서비스 워커 `/sw.js` 성공적인 브라우저 등록 및 static 에셋 오프라인 로컬 캐싱(Stale-While-Revalidate) 보장
- ⚙ `usePWAInstall`: `isIOS`·`isInApp`은 **`detectBrowserEnv()` 단일 소스 위임**(`platform==="ios"`/`isInApp`). **iPadOS 13+ 데스크톱 위장 UA(Macintosh) → `maxTouchPoints>1`로 iPad=iOS 인식**(미인식 시 iPad가 PC로 빠져 설치·코드복사 흐름 깨짐). standalone 제외 처리 확인
- ⚙ `detectBrowserEnv()` ([lib/pwa/detect-browser.ts](../../src/lib/pwa/detect-browser.ts)) → `BrowserEnv { platform: "ios"|"android"|"pc", browser: GuideBrowser, isInApp, iosSafariModern }`. `GuideBrowser` = `safari`/`chrome`/`whale`/`samsung`. flow에서 `useEffect(setEnv(detectBrowserEnv()))`로 마운트 후 1회 감지. **`iosSafariModern`** = iOS 순정 Safari + 메이저 ≥ 15(`parseIosMajor`: `os N_` 우선, iPad 위장 UA는 `version/N` 폴백) → 신형 가이드(`IosSafariNewShareStep`: 하단 ⋯ 메뉴→공유), 그 외 구형(`IosShareStep`: 하단 중앙 공유). **iPad(iPadOS 13+)는 Macintosh UA+`maxTouchPoints>1`로 iOS 판별** — UA만으론 PC 오인식(회귀 위험). 브라우저: crios=chrome / whale=whale / 그 외 safari, samsungbrowser=samsung(Android)
- ⚙ **설치 흐름 단일화** — 설치 다이얼로그+로직(state·`handleButtonClick`·`handleInstall`·`generateShareArtifacts`·iOS/인앱/동기화 분기)은 공용 컴포넌트 [pwa-install-flow.tsx](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx) 단일 소스. 트리거는 children(render-prop, `{ onClick, loading, isIOS, isInApp, isInstallable }`)로 주입. [pwa-install-button.tsx](../../src/app/(main)/_components/pwa/pwa-install-button.tsx)는 다운로드 아이콘 버튼만 전달하는 얇은 래퍼. **홈 버튼·웰컴가이드가 동일 흐름 공유** — 한쪽만 수정 시 회귀 주의
- ⚙ **설치 가이드 단일화** — 옛 `PwaInstallGuideDialog`(3탭 다이얼로그) 제거 → [pwa-install-guide-content.tsx](../../src/app/(main)/_components/pwa/pwa-install-guide-content.tsx) `InstallGuideContent({ env })`로 통합. flow의 `iosStep`·`guideStep` 모두 동일 컴포넌트 임베드. 모바일=설치 애니메이션+step1/step2 설명+"다른 브라우저인가요?" 칩 재선택(오감지 대비)+접이식 "설치가 안 되나요?", PC=시크릿모드/`chrome://apps` 재설치/Firefox 미지원 문제해결
- ⚙ iOS·Android step SVG([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)) `InstallGuideAnimation({ platform, browser })`는 **실제 브라우저 UI 구조 반영(주소창 하단)**: Safari=하단 중앙 `공유`→`홈 화면에 추가` / Chrome(iOS)=주소창 우측 `공유` 직접 / Chrome(Android)=우측상단 `⋮`→`공유` / Whale=하단 우측 `≡`→`공유` / 삼성인터넷=하단 `☰`→`+ 현재 페이지 추가`→홈 화면. step1/step2 안내 문구(`step1Text`/`step2Text`)도 각 구조와 일치. **aspect-ratio 미지원(구형 Safari) 대비 `paddingTop` 스페이서로 220:290 비율 폴백**
- ⚙ **SVG 애니메이션 공용화**([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)) — 모든 단계형 애니메이션이 공용 `StepAnimationPlayer`(캡션 옵션·**멈춤/시작 버튼**·단계 점 클릭 이동·`resetKey`)에 위임. 컷 간격 **3000ms 통일**, `prefers-reduced-motion` 시 자동재생 끔. `SyncSetupAnimation`=기기 동기화 4컷(① ⋯더보기[가로 점]→간편공유·기기동기화 가로 카드 → ② 금고암호 → ③ 동기화 링크 → ④ **새 기기**[teal `tone="new"`+`DeviceBadge` "새 기기" — 실제 다른 기기])
- ⚙ **PWA 가이드 단일화**([pwa-guide-illustrations.tsx](../../src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx) `PwaSetupAnimation({platform,browser})`) — **공지(notice)와 설치 가이드(`InstallGuideContent`)가 동일 컴포넌트 공유**(구 `InstallGuideAnimation` 제거). **①앱 설치(복원 코드)·④앱(PWA) 첫 실행 복원**(같은 기기 — 기본 frame + brand `DeviceBadge` "앱 (PWA)", 동기화의 "새 기기"와 구분 / 동기화=금고암호·일반=PIN 4자리 2케이스)은 공통, **②③은 `getGuideSteps(platform,browser)`로 접속 브라우저별 공유/메뉴→홈 화면 추가** SVG. PC(`platform==="pc"`)는 네이티브 설치라 ②③ 생략(공통 2컷). 브라우저 재선택 칩 변경 시 `resetKey`로 ②③ 즉시 갱신. **iOS Safari는 `iosSafariModern`(UA iOS 메이저 ≥ 15)로 신형(⋯메뉴→공유)/구형(중앙 공유) SVG·step1 문구 분기**. 컷 간격 **3000ms**
- ⚙ **구형 iOS Safari 컷 미전환 버그 수정** — 원인=opacity로 스택된 컷 레이어의 repaint 누락(구형 Safari)으로 다음 컷 안 바뀜. 해결=**활성 컷 1개만 렌더 + `key={active}` remount**(`StepAnimationPlayer`)로 모든 브라우저 전환 보장. 진입 페이드는 `motion-safe:animate-in fade-in`. 자동 전환은 콘텐츠 진행이라 reduced-motion에서도 동작(페이드만 비활성), 멈춤 버튼으로 정지. opacity 스택 레이어 방식 재도입 금지
- ⚙ **컨트롤 클릭성** — 멈춤/시작·단계 점은 `pointer-events-auto`로 공지 본문(`pointer-events-none`) 안에서도 동작. 점은 `size-3`+`after:-inset-2` 히트영역, 클릭 시 해당 컷 이동+일시정지
- 👤 완전 오프라인(네트워크 단절) 상태에서 앱 새로고침 시에도 자산 대시보드 화면이 에러 없이 로컬 스토리지로부터 정상 로드 및 렌더링되는지 확인
- 👤 **PC/Android Chrome·Edge**: `beforeinstallprompt` 발생 → 설치 버튼 클릭 → PIN 4자리 입력 → 설치하기 → 네이티브 A2HS 창 열림 확인
- 👤 **iOS(Safari·크롬·웨일 등)·Android(크롬·웨일·삼성인터넷)**: 설치 버튼 클릭 → PIN 입력 → "추가 방법 보기" → `iosStep` 가이드(`detectBrowserEnv` 감지 브라우저의 설치 애니메이션 + step1/step2) 노출. `navigator.share()` 호출 없음, Safari 한정 문구 없음 확인. 오감지 시 "다른 브라우저인가요?" 칩으로 재선택
- 👤 가이드 step SVG·문구가 실제 스샷과 일치하는지(브라우저별 공유/메뉴 진입 위치). 칩 재선택 시 애니메이션·step 문구가 즉시 해당 브라우저로 갱신
- 👤 **인앱 브라우저(카카오톡·인스타·페북·라인 등)**: 설치 버튼 클릭 → `inAppStep` 가이드(메뉴→다른 브라우저로 열기→앱 설치) 노출, 현재 URL 클립보드 복사 시도 확인
- 👤 **설치 불가 상태(고스트)**: PC에서 `beforeinstallprompt` 없을 시 `guideStep`(제목 "앱 설치 가이드") + `InstallGuideContent` PC 문제해결 노출 — 시크릿모드 불가 콜아웃, `chrome://apps` 자동/수동 복사, Firefox 미지원 주의. 모바일은 접이식 "설치가 안 되나요?"에 인앱·재설치 안내
- 👤 PWA 외부 공유 대상(Web Share Target)을 통해 자산 동기화 링크가 공유 되었을 때, 진입 즉시 쿼리 파라미터(`url`/`text`)에서 해시를 추출하여 연결/복구 창으로 즉각 라우팅하는지 확인

#### PWA 설치 정밀 시나리오 (isSyncMode 분기)
- ⚙ **isSyncMode 분기**([pwa-install-flow.tsx:84-88,135-181](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx)): 설치 시 `getAssetId()` 존재(동기화 기기) → **PIN 불필요**, 코드=`sync:<assetId>`(서버 업로드 없음). 비동기화 → **PIN 4자리(InputOTP) 필수** + 코드=`share:KEY_LOCALKEY`(공유 토큰 `/api/share` POST 저장). `codeLabel`도 "동기화 코드"/**"복원 코드"**(구 "연결 코드" 전면 개명)로 구분
- ⚙ **iOS 클립보드 보존**: `await fetch` 뒤 `writeText`는 제스처 만료로 실패 → `ClipboardItem`에 Promise(text/plain) 동기 전달로 자동 복사 보존 → 실패 시 `writeText` 폴백([pwa-install-flow.tsx:153-168](../../src/app/(main)/_components/pwa/pwa-install-flow.tsx)). 인앱 가이드(`openInAppGuide`)도 동일 기법으로 현재 URL 복사
- ⚙ `usePWAInstall`: `isInstallable`/`isIOS`는 `&& !isStandalone`로 노출, `__bipEvent`(head 캡처) 우선 사용해 제스처 내 `installPWA` 호출([use-pwa-install.ts](../../src/hooks/use-pwa-install.ts))
- 👤 **P1 PC/Android Chrome·Edge**: `beforeinstallprompt`(또는 `__bipEvent`) → 버튼 클릭 → 즉시 네이티브 A2HS(`installPWA`), 성공 토스트
- 👤 **P2 iOS/인앱**: iOS=PIN/코드 준비 후 `iosStep`(STEP1 홈추가 + STEP2 코드 붙여넣기), 인앱=`inAppStep`(외부 브라우저 유도+URL 복사)
- 👤 **P3 동기화 기기 설치**: isSyncMode → PIN 입력란 없음, "설치하기" 후 `sync:<assetId>` 자동 복사. 새 기기 앱 첫 실행 → `PwaConnectPrompt`에 붙여넣기 → 금고 암호로 복원(F-CLOUD-SYNC S4)
- 👤 **P4 비동기화 설치**: PIN 4자리 → `share:` 코드 자동 복사 → 새 기기에서 붙여넣기 → PIN 입력 복원
- 👤 **P5 설치불가 고스트(PC)**: `beforeinstallprompt` 없음 → `chrome://apps` 자동 복사 + `guideStep`(InstallGuideContent PC 문제해결)

### F-ONBOARD. 튜토리얼·온보딩 ([welcome-guide.tsx](../../src/app/(main)/_components/layout/onboarding/welcome-guide.tsx) · [app-guide.tsx](../../src/app/(main)/_components/header-menu/app-guide.tsx))
- 👤 웰컴가이드(자산 0개)에서 대시보드 미리보기 영역이 실제 `dashboard.tsx` 컴포넌트를 공통 사용하여 동일 포맷으로 노출되며, 미리보기 카드 내부의 클릭이나 모든 액션들이 완전 차단 및 방지되는지 확인, 앱가이드 단독 보기, 튜토리얼 step 진행/스킵
- 👤 **모바일 웹 PWA 우선 레이아웃**(`useIsMobile() && !isStandalone`): 보안 소개+포트폴리오 미리보기 노출 후 PWA 설치 유도 섹션 강조. "웹앱 설치하기" 버튼이 홈 버튼과 동일한 `PwaInstallFlow` 공용 흐름 호출(iOS는 브라우저 칩+SVG 가이드). 즉시 자산 등록 CTA는 **기본 숨김**, "설치 없이 웹에서 바로 시작" 링크 클릭 시에만 노출(`showAssetCta` 토글)
- 👤 **데스크톱·standalone(설치된 앱)**: 기존 레이아웃 유지(자산 등록 CTA 항상 노출), 모바일 전용 분기 미적용 확인
- ⚙ 웰컴가이드는 `PwaInstallGuideDialog` 직접 호출 제거(공용 `PwaInstallFlow`로 대체). 분기 키: `mobileWeb = mounted && isMobile && !isStandalone`, `ctaVisible = !mobileWeb || showAssetCta`
- ⚙ `app-guide.tsx`는 `useState/useEffect` 사용 → `"use client"` 지시어 필수(서버 컴포넌트 빌드 에러 방지)
- ⚙ `secretasset_tutorial_status` 단일 키, 마이그레이션(merge-tutorial-status)

### F-NOTICE. 공지 시스템
- ⚙ `NEXT_PUBLIC_NOTICE` JSON: `{ enabled, expiresAt }` 만 평가 (`getNoticeWindow()`). id·title·items 없음 — 본문은 branch 코드 `notice.tsx`.
- ⚙ `notice.tsx`: `NOTICE_ID="20260624"`(내용 갱신 시 bump→재노출), `NOTICE_TITLE`, `NoticeContent` export. `pointer-events-none` + `select-none`으로 인터랙션 차단(애니메이션 컨트롤만 `pointer-events-auto`). 본문 순서 **①PWA 설치(`!isStandalone`만, `PwaSetupAnimation`+복원 2종: 동기화=금고암호/일반=PIN 4자리 명확 구분) → ②기기 동기화(`SyncSetupAnimation`+"다른 기기 동기화 링크")**
- ⚙ **수동 공지 진입** — 자동 1회 팝업(`UpdateNoticeDialog`) 외에, 더보기 > **"앱 가이드 · 공지사항"** 통합 진입점([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx)) 선택기 → 공지 뷰어가 **동일 `NoticeContent`·`NOTICE_TITLE` 재사용**(중복 본문 없음). 앱 가이드는 `trigger-restore-guide` 이벤트
- ⚙ PWA standalone: `NEXT_PUBLIC_*` 빌드 타임 인라인, SW 자동 갱신(`controllerchange`→reload, `updateViaCache:'none'`)으로 재방문 시 새 번들 즉시 반영 → 별도 업데이트 불필요.
- 엣지: 잘못된 JSON→미표시, 만료(`expiresAt` 경과)→미표시, `NOTICE_ID` 기준 1회 노출(`secretasset_notice_seen_{id}` localStorage, PWA standalone 분리). 수동 뷰어는 노출 이력·만료와 무관하게 항상 열람 가능

### F-APPLOCK. 앱 잠금 (PIN) ([pwa-lock-screen.tsx](../../src/app/(main)/_components/pwa/pwa-lock-screen.tsx))
- ⚙ 웹·PWA 모두 동작 — `authEnabled && !sessionStorage("pwa_authenticated")` 조건(standalone 체크 제거). SHA-256 PIN 해시 비교, 세션 인증 후 `sessionStorage.setItem("pwa_authenticated","true")`.
- ⚙ `isPwaAuthEnabled()` / `setPwaAuthPin(pin)` / `disablePwaAuth()` / `verifyPwaAuthPin(pin)` 유틸 export.
- 👤 설정 > 앱 잠금 설정 ON → 브라우저 새 탭/재접속 시 PIN 화면 즉시 노출, 4자리 입력 → 잠금 해제 → 대시보드 진입.
- 👤 PIN 오류 1~2회: "비밀번호가 일치하지 않습니다" 문구. 3회+: "비밀번호를 다시 확인해주세요" 경고 노출.
- 👤 설정 > 앱 잠금 설정 OFF → 현재 PIN 입력 후 비활성화, 이후 재접속 시 PIN 화면 미노출.
- 엣지: PWA standalone에서도 동일 동작(세션 분리 → 앱 재실행마다 PIN 요구)

### F-MISC. 닉네임·테마·AI 프롬프트·환율 입력
- 👤 닉네임 저장·공유 반영, 다크모드 토글, 도구 메뉴(`tool-menu`) AI 자산현황 프롬프트, 수동 환율 입력
- 👤 더보기 `지원` 섹션 **"앱 가이드 · 공지사항"** 통합 진입점 — 선택기에서 앱 가이드 보기 / 공지사항 보기 분기(메뉴 행 1개로 통합). 공지 뷰어는 SVG 애니메이션 멈춤/시작 동작 확인
- ⚙ 닉네임 변경(`NICKNAME_EVENT`) 발생 시 React `assetData` 상태가 실시간 업데이트되며, 자산 CRUD/동기화 시 닉네임이 빈 값으로 덮어써지지 않는지 검증
- ⚙ 공유 토큰 파싱(`parseShareToken`/`unpackV7`) 및 데이터 가져오기 시 닉네임이 `validated.nickname` 및 `data.nickname`에 누락 없이 복원되어 보존되는지 검증

### F-FEEDBACK. 의견·요청 보내기 ([tool-menu.tsx](../../src/app/(main)/_components/header-menu/tool-menu.tsx) · [api/feedback](../../src/app/api/feedback/route.ts))
- 👤 더보기 > "의견·요청 보내기" 다이얼로그: 내용 Textarea(초기 min-h-160, max-h-40vh 내부 스크롤) + 연락처(선택), 전송 중 스피너, 성공/실패 토스트. **다이얼로그 스크롤로 하단 "보내기" 버튼 항상 노출**
- ⚙ `/api/feedback` POST: message 공백 검증(400)·2000자 절단, IP `checkRateLimit` 재사용(429), `SLACK_WEBHOOK_URL` 미설정(500)·웹훅 실패(502), 닉네임 자동 첨부. **서버 저장 없음**(웹훅 전달만)

---

## Phase 1B — UI 품질 유지 (코드레벨 상시 점검)

> **라이브 프리뷰/브라우저 접속 없이** 정적 분석으로만 수행. 실사용자 테스트는 대체 불가.

### U1. 접근성 (a11y)
- 아이콘 전용 버튼에 `aria-label`/`title` 존재
- `<img>`에 `alt`(의미 없으면 `alt=""`)
- **클릭 가능 요소는 `<button>`/`<a>`** — `onClick` 단 `<div>`/`<span>`은 키보드·스크린리더 불가
- 폼 입력에 `<Label>` 연결(OTP/체크박스 라벨 포함)

### U2. 터치·반응형
- 터치 타겟 최소 크기 — 아이콘 버튼 `size-7.5`(≈30px) 이상, hover 전용 노출 금지(터치 도달 불가)
- `sm:`/`lg:` 분기 일관, 가로 넘침은 `overflow-x-auto`+`min-w-0` 체인
- **날짜 input 넘침**: `globals.css` 전역 규칙(`input[type="date"]` 등 `appearance:none`+`min-width:0`+`max-width:100%`+webkit 의사요소 리셋)으로 모바일 컨테이너 넘침 원천 차단, 폼별 `max-w-[160px]` 임시방편 미부활(전폭 통일)
- 모바일 분기(`useIsMobile`)의 `undefined`(hydration 전) 처리

### U3. 다크모드·디자인 토큰
- 하드코딩 색(`text-black`/`bg-white`/원시 `#hex` className) 금지 → `text-foreground`/`bg-background` 등 토큰
- 의미색 규칙: 확인·제출 `Button variant="brand"`, 체크박스 기본 `Checkbox`(자동 brand), 매수=빨강·매도=파랑, 삭제=destructive만 예외
- 카드 액션 버튼 `Button size="icon" variant="secondary"` + `ASSET_THEME.cardActionButton`(size-7.5 sm:size-8.5) 통일

### U4. 정보위계·사용성 (휴리스틱)
- 빈/로딩/에러/단일항목 상태 메시지 존재 (목록은 `length > 0`)
- 위계: Hero→필터→리스트 순서, InlineSelector 탭 통일
- 파괴적 액션(삭제) 확인 단계(`confirm`/다이얼로그)
- 숫자 표기 `tabular-nums`, 통화 포맷 일관(`formatCurrency`/`formatShortCurrency`)
- 리스트 카드 위계: 접힘행 왼쪽=핵심 식별(이름·비중), 상세는 펼침에 — 비종목 자산도 동일(`design-system.md §11`)

### U5. 디테일 폴리시 (design-system.md §6)
> UI 신규·수정 시 항상 검토. CSS 전환 + `tw-animate-css`(framer-motion 미사용), `motion-safe`로 reduced-motion 대응.
- **`transition: all` 금지** → `transition-[color,box-shadow,transform]` 등 변하는 속성만 명시(button/toggle/kpi-card/accordion/dialog/navigation-menu/sidebar/switch 적용 완료)
- **누름 피드백** `active:not-disabled:scale-[0.96]`(카드류 0.98~0.99). `Button`은 기본 적용 — link 변형·`static` prop은 제외
- **진입 stagger** `motion-safe:animate-in fade-in slide-in-from-bottom-*`(뷰 컨테이너: dashboard/detail-hub/performance-hub) + 리스트는 `animationDelay`로 분산(FAB 타입 선택 40ms 간격)
- **숫자 `tabular-nums`** — 수량·환율·건수·금액 등 자릿수 흔들리는 표기 전부
- **`text-balance`(제목)·`text-pretty`(본문)** — 헤딩/설명 줄바꿈 균형
- **최소 히트영역 40×40px** — 작은 닫기/dismiss 버튼은 `after:absolute after:-inset-*`로 터치영역 확장, 헤더 아이콘 버튼 `h-10 sm:h-11`
- **`will-change` 절제**, 동심 radius·광학 정렬·shadow 우선·이미지 outline 검토

> 스캔 예시:
> ```bash
> grep -rn "onClick" src --include=*.tsx | grep "<div\|<span"        # 클릭 가능 div/span
> grep -rn "size=\"icon\"" src --include=*.tsx                        # 아이콘 버튼 aria 누락 후보
> grep -rn "text-black\|text-white\|bg-white\|bg-black\|#[0-9a-fA-F]\{6\}" src --include=*.tsx  # 하드코딩 색
> grep -rn "transition-all" src --include=*.tsx                       # transition:all 잔존(폴리시 위반)
> ```

---

## Phase 2 — 회귀 위험 레지스트리 (상시 점검)

변경 시 반드시 확인하는 과거 회귀 다발 지점:

| # | 위험 | 점검 |
|---|------|------|
| R1 | **tickerList 정렬 누락** | `fetchProfitRef`·useQuery·캐시 키의 tickerList는 항상 `.sort()` (3회+ 회귀) |
| R2 | **목록 표시 조건** | 항목 렌더는 `length > 0`만, `> 1`/`<= 1` 금지(단일 항목 누락) |
| R3 | **공유 토큰 버전 호환** | 새 필드 추가가 기존 packV7~v72Z 파싱·역직렬화를 깨지 않는지 |
| R4 | **단일 저장 경로** | 거래+포지션은 `addTransactionWithPosition`/`deleteTransactionWithPosition` 단일 saveData(stale-closure) |
| R5 | **sync abort 정합성** | 데이터 삭제/불러오기 시 epoch·AbortController·blocked 플래그로 취소된 응답이 빈 state 덮어쓰지 않는지 |
| R6 | **디렉토리 rename 잔존** | `top-nav→header`, `main-nav→views`, `bottom-nav→forms` 깨진 import 없는지 |
| R7 | **삭제 롤백 보유분 보존** | 거래 삭제 롤백이 거래로그에 없는 수동 보유분을 유실하지 않는지(현재 포지션 역산) |
| R8 | **캐시 슬롯 전환** | 장중/장외 슬롯 전환 직후 stale 캐시 표시 안 되는지 |
| R9 | **휴장 폴백 캐시 매핑** | ref-date 매핑은 응답일==요청일 또는 요청일이 비영업일일 때만 저장 — 영업일+장중 미확정에 저장돼 stale 영구 hit 안 되는지 |
| R10 | **날짜 input 모바일 넘침** | `globals.css` 전역 규칙 유지, 신규 날짜 input이 별도 `max-w` 없이 `w-full`로 컨테이너 내 수렴하는지 |
| R11 | **PWA 설치 흐름 공용화** | 홈 버튼·웰컴가이드가 `PwaInstallFlow` 단일 소스 공유 — 한쪽 트리거/문구만 고쳐 다른 진입점이 어긋나지 않는지. `PwaInstallButton` 공개 API 시그니처 보존. 설치 가이드는 `InstallGuideContent({ env })` 단일 소스(iosStep·guideStep 공유) |
| R12 | **transition:all 잔존** | UI 컴포넌트에 `transition-all` 재유입 금지 — 변하는 속성만 명시(레이아웃 thrash·원치 않는 transition 방지) |
| R13 | **pull 후 sync-state 재기록** | pull의 `applyImportedPayload`(clearAssetData)가 `secretasset_sync` 삭제 → `runPushAfterRestoreFix`로 assetId·rememberedKey 재기록(F-CLOUD-SYNC S9). 누락 시 assetId 유실 |
| R14 | **자동 push 무한루프/동시성 가드** | pull 직후 `skipNextChangeRef` 스킵 + `getComparablePayloadString()`(lastUpdated 제외 비교) + `busyRef` 뮤텍스로 push↔pull 동시 실행 차단(S10). R5(sync abort)와 연계 |
| R15 | **동기화 해시·코드 호환** | `#sync=` 신규, `#asset=`/`#vault=` 구 진입 호환 유지(provider detect·clearPendingConnect). `sync:`(동기화 코드) ↔ `share:`(복원 코드) 구분 보존 |
| R16 | **SVG 애니메이션 공용 플레이어** | 모든 단계형 애니메이션은 `StepAnimationPlayer` 단일 경로(`InstallGuideAnimation`·`SyncSetupAnimation`·`PwaSetupAnimation` 위임). 멈춤/시작·단계 점 컨트롤은 `pointer-events-auto`(공지 등 `pointer-events-none` 내부 동작 보장). SVG fill에 색 토큰 className 직접 사용 금지 → `fill="currentColor" className={토큰}` (className을 `fill={HINT}`로 넣으면 다크모드 미표시) |
| R17 | **닉네임 상태 동기화 누락** | 닉네임 변경(`NICKNAME_EVENT`) 시 `AssetDataProvider`의 `assetData` 상태 동기화 누락으로 CRUD/동기화 시 닉네임 초기화 방지 |

---

## Phase 3 — 산출물

- 발견 이슈를 **P0(데이터 손실/크래시) / P1(기능 오작동) / P2(UX·표시)** 로 분류
- 회귀면 R# 매핑, 신규면 근본 원인·재현 경로(파일:라인) 기록
- 수동 항목(👤) 중 프리뷰로 검증 불가한 것(KIS 실시간 가격, OCR 정확도, 모바일 레이아웃)은 사용자 실행 체크리스트로 전달
- **이 스킬은 진단·보고까지만 수행한다. 코드 수정은 사용자 승인 후 별도로.**

---

## 디자인·코드 규칙 (점검 시 함께 적용)

- 확인·제출 버튼 `Button variant="brand"`, 체크박스 기본 `Checkbox`(자동 brand). 매수=빨강/매도=파랑, 삭제=destructive 의미색만 예외
- 카드 액션 버튼: `Button size="icon" variant="secondary"` + `ASSET_THEME.cardActionButton`(size-7.5 sm:size-8.5) 통일
- 목록 표시는 항상 `length > 0`, 비교 키 tickerList는 `.sort()`
- UI/화면 작업 시 `design-system.md`(단일 출처: 토큰·간격·컴포넌트·모션·정보 설계 휴리스틱) 준수

---

_최종 갱신: 2026-06-25 · SVG 애니메이션 공용화(`StepAnimationPlayer`·멈춤/시작·3500ms·`PwaSetupAnimation`/`SyncSetupAnimation`·새 기기 tone)·"복원 코드"/"다른 기기 동기화 링크" 개명·공지 수동 진입("앱 가이드·공지사항" 통합)·notice PWA 우선·복원 2종(금고암호/PIN) 구분 반영, R16 추가. 이전: 2026-06-24 F-CLOUD-SYNC·F-PWA 정밀 QA(S1~S10·P1~P5·R13~R15)_
