# UI 디자인 가이드라인

> 애플, Toss증권에 일하고 있는 글로벌 시니어급 UI 디자이너
> 마지막 업데이트: 2026-06-09
> 신규·기존 페이지 작업 시 항상 고려. 목표: **직관적이고 눈이 편안하면서 핵심 데이터에 집중**되는 화면.

판단 축 4가지: ① 위계(텍스트 크기) ② 색상 의미 ③ 정보·설명 처리 ④ 직관성·집중도.

---

## 1. 위계 — 텍스트 크기

**한 페이지 안의 크기 단계를 4단계 정도로 제한**한다. 단계가 촘촘하거나(9·10·11·12·13·14·16px 혼재) 인접 요소의 크기차가 작으면 위계가 무너지고 산만해진다.

예시 스케일 (성과-수익 페이지 기준):

| 단계      | 크기                | 용도                                    |
| --------- | ------------------- | --------------------------------------- |
| 캡션      | `text-[11px]`       | 보조 안내, 마감 기준, 접기 트리거, 티커 |
| 보조      | `text-xs` (12px)    | 라벨, 부가 수치(전환줄)                 |
| 본문·금액 | `text-sm` (14px)    | 종목명, 손익 금액, 표 데이터            |
| Hero      | `text-base`+ (16px) | 페이지 핵심 지표(예: 기간 수익 금액)    |

원칙:

- **Hero(핵심 지표)는 가장 크게, 그 안에서도 1순위(금액) > 2순위(수익률) 로 반 단계 차등.** (예: 금액 16 / 수익률 14)
- **보조 정보는 한 단계 낮춰 약화** — 종목명(14) > 티커(11)처럼 주·종 구분.
- 새 px 값을 추가하기 전에 위 4단계 중 하나로 흡수할 수 있는지 먼저 검토.

---

## 2. 색상 의미

- **손익은 한국 관습**: 이익=빨강, 손실=파랑. `getProfitLossColor()`(`src/config/theme`) 사용, 직접 하드코딩 금지.
- **파랑은 손익 전용으로 보존**한다. 정보성 텍스트(환율 등 보조 수치)를 파랑/sky로 칠하면 손실 파랑과 의미가 충돌 → **정보성 텍스트는 중립 회색(`text-muted-foreground`)** 으로.
- **info·아이콘류만 sky 허용** (아이콘은 형태로 구분되어 손익 숫자와 혼동되지 않음). 예: `Info`/`Globe` 아이콘 `text-sky-600/70 dark:text-sky-400/70`, hover `sky-700/300`.
- 활성/선택 상태는 배경+굵기로 강조(`bg-gray-200 dark:bg-gray-700 font-semibold`), 비활성은 `text-muted-foreground`.

---

## 3. 정보·설명 처리

- **부수 설명은 본문에 펼치지 말고 아이콘 + 팝오버로 접는다.** hover(데스크톱)·터치(모바일) 모두 동작해야 함 → 아래 공용 패턴 사용.
- **캡션은 muted 색이면 굵기를 과하게 주지 않는다** (muted + `font-semibold`는 모순). `text-[11px] text-muted-foreground/60` 정도.
- **중복 정보 금지**: 같은 값이 두 셀에 반복되면(예: 비교표 시작=종료 환율 동일) 1회만 표기하거나 생략.
- **시장별/시점별 고정 메타(마감 시각 등)는 행마다 반복하지 말고 표 하단 공통 안내 1줄로** 일원화.

### 공용 패턴: hover + 터치 팝오버 (radix Tooltip ✗ → Popover ✓)

radix Tooltip은 hover 전용이라 모바일 터치가 안 됨. **Popover + pointerType 필터**로 데스크톱 hover와 모바일 탭을 동시 지원:

