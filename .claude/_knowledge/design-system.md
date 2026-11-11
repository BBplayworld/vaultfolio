# 시크릿에셋 디자인 시스템 (단일 출처)

> **이 문서는 시크릿에셋 UI/디자인의 단일 출처(source of truth)다.**
> 모든 신규·수정 UI 작업은 이 문서의 토큰·간격·컴포넌트 규약·모션 폴리시를 따른다.
> 정보 설계 휴리스틱(위계·집중도 "왜")은 §11, 디테일 폴리시 체크리스트는 §6을 본다.
> 색 토큰 출처: [globals.css](../../src/app/globals.css) · 컴포넌트 토큰: [config/theme.ts](../../src/config/theme.ts) `ASSET_THEME`/`MAIN_PALETTE`.

---

## 0. 디자인 철학

1. **다크 우선·블랙 기반.** 배경=블랙, 전경=화이트의 고대비 위에 의미색만 절제해서 얹는다. 라이트 모드도 동일 토큰으로 자동 대응(하드코딩 색 금지).
2. **핵심 데이터에 집중.** 화면당 시선 1순위는 Hero 지표(순자산·수익). 부차 정보는 접거나 약화.
3. **보더리스 플랫.** 테두리보다 **배경 톤차·그림자**로 면을 나눈다. 라이트는 카드 외곽선·그림자 없이 **배경 톤차가 1순위**(#4.42). 보조 액션은 `outline`(테두리) 대신 `secondary`(은은한 배경).
4. **토큰만 사용.** `text-black`/`bg-white`/원시 `#hex` className 금지 → 시맨틱 토큰(`text-foreground`/`bg-background`/`bg-card`…).

---

## 1. 색상 토큰

### 1.1 표면·전경 (시맨틱, 라이트/다크 자동)
| 용도 | 토큰 | 라이트 | 다크 |
|---|---|---|---|
| 배경 | `bg-background`/`text-foreground` | `oklch(0.96 0.004 250)` #F0F2F4 / 블랙 | `oklch(0.16 0.010 265)` #0B0D12 / foreground `oklch(0.965 0.004 265)` |
| 카드 | `bg-card` `text-card-foreground` | 화이트 | `oklch(0.225 0.012 265)` #191C22 |
| 팝오버·시트·다이얼로그 | `bg-popover` (다크 한정 Dialog·AlertDialog·Sheet·Drawer·FAB 시트 `dark:bg-popover`) | 화이트 | `oklch(0.275 0.014 265)` #24282F (불투명) |
| 약화 면/텍스트 | `bg-muted` `text-muted-foreground` | — | muted·secondary `oklch(0.31 0.014 265)` / mf `oklch(0.74 0.016 265)` / accent(hover) `oklch(0.33 0.014 265)` |
| 보조 액션 | `bg-secondary` / `variant="secondary"` | — | — |
| 보더 | `border-border` (다크는 `white/10`) | `oklch(0.91)` 장식 헤어라인(인터랙티브 경계는 `--input` .58) | white 10% |
| 포커스 링 | 전역 `outline-ring/50` (globals.css base) | — | — |

다크 고도(#4.42 후속): bg < card < popover < muted < accent, 청남색 hue 265·채도 0.010~0.016(초과 금지). 다크 카드·다이얼로그·시트는 테두리 없이 톤차로 분리하고, Input·Select 트리거만 `border-input` 경계를 유지한다(WCAG 1.4.11). 새 색 토큰 없이 값만 교체.

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
- **진행률·달성도 시각화는 주황 대신 세그먼트 레벨미터를 우선 검토한다** — 주황(`important`)은 순자산 금액 등 핵심 수치 강조 전용으로 아끼고, 진행률 바에까지 재사용하면 중복된다. `LevelMeter`(`src/components/ui/level-meter.tsx`)가 `SHARE_SAFE_PALETTE`(§1.3, 고채도 10색)를 순환시키는 세그먼트 바를 공용 컴포넌트로 제공한다(현재 적용처 없음, 재사용 대기 상태). 설치 단계 등 선형 `Progress` 사용처는 기본 브랜드색 유지.

### 1.3 차트 팔레트 (`MAIN_PALETTE`, 12색)
`[0]` 인디고=최대 비율 고정 · `[1]` 빨강=대출 고정 · `[2]` 주황=임차보증금 고정 · `[3~10]` 자산 항목 순차 · `[11]` `#4e5763` 무채색 버튼. `assignColors`에서 **최댓값=`MAIN_PALETTE[0]`** 규칙 유지. (CSS `--chart-1~6`은 라이트=teal/다크=indigo 계열)

**`PORTFOLIO_PALETTE` / `SHARE_SAFE_PALETTE` / `SHARE_ETC_COLOR` / `pickOnColor()`** (theme.ts) — 인증카드 "포트폴리오" 타입 전용 **고채도 10색**(`MAIN_PALETTE`와는 별개인 독립 팔레트 — 포트폴리오 도넛·분야 막대바·보유 유형 막대바는 계속 `SHARE_SAFE_PALETTE`로 참조).
- "그 외"/미분류는 `SHARE_ETC_COLOR`(`#8E8E93`).
- **다크 배경 대비 4.3~8.6:1**로 전부 안전. 라이트 배경에서는 라임·앰버가 1.8:1 수준이라 약하다 — 이 카드는 다크 우선 설계이며, 라이트에서 문제되면 해당 2색만 조정한다.
- `pickOnColor(hex)` = 배경 상대휘도로 흰/검정 글자색 선택(조각색 위 ETF 브랜드 배지 텍스트용). 6·8자리(`#RRGGBBAA`) hex를 모두 받도록 방어적으로 구현(현재 `MAIN_PALETTE`엔 8자리 값 없음, 과거 호환용).
- `darkenColor(hex, factor=0.55)` = hex를 검정 쪽으로 `factor`만큼 혼합(2026-09, ETF 배지 원형 배경용) — 조각색 그대로(밋밋)나 `pickOnColor` 흰/검정 2톤 고정(팔레트 대부분이 흰색으로 수렴)의 대안. `SHARE_SAFE_PALETTE` 10색 전체가 기본값 0.55에서 상대휘도 0.45 미만(=밝은 텍스트로 충분히 대비)까지 낮아지도록 실측 검증됨. 조각마다 색조를 유지한 채 어두워져 "다양하면서도 항상 대비되는" 배지 배경에 재사용.

**`--ring-divider`** (globals.css) — 인증카드 포트폴리오 도넛 **조각 구분선**. **라이트 `#ffffff` / 다크 `#000000`** 고정. 웨지 `stroke` **5px**(`GAP_DEG=0`, 인접 조각의 stroke가 공유 모서리에서 겹쳐 한 줄이 됨). **도넛 외곽 링은 없다** — 별도 테두리 없이 조각 색면만으로 마감(#4.24).

**`ASSET_THEME_SHOT`** (theme.ts) — **인증카드 프리뷰 전용 토큰**(캡처 저장 PNG는 별도 `ASSET_THEME_SHOT_BIG`, 아래 참조). 인증카드는 프리뷰·캡처 두 인스턴스 모두 뷰포트 미디어쿼리(`sm:`/`lg:`) 없는 고정값을 써야 PC/모바일에서 같은 사용자가 다른 PNG를 얻는 버그가 없다(qa-full-test-plan **R32**). 그래서 `cardHeader`·`cardTriggerButton`·`cardInfoName`·`cardAmountMain`·`icon`·`iconInitial`·`badge`·`summaryValue`(`text-[17px]`)·`profitAmount`·`profitRate`·`legendGrid`(`grid-cols-2` 고정)·`legendText`(`text-xs` 고정)를 값으로 고정해 둔 세트다. 2026-09부터 상세>주식 탭 모바일보다 ~2px 작게 의도 조정(포트폴리오 도넛 라벨과 밀도 정렬). `screenshotMode`인 컴포넌트만 `ASSET_THEME` 대신 이 값을 쓴다(`StockCard`/`StockRowHeader`/`StockIcon`/`StockCategorySection`/`DetailSummaryHeader`/`ProfitMetric`). **프리뷰 DOM에 새 클래스를 넣을 때 반응형이 필요하면 여기에 고정값을 추가한다 — `sm:`을 직접 쓰지 않는다.**

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
`--radius: 0.75rem`(12px) 기준. `rounded-sm`(8) `rounded-md`(10) `rounded-lg`(12) `rounded-xl`(16) `rounded-2xl`(20, `--radius-2xl` 신규).
- **동심 radius**: 바깥 컨테이너가 둥글면 안쪽 요소는 더 작은 radius로 정렬(바깥 `rounded-xl` → 안쪽 `rounded-lg`).
- 역할표: 카드 `xl` / 내부박스·컨트롤(Button·Input·Select) `lg` / 다이얼로그·시트·배너·Drawer 상단 `2xl` / 칩·배지·점·키패드 `full`. 세그먼트 트랙(`tabList1` xl, p-1.5) 안 트리거는 `md`. Select content `lg`(p-1 안 item `sm`), Popover `xl`.
- 장식용 색 그림자·그라데이션 금지(그림자는 중립 검정 저불투명). 컬러 아이콘 칩 금지 — 아이콘은 단색, 의미는 색·굵기로. 폰트는 시스템 스택 `--font-sans`(Inter 제거, 외부 폰트 로드 0).

### 3.3 고도(elevation) — 테두리보다 그림자
- 면 분리는 **배경 톤차(`bg-muted/40`, `bg-card/50`) → 그림자** 순으로. 테두리는 최후.
- **[필수] 보더리스 박스**: 박스·카드·의미색 콜아웃 컨테이너는 **테두리 없이 배경 톤차(+`shadow-xs`)로 표현**한다(팝업 내부 포함 전 영역). `border`(전방위 테두리)는 다음에만 허용 — hairline 구분선(`border-t`/`border-b`), 기능성(선택상태 표시·업로드 `border-dashed` 드롭존·segmented 트랙·인라인 코드/키캡 칩·`Badge`·단계 점 컨트롤), 다이얼로그/시트 프레임 외곽. 예: `border bg-card` → `bg-card shadow-xs`, `border border-amber-500/20 bg-amber-500/10` → `bg-amber-500/10`.
- 팝오버·시트·드롭다운 `shadow-2xl`, 활성 탭·작은 떠오름 `shadow-sm`.
- **[필수] 라이트 박스 분리(#4.42)**: 카드·SECTION·ROW·KPI는 `border`·`shadow` 없이 `bg-card` 톤차(다크만 `dark:border`/`dark:shadow-*`). 헤어라인 구분선은 `border-border dark:border-border/NN`(`/NN` 알파 단독 금지 — 라이트에서 사라짐). 점검: 카드 vs 캔버스 상대 대비 ≥1.10:1, 중첩 박스 ≥1.08:1(흰 부모 위 최소 `bg-muted/30`), 같은 색끼리 겹치는 Popover·Sheet는 헤어라인 border 또는 `shadow-md` 이상 유지. `--input` 경계(≥3:1)는 불변.
- **[필수] 라이트 뉴트럴 계조**(보더리스와 짝): 라이트는 순백 단일톤 금지 → **캔버스 `bg-background`(`oklch 0.96 0.004 250`) < 리세스 `bg-muted`(`0.88`) < 부상 `bg-card`(화이트)** 3단 + `shadow-xs/sm` 소프트 섀도우로 박스 분리. 다크는 card(`.205`)>background(`.145`) 톤차 유지. 토큰 출처 [globals.css](../../src/app/globals.css) `:root`/`.dark`. 소프트 섀도우는 `--shadow-2xs/xs/sm`(불투명도 .03~.06) + `:root:not(.dark) .shadow-*` 오버라이드(프리셋 미설정 상태에서도 적용).
- **[필수] 자산 카드 표면 계층**([theme.ts](../../src/config/theme.ts) `ASSET_THEME`): 라이트 모드는 다크 모드와 동일 구조(미러링)를 적용하되, 대조를 높이고 은은한 경계선을 두어 영역을 명확히 구분합니다. 자산 상세 콘텐츠(cardWrapper·섹션·subCard)는 캔버스와 통일(투명/faint 톤, 양 모드 동일 클래스 구조)하여 불필요한 레이어를 없애되, 상세 구분 영역(cardSection/subItemsWell 등)에는 불투명도를 높인 faint 톤(`bg-muted/40` 및 `/20`)과 아주 부드러운 소프트 보더(`border-border/10`, `divide-border/10`)를 적용하여 시각적 구분을 명확히 합니다. 허브·메뉴 카드만 `bg-card`(화이트)+은은한 보더(`border-border/10`)로 명도 pop을 구현합니다. 다크 모드는 현행 디자인(borderless 또는 기존 다크 전용 보더/디바이더)을 그대로 보존합니다.
- **[필수] 자산 상세 다크 BOX 구조(#4.44, 3단계 면 폐기)**: 다크에서 리스트 영역 전체=`ASSET_THEME.listBox`(`rounded-xl bg-card shadow-sm overflow-hidden`, 항목 사이 `divide-border/40`) 1장, 항목·펼침부(`cardExpandBox`)·`cardSection`/`Meta`/`cardActions`는 배경 투명(마지막 줄 `dark:pb-3`). 증권사별 타일(`subCard`)만 `dark:bg-popover rounded-lg`, `subItemsWell`은 투명 컨테이너(`background` 검정 well 금지). 항목 하단 비중 바는 `mx-4` 인셋이며 닫힌 항목의 구분 역할을 맡는다(listBox에 divide-y 없음, 펼친 항목만 `cardOpenDivider`). 모바일(<640px)에서는 주식 행 보유 비중 %를 숨긴다(`max-sm:hidden`, 라이트 포함). 상단 요약(`summaryBoxDark`)·거래내역·거래 화면·X-Ray도 같은 card 면. 인증카드(screenshotMode)·`cardWrapper`·SHOT 상수·라이트는 불변(`theme-shot.test.ts`로 고정).
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
- **헤더 아이콘 진입 버튼(인증카드)** = brand 인디고 채움 `bg-brand text-white`(공용 상수 `HEADER_ENTRY_BTN_BRAND`, `MAIN_PALETTE[0]` = 하단 업데이트 버튼과 같은 색 — 대표 결정 #4.66 R8, R7 foreground 반전 폐기). hover `opacity-85`·누름 `scale-[0.96]`·40/44px 히트영역.
- **키패드(잠금 화면)**: 테두리·배경 없는 72px 숫자(`text-2xl font-medium`), 눌림만 `active:bg-muted` 원형. 낮은 화면(`max-height:620px`) 64px.
- **체크박스**: 기본 `Checkbox`(checked 시 자동 brand). 별도 색 금지.
- **탭/세그먼트**: InlineSelector로 전 차수 통일(`tabList2/3` 토큰은 #4.34에 삭제, `tabList1`·`tabList3Wrap`만 legacy 잔존). 화면 폭을 채우는 1차 선택(자산 변화 범위·기간)은 `InlineSelector fullWidth` — 같은 폭 칸·채운 썸+굵은 글자(외곽선 없음)·썸 `motion-safe:transition-[transform] duration-200`·칸 `min-h-10 text-sm active:scale-[0.96]`·화살표 키 이동.
- **카드**: 접힘행 왼쪽=핵심 식별(이름·비중%), 상세(종류·금리·매입가 등)는 펼침(Collapsible)에. 비종목 자산도 주식 카드와 동일 패턴. 토큰: `cardWrapper`/`cardHeader`/`cardInfoName`/`cardAmountMain`…
- **다이얼로그**: 설명형(공유·동기화·가이드)은 `<DialogHeader className="text-left">`(모바일 중앙 정렬 방지). 짧은 확인 모달만 중앙 허용.
- **팝업 취소/닫기 버튼(통일 규약)**: ① 색 = `variant="secondary"`(테두리 없는 플랫, `outline` 금지). `AlertDialogCancel`도 secondary 기본. ② 순서 = DOM은 `[주요 버튼, 취소/닫기]` 순 → 모바일 취소 하단·PC 취소 우측(`DialogFooter`/`AlertDialogFooter` 기본 `flex-col ... sm:flex-row sm:justify-end`, 개별 오버라이드·`flex-col-reverse` 금지). ③ 텍스트 = 맥락별: 폼·설정·실행형(입력/제출/삭제/연결/앱잠금 등)은 **"취소"**, 읽기전용 정보(공지·미리보기·가이드 등)는 **"닫기"**.
- **드롭다운/Select**: 한국어 짤림 방지 — `min-w-[180px]`/`sm:max-w-[220px]` 여유. 항목 多 = 적응형 그리드 `grid-cols-2 sm:grid-cols-4`.
  - **목록 정렬 트리거(#4.73 상세·주식)** — 카테고리 줄 오른쪽 글자 버튼형 `SelectTrigger size="sm"`: 면·테두리 없음(`bg-transparent dark:bg-transparent dark:border-0`), `h-8 px-1.5 text-[13px] sm:text-sm lg:text-base`, 히트 40px `after:absolute after:-inset-y-1`, 화살표 `size-3.5`(기본 `text-primary`), 기본값이 아닌 선택이면 `font-semibold text-foreground`. **아이콘형(`ArrowDownWideNarrow size-4`, 라벨 sr-only, 화살표 숨김, 히트 `after:-inset-1` 40×40)은 기본 정렬일 때만, 360px 미만 또는 7칸이면서 400px 미만**(r2 — 아이콘 색만으로는 선택 상태가 안 읽힘). 기본이 아닌 정렬을 고른 동안은 폭과 무관하게 라벨(좁으면 카테고리 쪽이 가로 스크롤, 정렬 변경 뒤 선택 칸 `scrollIntoView`). 반응형 조건 클래스는 정적 문자열로 둔다. 6칸 이상이면 `InlineSelector [&>button]:px-1.5` 조밀. 항목 `min-h-10`, 내용 `align="end"`.
- **부수 설명(InfoHint) [필수]**: 본문에 펼치지 말고 **아이콘+Popover**(hover+터치 동시지원, radix Tooltip ✗). 구현체는 [info-hint.tsx](../../src/app/(main)/_components/layout/ui/info-hint.tsx) **하나뿐이며 로컬 재정의 금지**(과거 profit-chart가 중복 정의해 규격이 갈렸음).
  - **`summary` 필수**: 팝오버 최상단에 **한 줄 요약**이 항상 먼저 온다. 상세는 `children`(선택)으로 그 아래. 요약 없이 장문만 넣지 않는다 — 열어봐도 결론을 모르는 힌트를 막기 위함.
  - 본문 폰트는 `text-sm`(§2 — `text-xs` 이하 지양). 레이어는 §3.4, 모달 내부에서는 `inModal`.
- **입력**: 날짜/시간 input은 globals.css 전역 리셋(appearance-none·min-w-0·max-w-100%)로 모바일 넘침 차단 — 폼별 `max-w` 임시방편 금지.

### 5.1 데이터 뷰 재사용 패턴 (레퍼런스: [asset-report-view.tsx](../../src/app/(main)/_components/views/activity/asset-report-view.tsx) 로컬 `SECTION`/`SectionHeader`/`GROUP_BADGE`/`SpecRow`·비교 그리드)

> 긴 데이터 화면(성적표·허브·상세 등)에서 위계·구분·정렬을 통일하는 레시피. 소비처 2곳 이상 되면 shared 컴포넌트로 추출.

- **대주제 섹션 구분** — 긴 뷰의 큰 항목 경계를 명확히: 외피 `rounded-xl bg-card p-4 space-y-3 dark:shadow-sm`(라이트 톤차 §3.3) + 헤더 = **칩 없는 단색 아이콘 `size-5`** + 굵은 제목(`text-sm sm:text-base font-bold`, 톤과 무관하게 `text-foreground` 고정) + 선택 뱃지/InfoHint. 섹션 내부 서브박스는 `bg-muted/30`으로 한 단계 낮춰 중첩을 표현.
  - **아이콘 색 톤 구분(2026-08, #4.42에 칩 제거)** — 한 화면에 여러 대주제 섹션이 나란히 있을 때(`asset-report-view.tsx` `SectionHeader`의 `tone` prop) 제목 텍스트는 그대로 두고 아이콘 글자색만 섹션별로 달리해 은은하게 구분한다. 임의의 새 색을 만들지 않고 이미 의미가 정해진 토큰만 재사용: `brand`(`text-primary`, 기본) · `important`(`text-orange-600 dark:text-orange-400`, §1.2 순자산 강조 토큰) · `gold`(`text-amber-600 dark:text-amber-400`, 별점·등급 톤과 통일) · `info`(`text-sky-600 dark:text-sky-400`, 정보/보조 도구 성격). 섹션이 3~4개를 넘거나 새 의미가 필요하면 이 팔레트 안에서 먼저 고르고, 부족할 때만 새 토큰을 design-system.md에 추가한다.
- **소그룹 뱃지 라벨** — 섹션 안에서 산식 체인·목록 카테고리 등 하위 묶음의 시작을 표시: `inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary`. muted 텍스트 라벨 대신 brand 톤 뱃지를 쓴다(§1.2 info 아이콘 sky와 구분 — 이건 라벨).
- **비교 표(그리드)** — 여러 기준을 컬럼 정렬로 대조: `overflow-x-auto` 래퍼(모바일 가로 넘침 보호) + `grid grid-cols-[1fr_auto_…] items-baseline gap-x-… gap-y-…` + 헤더행 + `col-span-N h-px bg-border/40` 구분선. 라벨 좌측, 값 우측(`text-right tabular-nums`), 폭 압축은 `formatShortCurrency`, `min-w-[…]`로 하한. 강조 컬럼만 `font-bold` + 부호색(`getProfitLossColor`).
  - **`auto` 값 열은 모바일에서 `1fr` 라벨 열을 0으로 붕괴시킨다**(라벨이 한 글자씩 세로로 깨짐). `min-w-[…]`는 반드시 **모든 열의 자연 폭 합 이상**이어야 가로 스크롤이 실제로 동작한다. 그 폭을 잡을 수 없으면 **모바일은 기준별 세로 스택(`sm:hidden`, 라벨-값 쌍 블록) + `hidden sm:grid`로 표**를 쓴다. 두 레이아웃은 반드시 같은 행 배열 소스를 map 해 JSX 중복을 만들지 않는다(예: `asset-report-view.tsx`의 `perfRows`).
  - 한 표 안에서 금액 포맷을 섞지 않는다(`formatShortCurrency` 억/만 표기 vs `formatPriceByMode`가 `full-only`일 때의 9자리 전체 표기 → 열 폭이 2배 이상 벌어짐).
- **월별 변화 리스트(인라인 카드, #4.67 R3 월별 기록)** — 여러 달 금액은 표·시트·가로 스크롤 대신 `SECTION` 카드 안 세로 리스트로 보인다. 줄 = 좌(월 `font-semibold`·이번 달 `GROUP_BADGE`·기록일 `text-sm muted`, 좌측만 줄바꿈) / 우(`tabular-nums whitespace-nowrap` 2줄: 순자산 원 단위 `text-sm font-semibold` 위, **앞 기록 대비 변화** 아래 — `getProfitLossColor` + `+`/U+2212, 0은 `0원` muted, 건너뛴 달 뒤 `· N월 대비` muted, 첫 기록 `첫 기록` muted) + 끝 `ChevronDown`(펼침 불가 줄은 같은 폭 빈 span). 줄 구분 `border-b border-border dark:border-border/40 last:border-b-0`. 펼칠 수 있는 줄은 줄 전체 `button`(min-h-14, `hover:bg-muted/40`+포커스 링, press scale 금지 — 가장자리 잘림) → 패널 `rounded-lg bg-muted/50 px-3 py-2`(카드 12 → 패널 8 동심), 자산군 금액·**순자산 기여 변화**(부채 증가 = 파랑 −, 변화 = 표시값 차), `sm↑` 금액·변화 한 줄(변화 열 `sm:min-w-28 sm:text-right sm:shrink-0` — 10억 이상 변화는 열이 늘어남·금액 `sm:text-right` → 우측 끝 줄마다 일치, <sm 폭 고정 없음). 펼침 모션은 항상 마운트 `grid-rows-[0fr↔1fr]` `motion-safe:transition-[grid-template-rows] duration-200` + 접힘 `inert`. 긴 목록은 처음 6줄 + `이전 N개월 더 보기`(40px). 짧은 표기(억·만) 금지 — 정확 금액. 레퍼런스 `monthly-log-block.tsx`.
- **장부형 비교 표(#4.73 시장과 비교, 레퍼런스 `market-compare-view.tsx`)** — 기간 여러 개 × 값 행 2개 + 차이 행: `grid grid-cols-[minmax(3.75rem,1fr)_repeat(3,minmax(0,5rem))] sm:max-w-md sm:grid-cols-[minmax(5rem,1fr)_repeat(3,5.5rem)] items-baseline gap-x-1.5 gap-y-2`, `role=table`(행 `contents`+`role=row`). 기준 구간은 열 머리 아래 `text-[11px] leading-4 tabular-nums` `M/D→M/D`(공백·연도 없음, 375 미만 끝 날짜 `max-[374px]:block` 2줄 고정). 주인공 행 `text-base font-bold`+손익색, 비교 행 `text-sm font-medium`+손익색, 구분 `col-span-4 h-px bg-border dark:bg-border/40`, **차이 행은 손익색 금지 `text-foreground`**(평가처럼 읽히지 않게). 0.0은 부호 없이 muted, 값이 없으면 `—`(0% 금지). 조회 중은 표 틀 유지 + 값 칸만 `h-4 w-10~12 rounded bg-muted motion-safe:animate-pulse`.
- **순위 목록 속 기준 줄(면 줄, #4.73)** — 종목 줄 `li flex justify-between py-2.5`(사이 헤어라인) 사이에 기준(시장) 줄을 같은 열·같은 오른쪽 끝으로 끼우고 면만 다르게: `-mx-2 my-1 rounded-md bg-muted/40 px-2 py-2`, 이름 muted. 앞뒤 헤어라인은 그리지 않는다. 줄은 `li`(버튼 아님, hover·press 없음).
- **진입 글줄(E1, #4.73 `MarketEntryLine`)** — 요약 박스·Hero 맨 아래 `mt-3 -mb-2 border-t pt-1.5` + 버튼 `min-h-10 flex-col sm:flex-row`: 값 줄(`text-sm muted`, 값 `font-medium text-foreground tabular-nums`, 덩어리별 `whitespace-nowrap`, 구분점 `mx-1.5 text-muted-foreground/60`) + 링크 줄(`font-medium` + `ChevronRight size-4 muted`). 모바일 2줄 고정, 늦게 오는 값은 자리 예약 + opacity, 대상 0이면 grid-rows 접힘.
- **명세 행(SpecRow)** — 값 + 짧은 설명을 한 캡션에 욱여넣지 말고 라벨/값 분리: 라벨(좌, `text-sm text-muted-foreground text-pretty break-keep`, 선택 `· hint`는 `text-muted-foreground/70`) + 값(우, `text-sm text-foreground font-semibold tabular-nums shrink-0 ml-auto`). 컨테이너는 `flex flex-wrap`으로 두어, 한 줄에 안 들어가면 라벨을 부수는 대신 값을 다음 줄 우측으로 내린다. 위계·집중도 판단은 §11 참조.
- **한글 줄바꿈** — 한글은 기본 `word-break`에서 **음절 단위로 쪼개진다**. 좁은 컬럼·카드에 들어가는 한글 라벨·캡션은 `text-pretty`와 함께 **`break-keep`**(word-break: keep-all)을 붙인다. 전역 상수(`CAPTION` 등)에는 넣지 말고 폭이 좁은 지점에만 적용.
  - **가운뎃점(`·`, U+00B7)은 keep-all에서도 줄바꿈 기회**다(#4.38). 문장 속 "저장·전송"처럼 묶여야 하는 어구는 상수 문자열에 `\u2060`(WORD JOINER)을 앞뒤로 넣고(`security-copy.ts`), JSX 제목의 "Chrome·Safari"처럼 짧은 묶음은 `whitespace-nowrap` span으로 감싼다. nowrap 묶음 여러 개를 나열한 줄(웰컴 신뢰 한 줄)에는 `text-balance`를 쓰지 않는다 — 묶음을 1/2로 나눠 첫 줄에 구분자만 남긴다.
  - 공용 컴포넌트 안 문구의 줄바꿈이 한 소비처에서만 문제면 공용을 고치지 말고 그 소비처 래퍼에 `break-keep`(상속)을 붙인다(#4.38 웰컴 인앱 가이드).
- **행 안의 부가 뱃지** — `truncate`는 잘려도 되는 텍스트(이름)에만 걸고, 뒤따르는 상태 뱃지·어포던스 라벨(`비교 제외`, `부동산 연결` 등)은 `shrink-0` + 컨테이너 `flex-wrap`으로 둘째 줄에 내려가게 한다. 래퍼 전체에 `truncate`를 걸면 뱃지가 말줄임에 먹혀 **기능 자체가 보이지 않는다**.

---

## 6. 모션 · 인터랙션 폴리시 (UI 디테일 폴리시 체크리스트)

> framer-motion 미사용 → **CSS 전환 + `tw-animate-css`**, **`motion-safe`로 reduced-motion 대응**.
> 정적 사전 페인트 조각은 서버/클라 공용 조각을 재사용하고 ENTER는 생략한다(`welcome-intro.tsx`, #4.61) — 조각→본 화면 교체 시 같은 위치·불투명 1.0, 아래 새로 붙는 요소만 ENTER.

- **`transition: all` 금지** → `transition-[color,box-shadow,transform]` 등 **변하는 속성만 명시**(레이아웃 thrash 방지).
- **누름 피드백**: 버튼 `active:not-disabled:scale-[0.96]`, 카드류 `0.98~0.99`.
- **Tailwind 4.1 `scale-*`·`active:scale-*`는 CSS `scale` 속성**이다 — 전환 목록에 `transform`이 아니라 `scale`을 넣는다(`transition-[background-color,scale]`, 또는 v4 `transition-transform`은 scale 포함). `transform`만 적으면 보간 없이 즉시 바뀐다(#4.37 조사: 공용 `Button` 포함 9곳 해당, 수정은 별도 과제).
- **진입(enter)**: 뷰 컨테이너 `motion-safe:animate-in fade-in slide-in-from-bottom-*`, 리스트는 `animationDelay`로 **stagger** 분산(예: 40ms 간격). **인터럽터블**(중간 조작 시 부드럽게 가로채기).
- **퇴장(exit)은 절제** — subtle하게.
- **순환 단계 애니메이션**: 공용 `StepAnimationPlayer`(설치/동기화 가이드). 활성 컷 1개만 `key={active}` remount 렌더(구형 Safari opacity repaint 회피), 진입 페이드 `motion-safe`, 멈춤/시작·단계 점 컨트롤은 `pointer-events-auto`.
- **높이 펼침(재마운트 없음, #4.35)**: 조건부 렌더(`{open && …}`) 대신 **항상 마운트**하고 바깥 `grid motion-safe:transition-[grid-template-rows,opacity,visibility] motion-safe:duration-300 ease-out` + 닫힘 `grid-rows-[0fr] opacity-0 invisible` + `inert` / 열림 `grid-rows-[1fr] opacity-100 visible`, 안쪽 `min-h-0 overflow-hidden`. 전환 중 재탭은 CSS가 현재 값에서 역전(인터럽터블), reduced-motion은 즉시. 토글은 `aria-expanded`·`aria-controls`. 접힌 상세가 부모 `space-y-*` 여백을 남기지 않게 토글과 같은 블록 안에 둔다. 예: `welcome-guide.tsx` 보안 상세
- **`will-change` 절제**, 불필요한 합성 레이어 금지.
- **광학 정렬**: 아이콘·텍스트는 수치가 아니라 눈으로 맞춘다(시각 중심).
- **이미지 outline**: 이미지에 `outline`(1px, 토큰색)으로 경계 또렷하게.

---

## 7. 접근성 · 터치

- 클릭 가능 요소는 `<button>`/`<a>` (onClick만 단 `<div>/<span>` 금지 — 키보드·스크린리더 불가).
- 아이콘 전용 버튼에 `aria-label`/`title`. `<img>`에 `alt`(의미 없으면 `alt=""`). 폼 입력에 `<Label>`.
- **최소 히트영역 40×40px**: 작은 닫기/dismiss·단계 점은 `after:absolute after:-inset-*`로 터치영역 확장. 아이콘 버튼 `size-7.5`(≈30px) 이상, 헤더 아이콘 `h-10 sm:h-11`.
  - **`pointer-coarse:` 변형(#4.49)**: 시각 크기를 바꾸지 않는 작은 인라인 버튼(InfoHint 14~16px)은 래퍼 없이 버튼에 `relative pointer-coarse:after:absolute pointer-coarse:after:content-[''] pointer-coarse:after:-inset-[13px] sm:pointer-coarse:after:-inset-3`로 터치 기기에서만 40×40 확장(마우스 hover 영역 불변). 확장 영역이 이웃 인터랙티브 요소를 덮으면 그 이웃에 `relative z-10`(예: 설정 InlineSelector, 배당 월 배지). 월 배지처럼 상시 노출 버튼은 `h-6 after:-inset-y-2`(=40px).
- hover 전용 노출 금지(터치 도달 불가). 전역 `cursor: pointer`(인터랙티브)·`not-allowed`(disabled)는 globals.css base에서 처리.
- 환경 감지는 `detectBrowserEnv()` 단일 소스(iPad 데스크톱 위장 UA는 `maxTouchPoints>1` 보정).

---

## 8. 다크모드 · 토큰 사용 규칙

- 모든 색은 시맨틱 토큰. 부득이한 의미색도 `text-orange-600 dark:text-orange-400`처럼 **라이트/다크 쌍**으로.
- `--brand`(globals.css)와 `MAIN_PALETTE[0]`(theme.ts)는 **동일 hex(#5b6fbf) 동기화 유지** — 한쪽만 바꾸지 말 것. 하드코딩된 사본(`pwa-guide-illustrations.tsx`의 `BRAND` 상수 등; FAB은 #4.42에 `bg-brand/10`으로 토큰화)도 함께 바꿔야 한다.
- 공유/동기화 링크 진입 시 송신 테마(`&theme=`)를 hydration 이전 단계부터 적용해 깜빡임(FOUC) 방지.
- **라이트/다크 비대칭 pin**: 라이트에서만 인지성이 부족한 조합(예: `text-muted-foreground/NN`)은 라이트 값을 교정하고 다크는 `dark:text-muted-foreground/NN`로 기존 모습 그대로 고정한다(§11 참고).
- **가로 스크롤바 전역 금지**(R33): `globals.css`의 `body { overflow-x: hidden }` + `html { touch-action: pan-y }`로 페이지 레벨 가로 스크롤을 원천 차단한다. 어떤 컴포넌트도 뷰포트를 가로로 넘겨선 안 되며, 넘칠 위험이 있으면 스크롤바로 해결하지 말고 그 컴포넌트를 `min-w-0`/`max-w-full`/`truncate`로 수렴시킨다(날짜 input R10, 인증카드 미리보기 fit-to-width와 동일 원칙). 의도적 가로 스크롤(넓은 표·코드블록·X-Ray)은 **내부 `overflow-x-auto` 컨테이너**로만 — `body` 규칙은 이걸 막지 않는다.

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
- **선택 카드(목록 중 1개 고르기)** — 선택 = `bg-card shadow-sm ring-2 ring-brand` + 우측 `Check`(`text-brand`), 비선택 = `bg-muted/40 hover:bg-muted/70`(다크 `/25`·`/40`), 최소 높이 `min-h-10`, `aria-pressed`, press `scale-[0.96]`. 체크박스 대신 카드 전체가 히트영역(예: `StockTargetPicker`, #4.29).
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

## 12. 공개 문서 페이지 규약 (가이드, #4.45)
- `(main)` 밖 정적 글 페이지는 `/ratio` 껍데기(480px 컬럼·헤더 복사·홈 링크 없음)를 따른다. 단계 번호는 단색 `tabular-nums` 숫자(`aria-hidden`, 칩·아이콘 배경 금지), 단계 구분은 헤어라인(`border-border dark:border-border/40`), 카드는 "시크릿에셋으로 하면" 면 1장만. 행동 블록은 brand 주 버튼 + secondary 보조 버튼 `h-11`, 본문 링크는 `text-primary` + 밑줄 + `min-h-10`. 슬래시 어구(국내/해외)는 nowrap, 모든 한글 블록 `break-keep`.
- 상단바 1회 안내 카드: 헤더 `overflow-x-clip`(세로 허용) 안 `absolute right-3 top-full`, `bg-card rounded-xl shadow-lg`, 확인=brand·취소=ghost. 한 줄 안내 스트립(세금 시즌)은 X-Ray 스트립과 같은 클래스 복제.

## 13. 메뉴 행 화면 · 차트 라벨 규약 (#4.46)

- **최소 노출 비중(#148, 4.77)**: 도넛·비중 바는 항목(양수) 5개 이하일 때 `displayShareWidths`로 표시 폭(각도)만 최소 보장하고 %·금액·라벨은 실제 값을 쓴다. 6개 이상·0% 항목은 현행(0%는 그리지 않음). 라벨 표시 기준은 실제 % 기준.
- 더보기·설정 메뉴: 섹션 제목 `text-muted-foreground`(라이트·다크 같은 위계, 인디고 금지), 행 아이콘 단색 muted(삭제 행만 rose), 최대 폭 `max-w-2xl` 좌정렬, 상태는 ON/OFF 배지(`menuBadge`) — 다크 ON 배지 전용 `dark:bg-brand/15 dark:text-indigo-300`(대비 8.44:1(실측), 팔레트 직접 사용이라 다른 곳에 재사용하려면 토큰화). 한 줄 안내가 길면 단위 구간을 `whitespace-nowrap`으로 묶는다.
- 차트 조각 라벨 글자색은 조각색 대비 4.5:1 이상인 흰/검정(`pickDonutLabelColor`), 투명 카드 위 조각 경계는 `--card`가 아니라 `--background`. 조각 안에 들어가지 않는 라벨은 숨기고 범례로 대체한다(`DONUT_LABEL_MIN_PCT`).
- 구성 비교 막대(#4.51): 자산군 고정 색(부동산 `MAIN_PALETTE[0]`·주식 `[4]`·암호화폐 `[3]`·현금성 `[5]`, 실물 `[8]`은 4.49), 선형 폭·막대 안 11%↑만 %, 구분선은 `shadow-[-2px_0_0_0_var(--card)]`로 폭 소비 없음. 증감은 손익색 대신 전경색+부호(+, U+2212). 신규 토큰 0.
- **차트 기준선 라벨 칩 · 차트 매수 점(#4.81 종목 한 장)**: 평단 같은 '내 기준값' 선은 중립 점선(`text-foreground/70`, `4 3`, 1.25px — 범위 밖 고정이면 `/40`)에 card 면 칩(`fill var(--card)` 85%·rx 6·높이 20·11px `tabular-nums`)로 `내 평단 {가격}`(`↑`/`↓`)을 적는다. 주황(순자산 전용)·brand(액션)·손익색 금지. 매수 점 = 빨강(`fill-rose-500`) r4 + card 고리 2px, 선택 = brand 고리(r9)·점 r6, 히트 반경 10~20(이웃 거리 반분). 진입 텍스트 링크 색 = 라이트 `text-brand`·다크 `dark:text-indigo-300`(링크 한정). 선 색 = 구간 등락 부호(`getProfitLossColor`), '내 수익'(매입 대비)과 독립이라 라벨은 `N년 주가 등락`.

## 14. 브랜드 로고 (#4.66 logo-spec·대표 R6·R8)
- **구성**: 심볼 `BrandSymbol`(Leckerli One "S" 글리프 아웃라인 — 파비콘·앱 아이콘과 같은 서체, R8) + 워드마크 `BrandWordmark`(Pretendard Variable wght 750 아웃라인, 자간 +110/2048em + 쌍별 커닝) = 가로 락업 `BrandLockup`. 앱 안 홈 상단 왼쪽 전용(PWA = 락업, 브라우저 = 심볼만 32px 박스).
- **색 토큰 `--brand-logo`(신규, 로고 전용 단일색)**: 라이트 `#111111` / 다크 `#F2F3F6`(= 다크 foreground 계열). 심볼·워드마크 같은 값, 톤 차·그라데이션 없음(톤 차는 밝은 면이 커 보여 상하 균형을 깸). 로고 밖 용도로 쓰지 않는다.
- **크기·정렬(375 기준)**: S 잉크 높이 15.25px(박스 18.21px, R8 후보 14.5/15.25/16 중 선택 — 기울어진 필기체라 같은 높이면 기하형보다 가볍게 보여 R7 14.5보다 약간 크게) · 워드마크 잉크 높이 13px · 잉크 간격 = S 잉크 높이 × 0.3124(4.76px, S 오른쪽 끝 기준) · S 잉크 좌측(아래 볼) = 카드 외곽 − 0.4px(기울기 광학 보정: 위쪽 몸통이 2.7px 안쪽) · 세로 = 두 잉크 중심 일치 + 워드마크 0.25px 하향(무게중심). lg는 15/13배(S 잉크 17.6 · 박스 21.01 · 워드마크 15 · 간격 5.49 · 보정 0.46 · 0.3px 하향).
- **클리어 스페이스·최소 크기**: 사방 S 잉크 높이 × 0.33. 최소 락업 S 잉크 14px·워드마크 10.5px, 심볼 단독 16px 박스. 틈이 없는 글리프라 해상도별 path 분기 없음(R8에서 `bs-hi`/`bs-lo` 제거).
- **금지**: 헤더에 타일·배경, 브랜드 인디고·그라데이션 재채색, 그림자·외곽선, 비율 변형, 워드마크를 시스템 폰트로 대체, 심볼과 워드마크 다른 색, 같은 화면에 S 글리프를 다른 역할로 두 번(하단 홈 탭은 lucide `Home`).
- 앱 아이콘·파비콘·`Logo`(next/font Leckerli One)와 심볼이 같은 서체로 통일(R8). 심볼은 폰트 로딩 없이 SVG path, 서체 출처는 `brand-symbol.tsx` 주석(SIL OFL).

---

_최종 정의: 2026-06-25 · 색 토큰(블랙/화이트/순자산 주황·브랜드 인디고)·간격/반경/고도·컴포넌트 규약·모션 폴리시(UI 디테일)·정보 설계 휴리스틱(구 ui-design-guidelines.md 흡수)·접근성 종합. **단일 출처**._
