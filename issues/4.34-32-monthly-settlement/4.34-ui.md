# #32 ui — 성과 메뉴 정리 + 월말 결산 (design-review)

기준: spec.md(§4~§8), design-system.md(§2 타이포 4단계·§3 간격/그림자·§5.1 데이터 뷰·§7 터치 40px), 375px. 신규 패턴 없음: 전부 기존 컴포넌트·토큰 조합.
재사용 근거: `KpiCard`(`layout/ui/kpi-card.tsx`), `ASSET_THEME.tabList1~3/tabTrigger1~3`(`config/theme.ts`), `InlineSelector`, `InfoHint`, `Button variant=brand|secondary`, `SectionHeader`/`SpecRow`(asset-report-view 로컬 함수를 공용 파일로 동작 불변 이동 후 재사용, components.md 등록은 KB 배치 갱신 때)·섹션 외피(§5.1), `getProfitLossColor`, `formatPriceByMode`/`formatShortCurrency`. 금액·증감은 `tabular-nums`, 한글 좁은 라벨은 `text-pretty break-keep`.

## 1. 성과 허브 (`performance-hub.tsx`)
위→아래
1. 제목 "성과" + 부제 "자산 변화·배당·성적표를 확인하세요" (기존 `h2`/`p` 유지, 부제만 변경)
2. **결산 카드** (노출 기간 + 비교 가능할 때만): `KpiCard` 재사용(수정 없음; `settlement-card`·`hub-card-*` testid는 감싸는 `div`에, 뱃지는 `title`(ReactNode)에 넣음). icon=`CalendarCheck`, title=제목, description=구간 `10/31 → 11/30`, primary=순자산 증감액(`getProfitLossColor`, `primaryClassName`), secondary=증감 % . `title`에 `rounded bg-primary/10 text-primary text-xs` 소그룹 뱃지 "이번 달 결산"(§5.1). 탭 → 자산 변화·월 탭 (`source=card`).
3. 카드 3개 (`grid-cols-1 lg:grid-cols-2`): 자산 변화(순자산 + 전년 대비 기존 secondary 유지) / 배당(기존) / 자산 성적표(기존). 수익 카드 삭제, 순자산 카드는 "자산 변화"로 개명·`go("change")`.
- 상태: 기본(위) / 첫 달·기간 밖·자산 0건·스냅샷 0건 → 결산 카드 DOM 자체 없음(자리 비움 없이 위로 당김) / 로딩: 증감 계산은 로컬 동기 계산이라 로딩 없음 / 전년 데이터 없음은 기존 문구 유지.
- 카드 제목 3종: 간격 25일 이상이면 "11/5 → 12/5 변화", 25일 미만이면 "12월 변화 · 진행 중", 전월 결산이면 "11월 결산이 준비됐어요".

## 2. 자산 변화 화면 (`#activity/change`, 기존 net-asset-chart + profit-chart 합류)
위→아래
1. 제목 "자산 변화" + 현재 범위 상시 표시 칩: `rounded bg-primary/10 text-primary text-xs font-semibold px-1.5 py-0.5` "전체 자산" / "주식" (스크롤해도 문맥 유지가 목적이라 화면 최상단 고정 위치, 범위 토글과 같은 행).
2. 범위 토글 (전체 / 주식): `tabList2/tabTrigger2` (2단계 캡슐). 기본 전체. 컨트롤은 접힘 밖(design-system §4).
3. 기간 탭 (일 / 주 / 월 / 연): `tabList3/tabTrigger3` 4등분 `flex-1`. 375px에서 각 탭 약 80px 이상, 높이 40px 이상 확보(`py-2.5`로 보정).
4. 탭별 본문
   - 전체·일: 기존 일별 캘린더 / 전체·연: 기존 연도별 차트·수동 입력 그대로.
   - 전체·주: 섹션 외피 1개. 헤더 칩 "최근 7일", 한 줄 요약 `SpecRow` "7일 전 대비 +1,234만" 아래 날짜 행 최대 7개(날짜 · 순자산 · 전일 대비). 7일 미만이면 있는 만큼 + 한 줄 "기록이 쌓이면 더 보여드려요".
   - 전체·월: §3 결산 블록.
   - 주식·일/주/월/연: 기존 `ProfitCard` 그대로(국내/해외·기준 표기 유지). 월 탭에 결산 블록 없음.
- 뒤로가기/해시: 옛 `#activity/netasset`·`#activity/profit`은 리다이렉트(spec §7).

## 3. 전체·월 탭 결산 블록 (위→아래, 섹션 외피 `rounded-xl bg-card shadow-sm p-4 space-y-3`, 섹션 gap-3)
**블록 1 헤더**: 아이콘 칩(`CalendarCheck`, brand 톤) + 제목 "11월 결산" (`text-sm sm:text-base font-bold`) / 둘째 줄 `text-sm text-muted-foreground` "10/31 → 11/30 기준" / 우측 월 선택기 `InlineSelector`(Option에 `testId?` 추가, 소비처에서 `className="max-w-full overflow-x-auto"`·`size="lg"`로 375px·40px 확보, 저장된 달만 활성, 나머지 native `disabled`, 연 경계 정렬, 최대 13개). 간격 35일 초과 시 한 줄 "기록 간격이 길어 40일 구간이에요". 레거시는 날짜 대신 "2025-11 기록 기준". 진행 중(25일 미만)은 제목 옆 뱃지 "진행 중".

