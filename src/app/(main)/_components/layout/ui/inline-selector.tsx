"use client";

import type { ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode; dataTutorial?: string };

// 카드 내부·페이지 컨텍스트 selector (segmented control). 모든 탭 UI의 공용 컴포넌트.
// size: sm(보조), md(기본), lg(1차 탭 등 강조). PC(lg)에서 한 단계씩 ↑
export function InlineSelector<T extends string>({
  value,
  onChange,
  options,
  size = "md",
  className,
  ariaLabel,
  disabledValues,
  disabledTitle,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly Option<T>[];
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ariaLabel?: string;
  disabledValues?: readonly T[];
  disabledTitle?: string;
}) {
  const base =
    size === "sm" ? "text-[12px] sm:text-[13px] lg:text-sm px-1.5 py-1"
      // xl은 현재 top-bar.tsx 홈 화면 좌측(로고 옆 상세/성과)에서만 쓴다 — 로고와 박스 사이
      // 여백이 붙어 보인다는 피드백으로 px-4→px-3 축소(2026-09). 다른 소비처 생기면 영향 확인할 것.
      : size === "xl" ? "text-lg sm:text-2xl lg:text-2xl font-bold px-3 py-1 lg:py-0.5"
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
        const disabled = disabledValues?.includes(o.value) ?? false;
        return (
          <button
            key={`${o.value}-${i}`}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            title={disabled ? disabledTitle : undefined}
            data-tutorial={o.dataTutorial}
            onClick={() => onChange(o.value)}
            className={`${base} whitespace-nowrap shrink-0 rounded transition-colors ${disabled
              ? "text-muted-foreground/40 cursor-not-allowed"
              : active
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
