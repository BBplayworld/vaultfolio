# 컴포넌트 참조

> 마지막 업데이트: 2026-04-26

## 자산 입력 컴포넌트 (`src/app/(main)/asset/_components/`)

```
_components/
├── bottom-nav/asset-update/
│   ├── input/              # 자산 입력 폼 + 목록 렌더링
│   │   ├── stock-input.tsx          # 주식 (국내/해외/IRP/ISA/연금/비상장)
│   │   ├── real-estate-input.tsx    # 부동산
│   │   ├── cash-input.tsx           # 현금성 자산
│   │   ├── crypto-input.tsx         # 암호화폐
│   │   ├── loan-input.tsx           # 대출
│   │   └── exchange-rate-input.tsx
│   └── screenshot/         # 스크린샷 가져오기 다이얼로그
│       ├── stock-screenshot-import.tsx   # 3단계: upload→conflict→preview
│       ├── crypto-screenshot-import.tsx  # 2단계: upload→preview (conflict 있음)
│       ├── cash-screenshot-import.tsx    # 2단계: upload→preview (항상 append)
│       └── loan-screenshot-import.tsx    # 2단계: upload→preview (항상 append)
├── main-nav/
│   ├── home/dashboard.tsx
│   ├── detail/
│   │   ├── asset-detail-tabs.tsx    # 5탭 컨테이너 + 공통 유틸 export
│   │   └── tabs/
│   │       ├── stock-tab.tsx        # 주식 상세 (7 서브탭)
│   │       ├── real-estate-tab.tsx  # 부동산 상세
│   │       ├── cash-tab.tsx         # 현금 상세
│   │       ├── crypto-tab.tsx       # 암호화폐 상세
│   │       └── loan-tab.tsx         # 대출 상세
│   └── activity/
│       ├── net-asset-chart.tsx      # 순자산 추이 (년도별/월별/일별)
│       ├── profit-chart.tsx         # 수익 차트 (기준가 대비 현재금액)
│       └── dividend-chart.tsx       # 배당 차트 (제거됨 → DividendCard로 통합)
└── layout/
    ├── floating-add-button.tsx      # 하단 고정 FAB (전 환경)
    ├── welcome-guide.tsx
    └── copyright-footer.tsx
```

### FloatingAddButton (`layout/floating-add-button.tsx`)
화면 하단 중앙 fixed FAB. 클릭 → Sheet → 자산 유형 6개 선택 → 방법 선택(스크린샷/직접입력) → CustomEvent dispatch.
- 모바일: `side="top"`, PC/패드: `side="right"` Sheet
- 각 `*-input.tsx` 카드 헤더 추가 버튼은 `hidden` (전체 숨김)
- 이벤트: `trigger-add-{real-estate|stock|crypto|cash|loan|yearly-net-asset}`
  - real-estate, yearly-net-asset: hasScreenshot=false → 바로 dispatch
  - 나머지 4종: `select-method` step → `{ detail: { mode: "screenshot"|"manual" } }` dispatch
- "빠른 이동" 섹션: `navigate-to-tab` CustomEvent dispatch → page.tsx의 탭 전환

### *-input.tsx 공통 구조
1. `XxxForm` — React Hook Form + Zod Dialog 폼
2. `XxxInput` (export) — 목록 렌더링 + CRUD 제어
- `hideList` prop: 목록 숨김 (page.tsx inputLayer에서 사용)

```
useAssetData() → CRUD 함수
useForm({ resolver: zodResolver(xxxSchema) })
toast.success/error → Sonner
formatCurrency() → number-utils
getProfitLossColor() → config/theme
```

### 스크린샷 다이얼로그 공통 패턴
- `open/onOpenChange` props로 외부 제어
- `useGeminiUsage()` hook으로 클라이언트 하루 한도(15회) 체크
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

### stock-tab.tsx export 목록 (share-card에서 재사용)
- `StockBarChart` — 비중 바 + 범례
- `StockRowItem` — 단일 종목 로우 (인증샷용)
- `StockSummaryHeader` — 주식 요약 헤더 (평가금액/손익/환차손익)
- `useFilteredStockData(activeCategory)` — 필터된 주식 계산 훅
- `CATEGORY_TABS` — 탭 정의

### stock-screenshot-import.tsx conflict 처리
- **덮어쓰기(merge):** 스크린샷 ticker 제거 후 전체 push
- **초기화(reset):** 기존 주식 전부 제거 후 스크린샷만 등록
- ticker 없는 종목: `saveAssetDataRaw()` 우회 저장 후 `refreshData()`
- ESC·바깥 클릭으로 닫히지 않음 (취소 버튼만)

---

## 대시보드 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| Dashboard | `main-nav/home/dashboard.tsx` | 총자산/순자산/손익 요약 + 분포 |
| AssetDetailTabs | `main-nav/detail/asset-detail-tabs.tsx` | 주식/부동산/암호화폐/현금/대출 5탭 상세 목록 |
| YearlyNetAssetChart | `main-nav/activity/net-asset-chart.tsx` | 순자산 추이 — 년도별/월별/일별. `trigger-add-yearly-net-asset` 이벤트 수신 |
| ProfitCard | `main-nav/activity/profit-chart.tsx` | 수익 차트 (기준가 대비 현재금액) |
| DividendCard | `main-nav/activity/dividend-chart.tsx` | 배당 카드 |

### top-nav (`top-nav/`)
- `ShareScreenshotButton` → `ShareScreenshotDialog` → `ShareCard` (인증샷 생성)
- `ThemeSwitcher`, `NavUser(tool-menu)`, `GuideMiniButton`

---

## shadcn/ui 주요 컴포넌트 (`src/components/ui/`)

```
Button, Input, NumberInput(커스텀), Label, Badge
Card, CardHeader, CardTitle, CardDescription, CardContent
Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
Form, FormField, FormItem, FormLabel, FormControl, FormMessage
Select, Tabs, Textarea, Separator, Skeleton, toast(Sonner)
Collapsible, CollapsibleContent, CollapsibleTrigger
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

## config/theme.ts 주요 항목

```typescript
ASSET_THEME = {
  tabList1/tabTrigger1,  // 페이지 메인 탭 (홈/상세/성과)
  tabList2/tabTrigger2,  // 2단계 탭 (순자산/수익/배당)
  tabList3/tabTrigger3,  // 3단계 서브탭 (국내/해외/IRP 등)
  tabList3Wrap/tabTrigger3Wrap,  // 래핑 변형
  categoryBox, todayBox, inputHeader, liabilityBadge,
  important, liability, profit, loss,
  realEstateTypeColors, distributionCard,
}
MAIN_PALETTE  // 10색 팔레트 (인덱스 고정: 0=최대비율, 1=대출, 2=임차보증금)
getProfitLossColor(value)  // >0 수익색 / <0 손실색
```
