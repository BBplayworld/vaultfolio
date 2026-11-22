"use client";

// 하락 행 펼침의 구간 확대 그림: 고점 1년 전 ~ 전고점 되찾은 해 + 1(없으면 데이터 끝). 연말 지수 + 월 기준금리(+미국 침체 띠)
import { useId } from "react";
import { rateAt, recessionSpan, type Episode, type IndexView } from "@/lib/invest/calc";
import { bandRect, logTicks, stepPath } from "@/lib/invest/chart";
import { fmtLevel } from "@/lib/invest/text";
import type { MarketHistoryData } from "@/lib/invest/types";
import { C, HALO, LOSS_FILL, LOSS_STROKE, SVG_TEXT } from "./chart-style";

export function ZoomChart({ data, view, ep, width }: { data: MarketHistoryData; view: IndexView; ep: Episode; width: number }) {
  const uid = useId().replace(/:/g, "");
  const W = width, GX = 44, RP = 12, PW = W - GX - RP;
  const a = Math.max(view.start, ep.py - 1), z = Math.min(view.last, (ep.ry ?? view.last) + 1), span = z - a;
  const X = (t: number) => GX + ((t - a) / span) * PW, XE = (Y: number) => X(Y);
  const R = view.rate, close = view.close, ix = (Y: number) => close[Y - view.start];
  const seg: number[] = []; for (let Y = a; Y <= z; Y++) seg.push(ix(Y));
  const T1 = logTicks(Math.min(...seg), Math.max(...seg), 5), lnLo = Math.log(T1.lo), lnHi = Math.log(T1.hi);
  const wide = W > 420;
  const H1 = wide ? 130 : 104, H3 = wide ? 54 : 44, P1 = 14, P1b = P1 + H1, cap3 = P1b + 26, P3 = cap3 + 10, P3b = P3 + H3, AX = P3b + 16, H = AX + 4;
  const Y1 = (v: number) => P1 + H1 - ((Math.log(v) - lnLo) / (lnHi - lnLo)) * H1;
  const mv: number[] = [];
  for (let mi = (a + 1) * 12; mi < (z + 1) * 12; mi++) { const v = rateAt(data, R, `${Math.floor(mi / 12)}-${String((mi % 12) + 1).padStart(2, "0")}`); if (v != null) mv.push(v); }
  const mx = Math.max(...mv, 0);
  const rmax = R === "us" ? (mx > 6 ? 10 : mx > 4 ? 6 : 4) : mx > 4 ? 6 : 4, rst = rmax > 6 ? 5 : 2, Y3 = (r: number) => P3b - (r / rmax) * H3;
  const rate = (Yr: number, m: number) => rateAt(data, R, `${Yr}-${String(m).padStart(2, "0")}`);
  const shift = (t: number) => X(t - 1); // 월 계열 t는 달력 연도 → 연말 위치 기준으로 한 해 당김
  const pth = (p: number, q: number) => { let r = ""; for (let Y = p; Y <= q; Y++) r += (Y === p ? "M" : "L") + XE(Y).toFixed(1) + "," + Y1(ix(Y)).toFixed(1); return r; };
  const stepY = Math.max(1, Math.ceil(span / Math.max(2, Math.floor(PW / 40))));
  const dot = (Y: number, kind: "peak" | "trough" | "recover", txt: string, dy: number, an?: "start" | "middle" | "end") => (
    <g key={kind}>
      <circle cx={XE(Y)} cy={Y1(ix(Y))} r={4} fill={kind === "peak" ? C.fg : kind === "recover" ? C.sec : undefined} className={kind === "trough" ? LOSS_FILL : undefined} stroke={kind === "recover" ? C.fg : C.sec} strokeWidth={2} />
      <text className="fill-foreground" fontSize={11} fontWeight={600} x={XE(Y)} y={Y1(ix(Y)) + dy} textAnchor={an || "middle"} style={{ ...HALO, stroke: "var(--secondary)" }}>{txt}</text>
    </g>
  );
  const label = `${ep.name} 구간 확대. 연말 지수와 ${R === "us" ? "미국 기준금리" : "한국 기준금리"}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={label} data-testid="zoom-chart" style={{ display: "block", fontVariantNumeric: "tabular-nums" }}>
      <defs><pattern id={`hz${uid}`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width={1.6} height={4} fill={C.fg} opacity={0.55} /></pattern></defs>
      {T1.tk.map((t) => <g key={t}><line x1={GX} x2={W - RP} y1={Y1(t)} y2={Y1(t)} stroke={C.hair} /><text className={SVG_TEXT} fontSize={11} x={GX - 6} y={Y1(t) + 4} textAnchor="end">{fmtLevel(t)}</text></g>)}
      {Array.from({ length: z - a + 1 }, (_, i) => a + i).map((Y) => <line key={Y} x1={XE(Y)} x2={XE(Y)} y1={P1} y2={P3b} stroke={C.hair} strokeWidth={0.8} />)}
      {view.rate === "us" && data.rec.map((r) => {
        let [t0, t1] = recessionSpan(r); t0 = Math.max(t0 - 1, a); t1 = Math.min(t1 - 1, z);
        if (t1 <= t0) return null;
        const b = bandRect(X(t0), X(t1));
        return <rect key={r.s} x={b.x.toFixed(1)} y={P1} width={b.w.toFixed(1)} height={P3b - P1} fill={C.fg} opacity={0.08} />;
      })}
      <line x1={XE(ep.py)} x2={XE(Math.min(z, ep.ry ?? z))} y1={Y1(ep.pc)} y2={Y1(ep.pc)} stroke={C.ink2} strokeDasharray="3 3" opacity={0.8} />
      <path d={pth(a, z)} fill="none" stroke={C.fg} strokeOpacity={0.9} strokeWidth={1.5} strokeLinejoin="round" />
      <path d={pth(ep.py, ep.ty)} fill="none" className={LOSS_STROKE} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      {Array.from({ length: z - a + 1 }, (_, i) => a + i).map((Y) => <circle key={Y} cx={XE(Y)} cy={Y1(ix(Y))} r={2} fill={C.card} stroke={C.fg} strokeWidth={1} />)}
      {dot(ep.py, "peak", "고점", -9, XE(ep.py) < GX + 22 ? "start" : "middle")}
      {dot(ep.ty, "trough", "바닥", 17)}
      {ep.ry && ep.ry <= z && dot(ep.ry, "recover", "전고점 되찾음", -9, XE(ep.ry) > W - RP - 46 ? "end" : "middle")}
      <text className={SVG_TEXT} fontSize={11} x={0} y={cap3}>{R === "us" ? "미국 기준금리" : "한국 기준금리"} · 매달 값</text>
      {Array.from({ length: Math.floor(rmax / rst) + 1 }, (_, i) => i * rst).map((t) => <g key={t}><line x1={GX} x2={W - RP} y1={Y3(t)} y2={Y3(t)} stroke={t === 0 ? C.ink3 : C.hair} /><text className={SVG_TEXT} fontSize={11} x={GX - 6} y={Y3(t) + 4} textAnchor="end">{t}%</text></g>)}
      {Array.from({ length: z - a }, (_, i) => a + 1 + i).map((Y) => {
        const c = view.yrDir[Y]?.k;
        if (!c || c === "none" || c === "flat") return null;
        return <path key={Y} d={`${stepPath(rate, shift, Y3, Y, Y + 1, P3b)}L${X(Y).toFixed(1)},${P3b}Z`} fill={c === "up" ? C.ink2 : `url(#hz${uid})`} stroke={c === "down" ? C.ink3 : undefined} strokeWidth={c === "down" ? 0.6 : undefined} />;
      })}
      <path d={stepPath(rate, shift, Y3, a + 1, z + 1, null)} fill="none" stroke={C.fg} strokeWidth={1.3} strokeLinejoin="round" />
      {!mv.length && <g><rect x={GX} y={P3} width={PW} height={H3} fill={C.sec} opacity={0.8} /><text className={SVG_TEXT} fontSize={11} x={GX + PW / 2} y={P3 + H3 / 2 + 4} textAnchor="middle" style={HALO}>자료 없음</text></g>}
      {[ep.py, ep.ty].map((Y) => <rect key={Y} x={XE(Y) - 1} y={P3b} width={2} height={6} fill={Y === ep.py ? C.fg : undefined} className={Y === ep.py ? undefined : LOSS_FILL} />)}
      {Array.from({ length: z - a + 1 }, (_, i) => a + i).map((Y) => {
        if ((Y - a) % stepY && Y !== z) return null;
        if (Y !== z && z - Y < stepY) return null;
        const x = XE(Y);
        return <text key={Y} className={SVG_TEXT} fontSize={11} x={x} y={AX + 3} textAnchor={x < GX + 14 ? "start" : x > W - RP - 14 ? "end" : "middle"}>{Y}</text>;
      })}
    </svg>
  );
}
