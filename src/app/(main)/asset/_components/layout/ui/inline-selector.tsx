"use client";

import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode };

// 카드 내부·페이지 컨텍스트 selector (segmented control). 모든 탭 UI의 공용 컴포넌트.
// size: sm(보조), md(기본), lg(1차 탭 등 강조). PC(lg)에서 한 단계씩 ↑
export function InlineSelector<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly Option<T>[];
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ariaLabel?: string;
}) {
  const base =
    size === "sm" ? "text-[12px] sm:text-[13px] lg:text-sm px-1.5 py-1"
      : size === "xl" ? "text-lg sm:text-2xl lg:text-2xl font-bold px-4 py-1 lg:py-0.5"
        : size === "lg" ? "text-sm sm:text-base lg:text-lg px-3 py-2"
          : "text-[13px] sm:text-sm lg:text-base px-2 py-1.5";
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex items-center gap-0.5 rounded-md bg-muted/60 dark:bg-muted/40 p-0.5 ${className ?? ""}`}
    >
      {options.map((o, i) => {
        const active = value === o.value;
        return (
          <button
            key={`${o.value}-${i}`}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`${base} whitespace-nowrap shrink-0 rounded transition-colors ${active
              ? "bg-background text-foreground font-semibold shadow-sm"
              : "text-muted-foreground hover:text-foreground"
              }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
