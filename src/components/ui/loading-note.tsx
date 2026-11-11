"use client";

// 공통 로딩 문구(4.84) — 외부 데이터 대기 화면의 "불러오는 중" 안내. 영역 맨 위(표·차트 바로 위)에 둔다.
// 0~0.5초는 스켈레톤만(빠른 응답은 깜빡임 없음), 0.5초부터 스피너 14px + 13px muted 문구, 5초부터 지연 문구로 교체.
// 자리(min-h-6)는 처음부터 예약해 문구가 나타나도 레이아웃이 움직이지 않는다. 스크린리더용 role=status 1개는 0초부터 sr-only로 존재하고, 시각 문구는 aria-hidden(중복 낭독 방지).
import { Loader2Icon } from "lucide-react";
import { useLoadingPhase } from "@/hooks/use-loading-phase";
import { cn } from "@/lib/utils";

export const SLOW_LABEL = "평소보다 오래 걸려요";
export const LOADING_LABEL = { price: "시세를 불러오는 중…", flow: "가격 흐름을 불러오는 중…", dividend: "배당 정보를 불러오는 중…" } as const;

export function LoadingNote({ active, label, slowLabel = SLOW_LABEL, className }: { active: boolean; label: string; slowLabel?: string; className?: string }) {
  const phase = useLoadingPhase(active);
  if (!phase) return null;
  return (
    <div className={cn("min-h-6", className)}>
      <span role="status" className="sr-only">{label}</span>
      {phase !== "quiet" && (
        <p aria-hidden data-testid="loading-note" data-phase={phase} className="flex items-center gap-2 text-[13px] text-muted-foreground motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150">
          <Loader2Icon className="size-3.5 shrink-0 motion-safe:animate-spin" />
          <span className="break-keep whitespace-nowrap">{phase === "slow" ? slowLabel : label}</span>
        </p>
      )}
    </div>
  );
}
