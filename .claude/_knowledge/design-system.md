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
| **중요·순자산 강조** | `ASSET_THEME.important` / `importantHex` | **주황 `text-orange-600 dark:text-orange-400` / #ff8904** |
| 이익 / 매수 | `ASSET_THEME.profit` (`getProfitLossColor(v)`) | **빨강** `text-rose-600 dark:text-rose-400` |
| 손실 / 매도 | `ASSET_THEME.loss` | **파랑** `text-blue-600 dark:text-blue-400` |
| 부채·임차보증금 차감 | `ASSET_THEME.liability` | rose 계열 |
| 삭제·위험 | `variant="destructive"` / `--destructive` | oklch 레드 |
| 정보 아이콘류 | sky(아이콘 한정) | `text-sky-600/70 dark:text-sky-400/70` |

**불변 규칙**
- **손익=한국 관습**: 이익=빨강·손실=파랑. 직접 하드코딩 금지, `getProfitLossColor()` 사용.
- **파랑은 손익 전용.** 정보성 텍스트(환율 등)는 파랑 금지 → 중립 `text-muted-foreground`. (정보 "아이콘"만 sky 허용 — 형태로 구분됨)
- **순자산/중요 수치는 주황(`important`)** 으로 1순위 강조. 브랜드 인디고는 "액션·선택"에만.
- CSS 클래스 UI = `--brand`/`variant="brand"`, 차트·캔버스 등 JS/인라인 = `MAIN_PALETTE[0]`.

### 1.3 차트 팔레트 (`MAIN_PALETTE`, 12색)
`[0]` 인디고=최대 비율 고정 · `[1]` 빨강=대출 고정 · `[2]` 주황=임차보증금 고정 · `[3~10]` 자산 항목 순차 · `[11]` `#4e5763` 무채색 버튼. `assignColors`에서 **최댓값=`MAIN_PALETTE[0]`** 규칙 유지. (CSS `--chart-1~6`은 라이트=teal/다크=indigo 계열)

---

## 2. 타이포 위계 — 한 화면 4단계

| 단계 | 크기 | 용도 |
|---|---|---|
| 캡션 | `text-[11px]` | 보조 안내·티커·마감 기준·접기 트리거 |
| 보조 | `text-xs` (12px) | 라벨·부가 수치 |
| 본문·금액 | `text-sm` (14px, `sm:text-[15px]`) | 종목명·손익 금액·표 데이터 |
| Hero | `text-base`+ (16px↑) | 페이지 핵심 지표 |

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
- 팝오버·시트·드롭다운 `shadow-2xl`, 활성 탭·작은 떠오름 `shadow-sm`.
- z-index 스케일: 일반 오버레이 `z-40`(연결 프롬프트) · 다이얼로그 `z-50` · 앱 잠금 `z-100`.

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
- **드롭다운/Select**: 한국어 짤림 방지 — `min-w-[180px]`/`sm:max-w-[220px]` 여유. 항목 多 = 적응형 그리드 `grid-cols-2 sm:grid-cols-4`.
- **부수 설명**: 본문에 펼치지 말고 **아이콘+Popover**(hover+터치 동시지원, radix Tooltip ✗). 참고 `InfoHint`(profit-chart). 코드 패턴은 §11.
- **입력**: 날짜/시간 input은 globals.css 전역 리셋(appearance-none·min-w-0·max-w-100%)로 모바일 넘침 차단 — 폼별 `max-w` 임시방편 금지.

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
- **고도 일관화**: 면 분리에 테두리가 남아 있으면 `bg-muted/40`+`shadow`로 점진 교체(보더리스 플랫 강화).
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
- 캡션이 muted면 굵기를 과하게 주지 않는다(muted+semibold는 모순) → `text-[11px] text-muted-foreground/60` 수준.
- **중복 정보 금지**: 같은 값이 두 셀에 반복되면(예: 비교표 시작=종료 환율 동일) 1회만.
- 시점·시장별 **고정 메타(마감 시각 등)는 행마다 반복하지 말고 표 하단 공통 1줄**로 일원화.

**집중도**
- Hero(핵심 지표) 최상단·최대 → **핵심 액션 리스트(종목별 손익 등)로 시선이 빨리 닿게**. 사이를 막는 부차 정보(비교표 등)는 **접이식(기본 접힘)** 또는 압축.
- **단, 사용자 컨트롤(토글·필터)은 접힘 밖 항상 노출** — 조작 요소를 숨기지 않는다.
- 반올림으로 변화가 안 보이는 부가 줄 등 **저가치 정보는 덜어낸다.**

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