**블록 2 순자산 비교**: `SpecRow` 2줄 — "지난 기록 (10/31)" 값 / "이번 기록 (11/30)" 값(`font-bold`). 아래 구분선 후 증감 한 줄 `text-lg font-bold` "+1,234만 (+3.2%)" (`getProfitLossColor`, 상승 빨강·하락 파랑). 일부 자산 이전 값이면 `text-sm text-muted-foreground` "일부 자산은 이전 값 기준이에요".

**블록 3 변화 원인**: 소제목 뱃지 "무엇이 바꿨나요" + 행 최대 5개: 시세 변동 / 평가 갱신 / 환율 효과 / 순유입 / 기록 안 된 변화. 행 = `SpecRow`(라벨 좌, 금액 우 `getProfitLossColor`) + 필요 시 "예측"/"일부 예측" 배지(`rounded bg-muted text-xs px-1.5`, `shrink-0`). 0원 항목 숨김. 순유입 라벨에 `InfoHint`(summary "입금에서 출금을 뺀 금액이에요"). 기록 안 된 변화 ≥50%면 행 아래 `text-sm text-muted-foreground` 안내 한 줄. 매수·매도·상환 문구 사용 금지. 항목이 전부 0이면 블록 3은 "뚜렷한 변화 원인이 없어요" 한 줄.

**블록 7 다음 달 준비**: 소제목 "다음 달 준비". (a) 갱신이 필요한 자산 목록: 행 = 카테고리명 · "N일 전 값 기준"(`text-sm text-muted-foreground`) · 우측 `ChevronRight`, 행 전체가 버튼(높이 40px 이상) → 기존 입력 화면. 없으면 "모든 자산이 최근 값이에요". (b) `Button variant="brand"` 전폭 "캘린더에 매월 결산일 추가" (`.ics` 다운로드). 버튼 아래 항상 노출 `text-sm text-muted-foreground` "캘린더 앱에서 매월 말일 저녁에 반복 일정을 추가해 주세요".

## 4. 상태 총괄 (전체·월 탭)
| 상태 | 표시 |
|---|---|
| 기본 | 블록 1·2·3·7 |
| 로딩 | 로컬 계산이라 스켈레톤 없음. 환율 미수신 시 환율 효과 행만 숨김 |
| 빈(스냅샷 0·자산 0) | 블록 1 대신 `text-muted-foreground` 중앙 "아직 기록된 달이 없어요. 앱을 계속 쓰면 다음 달부터 결산이 열려요" (테스트ID `settlement-empty`) |
| 첫 달(스냅샷 1개) | "다음 달부터 결산이 열려요" 동일 컨테이너, 허브 카드 숨김 |
| 예측 / N일 전 값 | 항목 "예측"·"일부 예측" 배지, 블록 2 한 줄, 블록 7 "N일 전 값 기준" |
| 간격 25일 이상 | 제목 "11/5 → 12/5 변화", "진행 중" 없음 |
| 간격 25일 미만(진행 중) | 제목 "12월 변화 · 진행 중" |
| 간격 35일 초과 | 헤더 보조 한 줄 |
| 오류(계산 실패·잘못된 스냅샷) | 월 탭 영역에 "결산을 불러오지 못했어요. 다른 달을 선택해 보세요" + 월 선택기는 유지 |
| `.ics` 실패 | 안내 문구가 이미 상시 노출이라 추가 토스트 "일정 파일을 만들지 못했어요" 1회 |

## 5. 앱 문구 모음 (존댓말, 재촉·투자 권유 금지)
허브 부제 "자산 변화·배당·성적표를 확인하세요" · 카드 "11월 결산이 준비됐어요" / "11/5 → 12/5 변화" / "12월 변화 · 진행 중" · 범위 "전체 자산"/"주식" · 기간 "일/주/월/연" · 첫 달 "다음 달부터 결산이 열려요" · 블록명 "N월 결산", "지난 기록", "이번 기록", "무엇이 바꿨나요", "다음 달 준비" · 안내 "이번 달 입출금을 기록하면 더 정확해져요" · "일부 자산은 이전 값 기준이에요" · 성적표 링크 "순자산 변화, 왜?" 유지.

## 6. 공유 이미지 (`data-screenshot-hide`)
결산 화면은 공유 기능 없음(v2 제외). 다만 화면 캡처 시 개인 조작 요소는 숨긴다: 월 선택기, 범위·기간 탭, 블록 7 전체(갱신 목록·캘린더 버튼·안내), 허브 결산 카드 화살표(`ChevronRight`는 KpiCard 기존 그대로), 정보 `InfoHint` 아이콘. 블록 1·2·3은 노출(금액은 기존 금액 숨김 설정 따름).

