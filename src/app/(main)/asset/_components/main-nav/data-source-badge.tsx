import { Badge } from "@/components/ui/badge";
import { MAIN_PALETTE } from "@/config/theme";

// 데이터 기준 표시 배지: 실(실시간) / 종(종가)
// 완전 원형(정사각 비율) 디자인
export function DataSourceBadge({ kind }: { kind: "realtime" | "closing" }) {
  const bg = kind === "realtime" ? MAIN_PALETTE[3] : MAIN_PALETTE[11];
  const label = kind === "realtime" ? "시" : "종";
  return (
    <Badge
      style={{ backgroundColor: bg, color: "#fff", borderColor: "transparent" }}
      className="rounded-full size-[19px] p-0 text-[11px] leading-none font-bold flex items-center justify-center"
    >
      {label}
    </Badge>
  );
}
