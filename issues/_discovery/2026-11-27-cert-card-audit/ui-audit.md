# 인증카드 레이어 UI·색상 점검 (2026-11-27, ui-designer)

- 기준: main `37fa9c4`([#5.171] 커밋, changelog상 5.173 내용 포함) · 기준 문서 `design-system.md` §1·§3·§6·§7
- 방법: `git archive` → 스크래치 빌드(`next build --webpack`) → `next start` 로컬 → `/?trial=1` 데모 데이터 → Playwright(chromium) 320·360·375·390·440·1280 × 라이트·다크 × 3종(투자 유형·주식 현황·포트폴리오). 저장 PNG는 375·1280에서 실제 `저장` 다운로드로 받음. 운영·preview 요청 0.
- 범위: 진입점(상단 바 `top-bar.tsx:68`, PWA 허브 `hub-share-button.tsx`, 홈 팁 `dispatchOpenShareCard`) → 오버레이(`dialog.tsx:41`) → 다이얼로그 셸(`share-menu.tsx`) → 카드 본체 프리뷰(`share-card.tsx` responsive) → 캡처 인스턴스(680px, `share-card.tsx` !responsive) → 저장 PNG.
- 환경 제한: 샌드박스에서 `/api/logo`가 404라 종목 로고는 전부 이니셜 폴백 상태로 찍힘(운영과 다름).

## 결함 (심각도순)

| # | 심각도 | 위치 | 증상 | 폭·테마 | 수정안 |
|---|---|---|---|---|---|
| 1 | p1 | `share-menu.tsx:349-401` (제어 바 1줄 `flex justify-between`, 다이얼로그 `overflow-x-hidden` :331) | 타입 선택(3칸)+복사+`저장` 최소 폭 324px가 셸 안쪽 폭보다 커서 **brand `저장` 버튼이 오른쪽에서 잘림**. 320: 버튼 283~349px 중 셸 끝 308 → 41px 가려져 아이콘만 일부 보임(글자 `저장` 안 보임). 360: 1~2px 잘리고 오른쪽 여백 0. 375 이상 정상 | 320·340·360, 양 테마 (`stock-dark-320.png`, `type-light-360.png`) | 375 미만에서 제어 바를 2줄로(`flex-wrap`, 타입 선택 1줄·버튼 다음 줄 오른쪽 정렬) 또는 타입 선택에 `min-w-0` + 버튼 묶음 `shrink-0` 유지하고 360 미만은 `저장` 라벨 숨김(아이콘+aria-label). 검수: 320에서 `저장` rect.right ≤ 셸 right − 12 |
| 2 | p2 | `stock-tab.tsx:1031`(주식 현황 범례 %) · `portfolio-sector-bar.tsx:42`(분야·보유 유형 범례 %) · `portfolio-ring-card.tsx:574`(도넛 라벨 %) | 범례 비중% 글자를 팔레트 색 그대로 칠함. **라이트에서 10색 전부 WCAG AA(4.5:1) 미달**: 프리뷰 배경 #F0F2F4 대비 1.76(라임)~3.53(퍼플), 저장 PNG 흰 배경 대비 1.98~3.96. 데모에서 실제 노출된 에메랄드 15.2%(2.19)·시안 6.5%(2.40)·오렌지 10.2%(2.60)가 특히 흐림. 다크는 4.0~10.6으로 통과(인디고 on 팝오버 4.02만 경계) | 전 폭, 라이트 (`stock-light-375.png`, `export-portfolio-light-375.png`) | % 글자는 `text-foreground font-bold tabular-nums`로 두고 색은 점·막대만 담당. 색을 유지해야 하면 라이트만 `darkenColor(color, ~0.35)`로 4.5:1 이상 확보(다크 불변). design-system §1.3 "라이트에서 문제되면 2색만 조정" 문구도 실측(10색 전부 미달)으로 갱신 필요 |
| 3 | p2 | `share-card.tsx:458` (투자 유형 해시태그 쪽지 `color: pickOnColor(bg)`) | `pickOnColor`(휘도 0.45 컷)가 에메랄드·시안·오렌지·라임·앰버 위에 흰 글자를 골라 대비 2.0~2.6:1(AA 미달). 저장 PNG에 그대로 박힘(`#월가산책러` 에메랄드, `#원화파` 시안, `#잡식성투자자` 오렌지) | 전 폭, 양 테마·PNG (`export-type-light-375.png`) | 같은 파일에 이미 있는 `pickDonutLabelColor`(흰/검정 중 대비 큰 쪽, theme.ts:275)로 교체. 에메랄드 9.6·시안 8.8·오렌지 8.1:1 |
| 4 | p2 | `share-menu.tsx:350-356`(InlineSelector `size="sm"`), `:364`·`:376`(복사/저장 아이콘 `h-8 w-8`), `:387`(`저장` `h-8`), `:405-411`(Switch `scale-75`) | 히트영역 40px 미달: 타입 칸 63~72×**24**, 복사 **32×32**, 저장 66×**32**, 금액 표시 스위치 **24×14**(라벨 `text-xs` 클릭 포함해도 높이 ~16). 대표 기능의 1차 선택·주요 액션이 다이얼로그에서 가장 작은 타깃 | 전 폭 | 타입 선택은 `InlineSelector` 기본/`md`(min-h 40) 또는 `fullWidth`(칸 `min-h-10`, §5 탭 규약), 아이콘 버튼 `size-10`(또는 `after:-inset-1`), `저장` `h-10`, 스위치 `scale-75` 제거 + 행 전체 `min-h-10` 라벨 히트. 닫기 X는 20px+`after:-inset-2.5`=40 통과, 진입 버튼 40×40 brand 통과 |
| 5 | p2 (공용) | `components/ui/dialog.tsx:67` (`onOpenAutoFocus` 기본 `preventDefault`) | 다이얼로그가 열려도 포커스가 진입 버튼에 남고, Tab이 **오버레이 뒤 홈 화면 요소**(`내 자산으로 시작`, `변동 원인 펼치기`, 탭 칸…)로 이동. 키보드 사용자는 인증카드 제어에 도달 못 함. 모든 Dialog 공통 | 375 라이트 실측(`focus-light-375.png`) | 인증카드는 `onOpenAutoFocus`로 타입 선택 활성 칸(또는 콘텐츠 자체 `tabIndex=-1`)에 포커스. 공용 기본값 변경은 영향 범위가 커서 별도 과제로 cto 판정 |
| 6 | p3 | `share-menu.tsx:334`(제목 아이콘 `text-primary`), `share-card.tsx:395-396`(유형 부제 칩 `bg-primary/10 text-primary`), `switch.tsx:16`(checked `bg-primary`) | `--primary`는 brand가 아님: 라이트 `oklch(.585 .233 277)` 선명한 보라, 다크 `oklch(.704 .04 256)` 회청색. 같은 제어 바에서 스위치(보라)·`저장`(brand #5b6fbf)·제목 아이콘 색이 다르고, 부제 칩은 라이트=보라/다크=회색으로 테마마다 색상이 바뀜. 저장 PNG(라이트)에도 보라 칩이 남음 | 전 폭, 양 테마 | 아이콘·칩 `text-brand`/`bg-brand/10`(§1.2 brand=선택·강조 액션). 스위치는 CLAUDE.md "체크 컨트롤 brand 통일" 취지대로 `data-[state=checked]:bg-brand` — 공용 컴포넌트라 사용처 1곳(이 파일)뿐임을 확인함 |
| 7 | p3 | `share-menu.tsx:331`(DialogContent `transition-all`), `stock-tab.tsx:1017·1021·862·112`(비중 바 `transition-all`) | §6 `transition: all` 금지 위반 | — | 셸은 전환 불필요 → 제거. 바는 `motion-safe:transition-[width]` |
| 8 | p3 | `stock-tab.tsx:1008`(`ETC_COLOR = "#9ca3af"`), `share-card.tsx:47`(`TAG_PIN_COLOR = "#FF5A5A"`) | 하드코딩 hex. 인증카드 안에서 "그 외" 색이 주식 현황(#9ca3af)과 포트폴리오(`SHARE_ETC_COLOR` #8E8E93)로 갈림. 압정은 `PORTFOLIO_PALETTE[9]` 사본 | 데모(6종목)에선 미노출, 8종목 이상에서 노출 | 인증카드 경로(screenshotMode)는 `SHARE_ETC_COLOR`, 압정은 `PORTFOLIO_PALETTE[9]` 참조 |
| 9 | p3 | `stock-tab.tsx:1029·1037`(범례 점 `size-2.5` 고정), 비중 바 `h-6` 고정 | 저장 PNG에서 범례 글자는 20px로 커지는데 점은 10px 그대로라 점이 글자 대비 지나치게 작음. 같은 PNG 계열인 포트폴리오 막대(`portfolio-sector-bar.tsx:26` big=15px)와 비율 불일치 | PNG (`export-stock-*.png`) | `shotBig ? "size-[15px]" : "size-2.5"` (SHOT_BIG 토큰에 `legendDot` 키 추가 권장) |
| 10 | p3 | `stock-tab.tsx:1030`, `portfolio-sector-bar.tsx:41` (범례 이름 `truncate`) | 프리뷰에서 범례 이름 말줄임: 320 `TIGER 미…`·`KODEX …`, 320·360 `AI 및 소프…`·`연금저축…`, 375·390 `TIGER 미국S&…`. 말줄임 뒤 % 앞에 빈 간격이 남아 어색. 저장 PNG는 전부 온전 | 320~390 프리뷰, 양 테마 | 2열 그리드에서 이름 `line-clamp-2 break-keep`(PNG와 같은 정보) 또는 열 간격 `gap-x-2` + `%` 바로 붙이기(`justify-start`) |
| 11 | p3 | `stock-tab.tsx:81` + `hooks/use-logo-src.ts:55-73` | 로고 재시도 대기(400→800→1600ms) 동안 실패한 `<img>`가 그대로 렌더돼 **깨진 이미지 기호 + alt 글자**가 20px 원 안에 보임(약 3초 뒤 이니셜로 바뀜). 느린 회선에서 프리뷰 첫인상 저하. 저장 PNG는 placeholder 처리라 영향 없음 | 전 폭(샌드박스 404로 재현) | 재시도 대기 중엔 `img`를 `opacity-0`(또는 onError 시 즉시 이니셜 표시 후 백그라운드 재시도) |
| 12 | p3 | `share-card.tsx:418` (캡처 `targetChars=35`) | 저장 PNG 투자 유형 설명에 고아 줄 `챙기는 편.` 1줄 발생(35자 묶음이 실제 폭을 넘음) | PNG (`export-type-*.png`) | 캡처 targetChars 33으로 낮추거나 해당 블록 `text-balance` 검토(주석의 폭·글자수 한 쌍 규칙대로 같이 조정) |
| 13 | p3 | `theme.ts:133-143`(`ASSET_THEME_SHOT`의 `sm:text-sm`) vs `design-system.md` §1.3 | 문서는 "프리뷰도 sm: 없는 고정값, sm: 직접 금지"인데 코드는 프리뷰 세트에 `sm:` 사용(코드 주석은 허용). 문서 드리프트 | — | 문서를 현행(프리뷰만 sm 허용, 캡처 BIG 금지)으로 정정 |

## 통과 항목
- 레이어: 오버레이 `bg-black/70 backdrop-blur-sm` z 10001 < 콘텐츠 10002(§3.4 `Z_LAYER.modal/modalContent` 값과 일치). 캡처 인스턴스는 `fixed left-[-9999px]`·`aria-hidden`·`pointer-events-none`로 화면·스크린리더에 안 보임. 워터마크와 본문 글자 시각 겹침 0(전 폭; 자동 검사의 금액 행 겹침은 블록 상자 경계일 뿐 글자는 안 닿음).
- 확인 버튼: `저장/공유` = `variant="brand"`, 보조(복사·저장 아이콘) = `secondary`. 진입 버튼 `HEADER_ENTRY_BTN_BRAND` 40×40.
- 손익색: 요약·행 손익 모두 이익=rose(라이트 600/다크 400), 파랑 0건. 순자산 주황은 인증카드에 해당 수치가 없어 미사용(정상).
- 가로 넘침: 문서 `scrollWidth` = 뷰포트(전 폭), 카드 본문 요소 셸 밖 이탈 0(제어 바 제외 → 결함 1).
- 저장 PNG: 투명 픽셀 0(alpha 255 고정), 배경 라이트 #FFFFFF·다크 #000000 순색, 2040px 폭, **375와 1280에서 받은 PNG가 픽셀 단위 동일**(3종×2테마, R32 통과). 프리뷰 배경(#F0F2F4/#0B0D12)과 PNG 배경(순백/순흑) 차이는 문서화된 의도(components.md "카드 배경").
- 5.171 범례 압축: 인증카드는 `legendMax` 무시(`stock-tab.tsx:1002` `!screenshotMode` 가드) → 6종목 전부 범례 노출, 범례~목록 40px(`mt-10`) 유지 확인. 일반 화면 4칸 압축이 인증카드로 새지 않음.
- 섞인 그룹 숫자(5.173 #348): 인증카드 `mergedStocks`가 `mergeStockGroup(…, exchangeRates)` 경로(`stock-tab.tsx:241`)를 탐 — 코드 경로 확인. 데모 데이터에 같은 해외 종목 매입환율 섞인 묶음이 없어 화면 수치 대조는 못 함(qa는 해당 픽스처로 헤더=행 합 확인 권장).

## 스크린샷
`screenshots/` — `{type|stock|portfolio}-{light|dark}-{320|360|375|390|440|1280}.png`(다이얼로그), `export-{종류}-{테마}-{375|1280}.png`(저장 PNG), `focus-light-375.png`(Tab 포커스 이탈).

## 판정
**UI 수정 요청** — p1 1건(320~360 `저장` 잘림), p2 4건(라이트 % 대비·쪽지 글자 대비·히트영역·포커스), p3 8건. 저장 PNG 자체의 색·투명도·기기 간 동일성은 통과.
