# 아키텍처 개요

> 마지막 업데이트: 2026-06-22

## 앱 개요

**secretasset** — 오프라인 우선 개인 자산 관리 앱
- 모든 사용자 데이터: 브라우저 `localStorage` 저장, 인증/백엔드 DB 없음
- 서버: 금융 API 프록시 역할만 (한국투자증권 OpenAPI, Gemini AI)
- Next.js App Router 기반 단일 페이지 앱

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| 프레임워크 | Next.js 16 (App Router) + TypeScript |
| 폼 검증 | Zod + React Hook Form |
| 상태 관리 | React Context (자산) + Zustand (테마/튜토리얼) |
| 스타일링 | Tailwind CSS v4 + shadcn/ui (New York) |
| 데이터 페칭 | Fetch API + AbortController (점진 로드) |
| 차트/DnD | Recharts + dnd-kit |
| 압축/암호화 | lz-string + XOR (PIN 기반) |
| 저장소 | localStorage (유저) + 파일/Upstash Redis (서버 캐시) |
| 외부 API | 한국투자증권 OpenAPI, Google Gemini AI |

## 디렉토리 구조

> **구조 변경(2026-06): `(main)/asset/` 레이어 제거** — 기존 `(main)/asset/_components/*`·`(main)/asset/page.tsx`가 `(main)/_components/*`·`(main)/page.tsx`로 평탄화됨. `header/` → `header-menu/`로 rename. 옛 `asset/_components/header/...` 경로 참조는 모두 무효.

