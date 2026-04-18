# 컴포넌트 참조

> 마지막 업데이트: 2026-04-17

## 자산 입력 컴포넌트 (`src/app/(main)/asset/_components/`)

### 디렉토리 구조

```
_components/
├── input/              # 자산 입력 폼 + 목록 렌더링
│   ├── stock-input.tsx
│   ├── real-estate-input.tsx
│   ├── cash-input.tsx
│   ├── crypto-input.tsx
│   ├── loan-input.tsx
│   └── exchange-rate-input.tsx
├── screenshot/         # 스크린샷 가져오기 다이얼로그
│   └── stock-screenshot-import.tsx
└── sidebar/            # 사이드바 관련
    └── ...
```

> **자산 입력 화면은 항상 `input/` 하위 5개 파일로만 구성된다:**
> - `input/stock-input.tsx` — 주식 (국내/해외/IRP/ISA/연금/비상장)
> - `input/real-estate-input.tsx` — 부동산
> - `input/cash-input.tsx` — 현금성 자산
> - `input/crypto-input.tsx` — 암호화폐
> - `input/loan-input.tsx` — 대출

> **스크린샷 다이얼로그는 `screenshot/` 하위에 위치:**
> - `screenshot/stock-screenshot-import.tsx` — 주식 스크린샷 가져오기
> - `screenshot/crypto-screenshot-import.tsx` — 암호화폐 스크린샷 가져오기
> - `screenshot/cash-screenshot-import.tsx` — 현금성 자산 스크린샷 가져오기 (conflict 단계 없음, 항상 append)
> - `screenshot/loan-screenshot-import.tsx` — 대출 스크린샷 가져오기 (conflict 단계 없음, 항상 append)

**스크린샷 다이얼로그 공통 패턴:**
- `open/onOpenChange` props로 외부 제어 (각 input 컴포넌트의 `isScreenshotOpen` state와 연동)
- `useGeminiUsage()` hook으로 클라이언트 하루 한도(10회) 체크·표시
- upload → (conflict) → preview 3단계 (cash/loan은 2단계: upload → preview)
- API 성공 후 `geminiUsage.increment(assetType)` 호출

**중복 처리 전략:**
- stock: ticker 기준 → merge/reset 선택
- crypto: symbol 기준 → merge/reset 선택
- cash/loan: 고유 식별자 없음 → 항상 기존 목록에 append

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

---

### stock-screenshot-import.tsx

**파일:** `src/app/(main)/asset/_components/stock-screenshot-import.tsx`
**Props:** `open?: boolean`, `onOpenChange?: (open: boolean) => void` (controlled/uncontrolled 양쪽 지원)

3단계 다이얼로그 플로우로 스크린샷 기반 주식 일괄 가져오기.

**단계:**
| step | 내용 |
|------|------|
| `upload` | 이미지 드래그앤드롭 또는 클릭 업로드. AI 인식 중 오버레이 차단. |
| `conflict` | 기존 주식과 ticker 중복 발생 시 처리 방식 선택 (덮어쓰기 / 초기화 후 등록) |
| `preview` | 종목별 선택·카테고리 변경·ticker 직접 입력. 등록 버튼으로 확정. |

**conflict 처리 로직 (`handleRegister`):**
- **덮어쓰기(merge)**: 스크린샷 ticker 목록을 기존에서 제거 후, 스크린샷 종목 전체 push
- **초기화(reset)**: 기존 주식 전부 제거 후 스크린샷 종목만 등록
- ticker 없는 종목은 `saveAssetDataRaw()` 우회 저장 후 `refreshData()`

**UX 특이사항:**
- 다이얼로그: ESC·바깥 클릭으로 닫히지 않음 (취소 버튼만 가능)
- 해외주식: 원화 평가금액 → 현재 USD 환율 자동 변환, USD badge 표시
- 티커 미확인 종목: amber badge + 직접 입력 필드 (대문자+숫자만 허용)
- 중복 교체 대상 종목: `교체` badge 표시

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