## 7. 모션·접근성
진입 `motion-safe:animate-in fade-in slide-in-from-bottom-3`(기존 허브와 동일), 카드·행 press `active:scale-[0.98]`(KpiCard 내장), `transition: all` 금지. 모든 터치 대상 40×40 이상, 월 선택기 비활성 항목은 native `disabled`. 색만으로 상승/하락을 구분하지 않고 +/- 부호 병기.

## 8. qa 고정 셀렉터 (data-testid)
| 위치 | testid |
|---|---|
| 허브 결산 카드 | `settlement-card` |
| 허브 카드 3종 | `hub-card-change`, `hub-card-dividend`, `hub-card-report` |
| 범위 칩 | `change-scope-label` |
| 범위 토글 | `change-scope-all`, `change-scope-stock` |
| 기간 탭 | `change-period-day`, `change-period-week`, `change-period-month`, `change-period-year` |
| 전체·주 목록 | `week-list`, `week-row` |
| 월 탭 루트 | `settlement-root` |
| 헤더 / 구간 / 간격 경고 / 진행 중 뱃지 | `settlement-title`, `settlement-range`, `settlement-gap-note`, `settlement-inprogress` |
| 월 선택기 / 항목(비활성 셀렉터 `[data-testid=settlement-month-item][disabled]`) | `settlement-month-select`, `settlement-month-item` |
| 순자산 비교 | `settlement-prev-value`, `settlement-curr-value`, `settlement-delta`, `settlement-stale-note` |
| 변화 원인 행 | `cause-row-price`, `cause-row-valuation`, `cause-row-fx`, `cause-row-income`, `cause-row-unrecorded`, 안내 `cause-unrecorded-hint`, 예측 배지 `cause-estimated-badge` |
| 다음 달 준비 | `prep-stale-row`, `prep-stale-empty`, `prep-ics-button`, `prep-ics-note` |
| 빈/첫 달/오류 | `settlement-empty`, `settlement-first-month`, `settlement-error` |

모든 testid는 해당 상태에서 요소가 없으면 DOM에 없어야 한다(숨김 처리 금지, 0원 항목·기간 밖 카드 포함). 숫자는 `data-value` 속성에 원값(원 단위 정수)을 병기해 qa가 합계 항등식을 검사한다(행 `cause-row-*`, `settlement-delta`).

planner-designer ui.md 작성 완료

## 교차 검토 (developer)
코드 확인 결과(main 4234d0d): `KpiCard`·`InlineSelector`·`InfoHint`(`layout/ui/`), `ASSET_THEME.tabList1~3/tabTrigger1~3`, `getProfitLossColor`(theme.ts:175), `formatShortCurrency`·`formatPriceByMode`(number-utils.ts), lucide `CalendarCheck`, `data-screenshot-hide` 관행은 모두 실제로 있다. `data-testid`는 현재 src에서 쓰는 곳이 0건이라 이번이 신규 관행이다(KB 등록 대상). 구현은 가능하다.

수정 요청: 아래 2건
1. **월 선택기(블록 1)에 `InlineSelector`를 그대로 쓸 수 없다.** 이유: ① 컨테이너가 `inline-flex`이고 줄바꿈·스크롤이 없어 13개 항목이 375px에 들어가지 않는다. ② 기본 size의 버튼 높이가 약 30px라 §7의 40px 기준을 넘지 못한다. ③ 비활성 항목은 native `disabled`로 처리되고 `aria-disabled`는 붙지 않는다. ④ 항목별 testid 슬롯이 없다(`dataTutorial`만 있음). 제안: 컴포넌트 수정은 최소로 한다. Option 타입에 `testId?`를 추가하고, 소비처에서 `className="max-w-full overflow-x-auto"`와 `size="lg"`(py-2)로 감싼다. 비활성 판정 셀렉터는 `[data-testid=settlement-month-item][disabled]`로 바꾼다(`aria-disabled` 문구 삭제).
2. **재사용 근거의 표기를 정정해야 한다.** `SpecRow`·`SectionHeader`는 `asset-report-view.tsx:64,82`의 로컬 함수로, export되지 않는다. "재사용"이 아니라 "공용 파일로 이동(동작 불변) 후 재사용"으로 적고 components.md 등록 대상에 넣을 것. `KpiCard`도 testid와 뱃지 슬롯이 없으므로, `settlement-card`·`hub-card-*` testid는 감싸는 `div`에 붙이고 "이번 달 결산" 뱃지는 `title`(ReactNode)에 넣는다고 명시할 것. 이렇게 하면 KpiCard는 수정하지 않는다.
그 외 구조·상태·문구·testid 목록과 `data-value` 원값 규칙은 구현 가능해 동의한다. 위 2건이 반영되면 승인한다.

반영 완료 (planner-designer): ① InlineSelector 소비처 래핑·testId·[disabled] 안 채택 ② SpecRow·SectionHeader 공용 이동 및 KpiCard 래퍼 div·title 뱃지 명시.

developer 승인
