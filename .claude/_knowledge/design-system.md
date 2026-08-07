# 시크릿에셋 디자인 시스템 (단일 출처)

> **이 문서는 시크릿에셋 UI/디자인의 단일 출처(source of truth)다.**
> 모든 신규·수정 UI 작업은 이 문서의 토큰·간격·컴포넌트 규약·모션 폴리시를 따른다.
> 정보 설계 휴리스틱(위계·집중도 "왜")은 §11, 디테일 폴리시 체크리스트는 §6을 본다.
> 색 토큰 출처: [globals.css](../../src/app/globals.css) · 컴포넌트 토큰: [config/theme.ts](../../src/config/theme.ts) `ASSET_THEME`/`MAIN_PALETTE`.

---

## 0. 디자인 철학

1. **다크 우선·블랙 기반.** 배경=블랙, 전경=화이트의 고대비 위에 의미색만 절제해서 얹는다. 라이트 모드도 동일 토큰으로 자동 대응(하드코딩 색 금지).
2. **핵심 데이터에 집중.** 화면당 시선 1순위는 Hero 지표(순자산·수익). 부차 정보는 접거나 약화.
3. **보더리스 플랫.** 테두리보다 **배경 톤차·그림자**로 면을 나눈다. 보조 액션은 `outline`(테두리) 대신 `secondary`(은은한 배경).
4. **토큰만 사용.** `text-black`/`bg-white`/원시 `#hex` className 금지 → 시맨틱 토큰(`text-foreground`/`bg-background`/`bg-card`…).

---

## 1. 색상 토큰

### 1.1 표면·전경 (시맨틱, 라이트/다크 자동)
| 용도 | 토큰 | 라이트 | 다크 |
|---|---|---|---|
| 배경 | `bg-background`/`text-foreground` | 화이트 / 블랙 | 블랙(oklch .145) / 화이트(oklch .985) |
| 카드 | `bg-card` `text-card-foreground` | 화이트 | oklch .205 |
| 팝오버·시트 | `bg-popover` | 화이트 | 반투명 다크 |
| 약화 면/텍스트 | `bg-muted` `text-muted-foreground` | — | — |
| 보조 액션 | `bg-secondary` / `variant="secondary"` | — | — |
| 보더 | `border-border` (다크는 `white/10`) | oklch .65 | white 10% |
| 포커스 링 | 전역 `outline-ring/50` (globals.css base) | — | — |

### 1.2 의미색 (이것만 색을 쓴다)
| 의미 | 토큰 | 값 |
|---|---|---|
| **브랜드(확인·제출·선택)** | `variant="brand"` / `--brand` / `MAIN_PALETTE[0]` | **#5b6fbf 인디고** (라이트·다크 동일, foreground #fff) |
| **중요·강조(순자산·경고성 배지·주의 유도)** | `ASSET_THEME.important` / `importantHex` | **주황 `text-orange-600 dark:text-orange-400` / #ff8904** |
| 이익 / 매수 | `ASSET_THEME.profit` (`getProfitLossColor(v)`) | **빨강** `text-rose-600 dark:text-rose-400` |
| 손실 / 매도 | `ASSET_THEME.loss` | **파랑** `text-blue-600 dark:text-blue-400` |
| 부채·임차보증금 차감 | `ASSET_THEME.liability` | rose 계열 |
| 삭제·위험 | `variant="destructive"` / `--destructive` | oklch 레드 |
| 정보 아이콘류 | sky(아이콘 한정) | `text-sky-600/70 dark:text-sky-400/70` |

**불변 규칙**
- **손익=한국 관습**: 이익=빨강·손실=파랑. 직접 하드코딩 금지, `getProfitLossColor()` 사용.
- **파랑은 손익 전용.** 정보성 텍스트(환율 등)는 파랑 금지 → 중립 `text-muted-foreground`. (정보 "아이콘"만 sky 허용 — 형태로 구분됨)
- **순자산/중요 수치는 주황(`important`)** 으로 1순위 강조. 브랜드 인디고는 "액션·선택"에만.
- **주황(`important`)은 "순자산" 전용이 아니라 화면 전체의 범용 강조색이다** — 검정 배경·흰 전경·회색 제목이라는 기본 톤 위에서 **사용자가 눈여겨봐야 할 항목**(마감 임박·미백업·높은 심각도 배지 등)을 튀지 않게 부각시킬 때 1순위로 쓴다. 삭제·위험(`destructive`)만큼 강하지 않되 `text-muted-foreground`보다 확실히 눈에 띄어야 하는 "주의 유도" 톤에 적합. 예: 세금 캘린더 `severity==="high"` 배지(`bg-orange-500/10 text-orange-600 dark:text-orange-400`), 백업 미실시 경고(`backup-nudge.tsx`), 오래된 백업 안내(`tool-menu.tsx`). 새로운 강조·경고성 UI를 만들 때 색을 새로 고르지 말고 이 토큰부터 검토한다.
- CSS 클래스 UI = `--brand`/`variant="brand"`, 차트·캔버스 등 JS/인라인 = `MAIN_PALETTE[0]`.

