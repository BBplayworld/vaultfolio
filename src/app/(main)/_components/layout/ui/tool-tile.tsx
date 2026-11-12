"use client";

// 도구 타일(4.83 상세·주식 → 4.88 공용 추출) — 이름 + 우측 화살표 + 미리보기 값 1줄을 담은 전체 버튼.
// 소비처: 상세·주식 stock-tools, 자산 변화·주식 MarketTile. 다크는 bg-card 면 + shadow-sm(design-system §2).
import { ChevronRight, type LucideIcon } from "lucide-react";

export function ToolTile({ icon: Icon, name, testId, onClick, className = "", chip, children }: {
  icon: LucideIcon;
  name: string;
  testId: string;
  onClick: () => void;
  className?: string;
  chip?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className={`flex min-h-16 min-w-0 flex-col items-start gap-1.5 rounded-lg bg-muted/50 px-3 py-3 text-left outline-none hover:bg-muted/70 focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-safe:transition-[background-color,transform] motion-safe:duration-150 dark:rounded-xl dark:bg-card dark:shadow-sm dark:hover:bg-muted/30 ${className}`}
    >
      <span className="flex w-full items-center gap-1.5">
        <Icon aria-hidden className="size-4 shrink-0 text-primary max-[359px]:hidden" />
        <span className="min-w-0 whitespace-nowrap text-sm font-semibold text-foreground">{name}{chip}</span>
        <ChevronRight aria-hidden className="ml-auto size-4 shrink-0 text-muted-foreground" />
      </span>
      <span className="w-full min-w-0 text-sm leading-snug text-muted-foreground break-keep">{children}</span>
    </button>
  );
}
