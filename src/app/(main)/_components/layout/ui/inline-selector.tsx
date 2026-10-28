"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

type Option<T extends string> = { value: T; label: ReactNode; dataTutorial?: string; testId?: string };

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
  fullWidth = false,
}: {
  value: T;
  onChange: (v: T) => void;
  options: readonly Option<T>[];
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  ariaLabel?: string;
  disabledValues?: readonly T[];
  disabledTitle?: string;
  // 같은 폭 칸 + 미끄러지는 썸 + 화살표 키 이동(#32 r2). 기본 경로(false)는 변경 없음
  fullWidth?: boolean;
}) {
  if (fullWidth) return <FullWidthSelector value={value} onChange={onChange} options={options} className={className} ariaLabel={ariaLabel} disabledValues={disabledValues} disabledTitle={disabledTitle} />;
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
            data-testid={o.testId}
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

// fullWidth 키 이동 — 비활성 칸은 건너뛰고 끝에서는 멈춘다(순환 없음). 대상이 없으면 현재 위치 유지
export function nextEnabledIndex(idx: number, key: string, disabled: readonly boolean[]): number {
  const enabled = disabled.map((d, i) => (d ? -1 : i)).filter((i) => i >= 0);
  if (enabled.length === 0) return idx;
  if (key === "Home") return enabled[0];
  if (key === "End") return enabled[enabled.length - 1];
  if (key === "ArrowRight" || key === "ArrowDown") return enabled.find((i) => i > idx) ?? idx;
  if (key === "ArrowLeft" || key === "ArrowUp") return [...enabled].reverse().find((i) => i < idx) ?? idx;
  return idx;
}

// 썸 위치 — 자기 폭(한 칸) 기준 translateX라 JS 측정이 필요 없다
export function thumbStyle(index: number, count: number): { width: string; transform: string } {
  return { width: `calc((100% - 0.25rem) / ${count})`, transform: `translateX(${index * 100}%)` };
}

function FullWidthSelector<T extends string>({ value, onChange, options, className, ariaLabel, disabledValues, disabledTitle }: {
  value: T;
  onChange: (v: T) => void;
  options: readonly Option<T>[];
  className?: string;
  ariaLabel?: string;
  disabledValues?: readonly T[];
  disabledTitle?: string;
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const disabled = options.map((o) => disabledValues?.includes(o.value) ?? false);
  const activeIdx = options.findIndex((o) => o.value === value);
  // 로빙 tabindex — 선택 칸(없으면 첫 활성 칸)만 Tab 순서에 들어간다
  const focusIdx = activeIdx >= 0 && !disabled[activeIdx] ? activeIdx : disabled.indexOf(false);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const next = nextEnabledIndex(focusIdx, e.key, disabled);
    if (next === focusIdx || next < 0) return;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={`relative grid rounded-lg bg-muted/70 dark:bg-muted/50 p-0.5 ${className ?? ""}`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {activeIdx >= 0 && (
        <span
          aria-hidden
          data-slot="thumb"
          className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-md bg-card dark:bg-foreground/15 shadow-sm motion-safe:transition-[transform] motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.2,0.8,0.2,1)]"
          style={thumbStyle(activeIdx, options.length)}
        />
      )}
      {options.map((o, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={`${o.value}-${i}`}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={i === focusIdx ? 0 : -1}
            disabled={disabled[i]}
            title={disabled[i] ? disabledTitle : undefined}
            data-tutorial={o.dataTutorial}
            data-testid={o.testId}
            onClick={() => onChange(o.value)}
            className={`relative min-h-10 min-w-0 truncate rounded-md px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-safe:transition-[color,transform] motion-safe:duration-150 motion-safe:active:scale-[0.96] ${disabled[i]
              ? "text-muted-foreground/40 cursor-not-allowed"
              : active
                ? "text-foreground font-semibold"
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
