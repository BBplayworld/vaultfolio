# 🎨 자산 관리 색상 테마 가이드

## 📍 색상 테마 파일 위치

**`src/config/theme.ts`** - 모든 자산 관련 색상을 중앙에서 관리하는 파일

## 🎯 색상 테마 구조

### 1. **주요 테마 색상 (청록/Teal)** - `ASSET_THEME.primary`
순자산, 중요한 정보, 강조 표시에 사용

```typescript
primary: {
  bg: "bg-primary",                    // 배경
  bgLight: "bg-primary/10",            // 연한 배경
  bgMedium: "bg-primary/5",            // 매우 연한 배경
  border: "border-primary",            // 테두리
  borderLight: "border-primary/20",    // 연한 테두리
  text: "text-primary",                // 텍스트
  textLight: "text-primary/70",        // 연한 텍스트
}
```

### 2. **수익 색상 (초록/Emerald)** - `ASSET_THEME.profit`
양수 값, 수익, 증가에 사용

```typescript
profit: {
  light: "text-emerald-600 dark:text-emerald-400",
  bg: "bg-emerald-600 dark:bg-emerald-400",
  border: "border-emerald-600 dark:border-emerald-400",
}
```

### 3. **손실 색상 (빨강/Rose)** - `ASSET_THEME.loss`
음수 값, 손실, 대출에 사용

```typescript
loss: {
  light: "text-rose-600 dark:text-rose-400",
  bg: "bg-rose-600 dark:bg-rose-400",
  bgLight: "bg-rose-50 dark:bg-rose-950/30",
  border: "border-rose-200 dark:border-rose-900",
}
```

### 4. **보증금/기타 색상 (주황/Amber)** - `ASSET_THEME.secondary`
임차인 보증금, 코인 심볼, 기타 보조 정보에 사용

```typescript
secondary: {
  light: "text-amber-600 dark:text-amber-400",
  bg: "bg-amber-600 dark:bg-amber-400",
  bgVeryLight: "bg-orange-500/10",
  text: "text-orange-600 dark:text-orange-400",
}
```

### 5. **기본 색상**

```typescript
background: {
  default: "bg-background",  // 기본 배경 (검정)
  dark: "bg-card",
}

text: {
  default: "text-foreground",        // 일반 텍스트 (화이트)
  muted: "text-muted-foreground",    // 보조 텍스트 (회색)
  white: "text-white",
}
```

## 🔧 사용 방법

### 기본 사용

```tsx
import { ASSET_THEME } from "@/config/theme";

// 주요 테마 색상 (청록)
<div className={ASSET_THEME.primary.bg}>순자산</div>
<span className={ASSET_THEME.primary.text}>중요한 정보</span>

// 수익 색상 (초록)
<span className={ASSET_THEME.profit.light}>+10%</span>

// 손실 색상 (빨강)
<span className={ASSET_THEME.loss.light}>-5%</span>

// 보증금 색상 (주황)
<span className={ASSET_THEME.secondary.light}>보증금</span>
```

### 헬퍼 함수 사용

```tsx
import { getProfitLossColor } from "@/config/theme";

// 수익/손실에 따라 자동으로 색상 반환
<span className={getProfitLossColor(profit)}>
  {profit >= 0 ? '+' : ''}{profit}%
</span>
```

## 🎨 색상 변경 방법

### 전체 색상 테마 변경하기

`src/config/theme.ts` 파일에서 원하는 색상만 변경하면 모든 페이지에 자동 적용됩니다.

#### 예시 1: 주요 테마 색상을 파랑으로 변경

```typescript
// 기존 (청록)
primary: {
  text: "text-primary",  // teal 색상
  ...
}

// 변경 후 (파랑)
primary: {
  text: "text-blue-600 dark:text-blue-400",
  bg: "bg-blue-600 dark:bg-blue-400",
  bgLight: "bg-blue-600/10",
  border: "border-blue-600",
  ...
}
```

#### 예시 2: 수익 색상을 청록으로 변경

```typescript
// 기존 (초록)
profit: {
  light: "text-emerald-600 dark:text-emerald-400",
  ...
}

// 변경 후 (청록)
profit: {
  light: "text-teal-600 dark:text-teal-400",
  bg: "bg-teal-600 dark:bg-teal-400",
  ...
}
```

## 📦 적용된 컴포넌트 목록

현재 테마가 적용된 주요 컴포넌트:

1. ✅ `asset-overview-cards.tsx` - 상단 자산 요약 카드
2. ⏳ `asset-distribution-cards.tsx` - 자산 분포 차트 (작업 중)
3. ⏳ `real-estate-input.tsx` - 부동산 입력 (작업 중)
4. ⏳ `stock-input.tsx` - 주식 입력 (작업 중)
5. ⏳ `crypto-input.tsx` - 암호화폐 입력 (작업 중)
6. ⏳ `loan-input.tsx` - 대출 입력 (작업 중)

## 🌈 Tailwind CSS 색상 참고

사용 가능한 Tailwind 색상 목록:

- **청록 계열**: `teal-500`, `teal-600`, `cyan-500`, `cyan-600`
- **초록 계열**: `emerald-500`, `emerald-600`, `green-500`, `green-600`
- **빨강 계열**: `rose-500`, `rose-600`, `red-500`, `red-600`
- **주황 계열**: `amber-500`, `amber-600`, `orange-500`, `orange-600`
- **파랑 계열**: `blue-500`, `blue-600`, `sky-500`, `sky-600`
- **보라 계열**: `purple-500`, `purple-600`, `violet-500`, `violet-600`

각 색상은 `50` ~ `950` 사이의 명도를 가지며, 다크 모드에서는 일반적으로 더 밝은 색상(400~500)을 사용합니다.

## 💡 팁

1. **일관성 유지**: 한 파일(`src/config/theme.ts`)에서만 색상을 관리하여 일관성 유지
2. **다크 모드 고려**: 모든 색상은 라이트/다크 모드에서 잘 보이도록 설정됨
3. **접근성**: 색상 대비가 충분한지 확인 (특히 텍스트 색상)
4. **테스트**: 색상 변경 후 모든 페이지에서 시각적으로 확인

## 🔗 관련 파일

- **색상 설정**: `src/config/theme.ts`
- **앱 설정**: `src/config/app.ts`
- **스토리지 설정**: `src/config/storage.ts`
- **통합 import**: `src/config/index.ts`
- **글로벌 CSS**: `src/app/globals.css`
- **Tailwind 설정**: `tailwind.config.ts`
