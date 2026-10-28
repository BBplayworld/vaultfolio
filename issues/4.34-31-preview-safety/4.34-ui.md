# #31 preview 안전장치·데모 데이터 — UI (ui.md)

기준: 375px 모바일, design-system.md(색 토큰·4px 그리드·shadow 우선·최소 히트영역 40px). 운영 컴포넌트(`WelcomeGuide`, `top-bar.tsx`)는 수정하지 않는다. 모든 UI는 preview 전용 컴포넌트 1개(`PreviewTools`, 루트 레이아웃에서 `isPreviewEnv()`일 때만 동적 import)가 그린다. production·로컬은 DOM 0.

## 1. PREVIEW 배지
- 위치: `fixed top-0 left-1/2 -translate-x-1/2`, 레이아웃 흐름 밖이라 아무것도 밀지 않는다. `pointer-events-none select-none`이라 클릭을 가로채지 않는다.
- 크기: 높이 20px(`h-5`), 가로 `px-2`, 하단만 둥글게 `rounded-b-md`. 한 줄(`whitespace-nowrap`), 375px에서 약 110px 폭.
- 토큰: `bg-muted text-muted-foreground shadow-sm`, `text-xs font-medium tabular-nums`(좁은 배지 예외 범위, §2). 주황(`important`)은 순자산 강조와 혼동되어 쓰지 않는다. 테두리 없음.
- 가림 방지: 상단 바(`h-12`, 아이콘 버튼 `h-10`이 y=4~44px)는 좌측 로고/제목, 우측 아이콘이고 중앙이 비어 있다. 배지는 중앙 상단 20px만 차지하고 클릭은 통과한다. 제목이 길어 중앙까지 오는 상세 화면은 배지가 제목 윗부분을 살짝 덮을 수 있어 qa가 375px 스크린샷으로 확인한다(겹침 시 `top-0` 유지, 폭 축소 대신 배지를 `opacity-90`).
- z-index: 다이얼로그·시트(`z-[10001]`) 아래인 `z-[10000]`. 모달 안에서는 오버레이에 가려져도 된다.
- 속성: `data-testid="preview-badge"`, `data-screenshot-hide`, `aria-hidden="true"`(보조기술에 소음 방지). 문구: `PREVIEW · v4.NN`(`APP_VERSION`).

## 2. 데모/빈 상태 선택 버튼
- 노출 조건: preview이고 자산 5종이 모두 0건(= 웰컴 노출)이며 `?demo` 처리 중이 아닐 때만. 자산이 생기면 사라진다.
- 선택 후 미노출: 버튼을 한 번 선택하면 그 페이지 수명 동안 카드를 다시 보이지 않는다(메모리 상태, 새 저장 키 없음). 새로고침하면 자산 0건일 때 카드가 다시 나올 수 있으며 이는 허용한다.
- qa의 빈 상태 진입은 `?demo=empty`로 고정한다(카드·버튼에 의존하지 않음). 카드는 사람이 직접 열 때용이다.
- 카드가 웰컴 하단 조작 요소를 가리는 문제는 위 조건으로 완화한다(선택 전에는 가려질 수 있음).

반영 완료
- 위치: 웰컴 화면을 수정하지 않기 위해 `PreviewTools`가 `fixed inset-x-0 bottom-0` 하단 시트형 카드로 띄운다. 카드: `mx-3 mb-3 rounded-xl bg-card p-3 shadow-sm`, `pb-[max(0.75rem,env(safe-area-inset-bottom))]`, `z-[10000]`. 웰컴 본문은 스크롤되며 가려지는 만큼 본문 끝에 `pb` 스페이서를 두지 않고 카드 높이(약 120px)를 감수한다.
- 구성(위→아래): 안내 한 줄(`text-sm text-muted-foreground`), 버튼 2개 `grid grid-cols-2 gap-3`.
  - `preview-demo-btn` `Button variant="brand"`, `min-h-10`(40px 이상), 문구 `데모 데이터로 보기`
  - `preview-empty-btn` `Button variant="outline"`, `min-h-10`, 문구 `빈 상태로 보기`
- press `active:scale-[0.96]`, `transition: all` 금지(기본 Button 규약 사용). 375px에서 버튼 폭 약 160px이라 문구는 한 줄(`break-keep`).
- 카드도 `data-screenshot-hide`.

## 3. 상태
| 상태 | 표시 |
|---|---|
| 기본 | 버튼 2개 활성 |
| 주입 중 | 탭한 버튼에 `Loader2` 스핀 + 두 버튼 `disabled`, 문구 `데이터를 불러오는 중이에요`. `?demo` 쿼리 자동 진입도 같은 카드를 잠깐 보인다 |
| 완료 | 카드 즉시 제거(웰컴 또는 홈이 보임), `html[data-demo-ready="1"]` 설정. 토스트 없음 |
| 실패 | 카드 유지, 안내 `text-destructive` `데이터를 불러오지 못했어요. 다시 시도해 주세요`, 버튼 재활성. 기존 데이터 유지, `demoReady` 미설정 |
| 빈 상태 완료 | 웰컴 화면 + 카드 제거, `demoReady="1"` |
| 동기화 안내 | preview에서는 연결/켜기 진입점이 `isCloudSyncEnabled()` false로 숨겨진다. 별도 UI 추가 없음(요청 0건 보증이 목적) |

