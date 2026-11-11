// 가격 눈금 레이어(4.84) — 행 밴드(stock-row-flow)와 종목 한 장 차트(price-chart)가 공유한다. SVG <g> 조각만 그린다.
// grid: 눈금선(가격선·면적 아래에 깔림). labels: 눈금 라벨·현재가 점·현재가 태그(가격 칸 = 플롯 오른쪽 gutter, 선·점 위에 얹음).
// 선·평단선·점·칩은 호출한 쪽이 그린다. 현재가는 같은 카드 `현재가` 칸과 같은 문자열(tagText)을 받아 그린다(C65).
import { axisGutter, type PriceAxis } from "@/lib/finance/stock-page";

interface Props {
  layer: "grid" | "labels";
  axis: PriceAxis;
  x0: number; // 플롯 시작 x
  plotW: number;
  h: number; // SVG 높이(태그가 밖으로 나가지 않게 clamp)
  tagText?: string; // 현재가 문자열(formatCurrencyDisplay) — 없으면 점·태그 생략
  tagValue?: number; // data-value(현재가 원값)
  colorClass?: string; // 현재가 점 색(선 색과 같은 currentColor)
  avgGutterLabel?: boolean; // 평단 가격 칸 라벨(`평단`) — 현재가 태그와 26px 이상 떨어질 때만
  avgSubText?: string; // 평단 라벨 아래줄(칩 폴백 gutter 모드의 축약가)
}

export function PriceAxisLayer({ layer, axis, x0, plotW, h, tagText, tagValue, colorClass, avgGutterLabel, avgSubText }: Props) {
  if (layer === "grid") {
    return (
      <g aria-hidden pointerEvents="none">
        {axis.ticks.map((t) => (
          <line key={t.v} x1={x0} x2={x0 + plotW} y1={t.y} y2={t.y} stroke="var(--foreground)" strokeOpacity={0.12} strokeWidth={1} />
        ))}
      </g>
    );
  }
  const gx = x0 + plotW + 6;
  const tagY = axis.todayY === null ? null : Math.max(10, Math.min(axis.todayY + 1, h - 14));
  const gutter = tagText ? axisGutter(tagText) : 0;
  const showLabel = gutter <= plotW * 0.4; // 가격 칸이 플롯의 40%를 넘으면 `현재가` 줄 생략
  const avgLabelOk = avgGutterLabel && axis.avgY !== null && (axis.todayY === null || Math.abs(axis.avgY - axis.todayY) >= 26);
  return (
    <g pointerEvents="none">
      {axis.ticks.map((t) => (
        <text key={t.v} data-testid="chart-tick" data-value={t.v} x={gx} y={t.y + 3.5} fontSize={10} className="fill-muted-foreground tabular-nums">
          {t.label}
        </text>
      ))}
      {avgLabelOk && axis.avgY !== null && (
        <g data-testid="chart-avg-gutter">
          <text x={gx} y={avgSubText ? axis.avgY + 1 : axis.avgY + 3.5} fontSize={10} className={avgSubText ? "fill-foreground" : "fill-muted-foreground"}>평단</text>
          {avgSubText && <text x={gx} y={axis.avgY + 12} fontSize={10} className="fill-muted-foreground tabular-nums">{avgSubText}</text>}
        </g>
      )}
      {tagText && axis.todayY !== null && tagY !== null && (
        <g data-testid="chart-today-tag" data-value={tagValue}>
          <circle cx={x0 + plotW} cy={axis.todayY} r={3.5} className={`fill-current ${colorClass ?? ""}`} style={{ stroke: "var(--card)", strokeWidth: 2 }} />
          <text x={gx} y={tagY} fontSize={11} fontWeight={600} className="fill-foreground tabular-nums">{tagText}</text>
          {showLabel && <text x={gx} y={tagY + 11} fontSize={10} className="fill-muted-foreground">현재가</text>}
        </g>
      )}
    </g>
  );
}
