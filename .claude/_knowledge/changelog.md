# 변경 이력

> 최신 항목이 위에 위치. "왜" 변경했는지를 중심으로 기록. 최근 10개만 유지.

---

## 2026-08-28

### 홈 알림 박스 4개(백업·최신화·세금·기능팁) → 1개로 통합

- **왜**: 홈 화면에 상단(백업 넛지·자산 최신화 넛지) + 하단(기능 팁 박스·세금 안내 박스) 총 4개의 알림성 박스가 각자 독립 판단으로 뜨다 보니 화면이 산만했다 — 사용자가 "모두 팁 박스로 통합" 요청.
- **통합 위치·우선순위**: 하단 1곳(자산분포 카드 아래, 기존 기능 팁 박스 자리)에만 존재 — 상단 자리는 없어짐. 위험도 순으로 1개만 노출: 백업(데이터 손실 위험) > 세금(마감 시한) > 자산 최신화 > 신규 기능 > 저방문 기능(전부 사용자 확정).
- **신규**: `src/lib/home-tip.ts`(`pickHomeTip` — 기존 4개 유틸의 순수 판정 함수를 조합만 함, 신규 판정 로직 없음), `views/home/home-tip-box.tsx`(통합 UI, 기존 `feature-tip-box.tsx`의 보더리스 셸 재사용).
- **재노출 정책은 종류별로 원래 그대로 보존**(하나로 뭉개지 않음) — 백업·최신화는 노출되는 순간 오늘 flag(daily), 세금은 명시적으로 닫아야만 이번 달 flag(monthly), 기능은 닫기·클릭 이동 둘 다 영구 dismiss. 우선순위상 하위라 안 뜬 종류는 flag를 찍지 않는다(과거 `RefreshNudge`의 `suppressed` 시 mark 생략과 동일 원리).
- **인터랙션 통일**: 4종 모두 "카드 전체 클릭 = 유일한 동작(백업 다운로드/세금 화면 이동/최신화 시트 오픈/기능 화면 이동), X = 닫기"로 단순화 — 백업·최신화가 갖고 있던 별도 "지금 백업하기"/"지금 최신화하기" 버튼은 제거.
- **삭제**: `backup-nudge.tsx`, `refresh-nudge.tsx`, `tax-notice-box.tsx`, `feature-tip-box.tsx` 4개 파일. 판정 로직(`backup-status.ts`/`asset-refresh-status.ts`/`tax-utils.ts`/`feature-usage.ts`)은 UI가 아니므로 전부 그대로 유지.
- **KB**: `qa-full-test-plan.md`의 F-NOTICE(세금 홈 배너 부분)·F-ASSET-REFRESH(RefreshNudge 부분)를 신규 F-HOME-TIP 섹션으로 통합, `components.md`·`state-and-utils.md` 갱신.

### 홈 "기능 활용 팁" 추천 박스 신설 + 자동 팝업 공지 제거

- **왜**: 기존 계획은 "공지사항 요약 박스"였으나, 신규 기능(절세 시뮬레이션)을 사용자가 놓치지 않게 하는 것이 목적이라면 "공지"보다 "지금 써볼 만한 기능 추천"이 더 맞는 프레임이라는 판단. 이번 릴리스 신규 기능을 최우선 추천하고, 이후엔 로컬 방문 기록 기반으로 사용자가 자주 안 쓰는 기능을 추천해 기능 발견성을 높인다.
- **신규**: `src/config/app-features.ts`(`APP_FEATURES`, 핵심 기능 13개 카탈로그 — 백업·피드백·설정·기기 동기화는 유틸리티류라 제외), `src/lib/feature-usage.ts`(방문 기록 + `pickRecommendedFeature` 추천 로직, `STORAGE_KEYS.featureUsage` 단일 키), `src/stores/tax-view-store.ts`(세금 관리 진입 시 초기 탭 지정, `loan-tx-view-store.ts` 패턴), `views/home/feature-tip-box.tsx`(홈 UI, `tax-notice-box.tsx`와 동일 보더리스 셸).
- **방문 기록 훅**: `navigation-context.tsx`의 `navigate()` 단일 지점에 `recordVisit(viewToKey(v))` 추가 — 모든 페이지 이동이 이 함수를 통과하므로 훅 지점은 여기 한 곳. `navigate`를 안 쓰는 인증카드(`share-card`, action형)는 신규 `dispatchOpenShareCard()` + `top-bar.tsx`의 `trigger-open-share-card` 리스너가 별도로 `recordVisit("share-card")` 호출(asset-dispatch.ts↔feature-usage.ts 순환 참조를 피하려 기록 로직은 리스너 쪽에 둠).
- **추천 우선순위**: ①dismiss 안 된 `isNew` 항목(카탈로그 순) ②dismiss 안 된 항목 중 방문횟수 오름차순(0회 우선). 닫기·클릭 이동 모두 해당 팁을 **영구** dismiss — 2026-08-12 자산 신선도·목표 설정 알림이 "반복 리마인드 효용 낮음"으로 롤백된 전례를 근거로 주기적 재노출 대신 영구 미노출을 채택.
- **방문 기록에 별도 동의 UI 없음** — `lastVisitDate`·`assetRefresh`·`tutorialStatus` 등 기존 로컬 전용 사용 상태 키들도 전부 동의 절차 없이 기록되며 서버로 전송되지 않는다는 기존 원칙을 그대로 따름.
- **자동 팝업 제거**: `UpdateNoticeDialog`(홈 첫 진입 시 자동으로 뜨던 공지 다이얼로그)와 그 파일(`notice-dialog.tsx`)을 삭제. 더보기 > "앱 가이드 · 공지사항"의 수동 열람(`notice.tsx`의 `NoticeContent` 재사용)은 그대로 유지 — 공지 확인 수단 자체가 없어지는 것은 아님.
- **공지·팁 작성 규칙 문서화**: `dev-rules.md`에 "공지·팁 콘텐츠 작성 3원칙"(①기능 위치·이동 경로 명시 ②SVG로 인지성 극대화 ③핵심 위주 간결함) 신설 — `notice.tsx`·`feature-tip-box.tsx` 공통 적용.

## 2026-08-27

### 연말 절세 시뮬레이션 — "한도까지" 손익통산 미반영 버그 수정

- **왜**: 손실 종목(비트마인·DIREXION TSLA 2X)을 이미 선택한 상태에서 대형 이익 종목(엔비디아)의 "한도까지"가 24주로 표시됐는데, 손실만큼 손익통산 여력이 커져 더 많은 수량이 비과세 한도 안에 들어와야 한다는 사용자 재현 리포트. 원인은 "잔여 한도 = `Math.max(DEDUCTION - Math.max(baseGain,0), 0)`" 공식(`getYearEndTaxSimulation`의 `remainingDeductionKrw`·`rebuyQuantity` 둘 다)이 baseGain이 음수(순손실)일 때도 0으로 클램프해 손익통산 효과를 지워버린 것 — 실제 세법상 손실이 크면 한도가 250만원보다 커지는 게 정상이다. 게다가 `rebuyQuantity`는 baseline만으로 1회 계산되는 정적값이라 다른 종목을 체크/해제해도 갱신되지 않았다.
- **수정**(`lib/tax-utils.ts`): 내부 클램프 제거 → `Math.max(DEDUCTION - baseGain, 0)` 하나로 정리. 잔여한도→수량 변환을 `computeRebuyQuantity(gainPerShareKrw, quantity, baseGainKrw)` 순수 함수로 추출·export.
- **동적 재계산**(`tax-year-end-simulator.tsx`): 종목별 "한도까지" 행마다 "그 종목을 제외한 현재 선택 전체 + baseline"을 `baseGainKrw`로 넘겨 매 렌더 재계산 — 정적 `candidates[].rebuyQuantity`(선택 0개 기준) 사용 중단. 상단 통합 박스의 "잔여 공제 한도"도 동일 원리로 내부 클램프 제거.
- 면책 문구도 실제 동작에 맞춰 정정: "다른 선택 종목과 무관하게" → "현재 선택된 다른 종목의 손익까지 반영해".
- 신규 테스트 5건(`computeRebuyQuantity` 4건, baseline 순손실 시 잔여한도 250만원 초과 확인 1건).

### 연말 절세 시뮬레이션 — 상단 통합 결과 박스 + 잔여 한도 실시간화 + 문구 축약

