# #31 dev-notes — developer (2026-10-28, 브랜치 `issue-4.34`, 커밋 73b80e9)

## 변경 요약
- `next.config.mjs` `env`: `NEXT_PUBLIC_VERCEL_ENV: process.env.VERCEL_ENV ?? ""` 1줄
- `src/lib/cloud-sync/config.ts`: `isPreviewEnv()`(정확히 `"preview"`만 true), `isCloudSyncEnabled()`에 `!isPreviewEnv() &&`
- `src/lib/cloud-sync/sync-client.ts`: `pushAsset`·`pullAsset`·`fetchRemoteVersion` 입구 가드(비활성이면 fetch 없이 error/null)
- 신규 `src/lib/preview/demo-payload.ts`(순수 함수 `resolvePreviewAction`·`materializeDemo`·`buildDemoRefreshMeta`·`kstToday`), `src/lib/preview/demo-data.json`(동적 import 전용)
- 신규 `src/app/(main)/_components/preview/preview-gate.tsx` — 배지·`?demo` 처리·선택 카드. `(main)/layout.tsx`가 preview일 때만 `next/dynamic`으로 `AssetDataProvider` 바깥을 감싼다
- 변경 없음: `welcome-guide.tsx`, `src/app/api/sync/`, `asset-storage.ts`, `asset-data-context.tsx`, `cloud-sync-provider.tsx`. 스키마·저장 키 불변
- KB: changelog·state-and-utils·components·qa-full-test-plan(F-CLOUD-SYNC) 반영

## 데모 내용
- 국내 2(005930·000660), 해외 USD 2(AAPL·NVDA), 연금 1(360750), ISA 1(069500), 코인 1(BTC), 부동산 1, 현금 2, 대출 1. 닉네임 `데모`
- 거래 월별(-3/-2/-1/0) 3·4·5·3건: 외부 입금·출금, 매수·매도, 대출 상환, 코인 매수. 부동산 재평가 = 월 스냅샷 `breakdown.realEstate` 6억→6.2억→6.3억
- 월 스냅샷 4건: -3은 레거시(date·enrich 없음), -2~0은 `date`·`fx`(USD 1350/1380/1400)·`fxBase`·`breakdown`·`cost`. -1월에 netAsset과 항목 합 15만원 차이(미기록 변화)
- `secretasset_asset_refresh`: 현금·대출 40일 전, 주식·코인 2일 전(#32 블록 7)

## 테스트 방법
- `npx vitest run src/lib/__tests__/preview-safety.test.ts` — 완료 기준 1~9 (28건). 전체 19파일 269건 통과
- `npm run lint` 오류 0(경고 16, 신규는 테스트 fs 경고), `npm run build`, `npx tsc --noEmit` 통과
- Playwright(완료 기준 10~17): 저장소 루트에서 `node .memory/qa/preview-check.mjs <previewURL> .memory/issues/31-preview-safety/shots` (전역 playwright 자동 해석, `HTTPS_PROXY` 사용). developer 1회 실행 결과 9/9 PASS, 스크린샷 `shots/`

## preview에서 qa가 확인할 경로·순서
URL: https://secretasset-git-issue-434-bbplayworlds-projects.vercel.app (375×812)
1. 새 컨텍스트 `/?demo=1` → `html[data-demo-ready="1"]` 대기 → 주소창 쿼리 없음, 홈(순자산 카드·도넛)
2. 같은 컨텍스트 `/?demo=1` 재접속 → 자산 수 동일(1,6,1,2,1)
3. 배지 `PREVIEW · v4.34`가 헤더 아래 중앙, 헤더 버튼과 겹치지 않음
4. 헤더 "성과" → 성과 허브(순자산·수익·배당·성적표) 콘솔 오류 0
5. `/?demo=empty` → 웰컴, 선택 카드 없음
6. 새 컨텍스트 `/` → 하단 카드 `데모 데이터로 보기`/`빈 상태로 보기` → 각각 1·5와 같은 상태
7. `/#sync=<임의>` 접속 포함 전 과정 `/api/sync`·GA 요청 0건
8. `git diff --stat origin/main...origin/issue-4.34 -- welcome-guide.tsx src/app/api/sync/` 빈 결과

## 알려진 한계
- 배지 위치를 ui.md의 `top-0`에서 **헤더 바로 아래(top 52px, `rounded-md`)로 변경**: 375px 홈에서 top-0 배지(약 113px)가 "성과" 세그먼트와 다운로드 아이콘에 겹쳐 완료 기준 14를 못 지켰다. 헤더는 비고정이라 스크롤 시 배지가 본문 위에 뜨지만 `pointer-events-none`이라 조작에는 영향 없음
- 데모 첫 진입 시 튜토리얼 오버레이(1/5)가 뜬다(운영과 같은 동작, 미수정)
- 이번 달 금액은 로드 시 실시간 시세로 재계산되어 고정값이 아니다(spec c6)
- 1~3월 주입 시 전년 달 스냅샷은 첫 저장에서 삭제된다(`asset-data-context.tsx:770`, #32 보존 수정에 의존)
- 선택 카드는 자산 추가를 1.5초 간격으로 확인해 사라진다(preview 전용)
- 이번 실행에 GitHub MCP 도구가 없어 git CLI 전용 모드: PR 미생성(비교 링크로 대체), 이슈 제목 `[4.34]`·라벨 `risk:high`·코멘트는 `log.md`에 기록, 다음 MCP 가능 실행에서 반영