```
src/
├── app/
│   ├── (main)/
│   │   ├── page.tsx                  # AssetPageTabs 래퍼 + isWelcomeGuide 분기 (AppGuide + WelcomeGuide)
│   │   ├── layout.tsx                # SidebarInset + NavigationProvider + FAB pb-20/24
│   │   ├── [...not-found]/
│   │   └── _components/
│   │       ├── forms/                # (구 bottom-nav) 자산 입력 폼 + 스크린샷/거래 다이얼로그
│   │       │   ├── asset-update/
│   │       │   │   ├── input/        # stock/crypto/cash/loan/real-estate/exchange-rate-input
│   │       │   │   └── screenshot/   # stock/crypto/cash/loan-screenshot-import
│   │       │   └── trade/            # trade-input, trade-screenshot-import, guards/delete-rollback-dialog
│   │       ├── views/                # (구 main-nav) 페이지 본문 콘텐츠
│   │       │   ├── home/dashboard.tsx
│   │       │   ├── detail/           # asset-detail-tabs, detail-hub, detail-summary-header
│   │       │   │   ├── tabs/         # stock/real-estate/crypto/cash/loan-tab 5종
│   │       │   │   ├── trades/       # stock-trades-view
│   │       │   │   └── xray/         # stock-xray-view, stock-insight-strip
│   │       │   └── activity/         # net-asset/profit/dividend chart + performance-hub
│   │       ├── layout/               # 라우팅·공용 UI
│   │       │   ├── navigation/       # navigation-context, asset-page-tabs, asset-dispatch
│   │       │   ├── floating/         # floating-add-button, scroll-to-top
│   │       │   ├── onboarding/       # welcome-guide, notice, notice-dialog
│   │       │   └── ui/               # inline-selector, kpi-card, info-hint, prompt-preview-dialog
│   │       ├── header-menu/          # (구 top-nav/header) top-bar, tool-menu, settings-page, app-guide
│   │       │   └── share/            # share-card, share-menu
│   │       ├── functions/
│   │       │   └── cloud-sync/       # cloud-sync-menu-entry, cloud-sync-connect-dialog, sync-qr
│   │       ├── pwa/                  # 설치 흐름 공용 + 가이드 SVG
│   │       │   ├── pwa-install-flow.tsx     # 설치 다이얼로그+로직 공용 소스 (홈 버튼·웰컴가이드 공유, render-prop 트리거)
│   │       │   ├── pwa-install-button.tsx   # 다운로드 아이콘 버튼 (PwaInstallFlow 얇은 래퍼)
│   │       │   ├── pwa-install-guide-content.tsx  # (구 -dialog) 환경별 설치 가이드 본문 컴포넌트 (flow 내 임베드)
│   │       │   ├── pwa-guide-illustrations.tsx  # 설치/동기화 step SVG + 공용 StepAnimationPlayer(멈춤·시작·단계점, InstallGuide/SyncSetup/PwaSetup 위임)
│   │       │   ├── pwa-install-banner.tsx, pwa-connect-prompt.tsx, pwa-lock-screen.tsx, bottom-nav.tsx
│   │       └── tutorial/             # tutorial-overlay.tsx (Step 1~5)
│   ├── api/
│   │   ├── finance/
│   │   │   ├── route.ts              # 주식·환율 조회 (장중 1시간 슬롯 캐시)
│   │   │   ├── profit/route.ts       # 기준가 조회 (2단 캐시: refDateMap + refPrice)
│   │   │   ├── dividend/route.ts     # 배당 조회
│   │   │   └── crypto/route.ts       # 코인 시세(업비트)
│   │   ├── sync/route.ts             # E2EE 클라우드 동기화 (PUT/GET AssetEnvelope)
│   │   ├── xray-classify/route.ts    # X-Ray AI 분류 (스트리밍)
│   │   ├── logo/route.ts             # 종목 로고 프록시
│   │   ├── share/route.ts            # 공유 Short URL
│   │   ├── feedback/route.ts         # 의견·요청 Slack 전달
│   │   └── parse-screenshot/
│   │       ├── route.ts              # POST (Gemini AI)
│   │       └── ticker-map.ts         # 종목명→티커 fallback (~700개)
│   ├── manifest.ts                   # PWA manifest (/manifest.webmanifest, share_target 포함)
│   └── layout.tsx                    # 루트 레이아웃 (appleWebApp·apple-touch-icon 메타데이터 포함)
├── hooks/
│   ├── use-pwa-install.ts            # PWA 설치 훅 (isInstallable/isIOS/isInApp/isStandalone)
│   └── use-share-artifacts.ts        # 공유 토큰 생성(#share= URL·복원 코드) 공용 훅 — 설치 흐름·인앱 게이트 재사용
├── types/asset.ts                    # 자산 5종 Zod 스키마 (inactiveStatus 포함)
├── contexts/asset-data-context.tsx   # 전역 자산 상태 + 환율 + 동기화 + halted/delisted 분기
├── stores/
│   ├── preferences/                  # Zustand 테마 스토어
│   └── tutorial/                     # Zustand 튜토리얼 스토어 (Step 0~5 + isStandaloneStep0)
├── lib/                               # 도메인별 하위 디렉토리로 분류 (신규 파일도 반드시 해당 도메인 폴더 하위에 추가 — dev-rules.md 참조)
│   ├── asset/                        # 자산 저장·백업·스냅샷
│   │   ├── asset-storage.ts          # localStorage + 공유 토큰 v7.2
│   │   ├── snapshot-storage.ts / snapshot-archive.ts
│   │   ├── backup-status.ts / storage-stats.ts / asset-refresh-status.ts / holdings-conflict.ts
│   ├── finance/                      # 시세·환율·마스터 데이터
│   │   ├── finance-service.ts        # KIS API 연동 + classifyOverseasInactive
│   │   ├── stock-cache-slot.ts / coin-cache-slot.ts  # 시장별 캐시 슬롯 유틸
│   │   ├── profit-utils.ts / profit-cache-cleanup.ts
│   │   ├── upbit-service.ts / kis-token.ts / kr-master.ts / us-master.ts / kr-holidays.ts / us-holidays.ts
│   ├── trade/                        # 거래·현금·대출 유틸
│   │   ├── trade-utils.ts / cash-tx-utils.ts / loan-tx-utils.ts / validate-reflection.ts
│   ├── realestate/                   # 부동산 실거래
│   │   ├── realestate-service.ts / real-estate-address.ts
│   ├── cloud-sync/                   # E2EE 클라우드 동기화
│   │   ├── config.ts                 # AssetEnvelope, SYNC_HASH_PARAM("asset"), SIG_FRESHNESS_SEC
│   │   ├── crypto.ts                 # AssetKeys, PBKDF2→encKey+Ed25519, generateAssetId
│   │   ├── sync-state.ts             # secretasset_sync (assetId/version/rememberedKey)
│   │   ├── sync-client.ts            # pushAsset/pullAsset/fetchRemoteVersion, Ed25519 인증
│   │   ├── device-key.ts             # IndexedDB 기기키 wrap/unwrap (rememberedKey 보관)
│   │   └── cloud-sync-provider.tsx   # SYNC_HASH_PARAM 해시 감지·자동 연결
│   ├── pwa/                          # PWA 잠금·게이트·플랫폼 판별
│   │   ├── app-lock.ts / background-gate.ts
│   │   ├── detect-browser.ts         # 브라우저/플랫폼 판별 + isInApp + isStandaloneDisplay/isInAppGateActive(인앱 게이트 활성 판정)
│   │   └── open-external-browser.ts  # 인앱→외부 브라우저 이동(Android=kakaotalk/intent 스킴, iOS=false 폴백)
│   ├── report/                       # 자산 등급·리포트·기록 스트릭
│   ├── xray/                         # 종목 X-ray 분류·프롬프트
│   ├── data/                         # 정적 마스터 JSON (kr/us 종목·ETF)
│   ├── analytics/ga.ts               # GA4 래퍼(track·trackScreen·setUserProps·sanitizer·한국어 라벨, S-4.28)
│   ├── cache-storage.ts              # 캐시 추상화 (File/Upstash, AssetEnvelope 포함) — 도메인 무관 공용
│   ├── local-storage.ts              # STORAGE_KEYS, migrateStorageKeys — 도메인 무관 공용
│   ├── one-time-migrations.ts        # 1회성 마이그레이션 — 도메인 무관 공용
│   ├── number-utils.ts
│   └── utils.ts
├── server/                           # 서버 전용(`server-only`) — "use server" Server Action 파일 없음(공개 액션 0개)
│   ├── api-guard.ts                  # 공개 API 공통 방어 계층(출처·크기·L1/L2 한도·업스트림 예산·Gemini 예약·입력 검증·CDN 헤더)
│   └── preferences.ts                # getPreference(쿠키 allowlist 조회, layout 전용)
├── config/
│   ├── app.ts / asset-options.ts / theme.ts / navigation.ts
└── components/ui/                    # shadcn/ui 컴포넌트
```

