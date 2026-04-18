# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# 한국어 설정

모든 응답, 코드 주석, 커밋 메시지는 한국어로 작성해주세요.

---

# 지식 베이스 (.claude/\_knowledge/)

## 세션 시작 시 필수 절차

새 대화가 시작되면 아래 순서로 KB 파일을 읽고 작업을 시작한다.
**전체 소스를 읽기 전에 반드시 KB를 먼저 확인한다.**

| 작업 유형              | 읽을 KB 파일                                                                 |
| ---------------------- | ---------------------------------------------------------------------------- |
| 모든 작업 (공통)       | `.claude/_knowledge/architecture.md`                                         |
| 컴포넌트 UI 수정       | + `.claude/_knowledge/components.md`                                         |
| 타입·스키마 변경       | + `.claude/_knowledge/types-and-schemas.md`                                  |
| API·캐시·공유 관련     | + `.claude/_knowledge/api-reference.md`                                      |
| 스크린샷 가져오기 관련 | + `.claude/_knowledge/api-reference.md` + `.claude/_knowledge/components.md` |
| Context·유틸 함수      | + `.claude/_knowledge/state-and-utils.md`                                    |
| 새 기능·패턴 확인      | + `.claude/_knowledge/dev-rules.md`                                          |
| 최근 변경 맥락 파악    | + `.claude/_knowledge/changelog.md`                                          |

## 코드 수정 후 필수 절차

코드를 수정할 때마다 아래 두 가지를 **같은 작업 내**에서 반드시 수행한다.

1. **관련 KB 파일 업데이트** — 변경된 내용이 반영된 파일만 수정
2. **changelog.md 업데이트** — 최근 1달치만 기록. 다음 형식으로 기록:

```
## YYYY-MM-DD

### 변경 제목
- **파일:** 수정된 파일 경로
- **변경:** 무엇을 바꿨는지 (간결하게)
- **이유:** 왜 바꿨는지 (맥락·문제 원인)
```

## KB 파일 목록

| 파일                                      | 담긴 정보                                      |
| ----------------------------------------- | ---------------------------------------------- |
| `.claude/_knowledge/architecture.md`      | 전체 스택·디렉토리·데이터 흐름·레이아웃 현재값 |
| `.claude/_knowledge/types-and-schemas.md` | 자산 5종 Zod 스키마 + AssetSummary 타입        |
| `.claude/_knowledge/api-reference.md`     | 내부 API·공유 토큰·캐시 추상화 인터페이스      |
| `.claude/_knowledge/components.md`        | 컴포넌트 역할·카드 레이어 구조·props           |
| `.claude/_knowledge/state-and-utils.md`   | Context CRUD·Store·유틸 함수 시그니처          |
| `.claude/_knowledge/dev-rules.md`         | 코딩 패턴·스타일 규칙·주의사항                 |
| `.claude/_knowledge/changelog.md`         | 주요 변경 이력 (무엇을·왜)                     |

---

# 개발 명령어

```bash
npm run dev       # Turbopack 개발 서버
npm run build     # 프로덕션 빌드
npm run lint      # ESLint 검사
npm run format    # Prettier 포맷
```

테스트 프레임워크 없음. 기능 검증은 `npm run build`로 타입 오류 확인.

---

# Architecture

**secretasset** — 오프라인 우선 개인 자산 관리 앱. 모든 사용자 데이터는 브라우저 `localStorage`에 저장되며 인증/백엔드 DB 없음.

### Stack

- **Next.js 15** (App Router) + **TypeScript** + **Zod** 런타임 유효성 검사
- **Tailwind CSS v4** + shadcn/ui (New York 스타일)
- **Zustand** (테마 설정), **React Context** (자산 데이터)
- **React Hook Form** + Zod (폼 유효성 검사)
- **TanStack Query** (금융 API 데이터 페칭)
- **Recharts** (순자산 차트), **dnd-kit** (드래그앤드롭 정렬)
- **lz-string** (공유 토큰 압축)

### 데이터 흐름

```
AssetDataContext (src/contexts/asset-data-context.tsx)
  └─ 모든 자산 CRUD + 환율 상태 관리
  └─ localStorage 읽기/쓰기 → asset-storage.ts

PreferencesStoreProvider (src/stores/preferences/)
  └─ 테마(다크/라이트)를 쿠키에 서버사이드 저장 → server-actions.ts
  └─ Zustand로 클라이언트 동기화 (hydration mismatch 방지)
```

메인 페이지: `src/app/(main)/asset/page.tsx`
모든 입력 컴포넌트: `src/app/(main)/asset/_components/`

### Key Files