- **왜**: ① 최상단 baseline 박스(실현손익·잔여한도)와 최하단 예상 세액 박스가 분리돼 있어 정보가 흩어지고 스크롤해야 둘 다 보였다. ② "잔여 공제 한도"가 체크박스를 선택해도 바뀌지 않아 "지금 이대로 팔면 한도가 얼마 남는지"를 알 수 없었다 — 실현손익(이미 확정된 매도 합계)은 고정이 맞지만 잔여 한도는 선택을 반영해야 의미가 있다는 지적. ③ 하단 면책 문구가 여전히 길고, "종목만 단독으로 팔 때 기준"이라는 표현이 부정확했다(baseline은 항상 반영되므로 "단독"이 아니라 "다른 선택 종목과 무관"이 맞는 표현).
- **박스 통합 + 상단 고정**: 두 박스를 하나로 합쳐 최상단으로 옮기고 `sticky top-28`로 고정(부모 `TaxCalendarView`의 헤더+탭 sticky 높이만큼 오프셋) — 스크롤 위치와 무관하게 항상 보임. 예상 양도소득세 큰 숫자 + 실현손익(고정)·잔여 공제 한도(동적)·합산 손익(강조) 3개 보조 수치를 한 줄로.
- **잔여 공제 한도 실시간화**: `simulateSelectedForeignSale`을 선택이 비어 있어도(빈 배열) 항상 호출하도록 바꾸고, `FOREIGN_CAPITAL_GAIN_DEDUCTION - max(result.combinedGainKrw, 0)`로 매 선택마다 재계산.
- **면책 문구 재축약**: 두 문장(문구 정정+절세팁 설명)을 한 문장으로 합치고 "단독으로 팔 때"를 "다른 선택 종목과 무관하게"로 정정.

### 연말 절세 시뮬레이션 — 문구 정리·오류 문구 정정·색상 규칙 준수

- **왜**: 실사용 확인 결과 ① 종목 카드마다 "한도까지" 설명 문장이 반복돼 장황했고, ② 하단 면책 문구 "여러 종목을 선택하면 한도는 종목별로 독립 계산됩니다"가 실제 계산(해외주식은 항상 당해 손익을 합산해 하나의 250만원 공제로 계산)과 반대로 틀린 내용이었으며, ③ 결과 박스의 절감/증가 배지 색이 design-system.md의 "이익=빨강·손실=파랑" 규칙과 반대로 하드코딩돼 있었다.
- **문구 축약**: 종목별 반복 설명 문장을 제거하고 "한도까지" 칩에 "· 비과세"만 짧게 표기, 전체 설명은 후보 리스트 하단에 한 번만 노출.
- **면책 문구 정정**: `simulateSelectedForeignSale`은 실제로 항상 당해 손익을 전부 합산해 계산한다는 사실에 맞춰 문구 교체 — 종목별로 독립 계산되는 것은 `rebuyQuantity`(그 종목 단독 매도 기준 참고치)뿐임을 명시.
- **색상 규칙 준수**: 절감/증가 배지의 하드코딩된 blue/rose 클래스를 제거하고 `getProfitLossColor(result.savingsKrw)` 재사용 — 절감(호재)=빨강, 증가(악재)=파랑으로 design-system.md §1.2 규칙과 일치시킴. 예상 세액 숫자의 주황(`ASSET_THEME.important`)은 "순자산 전용이 아니라 화면 전체 범용 강조색" 규칙에 부합해 유지.
- **같은 날 후속**: "미선택 대비 절감/증가" 배지가 바로 위 "예상 양도소득세" 숫자와 정보가 중복된다는 피드백으로 배지 자체를 제거, 대신 "합산 손익" 금액을 `text-foreground font-semibold`로 강조.

### 연말 절세 시뮬레이션 — 증권사별 계산 버그 수정 + 재사용 규칙 문서화

- **왜**: 동일 종목을 여러 증권사에 나눠 보유하면 `getYearEndTaxSimulation`/`simulateSelectedForeignSale`이 증권사별 `Stock` 로우를 그대로 순회해 종목마다 별개 세액을 계산했다 — 양도소득세는 증권사가 아니라 종목 단위로 손익을 합산해 판정하므로 실제 세법과 맞지 않는 계산이었다.
- **수정**(`lib/tax-utils.ts`): 신규 `groupForeignStocksByTicker`(내부 헬퍼)가 `asset-detail-tabs.tsx`의 `groupStocksByTicker`+`mergeStockGroup`(상세 > 주식 탭 "전체" 카테고리가 이미 쓰는 표준 병합 — 수량 합산, 평단·매입환율 수량 가중평균)과 동형 로직으로 해외주식을 티커 기준 종합한다. `lib`가 컴포넌트 파일을 역참조하면 계층 위반이라 import 대신 동일 로직을 이 파일 안에 복제. `getYearEndTaxSimulation`(후보 목록)·`simulateSelectedForeignSale`(선택 시뮬레이션) 둘 다 이 종합 목록을 사용하도록 교체.
- **재사용 규칙 문서화**: `dev-rules.md`에 "주식 계산·집계는 항상 종목(티커) 기준 종합이 기본" 규칙 신설(강제) — 증권사별 세분화는 명시적 요청이 있을 때만. 신규 테스트 2건(증권사 2곳 보유 시 후보 1건으로 종합, 티커 종합 id로 선택 시뮬레이션).

- **왜**: 상세 > 주식 리스트의 종목별 "전일 대비 %"가 순수 종가-vs-종가 비교라, 국내 장중(16:00 컷오프 전)엔 어제 종가끼리 비교해 하루 종일 갱신되지 않았다(`Stock.currentPrice`는 이미 1시간 단위로 실시간 갱신 중인데 활용을 안 하고 있었음).
- `computeDailyStockProfit(..., { useLivePrice: true })`(신규 옵션, 기본 false로 기존 호출처 전원 무변경) — 분자를 종가(`refPrice`)에서 실시간 `currentPrice`로 교체. baseline은 `refDate===오늘`이면 `prevPrice`, 아니면 `refPrice`를 써서 시간대와 무관하게 항상 "가장 최근 확정 종가(어제)"로 수렴 — 장 마감 후엔 기존 값과 완전히 같아 회귀 없음, 장중엔 실시간으로 갱신됨. `stock-tab.tsx`의 두 호출부(집계 헤더·종목별 개별)만 옵션 켬 — `profit-chart.tsx`·`performance-hub.tsx`는 무변경.

### 인증카드 도넛 차트 시도 후 전면 롤백 + 세금 관리 UX·버그 수정

- **왜**: 인증카드를 "비중 바 + 종목 리스트"에서 도넛 차트로 개편해봤으나(사각형 → 원형 두 차례 시도, 아래 상세) 실사용 확인 결과 완성도가 기준에 못 미쳐 **전면 롤백**하고 원래 구성으로 되돌리기로 결정. 별도로 연말 절세 시뮬레이션(S-4.31)을 실사용해보니 ① 최상단 "일정관리/시뮬레이션" 탭이 이번 달로 자동 스크롤되며 화면 밖으로 밀려나 찾기 어렵고, ② 250만원이 `$2,500,000`로 잘못 표시되며, ③ 예상 세액 결과가 눈에 안 띄고, ④ 수량 조정이 `±1`뿐이라 불편했다.
- **인증카드 롤백**: `share-card.tsx`를 원본으로 복원, 시도했던 `SquareDonutChart`(사각형)·`PortfolioDonutChart`(원형, recharts)와 관련 파일 전부 삭제. `stock-tab.tsx`의 `StockIcon`도 원래 인라인 로직으로 되돌림(도넛 라벨용으로 추출했던 `resolveStockLogoSrc` 제거).
- **통화 표기 버그 수정**: `src/lib/utils.ts`와 `src/lib/number-utils.ts`에 이름이 같은 `formatCurrency`가 각각 존재(전자는 기본 `USD`/`en-US`, 후자가 앱 전역 KRW 포맷). `tax-calendar-view.tsx`·`tax-year-end-simulator.tsx`가 잘못된 쪽(`@/lib/utils`)을 import해 원화 금액이 `$` 기호로 표시됐다(계산 자체는 정확한 KRW 값이었고 표시 포맷만 문제) — `tax-calendar-view.tsx`의 이 버그는 S-4.23부터 있던 기존 결함. 둘 다 `@/lib/number-utils`로 교체.
- **세금 관리 탭 접근성**: `TaxCalendarView` 헤더+`InlineSelector`(일정관리/시뮬레이션) 영역을 `sticky top-0`로 고정 — 이번 달 자동 스크롤이 일어나도 탭 전환이 항상 화면에 보이도록. 현재 월 섹션의 `scroll-mt`도 sticky 헤더 높이에 맞춰 재조정.
- **예상 세액 결과 박스 강조**: `tax-year-end-simulator.tsx`의 결과 박스를 더 큰 글씨(`text-3xl`)·아이콘·테두리로 강조하고 절감/증가 배지를 색상으로 구분해 인지성을 높임.
- **수량 조정 ±5/±10 버튼 추가**: 기존 `±1` 스테퍼 옆에 `-10/-5/+5/+10` 프리셋 버튼 추가(보유 수량이 각 임계값을 넘는 종목에만 노출) — 큰 수량 조정 시 클릭 수 감소.