### 1.3 차트 팔레트 (`MAIN_PALETTE`, 12색)
`[0]` 인디고=최대 비율 고정 · `[1]` 빨강=대출 고정 · `[2]` 주황=임차보증금 고정 · `[3~10]` 자산 항목 순차 · `[11]` `#4e5763` 무채색 버튼. `assignColors`에서 **최댓값=`MAIN_PALETTE[0]`** 규칙 유지. (CSS `--chart-1~6`은 라이트=teal/다크=indigo 계열)

**`SHARE_SAFE_PALETTE`** (theme.ts) — 자산 카드(share-card.tsx) 전용. `MAIN_PALETTE`에서 의미가 예약된 `[1]` 빨강(부채/손실)·`[2]` 주황(임차보증금, 순자산 `important`와 유사)을 제외한 순서. `[0]` 인디고는 최대 비율 고정 규칙 그대로 유지. **공유 카드의 색은 자산군(주식·부동산·코인·현금) 단위로 먼저 배정하고, 개별 종목은 자기 자산군의 색을 상속한다** — 포트폴리오 바 색과 핵심 자산 목록 색점이 항상 1:1로 매칭되게 하기 위함. 상세 탭(`assignColors`)은 부채를 포함해 `[1]`/`[2]` 예약 의미가 유효하므로 그대로 `MAIN_PALETTE` 사용, 공유 카드에서만 `SHARE_SAFE_PALETTE`를 쓴다.

---

## 2. 타이포 위계 — 한 화면 4단계

| 단계 | 크기 | 용도 |
|---|---|---|
| 캡션 | `text-[11px]` | 캡션 역할 콘텐츠 한정 — 티커·배지 상태·스텝 원형 숫자·차트 축 라벨·타임스탬프·마감 기준 메타·접기 트리거 |
| 보조 | `text-xs` (12px) | **신규 사용 지양** — 좁은 칩/배지·3단 카테고리 탭(`categoryBox`/`todayBox`/`tabTrigger3`류)·**일별 달력 셀 금액**(net-asset-chart.tsx 일별 탭, 모바일 셀 텍스트 가용폭 42.6px가 앱 최협 — `text-xs sm:text-sm`) 한정. 전부 폭 제약으로 예외 존속 |
| 본문·금액 | `text-sm` (14px, `sm:text-[15px]`) | 라벨·부가 수치·이름·종목명·손익 금액·표 데이터 — **모바일·PC 공통** |
| Hero | `text-base`+ (16px↑) | 페이지 핵심 지표 |

