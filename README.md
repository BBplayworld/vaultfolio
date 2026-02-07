# 개인 자산 평가서 (Personal Asset Management)

**개인 자산 관리 웹 애플리케이션** - Next.js와 Shadcn UI로 구축된 모던한 자산 관리 플랫폼

## 프로젝트 소개

개인 자산 평가서는 부동산, 주식, 암호화폐 등 다양한 자산을 한 곳에서 관리하고 모니터링할 수 있는 웹 애플리케이션입니다.
로그인이나 서버 없이 브라우저의 LocalStorage를 활용하여 완전히 클라이언트 측에서 데이터를 관리합니다.

### 주요 기능

- 🏠 **부동산 자산 관리**: 아파트, 주택, 토지, 상가 등 다양한 부동산 자산 등록 및 관리
- 📈 **주식 자산 관리**: 국내주식, 해외주식, IRP, ISA, 연금저축펀드, 비상장주식 분류 관리
- ₿ **암호화폐 자산 관리**: 보유 중인 코인 자산 추적 및 평가
- 📊 **대시보드**: 전체 자산 현황을 한눈에 파악할 수 있는 시각화 대시보드
- 💾 **데이터 가져오기/내보내기**: JSON 형식으로 자산 데이터 백업 및 복원
- 🔒 **완전한 프라이버시**: 모든 데이터는 브라우저에만 저장되며 서버로 전송되지 않음

### 기술 스택

- **Framework**: Next.js 15 (App Router), TypeScript, Tailwind CSS v4
- **UI Components**: Shadcn UI
- **Data Management**: LocalStorage
- **Validation**: Zod
- **Forms**: React Hook Form
- **Charts**: Recharts

## 시작하기

### 로컬에서 실행하기

1. **의존성 설치**
   ```bash
   npm install
   ```

2. **개발 서버 시작**
   ```bash
   npm run dev
   ```

3. **브라우저에서 접속**
   
   [http://localhost:3000/dashboard/asset](http://localhost:3000/dashboard/asset) 으로 접속하여 자산 관리 페이지를 확인하세요.

### 사용 방법

1. **자산 추가**: 각 카테고리(부동산, 주식, 코인)별로 자산 정보를 입력합니다.
2. **대시보드 확인**: 전체 자산 분포와 평가금액을 시각적으로 확인합니다.
3. **데이터 백업**: '데이터 내보내기' 버튼을 눌러 JSON 파일로 자산 데이터를 저장합니다.
4. **데이터 복원**: 백업한 JSON 파일을 '데이터 가져오기'로 불러올 수 있습니다.

## 프로젝트 구조

```
src/
├── app/(main)/dashboard/asset/    # 자산 관리 페이지
│   ├── _components/               # 자산 관련 컴포넌트
│   │   ├── asset-overview-cards.tsx
│   │   ├── asset-distribution-cards.tsx
│   │   ├── asset-management-card.tsx
│   │   ├── real-estate-input.tsx
│   │   ├── stock-input.tsx
│   │   └── crypto-input.tsx
│   └── page.tsx
├── types/
│   └── asset.ts                   # 자산 데이터 타입 정의
├── lib/
│   └── asset-storage.ts           # LocalStorage 관리 유틸리티
└── hooks/
    └── use-asset-data.ts          # 자산 데이터 관리 훅
```

## 데이터 구조

모든 자산 데이터는 다음과 같은 JSON 구조로 LocalStorage에 저장됩니다:

```json
{
  "realEstate": [...],
  "stocks": [...],
  "crypto": [...],
  "lastUpdated": "2026-02-07T..."
}
```

---

## 원본 템플릿

이 프로젝트는 [Next.js Shadcn Admin Dashboard](https://github.com/arhamkhnz/next-shadcn-admin-dashboard)를 기반으로 제작되었습니다.

**Happy Asset Managing!**