## 데이터 흐름

```
localStorage → asset-storage.ts → AssetDataContext → 컴포넌트
서버 API(/api/finance, /api/share) → cache-storage.ts → 한국투자증권 OpenAPI
기준가 조회: profit-utils.ts(클라 localStorage) → /api/finance/profit
                                                 ↓
                                       REF_DATE_MAP + REF_PRICES 2단 캐시

E2EE 클라우드 동기화:
  금고암호 → crypto.ts(PBKDF2) → AssetKeys(encKey+Ed25519)
  pushAsset: AES-GCM 암호화 → PUT /api/sync (x-sync-auth Ed25519 서명)
  pullAsset: GET /api/sync → 복호화 → applyImportedPayload
  로컬 상태: secretasset_sync (assetId/version/rememberedKey) ← sync-state.ts
  서버 저장: csync:asset:{assetId} (Redis, AssetEnvelope — pubKey+iv+ciphertext+version)
  연결 링크: #asset=<assetId>&theme=... ← SYNC_HASH_PARAM="asset"
```

## 캐시 전략

| 환경 | 방식 |
|------|------|
| 로컬 (UPSTASH_* 없음) | 파일 (`data/finance-cache.json`, `data/share-tokens.json`) |
| Vercel (`KV_REST_API_URL` 있음) | Upstash Redis (Sliding TTL 30일) |
| Vercel production·preview인데 KV 미설정 | **즉시 throw(fail-closed)** — 조용히 파일 모드로 떨어져 rate limit이 꺼지는 것 방지 |

**공개 API 엣지 캐시**: 시세·배당·로고·검색·부동산 추정 응답에 `cdnCacheHeaders()`(`Vercel-CDN-Cache-Control`만 설정, 브라우저 `Cache-Control` 미변경) — 같은 URL 반복 트래픽을 CDN이 흡수(함수·Redis·KIS 호출 0).

**캐시 슬롯 시간 단위:** [stock-cache-slot.ts](../../src/lib/finance/stock-cache-slot.ts)
- 장중 1시간 슬롯 (domestic 09–20, foreign 17/18–익일 05/06 KST)
- 장외에는 effectiveDate만 (cutoff: foreign 07:00, domestic 16:00, exchange 09:00 KST)

## 공개 API 보안 (S-4.28 보안 범위, `src/server/api-guard.ts`)

