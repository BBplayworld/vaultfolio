# D 발굴 근거 — developer (코드 관점, main 72bc9ec v5.114, 읽기 전용)

## 후보 (줄이기·고치기 우선)
1. **배당 차트 JPY 미환산 (버그, 데이터 표시 오류)** — `views/activity/dividend-chart.tsx:123` `rate = stock.currency === "USD" ? usdRate : 1`. 스키마는 JPY 허용(`types/asset.ts:49`). 재현: 통화 JPY 해외 종목 + 배당 있음 → 월별 배당이 엔 수치 그대로 원화로 합산(약 1/9 과소). 영향: JPY 보유자 한정(소수)이나 금액 틀림. 수정 3줄 + 단위 테스트(exchangeRates.JPY 단위: 테스트 픽스처에 900과 9가 혼재 — 기준값 확인 필요). risk:low.
2. **1회용 링크 소진·만료 구분 없음 (C107)** — `api/share/route.ts:56-66` GET이 조회 즉시 삭제(takeOnce) 후 404, 클라이언트는 만료·소진·오류 전부 `asset-data-context.tsx:999` `/invalid-access`로 이동. 링크 미리보기·인앱 브라우저가 먼저 열면 소진돼 사용자는 이유를 모름(in-app-browser-gate 안내와 연결). 수정: 404 시 '이미 사용했거나 1시간이 지났어요, 다시 전달' 안내 문구만(서버 전송값 증가 0, 스키마 0). risk:low~medium(보안 문구 포함이면 COO 판정).
3. **VAPID 키 변경 자동 재구독 없음** — `lib/push/client.ts:156-158` reconcilePush가 기존 구독이 있으면 키 무관하게 서버 갱신만. 키 교체 시 구 구독은 발송 실패(만료 정리)되고 사용자는 알림을 껐다 켜야 함. 수정: `existing.options.applicationServerKey`와 현재 키 비교 → 다르면 unsubscribe 후 재구독(10줄 + 테스트). 현재 키 교체 계획 없으면 p3.
4. **세금 마감일 주말 이월 없음** — `config/tax-calendar.ts`는 month + `dueLabel` 문자열("~7/25")뿐, 요일 보정 로직 없음(grep 0건). 2026 부가세 1기 7/25 토 → 7/27 실제 마감. 푸시 세금 알림도 동일 원천. 반면 주식 쪽 `finance/kr-holidays.ts`에 휴일 롤백 유틸이 이미 있어 재사용 가능(공휴일 포함 이월). 영향: 마감일 오해(앞당겨 안내는 안전 방향이라 급하진 않음). 12/16 전 처리 권장 시 2027 일정 기준.

## 알려진 후속 상태
- 5.114 O1: **미반영**. `monthly-dividend-stocks.tsx:201·219` 그리드 `sm:grid-cols-[...11.5rem...]`, 224·226 `hidden sm:inline` — 640~767px(큰 폰 가로·소형 태블릿)에서 종목 열이 데스크톱 폭으로 전환. `sm:`→`md:` 치환 4곳(파일 7곳 중 해당), 영향 작음.
- 차트 SVG 글자: 하드코딩 `fontSize` 잔존 — `dividend-chart.tsx:68`(12), `detail/price-axis-layer.tsx:53-67`(10·11), `stock-page/price-chart.tsx:112-158`(11). 5.114 타입 스케일 미적용, 10px는 접근성 하한 미달 가능. viewBox 스케일에 따라 실표시 크기가 달라 디자이너 판단 필요.
- C107/세금 이월/VAPID/JPY: 위 1~4번과 동일, 모두 미구현.

## 권고 묶음
1+3+O1은 서로 독립·소규모(합쳐도 저위험, 스키마·서버 전송 0). 2는 문구 판정 필요 시 단독. 추가 확인 필요: JPY 환율 단위(900 vs 9).
