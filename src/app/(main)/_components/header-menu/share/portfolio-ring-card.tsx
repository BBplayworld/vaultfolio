"use client";

import { useEffect, useRef, useState } from "react";
import { SHOT_BIG_SCALE } from "@/config/theme";
import { BrandMark } from "./brand-mark";

// 인증카드 "포트폴리오" 타입 — 금액 없이 종목 구성 비중만 원형 링으로 표현.
// 데이터는 ShareCard에서 계산해 props(segments)로 주입한다(훅 중복 호출 금지).

export interface RingSegment {
  key: string;
  name: string;
  ticker: string;
  isForeign: boolean;
  truePct: number; // 실제 비중(%) — 라벨에 항상 이 값 표기
  color: string; // 조각 fill — 링 밖 % 텍스트에도 같은 색을 쓴다
  etfBrand?: string | null; // 국내 ETF면 브랜드명 — 로고 대신 텍스트 배지
  subLogos?: SubLogo[]; // "그 외" 조각에 담을 상위 종목들(최대 3) — 있으면 미니 칩 여러 개
}

/** "그 외" 조각 안에 작게 표시할 구성 종목 */
export interface SubLogo {
  key: string;
  ticker: string;
  name: string;
  isForeign: boolean;
  etfBrand?: string | null;
}

// ── 튜닝 상수 ────────────────────────────────────────────────────────────────
// 조각별 최소 각도(°). 모든 종목이 최소한 이 각도는 확보해 링이 한 조각에 먹히지 않게 한다.
const MIN_ARC_DEG = 22;
// 프리뷰 좌우 최소 공백(px) — 9/3시 방향 라벨이 화면 끝에 붙어 짤리지 않게 스케일 링을 이만큼 좁힌다.
const PREVIEW_SIDE_INSET = 8;
// 실제 비중 구간별 최대 호(arc, °) 상한 — 내림차순 매칭, 구간(<50%)은 상한 없음.
const MAX_ARC_BY_PCT: readonly (readonly [number, number])[] = [
  [90, 110],
  [80, 100],
  [70, 92],
  [60, 84],
  [50, 76],
];

// ── 링 기하 상수(캡처 DOM이므로 뷰포트 반응형 금지 · 고정 px) ──────────────────
// 링 크기(R_OUTER)와 캔버스 높이(VIEW_H)는 독립 — 링을 작게, 캔버스를 크게 잡으면
// 링 밖 종목명 라벨의 여백·간격이 넉넉해진다.
const VIEW_W = 656; // 카드 안쪽 폭 (CARD_WIDTH 680 − p-3 좌우 24)
const VIEW_H = 664; // 캔버스(=카드) 높이 — 링 + 상하 라벨 여백
const CX = 328;
const CY = 322;
const R_OUTER = 240; // 도넛 바깥 반경 — 중앙 홀(R_INNER) 축소분 + 확대
const R_INNER = 66; // 중앙 홀(비움) — 밴드 174px로 두껍게, 중앙 검정 영역 축소
const LABEL_R = 264; // 라벨 앵커 반경(링 바깥) — R_OUTER와의 간격 24px(도넛↔종목명 살짝 더 벌림).
                     // 264 이상이면 3/9시 라벨 박스가 VIEW_W를 넘어 짤리므로 상한(labelMaxW 하한 64 기준)
// 로고 반경은 밴드 중앙(=153)이 아니라 **바깥쪽 0.6 지점**(≈170). 중앙 홀을 줄이면서
// 밴드 중앙에 두면 반경이 안쪽으로 당겨져 같은 각도의 현(chord)이 짧아지고,
// 최소 조각(22°)의 칩이 CHIP_MIN 아래로 떨어져 로고가 통째로 생략된다.
const LOGO_R = R_INNER + (R_OUTER - R_INNER) * 0.6;
// 조각 안 로고 칩은 **비중(조각 각도)에 비례**해 커진다.
// 하한(CHIP_MIN)은 최소 조각각(MIN_ARC_DEG=22°)에서도 들어가는 크기로 잡는다 —
// LOGO_R(≈170)에서 22° 현(chord) 길이가 ≈65px이라 44px는 여유 있게 수용된다.
const CHIP_MIN = 44; // 최소 조각의 칩 지름(px)
const CHIP_MAX = 92; // 1위(최대 호) 조각의 칩 지름(px) — 밴드 두께 174px 안에 들어감
const CHIP_REF_ARC = 110; // 이 각도(°) 이상이면 CHIP_MAX (MAX_ARC_BY_PCT 상한과 동일)
const SUB_CHIP = 28; // "그 외" 조각 안 미니 로고 칩 지름(px)
const SUB_CHIP_GAP = 6; // 미니 칩 사이 간격(px)
const ETC_MIN_ARC = 40; // "그 외" 조각 최소 각도(°) — 미니 칩 3개 + 간격이 들어가도록
const MIN_LABEL_GAP = 66; // 같은 쪽(좌/우) 인접 라벨의 세로 최소 간격(px)
const GAP_DEG = 0; // 각도 간극 없음 — 분리는 카드 배경색 stroke(--ring-divider)가 담당