| 파일                                                                      | 역할                                              |
| ------------------------------------------------------------------------- | ------------------------------------------------- |
| `src/types/asset.ts`                                                      | Zod 스키마 + TS 타입 (자산 5종 + 스냅샷)          |
| `src/lib/asset-storage.ts`                                                | localStorage 읽기/쓰기 + 공유 토큰 시스템 (v7.1)  |
| `src/contexts/asset-data-context.tsx`                                     | 전역 자산 상태 및 CRUD                            |
| `src/lib/finance-service.ts`                                              | 주식·환율 외부 API 통합 로직                      |
| `src/lib/cache-storage.ts`                                                | 캐시 스토리지 추상화 (로컬↔Redis 자동 선택)      |
| `src/app/api/finance/route.ts`                                            | 주식·환율 API 엔드포인트                          |
| `src/app/api/share/route.ts`                                              | 공유 Short URL 생성·조회 엔드포인트               |
| `src/app/api/parse-screenshot/route.ts`                                   | 스크린샷 파싱 API (Gemini AI, 4종 지원)           |
| `src/app/api/parse-screenshot/ticker-map.ts`                              | 종목명→티커 fallback 매핑 (~700개)                |
| `src/app/(main)/asset/_components/screenshot/stock-screenshot-import.tsx` | 주식 스크린샷 가져오기 다이얼로그 (3단계)         |
| `src/app/(main)/asset/_components/input/`                                 | 자산 유형별 입력 폼 (5종)                         |
| `src/hooks/use-gemini-usage.ts`                                           | 기기별 Gemini 사용량 추적 (하루 10회 제한)        |
| `src/server/server-actions.ts`                                            | 쿠키 기반 서버 액션 (설정 저장)                   |

### 자산 타입

`src/types/asset.ts`에 Zod 스키마로 정의된 5종: **RealEstate**, **Stock**, **Crypto**, **Cash**, **Loan**

- Stock: `category` (domestic/foreign/irp/isa/pension/unlisted)에 따라 ticker 형식 검증 분기
  - domestic: 6자리 숫자 (예: `005930`)
  - foreign: 대문자 영문자 (예: `TSLA`)
- `AssetSummary`: 집계된 순자산 계산 결과 타입

### Finance API

`/api/finance?type=exchange|stock&tickers=...` — KST 기준 일일 캐시.

- 주식 현재가/종목명: 한국투자증권 OpenAPI (`KIS_APP_KEY`, `KIS_APP_SECRET`)
- 환율: 한국투자증권 OpenAPI (USD/KRW, JPY/KRW)
- 캐시 키: `"TICKER-YYYY-MM-DD"` 형식

### 캐시 스토리지 전략

`src/lib/cache-storage.ts`의 `getCacheStorage()` 팩토리가 환경 자동 감지:

- **로컬 개발** (`UPSTASH_*` 환경변수 없음): 파일 기반 (`data/finance-cache.json`, `data/share-tokens.json`)
- **Vercel 배포** (`KV_REST_API_URL`, `KV_REST_API_TOKEN` 설정): Upstash Redis (30일 Sliding TTL)

### 공유 토큰 시스템 (v7.1)

`src/lib/asset-storage.ts` — LZ-string 압축 + 선택적 XOR 암호화 (4자리 PIN).

- 프리픽스: `v71P` (PIN 있음) / `v71N` (PIN 없음) / `v72Z` (Zero-Knowledge: PIN+localKey)
- v6.x, v7.0 토큰 하위 호환 지원
- 숫자: base36 인코딩 + K/M 접미사; 날짜: 2020-01-01 기준 일수 오프셋
- 스냅샷 포함: packV7 섹션[8]에 일별·월별 스냅샷 직렬화
- `/api/share`: `sha256(token)[:10]`을 키로 Short URL 생성, `owner_id`로 이전 키 자동 삭제

### 테마 시스템

Tailwind CSS v4 CSS 변수 기반. `src/scripts/generate-theme-presets.ts`로 테마 프리셋 생성.

### 스크린샷 가져오기

`/api/parse-screenshot` — Gemini `gemini-2.5-flash-lite`, `assetType` 파라미터로 4종 분기.

- `ticker-map.ts`: 종목명→티커 fallback 매핑 (~700개), `lookupTicker(name)` 3단계 매칭
- 주식 3단계: upload → conflict((ticker,category) 복합 키 기준) → preview
- 해외주식: `originalCurrency` 필드로 KRW/USD 분기 후 환산
- 한도: 서버 200회/일 + 기기별 10회/일 (`use-gemini-usage.ts`)

### 환경변수

```
KIS_APP_KEY          # 한국투자증권 OpenAPI 앱키
KIS_APP_SECRET       # 한국투자증권 OpenAPI 시크릿
KV_REST_API_URL      # Upstash Redis URL (Vercel 배포 시)
KV_REST_API_TOKEN    # Upstash Redis 토큰 (Vercel 배포 시)
GEMINI_API_KEY       # Google Gemini AI API 키 (스크린샷 파싱용)
```

### ESLint 설정

플랫 설정(`eslint.config.mjs`) — TypeScript, React, security, SonarJS, Unicorn 플러그인 포함. `next.config.mjs`에서 프로덕션 빌드 시 `console.*` 호출 자동 제거.
