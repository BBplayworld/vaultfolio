"use client";

// 투자 탭 그림 3층(ⓐ 연말 지수·ⓑ 연간 등락·ⓒ 기준금리 월 계단) — 자체 SVG(recharts 미사용), 목업 r3.js 이식(#263).
// 공유 x축, 연말 세로선 관통. 관통 요소: 미국 경기침체 띠(data-rec)·사건 점(data-ev, C1 같은 해 점 합침)·하락 이름표(data-nm).
// 선택 하락의 면은 C2(기본 숨김, 행 펼침·해 선택 때만), 선택선은 C3(글자 구간에서 끊고 글자에 후광).
import { useId, useRef } from "react";
import { episodeIndexOfYear, monthPos, rateAt, rateAxisMax, recessionSpan, type Episode, type IndexView } from "@/lib/invest/calc";
import { bandRect, logTicks, mergeEventDots, stepPath } from "@/lib/invest/chart";
import { RISE_THRESHOLD } from "@/lib/invest/pattern";
import { fmtLevel, fmtPct } from "@/lib/invest/text";
import type { MarketHistoryData } from "@/lib/invest/types";
import { BRAND_TEXT_FILL, C, HALO, LOSS_FILL, LOSS_STROKE, SVG_TEXT } from "./chart-style";

const GX = 44, RP = 24; // 왼쪽 축 글자 폭·오른쪽 여백(겹쳐 보기 오른쪽 축 글자 자리)

// 글자 폭 근사(한글 12.2·영숫자 6.6, 11px 굵은 글자) — 이름표 단 배치용
const labelWidth = (s: string) => [...s].reduce((a, c) => a + (/[0-9a-zA-Z.%~]/.test(c) ? 6.6 : c === " " ? 3.8 : 12.2), 0);
export const capWidth = (s: string) => [...s].reduce((a, c) => a + (/[0-9a-zA-Z.%~()&]/.test(c) ? 6.3 : c === " " ? 3.2 : 11.2), 0);
const shortName = (s: string) => s.replace(" 버블 붕괴", "").replace("글로벌 ", "").replace(/(\d{4})년 하락/, "$1년").replace("1973~74년 하락", "73~74년").replace("1990~91년 하락", "90~91년");

export interface MainLayout {
  W: number;
  wide: boolean;
  PW: number;
  span: number;
  H: number;
  H1: number;
  H2: number;
  H3: number;
  P1: number;
  P1b: number;
  cap2: number;
  P2: number;
  P2b: number;
  cap3: number;
  lg: number;
  P3: number;
  P3b: number;
  AX: number;
  nameRows: number;
  labels: { k: number; t: string; w: number; x0: number; tier: number; drop: boolean }[];
}

/** 층 높이·이름표 단 배치(깊은 하락부터 배치, 겹치면 다음 단, 단이 모자라면 가장 얕은 것이 탈락) */
export function layoutMain(view: IndexView, W: number, wide: boolean): MainLayout {
  const PW = W - GX - RP, span = view.last - view.start;
  const XE = (Y: number) => GX + ((Y + 1 - (view.start + 1)) / span) * PW;
  const H1 = wide ? 190 : 100, H2 = wide ? 72 : 52, H3 = wide ? 64 : 44;
  const P1 = 24, P1b = P1 + H1, cap2 = P1b + 19, P2 = P1b + 32, P2b = P2 + H2;
  const labels = view.eps.map((e, k) => {
    const cx = (XE(e.py) + XE(e.ty)) / 2, t = shortName(e.name) + (e.ongoing ? "·진행 중" : ""), w = labelWidth(t);
    return { k, t, w, x0: Math.max(GX, Math.min(W - RP - w + 4, cx - w / 2)), tier: 0, drop: false };
  });
  const tiers: { x0: number; x1: number }[][] = W < 300 ? [[], [], []] : [[], []];
  [...labels].sort((a, b) => view.eps[a.k].dd - view.eps[b.k].dd).forEach((l) => {
    const tr = tiers.findIndex((a) => !a.some((q) => l.x0 < q.x1 + 6 && l.x0 + l.w > q.x0 - 6));
    if (tr < 0) l.drop = true;
    else { tiers[tr].push({ x0: l.x0, x1: l.x0 + l.w }); l.tier = tr; }
  });
  const nameRows = Math.max(1, ...labels.filter((l) => !l.drop).map((l) => l.tier + 1));
  const LB = nameRows * 14 + 4;
  const cap3 = P2b + LB + 16, lg = cap3 + 18, P3 = cap3 + 29, P3b = P3 + H3, AX = P3b + 15;
  return { W, wide, PW, span, H: AX + 4, H1, H2, H3, P1, P1b, cap2, P2, P2b, cap3, lg, P3, P3b, AX, nameRows, labels };
}