<details>
<summary>인증카드 도넛 시도 상세 (롤백됨, 참고용)</summary>

- **1차(사각형)**: `SquareDonutChart` — `<rect pathLength=100>` 세그먼트로 사각 링을 그리고 링 바깥에 리더라인 + 로고(원본 비율) + 종목명 + 비중%만 노출(개별 금액 제거), 중앙엔 이모지🔒+닉네임. `StockIcon`에서 `resolveStockLogoSrc` 순수 함수를 추출해 공유.
- **2차(원형 재작업)**: 실사용 확인 결과 ① 단일 종목이 70~80%대로 크면(테슬라 76.7% 사례) 커스텀 dasharray 계산이 무너지고, ② "사각형" 자체를 철회(원형이 맞다고 판단), ③ 중앙 이모지가 완성도를 깎고, ④ "검은 바탕+무지개 컬러의 고급스러움" 기준에 못 미쳐 — `PortfolioDonutChart`(recharts `PieChart`/`Pie`/`Cell`, `dashboard.tsx`의 `AssetDonutChart`와 동일 패턴)로 교체, 중앙 완전히 비움, `ShareCard` 루트에 `dark` 클래스 강제.
- **최종 롤백**: 2차도 실사용 확인 후 완성도 기준 미달로 전면 철회 — 위 "인증카드 롤백" 참고.

</details>

### 연말 절세 시뮬레이션 전면 개편 — 메뉴 분리 + 체크박스·버튼 입력 (issue-4.31 후속)

- **왜**: 직전(08-26) 1차 구현을 사용자가 확인한 결과 세 가지 문제가 드러났다. ① 세금 캘린더의 "연말 절세 인사이트" 섹션이 `computeForeignRealizedGain`이 `null`(=당해 매도 거래 0건)이면 통째로 렌더되지 않아 대부분의 사용자에게 사실상 항상 숨어 있었다(근본 원인 버그). ② 개별 주식 카드 버튼과 캘린더 섹션 두 곳에 기능이 흩어져 하나의 도구로 인지되지 않았다. ③ 손실 종목 손익통산 비교와 이익 종목 재매수 절세 팁이 없었다.
- **메뉴 개편**: 더보기 > 지원 "세금 일정" → **"세금 관리"**로 명칭 변경. 페이지(`#tax`) 최상단에 `InlineSelector`(기존 "모든 탭 UI의 공용 컴포넌트")로 "세금 일정관리"/"절세 시뮬레이션" 두 화면 전환(라우팅은 `#tax` 그대로, 페이지 내부 상태 전환).
- **null 게이팅 제거**: `getYearEndTaxSimulation`(신규, `simulateForeignStockSale`/`getYearEndTaxInsight` 대체)은 당해 거래가 없어도 `baselineGainKrw=0`으로 항상 후보 목록을 반환 — 보유 해외주식이 1건도 없을 때만 빈 상태.
- **체크박스+버튼 전용 입력**: 텍스트 입력 폼 제거. 종목 `Checkbox` 선택 → "전량"/"한도까지"(이익 종목의 잔여 공제 한도 소진 수량) 프리셋 칩 + `±1` 스테퍼로만 수량 조정.
- **손익통산 비교 + 재매수 팁 추가**: `simulateSelectedForeignSale`(신규)로 체크된 여러 종목을 합산해 미선택 대비 절감액을 즉시 계산. 이익 종목은 `rebuyQuantity`(잔여 공제 한도 내 비과세 매도 가능 수량)를 계산해 "매도 후 재매수" 절세 팁 노출.
- 신규 컴포넌트 `TaxYearEndSimulator`가 1차의 `TaxSellSimulatorSheet`(개별 종목 `Sheet`)를 완전히 대체·삭제. 주식 상세 화면의 "예상 세금" 버튼도 제거해 진입 경로를 탭 하나로 통일. 스키마·저장 키·API 변경 없음(순수 계산 + 읽기 전용 UI 재구성).

## 2026-08-26

### 해외주식 매도 세금 시뮬레이션 (issue-4.31)

- **왜**: 기존 세금 캘린더(S-4.23)는 "언제 신고할지"만 안내하고 세액 계산은 의도적으로 제외했는데, 사용자가 실제 매도를 고민하는 순간 가장 궁금한 "지금 팔면 세금이 얼마인가"에는 답하지 못했다. 참고용 추정치임을 명확히 하는 조건으로 이 결정을 재검토해 실질적인 절세 의사결정 도구를 추가했다.
- **해외주식 단일 종목 시뮬레이션**: `simulateForeignStockSale`(신규, `lib/tax-utils.ts`) — "지금 팔면"은 미래 시점 가정이라 거래로그 replay 없이 `Stock.averagePrice`(현재 평단)를 원가로 바로 사용. 당해 기존 실현손익(`computeForeignRealizedGain` 재사용)과 합산 후 250만원 공제 적용해 22% 세액 산출. 매입·매도 환율 정보가 없으면 현재 환율로 폴백하고 "추정치" 배지 표시.
- **연말 절세 인사이트**: `getYearEndTaxInsight`(신규) — 세금 캘린더 뷰(`#tax`)에 당해 250만원 공제 잔여 한도와 미실현 손실 보유 해외주식 목록 섹션 추가(정보 나열, 통산 재계산 없음).
- **범위 축소**: 최초 명세는 국내 비상장주식·손익통산 시나리오 비교("같이 매도" 다중 선택)까지 포함했으나, 구현 착수 전 사용자 판단으로 해외주식 단일 계산 중심으로 축소(명세 [S-4.31](../specs/4.31-tax-sell-simulation.md) 갱신 반영).
- 신규 컴포넌트 `TaxSellSimulatorSheet`(라우팅 없는 로컬 `Sheet`) — 세금 캘린더 뷰와 주식 상세 화면(해외주식만) 양쪽에서 진입. 신규 스키마·저장 키·API 없음(순수 계산 + 읽기 전용 UI).

## 2026-08-22

### 시세 정확도·자산 업데이트 UX·코드 구조 정리 (issue-4.23 연장)

- **왜**: 사용자가 해외주식 현재가 stale 이슈를 보고 → 근본 원인 2건을 순차 발견해 수정. 함께 자산 업데이트 진입 흐름·소스 구조도 재정비.
- **해외 개장 전 flat 라벨 stale 버그(R24)**: `getStockCacheSlot("foreign")`이 마감 컷오프(07:00 KST)~개장(17:00/18:00 KST) 구간에 "오늘" 라벨로 어제 종가를 캐싱했고, 이 라벨이 이후 휴장일 롤백 결과와 우연히 같아지면(금요일 오전 캐싱=금요일, 토요일 롤백도 금요일) 재조회가 스킵돼 하루 이상 stale 노출. `beforeTodaysOpen` 분기 추가로 수정(TSLA 실사용 사례).
- **앱잠금 해제 후 동기화 미재개 버그(R25)**: 위 수정을 검증하다 발견 — 잠금 상태로 페이지가 로드되면 `initAndSync`가 그 즉시 return하고, PIN을 풀어도 `PWA_UNLOCKED_EVENT`가 cloud-sync pull만 재트리거해 시세·환율·스냅샷이 그 세션 내내 갱신되지 않았다. `asset-data-context.tsx`에 리스너 추가로 해제 시 전체 재동기화하도록 수정.
- **국내주식 실시간가 전환**: `search-stock-info`(당일 종가, `thdt_clpr`) → `inquire-price`(실시간, `stck_prpr`)로 교체. 종목명·시장구분은 `kr-master.ts`(로컬 정적 마스터)로 API 호출 없이 대체, KOSPI200 등 분류는 90일 캐시 분리로 매시간 재조회 방지.
- **암호화폐 Redis 캐시 통합**: `finance:coin:{market}-{slot}`+`finance:coin:last:{market}` 2키 → `finance:coin:{market}` 1키(slot+updatedAtMs 포함 레코드)로 합쳐 `setCoin`의 SET 호출을 2회→1회로 축소.
- **FAB "자산 업데이트" hub 재설계**: `select-type`+`select-action`을 hub(보유현황/거래기록 2타일) → 카테고리 컴팩트 리스트로 재구성했다가, 이후 요구사항 재검토로 **다건 체크박스·시퀀스·완료 원인분해 요약 화면을 전부 제거**하고 항상 단건 처리로 되돌림(`attribution-summary.tsx` 삭제). 매수/매도 스크린샷에서 미보유 매수 심볼은 신규 종목/코인으로 자동 등록하도록 강화(매도는 계속 차단).
- **부동산 토지 실거래가**: `inquire-price` 실시간 전환과 별개로 토지는 지목별 형평 비교·지분 문제로 실거래가 조회 기능 자체를 제외 유지(수동 입력만).
- **src/lib 도메인 재구성**: 35개 평면 파일을 `finance/`·`asset/`·`trade/`·`realestate/` 4개 도메인 폴더로 이동(`src/app/api` 폴더 명명 관례 참고), 미사용 `layout-utils.ts` 삭제. ~60개 파일의 import 경로 일괄 갱신.
- toast 기본 노출 시간 3.5초 → 2초 단축.

