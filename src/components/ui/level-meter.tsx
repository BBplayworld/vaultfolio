"use client";

// 세그먼트 레벨미터 — 진행률을 칸(세그먼트)으로 나눠 SHARE_SAFE_PALETTE 색을 순환시키며 채우는
// 공용 시각화. 순자산 목표 진행률 바(S-4.28)에서 처음 만들었으나 해당 기능은 롤백됐고, 디자인만
// 재사용 컴포넌트로 보존한다(design-system.md 참고). 현재 적용처 없음.

import { SHARE_SAFE_PALETTE } from "@/config/theme";
import { cn } from "@/lib/utils";

export function LevelMeter({
  progressPct,
  segments = 10,
  className,
}: {
  /** 0~100 — 호출부에서 클램프해서 넘길 것 */
  progressPct: number;
  segments?: number;
  className?: string;
}) {
  const filledCount = Math.max(0, Math.min(segments, Math.round((progressPct / 100) * segments)));
  return (
    <div className={cn("flex gap-1", className)}>
      {Array.from({ length: segments }).map((_, i) => (
        <div
          key={i}
          className={`h-2.5 flex-1 rounded-sm transition-colors ${i >= filledCount ? "bg-muted" : ""}`}
          style={i < filledCount ? { backgroundColor: SHARE_SAFE_PALETTE[i % SHARE_SAFE_PALETTE.length] } : undefined}
        />
      ))}
    </div>
  );
}
