# 아키텍처 개요

> 마지막 업데이트: 2026-04-16

## 앱 개요

**Vaultfolio (secret-asset)** — 오프라인 우선 개인 자산 관리 앱
- 모든 사용자 데이터는 브라우저 `localStorage`에 저장
- 인증/백엔드 DB 없음, 서버는 금융 API 프록시 역할만 수행
- Next.js App Router 기반 단일 페이지 앱

## 기술 스택

| 카테고리 | 기술 |
|----------|------|
| 프레임워크 | Next.js 15 (App Router) + TypeScript |
| 폼 검증 | Zod (런타임) + React Hook Form |
| 상태 관리 | React Context (자산 데이터) + Zustand (테마) |
| 스타일링 | Tailwind CSS v4 + shadcn/ui (New York 스타일) |
| 데이터 페칭 | TanStack Query + Fetch API |
| 차트 | Recharts |
| 드래그앤드롭 | dnd-kit |
| 압축/암호화 | lz-string + XOR (PIN 기반) |
| 저장소 | localStorage (유저 데이터) + 파일/Upstash Redis (서버 캐시) |
| 외부 API | 한국투자증권 OpenAPI (주식·환율) |

## 디렉토리 구조

```
src/
├── app/
│   ├── (main)/asset/         # 메인 자산관리 페이지 그룹
│   │   ├── page.tsx          # 대시보드 메인 페이지
│   │   ├── layout.tsx        # SidebarInset 레이아웃 (max-w-screen-3xl=1680px)
│   │   └── _components/      # 자산 관련 모든 컴포넌트
│   │       ├── sidebar/                    # 사이드바 (app-sidebar, nav-main, theme-switcher 등)
│   │       ├── *-input.tsx                 # 자산 유형별 입력 폼 (5종)
│   │       ├── stock-screenshot-import.tsx # 스크린샷으로 주식 일괄 가져오기
│   │       ├── asset-overview-cards.tsx
│   │       ├── asset-distribution-cards.tsx
│   │       ├── yearly-net-asset-chart.tsx
│   │       └── asset-management-card.tsx
│   ├── api/
│   │   ├── finance/route.ts       # 주식·환율 조회 (캐시 포함)
│   │   ├── share/route.ts         # 공유 Short URL 생성·조회
│   │   └── parse-screenshot/      # 스크린샷 파싱 (Gemini AI)
│   │       ├── route.ts           # POST 엔드포인트
│   │       └── ticker-map.ts      # 종목명→티커 fallback 매핑 테이블
│   ├── layout.tsx            # 루트 레이아웃 (PreferencesStoreProvider)
│   └── globals.css           # 전역 스타일 + Tailwind 커스텀 breakpoint
├── types/
│   └── asset.ts              # 자산 5종 Zod 스키마 + AssetSummary 타입
├── contexts/
│   └── asset-data-context.tsx # 전역 자산 상태 (CRUD + 환율 + 동기화)
├── stores/preferences/       # Zustand 테마 스토어 + Provider
├── lib/
│   ├── asset-storage.ts      # localStorage 조작 + 공유 토큰 (v7.1)
│   ├── finance-service.ts    # 한국투자증권 API 연동
│   ├── cache-storage.ts      # 환경별 캐시 추상화 (파일↔Redis)
│   ├── number-utils.ts       # 숫자·통화 포맷 유틸
│   └── utils.ts              # cn(), getInitials(), formatCurrency()
├── config/
│   ├── app.ts                # 앱 이름·버전·메타
│   ├── asset-options.ts      # 자산 카테고리·금융기관·프리셋 옵션
│   ├── theme.ts              # ASSET_THEME, getProfitLossColor()
│   ├── navigation.ts         # 사이드바 네비게이션 항목
│   └── users.ts              # rootUser (더미)
├── server/
│   └── server-actions.ts     # 쿠키 기반 서버 액션 (테마 저장)
└── components/
    ├── scroll-to-top.tsx
    └── ui/                   # shadcn/ui 컴포넌트 54종
```

