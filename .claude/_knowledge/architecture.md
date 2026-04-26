# 아키텍처 개요

> 마지막 업데이트: 2026-04-25

## 앱 개요

**Vaultfolio (secret-asset)** — 오프라인 우선 개인 자산 관리 앱
- 모든 사용자 데이터: 브라우저 `localStorage` 저장, 인증/백엔드 DB 없음
- 서버: 금융 API 프록시 역할만 (한국투자증권 OpenAPI, Gemini AI)
- Next.js App Router 기반 단일 페이지 앱

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| 프레임워크 | Next.js 15 (App Router) + TypeScript |
| 폼 검증 | Zod + React Hook Form |
| 상태 관리 | React Context (자산) + Zustand (테마) |
| 스타일링 | Tailwind CSS v4 + shadcn/ui (New York) |
| 데이터 페칭 | TanStack Query + Fetch API |
| 차트/DnD | Recharts + dnd-kit |
| 압축/암호화 | lz-string + XOR (PIN 기반) |
| 저장소 | localStorage (유저) + 파일/Upstash Redis (서버 캐시) |
| 외부 API | 한국투자증권 OpenAPI, Google Gemini AI |

## 디렉토리 구조

```
src/
├── app/
│   ├── (main)/asset/
│   │   ├── page.tsx              # 대시보드
│   │   ├── layout.tsx            # SidebarInset (max-w-screen-3xl=1680px)
│   │   └── _components/
│   │       ├── input/            # 자산 입력 폼 5종
│   │       ├── screenshot/       # 스크린샷 다이얼로그 4종
│   │       ├── detail/           # 자산 상세 탭 (asset-detail-tabs.tsx + tabs/ 5종)
│   │       ├── chart/            # 차트 (net-asset, profit, dividend 등 5종)
│   │       ├── management/       # floating-add-button.tsx
│   │       ├── sidebar/          # AppSidebar, NavMain 등
│   │       ├── asset-overview-cards.tsx
│   │       └── asset-distribution-cards.tsx
│   ├── api/
│   │   ├── finance/route.ts      # 주식·환율 (캐시 포함)
│   │   ├── share/route.ts        # 공유 Short URL
│   │   └── parse-screenshot/
│   │       ├── route.ts          # POST (Gemini AI)
│   │       └── ticker-map.ts     # 종목명→티커 fallback (~700개)
│   └── layout.tsx                # 루트 레이아웃
├── types/asset.ts                # 자산 5종 Zod 스키마 + 타입
├── contexts/asset-data-context.tsx  # 전역 자산 상태 CRUD + 환율 + 동기화
├── stores/preferences/           # Zustand 테마 스토어
├── lib/
│   ├── asset-storage.ts          # localStorage + 공유 토큰 (v7.1)
│   ├── finance-service.ts        # 한국투자증권 API 연동
│   ├── cache-storage.ts          # 환경별 캐시 추상화
│   ├── number-utils.ts           # 숫자·통화 포맷
│   └── utils.ts                  # cn(), getInitials(), formatCurrency()
├── config/
│   ├── app.ts / asset-options.ts / theme.ts / navigation.ts
└── components/ui/                # shadcn/ui 컴포넌트 54종
```

## 데이터 흐름

```
localStorage → asset-storage.ts → AssetDataContext → 컴포넌트
서버 API(/api/finance, /api/share) → cache-storage.ts → 한국투자증권 OpenAPI
```

## 캐시 전략

| 환경 | 방식 |
|------|------|
| 로컬 (UPSTASH_* 없음) | 파일 (`data/finance-cache.json`, `data/share-tokens.json`) |
| Vercel (`KV_REST_API_URL` 있음) | Upstash Redis (Sliding TTL 30일) |

## 레이아웃 (현재값)

- 최대 너비: `max-w-screen-3xl` (1680px) — `layout.tsx:33`
- 사이드바: variant=`inset`, collapsible=`icon`

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
