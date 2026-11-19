# Next.js 보안 권고 판정 — CEO, 2026-11-19

기준: `issue-5.126` efa0ae9 (main v5.127 병합분). 조사만 했고 코드·의존성은 바꾸지 않았다.

## 판정: 단독 릴리스로 처리 — `next` 16.4.2 → **16.4.5**, risk:low, v5.126 머지·운영 스모크 직후
실제 노출은 0이다. 급하지 않지만, 에이전트 빌드가 매번 1회차에 exit 1로 끝나 QA·개발 실행을 오판할 수 있어 지금 정리한다.

## 사실 확인
- 현재: `package.json` `^16.4.2`, lock·node_modules 16.4.2. npm latest 16.4.6(11/09), 패치 16.4.5(11/03).
- 빌드: 컴파일·타입·정적 생성 28/28·라우트 표 출력까지 끝난 뒤 `SecurityFatalError`로 exit 1. 메시지가 `next upgrade --agent=security …` 실행을 요구한다(에이전트 대상 안내문). 실행하지 않았다.
- 열린 권고(npm audit, 둘 다 moderate·CVSS 6.3·기밀성 낮음, 16.4.5에서 수정):
  - GHSA-mfr8-8qww-v76h (16.3.0~16.4.4): `'use cache'` 함수를 `unstable_cache()`로도 부를 때 root param 간 캐시 누출
  - GHSA-vc7v-qv4w-wrv8 (16.2.0~16.4.4): Cache Components에서 중첩 `'use cache'` + `next/root-params` 캐시 누출
- 16.4.5는 보안 수정 7건만 담는다(위 2건 + 아래 5건).

## 이 앱의 영향 경로 — 7건 모두 해당 없음
| 16.4.5 수정 항목 | 필요 조건 | 이 앱 |
|---|---|---|
| use cache × unstable_cache 누출 | `'use cache'`·`unstable_cache` 사용 | src 전체 0건 |
| 중첩 use cache root param 누출 | `cacheComponents`·`next/root-params` | 0건, 설정 없음 |
| fallback shell 캐시 오염 | Cache Components | 미사용 |
| use cache 바이너리 인자 누출 | `'use cache'` | 0건 |
| fetch 응답 전달 시 응답 주입 | 자체 호스팅 | Vercel 배포. 응답 본문 그대로 전달하는 라우트 0건(`/api/logo`는 버퍼로 다시 만듦) |
| 이미지 최적화 SVG 우회 | `/_next/image` | `images.unoptimized: true`, `next/image` 0건 |
| Edge 라우트 HttpOnly 쿠키 노출 | Edge runtime | edge 0건(명시 5개 모두 nodejs), 미들웨어·proxy 파일 없음, HttpOnly 쿠키 설정 없음 |
- 서버 액션: `"use server"` 0건. API 라우트 19개는 위 조건과 무관.
- 사용자 자산 데이터는 서버 캐시에 없다(절대 규칙). 누출 대상 자체가 없다.

## 올릴 버전: 16.4.5 (16.4.6 아님)
- 16.4.5 = 보안 수정만. 가장 작은 변경으로 권고가 사라진다.
- 16.4.6은 "라우트 핸들러 응답 자동 압축"이 들어간다. API 19개(바이너리 `/api/logo`, `/api/sync`, CDN 캐시 헤더)에 닿는 동작 변경이라 이번엔 뺀다. 다음 권고나 필요가 생기면 그때 별도 판정.
- 16.4.3~16.4.4에 딸려오는 것: Turbopack 청크 최적화 되돌림, 구글 폰트 URL 수정, 서버 부트스트랩 React 로딩 변경. 모두 버그 수정이다.
- 방법: developer가 `npm install next@16.4.5`로 lock만 갱신. 빌드 로그의 `next upgrade --agent=…` 명령은 쓰지 않는다(무엇을 바꾸는지 통제 불가). `eslint-config-next`(15.5.28)는 건드리지 않는다.

## 회귀 검사 범위 (qa)
1. `npm ci` → `npm run build` **1회차 exit 0**, 권고 문구 없음 / `npx tsc --noEmit` / `npx vitest run` 전건 / `npm run lint`
2. preview: 홈·자산·비중·가이드 2종·`?demo=1`·`?demo=empty` 렌더, 콘솔 오류 0, CSP Report-Only 위반 신규 0
3. API 스모크: `/api/finance`(+crypto·market-index·price-history), `/api/logo`(이미지 바이트), `/api/ticker-search`, `/api/share`, `/api/sync`(preview는 쓰기 꺼짐 — 읽기 응답만), 응답 헤더(`Vercel-CDN-Cache-Control`·보안 헤더 6종) 동일
4. PWA: manifest·SW 등록·`/calendar/*.ics` content-type, `/dashboard` 리다이렉트
5. 버전 표기(next.config의 브랜치·커밋 추출)가 새 버전으로 나오는지
6. 머지 후 운영 스모크 + 다음 크론(`/api/push/cron` 09:00, `/kr` 16:00 KST) 1회 정상 확인
- 데이터 안전 점검: 저장 스키마·키·동기화·서버 전송 변경 0 → 표는 "해당 없음" 근거 한 줄.

## 릴리스 시점·형태
- **v5.126 머지·운영 스모크 PASS 직후**, main에서 분기한 단독 릴리스. 번호는 그 시점의 다음 번호(지금 기준 5.128, 그 사이 배정되면 그다음).
- 5.126에 태우지 않는 이유: 의존성 변경을 아침 알림 기능과 섞으면 이상 시 원인 분리와 revert가 안 된다. 5.126 qa도 다시 돌려야 한다.
- DECISIONS 11-16 D4("작은 과제 단독 금지")의 예외로 본다. 사용자 화면 변경 0이라 판독 중인 화면(웰컴·결산·연 탭)을 오염시키지 않는다. 이 예외는 "의존성 보안 패치"에만 적용한다.
- 반영 판단: CEO. 롤백: squash 커밋 revert(lock 1개 + package.json 1줄).
- 5.126 qa 유의: 그때까지 빌드 1회차 exit 1은 이 권고 때문이다. 재실행 exit 0이면 빌드 PASS로 본다.

## 범위 밖 (기록만)
npm audit 나머지 13건은 개발 도구(vitest·eslint 계열·minimatch·vite)와 `zod` 3.25.76(high, 4.6.6에서 수정 — 메이저 변경)이다. zod는 클라이언트 폼·타입에서만 쓰고 서버 입력 검증에는 없다. 이번 릴리스에 넣지 않는다.

## 확인 못 한 것
- Vercel 실제 빌드에서도 이 오류가 나는지는 보지 않았다(v5.127이 배포된 점으로 보아 에이전트 환경 한정으로 추정).
- 16.4.5에서 빌드 권고가 사라지는지는 실제로 올려 보지 않았다(권고 범위 ≤16.4.4 기준 판단). qa 1번 항목으로 확인한다.
