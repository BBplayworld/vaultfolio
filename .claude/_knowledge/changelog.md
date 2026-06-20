# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

## 2026-06-20

### PWA 설치 흐름 공용화 + 웰컴가이드 모바일 최적화 + iOS 가이드 SVG 실사화 (issue-4.5)

- **설치 흐름 공용 컴포넌트 추출** ([pwa-install-flow.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-flow.tsx) 신규): 홈 설치 버튼에 인라인돼 있던 설치 다이얼로그+전체 로직(state·`handleButtonClick`·`handleInstall`·`generateShareArtifacts`·iOS/인앱/동기화 분기)을 단일 컴포넌트로 분리. 트리거는 children render-prop(`{ onClick, loading, isIOS, isInApp, isInstallable }`)로 외부 주입. [pwa-install-button.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-button.tsx)는 다운로드 아이콘 버튼만 넘기는 얇은 래퍼로 축소(공개 API 동일).
- **웰컴가이드 모바일 웹 PWA-우선 레이아웃** ([welcome-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/layout/onboarding/welcome-guide.tsx)): `mobileWeb = mounted && useIsMobile() && !isStandalone`일 때 보안·포트폴리오 소개 노출 후 PWA 설치 유도를 메인 CTA로 강조. 즉시 자산 등록 CTA는 기본 숨김, "설치 없이 웹에서 바로 시작" 링크 클릭(`showAssetCta`) 시에만 노출. "웹앱 설치하기"는 홈 버튼과 동일한 `PwaInstallFlow` 호출. 기존 `PwaInstallGuideDialog` 직접 호출 제거. 데스크톱·standalone은 기존 레이아웃 유지.
- **iOS step1 가이드 SVG 실사화** ([pwa-guide-illustrations.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-guide-illustrations.tsx)): 실제 브라우저 스크린샷 기준으로 주소창 하단 + 진입 구조 재현. Safari=하단 우측 원형 `⋯`→세로 팝업 최상단 `공유`(`IosShareStep`), Chrome=주소창 우측 `공유`(box-arrow) 직접 탭(`IosChromeShareStep`), Whale=하단 우측 `≡`→그리드 팝업의 `공유` 타일(`IosWhaleShareStep`). step2(`IosAddToHomeStep`)는 3종 공통. 다이얼로그 step1 문구도 각 구조에 동기화.
- **app-guide `"use client"` 추가** ([app-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/app-guide.tsx)): `useState/useEffect` 사용으로 서버 컴포넌트 빌드 에러 발생 → 지시어 추가.
- **이유:** 홈 버튼과 웰컴가이드가 각각 다른 설치 경로(인라인 vs `PwaInstallGuideDialog`)를 써서 불일치 → 단일 흐름으로 통합. 모바일 웹 신규 사용자를 PWA 설치로 집중 유도(미설치 선택 시에만 웹 자산 등록). iOS 가이드 SVG가 실제 UI와 달라 사용자 혼동 → 실제 스크린샷 구조로 교정.

---

## 2026-06-14

### PWA iOS/인앱 브라우저 설치 플로우 개선 + 앱가이드 가독성 향상 (issue-4.5)