/** 가로 위치(px) → 선택 연도(그 해 막대 안, 데이터 범위로 제한) */
export function yearAtX(view: IndexView, W: number, x: number): number {
  const PW = W - GX - RP, span = view.last - view.start;
  const t = ((x - GX) / PW) * span + view.start + 1;
  return Math.max(view.start + 1, Math.min(view.last, Math.floor(t)));
}

export function MainChart({
  data, view, width, wide, selEp, selYear, overlayOn, onPickYear,
}: {
  data: MarketHistoryData;
  view: IndexView;
  width: number;
  wide: boolean;
  selEp: number | null;
  selYear: number | null;
  overlayOn: boolean;
  onPickYear: (year: number) => void;
}) {
  const uid = useId().replace(/:/g, "");
  const dragging = useRef(false);
  const L = layoutMain(view, width, wide);
  const { W, PW, span, H1, H2, H3, P1, P1b, cap2, P2, P2b, cap3, lg, P3, P3b, AX, H } = L;
  const y0 = view.start, last = view.last, us = view.rate === "us", R = view.rate;
  const X = (t: number) => GX + ((t - (y0 + 1)) / span) * PW, XE = (Y: number) => X(Y + 1), BW = PW / span;
  const close = view.close, ix = (Y: number) => close[Y - y0];
  const T1 = logTicks(Math.min(...close), Math.max(...close), H1 >= 150 ? 8 : 6), lnLo = Math.log(T1.lo), lnHi = Math.log(T1.hi);
  const rets = view.ret.filter((x): x is number => x != null);
  const rrange = Math.max(...rets) - Math.min(...rets), rstep = rrange > 160 ? 50 : rrange > 120 ? 25 : 20;
  const bmax = Math.ceil(Math.max(...rets) / rstep) * rstep, bmin = Math.floor(Math.min(...rets) / rstep) * rstep;
  const Y1 = (v: number) => P1 + H1 - ((Math.log(v) - lnLo) / (lnHi - lnLo)) * H1, Y2 = (p: number) => P2 + ((bmax - p) / (bmax - bmin)) * H2;
  const rmax = rateAxisMax(data, R), rst = 5, Y3 = (r: number) => P3b - (r / rmax) * H3;
  const ep: Episode | null = selEp != null ? view.eps[selEp] ?? null : null;
  const yr = selYear;
  const n = view.years.length;
  const rateLabel = R === "us" ? "미국 기준금리" : "한국 기준금리";
  const pts = close.map((v, i) => [XE(view.years[i]), Y1(v)] as const);
  const path = (a: number, b: number) => { let q = ""; for (let i = a; i <= b; i++) q += (i === a ? "M" : "L") + pts[i][0].toFixed(1) + "," + pts[i][1].toFixed(1); return q; };
  const inDown = (Y: number) => episodeIndexOfYear(view.eps, Y);
  const rate = (Yr: number, m: number) => rateAt(data, R, `${Yr}-${String(m).padStart(2, "0")}`);
  const tR0 = monthPos(data.rate[R].from), tA = Math.max(y0 + 1, tR0);
  const recBands = !us ? [] : data.rec;
  const dots = mergeEventDots(view.ev.map((e) => ({ id: e.id, x: X(Math.min(Math.max(e.t, y0 + 1), last + 1)), linked: view.eps.some((q) => e.t >= q.py + 1 && e.t < q.ty + 1) })));
  const five = (PW / span) * 5 >= 34; // 5년 라벨이 겹치지 않는 최소 간격(px)
  const decs: number[] = []; for (let Y = Math.ceil((y0 + 1) / 10) * 10; Y <= last; Y += 10) decs.push(Y);
  const ovPath = (() => {
    let q = "", st = false;
    data.ovl[R].v.forEach((v, i) => {
      const [yy, mm] = data.ovl[R].from.split("-").map(Number), mi = yy * 12 + (mm - 1) + i, t = (mi + 1) / 12;
      if (t < y0 + 1 || t > last + 1) return;
      q += (st ? "L" : "M") + X(t).toFixed(1) + "," + Y3(v).toFixed(1); st = true;
    });
    return q;
  })();
  const alt = `${view.label} 연말 지수, 연간 등락, ${rateLabel}를 같은 시간축에 세 줄로 나눈 그림. 같은 값은 아래 연도별 표에 있어요`;

  const pick = (clientX: number, svg: SVGSVGElement) => {
    const r = svg.getBoundingClientRect();
    onPickYear(yearAtX(view, W, ((clientX - r.left) / r.width) * W));
  };

  // C3: 선택선은 글자 구간(연간 등락 캡션·이름표 줄·금리 캡션·범례)에서 끊는다
  const selLine = yr != null ? [[P1, cap2 - 13], [cap2 + 4, P2b], [P3 - 2, P3b]] : [];
  const legendRight = (() => {
    let rx = W - RP; const items: React.ReactNode[] = [];
    items.push(<text key="ev" className={SVG_TEXT} fontSize={11} x={rx} y={cap2} textAnchor="end" style={HALO}>사건</text>);
    rx -= capWidth("사건") + 5;
    items.push(<circle key="evd" cx={rx - 3} cy={cap2 - 4} r={3.3} fill={C.fg} />);
    rx -= 14;
    if (us) {
      const t = W < 300 ? "경기침체" : "미국 경기침체(NBER)";
      items.push(<text key="rt" className={SVG_TEXT} fontSize={11} x={rx} y={cap2} textAnchor="end" style={HALO}>{t}</text>);
      rx -= capWidth(t) + 4;
      items.push(<g key="rs"><rect x={rx - 12} y={cap2 - 9} width={12} height={10} rx={2} fill={C.fg} opacity={0.13} /><rect x={rx - 12} y={cap2 - 9} width={12} height={2} fill={C.ink2} /></g>);
    }
    return items;
  })();

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={alt} data-testid="invest-chart"
      style={{ display: "block", touchAction: "pan-y", userSelect: "none", fontVariantNumeric: "tabular-nums" }}
    >
      <defs>
        <pattern id={`hz${uid}`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={1.6} height={4} fill={C.fg} opacity={0.55} /></pattern>
      </defs>
      <text className={SVG_TEXT} fontSize={11} x={0} y={11}>지수 · 해마다 연말 값 · {last}년 말까지</text>
      {/* 미국 경기침체 띠(NBER): 세 층을 관통하는 중립 면 + 위 2px 막대. 코스피에서는 그리지 않음 */}
      {us && (
        <g data-band="1">
          {recBands.map((r) => {
            let [a, b] = recessionSpan(r); a = Math.max(a, y0 + 1); b = Math.min(b, last + 1);
            if (b <= a) return null;
            const { x, w } = bandRect(X(a), X(b));
            return (
              <g key={r.s}>
                <rect x={x.toFixed(1)} y={P1 - 5} width={w.toFixed(1)} height={P3b - P1 + 5} fill={C.fg} opacity={0.07} data-rec={r.s} />
                <rect x={x.toFixed(1)} y={P1 - 5} width={w.toFixed(1)} height={2} fill={C.ink2} />
              </g>
            );
          })}
        </g>
      )}
      {/* C2: 하락~전고점 구간 면은 행을 펼치거나 그 구간의 해를 고를 때만(brand 옅은 면, 위 막대 없음) */}
      {ep && (
        <g data-testid="recovery-band" data-band-ep={selEp}>
          {[[P1, H1], [P2, H2]].map(([p, h]) => <rect key={p} x={XE(ep.py)} y={p - 2} width={Math.max(1, XE(ep.ry ?? last) - XE(ep.py))} height={h + 4} rx={3} fill={C.brandSoft} />)}
        </g>
      )}
      {yr != null && [[P1, H1], [P2, H2]].map(([p, h]) => <rect key={p} x={X(yr)} y={p} width={X(yr + 1) - X(yr)} height={h} fill={C.brandSoft} />)}
      {decs.map((Y) => <line key={Y} x1={XE(Y)} x2={XE(Y)} y1={P1} y2={P3b} stroke={C.ink3} strokeWidth={0.8} opacity={0.75} />)}
      {T1.tk.map((t) => {
        const y = Y1(t);
        return (
          <g key={t}>
            <line x1={GX} x2={W - RP} y1={y} y2={y} stroke={C.hair} />
            <text className={SVG_TEXT} fontSize={11} x={GX - 6} y={y + 4} textAnchor="end">{fmtLevel(t)}</text>
          </g>
        );
      })}
      <path d={`${path(0, n - 1)}L${pts[n - 1][0]},${P1b}L${pts[0][0]},${P1b}Z`} fill={C.fg} opacity={0.05} />
      <path d={path(0, n - 1)} fill="none" stroke={C.fg} strokeOpacity={0.85} strokeWidth={1.4} strokeLinejoin="round" />
      {view.eps.map((e, k) => <path key={k} d={path(e.py - y0, e.ty - y0)} fill="none" className={LOSS_STROKE} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" opacity={selEp == null || selEp === k ? 1 : 0.4} />)}
      {BW >= 5.5 && pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={1.7} fill={C.card} stroke={C.fg} strokeWidth={1} opacity={0.8} />)}
      {view.eps.map((e, k) => {
        const on = selEp == null || selEp === k;
        return [[e.py, C.fg, ""], [e.ty, "", LOSS_FILL]].map(([Y, f, cls], j) => (
          <circle key={`${k}-${j}`} cx={XE(Y as number)} cy={Y1(ix(Y as number))} r={3.2} fill={(f as string) || undefined} className={(cls as string) || undefined} stroke={C.card} strokeWidth={1.5} opacity={on ? 1 : 0.5} />
        ));
      })}
      {ep && ep.ry && (
        <g>
          <line x1={XE(ep.py)} x2={XE(ep.ry)} y1={Y1(ep.pc)} y2={Y1(ep.pc)} stroke={C.ink2} strokeDasharray="3 3" />
          <circle cx={XE(ep.ry)} cy={Y1(ep.pc)} r={3.4} fill={C.card} stroke={C.fg} strokeWidth={1.5} />
        </g>
      )}
      {yr != null && <circle cx={XE(yr)} cy={Y1(ix(yr))} r={4.6} fill={C.card} stroke={C.brand} strokeWidth={2.2} />}
      {/* ⓑ 연간 등락 */}
      <text className={SVG_TEXT} fontSize={11} x={0} y={cap2} style={HALO}>연간 등락</text>
      {Array.from({ length: Math.floor((bmax - bmin) / rstep) + 1 }, (_, i) => bmin + i * rstep).map((t) => {
        const y = Y2(t);
        return (
          <g key={t}>
            <line x1={GX} x2={W - RP} y1={y} y2={y} stroke={t === 0 ? C.ink3 : C.hair} />
            {(t === 0 || t === bmax || t === bmin || (t === 20 && bmax > 20)) && <text className={SVG_TEXT} fontSize={11} x={GX - 6} y={y + 4} textAnchor="end">{t === 0 ? "0%" : fmtPct(t, 0)}</text>}
          </g>
        );
      })}
      {view.eps.map((e, k) => e.ongoing && (
        <rect key={`ong${k}`} x={XE(e.py)} y={P2} width={XE(last) - XE(e.py)} height={H2} fill="none" stroke={C.ink2} strokeDasharray="3 3" strokeWidth={1} opacity={selEp == null || selEp === k ? 1 : 0.5} />
      ))}
      {/* R4: +20% 점선(크게 오른 해 기준). 넘은 막대는 빨강 100%, 그 밖의 오른 막대는 옅게, 빠진 때는 파랑 */}
      {bmax >= 20 && <line x1={GX} x2={W - RP} y1={Y2(20)} y2={Y2(20)} stroke={C.ink2} strokeDasharray="4 3" strokeWidth={1} data-testid="rise-line" />}
      {view.years.slice(1).map((Y, j) => {
        const i = j + 1, r = view.ret[i] as number, xa = X(Y) + 0.5, w = Math.max(1.2, BW - 1), y0b = Y2(0), y1b = Y2(r), k = inDown(Y), on = selEp == null || selEp === k;
        const big = view.close[i] / view.close[i - 1] - 1 > RISE_THRESHOLD;
        const common = { x: xa.toFixed(1), y: Math.min(y0b, y1b).toFixed(1), width: w.toFixed(1), height: Math.max(0.8, Math.abs(y1b - y0b)).toFixed(1) };
        if (k >= 0) return <rect key={Y} {...common} className={LOSS_FILL} opacity={on ? 1 : 0.45} />;
        if (r > 0) return <rect key={Y} {...common} className="fill-rose-600 dark:fill-rose-400" opacity={big ? 1 : 0.35} data-rise={big ? "1" : undefined} />;
        return <rect key={Y} {...common} fill={C.ink2} opacity={0.55} />;
      })}
      {/* 사건 점(C1: 6px 안 점은 합침). 크게 빠진 때와 연결된 사건이 있으면 큰 점 */}
      <g data-events="1">
        {dots.filter((d) => !d.linked).map((d) => <circle key={d.ids[0]} cx={d.x.toFixed(1)} cy={P2 - 5} r={2} fill={C.fg} opacity={0.5} data-ev={d.ids[0]} data-ev-ids={d.ids.join(",")} />)}
        {dots.filter((d) => d.linked).map((d) => <circle key={d.ids[0]} cx={d.x.toFixed(1)} cy={P2 - 5} r={3.3} fill={C.fg} stroke={C.card} strokeWidth={1.2} data-ev={d.ids[0]} data-ev-ids={d.ids.join(",")} data-linked="1" />)}
      </g>
      {legendRight}
      {L.labels.map((l) => !l.drop && (
        <g key={l.k}>
          <text className="fill-foreground" fontSize={11} fontWeight={600} x={l.x0} y={P2b + 12 + l.tier * 14} opacity={selEp == null || selEp === l.k ? 1 : 0.6} data-nm="1" style={HALO}>{l.t}</text>
          {view.eps[l.k].ongoing && <line x1={l.x0} x2={l.x0 + l.w} y1={P2b + 15 + l.tier * 14} y2={P2b + 15 + l.tier * 14} stroke={C.ink2} strokeDasharray="2 2" />}
        </g>
      ))}
      {/* ⓒ 기준금리 */}
      <text className={SVG_TEXT} fontSize={11} x={0} y={cap3} style={HALO}>{rateLabel} · 매달 값</text>
      <g style={HALO}>
        <rect x={0} y={lg - 9} width={12} height={9} rx={2} fill={C.ink2} /><text className={SVG_TEXT} fontSize={11} x={16} y={lg}>올라간 해</text>
        <rect x={74} y={lg - 9} width={12} height={9} rx={2} fill={`url(#hz${uid})`} stroke={C.ink3} /><text className={SVG_TEXT} fontSize={11} x={90} y={lg}>내려간 해</text>
        <line x1={148} x2={158} y1={lg - 4} y2={lg - 4} stroke={C.ink2} strokeWidth={2} strokeLinecap="round" /><text className={SVG_TEXT} fontSize={11} x={163} y={lg}>거의 그대로</text>
      </g>
      {Array.from({ length: Math.floor(rmax / rst) + 1 }, (_, i) => i * rst).map((t) => {
        const y = Y3(t);
        return (
          <g key={t}>
            <line x1={GX} x2={W - RP} y1={y} y2={y} stroke={t === 0 ? C.ink3 : C.hair} />
            <text className={SVG_TEXT} fontSize={11} x={GX - 6} y={y + 4} textAnchor="end">{t}%</text>
          </g>
        );
      })}
      {view.years.map((Y) => {
        const c = view.yrDir[Y]?.k;
        if (!c || c === "none" || c === "flat") return null;
        return <path key={Y} d={`${stepPath(rate, X, Y3, Y, Y + 1, P3b)}L${X(Y + 1).toFixed(1)},${P3b}Z`} fill={c === "up" ? C.ink2 : `url(#hz${uid})`} stroke={c === "down" ? C.ink3 : undefined} strokeWidth={c === "down" ? 0.6 : undefined} />;
      })}
      <path d={stepPath(rate, X, Y3, tA, last + 1, null)} fill="none" stroke={C.fg} strokeWidth={1.3} strokeLinejoin="round" />
      {/* 겹쳐 보기 선: 항상 DOM에 두고 불투명도만 전환(재마운트 없음, 스케일은 켜기 전·후 같음) */}
      <g data-testid="overlay-line" aria-hidden="true" style={{ opacity: overlayOn ? 1 : 0, pointerEvents: "none" }} className="motion-safe:transition-opacity motion-safe:duration-200 motion-safe:ease-out">
        <path d={ovPath} fill="none" stroke={C.brand} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
        {Array.from({ length: Math.floor(rmax / rst) + 1 }, (_, i) => i * rst).map((t) => <text key={t} className={BRAND_TEXT_FILL} fontSize={11} x={W - RP + 4} y={Y3(t) + 4} style={HALO}>{t}%</text>)}
      </g>
      {tA > y0 + 1 && <rect x={X(y0 + 1)} y={P3} width={X(tA) - X(y0 + 1)} height={H3} fill={C.sec} opacity={0.8} data-nodata="1" />}
      {ep && <rect x={XE(ep.py)} y={P3 - 1} width={XE(ep.ty) - XE(ep.py)} height={H3 + 2} rx={3} fill="none" stroke={C.brand} strokeWidth={2} />}
      {tA > y0 + 1 && <text className={SVG_TEXT} fontSize={11} x={X(y0 + 1) + 8} y={P3 + H3 / 2 + 4} style={HALO}>자료 없음</text>}
      {yr != null && (
        <g data-testid="year-select">
          <rect x={X(yr)} y={P3 - 1} width={X(yr + 1) - X(yr)} height={H3 + 2} rx={2} fill="none" stroke={C.brand} strokeWidth={2} />
          {selLine.map(([a, b], i) => <line key={i} x1={XE(yr)} x2={XE(yr)} y1={a} y2={b} stroke={C.brand} strokeWidth={1.4} />)}
        </g>
      )}
      {Array.from({ length: Math.floor((last - Math.ceil((y0 + 1) / 5) * 5) / 5) + 1 }, (_, i) => Math.ceil((y0 + 1) / 5) * 5 + i * 5).map((Y) => {
        // x축 연도: 5년 간격 눈금, 라벨은 글자(4자리≈27px)가 겹치지 않는 폭이면 5년마다, 좁으면(390·320) 10년마다
        const x = XE(Y), major = Y % 10 === 0, label = five ? true : major;
        return (
          <g key={Y}>
            <line x1={x} x2={x} y1={P3b} y2={P3b + (label ? 5 : 3)} stroke={C.ink3} />
            {label && <text className={SVG_TEXT} fontSize={11} x={x} y={AX} textAnchor="middle">{Y}</text>}
          </g>
        );
      })}
      <rect
        x={GX} y={P1 - 6} width={PW} height={P3b - P1 + 6} fill="transparent" data-testid="invest-chart-hit"
        onPointerDown={(e) => { dragging.current = true; (e.currentTarget as Element).setPointerCapture?.(e.pointerId); pick(e.clientX, e.currentTarget.ownerSVGElement as SVGSVGElement); }}
        onPointerMove={(e) => { if (dragging.current) pick(e.clientX, e.currentTarget.ownerSVGElement as SVGSVGElement); }}
        onPointerUp={() => { dragging.current = false; }}
        onPointerCancel={() => { dragging.current = false; }}
      />
    </svg>
  );
}
