# 컴포넌트 참조

> 마지막 업데이트: 2026-04-25

## 자산 입력 컴포넌트 (`src/app/(main)/asset/_components/`)

```
_components/
├── input/              # 자산 입력 폼 + 목록 렌더링
│   ├── stock-input.tsx          # 주식 (국내/해외/IRP/ISA/연금/비상장)
│   ├── real-estate-input.tsx    # 부동산
│   ├── cash-input.tsx           # 현금성 자산
│   ├── crypto-input.tsx         # 암호화폐
│   ├── loan-input.tsx           # 대출
│   └── exchange-rate-input.tsx
├── screenshot/         # 스크린샷 가져오기 다이얼로그
│   ├── stock-screenshot-import.tsx   # 3단계: upload→conflict→preview
│   ├── crypto-screenshot-import.tsx  # 2단계: upload→preview (conflict 있음)
│   ├── cash-screenshot-import.tsx    # 2단계: upload→preview (항상 append)
│   └── loan-screenshot-import.tsx    # 2단계: upload→preview (항상 append)
├── detail/
│   ├── asset-detail-tabs.tsx    # 5탭 컨테이너 + 공통 유틸 export
│   └── tabs/
│       ├── stock-tab.tsx        # 주식 상세 (7 서브탭)
│       ├── real-estate-tab.tsx  # 부동산 상세
│       ├── cash-tab.tsx         # 현금 상세
│       ├── crypto-tab.tsx       # 암호화폐 상세
│       └── loan-tab.tsx         # 대출 상세
├── chart/
│   ├── net-asset-chart.tsx      # 순자산 추이 (년도별/월별/일별)
│   ├── profit-chart.tsx         # 수익률 차트
│   ├── dividend-chart.tsx       # 배당 차트
│   └── monthly-dividend-stocks.tsx
├── management/
│   └── floating-add-button.tsx  # 하단 고정 FAB (전 환경)
└── sidebar/
```

### FloatingAddButton (`management/floating-add-button.tsx`)
화면 하단 중앙 fixed FAB. 클릭 → Sheet → 자산 유형 6개 선택 → 방법 선택(스크린샷/직접입력) → CustomEvent dispatch.
- 모바일: `side="top"`, PC/패드: `side="right"` Sheet
- 각 `*-input.tsx` 카드 헤더 추가 버튼은 `hidden` (전체 숨김)
- 이벤트: `trigger-add-{real-estate|stock|crypto|cash|loan|yearly-net-asset}`
  - real-estate, yearly-net-asset: hasScreenshot=false → 바로 dispatch
  - 나머지 4종: `select-method` step → `{ detail: { mode: "screenshot"|"manual" } }` dispatch
- "빠른 이동" 섹션: `navigate-to-tab` CustomEvent dispatch → `AssetDetailTabs`의 탭 전환

### *-input.tsx 공통 구조
1. `XxxForm` — React Hook Form + Zod Dialog 폼
2. `XxxInput` (export) — 목록 렌더링 + CRUD 제어

```
useAssetData() → CRUD 함수
useForm({ resolver: zodResolver(xxxSchema) })
toast.success/error → Sonner
formatCurrency() → number-utils
getProfitLossColor() → config/theme
```

### 스크린샷 다이얼로그 공통 패턴
- `open/onOpenChange` props로 외부 제어
- `useGeminiUsage()` hook으로 클라이언트 하루 한도(10회) 체크
- API 성공 후 `geminiUsage.increment(assetType)` 호출
- **중복 처리:** stock/crypto → merge/reset 선택, cash/loan → 항상 append

---

### stock-input.tsx 카드 레이어

| Layer | 내용 |
|-------|------|
| 1 헤더 | 카테고리 Badge + 종목명 + 티커 + 조회기준일 + 편집/삭제 |
| 2 핵심지표 | 평가금액(좌) / 평가손익·수익률(우, `items-end`) |
| 3 가격비교 | 평균단가 / 현재가 |
| 3b 환차손익 | 해외주식 외화 종목만 |
| 4 주식담보대출 | linkedStockId 연계 대출 |
| 5 보조정보 | 수량 / 보유일 / 매수일 / 설명 |

- **정렬:** 평가금액(원화 환산) 내림차순 → 동일 시 이름순
- **탭:** 전체/국내/해외/IRP/ISA/연금/비상장 (7탭)
- `lookupState`: `"idle"|"success"|"failed"` — idle 시 종목명·현재가 숨김

### stock-screenshot-import.tsx conflict 처리
- **덮어쓰기(merge):** 스크린샷 ticker 제거 후 전체 push
- **초기화(reset):** 기존 주식 전부 제거 후 스크린샷만 등록
- ticker 없는 종목: `saveAssetDataRaw()` 우회 저장 후 `refreshData()`
- ESC·바깥 클릭으로 닫히지 않음 (취소 버튼만)

---

## 대시보드 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| AssetOverviewCards | `asset-overview-cards.tsx` | 총자산/순자산/손익 요약 |
| AssetDistributionCards | `asset-distribution-cards.tsx` | 자산군별 분포. 모바일: Tabs, 데스크탑: lg:grid-cols-2 |
| AssetDetailTabs | `detail/asset-detail-tabs.tsx` | 주식/부동산/암호화폐/현금/대출 5탭 상세 목록. `navigate-to-tab` 이벤트 수신 |
| NetAssetChart | `chart/net-asset-chart.tsx` | 순자산 추이 — 년도별/월별/일별. `trigger-add-yearly-net-asset` 이벤트 수신 |
| ProfitChart | `chart/profit-chart.tsx` | 수익률 차트 |
| DividendChart | `chart/dividend-chart.tsx` | 배당 차트 |

### page.tsx 3탭 구조
- **분포** (`distribution`): AssetDistributionCards
- **상세** (`detail`): AssetDetailTabs — 탭 접속 시 `syncStockPricesAndSnapshots` 호출
- **차트** (`chart`): 순자산/수익/배당 차트

---

## 사이드바 컴포넌트 (`sidebar/`)

AppSidebar, NavMain, NavUser, ThemeSwitcher, CustomSidebarTrigger

---

## shadcn/ui 주요 컴포넌트 (`src/components/ui/`)

```
Button, Input, NumberInput(커스텀), Label, Badge
Card, CardHeader, CardTitle, CardDescription, CardContent
Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
Form, FormField, FormItem, FormLabel, FormControl, FormMessage
Select, Tabs, Textarea, Separator, Skeleton, toast(Sonner)
```

**NumberInput** (`number-input.tsx`): `value`, `onChange`, `quickButtons[]`, `allowDecimals`, `maxDecimals` — 천 단위 콤마 자동 포맷

---

## 카드 레이아웃 패턴

```tsx
<div className="rounded-lg border bg-card overflow-hidden">
  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/20 border-b">  {/* 헤더 */}
  <div className="flex flex-row items-start justify-between p-4">  {/* 핵심지표 */}
  <div className="px-4 py-3 bg-muted/10 border-t">  {/* 보조 섹션 */}
  <div className="px-4 py-2.5 flex flex-wrap text-xs text-muted-foreground border-t bg-muted/5">  {/* 하단 메타 */}
</div>
```