## 데이터 흐름

```
[브라우저 localStorage]
        ↓ 읽기/쓰기
[asset-storage.ts]
        ↓
[AssetDataContext]  ← 모든 CRUD, 환율, 동기화
        ↓
[컴포넌트들]  (*-input.tsx, overview-cards, distribution-cards 등)

[서버 API] (/api/finance, /api/share)
  → 캐시 확인 (cache-storage.ts)
  → 미스 시 한국투자증권 OpenAPI 호출
  → 캐시 저장 후 응답
```

## 캐시 스토리지 전략

| 환경 | 캐시 방식 |
|------|----------|
| 로컬 개발 (`UPSTASH_*` 없음) | 파일 (`data/finance-cache.json`, `data/share-tokens.json`) |
| Vercel 배포 (`KV_REST_API_URL` 있음) | Upstash Redis (Sliding TTL 30일) |

`getCacheStorage()` 팩토리가 환경 자동 감지 → `ICacheStorage` 반환

## 레이아웃 설정 (현재값)

| 설정 | 현재값 | 위치 |
|------|--------|------|
| 최대 너비 | `max-w-screen-3xl` (1680px) | `layout.tsx:33` |
| 사이드바 variant | `inset` | `layout.tsx:20` |
| 사이드바 collapsible | `icon` | `layout.tsx:21` |
| 콘텐츠 레이아웃 | `centered` | `layout.tsx:22` |
| 내비바 스타일 | `scroll` | `layout.tsx:24` |

## 환경변수

```bash
KIS_APP_KEY       # 한국투자증권 OpenAPI 앱키
KIS_APP_SECRET    # 한국투자증권 OpenAPI 시크릿
KV_REST_API_URL   # Upstash Redis URL (Vercel 배포 시)
KV_REST_API_TOKEN # Upstash Redis 토큰 (Vercel 배포 시)
GEMINI_API_KEY    # Google Gemini AI API 키 (스크린샷 파싱용)
```

## 스크린샷 가져오기 기능

**파일:** `src/app/api/parse-screenshot/route.ts`, `src/app/(main)/asset/_components/stock-screenshot-import.tsx`

토스증권·도미노 앱 보유종목 화면 스크린샷을 Gemini AI로 분석해 주식 데이터를 자동 추출.

### 플로우 (3단계)

```
1. upload  — 이미지 업로드 (드래그앤드롭 / 클릭)
              → POST /api/parse-screenshot → Gemini gemini-2.5-flash-lite 분석
2. conflict — 기존 주식과 ticker 중복 탐지 시 처리 방식 선택
              · 덮어쓰기: 중복 ticker를 스크린샷 기준으로 교체, 나머지 유지
              · 초기화: 기존 주식 전부 삭제 후 스크린샷으로 대체
3. preview — 종목 확인·선택·카테고리 수정 후 등록
```

### 주요 동작
- ticker 미인식 시 `ticker-map.ts`의 종목명→티커 fallback 매핑 사용
- Gemini가 `"null"` 문자열 반환 시 명시적 필터링 → 티커 미확인 처리
- 해외주식: 원화 평가금액 → 현재 USD 환율로 자동 변환
- 소수점 수량 지원 (도미노 앱: `310.536919주` 등)
- 수량 미표시 항목(내 기타 투자 등) → `quantity=1` 보정
- `"기타"` 섹션(내 기타 투자) → category `"irp"` 초기 설정 (미리보기에서 변경 가능)
- 다이얼로그: 취소 버튼 외 ESC·바깥 클릭으로 닫히지 않음

### ticker-map.ts
- 국내 ETF 약 80개, 국내 주식 약 70개, 해외 주식·ETF 약 300개 매핑
- `lookupTicker(name)` — 정규화(소문자·특수문자 제거) 후 매핑 조회
- 브랜드: TIGER/KODEX/ACE/HANARO/SOL/RISE/KBSTAR/KINDEX/ARIRANG/TIMEFOLIO/BIG