- **최소 공개 표면**: 클라이언트 호출처가 있는 라우트만 유지(`finance`·`finance/crypto`·`finance/profit`·`finance/dividend`·`ticker-search`·`logo`·`realestate`·`parse-screenshot`·`xray-classify`·`share`·`feedback`·`sync`). `finance/debug-overseas`·`server-actions.ts`(공개 Server Action)·`realestate op=raw` 삭제, `/_next/image` 비활성(`images.unoptimized`).
- **싼 순서 조기 거부**: `guardRequest`(cross-site 403 → Content-Length 411/413 → L1 메모리 버킷 429) → 캐시 히트면 즉시 반환 → **캐시 미스만** `guardRateLimit`(L2 Redis `rl:{route}:{ip}`, Lua 원자) → `withinUpstreamBudget`(kis 900·molit 120·kakao 120·logo 300/분, 초과 시 stale 또는 `X-KIS-Unavailable`) → Gemini는 `reserveGeminiCalls`(IP 일 30회·과사용 IP는 전역 한도 70%까지).
- 라우트마다 `export const maxDuration`. 에러 응답은 고정 문구만(SDK 원문·rawText 미노출).
- **브라우저 헤더**(`next.config.mjs` `SECURITY_HEADERS`): CSP는 **Report-Only**(위반 확인 후 enforce 전환 예정), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, `poweredByHeader:false`. `robots.ts`는 `/api/` disallow.
- 테마 쿠키는 클라이언트 `persistThemeModeCookie`(`theme-utils.ts`)로 기록, 서버는 `getPreference` allowlist로 재검증.
- 동기화(`/api/sync`·`cloud-sync/*`) 처리 로직은 이번 범위에서 **무변경** — 인접 보안 항목(S6)은 별도 승인 대상.

## 레이아웃

- 최대 너비: `max-w-screen-2xl` — `layout.tsx`
- 사이드바: variant=`inset`, collapsible=`icon`
- 헤더: `sticky top-0 h-10 sm:h-12` (layout.tsx)

## 페이지 네비게이션 — drill-down hash routing

**모델**: `AssetView = { type: "home" } | { type: "detail", tab } | { type: "activity", tab }`
**hash 매핑**: `#detail/stocks`, `#activity/profit` 등 — `/asset#detail/...` URL 직접 진입·새로고침·뒤로가기 모두 동작

- **홈** (`#home` 또는 hash 없음): InlineSelector(홈/상세/성과 1차 탭) + Dashboard. 상세/성과 탭 클릭 = drill-down 진입 트리거
- **상세 진입**: TopBar 좌측에 ← + "상세" 타이틀. 본문에 InlineSelector(주식/부동산/암호화폐/현금/대출) + 해당 탭 컴포넌트
- **성과 진입**: 동일 패턴. ← "성과" + InlineSelector(순자산/수익/배당)
- **뒤로가기**: 항상 `navigate({type:"home"})`로 홈 복귀 (history.back() 아님)
- **scroll-to-top**: navigate·popstate 시 자동 스크롤 0
- `navigate-to-tab` CustomEvent → `navigate({type:"detail", tab})` 호출 (FAB 수정 진입)

**InlineSelector size 위계** (`layout/inline-selector.tsx`):
- `lg`(1차 탭): `text-sm sm:text-base lg:text-lg`
- `md`(2·3차, 기본): `text-[13px] sm:text-sm lg:text-base`
- `sm`(4차 보조): `text-[12px] sm:text-[13px] lg:text-sm`
- 컨테이너: `bg-muted/60 dark:bg-muted/40` (라이트 짙음, 다크 옅음). 활성: `bg-background`

**카드 외피 통일**: 상세 5탭(stock/real-estate/crypto/cash/loan) 모두 `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>` 패턴. 카테고리 selector는 CardContent 안 SummaryHeader 바로 아래(Hero → 필터 → 리스트 시선 흐름).

## 비활성 종목 정책