const RADIAN = Math.PI / 180;

/**
 * 조각 각도(=비중) → 로고 칩 지름.
 * 1) `MIN_ARC_DEG`~`CHIP_REF_ARC` 구간을 `CHIP_MIN`~`CHIP_MAX`로 보간(sqrt 이징 —
 *    선형이면 중간 비중들이 하한에 몰려 차등이 안 보인다)
 * 2) 조각 안에 물리적으로 들어가도록 로고 반경에서의 현(chord) 길이로 상한을 건다
 */
function chipSizeFor(arcDeg: number): number {
  const span = CHIP_REF_ARC - MIN_ARC_DEG;
  const t = Math.min(1, Math.max(0, (arcDeg - MIN_ARC_DEG) / span));
  const byArc = CHIP_MIN + (CHIP_MAX - CHIP_MIN) * Math.sqrt(t);
  const chord = 2 * LOGO_R * Math.sin((arcDeg / 2) * RADIAN);
  return Math.round(Math.min(byArc, chord * 0.7));
}

function maxArcForPct(pct: number): number {
  for (const [threshold, maxArc] of MAX_ARC_BY_PCT) {
    if (pct >= threshold) return maxArc;
  }
  return Infinity;
}

/**
 * 실제 비중 배열 → 링에 그릴 각도(°) 배열. 합계 360.
 * 1) 최소각 + 나머지를 비중 비례로 배분
 * 2) 구간별 최대 호 상한 초과분은 미고정 조각에 비중 비례 재분배(수렴까지 반복)
 * 3) 부동소수 오차를 합 360으로 정규화
 * 4) `minArcs`가 주어지면 세그먼트별 최소각을 후처리로 보장("그 외"에 미니 로고 3개를 넣기 위함)
 */
export function computeRingArcs(pcts: number[], minArcs?: number[]): number[] {
  const n = pcts.length;
  if (n === 0) return [];
  if (n === 1) return [360];

  const TOTAL = 360;
  const distributable = Math.max(0, TOTAL - MIN_ARC_DEG * n);
  const sum = pcts.reduce((s, p) => s + p, 0) || 1;

  let arcs = pcts.map((p) => MIN_ARC_DEG + distributable * (p / sum));
  const caps = pcts.map(maxArcForPct);
  const fixed = new Array<boolean>(n).fill(false);

  for (let iter = 0; iter < 20; iter++) {
    let surplus = 0;
    for (let i = 0; i < n; i++) {
      if (!fixed[i] && arcs[i] > caps[i]) {
        surplus += arcs[i] - caps[i];
        arcs[i] = caps[i];
        fixed[i] = true;
      }
    }
    if (surplus <= 1e-6) break;

    const freeWeight = pcts.reduce((s, p, i) => s + (fixed[i] ? 0 : p), 0);
    if (freeWeight <= 0) {
      const add = surplus / n;
      arcs = arcs.map((a) => a + add);
      break;
    }
    for (let i = 0; i < n; i++) {
      if (!fixed[i]) arcs[i] += surplus * (pcts[i] / freeWeight);
    }
  }

  // 실제 비중 내림차순에서 각도가 단조 비증가하도록 clamp — 상한 재분배로 인해
  // 더 큰 비중 조각이 더 작게 보이는 역전(rank inversion)을 막는다.
  const order = pcts.map((_, i) => i).sort((a, b) => pcts[b] - pcts[a]);
  for (let k = 1; k < n; k++) {
    if (arcs[order[k]] > arcs[order[k - 1]]) arcs[order[k]] = arcs[order[k - 1]];
  }

  const total = arcs.reduce((s, a) => s + a, 0) || 1;
  return enforceMinArcs(arcs.map((a) => (a / total) * TOTAL), minArcs);
}

