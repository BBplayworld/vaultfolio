// 성적표·월말 결산 공용 섹션 조각 — asset-report-view.tsx의 로컬 정의를 동작 불변으로 이동(#32).
// design-system.md §5.1 데이터 뷰 레퍼런스(섹션 외피·소그룹 뱃지·아이콘 칩 헤더·라벨/값 행).

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

// 대주제 섹션 외피 — 그림자로 띄워 "여기부터 다른 큰 항목"임을 명확히 구분(테두리보다 그림자 우선).
export const SECTION = "rounded-xl bg-card border border-border/10 dark:border-0 shadow-sm p-4 space-y-3";
// 근거 접기 안 소그룹 라벨 — 뱃지 형태(brand 톤)로 산식 단위를 구분
export const GROUP_BADGE = "inline-block rounded bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary";

// 대주제 섹션 아이콘 칩 톤 — 제목 텍스트(text-foreground)는 공통으로 유지하고 아이콘 배경·색만
// 섹션별로 달리해 "지금 몇 번째 큰 단락인지"를 은은하게 구분한다. 임의의 새 색을 만들지 않고
// design-system.md에 이미 의미가 정해진 토큰만 재사용한다(브랜드=액션, important=순자산 강조,
// gold=별점·등급 톤과 통일, info=보조 도구 성격).
const SECTION_TONE = {
  brand: "bg-primary/15 text-primary",
  gold: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  important: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  info: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
} as const;

// 대주제 섹션 헤더 — 아이콘을 채운 원형 칩에 담아 각 섹션의 시작을 시각적으로 announce 한다.
export function SectionHeader({ icon: Icon, title, badge, children, tone = "brand", titleTestId }: {
  icon: LucideIcon; title: string; badge?: ReactNode; children?: ReactNode; tone?: keyof typeof SECTION_TONE;
  titleTestId?: string; // qa 고정 셀렉터(제목 텍스트만 담는 span에 부착)
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`flex size-7 items-center justify-center rounded-lg shrink-0 ${SECTION_TONE[tone]}`}>
        <Icon className="size-4" />
      </span>
      <span data-testid={titleTestId} className="text-sm sm:text-base font-bold text-foreground">{title}</span>
      {badge}
      {children}
    </div>
  );
}

// 근거·명세 한 줄 — 좁은 타일 밖 전폭에서 라벨(좌, 줄바꿈 허용)·값(우, 고정)으로 정렬한다.
// 값+설명을 한 캡션에 섞어 모바일에서 줄바꿈이 지저분해지던 문제를 라벨/값 분리로 해결.
// 한 줄에 못 담으면 라벨을 음절 단위로 부수는 대신(break-keep) 값을 다음 줄 우측으로 내린다.
export function SpecRow({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
      <span className="min-w-0 text-sm text-muted-foreground text-pretty break-keep">
        {label}
        {hint && <span className="text-muted-foreground/70"> · {hint}</span>}
      </span>
      <span className="ml-auto shrink-0 text-sm font-semibold text-foreground tabular-nums">{children}</span>
    </div>
  );
}