KIS 응답 기반 자동 감지 → `Stock.inactiveStatus` 저장 (delisted/halted).
- delisted: 자산 평가·매입원가·환차익·count·배당 모두 **제외**
- halted: 마지막 currentPrice 유지하고 모든 계산에 **포함**, 배지로 표기
- 분기 일관성: [types-and-schemas.md](./types-and-schemas.md#비활성-종목-정책-inactivestatus) 참조

## 튜토리얼

`secretasset_tutorial_status` 단일 키 (Record<step, status>). Step 0~5, Step 5 sub: activity/profit.
- 단독 보기 모드: `tutorialStore.showStep0(true)` → 확인 버튼, 다음 단계 미진행 (메뉴-앱가이드 보기에서 호출)

## 환경변수

```bash
KIS_APP_KEY / KIS_APP_SECRET          # 한국투자증권 OpenAPI
KV_REST_API_URL / KV_REST_API_TOKEN   # Upstash Redis (Vercel)
GEMINI_API_KEY                         # Google Gemini AI
SLACK_WEBHOOK_URL                      # 의견·요청 보내기 → Slack (/api/feedback)
SLACK_ADMIN_WEBHOOK_URL                # 관리자 알림 (src/lib/slack.ts)
NEXT_PUBLIC_CLOUD_SYNC                 # "off" 설정 시 클라우드 동기화 비활성화 (운영 비상 차단용)
```

## 애널리틱스 (GA)

`src/app/layout.tsx`(`RootLayout`, 서버 컴포넌트) — gtag.js 수동 삽입(전용 라이브러리 없음), 측정
ID는 **`APP_CONFIG.gaId`(`src/config/app.ts`) 단일 출처**(S-4.28).

- **이벤트 계측은 `src/lib/analytics/ga.ts` 래퍼로만**(`window.gtag` 직접 호출 금지) — 명세 [S-4.28](../specs/4.28-ga-event-tracking.md), 사양 F-ANALYTICS.
  - config는 `send_page_view:false` + `page_location=origin+pathname`(해시 `#share=`/`#sync=`·쿼리 미전송). 화면은 `navigation-context`가 `trackScreen(viewKey, navSource)`로 가상 경로 `/v/<viewKey>` page_view 전송.
  - gtag 큐(`dataLayer`/`gtag`) 정의는 head 인라인 스크립트에서 **try 블록 밖·앞**(localStorage 예외에도 큐 보장).
  - `?ga-debug=1|0` → localStorage 플래그 → 전 이벤트 `debug_mode:true`(DebugView).
  - 전송 값은 **한국어 라벨**(`PARAM_LABELS`·`USER_PROP_LABELS`로 전송 직전 치환). 코드 쪽 enum은 영문.

- **`gaEnabled = process.env.VERCEL_ENV === "production"`**(2026-09) — GA 스크립트 블록(옵트아웃
  인라인 스크립트 + gtag.js 로더 + config 스크립트) 전체를 이 조건으로 감싼다. Vercel이 자동 주입하는
  `VERCEL_ENV`는 프로젝트의 Production Branch(기본 `main`) 배포일 때만 `"production"`이라, **Preview
  배포·로컬 `next dev`/`next build`에서는 GA 스크립트 자체가 서버에서 렌더되지 않는다**(네트워크
  요청 자체가 없음 — main 외 브랜치는 자동 제외).
- 블록 내부의 호스트명 기반 `isLocal` 체크·`?ga-optout=1` 쿼리 기반 개인 옵트아웃(`localStorage`)은
  그대로 유지 — production 안에서 로컬 접속(예: 회사 네트워크 프록시 도메인)이나 QA 계정을 여전히
  걸러내는 이중 방어. `settings-page.tsx`의 "화면" 라벨 7연속 탭 → 옵트아웃 토글도 무변경.

## 스크린샷 가져오기

Gemini `gemini-2.5-flash-lite`로 증권·거래소·은행 앱 스크린샷 분석. **주식·암호화폐·현금성자산·대출** 4종.

**주식 3단계 플로우:**
1. `upload` — 이미지 → POST /api/parse-screenshot?assetType=stock
2. `conflict` — (ticker, category) 복합 키 중복 탐지 → 덮어쓰기/초기화 선택
3. `preview` — 종목 확인·카테고리 수정 후 등록

**주요 동작:**
- ticker 미인식 시 `ticker-map.ts` `lookupTicker()` fallback (정확→prefix→suffix 3단계)
- 해외주식: `originalCurrency` 필드로 KRW/USD 분기 → KRW면 `/ usdRate` 환산
- 수량 미표시 → `quantity=1`, `currentPrice=currentValue` 보정
- 한도: 서버 300회/일 + 기기별 15회/일 (`useGeminiUsage` hook)
- 다이얼로그: ESC·바깥 클릭으로 닫히지 않음