## 2026-08-12

### Round 2 M1~M3: 온보딩 마법사 (issue-4.29)

- **왜**: 리텐션(재방문 습관화)과 신규 유저 온보딩이 이번 라운드 목표. 업로드된 원 스펙(PRICE-ALERT·GOAL-TRACKING·ONBOARDING-WIZARD)을 코드베이스와 대조 검토한 결과 Web Push 인프라·서버 판정 파이프라인·부동산 스크린샷 인식이 전부 없어 원 스펙 그대로는 구현 불가 — Push·서버 관여를 전면 배제하고 완전 로컬 기능으로 재설계해 명세(S-4.27~4.29)로 확정 후 구현. (S-4.26 자산 신선도·S-4.27 평가금액 알림·S-4.28 목표 설정은 함께 구현했으나 전부 적용 철회 — 아래 8/12 후속 항목 참고)
- **S-4.29 온보딩 마법사**: 주식→코인→현금→대출 4단계 스크린샷 업로드 마법사. 부동산은 인식 엔진이 없어 즉시 수동 입력 연결. 완료 화면은 실제 `<Dashboard/>` 렌더. 기존 스크린샷 인식 다이얼로그 4종에 `onSaved` 콜백만 추가해 재사용(신규 인식 로직 없음). [onboarding-wizard-flow.tsx](../../src/app/(main)/_components/layout/onboarding/onboarding-wizard/onboarding-wizard-flow.tsx).
- **QA에서 발견해 함께 수정**: S-4.29 최초 구현이 AC10(전체 건너뛰기 시 실제 WelcomeGuide 복귀)을 충족하지 못해 spec-check 후 수정.
- 신규 로컬 저장 키 1개(`secretasset_onboarding_wizard_status`) `asset-storage.ts` keepKeys에 등록.

### 자산 신선도·평가금액 알림·목표 설정 전체 철회 + 온보딩 마법사 노출 방식 조정 (issue-4.22 후속)

- **왜**: S-4.26 자산 신선도, S-4.27 평가금액 % 변동 알림에 이어 **S-4.28 목표 설정(순자산 목표·카테고리 배분·부채비율) 기능도 전체 롤백**하기로 결정 — 순자산 목표 진행률 바 UI를 여러 차례 다듬는 과정에서 기능 자체를 걷어내는 쪽으로 결론. `goal-utils.ts`·`goal-settings-view.tsx` 삭제, `assetDataSchema`의 `goals` 필드 제거(zod가 알 수 없는 키를 무시하므로 기존 저장 데이터도 안전하게 로드됨), 더보기 메뉴의 "목표 설정" 진입점·`#goal` 라우팅·대출 탭 부채비율 표시·온보딩 마법사 완료 화면의 목표 연결 카드까지 전부 제거. S-4.27도 "Push 알림이 없는 앱 구조상 효용성이 낮고 자산관리앱 성격에 안 맞는다"는 판단으로 전체 롤백(저장 실패 버그 수정이 아니라 기능 자체 제거). 또한 S-4.29 온보딩 마법사가 데스크톱/PWA 최초 진입 시 웰컴가이드보다 먼저 자동으로 떠 있던 것을 "웰컴가이드가 항상 먼저 보여야 한다"는 요구에 맞춰 자동 노출 로직 제거 — 마법사는 이제 웰컴가이드 CTA를 명시적으로 눌렀을 때만 열린다([page.tsx](../../src/app/(main)/page.tsx)).
- 더보기 > 지원 메뉴의 "스크린샷으로 자산 등록" 버튼 제거 — 웰컴가이드·마법사 CTA로 진입 경로가 이미 있어 중복.
- 웰컴가이드 하단 CTA 5개(스크린샷 일괄 등록/부동산 추가/주식 추가 팝오버[스크린샷·직접입력]/기존 데이터 가져오기/동기화 연결)를 2개로 통합: "스크린샷으로 자산 등록"(마법사, 부동산 수동 입력 링크 내장) + "직접 입력·가져오기" 팝오버(주식 직접 입력/기존 데이터 가져오기/동기화 연결). 주식 팝오버의 "스크린샷 가져오기" 옵션은 마법사와 완전히 중복이라 제거. [welcome-guide.tsx](../../src/app/(main)/_components/layout/onboarding/welcome-guide.tsx).
- 순자산 목표 진행률 바를 다듬는 과정에서 만든 **"세그먼트 레벨미터"**(진행률을 칸으로 나눠 `SHARE_SAFE_PALETTE` 색을 순환시키며 채우는 시각화) 디자인은 기능 롤백과 별개로 마음에 들어 재사용 컴포넌트로 보존 — [level-meter.tsx](../../src/components/ui/level-meter.tsx) `LevelMeter`. 현재 적용처는 없고, 진행률·달성도 시각화가 필요할 때 우선 검토 대상.

---

## 2026-08-08

### 인증카드: 닉네임 제거 + 비중 범례를 중앙으로 이동 (issue-4.22)

