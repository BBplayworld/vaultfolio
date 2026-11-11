import { cn } from "@/lib/utils"

// 로딩 자리 막대 색(4.84) — 카드와 육안으로 구분되는 foreground 13%(다크·라이트 자동). reduced-motion이면 정적. 화면별 즉석 `bg-muted animate-pulse` 대신 이 상수를 쓴다.
export const SKELETON_FILL = "bg-foreground/[0.13] motion-safe:animate-pulse"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(SKELETON_FILL, "rounded-md", className)}
      {...props}
    />
  )
}

export { Skeleton }