```tsx
function Hint({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="설명 보기"
          onPointerEnter={(e) => {
            if (e.pointerType === "mouse") setOpen(true);
          }}
          onPointerLeave={(e) => {
            if (e.pointerType === "mouse") setOpen(false);
          }}
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

- `pointerType === "mouse"` 필터로 터치의 mouseenter 오작동(즉시 열렸다 닫힘) 방지.
- 터치는 PopoverTrigger 기본 탭 토글 + 바깥 탭 닫힘으로 처리.
- 참고 구현: `profit-chart.tsx`의 `InfoHint`, `FxBreakdown`.

---

## 4. 직관성 · 집중도

- **Hero(핵심 지표)는 최상단·최대 크기**로 시선의 1순위 확보.
- **핵심 액션 데이터(예: 종목별 손익 리스트)로 시선이 빨리 닿게** 한다. 그 사이를 막는 부차 정보(비교표 등)는 **접이식(Collapsible, 기본 접힘)** 또는 압축으로 prime 영역을 양보.
- **단, 사용자 컨트롤(토글·필터)은 접힘 밖에 항상 노출** — 조작 요소를 숨기지 않는다.
- 반올림으로 변화가 안 보이는 부가 줄 등 **정보가치가 낮은 요소는 덜어낸다.**

---

## 체크리스트 (페이지 UI 작업 시)

- [ ] 텍스트 크기가 4단계 안에 들어오는가? 주·종 위계가 명확한가?
- [ ] 파랑을 손익에만 썼는가? 정보성 텍스트는 회색인가?
- [ ] 부수 설명은 아이콘+팝오버(hover+터치)로 접었는가?
- [ ] 중복/저가치 정보를 덜어냈는가? 고정 메타는 공통 안내로 모았는가?
- [ ] Hero → 핵심 리스트로 시선이 빠른가? 컨트롤은 노출되어 있는가?

---

## 액션 색상 통일 (버튼·체크박스)

확인·제출 등 주요 액션 요소는 브랜드 색 하나로 통일한다.

- **브랜드 색 출처**: `--brand`(globals.css) = `MAIN_PALETTE[0]`(config/theme.ts) = `#5b6fbf`(인디고). 라이트·다크 동일. 두 값은 동일 hex로 동기화 유지(주석 표기).
- **확인·제출 버튼**: `Button variant="brand"` 사용(`bg-brand text-white hover:bg-brand/90`). 인라인 `style={{ backgroundColor: MAIN_PALETTE[0] }}` 신규 사용 지양 — hover·opacity·상태 표현이 안 되고 표준화가 깨짐.
- **체크박스**: 기본 `Checkbox` 컴포넌트가 checked 시 자동 brand 색. 별도 색 지정 금지.
- **역할 분리**: CSS 클래스 기반 UI는 `--brand`/`variant="brand"`, 차트·캔버스 등 JS/인라인은 `MAIN_PALETTE[0]`.
- **예외(의미색)**: 매수=빨강/매도=파랑(유형 토글), 삭제·위험=`variant="destructive"`, 보조=`outline`/`secondary`/`ghost`. 이들은 통일 대상 아님.
- **보조/취소 액션의 보더리스화**: 폼 내 취소 버튼, 퀵 추가 버튼, 리스트 내 수정/삭제/나누기 아이콘 버튼 등 보조 액션 요소에는 테두리(`border`)가 드러나는 `variant="outline"` 대신 테두리가 없고 배경이 은은히 들어간 `variant="secondary"`를 활용하여 전체 앱의 보더리스 및 플랫(Flat) 디자인을 통일한다.
- **텍스트 짤림 방지 및 반응형 너비 설계**:
  - 한국어 텍스트(예: "증권사 선택 안 함")가 좁은 모바일 화면에서 `...`으로 잘리거나 기형적으로 줄바꿈되지 않도록 드롭다운(`SelectTrigger`) 등의 너비를 `min-w-[180px]` 또는 `sm:max-w-[220px]` 등으로 여유 있게 확보한다.
  - 데이터의 종류가 많을 때는 나열식 대신 모바일-데스크톱에 대응하는 적응형 그리드(`grid grid-cols-2 sm:grid-cols-4`)를 채택하여 시각적 정돈감을 높인다.