- **왜**: ① 닉네임(`@nickname`)은 공유 시 불필요한 개인정보 노출. ② 직전 개편에서 "심플한 가로 박스" 의도로 범례를 뺐더니, 어떤 종목이 얼마인지 알려면 하단 리스트를 훑어야 해서 한눈에 안 들어왔다. ③ 범례를 살리면 리스트 행의 `N주 · 비중%`와 퍼센트가 중복된다.
- **수정**: ① [share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx) 상단 닉네임 블록·`useNickname` 제거. ② [stock-tab.tsx](../../src/app/(main)/_components/views/detail/tabs/stock-tab.tsx) `StockCategorySection` 범례의 `!screenshotMode` 가드를 제거해 상위 4개 + `기타 N종목`을 인증카드에도 노출(계산은 기존 `barShown`/`barRest`/`restPct` 그대로, 신규 로직 없음). ③ `StockRowHeader`는 `screenshotMode`일 때 `· 비중%` 미렌더 — "외 N종목 · 비중 X%" 요약 행과 카드 하단 비중 게이지 바는 유지.
- **"외 N종목" 요약 행**: 우측을 종목 카드와 동일한 2줄(나머지 평가금액 합 / 손익 `(+X.X%)`)로 맞추고 `비중 X%`는 제거(범례 `기타 N종목`과 중복). 손익은 기존 `computeStockMetrics`를 rest에 합산하고 `(Σ평가−Σ원가)/Σ원가` 공식(`useFilteredStockData`와 동일)을 쓰며, 상장폐지 종목은 총계 기준과 맞춰 제외. `StockCategorySection`에 optional `maskFn`·`exchangeRates` prop 추가(주식 탭은 `maxItems` 미지정 → rest 없음, 영향 없음). 별도 배경 박스(`bg-muted/30 px-3`)는 좌우 패딩 차이로 위 카드들과 정렬이 어긋나 제거하고, 같은 `cardWrapper`+`cardHeader`+아이콘 자리(spacer) 구조로 통일.
- **문구·간격**: 범례 "기타 N종목"과 리스트 "외 N종목"이 서로 다른 단어를 써서 "그 외 N종목"으로 통일(범례 툴팁 포함). 인증카드 종목 행 세로 패딩을 `py-2.5`→`py-2`로 살짝 축소(`ASSET_THEME_SHOT.cardHeader` — 이 토큰은 인증카드 전용이라 다른 화면 영향 없음).
- **간격·크기 미세조정(2026-08-08 추가)**: 요약 헤더~비중 바~종목 리스트 세 영역의 **실제 노출 여백**을 28px로 통일. 단순히 마진 값만 같게 두면 헤더 쪽은 배경 없는 박스의 자체 패딩(`py-4` 하단 16px)과 아래 박스의 상단 패딩(`p-3.5`=14px)이 마진에 더해져 legend~list보다 더 벌어져 보이는 문제가 있었다 — 헤더 하단 패딩을 0으로 없애고(`pt-4`만 유지) 마진을 `mt-3.5`(14px)로 줄여 `14(마진)+14(아래 박스 상단 패딩)=28px`로 맞춤(범례~리스트의 순수 `mt-7`=28px와 동일). 리스트~푸터는 `mt-4`(16px) 유지. 푸터에 `px-[18px]`을 추가해 좌우 여백을 헤더·비중 바·리스트와 동일하게 정렬(기존엔 패딩이 없어 카드 가장자리에 더 가깝게 붙어 위 영역과 어긋나 보였음). 비중바·리스트 래퍼의 옅은 회색 배경(`bg-muted/20 dark:bg-muted/10`)을 제거해 카드 전체 배경과 통일(패딩은 간격 계산 유지를 위해 존치). **상위 노출 개수 4→5개**(`SHOT_MAX`)로 확대 — 범례·리스트·비중 바 모두 동일 상수 하나로 축약되므로 파생 변경 없음. 카드 최상단↔"총 주식 평가금액"과 "시크릿에셋"↔카드 최하단 간격은 헤더 `pt-2`/푸터 `pb-2`로 축소해 동일값(outer `p-3`+2=20px) 유지. 리스트~푸터 간격은 "그 외 N종목" 행 자체 하단 패딩(`cardHeader py-2`=8px) + 비중바·리스트 래퍼 하단 패딩(`p-3.5`=14px)까지 포함해 계산 — 마진을 `mt-7`이 아닌 `mt-1.5`(6px)로 둬야 `6+8+14=28px`로 범례~리스트(순수 `mt-7`=28px)와 실제 노출 간격이 같아진다(이전엔 이 숨은 패딩들을 못 빼서 50px로 훨씬 넓어 보였음). `ASSET_THEME_SHOT.summaryValue`(총 주식 평가금액 히어로 숫자)를 `text-3xl`→`text-lg`(평가손익 `profitAmount`와 동일)로 축소했다가, `text-xl`을 거쳐 최종 `text-2xl`로 확정 — SHOT 전용 토큰이라 인증카드 외 영향 없음.
- **전체 금액 표시로 통일(2026-08-08, 6차)**: 상세 > 주식 탭은 `PRICE_DISPLAY_MODE="full-only"`(number-utils.ts)라 금액이 원래 전체 표기(`840,180,000원`)인데, 인증카드는 `maskFn`(항상 `formatShortCurrency` 또는 마스킹 함수)이 `StockSummaryHeader`의 `fmtFull`·`fmt` 둘 다를 덮어써서 요약 헤더가 축약(`8.4억원`)으로 새고 있었다. [share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx)의 `mask` 포매터를 `formatShortCurrency`→`formatCurrency`(전체 금액)로 교체 — 헤더(총 평가금액·평가손익)·종목 리스트·"그 외 N종목" 행 전부 `mask` 하나를 공유해 한 번에 상세 탭과 동일한 전체 금액이 됐다(헤더 전용 `maskFull` 변수는 리스트까지 확장하며 불필요해져 제거, `mask`로 통합).
- **`CARD_WIDTH` 480→460 축소(2026-08-08, 5차)**: 검은 카드 박스(`ShareCard` 루트) 자체의 바깥 폭은 오직 `CARD_WIDTH`(`share-menu.tsx`)로만 결정되고, 헤더·래퍼·푸터의 내부 좌우 패딩(px-2 등)은 그 안쪽 콘텐츠 위치만 조정할 뿐 박스 바깥 폭엔 전혀 영향을 주지 않는다는 점을 확인한 뒤, 사용자 요청으로 `480`→`460`px 축소. `pixelRatio = ceil(1100/460) = 3`(기존과 동일)이라 최종 PNG는 `1440`→`1380`px, 화질 저하 없음. R25(기기 무관 고정폭)는 값이 무엇이든 "고정"이면 충족되므로 위반 아님.
- **좌우 여백 재조정(2026-08-08, 4차)**: 헤더·래퍼·푸터 `px-1`(4px)→`px-2`(8px) — `outer p-3(12)+8=20px`로 세 지점 통일 재확인. 미리보기 컨테이너 패딩은 `px-2`→`px-4`로 재조정 — `outer.clientWidth`(스케일 계산 기준)만 줄여 미리보기 축소율이 살짝 커질 뿐, 캡처 PNG 실제 폭(`CARD_WIDTH=480` 고정, R25)과는 무관.
- **모바일 미리보기 진짜 원인: `ScaledCardPreview`의 flex-shrink 이중 축소(2026-08-08, 3차 — 근본 수정)**: 앞선 두 차례(다이얼로그 폭·컨테이너 패딩·카드 내부 여백 조정)로도 스크린샷상 카드가 여전히 확연히 좁게 보였다 — 원인은 [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx) `ScaledCardPreview`의 `innerRef` div가 `width: 480px` 인라인 스타일만 두고 `flex-shrink`를 지정하지 않은 것. flex item의 `flex-shrink` 초기값은 1이라, 컨테이너가 480px보다 좁은 대부분의 모바일에서 **flexbox가 레이아웃 단계에서 먼저** 이 박스를 컨테이너 폭으로 축소한 뒤, JS가 계산한 `transform: scale(outer.clientWidth/480)`이 **그 위에 다시 곱해져** 이중으로 작아졌다(예: 390px 컨테이너 → 최종 317px, 의도한 폭의 81%). 패딩을 아무리 줄여도 이 배율 자체는 그대로라 개선 폭이 미미했다. `shrink-0`(`flex-shrink:0`) 한 줄 추가로 레이아웃 폭을 항상 480 고정 → `scale`만이 유일한 축소 수단이 되어 컨테이너를 정확히 채운다. 이전 조정(`w-[95vw]`, 카드 내부 `px-1`)은 원인은 아니었지만 방향은 맞아 그대로 유지. 컨테이너 패딩은 `shrink-0` 수정으로 스케일이 꽉 차게 되면서 `px-0`이 카드를 다이얼로그 가장자리에 완전히 붙여버려 `px-2`로 최소 여백만 복원.
- **모바일 미리보기 확대 + 카드 내부 좌우 여백 축소(2026-08-08, 2차 조정)**: 1차 시도(컨테이너 패딩만 축소 + 카드 내부는 오히려 확대 18→22px)가 의도와 반대라 롤백. 24px로 축소한 2차 시도도 여전히 "카드 박스가 화면 중앙에 좌우 여백을 두고 떠 있다"는 피드백을 받아 원인을 재검토 — [share-menu.tsx](../../src/app/(main)/_components/header-menu/share/share-menu.tsx)의 `DialogContent`가 기본 `w-full`(`%` 기반, containing block 의존)이라 실제로는 예상만큼 뷰포트 전체 폭을 못 쓰고 있을 가능성이 있어, `w-[95vw] sm:w-full`로 교체해 뷰포트에 항상 상대적인 `vw` 단위로 모바일에서 확실히 화면의 95%를 쓰도록 명시(`sm:` 이상은 기존 `max-w-[680px]` 그대로). 미리보기 컨테이너 자체 패딩은 `px-0 py-2`(스케일 계산용, 캡처 PNG 무관) 유지. 카드 내부(헤더·범례·리스트·푸터) 좌우 여백은 24px→**16px**로 재축소 — 래퍼(`share-card.tsx`) `py-3.5 px-1`, `StockCategorySection` 내부(`stock-tab.tsx`) `px-0`(변경 없음), 헤더(`detail-summary-header.tsx`) `px-1`, 푸터(`share-card.tsx`) `px-1` — `outer p-3(12)+4=16px`로 세 지점 일치, 세로 28px 간격 계산은 `py-3.5` 불변이라 무영향. 카드 내부 패딩은 R25상 기기별 분기 불가해 저장되는 PNG에도 동일 반영(사용자 승인).
- **헤더 내부 간격 불일치 수정**: "총 주식 평가금액"↔평가손익 간격이 종목 리스트 행의 "금액"↔"손익"(`cardAmountProfitRow`의 `mt-0.5`=2px)보다 2배(`mt-1`=4px) 넓어 눈으로 봐도 차이가 났다 — `screenshotMode`에서만 `mt-0.5`로 맞춤(다른 4개 상세 탭은 `mt-1` 불변).
- **요약 헤더 박스 제거**: [detail-summary-header.tsx](../../src/app/(main)/_components/views/detail/detail-summary-header.tsx) `DetailSummaryHeader`에 `screenshotMode` 분기 추가 — 인증카드는 배경(`ASSET_THEME.primary.bgLight`) 없이 좌우 패딩만 아래 비중 바·리스트 박스(래퍼 `p-3.5` + 내부 `px-1` = 18px)와 정확히 맞춤(`px-[18px]`). 상세 탭(주식/부동산/암호화폐/현금/대출 공통 컴포넌트)은 배경·패딩 불변.
- **R25 대응**: 범례가 쓰던 `grid-cols-2 sm:grid-cols-4`·`text-sm sm:text-base`를 캡처 경로에서 쓰면 뷰포트 반응형이 섞이므로 `ASSET_THEME_SHOT`에 `legendGrid`(`grid-cols-2` 고정)·`legendText`(`text-sm` 고정) 토큰 추가 후 `screenshotMode`에서만 스왑. 주식 탭 렌더는 불변.
- 스키마·저장 키·공유 토큰·API 무변경 — 명세 판정 기준 비해당. `npx tsc --noEmit` 통과(EXIT=0).

