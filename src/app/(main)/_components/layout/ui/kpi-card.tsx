"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ASSET_THEME } from "@/config/theme";

interface KpiCardProps {
  icon: LucideIcon;
  title: ReactNode;
  description: string;
  primary?: ReactNode; // 없으면 금액 줄 생략(안내만 보여줄 때)
  secondary?: ReactNode;
  onClick: () => void;
  dataTutorial?: string;
  primaryClassName?: string;
  // 카드 안 바로 가기 행 목록(4.83) — 있으면 머리(아이콘~secondary)만 onClick 영역이 되고 rows는 형제라 중첩 인터랙티브가 없다.
  // 없으면 기존과 같이 카드 전체가 onClick(배당·성적표 등 기존 호출 동작 불변)
  rows?: ReactNode;
}

export function KpiCard({ icon: Icon, title, description, primary, secondary, onClick, dataTutorial, primaryClassName, rows }: KpiCardProps) {
  const head = (
    <div className="flex items-start gap-3">
      <Icon aria-hidden className="size-6 shrink-0 text-primary mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm lg:text-base font-semibold text-foreground">{title}</h3>
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        {primary !== undefined && (
          <p className={`text-xl sm:text-2xl lg:text-2xl font-bold tabular-nums mt-2 ${primaryClassName || ASSET_THEME.important}`}>
            {primary}
          </p>
        )}
        {secondary && <div className="text-sm lg:text-base font-medium mt-1">{secondary}</div>}
      </div>
    </div>
  );

  if (!rows) {
    return (
      <Card
        onClick={onClick}
        data-tutorial={dataTutorial}
        className="cursor-pointer p-4 sm:p-5 hover:bg-accent/50 active:scale-[0.98] transition-[color,background-color,box-shadow,transform] duration-150 ease-out dark:shadow-xs dark:border-0"
      >
        {head}
      </Card>
    );
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <Card data-tutorial={dataTutorial} className="p-4 sm:p-5 dark:shadow-xs dark:border-0">
      {/* 머리 영역만 클릭(카드 전체 scale 없음 — 행이 같은 카드 안에 있다) */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={onKeyDown}
        className="-m-1 cursor-pointer rounded-lg p-1 outline-none hover:bg-accent/50 active:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring/50 transition-[background-color] duration-150 ease-out"
      >
        {head}
      </div>
      <div className="mt-3 ml-9">{rows}</div>
    </Card>
  );
}