- **iOS 전 브라우저 감지** ([use-pwa-install.ts](file:///e:/2.project/js/secret-asset/src/hooks/use-pwa-install.ts)): `isIOS` 감지를 Safari 한정에서 `/iphone|ipad|ipod/` UA 전체로 확장. iOS Chrome·웨일에서도 홈 화면 추가 가이드가 노출됨.
- **인앱 브라우저 감지 + 외부 브라우저 유도** ([pwa-install-button.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-button.tsx)): `isInApp` (카카오톡·인스타·FB·라인·네이버 인앱 UA) 감지 추가. 인앱에서는 현재 URL 클립보드 복사 → `inAppStep` 외부 브라우저 유도 가이드(메뉴→다른 브라우저로 열기→앱 설치) 표시.
- **iOS 가이드 개선**: `navigator.share()` 호출 제거. 대신 `iosStep` 플로우(공유→홈 화면에 추가→추가) 가이드 UI로 교체. 버튼 라벨 "추가 방법 보기" (Safari 제한 문구 없음).
- **`apple-touch-icon` / `appleWebApp` 메타데이터 추가** ([layout.tsx](file:///e:/2.project/js/secret-asset/src/app/layout.tsx)): `appleWebApp: { capable: true, statusBarStyle: "black-translucent" }` + `icons.apple` (`/icons/icon-192x192.png`, 180×180) — iOS 홈 화면 아이콘 및 스탠드얼론 모드 인식.
- **PwaInstallGuideDialog 재검토** ([pwa-install-guide-dialog.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/pwa/pwa-install-guide-dialog.tsx)): 제목 "앱 설치가 안 되나요?", 설명 3상황(버튼 안 보임/재설치 불가/설치 불가 환경) 재작성. PC·Android·iOS 탭에 인앱/Firefox 불가 환경 주의 콜아웃 추가. iOS 탭 라벨 "iOS (Safari·크롬·웨일 등)"로 브라우저 무관 일반화.
- **앱가이드·웰컴가이드 가독성 향상** ([app-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/app-guide.tsx), [welcome-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/layout/onboarding/welcome-guide.tsx)): 카드 여백 `p-5`, 제목 `text-[15px]`, 본문 `text-[13px] leading-7 tracking-[0.01em]` 통일.
- **이유:** iOS에서 설치 버튼을 눌러도 아무 반응 없던 문제 해결. 카카오톡 등 인앱 브라우저에서 홈 화면 추가 불가 환경을 명확히 안내. iOS 홈 화면 아이콘 품질 개선(apple-touch-icon 누락).

---

### Plus 구독 모델을 위한 용어(Asset) 정의 및 코드 표준화

- **용어집 작성 및 표준 정의**: `.claude/_knowledge/asset-and-subscription.md`를 생성하여 전체 자산 데이터 묶음을 `Asset` (식별자 `assetId`), 서버 저장 암호화 본을 `AssetEnvelope`으로 명확히 규정.
- **서버 저장소 통합 및 `sync-storage.ts` 삭제**: 
  * [sync-storage.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/sync-storage.ts) 파일을 전면 삭제하고, 파일/Redis 입출력 동작을 [cache-storage.ts](file:///e:/2.project/js/secret-asset/src/lib/cache-storage.ts)의 `getAssetEnvelope` 및 `setAssetEnvelope` 메서드로 이관하여 서버 캐시/스토리지 로직을 단일화.
  * `UpstashCacheStorage`에서 Redis 키를 `csync:asset:${assetId}`로 변경하여 저장 관리. (레거시 검증이므로 하위 호환 마이그레이션 생략)
- **클라우드 동기화 및 크립토 리네임**:
  * [config.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/config.ts): `VaultEnvelope` -> `AssetEnvelope` 변경 및 `SYNC_HASH_PARAM`을 `"asset"`으로 변경.
  * [crypto.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/crypto.ts): `VaultKeys` -> `AssetKeys` 리네임 및 주석 내 `syncId` 혼용 제거, `assetId`로 명확히 통일.
  * [sync-state.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/sync-state.ts): 불필요한 레거시 `syncId` 마이그레이션 분기 제거 및 `assetId` 기반으로 단순화.
  * [sync-client.ts](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/sync-client.ts): `pushVault`/`pullVault` -> `pushAsset`/`pullAsset` 리네임, GET API 응답 JSON 필드 `vault` -> `asset` 변경.
- **API 라우트 및 UI 컴포넌트 업데이트**:
  * [route.ts (API Sync)](file:///e:/2.project/js/secret-asset/src/app/api/sync/route.ts): `sync-storage` 대신 `cache-storage` 싱글톤을 활용하여 E2EE 암호 봉투 저장/조회. API 응답 필드 `vault` -> `asset` 변경.
  * [cloud-sync-provider.tsx](file:///e:/2.project/js/secret-asset/src/lib/cloud-sync/cloud-sync-provider.tsx): `SYNC_HASH_PARAM="asset"` 반영으로 동기화 링크가 `#asset=<assetId>`로 빌드/탐지되도록 수정. `sync` 해시 폴백 감지 유지.
  * [cloud-sync-connect-dialog.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/functions/cloud-sync/cloud-sync-connect-dialog.tsx) 및 [cloud-sync-menu-entry.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/functions/cloud-sync/cloud-sync-menu-entry.tsx): 리네임된 변수명 연동 및 UI 텍스트 정비.
  * [tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/_components/header-menu/tool-menu.tsx): Share(1회 공유)와 Cloud Sync(지속 동기화)의 가치 포지셔닝 차이를 설명 및 메뉴 카피에 명시.
- **이유:** 향후 Plus 유료 구독 모델을 안정적으로 설계하고 연동하기 위해 구독/과금 대상의 공통 단위를 `asset` (`assetId`)으로 확정하고, 중구난방이던 서버 저장 키와 URL 파라미터, 소스 코드 구조를 깔끔하게 단일화함.

---

## 2026-06-11

### 주식 스샷 공통/개별 적용 옵션 + 의견·요청 보내기(Slack 웹훅) (issue-4.3)

- **주식 스크린샷 공통/개별 적용 토글** ([stock-screenshot-import.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx)):
  * 동일 증권사·카테고리 화면을 한 번에 캡쳐하는 일반적 사용 패턴을 위해 미리보기에 **"공통 적용"(기본) ↔ "개별 선택"** 세그먼트 토글 추가. 공통 모드는 카테고리·증권사 `Select` 1세트로 전 종목 일괄 적용, 개별 모드는 기존 종목별 드롭다운.
  * `updateCategory` 내부 환산 로직을 순수 헬퍼 `convertStockCategory(stock, category, usdRate)`로 추출 → `updateCategory`·공통 일괄 적용(`applyCommonCategory`)이 동일 헬퍼 재사용(해외↔국내 가격/통화 환산 일관, 중복 제거).
  * 파싱 직후 공통 기본값 자동 설정: 다수 종목이 해외면 `foreign`, 아니면 도메스틱/`activeTab` 국내계열. 증권사는 `matchBrokerHint(brokerHint)` 자동 매칭(거래 스샷과 동일 방식).
- **의견·요청 보내기 메뉴** ([tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/tool-menu.tsx) · 신규 [api/feedback/route.ts](file:///e:/2.project/js/secret-asset/src/app/api/feedback/route.ts)):
  * 더보기 "설정/기능"에 "의견·요청 보내기" 추가 → `Textarea`(내용 필수, 최대 2000자) + 연락처(선택) 다이얼로그. 닉네임 자동 첨부.
  * `/api/feedback` POST는 `SLACK_WEBHOOK_URL`로 메시지 전달만 수행하고 **서버에 저장하지 않음**. message 공백 검증(400), IP `checkRateLimit` 재사용(429), 웹훅 미설정(500)·실패(502). 기존 `share/route.ts`의 `getClientIp`·rate-limit 패턴 재사용.
  * Textarea는 `field-sizing-content` 자동 확장으로 다이얼로그를 밀어내 하단 버튼이 가려지던 문제 → `min-h-[160px] max-h-[40vh] overflow-y-auto`로 상한+내부 스크롤, `DialogContent`에 `max-h-[85vh] overflow-y-auto` 추가.
- **이유:** 같은 증권사 다종목 등록 시 반복 입력을 없애 입력 효율을 높이고, 사용자 의견을 서버 저장 없이 Slack으로 즉시 받는 피드백 창구를 마련.

---

## 2026-06-09

### 공유 URL 테마 모드 동기화 및 스크린샷 가져오기 UI 정돈 (issue-6.1)

- **공유 URL 테마(라이트 모드) 동기화 적용**:
  * [tool-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/tool-menu.tsx)에서 짧은 공유 URL 및 전체 공유 URL을 복사하여 생성할 때, 현재 발신 브라우저의 테마 상태가 라이트 모드(`themeMode === "light"`)라면 URL 뒤에 `&theme=light` 파라미터가 포함되어 생성되도록 수정했습니다.
  * [asset-data-context.tsx](file:///e:/2.project/js/secret-asset/src/contexts/asset-data-context.tsx)에서 공유 데이터를 해석하고 최종 저장하는 시점(`applySharedData`)에 URL 해시에서 `theme=light` 여부를 검출하는 `checkAndApplyThemeMode` 콜백을 호출하게 하여 수신 기기가 진입하자마자 즉시 preferences 스토어, 쿠키, HTML DOM의 테마 상태를 라이트 모드로 자동 동기화 갱신하도록 처리했습니다.
- **보유 주식 스크린샷 가져오기 미리보기 UI 정돈**:
  * [stock-screenshot-import.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/forms/asset-update/screenshot/stock-screenshot-import.tsx) 내에서 종목명, 티커 입력란, 환산 뱃지를 1행으로 간결하게 정렬했습니다.
  * 수량/현재가/평단가/평가금액 데이터 영역을 `grid grid-cols-2 sm:grid-cols-4` 형태의 은은한 패널(`bg-muted/40`) 구조로 개선하여 시각적 정돈과 정보 위계를 명확히 강화했습니다.
  * 카테고리 및 증권사 드롭다운 선택창의 가로 배치를 최적화하고, 증권사 선택(`Select`) 컴포넌트의 최대 가로 너비를 `sm:max-w-[220px]`로 확장하여 **"증권사 선택 안 함"** 텍스트가 짤리는 레이아웃 깨짐 현상을 해결했습니다.
- **웰컴 가이드 대시보드 미리보기 연동**:
  * [welcome-guide.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/layout/onboarding/welcome-guide.tsx) 하단의 대시보드 미리보기 영역이 임의의 마크업 대신 실제 [dashboard.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/views/home/dashboard.tsx) 컴포넌트를 공통 공유하여 렌더링되도록 개선했습니다.
  * 미리보기 시 모든 클릭이나 액션 이벤트를 차단/방지하여 UI 정합성을 유지하도록 처리했습니다.
- **이유:** 공유 URL로 자산을 가져올 때 테마 상태(특히 라이트 모드)도 완벽하게 연동되게 보장하고, 스크린샷 가져오기에서 텍스트가 잘리거나 정보 배치가 뭉개지는 사용성을 다듬어 프리미엄 감각을 높였습니다.

---

## 2026-06-07

### 보더리스 UI 구축 및 입력/상세 폼 인지성 강화 (issue-5.1)

- **전역 공용 UI 입력 필드 보더리스화**: 공용 Input([input.tsx](file:///e:/2.project/js/secret-asset/src/components/ui/input.tsx)), SelectTrigger([select.tsx](file:///e:/2.project/js/secret-asset/src/components/ui/select.tsx)), Textarea([textarea.tsx](file:///e:/2.project/js/secret-asset/src/components/ui/textarea.tsx))의 외곽 테두리(`border`) 및 그림자를 제거하고, 옅은 회색 배경(`bg-muted/60`, 다크모드 `dark:bg-muted/30`)을 주어 보더가 없더라도 입력 상자임을 또렷하게 인식하도록 개선. SelectTrigger 우측 `ChevronDownIcon`의 불투명도를 `opacity-100`으로 높이고 브랜드 인디고 색상(`text-primary`)을 적용해 Select 표시 인지성을 강화.
- **자산 업데이트 및 거래 입력 폼 보더리스 & 취소 버튼 secondary 통일**:
  * `forms` 하위 모든 `*-input.tsx` 및 `trade-input.tsx` 파일 내 다이얼로그 풋터의 취소/새로 추가 버튼들을 `variant="outline"`에서 보더가 없고 은은한 배경이 채워진 `variant="secondary"`로 교체.
  * `NumberInput` 하단의 퀵 추가 버튼들 및 `trade-input.tsx` 내 매수/매도 토글 시 선택되지 않은 버튼들 역시 `variant="secondary"`로 변경하여 테두리 일괄 제거.
  * `trade-input.tsx` 내의 직접 입력/스크린샷 가져오기 버튼들의 테두리를 제거하고 `bg-muted/60` 배경 및 우측 `ChevronRight` 아이콘을 배치해 플랫하고 보더리스한 UI를 완성.
  * 보유 주식 정보 박스, 예상 포지션 미리보기 카드, 중복 거래 경고 안내 카드의 테두리를 제거하고 각각 `bg-muted/50`, `bg-destructive/10`, `bg-amber-500/10` 등의 선명한 배경색을 입혀 식별력 강화.
- **상세 탭 및 과거 순자산 탭 내 수정/삭제/나누기 버튼 일괄 개선**:
  * 상세 자산의 모든 탭([stock-tab.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/views/detail/tabs/stock-tab.tsx) 등) 및 과거 순자산 탭([net-asset-chart.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/views/activity/net-asset-chart.tsx))에 존재하는 "수정", "삭제", "증권사별 나누기" 등의 카드 액션 버튼들을 `variant="outline"`에서 `variant="secondary"`로 일괄 변경하여 테두리 제거 및 배경 강조 적용.
- **인증샷 모드 및 공유 메뉴 개선**:
  * 주식 상세 탭 내의 `StockSummaryHeader`에서 인증샷 모드(`screenshotMode: true`)가 활성화되었을 때 환차손익 지구본 팝오버 아이콘(`CurrencyGainHint`)을 노출 리스트에서 제외.
  * 인증샷 생성 모달([share-menu.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/share/share-menu.tsx)) 내 카테고리 필터 `Select` 컴포넌트의 드롭다운 아이템들을 사용자가 실제로 보유 중인 주식의 카테고리 항목들(국내, 해외, IRP 등)만 필터링하여 노출하도록 개선.
  * 인증샷 뷰어([share-card.tsx](file:///e:/2.project/js/secret-asset/src/app/(main)/asset/_components/header/share/share-card.tsx))에서 자산 분포 도넛 차트와 주식 항목 사이에 불필요하게 붕 떠 있던 패딩 공간을 Card (`py-0`) 및 CardContent (`pt-0 px-0 sm:px-0`) 조정을 통해 제거 및 최적화.
- **이유:** 앱 전반의 외곽 테두리를 대폭 걷어내 플랫(Flat)하고 보더리스한 트렌디한 디자인 룩을 완성하면서도, 배경 및 아이콘/variant 변경 처리를 강화해 사용자가 폼 필드와 버튼 영역을 직관적이고 명확하게 인식할 수 있도록 조치.

---

## 2026-06-05

### 일별 수익 휴장 처리 + UI 정리 (issue-4.1)

- **휴장 폴백 캐시 매핑** (`/api/finance/profit`): ref-date 매핑 저장 가드를 `res.date === task.date || !reqIsBusinessDay`로 완화. 요청일이 비영업일(`isKrBusinessDay`/`isUsBusinessDay`)이라 직전 영업일로 폴백된 경우(영구 확정값)도 응답일 기준 저장 → 휴장일 동안 매번 KIS 재호출되던 churn 제거. 영업일+장중 미확정(응답일이 더 이름)은 stale 영구 hit 방지로 여전히 미저장. **일별 수익 표시값·날짜 로직은 불변.**
- **"휴장제외" 표시** (`profit-chart`): 기준 종가 비교 표에서 시작 종가가 휴장으로 직전 영업일에 폴백되면 시작일 아래 최소 표시. 일별=시작~종료 사이 휴장(`hasHolidayBetween`), 주/월/연=명목 기준 시작일 자체가 휴장(`isKrHoliday`/`isUsHoliday`)
- **인증샷 보강** (`stock-tab`/`share-card`): `StockCategorySection`이 인증샷 모드에서도 비중바·포트폴리오 하단에 종목 리스트 노출(`!screenshotMode` 가드 제거). 요약 헤더는 인증샷 시 전일 대비+상단 구분선 제거 → 평가손익이 평가금액과 동일 행 정렬
- **해외 상세 환차손익**: 금액 아래 줄에 수익률(`block`)로 분리 — 우측 매입환율 영역 침범 방지
- **비종목 자산 카드 정리** (real-estate/loan/cash): 접힘행 왼쪽=`이름 / 비중%`만(종류 배지·매입가·금리·기관 제거), 상세 펼침에 종류·매입가(부동산)·금리·금융기관(대출) 이동 — 주식 카드 패턴과 통일
- **날짜 input 모바일 넘침 원천 차단** (`globals.css`): `input[type="date"]` 등에 `appearance:none`+`min-width:0`+`max-width:100%`+webkit 의사요소 리셋 전역 규칙. 폼별 `max-w-[160px] sm:max-w-full` 임시방편 제거 → 전폭 통일
- **이유:** 동일 영업일 기준에서 국내 휴장일이 KIS 폴백으로 우연히 맞던 값을 캐시·표시까지 일관화하고, 비종목 자산 리스트의 정보 위계를 주식과 통일, 모바일 날짜 input 넘침을 소스 레벨에서 차단

## 2026-05-23

### UI 정보구조 전면 재설계 — drill-down 라우팅 + 통일 디자인 시스템

- **디렉토리 rename**: `bottom-nav→forms`, `main-nav→views`, `top-nav→header` (목적 기반 명명, layout/tutorial 유지)
- **NavigationProvider 신설** (`layout/navigation-context.tsx`):
  - `AssetView = home | detail/{tab} | activity/{tab}` 모델 + hash 동기화 + popstate
  - URL `/asset#detail/stocks` 직접 진입·새로고침·뒤로가기 모두 동작
  - `back()`은 항상 `navigate({type:"home"})` (어디서나 홈 복귀 정책)
  - `navigate()` 시 자동 `scrollTo(0,0)`
- **InlineSelector 공용** (`layout/inline-selector.tsx`): 모든 1·2·3·4차 탭이 segmented control로 통일
  - size 토큰: `sm/md/lg`(PC에서 한 단계 ↑: 14·16·18)
  - 컨테이너 라이트 짙음(`bg-muted/60`), 활성 `bg-background`, label `ReactNode`(모바일 축약 JSX 지원)
- **InfoHint 공용** (`layout/info-hint.tsx`): Popover hover/tap 패턴 — 가이드 §3
- **상세 5탭 Card 외피 통일**: stock/real-estate/cash/loan/crypto 모두 `<Card><CardHeader><CardTitle>...</CardTitle></CardHeader><CardContent>` 구조. 카테고리 selector는 SummaryHeader 아래 (Hero→필터→리스트)
- **카드 액션 버튼 위치 통일**: `ASSET_THEME.cardActions`("flex justify-end gap-2 px-3 py-2 bg-muted/10") 신 정의 — 5탭 모두 detail grid 하단 별도 라인
- **StockCard `screenshotMode` + `maskFn`**: 인증샷이 페이지 본체와 시각 완전 일치. share-card는 stock-tab의 외피·StockCard 그대로 사용 (펼침·버튼만 차단)
- **share-menu 통합**: stockHeader+stockList → 단일 `stock` 섹션. 체크박스 한 줄 가로 스크롤
- **FAB·ScrollToTop 무채색 토큰화**: `MAIN_PALETTE[11]`(#4e5763) → `bg-foreground/85`(FAB), `bg-foreground/70`(ScrollToTop). 메뉴탭 무채색 세트와 시각 일관
- **layout 본문 `pb-20 md:pb-24`**: FAB이 마지막 카드 가림 방지
- **ToolMenu 통합**: ThemeSwitcher 삭제 → 도구 메뉴 안 다크모드 토글로 흡수. 상단 아이콘 인증샷·도구 2개로 축소(h-10 sm:h-11)
- **순자산·배당 Hero 추가**: net-asset-chart에 "현재 순자산 + 전년 대비", dividend-chart에 "올해 연간 배당 + 월 평균"
- **dividend-chart**: 설명 3줄 → InfoHint, 카테고리 범례 신규, 예상/실제 토글 신규
- **이유:** 토스/애플 시니어 디자이너 관점 일관성 강화 — 컨테이너 위계 명확, drill-down으로 헤더 누적 해소, 무채색 토큰 통일

### 환율 히스토리 7일로 확장
- `EXCHANGE_HISTORY_DAYS` 3→7 (`lib/cache-storage.ts`) — 연휴·주말 컷오프 버퍼

## 2026-05-21

### 성과-수익 기간별 종가 기준 2옵션 (issue-3.9)
- `ProfitBasis = "sameBusinessDay" | "kstAccessDay"` 도입 (기본 sameBusinessDay)
  - `sameBusinessDay`(동일 영업일): 서버에서 국내·해외 모두 `getDates(period,"foreign")` 사용 → 같은 영업일 종가로 정렬
  - `kstAccessDay`(KST 접속일): 국내=domestic, 해외=foreign 독립 산출 (기존 동작)
- `/api/finance/profit`에 `basis` 쿼리 추가, `fetchProfitRef(options.basis)`, `getProfitCacheKey(tickers,period,basis)` — 캐시 키 `secretasset_profit:{basis}:...`로 옵션 분리
- 전역 store `src/stores/profit-basis-store.ts` (zustand, localStorage 동기화 + hydrate). profit-chart 토글 + stock-tab 전일대비가 함께 구독
- **스냅샷·기존 호출은 basis 미전달 = kstAccessDay(legacy)** 유지 → 스냅샷은 항상 오늘자 종가 기준 (옵션 무관)
- 옵션 영속화: `STORAGE_KEYS.profitBasis` + 내보내기 JSON(`profitBasis`) + 공유 토큰 packV7 parts[9]("k"=kstAccessDay)
- UI: 시작/종료 종가 영역을 표 형태(국내/해외/합계 행 × 시작/종료 열)로 재구성, 종가 날짜는 베이스 날짜 + 마감 메타(MM-DD HH:MM) 2줄. 해외 일별 표시의 강제 +1 shift 제거 → 두 옵션 공통으로 ET 거래일을 그대로 표기
- **이유:** 국내·해외 시차로 같은 영업일/접속일 기준 수익이 혼동되어 사용자가 명시적으로 기준을 선택하도록