## 4. 문구(존댓말)
- 배지: `PREVIEW · v4.NN`
- 카드 안내: `미리보기 환경이에요. 점검할 상태를 골라 주세요.`
- 버튼: `데모 데이터로 보기` / `빈 상태로 보기`
- 로딩: `데이터를 불러오는 중이에요`
- 실패: `데이터를 불러오지 못했어요. 다시 시도해 주세요`
- 투자 조언·금액 문구 없음. 데모 닉네임은 `데모`.

## 5. 고정 셀렉터(qa 계약)
`[data-testid="preview-badge"]`, `[data-testid="preview-demo-btn"]`, `[data-testid="preview-empty-btn"]`, `html[data-demo-ready="1"]`(`document.documentElement.dataset.demoReady`). 이름은 spec 4~7장과 동일하며 변경하지 않는다.

## 6. 접근성
- 버튼 히트영역 40px 이상, 터치 간격 12px(`gap-3`). 버튼은 텍스트 라벨이 있어 `aria-label` 불필요, 로딩 중 `aria-busy`.
- 실패 문구는 `role="alert"`. 배지는 장식이라 `aria-hidden`.
- 라이트/다크 모두 토큰만 사용해 대비 유지(`text-muted-foreground`에 추가 투명도 금지).
- `prefers-reduced-motion`: 카드 진입은 `motion-safe:animate-in fade-in`만, 스피너 외 모션 없음.

## 7. 공유 이미지·스크린샷
- 배지와 카드 모두 `data-screenshot-hide`. 공유 이미지(`share-menu.tsx`)는 화면 밖 인스턴스를 캡처해 애초에 포함되지 않지만 원칙에 따라 속성을 단다. qa 스크린샷에서 가리려면 `[data-screenshot-hide]{visibility:hidden}` 주입으로 일관 처리.

## 8. 재사용
신규 토큰·디자인 규약 없음. `Button`, `Loader2`, `bg-card/bg-muted/shadow-sm/text-muted-foreground` 기존 토큰만 사용. 신규 공용 컴포넌트 등록 대상 아님(preview 전용).

## 교차 검토 (developer)
코드로 확인했다. 구현 가능하고 기존 토큰만 쓴다(`bg-muted`·`text-muted-foreground`·`bg-card`·`shadow-sm`·`Button variant="brand"` button.tsx:24). z-index는 `Z_LAYER`(config/theme.ts:189) 기준으로 nav 50보다 위, modal 10001보다 아래이고, 인앱 게이트 10100과 잠금 10200 아래라 배지가 가려지는 것은 의도와 맞다. 구현할 때는 상수 `Z_LAYER.modal - 1`로 쓴다.
- 긴 제목 겹침: `top-bar.tsx`의 뒤로가기 제목은 좌측 정렬 `truncate`(text-lg, 28px 줄)이고 헤더는 `mt-1 h-12`라 글자 영역이 y≈14~42px다. 375px에서 우측 아이콘 2개를 빼면 제목이 중앙(187px)을 넘을 수 있어, 배지(0~20px)와는 글자 윗부분 약 6px만 겹친다. `pointer-events-none`이라 조작에는 영향이 없다. `opacity-90` 대체안대로 수용한다. 웰컴 화면에서는 TopBar가 `null`이라 겹침이 없다.
- 마운트 위치: "루트 레이아웃"은 그대로 둔다. 다만 `?demo` 주입은 `AssetDataProvider`보다 먼저 끝나야 컨텍스트 연동 코드 없이 반영된다(tech-review 5-1). 그래서 게이트는 provider 바깥(루트 또는 `(main)/layout.tsx` 최상단)에 두고, 주입 중에는 children 렌더를 보류한다. ui 동작은 바뀌지 않는다.
- 수정 요청 1건(2장 노출 조건): 웰컴은 일반 스크롤 흐름(welcome-guide.tsx에 fixed·spacer 없음)이라 하단 카드(약 120px)가 웰컴 맨 아래 조작 요소를 끝까지 스크롤해도 가린다. 지금 조건("자산 0건이고 `?demo` 처리 중이 아님")이면 `?demo=empty`를 한 뒤 새로고침하거나 다시 들어올 때 카드가 다시 떠서 빈 상태 점검(#33 등)을 방해한다. 조건에 "**`?demo=empty` 처리 직후의 페이지와 버튼 선택 후에는 그 페이지 수명 동안 카드를 띄우지 않는다**(메모리 상태, 새 저장 키 없음)"를 추가해 주기 바란다. qa는 빈 상태 점검을 항상 `?demo=empty`로 진입한다고 5장에 한 줄 적어 주면 된다.

수정 요청 (위 1건 반영 시 developer 승인)

반영 확인(2장 15·16줄). `?demo=empty` 처리 직후에도 같은 메모리 플래그를 적용한다(3장 "빈 상태 완료: 카드 제거"와 일치).

developer 승인
