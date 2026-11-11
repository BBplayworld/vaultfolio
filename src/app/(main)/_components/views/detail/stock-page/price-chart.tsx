"use client";

// 종목 한 장(#157) 가격 흐름 차트 — 면적선 + 합산 평단선(라벨 칩) + 매수 점. 외부 차트 라이브러리 없이 SVG 한 장.
// y는 항상 종가(수정주가). 매수 점의 y도 그날 봉 종가이고 거래 단가는 쓰지 않는다.
import { useId, useState } from "react";
import { MAIN_PALETTE } from "@/config/theme";
import { useBoxSize } from "@/hooks/use-box-size";
import { axisGutter, buildPriceAxis, type BuyDot } from "@/lib/finance/stock-page";
import type { PricePoint } from "@/lib/finance/price-history";
import { formatCurrencyDisplay } from "../asset-detail-tabs";
import { PriceAxisLayer } from "../price-axis-layer";
import { formatPrice } from "../trades/stock-trades-view";

const M = { top: 20, bottom: 22, left: 12 }; // 오른쪽은 가격 칸(axisGutter)
const FALLBACK = { w: 320, h: 200 };
const CHIP_H = 20;

const t = (d: string) => new Date(`${d}T00:00:00Z`).getTime();
export const fmtDot = (d: string) => d.replaceAll("-", ".");

export interface PriceChartProps {
  points: PricePoint[];
  dots: BuyDot[];
  avg: number | null; // 종목 통화 평단, 0·null이면 선 없음
  currentPrice: number | null; // 현재가(= 머리·행 `현재가` 칸과 같은 값) — 0·null이면 점·태그 생략
  currentText?: string; // 현재가 문자열 — 행 `현재가` 칸과 같은 formatter 결과(C65)
  currency: string;
  interval: "D" | "W";
  colorClass: string; // 선 색(구간 등락 부호) — 래퍼 currentColor
  selectedIndex: number | null; // 선택한 점의 points 인덱스
  onSelect: (index: number | null) => void;
  ariaLabel: string;
}

