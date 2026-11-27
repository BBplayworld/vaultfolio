"use client";

import { displayShareWidths } from "@/lib/report/min-share";

// 상세 4탭(현금·코인·부동산·대출) 공용 비중 바 + 범례(#5.176 #360).
// 주식 StockCategorySection(5.171·5.174)과 같은 규칙·토큰을 옮겨 담았다 — 인증카드 경로와 섞지 않으려고 주식은 그대로 둔다.
// - N > max면 상위 (max−1)개 + `그 외 N개`(바도 같은 구간). 목록·카드는 줄이지 않는다(행마다 % 있음 → 정보 손실 0)
// - % 글자는 foreground(대비 4.5:1↑), 식별색은 점·막대만. 그 외는 muted
// - 분모 total = 지금 탭 합계. 카드 %와 같은 기준이어야 한다(호출부 책임)

export type ShareBarScope = "cash" | "crypto" | "real-estate" | "loan";

export interface ShareBarItem {
  id: string;
  name: string;
  value: number;
  color: string;
}

/** 그 외 구간·점 색 — 주식 상세 범례와 같은 회색 */
export const SHARE_BAR_REST_COLOR = "#9ca3af";

interface ShareBarLegendProps {
  /** 내림차순 정렬된 지금 탭 항목 */
  items: ShareBarItem[];
  /** 지금 탭 합계(카드 %와 같은 분모) */
  total: number;
  /** 범례 최대 칸 수 — 넘으면 상위 max−1 + 그 외 */
  max?: number;
  scope: ShareBarScope;
}

const pctText = (value: number, total: number) => ((value / total) * 100).toFixed(1);

export function ShareBarLegend({ items, total, max = 4, scope }: ShareBarLegendProps) {
  if (items.length === 0 || !(total > 0)) return null;

  const cut = items.length > max ? max - 1 : items.length;
  const shown = items.slice(0, cut);
  const rest = items.slice(cut);
  const restValue = rest.reduce((s, it) => s + it.value, 0);
  const hasRest = rest.length > 0 && restValue > 0;
  const restPct = pctText(restValue, total);
  // 표시 폭만 최소 비중 보장(숫자는 실제 값, #148)
  const widths = displayShareWidths([...shown.map((it) => it.value), ...(hasRest ? [restValue] : [])], { total });

  return (
    <div className="space-y-2">
      <div data-testid="share-bar" data-scope={scope} className="flex h-6 w-full rounded-full overflow-hidden gap-px">
        {shown.map((it, idx) => {
          const pct = pctText(it.value, total);
          return (
            <div
              key={it.id}
              data-testid="share-bar-seg"
              data-pct={pct}
              className="overflow-hidden motion-safe:transition-[width]"
              style={{ width: `${widths[idx]}%`, backgroundColor: it.color }}
              title={`${it.name}: ${pct}%`}
            />
          );
        })}
        {hasRest && (
          <div
            key="__rest"
            data-testid="share-bar-seg"
            data-pct={restPct}
            className="overflow-hidden motion-safe:transition-[width]"
            style={{ width: `${widths[shown.length]}%`, backgroundColor: SHARE_BAR_REST_COLOR }}
            title={`그 외 ${rest.length}개: ${restPct}%`}
          />
        )}
      </div>
      <div data-testid="share-legend" data-scope={scope} className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 max-[360px]:gap-x-2 gap-y-2 px-2">
        {shown.map((it) => {
          const pct = pctText(it.value, total);
          return (
            <div key={it.id} data-testid="share-legend-item" data-pct={pct} className="flex items-center gap-1 min-w-0">
              <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: it.color }} />
              <span className="text-sm text-foreground truncate min-w-0" title={it.name}>{it.name}</span>
              <span className="text-sm text-foreground font-bold tabular-nums shrink-0">{pct}%</span>
            </div>
          );
        })}
        {hasRest && (
          <div data-testid="share-legend-rest" data-count={rest.length} data-pct={restPct} className="flex items-center gap-1 min-w-0">
            <span className="size-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: SHARE_BAR_REST_COLOR }} />
            <span className="text-sm text-muted-foreground whitespace-nowrap shrink-0">그 외 {rest.length}개</span>
            <span className="text-sm text-muted-foreground font-bold tabular-nums shrink-0">{restPct}%</span>
          </div>
        )}
      </div>
    </div>
  );
}
