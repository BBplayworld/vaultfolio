# 아키텍처 개요

> 마지막 업데이트: 2026-05-16

## 앱 개요

**secretasset** — 오프라인 우선 개인 자산 관리 앱
- 모든 사용자 데이터: 브라우저 `localStorage` 저장, 인증/백엔드 DB 없음
- 서버: 금융 API 프록시 역할만 (한국투자증권 OpenAPI, Gemini AI)
- Next.js App Router 기반 단일 페이지 앱

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| 프레임워크 | Next.js 15 (App Router) + TypeScript |
| 폼 검증 | Zod + React Hook Form |
| 상태 관리 | React Context (자산) + Zustand (테마/튜토리얼) |
| 스타일링 | Tailwind CSS v4 + shadcn/ui (New York) |
| 데이터 페칭 | Fetch API + AbortController (점진 로드) |
| 차트/DnD | Recharts + dnd-kit |
| 압축/암호화 | lz-string + XOR (PIN 기반) |
| 저장소 | localStorage (유저) + 파일/Upstash Redis (서버 캐시) |
| 외부 API | 한국투자증권 OpenAPI, Google Gemini AI |

## 디렉토리 구조

```
src/
├── app/
│   ├── (main)/asset/
│   │   ├── page.tsx              # AssetPageTabs 래퍼 + isWelcomeGuide 분기 (AppGuide + WelcomeGuide)
│   │   ├── layout.tsx            # SidebarInset (max-w-screen-2xl)
│   │   └── _components/
│   │       ├── bottom-nav/
│   │       │   └── asset-update/
│   │       │       ├── input/    # 자산 입력 폼 5종 + exchange-rate-input
│   │       │       └── screenshot/ # 스크린샷 다이얼로그 4종
│   │       ├── main-nav/
│   │       │   ├── home/         # dashboard.tsx
│   │       │   ├── detail/       # asset-detail-tabs.tsx + tabs/ 5종
│   │       │   ├── activity/     # net-asset-chart, profit-chart, dividend-chart, monthly-dividend-stocks
│   │       │   └── data-source-badge.tsx
│   │       ├── layout/           # asset-page-tabs.tsx, floating-add-button, welcome-guide, notice-dialog
│   │       ├── top-nav/          # top-bar, theme-menu, tool-menu, app-guide, share/
│   │       └── tutorial/         # tutorial-overlay.tsx (Step 0~5)
│   ├── api/
│   │   ├── finance/
│   │   │   ├── route.ts          # 주식·환율 조회 (장중 1시간 슬롯 캐시)
│   │   │   └── profit/route.ts   # 기준가 조회 (2단 캐시: refDateMap + refPrice)
│   │   ├── logo/route.ts         # 종목 로고 프록시
│   │   ├── share/route.ts        # 공유 Short URL
│   │   └── parse-screenshot/
│   │       ├── route.ts          # POST (Gemini AI)
│   │       └── ticker-map.ts     # 종목명→티커 fallback (~700개)
│   └── layout.tsx                # 루트 레이아웃
├── types/asset.ts                # 자산 5종 Zod 스키마 (inactiveStatus 포함)
├── contexts/asset-data-context.tsx  # 전역 자산 상태 + 환율 + 동기화 + halted/delisted 분기
├── stores/
│   ├── preferences/              # Zustand 테마 스토어
│   └── tutorial/                 # Zustand 튜토리얼 스토어 (Step 0~5 + isStandaloneStep0)
├── lib/
│   ├── asset-storage.ts          # localStorage + 공유 토큰 v7.2 (inactiveStatus 직렬화)
│   ├── local-storage.ts          # STORAGE_KEYS, migrateStorageKeys, readTutorialStatus
│   ├── one-time-migrations.ts    # secretasset_migrations_done 기반 1회성 마이그레이션
│   ├── profit-utils.ts           # 기준가 캐시 + 점진 로드(onProgress) + dedup
│   ├── finance-service.ts        # KIS API 연동 + classifyOverseasInactive
│   ├── stock-cache-slot.ts       # 시장별 캐시 슬롯 유틸 (서버/클라 공용)
│   ├── cache-storage.ts          # 캐시 추상화 (File/Upstash)
│   ├── number-utils.ts           # 숫자·통화 포맷
│   └── utils.ts                  # cn(), getInitials()
├── config/
│   ├── app.ts / asset-options.ts / theme.ts / navigation.ts
└── components/ui/                # shadcn/ui 컴포넌트
```

## 데이터 흐름

```
localStorage → asset-storage.ts → AssetDataContext → 컴포넌트
서버 API(/api/finance, /api/share) → cache-storage.ts → 한국투자증권 OpenAPI
기준가 조회: profit-utils.ts(클라 localStorage) → /api/finance/profit
                                                 ↓
                                       REF_DATE_MAP + REF_PRICES 2단 캐시
```

## 캐시 전략

| 환경 | 방식 |
|------|------|
| 로컬 (UPSTASH_* 없음) | 파일 (`data/finance-cache.json`, `data/share-tokens.json`) |
| Vercel (`KV_REST_API_URL` 있음) | Upstash Redis (Sliding TTL 30일) |

**캐시 슬롯 시간 단위:** [stock-cache-slot.ts](../../src/lib/stock-cache-slot.ts)
- 장중 1시간 슬롯 (domestic 09–20, foreign 17/18–익일 05/06 KST)
- 장외에는 effectiveDate만 (cutoff: foreign 07:00, domestic 16:00, exchange 09:00 KST)

## 레이아웃

- 최대 너비: `max-w-screen-2xl` — `layout.tsx`
- 사이드바: variant=`inset`, collapsible=`icon`
- 헤더: `sticky top-0 h-10 sm:h-12` (layout.tsx)

## 탭 구조 (`layout/asset-page-tabs.tsx`)

- **홈** (`home`): Dashboard + 서브탭(전체/금융/부동산/부채) — `useDashboardTabs`가 동적 생성
- **상세** (`detail`): 주식/부동산/암호화폐/현금/대출 5 서브탭
- **성과** (`activity`): 순자산/수익/배당 3 서브탭
- `navigate-to-tab` CustomEvent → 상세 탭 자동 이동

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
```

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