/**
 * 세그먼트별 지정 최소각 보장 — 부족분을 다른 조각에서 비례 회수한다.
 * 회수는 각 조각의 `MIN_ARC_DEG` 바닥을 침범하지 않는 범위에서만 이뤄지므로
 * 기존 각도 압축·단조 clamp 결과를 크게 흔들지 않는다(합 360 유지).
 */
function enforceMinArcs(arcs: number[], minArcs?: number[]): number[] {
  if (!minArcs) return arcs;
  const out = [...arcs];
  const raised = new Array<boolean>(out.length).fill(false);
  let deficit = 0;
  for (let i = 0; i < out.length; i++) {
    const need = minArcs[i] ?? 0;
    if (need > out[i]) {
      deficit += need - out[i];
      out[i] = need;
      raised[i] = true;
    }
  }
  if (deficit <= 1e-6) return out;

  const donors = out.map((a, i) => (raised[i] ? 0 : Math.max(0, a - MIN_ARC_DEG)));
  const pool = donors.reduce((sum, d) => sum + d, 0);
  if (pool <= 0) return out; // 회수 여력 없음 — 최소각을 우선한다
  const take = Math.min(deficit, pool);
  for (let i = 0; i < out.length; i++) out[i] -= donors[i] * (take / pool);
  return out;
}

// 극좌표(0°=12시 방향, 시계방향)
function polar(r: number, angleDeg: number): [number, number] {
  return [CX + r * Math.sin(angleDeg * RADIAN), CY - r * Math.cos(angleDeg * RADIAN)];
}

// 도넛 웨지 path
function wedgePath(a0: number, a1: number): string {
  const [x0o, y0o] = polar(R_OUTER, a0);
  const [x1o, y1o] = polar(R_OUTER, a1);
  const [x1i, y1i] = polar(R_INNER, a1);
  const [x0i, y0i] = polar(R_INNER, a0);
  const large = a1 - a0 > 180 ? 1 : 0;
  return [
    `M ${x0o} ${y0o}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${x1o} ${y1o}`,
    `L ${x1i} ${y1i}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${x0i} ${y0i}`,
    "Z",
  ].join(" ");
}

type Zone = "top" | "bottom" | "right" | "left";
function zoneOf(mid: number): Zone {
  if (mid <= 20 || mid >= 340) return "top";
  if (mid >= 160 && mid <= 200) return "bottom";
  return mid < 180 ? "right" : "left";
}

type Placed = { seg: RingSegment; a0: number; a1: number; mid: number; lx: number; ly: number; zone: Zone };

/**
 * 같은 쪽(좌/우)에 몰린 라벨의 세로 위치(ly)를 최소 간격(MIN_LABEL_GAP)만큼 벌린다.
 * 링 기하상 작은 조각들이 최소각(MIN_ARC_DEG)으로 붙으면 라벨이 겹치므로,
 * 겹침을 아래로 밀어 해소한 뒤 그룹 전체를 원래 중심으로 되돌려 쏠림을 막는다.
 * lx(가로 위치)는 건드리지 않는다 — 조각과의 근접성으로 식별.
 */
function spreadVertically(items: Placed[], gap: number = MIN_LABEL_GAP): Placed[] {
  if (items.length < 2) return items;
  const sorted = [...items].sort((a, b) => a.ly - b.ly);
  for (let i = 1; i < sorted.length; i++) {
    const min = sorted[i - 1].ly + gap;
    if (sorted[i].ly < min) sorted[i] = { ...sorted[i], ly: min };
  }
  const origCenter = items.reduce((s, it) => s + it.ly, 0) / items.length;
  const newCenter = sorted.reduce((s, it) => s + it.ly, 0) / sorted.length;
  const shift = origCenter - newCenter;
  const min = gap / 2;
  const max = VIEW_H - gap / 2;
  return sorted.map((it) => ({ ...it, ly: Math.min(max, Math.max(min, it.ly + shift)) }));
}