### 자산 카드 → "인증카드" 개편: 내용을 주식 기준으로 되돌리고 주식 탭 리스트 이식 (issue-4.22)

- **왜**: 2026-07-27 개편에서 카드를 자산군 통합 랭킹("핵심 자산 Top 8", 색점+비중%+금액 1줄)으로 압축하면서, 상세 > 주식 탭 리스트가 가진 정보 밀도와 색감(로고 아이콘·`N주 · 비중%` 메타·우측 평가금액/손익 2줄·하단 비중 스트립)을 잃었다. 사용자 판단으로 주식 탭 리스트가 더 매력적이라 그 UI를 카드에 그대로 이식하고, 카드 내용도 주식 기준으로만 좁혔다.
- **재사용만으로 구현**: 새 리스트 컴포넌트를 만들지 않고 stock-tab.tsx가 이미 export 해둔 `screenshotMode` 경로(`StockSummaryHeader`/`StockCategorySection`/`StockCard`/`StockRowHeader`)를 부활시켰다 — 7-27 개편 이후 아무 데서도 호출되지 않던 사실상 죽은 코드였다. 데이터도 `useFilteredStockData("all")` + `computeStockMetrics` 단일 출처를 그대로 쓴다(tickerList `.sort()` 내장 → 주식 탭과 캐시 키 공유, 중복 fetch 없음).
- **구조**([share-card.tsx](../../src/app/(main)/_components/header-menu/share/share-card.tsx)): `@닉네임` → `StockSummaryHeader`(총 주식 평가금액 + 평가손익) → 비중 바(상위 4 + 회색 `기타`) → 종목 리스트(상위 4 + `외 N종목 · 비중 X%`) → 푸터. **자산군 "포트폴리오 구성" 섹션과 범례는 완전 제거** — 분포는 가로 박스 하나로만 두고 종목 식별은 아래 리스트가 담당한다. 그 결과 `SHARE_SAFE_PALETTE`(자산군 색 상속 규칙)는 소비처가 사라졌고, 카드 색은 주식 탭과 같은 `assignColors`(`MAIN_PALETTE`)를 쓴다.
- **R25 대응**([theme.ts](../../src/config/theme.ts) `ASSET_THEME_SHOT` 신규): 이식하려는 주식 탭 컴포넌트들이 `sm:`/`lg:`를 써서, 그대로 넣으면 480px 고정폭 캡처에 뷰포트 반응형이 섞여 PC/모바일에서 다른 PNG가 나오는 R25 회귀가 재현된다. `sm:`/`lg:` 값을 데스크톱 값으로 고정한 캡처 전용 토큰 세트를 추가하고 `screenshotMode`일 때만 스왑하도록 했다(`StockIcon`·`StockRowHeader`·`StockCard`·`StockCategorySection`·`DetailSummaryHeader`·`ProfitMetric`). 기존 토큰은 건드리지 않아 일반 모드 렌더는 불변.
- **명칭**: 사용자 노출 문구를 전부 "인증카드"로 통일(share-menu·top-bar·bottom-nav·tutorial-step-config·notice). 파일·식별자(`share-card.tsx`/`ShareCard`/`ShareScreenshotDialog`/`screenshotMode`)는 diff 최소화를 위해 유지하고, 코드 주석의 잔재 "인증샷"만 정리했다. `NOTICE_ID` `20260722`→`20260808` bump + 공지 4번째 카드 본문 교체(`APP_VERSION` 배지 유지).
- 스키마·저장 키·공유 토큰·API 무변경 — 기존 컴포넌트 재구성 + 명칭 변경이라 명세 판정 기준 비해당.
- `npx tsc --noEmit` 통과(EXIT=0), 변경 파일 `eslint` 0 errors(기존 `no-img-element` 경고 1건만 잔존).

## 2026-08-07

### 원인분해: "현금 잔액 직접 수정" 문구를 대출과 동일 패턴으로 통일 (issue-4.22)

- **왜**: 신규 CMA 계좌(86,000,000원)를 추가했더니 성적표에 "현금 잔액 직접 수정으로 8,560만원 늘어난 것으로 추정돼요"로 표시돼 "잔액을 몰래 고쳤다"는 오해를 줬다. 사용자는 다른 자산(주식·코인·부동산·대출)도 `createdAt` 같은 생성시점 필드로 신규 추가를 판별하는지 물었다 — 코드 검증 결과 **넷 다 `createdAt` 필드가 없고**(`purchaseDate`/`startDate`는 예측(레거시) 분기에만 쓰임), 스냅샷 원가·잔액 **델타만으로** 신규 추가를 감지한다(주식 `dCostStock`, 대출 `breakdown.loans` 델타 등). "신규 항목 추가"와 "기존 항목 수정"을 구분하지 않고 같은 라벨(매수/새로 추가한 대출)로 뭉뚱그리는 것이 기존 설계다. `dCostCash`도 감지 방식은 완전히 동일(신고된 8,560만원도 계산 자체는 정확)했고, 유일한 차이는 라벨이 "직접 수정"(편집으로 단정)이라는 단어를 쓴다는 것뿐이었다.
- **수정**([asset-report.ts](../../src/lib/report/asset-report.ts) `causeShortLabel`·`causeSentence`): 스키마 확장(`createdAt` 추가) 없이 대출(`debt`)과 동일한 패턴으로 통일. 대출은 짧은 라벨("대출 상환"/"추가 대출")과 실제 문장("새로 추가한 대출로 ~", `label` 변수 미사용 하드코딩)이 서로 다른 단어를 쓰는 기존 구조가 있었다 — `cash`도 이를 그대로 따라 라벨 `"신규 현금"`/`"현금 정리"`, 문장 `"새로 추가한 현금으로 ~ 늘었어요."`/`"현금 정리로 ~ 줄었어요."`로 교체("(추정)" 헤지·"직접 수정" 단정 제거). 방향은 대출과 반대(대출은 부채라 상환=양수, 현금은 자산이라 증가 자체가 양수라 뒤집을 필요 없음). 계산 로직(금액)은 전혀 손대지 않아 회귀 없음.
- 스키마·저장 키·공유 토큰 무변경 — 순수 문구 수정이라 명세 판정 기준에 해당하지 않는다(작업 중 `createdAt` 스키마 확장안으로 명세 초안까지 작성했으나, 다른 4개 자산과의 일관성 문제로 기각 후 폐기).
- `npx tsc --noEmit`·`npx vitest run`(147건 전부 통과, 회귀 없음)·`npm run lint`(0 errors)·`npm run build` 전부 통과.

## 2026-08-06

### 원인분해: 입력한 적 없는 "주식 매도"가 매수와 쌍으로 뜨던 이중계상 수정 + 백업 정합 가드 + 일별 달력 금액 넘침 (issue-4.22)