export function PriceChart({ points, dots, avg, currentPrice, currentText, currency, interval, colorClass, selectedIndex, onSelect, ariaLabel }: PriceChartProps) {
  const { ref, size } = useBoxSize(FALLBACK);
  const gid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const { w, h } = size;
  const tagText = currentPrice && currentPrice > 0 ? (currentText ?? formatCurrencyDisplay(currentPrice, currency)) : undefined;
  const gutter = tagText ? axisGutter(tagText) : 12;
  const plotW = Math.max(1, w - M.left - gutter);
  const plotH = Math.max(1, h - M.top - M.bottom);

  // 눈금·도메인은 원본 points + 현재가(행 밴드와 같은 함수)
  const axis = buildPriceAxis({ points, avg, price: currentPrice, currency, top: M.top, plotH });
  const { clamped, avgY, yOf } = axis;
  const t0 = t(points[0].d);
  const t1 = t(points[points.length - 1].d);
  const xOf = (d: string) => (t1 === t0 ? M.left + plotW / 2 : M.left + ((t(d) - t0) / (t1 - t0)) * plotW);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.d).toFixed(1)},${yOf(p.c).toFixed(1)}`).join("");
  const area = `${line}L${xOf(points[points.length - 1].d).toFixed(1)},${M.top + plotH}L${xOf(points[0].d).toFixed(1)},${M.top + plotH}Z`;

  const avgText = avg && avg > 0 ? `내 평단 ${formatPrice(avg, currency)}${clamped === "up" ? " ↑" : clamped === "down" ? " ↓" : ""}` : "";
  const chipW = avgText.length * 6.4 + 14;
  // 칩 후보 4곳(왼쪽·오른쪽 끝 × 선 위·아래) 중 가격선과 가장 덜 겹치는 곳(동률이면 앞 후보). 칩 면은 칠하지 않고 글자 외곽선만 쓴다
  const xy = points.map((p) => ({ x: xOf(p.d), y: yOf(p.c) }));
  const chip = (() => {
    if (avgY === null) return { x: M.left, y: 0 };
    const ys = [avgY - CHIP_H - 4, avgY + 4].filter((y) => y >= 0 && y + CHIP_H <= h - M.bottom + 4);
    const xs = [M.left, M.left + plotW - chipW];
    let best = { x: xs[0], y: ys[0] ?? avgY + 4 };
    let bestHits = Infinity;
    for (const y of ys.length ? ys : [avgY + 4]) {
      for (const x of xs) {
        const hits = xy.filter((q) => q.x >= x - 2 && q.x <= x + chipW + 2 && q.y >= y - 2 && q.y <= y + CHIP_H + 2).length;
        if (hits < bestHits) {
          bestHits = hits;
          best = { x, y };
        }
      }
    }
    return best;
  })();

  // 점 히트 반경 — 가까운 점 우선: 이웃과 가까우면 이웃 거리의 절반(최소 10, 최대 20)
  const dotXY = dots.map((d) => ({ x: xOf(d.d), y: yOf(d.c) }));
  const hitR = (i: number) => {
    let nearest = Infinity;
    dotXY.forEach((o, j) => {
      if (j !== i) nearest = Math.min(nearest, Math.hypot(o.x - dotXY[i].x, o.y - dotXY[i].y));
    });
    return Math.max(10, Math.min(20, nearest / 2));
  };

  const nearestIndex = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    let best = 0;
    let bd = Infinity;
    points.forEach((p, i) => {
      const dx = Math.abs(xOf(p.d) - x);
      if (dx < bd) {
        bd = dx;
        best = i;
      }
    });
    return best;
  };

  const endFmt = (d: string) => (interval === "W" ? d.slice(0, 4) : d.slice(0, 7).replace("-", "."));
  const hp = hover !== null ? points[hover] : null;
  const hx = hp ? xOf(hp.d) : 0;

  return (
    <div ref={ref} className="relative h-full w-full">
      <svg
        data-testid="stock-page-chart-svg"
        role="img"
        aria-label={ariaLabel}
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        className="block max-w-full select-none"
      >
        <defs>
          <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.12} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </linearGradient>
        </defs>
        <PriceAxisLayer layer="grid" axis={axis} x0={M.left} plotW={plotW} h={h} />
        <g className={`${colorClass} motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200`} key={`${points.length}-${points[0].d}`}>
          <path d={area} fill={`url(#g${gid})`} />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        </g>
        <text x={M.left} y={h - 6} className="fill-muted-foreground" fontSize={11}>{endFmt(points[0].d)}</text>
        <text x={M.left + plotW} y={h - 6} textAnchor="end" className="fill-muted-foreground" fontSize={11}>{endFmt(points[points.length - 1].d)}</text>

        {/* 빈 곳 탭·드래그 읽기 */}
        <rect
          x={0}
          y={0}
          width={w}
          height={h - M.bottom}
          fill="transparent"
          onClick={() => onSelect(null)}
          onPointerMove={(e) => setHover(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerDown={(e) => setHover(nearestIndex(e.clientX, e.currentTarget.getBoundingClientRect()))}
          onPointerLeave={() => setHover(null)}
        />
        {hp && (
          <g pointerEvents="none">
            <line x1={hx} x2={hx} y1={M.top} y2={M.top + plotH} className="stroke-border" strokeWidth={1} />
            <text
              x={hx > w / 2 ? hx - 6 : hx + 6}
              y={12}
              textAnchor={hx > w / 2 ? "end" : "start"}
              className="fill-foreground tabular-nums"
              fontSize={11}
              fontWeight={500}
            >
              {fmtDot(hp.d)} · {formatPrice(hp.c, currency)}
            </text>
          </g>
        )}

        {avgY !== null && (
          <g
            data-testid="stock-page-avg-line"
            data-clamped={avg && avg > 0 ? clamped : "none"}
            data-avg={avg ?? undefined}
            pointerEvents="none"
            className={clamped === "none" ? "text-foreground/70" : "text-foreground/40"}
          >
            <line x1={M.left} x2={M.left + plotW} y1={avgY} y2={avgY} stroke="currentColor" strokeWidth={1.25} strokeDasharray="4 3" />
            <text
              x={chip.x + 7}
              y={chip.y + 14}
              fontSize={11}
              fontWeight={500}
              className="fill-foreground tabular-nums"
              style={{ paintOrder: "stroke", stroke: "var(--card)", strokeWidth: 3, strokeLinejoin: "round" }}
            >
              {avgText}
            </text>
          </g>
        )}

        {dots.map((d, i) => {
          const { x, y } = dotXY[i];
          const selected = selectedIndex === d.index;
          const first = d.buys[0];
          const label = `${fmtDot(first.date)} 매수 ${first.quantity.toLocaleString()}주 · ${formatPrice(first.price, first.currency)}${d.buys.length > 1 ? ` 외 ${d.buys.length - 1}건` : ""}`;
          return (
            <g
              key={d.index}
              data-testid="stock-page-buy-dot"
              data-date={d.d}
              data-selected={selected}
              role="button"
              tabIndex={0}
              aria-label={label}
              aria-pressed={selected}
              className="cursor-pointer outline-none [&:focus-visible>circle:nth-child(2)]:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(selected ? null : d.index);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(selected ? null : d.index);
                }
              }}
            >
              <circle cx={x} cy={y} r={hitR(i)} fill="transparent" />
              <circle cx={x} cy={y} r={10} fill="none" stroke={MAIN_PALETTE[0]} strokeWidth={2} opacity={selected ? 1 : 0} className="motion-safe:transition-opacity motion-safe:duration-150" />
              <circle cx={x} cy={y} r={selected ? 7 : 5} className="fill-rose-500" style={{ stroke: "var(--card)", strokeWidth: 2.5 }} />
            </g>
          );
        })}
        <g className={colorClass}>
          <PriceAxisLayer layer="labels" axis={axis} x0={M.left} plotW={plotW} h={h} tagText={tagText} tagValue={currentPrice ?? undefined} colorClass={colorClass} />
        </g>
      </svg>
    </div>
  );
}