export function PortfolioRingCard({ segments, responsive }: { segments: RingSegment[]; responsive?: boolean }) {
  // responsive=true(화면용 프리뷰)면 링을 컨테이너 폭에 맞춰 fit-to-width 스케일(가로 스크롤 없이 도넛이 폭을 꽉 채움).
  // responsive 미전달(캡처 인스턴스)이면 VIEW_W 고정 — 저장 PNG 구도 불변.
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!responsive) return;
    const el = outerRef.current;
    if (!el) return;
    const update = () =>
      setScale(Math.min(1, Math.max(0, Math.floor(el.clientWidth) - PREVIEW_SIDE_INSET * 2) / VIEW_W));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [responsive]);

  if (segments.length === 0) return null;

  // "그 외"(subLogos 보유)는 미니 칩 3개가 들어가도록 더 큰 최소각을 요구한다
  const arcs = computeRingArcs(
    segments.map((s) => s.truePct),
    segments.map((s) => (s.subLogos?.length ? ETC_MIN_ARC : MIN_ARC_DEG)),
  );

  // responsive 프리뷰: 링 전체가 transform:scale(<1)로 축소돼 text-[15px] 라벨이 ~8px로 렌더 → 폰트를
  //   12/scale로 키워 상쇄(실효 ~12px, "분야 구성" 14px과 비슷). scale≈1(데스크톱)이면 15px 유지.
  // 캡처(저장 PNG, !responsive): SHOT_BIG_SCALE에서 파생(계수 12 → 1.46에서 18, 1.42에서 17). 도넛 라벨은
  //   좁은 존 짤림 때문에 본문(계수 14)보다 조금 작게. 나머지 짤림 방지는 아래 labelMaxW·line-clamp-3.
  const rLabelFont = responsive ? Math.max(15, 12 / scale) : Math.round(12 * SHOT_BIG_SCALE);
  const rGap = responsive
    ? Math.max(MIN_LABEL_GAP, Math.round(rLabelFont * 4.5))
    : Math.max(MIN_LABEL_GAP, Math.round(rLabelFont * 5));
  const labelClampCls = "line-clamp-3";

  let acc = 0;
  const drawn: Placed[] = segments.map((seg, i) => {
    const a0 = acc;
    const a1 = acc + arcs[i];
    acc = a1;
    const mid = (a0 + a1) / 2;
    const [lx, ly] = polar(LABEL_R, mid);
    return { seg, a0, a1, mid, lx, ly, zone: zoneOf(mid) };
  });

  // 좌/우로 몰린 라벨은 세로 간격을 벌려 겹침 해소(top/bottom은 그대로)
  const labels: Placed[] = [
    ...spreadVertically(drawn.filter((d) => d.zone === "left"), rGap),
    ...spreadVertically(drawn.filter((d) => d.zone === "right"), rGap),
    ...drawn.filter((d) => d.zone === "top" || d.zone === "bottom"),
  ];

  // 링 본체(svg + HTML 라벨/로고 오버레이). responsive면 transform:scale로 폭 맞춤.
  const ring = (
    <div
      className="relative"
      style={{
        width: VIEW_W,
        height: VIEW_H,
        ...(responsive ? { transform: `scale(${scale})`, transformOrigin: "top left" } : {}),
      }}
    >
        <svg
          width={VIEW_W}
          height={VIEW_H}
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          className="absolute inset-0 [&_*]:outline-none [&_path]:outline-none"
        >
          {drawn.map(({ seg, a0, a1 }) => {
            const pad = a1 - a0 > GAP_DEG * 2 ? GAP_DEG : 0;
            return (
              <path
                key={seg.key}
                d={wedgePath(a0 + pad, Math.max(a1 - pad, a0 + pad + 0.0001))}
                fill={seg.color}
                stroke="var(--ring-divider)"
                strokeWidth={5}
                strokeLinejoin="round"
              />
            );
          })}
        </svg>

        {/* 조각 안 기업 로고 — 조각색 원형 칩, 비중(각도)에 비례한 크기.
            좁은 조각·로고 없는 조각("그 외")은 생략 */}
        {drawn.map(({ seg, a0, a1, mid }) => {
          // "그 외" — 구성 상위 종목 미니 칩을 조각 각도 범위에 균등 배치
          if (seg.subLogos?.length) {
            const subs = seg.subLogos;
            const stepDeg = ((SUB_CHIP + SUB_CHIP_GAP) / LOGO_R) * (180 / Math.PI);
            return subs.map((sub, i) => {
              const off = (i - (subs.length - 1) / 2) * stepDeg;
              const [sx, sy] = polar(LOGO_R, mid + off);
              return (
                <div
                  key={`logo-${seg.key}-${sub.key}`}
                  className="absolute"
                  style={{ left: sx, top: sy, transform: "translate(-50%, -50%)" }}
                >
                  <BrandMark
                    ticker={sub.ticker}
                    name={sub.name}
                    isForeign={sub.isForeign}
                    etfBrand={sub.etfBrand}
                    size={SUB_CHIP}
                    bgColor={seg.color}
                  />
                </div>
              );
            });
          }

          const chip = chipSizeFor(a1 - a0);
          if (chip < CHIP_MIN) return null; // 하한도 못 채우는 좁은 조각은 생략
          const [gx, gy] = polar(LOGO_R, mid);
          return (
            <div
              key={`logo-${seg.key}`}
              className="absolute"
              style={{ left: gx, top: gy, transform: "translate(-50%, -50%)" }}
            >
              <BrandMark
                ticker={seg.ticker}
                name={seg.name}
                isForeign={seg.isForeign}
                etfBrand={seg.etfBrand}
                size={chip}
                bgColor={seg.color}
              />
            </div>
          );
        })}

        {/* 링 바깥 라벨 — 이름(해외=티커/국내=종목명) + 비중%. 아이콘은 조각 안으로 이동 */}
        {labels.map(({ seg, lx, ly, zone }) => {
          const transform =
            zone === "right" ? "translate(0, -50%)"
              : zone === "left" ? "translate(-100%, -50%)"
                : zone === "top" ? "translate(-50%, -100%)"
                  : "translate(-50%, 0)";
          // 라벨 폭 하한 64 — 9/3시 방향(가용폭 ≈68)에서 하한이 가용폭을 넘으면 박스가 링 좌표계
          // (0..VIEW_W)를 벗어나 화면 밖으로 짤린다. 좁은 존은 line-clamp-3 + 말줄임으로 수렴.
          const labelMaxW =
            zone === "right" ? Math.max(64, VIEW_W - lx - 4)
              : zone === "left" ? Math.max(64, lx - 4)
                : 208;
          const alignCls =
            zone === "right" ? "items-start text-left"
              : zone === "left" ? "items-end text-right"
                : "items-center text-center";
          const label = seg.isForeign && seg.ticker ? seg.ticker : seg.name;
          return (
            <div
              key={seg.key}
              className={`absolute flex flex-col ${alignCls} overflow-hidden`}
              style={{ left: lx, top: ly, transform, maxWidth: labelMaxW }}
            >
              {/* min-w-0 + max-w-full 로 상위 maxWidth 가 텍스트 노드까지 전파되게 하고,
                  overflow-wrap:anywhere + line-clamp(2~3) 로 긴 한글 종목명이 클램프 줄 수 안에서
                  줄바꿈·말줄임 되도록 강제 — 가로 오버플로우(카드 밖 짤림) 원천 차단 */}
              <div className="flex flex-col leading-tight min-w-0 max-w-full">
                <span
                  className={`text-[15px] font-semibold tracking-tight text-foreground ${labelClampCls} [overflow-wrap:anywhere] max-w-full`}
                  style={rLabelFont ? { fontSize: rLabelFont, lineHeight: 1.15 } : undefined}
                >
                  {label}
                </span>
                <span
                  className="text-[15px] font-bold tabular-nums"
                  style={{ color: seg.color, ...(rLabelFont ? { fontSize: rLabelFont, lineHeight: 1.15 } : {}) }}
                >
                  {seg.truePct.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
  );

  // 캡처 인스턴스: VIEW_W 고정 그대로(저장 PNG 구도 불변)
  if (!responsive) {
    return <div className="flex flex-col items-center">{ring}</div>;
  }
  // 화면용 프리뷰: 링을 컨테이너 폭에 맞춰 축소(레이아웃 박스도 스케일된 크기로 잡아 가로 넘침 없음)
  return (
    <div ref={outerRef} className="w-full flex justify-center overflow-hidden" style={{ height: VIEW_H * scale }}>
      <div className="shrink-0" style={{ width: VIEW_W * scale, height: VIEW_H * scale }}>
        {ring}
      </div>
    </div>
  );
}