- **왜**: "08-05에 매수 기록만 2건 넣었는데 홈 '전일 대비'에 주식 매수 11.8만·주식 매도 11.8만이 같이 뜬다"는 제보. 백업 JSON 대조로 08-05·08-06 스냅샷 `cost.stock`과 현재 보유 원가가 **정확히 117,515원**(= 314250 1주×62,235 + 360200 2주×27,640, 스크린샷 확인) 어긋나는 걸 잡아 원인을 특정했다.
- **근본 원인**([asset-report.ts](../../src/lib/report/asset-report.ts) `reflectedTradeFlow`): 08-05 스냅샷은 거래 **반영 이후**에 저장돼 `cost.stock`에 117,515원이 이미 포함 → `dCostStock = 0`. 그런데 flow 함수가 시작일 당일 거래를 다시 세어 `buyEffect = +117,515`가 되고, 균형을 맞추는 `stockManual = dCostStock − buyEffect = −117,515`가 **"주식 매도"로 둔갑**했다. 두 항이 상쇄돼 **합계 = `deltaNet` 항등식은 유지**되므로 기존 테스트 57건이 전부 통과한 채 살아 있었다.
- **수정**: 주식(`reflectedTradeFlow`)·코인(`reflectedCryptoFlow`)만 `t.date < fromDate` → **`t.date <= fromDate`**(시작일 당일 제외). 현금(`reflectedCashInflow`)·대출(`reflectedLoanFlow`)은 **그대로 둔다** — 2026-08 P1(소급 기록한 입출금이 무관한 `cash` 잔차로 증발)이 되살아나기 때문. **경계가 자산군마다 다른 것은 의도된 비대칭**이다: `income`/`debt`는 독립 항이라 누락되면 잔차로 새지만, `buy`/`sell`은 원가 diff에서 차감되는 값이라 포함하면 반드시 이중계상된다. 주식에서 제외해도 누락되지 않는다 — 스냅샷 저장 **후** 소급 반영한 거래는 원가가 올라가 `stockManual`이 같은 부호로 잡아 "주식 매수"로 표시된다. 세 함수 주석에 근거를 남기고 R29로 회귀 고정.
- **백업 정합 가드**([asset-storage.ts](../../src/lib/asset/asset-storage.ts) `isExportDataStale` 신설): 조사 중 받은 첫 백업이 **25분 전(08-04) 상태**였다 — 백업은 localStorage(`getAssetData`)를 뜨는데 화면은 React state를 렌더하고, 같은 탭 pull은 `storage` 이벤트를 발화시키지 않아(브라우저 표준) 둘이 잠시 갈라진다. 같은 파일 안에서 **스냅샷은 최신인데 `assetData`만 과거**인 게 결정적 증거(스냅샷은 `saveSnapshots(latestData)`가 state를 받아 계산). 재백업에서 정상 복구돼 영구 유실은 없었으나, 그 파일로 복원했다면 유실이었다. → `exportAssetData(currentData?)`가 항목 **건수**(자산 5종+거래 4종, 파생필드 제외로 오탐 방지) 불일치 시 다운로드를 중단하고 `EXPORT_STALE_MSG` 안내. **근본 원인(어느 경로가 localStorage를 되돌리는지)은 미추적** — 경합 버그라 계측 없이 패치하면 두더지잡기가 된다(R30에 재발 시 계측 절차 기록).
- **일별 달력 금액 넘침**([net-asset-chart.tsx](../../src/app/(main)/_components/views/activity/net-asset-chart.tsx)): 모바일 셀 텍스트 가용폭이 **42.6px**(`(390−24−gap12)/7 − p-1 8`)인데 `text-sm`에서 `+3,433`이 약 42.4px라 옆 칸을 침범했다(1,000만~9,999만원 대역, 순자산도 100억 넘으면 동일). 표기 체계를 바꾸는 대안(억 소수 전환=해상도 손실, 콤마 제거=앱 전체와 불일치)보다 대가가 작아 **`text-xs sm:text-sm`** + `tabular-nums`(규약상 원래 필수였는데 누락) + 셀 `overflow-hidden`으로 처리. `whitespace-nowrap`은 넣지 않음(단위가 둘째 줄로 wrap되는 2줄 레이아웃이라 한 줄로 묶으면 오히려 확실히 넘친다). design-system §타이포 `text-xs` 예외 목록에 등록.
- **하이브리드 구간 경계 이중계상 수정(위 수정 직후 QA에서 발견)**: `computePeriodAttribution`이 `[prevOld,mid]`+`(mid,curr]`로 쪼갠 뒤 `mergeAttributions`가 key별로 합산하는데, `reflectedCashInflow`가 **양쪽 구간 모두 시작일 당일을 포함**해 `mid` 당일 거래가 두 번 잡혔다 — **`income`이 2배가 되고 반대급부로 사용자가 한 적 없는 "현금 잔액 감소(추정)"가 같은 금액으로 표시**(주식 버그와 정확히 같은 형태). 현금 입출금 기본 날짜가 "오늘"이고 `mid`는 앱을 연 날의 daily 스냅샷이라 일상적으로 겹친다. 합계 = `deltaNet`은 유지돼(income +2배, cash −1배 상쇄) 기존 테스트 전부 통과한 채 살아 있었다. → 4종 flow 함수의 경계 판정을 **`inFlowWindow` 단일 헬퍼**로 통일하고, `resolveAttribution`에 `isFirstSegment`(기본 `true`)를 추가해 **현금·대출의 "시작일 당일 포함"을 전체 기간 첫 구간에만** 적용. 두 구간의 합집합 = `[prevOld, curr]`, 교집합 = 공집합. `detectCashRoundTrip`의 `incomeToDate`도 같은 경계를 쓰도록 맞춤(`netCashEffect`와 기준 일치, 안 맞추면 `cashRoundTrip` 오탐 회귀). R29를 이 3중 조건으로 확장.
- 신규 회귀 테스트 6건(경계일 이중계상·소급 반영 1회 계상·코인 동형 + mid 당일 현금/주식 중복 방지·전체 시작일 당일 income 보존), 전체 **147건** 통과. 두 수정 모두 되돌려 해당 테스트가 실제로 실패하는 것까지 확인. `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors)·`npm run build`(22개 라우트) 전부 통과.

## 2026-08-04 (4)

### 기기 동기화 데이터 손실 원천 차단 + 순자산 왜 현금/대출 완전 분리 (issue-4.21)

- **왜(동기화)**: "A기기에서 추가한 현금 자산이 B기기 접속 후 사라진다"는 재발 제보. 클라이언트의 pull-first 순서(마운트·연결·잠금해제)는 이미 있었으나, 심층 점검에서 **더 넓은 두 구멍**을 확인했다. ① 서버 `/api/sync` PUT의 버전 체크가 `getAssetEnvelope`→비교→`setAssetEnvelope`의 read-then-write라, 두 기기가 거의 동시에 push하면 둘 다 체크를 통과해(TOCTOU) 나중 쓰기가 먼저 쓰기를 조용히 지웠다(lost update — 어느 쪽도 409를 못 받음). ② 409 충돌 복구가 pull로 로컬을 통째로 교체할 뿐 **push하려던 로컬 편집을 재병합·재전송하지 않아**, 정상적인 멀티기기 사용에서 "막 추가한 자산"이 구조적으로 반복 소실됐다(같은 원인이 멀티탭·마운트 pull 창에서도 발생).
- **원자적 CAS**([cache-storage.ts](../../src/lib/cache-storage.ts) `compareAndSetAssetEnvelope` 신설, [route.ts](../../src/app/api/sync/route.ts)): 버전 비교+저장을 단일 원자 연산으로. Upstash는 Lua 스크립트(`redis.eval`)로 GET→비교→SET을 Redis 내부에서 처리(Lua는 항상 원자적), 로컬 `FileCacheStorage`는 중간 `await` 없는 동기 fs 호출로 같은 보장. pubKey 교체 불가(403)만 원자성 밖 사전 체크로 유지.
- **기준점(syncedIds) 병합**([asset-storage.ts](../../src/lib/asset/asset-storage.ts) `reconcileAdditiveMerge`·`collectAssetIds`, [sync-state.ts](../../src/lib/cloud-sync/sync-state.ts) `syncedIds`): pull이 덮어쓰기 직전 로컬을 읽어 **원격에 없는 로컬 항목 중 "아직 서버에 올라간 적 없는 것"만 되살린다**. 되살린 게 있으면 `runPull`이 `lastPushedRef=null`로 파생값 비교를 건너뛰고 즉시 재-push해 서버에도 반영. 같은 id를 양쪽이 다르게 수정한 진짜 충돌은 원격 우선으로 남김(과설계 회피).
  - **기준점이 없으면 삭제가 부활한다(작업 중 발견·수정한 P0)**: 삭제가 tombstone 없이 배열 제거라 "로컬에 있고 원격에 없다"가 *신규 추가*와 *원격 삭제* 두 의미를 갖는다. 최초 구현은 이를 무조건 신규로 해석해, A가 지운 자산을 B가 pull하며 되살리고 그 결과를 재-push → A에서도 부활 → "지웠는데 1분 뒤 다시 나타남"이 무한 반복되어 다기기 삭제가 무력화됐다. **CAS로는 못 막는다** — CAS는 쓰기 순서만 통제하고, B는 최신을 정상 수신한 뒤 baseVersion도 최신이라 CAS 관점에선 완벽히 정당한 요청이었다. `syncedIds`(마지막으로 서버와 맞춰진 항목 키)를 기준점으로 두어 *기준점에 없음=신규 보존 / 있음=원격 삭제 존중*으로 판별.
  - 기준점 갱신 시점이 함정 — pull은 **병합 전 원격 키**로 갱신해야 한다(병합으로 살려둔 신규분까지 넣으면 그게 올라가기 전에 다음 pull이 "삭제됨"으로 오판해 스스로 지운다). push는 push한 키로 갱신. `forgetRemembered`도 `syncedIds` 보존.
  - `connect`(다른 금고 채택)는 `pullAsset(..., { merge: false })`로 원격 완전 대체 — 로컬 잔여 자산을 남의 금고에 섞지 않는다(F-CLOUD-SYNC S2 "자산 동일"). `unlock`(같은 금고)은 병합.
- **온라인 복귀 pull-first**([cloud-sync-provider.tsx](../../src/lib/cloud-sync/cloud-sync-provider.tsx)): armed 폴링 effect에 `window "online"` 리스너 추가(force pull). 없으면 오프라인 중 쌓인 디바운스 push가 다음 폴링(최대 60초)보다 먼저 나가 충돌 경로로 들어갔다.
- **왜(현금/대출)**: 자산성적표 "순자산 왜?"에서 신규 현금 자산이 "대출" 섹션에 표시되고 금액도 다르게 읽힌다는 제보. `groupAttributionItems`의 "이 기간에 `debt`가 하나라도 있으면 `cash`를 대출 그룹으로 강제 편입"(2026-08 설계)이 금액·연관성과 무관하게 트리거된 게 원인 — 8600만원 신규 현금과 전혀 무관한 소액 대출 변동이 같은 주에 겹쳤다는 이유만으로 끌려갔다. **병합 규칙을 완전히 제거해 현금·대출을 항상 각자 그룹으로 분리.** `dCostCash`는 원래도 `loans`를 참조하지 않아 금액은 정확했음을 회귀 테스트로 확정(금액 차이는 두 줄이 한 박스에 나란히 표시되며 생긴 시각적 오독).
- 신규 테스트 16건(CAS 4·기준점 병합 11·현금대출 분리 회귀 1 + 기존 2건 갱신), 전체 141건 통과. R28 회귀 항목 신설(원자성·기준점·갱신 시점·online 리스너 5개 조건). `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors)·`npm run build` 전부 통과.

