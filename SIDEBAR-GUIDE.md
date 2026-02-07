# 사이드바 메뉴 동작 방식 가이드

## 📁 파일 구조

```
src/
├── data/navigation/sidebar/
│   └── sidebar-items.ts          # 메뉴 데이터 정의
├── app/(main)/dashboard/_components/sidebar/
│   ├── app-sidebar.tsx           # 사이드바 메인 컴포넌트
│   ├── nav-main.tsx              # 메뉴 렌더링 로직
│   ├── nav-user.tsx              # 하단 사용자 정보
│   └── layout-controls.tsx       # 테마/레이아웃 설정
└── components/ui/sidebar.tsx     # Shadcn 사이드바 기본 컴포넌트
```

## 🔄 동작 흐름

### 1. 데이터 정의 (`sidebar-items.ts`)
```typescript
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Asset Management",  // 그룹 라벨
    items: [
      {
        title: "자산 관리",      // 메뉴 이름
        url: "/dashboard/asset", // 이동 경로
        icon: Wallet,            // 아이콘 컴포넌트
        // 선택적 속성:
        // comingSoon: true,     // "Soon" 배지 표시
        // isNew: true,          // "New" 배지 표시
        // newTab: true,         // 새 탭에서 열기
        // subItems: [],         // 하위 메뉴
      },
    ],
  },
];
```

### 2. 사이드바 메인 (`app-sidebar.tsx`)
- `sidebarItems`를 import하여 `NavMain` 컴포넌트에 전달
- 헤더(앱 이름), 컨텐츠(메뉴), 푸터(사용자 정보)로 구성

```typescript
<Sidebar>
  <SidebarHeader>
    {/* 앱 로고/이름 */}
  </SidebarHeader>
  <SidebarContent>
    <NavMain items={sidebarItems} /> {/* 메뉴 렌더링 */}
  </SidebarContent>
  <SidebarFooter>
    <NavUser user={rootUser} />
  </SidebarFooter>
</Sidebar>
```

### 3. 메뉴 렌더링 (`nav-main.tsx`)
- `sidebarItems` 배열을 순회하며 각 그룹과 항목을 렌더링
- 사이드바 상태(expanded/collapsed)에 따라 다른 UI 표시
- 현재 경로(`usePathname`)와 메뉴 URL을 비교하여 활성 상태 표시

**주요 로직:**
```typescript
// 활성 메뉴 판단
const isItemActive = (url: string, subItems?) => {
  if (subItems?.length) {
    return subItems.some((sub) => path.startsWith(sub.url));
  }
  return path === url;
};

// 그룹별로 렌더링
items.map((group) => (
  <SidebarGroup key={group.id}>
    {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
    <SidebarGroupContent>
      <SidebarMenu>
        {group.items.map((item) => (
          // 메뉴 항목 렌더링 (expanded/collapsed에 따라 다름)
        ))}
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
))
```

## 🛠️ 커스터마이징 방법

### 메뉴 추가/수정/삭제
**`sidebar-items.ts` 파일만 수정하면 됩니다!**

```typescript
// 1. 새 메뉴 그룹 추가
export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "내 자산",
    items: [
      {
        title: "자산 관리",
        url: "/dashboard/asset",
        icon: Wallet,
      },
      {
        title: "대출 관리",  // 새 메뉴 추가
        url: "/dashboard/loan",
        icon: CreditCard,
      },
    ],
  },
  {
    id: 2,
    label: "설정",
    items: [...],
  },
];

// 2. 하위 메뉴 추가
{
  title: "자산 관리",
  url: "/dashboard/asset",
  icon: Wallet,
  subItems: [
    { title: "부동산", url: "/dashboard/asset/real-estate" },
    { title: "주식", url: "/dashboard/asset/stocks" },
    { title: "코인", url: "/dashboard/asset/crypto" },
  ],
}
```

### Quick Create 버튼 수정
**`nav-main.tsx` 라인 164-181 수정**

```typescript
<SidebarMenuButton
  onClick={() => {/* 원하는 동작 */}}
  className="bg-primary text-primary-foreground..."
>
  <PlusCircleIcon />
  <span>Quick Create</span>
</SidebarMenuButton>
```

### 상단 앱 이름/로고 수정
**`app-sidebar.tsx` 라인 63-74 수정**

```typescript
<SidebarHeader>
  <SidebarMenu>
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link href="/dashboard/default">
          <Command />  {/* 아이콘 변경 */}
          <span>{APP_CONFIG.name}</span>  {/* 이름 변경 */}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  </SidebarMenu>
</SidebarHeader>
```

### 하단 사용자 정보 수정
**`nav-user.tsx` 파일 수정**

## 📌 주요 인터페이스

```typescript
// 메뉴 그룹
interface NavGroup {
  id: number;
  label?: string;           // 그룹 제목 (선택)
  items: NavMainItem[];     // 메뉴 항목들
}

// 메뉴 항목
interface NavMainItem {
  title: string;            // 메뉴 이름
  url: string;              // 이동 경로
  icon?: LucideIcon;        // 아이콘
  subItems?: NavSubItem[];  // 하위 메뉴
  comingSoon?: boolean;     // "Soon" 배지
  newTab?: boolean;         // 새 탭 열기
  isNew?: boolean;          // "New" 배지
}

// 하위 메뉴
interface NavSubItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  comingSoon?: boolean;
  newTab?: boolean;
  isNew?: boolean;
}
```

## 🎨 스타일 커스터마이징

- 사이드바 색상: `globals.css`의 `--sidebar-*` CSS 변수
- 활성 메뉴 색상: `--sidebar-primary`, `--sidebar-primary-foreground`
- 메뉴 간격/크기: `nav-main.tsx`의 Tailwind 클래스 수정

## 💡 팁

1. **메뉴 데이터만 변경**: 대부분의 경우 `sidebar-items.ts`만 수정하면 됩니다
2. **아이콘 import**: `lucide-react`에서 원하는 아이콘을 import
3. **경로 일치**: URL은 실제 페이지 경로와 정확히 일치해야 합니다
4. **활성 상태**: 현재 경로와 메뉴 URL을 비교하여 자동으로 활성화됩니다