- **웨이트는 3종만**: `font-medium`(보조 라벨) · `font-semibold`(강조·라벨) · `font-bold`(Hero·금액). **`font-extrabold` 미사용**(Hero는 크기+색+`font-bold`로 충분 — 웨이트 난립 방지, UI팁 #13). shadcn 프리미티브의 `font-medium`은 그대로 둔다.
- **줄높이**: 여러 줄 산문(설명·안내·캡션)은 **line-height ≥1.5**(`leading-relaxed`/`leading-normal`/`leading-7`) — UI팁 #16. 단일 줄 숫자·Hero 금액은 자릿수 정렬 위해 `leading-tight` 허용.

- **모바일·PC 인지성 통일**: 캡션 역할(위 표)·구조적 제약(칩/배지/3단 탭) 예외가 아니면 `text-xs`를 쓰지 않고 `text-sm`으로 통일한다(반응형 `text-xs sm:text-sm` 분기도 `text-sm` 고정으로 단순화 — PC뿐 아니라 모바일도 14px).
- Hero 내부도 1순위(금액) > 2순위(수익률) **반 단계** 차등.
- 새 px 추가 전 위 4단계로 흡수 가능한지 먼저 검토(9·10·13·14 난립 금지).
- 숫자·수량·환율·건수·금액 등 **자릿수 흔들리는 표기는 전부 `tabular-nums`**.
- 제목 `text-balance`, 본문/설명 `text-pretty`.

---

## 3. 간격 · 반경 · 고도

### 3.1 간격 스케일 (4px 그리드)
`gap-1`(4) · `gap-1.5`(6) · `gap-2`(8) · `gap-3`(12) · `gap-4`(16) · `gap-5`(20) · `gap-6`(24).
- **섹션 간** `gap-5` · **카드 내부** `gap-3`/`space-y-3` · **카드 액션 행** `gap-2` · 인라인 라벨 `gap-1~1.5`.
- 페이지 컨테이너 좌우 거터 `px-3`(TopBar 버튼 라인과 일치) → 본문 카드 추가 패딩 0 (`ASSET_THEME.contentPad = "px-0"`).

### 3.2 반경(radius) — 동심 정렬
`--radius: 0.625rem`(10px) 기준. `rounded-sm`(6) `rounded-md`(8) `rounded-lg`(10) `rounded-xl`(14) `rounded-2xl`(16).
- **동심 radius**: 바깥 컨테이너가 둥글면 안쪽 요소는 더 작은 radius로 정렬(바깥 `rounded-xl` → 안쪽 `rounded-lg`).
- 카드 `rounded-lg`, 다이얼로그/시트 `rounded-2xl`, 칩·점 `rounded-full`.

### 3.3 고도(elevation) — 테두리보다 그림자
- 면 분리는 **배경 톤차(`bg-muted/40`, `bg-card/50`) → 그림자** 순으로. 테두리는 최후.
- **[필수] 보더리스 박스**: 박스·카드·의미색 콜아웃 컨테이너는 **테두리 없이 배경 톤차(+`shadow-xs`)로 표현**한다(팝업 내부 포함 전 영역). `border`(전방위 테두리)는 다음에만 허용 — hairline 구분선(`border-t`/`border-b`), 기능성(선택상태 표시·업로드 `border-dashed` 드롭존·segmented 트랙·인라인 코드/키캡 칩·`Badge`·단계 점 컨트롤), 다이얼로그/시트 프레임 외곽. 예: `border bg-card` → `bg-card shadow-xs`, `border border-amber-500/20 bg-amber-500/10` → `bg-amber-500/10`.
- 팝오버·시트·드롭다운 `shadow-2xl`, 활성 탭·작은 떠오름 `shadow-sm`.
- **[필수] 라이트 뉴트럴 계조**(보더리스와 짝): 라이트는 순백 단일톤 금지 → **캔버스 `bg-background`(그레이 `oklch 0.91`) < 리세스 `bg-muted`(`0.88`) < 부상 `bg-card`(화이트)** 3단 + `shadow-xs/sm` 소프트 섀도우로 박스 분리. 다크는 card(`.205`)>background(`.145`) 톤차 유지. 토큰 출처 [globals.css](../../src/app/globals.css) `:root`/`.dark`. 소프트 섀도우는 `--shadow-2xs/xs/sm` + `:root .shadow-*` 무조건 오버라이드(프리셋 미설정 상태에서도 적용).
- **[필수] 자산 카드 표면 계층**([theme.ts](../../src/config/theme.ts) `ASSET_THEME`): 라이트 모드는 다크 모드와 동일 구조(미러링)를 적용하되, 대조를 높이고 은은한 경계선을 두어 영역을 명확히 구분합니다. 자산 상세 콘텐츠(cardWrapper·섹션·subCard)는 캔버스와 통일(투명/faint 톤, 양 모드 동일 클래스 구조)하여 불필요한 레이어를 없애되, 상세 구분 영역(cardSection/subItemsWell 등)에는 불투명도를 높인 faint 톤(`bg-muted/40` 및 `/20`)과 아주 부드러운 소프트 보더(`border-border/10`, `divide-border/10`)를 적용하여 시각적 구분을 명확히 합니다. 허브·메뉴 카드만 `bg-card`(화이트)+은은한 보더(`border-border/10`)로 명도 pop을 구현합니다. 다크 모드는 현행 디자인(borderless 또는 기존 다크 전용 보더/디바이더)을 그대로 보존합니다.
- **구분선 2종**: **중립 헤어라인** `border-border/40`·`h-px bg-border/40`(§5.1) = 일반 행·헤더 분리 / **강조(accent) 구분선** `ASSET_THEME.dividerAccent`(=`border-t border-amber-400/25`, §1 별점 amber 톤) = 논리 그룹·섹션 경계('큰 단락')만. 강조 구분선도 위 "hairline 구분선(`border-t`/`border-b`)" 허용 범위 내 장식 구분선이며 박스 전방위 보더가 아니다. 색 하드코딩 금지 — 반드시 토큰 사용.
- **[필수] 인터랙티브 경계 대비(WCAG 1.4.11)**: 입력 필드·체크박스 등 조작 요소의 경계는 **3:1 이상**. 라이트는 헤드룸이 좁아 `border-input`(=`--input` `oklch(0.58)`)로 가시 경계를 준다(`Input`은 `border border-input dark:border-0`, `Checkbox`는 `border-input`). **다크는 보더리스 fill 유지**(`dark:border-0`, `--input` 별도 pin). 장식용 구분선(`--border`)은 1.4.11 대상이 아니므로 헤어라인을 무겁게 하지 않는다.

### 3.4 z-index 레이어 스케일 [필수]
겹침 순서의 단일 출처는 [theme.ts](../../src/config/theme.ts)의 **`Z_LAYER`** 상수다. **임의의 `z-*` 클래스를 새로 만들지 말고 반드시 이 상수를 `style={{ zIndex: Z_LAYER.x }}`로 주입**한다.

| 레이어 | 값 | 용도 |
| --- | --- | --- |
| `base` / `raised` | 10 / 20 | 카드 내 오버레이(로딩 가림막), 리사이저 |
| `floating` | 40 | FAB, PWA 연결 프롬프트 |
| `nav` | 50 | 하단 네비, 스크롤 투 톱 |
| `hint` | 60 | InfoHint·Tooltip — **nav보다 위** |
| `modal` / `modalContent` | 10001 / 10002 | Dialog·Sheet 오버레이/콘텐츠 |
| `modalHint` | 10003 | **모달 내부**에서 열리는 InfoHint |
| `gate` / `lock` | 10100 / 10200 | 인앱 브라우저 게이트, 앱 잠금 |

- **[금지] 동률 배치**: 같은 층에 두 오버레이를 두면 DOM 순서로 승부가 갈려 예측 불가다(과거 InfoHint와 하단 네비가 모두 `z-50`이라 힌트가 가려짐).
- **Popover는 Portal로 body에 붙어** 부모의 stacking context를 벗어난다. 따라서 다이얼로그 안에서 힌트를 쓰면 `hint`(60)로는 모달 콘텐츠(10002)에 반드시 가려진다 → `InfoHint`에 **`inModal`을 켜서 `modalHint`로 올린다.**

---

## 4. 레이아웃 구조

- **단일 컨테이너 + drill-down**: `home / detail/{tab} / activity/{tab}` (NavigationProvider, hash 동기화). `back()`은 항상 홈 복귀, `navigate()` 시 `scrollTo(0,0)`.
- **위계 순서**: Hero → 필터/컨트롤(항상 노출) → 리스트. 컨트롤은 접힘 밖.
- **본문 최상위 카드**: `ASSET_THEME.contentCard`(border-0·bg-transparent·shadow-none·풀블리드).
- **PWA 세이프에어리어**(globals.css `@media (display-mode: standalone)`): 모바일 하단 nav + `padding-top: max(1.5rem, env(safe-area-inset-top))`, PC 상단 nav. 일반 웹은 `nav.pwa-nav-container` 숨김.
- **반응형**: `sm:`/`lg:` 분기 일관. 가로 넘침은 `overflow-x-auto`+`min-w-0` 체인, 스크롤바는 `.scrollbar-themed`. `useIsMobile()`의 `undefined`(hydration 전) 처리.

---

## 5. 컴포넌트 규약

- **버튼**: 확인·제출 = `variant="brand"`. 보조·취소·리스트 내 아이콘(수정/삭제/나누기) = `variant="secondary"`(테두리 없는 플랫). `outline` 신규 사용 지양. 카드 액션 아이콘 버튼 = `size="icon" variant="secondary"` + `ASSET_THEME.cardActionButton`(size-7.5 sm:size-8.5). `Button`은 누름 피드백 `active:not-disabled:scale-[0.96]` 내장(link·`static` 제외).
- **체크박스**: 기본 `Checkbox`(checked 시 자동 brand). 별도 색 금지.
- **탭/세그먼트**: `ASSET_THEME.tabList1/2/3`·`tabTrigger1/2/3`. 1단계=메인, 2단계=상세(캡슐), 3단계=카테고리(border-2). InlineSelector로 전 차수 통일.
- **카드**: 접힘행 왼쪽=핵심 식별(이름·비중%), 상세(종류·금리·매입가 등)는 펼침(Collapsible)에. 비종목 자산도 주식 카드와 동일 패턴. 토큰: `cardWrapper`/`cardHeader`/`cardInfoName`/`cardAmountMain`…
- **다이얼로그**: 설명형(공유·동기화·가이드)은 `<DialogHeader className="text-left">`(모바일 중앙 정렬 방지). 짧은 확인 모달만 중앙 허용.
- **팝업 취소/닫기 버튼(통일 규약)**: ① 색 = `variant="secondary"`(테두리 없는 플랫, `outline` 금지). `AlertDialogCancel`도 secondary 기본. ② 순서 = DOM은 `[주요 버튼, 취소/닫기]` 순 → 모바일 취소 하단·PC 취소 우측(`DialogFooter`/`AlertDialogFooter` 기본 `flex-col ... sm:flex-row sm:justify-end`, 개별 오버라이드·`flex-col-reverse` 금지). ③ 텍스트 = 맥락별: 폼·설정·실행형(입력/제출/삭제/연결/앱잠금 등)은 **"취소"**, 읽기전용 정보(공지·미리보기·가이드 등)는 **"닫기"**.
- **드롭다운/Select**: 한국어 짤림 방지 — `min-w-[180px]`/`sm:max-w-[220px]` 여유. 항목 多 = 적응형 그리드 `grid-cols-2 sm:grid-cols-4`.
- **부수 설명(InfoHint) [필수]**: 본문에 펼치지 말고 **아이콘+Popover**(hover+터치 동시지원, radix Tooltip ✗). 구현체는 [info-hint.tsx](../../src/app/(main)/_components/layout/ui/info-hint.tsx) **하나뿐이며 로컬 재정의 금지**(과거 profit-chart가 중복 정의해 규격이 갈렸음).
  - **`summary` 필수**: 팝오버 최상단에 **한 줄 요약**이 항상 먼저 온다. 상세는 `children`(선택)으로 그 아래. 요약 없이 장문만 넣지 않는다 — 열어봐도 결론을 모르는 힌트를 막기 위함.
  - 본문 폰트는 `text-sm`(§2 — `text-xs` 이하 지양). 레이어는 §3.4, 모달 내부에서는 `inModal`.
- **입력**: 날짜/시간 input은 globals.css 전역 리셋(appearance-none·min-w-0·max-w-100%)로 모바일 넘침 차단 — 폼별 `max-w` 임시방편 금지.

### 5.1 데이터 뷰 재사용 패턴 (레퍼런스: [asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx) 로컬 `SECTION`/`SectionHeader`/`GROUP_BADGE`/`SpecRow`·비교 그리드)

> 긴 데이터 화면(성적표·허브·상세 등)에서 위계·구분·정렬을 통일하는 레시피. 소비처 2곳 이상 되면 shared 컴포넌트로 추출.

- **대주제 섹션 구분** — 긴 뷰의 큰 항목 경계를 명확히: 외피 `rounded-xl bg-card border border-border/10 dark:border-0 shadow-sm p-4 space-y-3`(테두리보다 그림자 §3.3) + 헤더 = **채운 아이콘 칩**(`flex size-7 items-center justify-center rounded-lg` 안에 `size-4` 아이콘) + 굵은 제목(`text-sm sm:text-base font-bold`, 톤과 무관하게 `text-foreground` 고정) + 선택 뱃지/InfoHint. 섹션 내부 서브박스는 `bg-muted/30`으로 한 단계 낮춰 중첩을 표현.
  - **아이콘 칩 톤 구분(2026-08)** — 한 화면에 여러 대주제 섹션이 나란히 있을 때(`asset-report-view.tsx` `SectionHeader`의 `tone` prop) 제목 텍스트는 그대로 두고 아이콘 배경·색만 섹션별로 달리해 은은하게 구분한다. 임의의 새 색을 만들지 않고 이미 의미가 정해진 토큰만 재사용: `brand`(`bg-primary/15 text-primary`, 기본) · `important`(`bg-orange-500/15 text-orange-600 dark:text-orange-400`, §1.2 순자산 강조 토큰) · `gold`(`bg-amber-500/15 text-amber-600 dark:text-amber-400`, 별점·등급 톤과 통일) · `info`(`bg-sky-500/15 text-sky-600 dark:text-sky-400`, 정보/보조 도구 성격). 섹션이 3~4개를 넘거나 새 의미가 필요하면 이 팔레트 안에서 먼저 고르고, 부족할 때만 새 토큰을 design-system.md에 추가한다.
- **소그룹 뱃지 라벨** — 섹션 안에서 산식 체인·목록 카테고리 등 하위 묶음의 시작을 표시: `inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary`. muted 텍스트 라벨 대신 brand 톤 뱃지를 쓴다(§1.2 info 아이콘 sky와 구분 — 이건 라벨).
- **비교 표(그리드)** — 여러 기준을 컬럼 정렬로 대조: `overflow-x-auto` 래퍼(모바일 가로 넘침 보호) + `grid grid-cols-[1fr_auto_…] items-baseline gap-x-… gap-y-…` + 헤더행 + `col-span-N h-px bg-border/40` 구분선. 라벨 좌측, 값 우측(`text-right tabular-nums`), 폭 압축은 `formatShortCurrency`, `min-w-[…]`로 하한. 강조 컬럼만 `font-bold` + 부호색(`getProfitLossColor`).
  - **`auto` 값 열은 모바일에서 `1fr` 라벨 열을 0으로 붕괴시킨다**(라벨이 한 글자씩 세로로 깨짐). `min-w-[…]`는 반드시 **모든 열의 자연 폭 합 이상**이어야 가로 스크롤이 실제로 동작한다. 그 폭을 잡을 수 없으면 **모바일은 기준별 세로 스택(`sm:hidden`, 라벨-값 쌍 블록) + `hidden sm:grid`로 표**를 쓴다. 두 레이아웃은 반드시 같은 행 배열 소스를 map 해 JSX 중복을 만들지 않는다(예: `asset-report-view.tsx`의 `perfRows`).
  - 한 표 안에서 금액 포맷을 섞지 않는다(`formatShortCurrency` 억/만 표기 vs `formatPriceByMode`가 `full-only`일 때의 9자리 전체 표기 → 열 폭이 2배 이상 벌어짐).
- **명세 행(SpecRow)** — 값 + 짧은 설명을 한 캡션에 욱여넣지 말고 라벨/값 분리: 라벨(좌, `text-sm text-muted-foreground text-pretty break-keep`, 선택 `· hint`는 `text-muted-foreground/70`) + 값(우, `text-sm text-foreground font-semibold tabular-nums shrink-0 ml-auto`). 컨테이너는 `flex flex-wrap`으로 두어, 한 줄에 안 들어가면 라벨을 부수는 대신 값을 다음 줄 우측으로 내린다. 위계·집중도 판단은 §11 참조.
- **한글 줄바꿈** — 한글은 기본 `word-break`에서 **음절 단위로 쪼개진다**. 좁은 컬럼·카드에 들어가는 한글 라벨·캡션은 `text-pretty`와 함께 **`break-keep`**(word-break: keep-all)을 붙인다. 전역 상수(`CAPTION` 등)에는 넣지 말고 폭이 좁은 지점에만 적용.
- **행 안의 부가 뱃지** — `truncate`는 잘려도 되는 텍스트(이름)에만 걸고, 뒤따르는 상태 뱃지·어포던스 라벨(`비교 제외`, `부동산 연결` 등)은 `shrink-0` + 컨테이너 `flex-wrap`으로 둘째 줄에 내려가게 한다. 래퍼 전체에 `truncate`를 걸면 뱃지가 말줄임에 먹혀 **기능 자체가 보이지 않는다**.

---

## 6. 모션 · 인터랙션 폴리시 (UI 디테일 폴리시 체크리스트)

> framer-motion 미사용 → **CSS 전환 + `tw-animate-css`**, **`motion-safe`로 reduced-motion 대응**.

- **`transition: all` 금지** → `transition-[color,box-shadow,transform]` 등 **변하는 속성만 명시**(레이아웃 thrash 방지).
- **누름 피드백**: 버튼 `active:not-disabled:scale-[0.96]`, 카드류 `0.98~0.99`.
- **진입(enter)**: 뷰 컨테이너 `motion-safe:animate-in fade-in slide-in-from-bottom-*`, 리스트는 `animationDelay`로 **stagger** 분산(예: 40ms 간격). **인터럽터블**(중간 조작 시 부드럽게 가로채기).
- **퇴장(exit)은 절제** — subtle하게.
- **순환 단계 애니메이션**: 공용 `StepAnimationPlayer`(설치/동기화 가이드). 활성 컷 1개만 `key={active}` remount 렌더(구형 Safari opacity repaint 회피), 진입 페이드 `motion-safe`, 멈춤/시작·단계 점 컨트롤은 `pointer-events-auto`.
- **`will-change` 절제**, 불필요한 합성 레이어 금지.
- **광학 정렬**: 아이콘·텍스트는 수치가 아니라 눈으로 맞춘다(시각 중심).
- **이미지 outline**: 이미지에 `outline`(1px, 토큰색)으로 경계 또렷하게.

---

## 7. 접근성 · 터치

- 클릭 가능 요소는 `<button>`/`<a>` (onClick만 단 `<div>/<span>` 금지 — 키보드·스크린리더 불가).
- 아이콘 전용 버튼에 `aria-label`/`title`. `<img>`에 `alt`(의미 없으면 `alt=""`). 폼 입력에 `<Label>`.
- **최소 히트영역 40×40px**: 작은 닫기/dismiss·단계 점은 `after:absolute after:-inset-*`로 터치영역 확장. 아이콘 버튼 `size-7.5`(≈30px) 이상, 헤더 아이콘 `h-10 sm:h-11`.
- hover 전용 노출 금지(터치 도달 불가). 전역 `cursor: pointer`(인터랙티브)·`not-allowed`(disabled)는 globals.css base에서 처리.
- 환경 감지는 `detectBrowserEnv()` 단일 소스(iPad 데스크톱 위장 UA는 `maxTouchPoints>1` 보정).

---

## 8. 다크모드 · 토큰 사용 규칙

- 모든 색은 시맨틱 토큰. 부득이한 의미색도 `text-orange-600 dark:text-orange-400`처럼 **라이트/다크 쌍**으로.
- `--brand`(globals.css)와 `MAIN_PALETTE[0]`(theme.ts)는 **동일 hex(#5b6fbf) 동기화 유지** — 한쪽만 바꾸지 말 것.
- 공유/동기화 링크 진입 시 송신 테마(`&theme=`)를 hydration 이전 단계부터 적용해 깜빡임(FOUC) 방지.
- **라이트/다크 비대칭 pin**: 라이트에서만 인지성이 부족한 조합(예: `text-muted-foreground/NN`)은 라이트 값을 교정하고 다크는 `dark:text-muted-foreground/NN`로 기존 모습 그대로 고정한다(§11 참고).

---

## 9. 작업 전 체크리스트

- [ ] 색을 시맨틱 토큰으로 썼는가? 하드코딩 색·원시 hex className 없는가?
- [ ] 손익=빨강/파랑(`getProfitLossColor`)·순자산=주황(`important`)·액션=brand 규칙을 지켰는가? 파랑을 정보성 텍스트에 안 썼는가?
- [ ] 텍스트가 4단계 위계 안에 있는가? 숫자에 `tabular-nums`, 제목 `text-balance`/본문 `text-pretty`?
- [ ] 간격(섹션 gap-5·카드 gap-3)·동심 radius·테두리보다 그림자 우선을 따랐는가?
- [ ] 확인·제출=`variant="brand"`, 보조=`secondary`(보더리스), 체크박스 기본?
- [ ] 설명형 다이얼로그 `DialogHeader className="text-left"`?
- [ ] 부수 설명은 아이콘+Popover(hover+터치)로 접었는가?
- [ ] `transition-all` 없이 변하는 속성만 명시? 누름 `scale-[0.96]`·진입 stagger·`motion-safe`?
- [ ] 클릭요소 `<button>/<a>`·`aria-label`·최소 히트영역 40×40?
- [ ] 모바일 가로 넘침(`overflow-x-auto`+`min-w-0`)·날짜 input 전역 리셋 의존?

---

## 10. 부족분 보완 가이드(점진 적용)

현 UI에서 아직 일관되지 않은 부분은 작업하며 이 기준으로 수렴한다.
- **고도 일관화**: 면 분리에 테두리가 남아 있으면 `bg-muted/40`+`shadow`로 교체(보더리스 플랫 강화). **팝업(다이얼로그·시트·배너) 내부 정보/콜아웃 박스는 §3.3 [필수] 규약으로 즉시 적용**(점진 아님).
- **간격 스케일 수렴**: 비표준 px/gap은 §3.1 4px 그리드 값으로 흡수.
- **의미색 오용 점검**: 정보성 텍스트의 파랑/sky 잔존을 `text-muted-foreground`로 교정(§1.2·§11).
- **모션 누락 보완**: 신규/수정 인터랙션에 누름 scale·진입 stagger·`transition` 속성 명시를 기본 포함.

---

## 11. 정보 설계 휴리스틱 (위계·정보 처리·집중도)

> §1~§7이 "무엇을 쓸지(토큰·규약)"라면, 여기는 "어떻게 판단할지(디자인 사고)". 토스/애플 시니어 디자이너 관점.

**위계**
- 단계가 촘촘하면(9·10·11·13·14 혼재) 위계가 무너진다 — §2의 4단계로 흡수, 새 px는 추가 전 검토.
- Hero 내부도 1순위(금액) > 2순위(수익률) **반 단계** 차등. 보조(티커 11) < 주(종목명 14).

**색 — 상태·정보**
- 활성/선택은 **배경+굵기**로 강조(`bg-muted … font-semibold`), 비활성은 `text-muted-foreground`.
- 정보성 텍스트는 파랑 금지(손익 전용) → 중립 회색. **info 아이콘만 sky** 허용(`text-sky-600/70 dark:text-sky-400/70`, hover sky-700/300) — 형태로 손익 숫자와 구분.

**정보 처리**
- 캡션이 muted면 굵기를 과하게 주지 않는다(muted+semibold는 모순) → `text-[11px] text-muted-foreground` 수준.
- **`text-muted-foreground` 위 추가 투명도(`/NN`) 사용 제한**: 라이트는 배경이 밝아 대비 헤드룸이 적어 투명도 중첩 시 AA 미만으로 쉽게 떨어진다(다크는 배경이 어두워 헤드룸이 넉넉해 문제없음). 캡션 장식·placeholder·empty-state·구분자에만 허용하고, 실제 안내 문장(고지·프라이버시 설명 등 사용자가 읽어야 하는 문장)에는 라이트에서 투명도 금지 — `text-muted-foreground dark:text-muted-foreground/NN`로 다크만 pin(예: `copyright-footer.tsx`, `tool-menu.tsx` 공유 다이얼로그 안내문).
- **중복 정보 금지**: 같은 값이 두 셀에 반복되면(예: 비교표 시작=종료 환율 동일) 1회만.
- 시점·시장별 **고정 메타(마감 시각 등)는 행마다 반복하지 말고 표 하단 공통 1줄**로 일원화.

**집중도**
- Hero(핵심 지표) 최상단·최대 → **핵심 액션 리스트(종목별 손익 등)로 시선이 빨리 닿게**. 사이를 막는 부차 정보(비교표 등)는 **접이식(기본 접힘)** 또는 압축.
- **단, 사용자 컨트롤(토글·필터)은 접힘 밖 항상 노출** — 조작 요소를 숨기지 않는다.
- 반올림으로 변화가 안 보이는 부가 줄 등 **저가치 정보는 덜어낸다.**
- **보조 설명은 짧은 명사구 한 줄로 [필수]**: 카드·허브·섹션의 부가 설명(KpiCard `description`·섹션 부제 등)은 짧은 명사구로 간결하게 둔다(예: "기간별 수익", "이자 뺀 실수익 · AI 진단"). **문장형 장문 설명이 필요하면 반드시 `InfoHint`(아이콘+Popover, §5.5)로 내리고** 보조 설명 줄에 긴 문장을 늘어놓지 않는다. **hub·신규 페이지 제작에도 공통 적용.**

**지표·성적표 화면 — UI 방향 기준** (4.18 자산 성적표에서 확립, 이후 동일 방향 유지)
- **등급·티어 시각화는 그림자로**: 테두리 대신 드롭섀도로 등급을 표현하고, **레벨이 높을수록 채도·글로우를 강화**(bronze 은은 → platinum 강한 블룸). §3 "테두리보다 그림자 우선"의 지표 적용. (참고: `asset-report-view.tsx` `TIER_STYLE`)
- **참고 지표는 결론(Hero) 먼저**: 종합 등급·핵심 결론을 최상단 최대로, 근거·상세는 **접이식 기본 접힘**(위 집중도 원칙의 지표판). 단 사용자 컨트롤(기간 선택 등)은 접힘 밖 노출.
- **분모/기준이 다른 두 값이 한 화면에 있으면 각 블록에 기준 뱃지**: `모든 자산` vs `금융자산만`, `1년 기준` 등으로 분모를 못박고 검산용 캡션(예: `금융 투자 원가 N원 대비 42%`)을 붙인다. 같은 화면의 두 수치가 다른 분모를 쓰면 사용자는 불일치로 오인한다.
- **측정 불가·비동기 대기 값은 숨기지 말고 명시**: 빈칸 대신 회색 별("측정불가")·잠정("pending") 표기 + "기록이 쌓이면 자동 정밀화" 안내. 데이터 부족을 침묵으로 처리하지 않는다.
- **장문 InfoHint 금지**: 힌트는 3문단 상한, 초과 설명은 접기 본문으로 내린다.

**참고 지표·채점 기능 설계 원칙** (§11의 "무엇을 쓸지"가 아닌 "어떻게 채점을 설계할지". 4.18에서 확립, 신규 지표·채점 기능은 이 방향을 따른다)
- **측정 가능한 것만으로 산출**: 데이터 부족 항목은 `null`(측정불가)로 두고, 종합은 **측정 가능한 축만 가중 재정규화**한다. 데이터가 없다고 신규 사용자를 배제하지 않는다. (참고: `asset-grade.ts` `computeAssetGrade`)
- **임계값(컷)은 단일 상수에 모으고 근거를 주석으로**: `GRADE_THRESHOLDS`처럼 컷을 한곳에 집약하고 각 컷의 근거(통념·시장 기준)를 코드 주석에 남긴다. 매직넘버를 로직 곳곳에 흩지 않는다.
- **같은 개념 값은 단일 소스에서 1회 계산 후 공유**: 화면 표시값과 지표 입력이 같은 값을 쓰게 해 **화면-등급 불일치를 구조적으로 차단**(예: `netLeverage`를 Hero와 등급 `coverage`가 공유). 조회는 기존 쿼리 키를 재사용해 캐시를 공유한다(성과 허브·배당 차트와 동일 키, tickerList는 R1대로 `.sort()`).
- **파생·비동기 값은 pending, 확정 후에만 이력화**: 비동기 대기 축은 잠정 표기하고, 전 축 확정 시에만 스냅샷에 기록하되 **동일 값 재기록은 스킵(멱등)**·과거 스냅샷은 소급 변경하지 않는다.
- **지표는 참고용임을 고지하고 관점을 분명히**: "투자 조언이 아닌 참고 지표"임을 명시한다. 축의 관점을 명확히 정의한다(예: 레버리지 축은 활용도가 아니라 **건전성/리스크** → 무부채 = 리스크 0 = 만점).

**공용 패턴 — hover + 터치 Popover 힌트** (radix Tooltip은 hover 전용 → Popover + `pointerType` 필터로 데스크톱 hover·모바일 탭 동시지원)
```tsx
function Hint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="설명 보기"
          onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
          className="text-sky-600/70 hover:text-sky-700 dark:text-sky-400/70 dark:hover:text-sky-300"
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" sideOffset={4} className="w-72 p-2.5 text-left text-[11px] leading-relaxed">
        {children}
      </PopoverContent>
    </Popover>
  );
}
```
- `pointerType === "mouse"` 필터로 터치의 mouseenter 오작동(즉시 열렸다 닫힘) 방지. 터치는 PopoverTrigger 기본 탭 토글 + 바깥 탭 닫힘.
- 참고 구현: `profit-chart.tsx`의 `InfoHint`·`FxBreakdown`.

---

_최종 정의: 2026-06-25 · 색 토큰(블랙/화이트/순자산 주황·브랜드 인디고)·간격/반경/고도·컴포넌트 규약·모션 폴리시(UI 디테일)·정보 설계 휴리스틱(구 ui-design-guidelines.md 흡수)·접근성 종합. **단일 출처**._