## 2026-08-04 (3)

### 암호화폐 종합 카드 매수/매도 버튼 중복 노출 수정 + 상세탭 공통 규칙 명문화 (issue-4.21)

- **왜**: 거래소가 1개만 지정된 코인은 종합 카드(`CryptoCard`)와 거래소별 하위 카드(`SubCryptoCard`) 양쪽에 동일 코인의 "매수/매도 기록·내역" 버튼이 중복 노출됐다(사용자 점검 요청으로 발견). 주식(`StockCard`)은 거래입력 노출 조건이 `!hasSubItems` 하나뿐인데, 암호화폐는 "병합 대표 id 편집 불가" 판단용 조건(`effectiveGroupItems.length > 1`)을 거래입력 노출에도 잘못 재사용해 두 자산의 기준이 벌어졌던 것이 원인.
- **수정**: [crypto-tab.tsx:166](../../src/app/(main)/_components/views/detail/tabs/crypto-tab.tsx)의 `CryptoCard` 거래입력 행 노출 조건을 `!(hasSubItems && effectiveGroupItems.length > 1)`→`!hasSubItems`로 변경, 주식과 완전히 동일한 규칙으로 통일. 수정 버튼 disabled 조건(`effectiveGroupItems.length > 1`)은 의미가 다르므로 그대로 유지.
- **KB 반영**: `qa-full-test-plan.md` F-ASSET에 "하위 항목 보유 자산의 거래입력 노출 규칙(필수)" 명문화, F-STOCK·F-CRYPTO-TX 상호 참조 추가. `dev-rules.md`에 "자산 상세탭 공통 적용 판단 체크리스트" 신설 — 앞으로 5탭(현금·암호화폐·주식·부동산·대출) 중 하나라도 수정 시 하위 항목(증권사·거래소) 이슈면 주식+암호화폐 동시 수정, 그 외 공통 이슈면 5탭 전체 검토를 강제.
- `npx tsc --noEmit`·`npx vitest run`(125건 통과)·`npm run lint`(0 errors, 기존 warning 외 신규 없음)·`npm run build` 전부 통과(QA 완료).

## 2026-08-04 (2)

### 암호화폐 매수/매도 거래내역 신설 (issue-4.21, S-4.25)

- **왜**: `crypto[]`는 `quantity`·`averagePrice`(잔고 스냅샷)만 있고 거래 이력이 없었다 — 주식(`transactions`)·현금(`cashTransactions`)·대출(`loanTransactions`)은 이미 갖춘 기능이 코인만 빠져 있었고, 원인분해의 `buy:crypto`/`sell:crypto`도 실제 거래가 아니라 스냅샷 원가 델타 추정치였다. "자산업데이트" 플로팅 버튼에도 현금·대출은 기록 액션이 있는데 코인만 진입로가 없었다(사용자 제보).
- **계산 엔진 재사용**: [trade-utils.ts](../../src/lib/trade/trade-utils.ts)의 가중평균 재계산 함수 5개(`computeNewPosition`·`recomputeFromLog`·`reverseTransaction`·`deriveBaseSnapshot`·`rollbackTransaction`)와 `pruneTransactions`·`findDuplicateTransaction`, `validate-reflection.ts`를 `TxLike`/`PositionLike` 구조적 타입으로 일반화해 주식 코드를 복제하지 않고 코인에도 재사용(현금·대출의 잔액 선형 가감과 달리 코인은 매수 시 평단이 바뀌므로 계산 구조가 주식과 동일).
- **진입 동선 통일**: `floating-add-button.tsx`의 "자산업데이트" 플로우에 현금 "입출금 기록"·대출 "상환/대출 기록"과 동일 위치·패턴으로 코인 "매수/매도 기록" 액션 추가([asset-dispatch.ts](../../src/app/(main)/_components/layout/navigation/asset-dispatch.ts) `dispatchAddCryptoTx`). 코인 상세 탭 카드에도 기록/내역 버튼 추가(병합 카드는 거래소 분할 보유 시 합성 id라 비활성화, 거래소별 하위 카드에서 개별 기록).
- **신규**: [types/transaction.ts](../../src/types/transaction.ts) `cryptoTransactionSchema`(주식 `transactionSchema`에서 통화·환율·수수료 필드 제거), `assetData.cryptoTransactions[]`, [crypto-tx-input.tsx](../../src/app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx)·[crypto-tx-view.tsx](../../src/app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx)(`crypto-transactions` 탭), `asset-data-context` CRUD 4종(단일 저장, R4 대칭).
- **원인분해 정확화**([asset-report.ts](../../src/lib/report/asset-report.ts)): `reflectedCryptoFlow` 신설로 `buy:crypto`/`sell:crypto`를 실제 반영 거래 기반으로 계산(정밀·예측 분기 모두). `estimatePeriodInflows`에 `tradedCryptoIds` 추가해 반영 거래 있는 코인을 매수일 추정에서 제외(이중계산 방지, `tradedStockIds` 패턴).
- **공유 토큰**: packV7 `parts[14]`에 코인 거래내역 섹션을 꼬리로 추가(`crIdx`로 부모 코인 참조). 꼬리 추가라 구버전 토큰 호환(R3).
- 명세 [S-4.25](../specs/4.25-crypto-transactions.md) 역작성. 신규 테스트 4건(trade-utils 코인 재사용 2건, asset-report buy:crypto 정확화·이중계산 방지 2건), 전체 122건 통과. `npx tsc --noEmit`·`npx vitest run`·`npm run lint`(0 errors, 기존 warning 외 신규 없음)·`npm run build` 전부 통과(QA 완료).

