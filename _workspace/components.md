# 컴포넌트 참조

> 마지막 업데이트: 2026-04-06

## 자산 입력 컴포넌트 (`src/app/(main)/asset/_components/`)

### *-input.tsx 공통 구조

각 파일은 두 부분으로 구성:
1. `XxxForm` — React Hook Form + Zod Dialog 폼
2. `XxxInput` (export) — 목록 렌더링 + CRUD 제어

```
useAssetData() → CRUD 함수 사용
useForm({ resolver: zodResolver(xxxSchema) })
toast.success/error → Sonner
formatCurrency() → number-utils
getProfitLossColor() → config/theme
```

---

### stock-input.tsx

**탭:** 전체 / 국내 / 해외 / IRP / ISA / 연금 / 비상장 (7탭)

**카드 레이어 구조:**
| Layer | 내용 |
|-------|------|
| 1 (헤더) | 카테고리 Badge + 종목명 + 티커 + 조회기준일 + 편집/삭제 버튼 |
| 2 (핵심지표) | 평가금액(좌) / 평가손익·수익률(우, 항상 우측정렬 `items-end`) |
| 3 (가격비교) | 평균단가 / 현재가 |
| 3b (환차손익) | 해외주식 외화 종목만 표시 |
| 4 (주식담보대출) | linkedStockId 연계 대출 표시 |
| 5 (보조정보) | 수량 / 보유일 / 매수일 / 설명 |

**수익률 표시:** 금액과 분리된 독립 줄 (`text-xs font-semibold`)
**환차손익 표시:** Layer 2에 `(환차손익 xxx 포함)` + Layer 3b 별도 섹션

**주식 정렬:** 평가금액(원화 환산) 내림차순 → 동일 금액 시 이름순

---

### real-estate-input.tsx

**카드 레이어 구조:**
- 부동산 유형 + 이름 + 주소
- 현재가 / 매입가 / 평가손익
- 임차인 보증금 (있을 때만)
- 연계 대출 (linkedRealEstateId)
- 보유일 / 매수일

---

### cash-input.tsx

- 현금 유형 (bank/cma/cash/deposit/savings)
- 통화 (KRW/USD/JPY) — 외화는 원화 환산 표시
- 금융기관

---

### crypto-input.tsx

- 심볼 (예: BTC)
- 거래소 (cryptoExchanges 옵션)
- 수량 / 평균단가 / 현재가

---

### loan-input.tsx

- 대출 유형 7종 (credit/minus/mortgage-*)
- 잔액 / 금리
- 담보 자산 연계 (realEstate / cash / stock 중 하나)
- 연계된 주식 카드에 담보대출 섹션 자동 표시

---

### exchange-rate-input.tsx

- 현재 USD/JPY 환율 표시
- 수동 입력 또는 API 조회로 갱신
- `updateExchangeRate()` → AssetDataContext

---

## 대시보드 컴포넌트

| 컴포넌트 | 파일 | 역할 |
|----------|------|------|
| AssetOverviewCards | `asset-overview-cards.tsx` | 총자산/순자산/손익 요약 카드 |
| AssetDistributionCards | `asset-distribution-cards.tsx` | 자산군별 분포 (파이 또는 바) |
| YearlyNetAssetChart | `yearly-net-asset-chart.tsx` | Recharts 연도별 순자산 추이 |
| AssetManagementCard | `asset-management-card.tsx` | 내보내기/가져오기/초기화/공유 |
| WelcomeGuide | `welcome-guide.tsx` | 최초 실행 시 가이드 |
| CopyrightFooter | `copyright-footer.tsx` | 버전·저작권 |

---

## 사이드바 컴포넌트 (`sidebar/`)

| 컴포넌트 | 역할 |
|----------|------|
| AppSidebar | 메인 사이드바 컨테이너 |
| NavMain | 네비게이션 항목 렌더링 |
| NavUser | 사용자 프로필 (rootUser) |
| ThemeSwitcher | 라이트/다크 테마 전환 |
| CustomSidebarTrigger | 모바일 햄버거 버튼 |

---

## shadcn/ui 주요 컴포넌트 (`src/components/ui/`)

프로젝트에서 자주 쓰이는 컴포넌트:

```
Button, Input, NumberInput (커스텀), Label, Badge
Card, CardHeader, CardTitle, CardDescription, CardContent
Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription
Select, SelectTrigger, SelectValue, SelectContent, SelectItem
Tabs, TabsList, TabsTrigger, TabsContent
Textarea, Separator, Skeleton
toast (Sonner)
```

**NumberInput** (`src/components/ui/number-input.tsx`): 커스텀 컴포넌트
- `value`, `onChange`, `placeholder`, `quickButtons[]`
- `allowDecimals`, `maxDecimals`
- 천 단위 콤마 자동 포맷
