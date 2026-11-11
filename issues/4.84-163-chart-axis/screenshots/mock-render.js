// 페이지 컨텍스트에서 실행되는 목업 렌더러 (제안 알고리즘 그대로)
window.MOCK = (() => {
  const fmtFull = (v, cur) => cur === "USD" ? "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2 }) : cur === "JPY" ? "¥" + Math.round(v).toLocaleString() : Math.round(v).toLocaleString("ko-KR") + "원";
  const trim = (n) => String(+n.toFixed(2));
  const fmtAxis = (v, cur, step) => {
    if (cur === "USD") return "$" + v.toLocaleString("en-US", { maximumFractionDigits: step < 1 ? 2 : 0, minimumFractionDigits: step < 0.1 ? 2 : step < 1 ? 1 : 0 });
    if (cur === "JPY") return "¥" + Math.round(v).toLocaleString();
    if (v >= 1e8) return trim(v / 1e8) + "억";
    if (v >= 1e4) return trim(v / 1e4) + "만";
    return Math.round(v).toLocaleString("ko-KR");
  };
  const niceTicks = (lo, hi, yOf, top, bottom, keep, inset = 6, maxN = 3) => {
    const span = hi - lo; const base = Math.pow(10, Math.floor(Math.log10(span / 3)) - 1);
    const steps = []; for (let k = 0; k < 4; k++) for (const m of [1, 2, 5]) steps.push(m * base * Math.pow(10, k));
    let fb = null;
    for (const step of steps) {
      if (Math.abs(yOf(0) - yOf(step)) < 12) continue;
      const out = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) { const y = yOf(v); if (y >= top + inset && y <= bottom - inset) out.push({ v, y }); }
      const f = out.filter(keep);
      if (f.length >= 2 && f.length <= maxN) return { step, ticks: f };
      if (f.length === 1 && !fb) fb = { step, ticks: f };
    }
    return fb || { step: 0, ticks: [] };
  };
  const el = (t, a, txt) => { const e = document.createElementNS("http://www.w3.org/2000/svg", t); for (const k in a) e.setAttribute(k, a[k]); if (txt !== undefined) e.textContent = txt; return e; };
  const COL = { up: "#fb7185", down: "#60a5fa", buy: "#f43f5e", sell: "#3b82f6" };
  const halo = { "paint-order": "stroke", stroke: "var(--card)", "stroke-width": 3, "stroke-linejoin": "round" };
  const st = (n, o) => { for (const k in o) n.style.setProperty(k, o[k]); return n; };

  // opts: {box, w,h, points:[{i,c}], cur, avg, today, up, mode:'mini'|'page', dots:[{i,kind,c}], selected, xLabels}
  function render(o) {
    const { w, h, points, cur, avg, today, mode } = o;
    const M = mode === "mini" ? { top: 8, bottom: 8, left: 2 } : { top: 20, bottom: 22, left: 12 };
    const tagTxt = fmtFull(today, cur);
    const gutter = Math.min(76, Math.max(46, tagTxt.length * 6.4 + 10));
    const plotW = w - M.left - gutter, plotH = h - M.top - M.bottom;
    const cs = points.map((p) => p.c).concat([today]);
    const min = Math.min(...cs), max = Math.max(...cs);
    // computeYDomain(평단 포함 규칙은 기존 그대로)
    let lo = min, hi = max, span = Math.max(max - min, max * 0.02), clamped = "none";
    if (avg > 0) { if (avg >= min - 0.4 * span && avg <= max + 0.4 * span) { lo = Math.min(lo, avg); hi = Math.max(hi, avg); } else clamped = avg > max ? "up" : "down"; }
    const pad = Math.max(hi - lo, max * 0.02) * 0.08; const dom = [lo - pad, hi + pad];
    const yOf = (c) => M.top + (1 - (c - dom[0]) / (dom[1] - dom[0])) * plotH;
    const n = points.length; const xOf = (i) => M.left + (i / (n - 1)) * plotW;
    const svg = el("svg", { width: w, height: h, viewBox: `0 0 ${w} ${h}` }); svg.style.display = "block";
    const gid = "g" + Math.random().toString(36).slice(2, 7);
    const defs = el("defs", {}); const lg = el("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 });
    const lc = o.up ? COL.up : COL.down;
    lg.append(el("stop", { offset: "0%", "stop-color": lc, "stop-opacity": 0.12 }), el("stop", { offset: "100%", "stop-color": lc, "stop-opacity": 0 })); defs.append(lg); svg.append(defs);
    const todayY = yOf(today); const avgY = avg > 0 ? (clamped === "up" ? M.top + 7 : clamped === "down" ? M.top + plotH - 7 : yOf(avg)) : null;
    // 눈금(플롯 안쪽 inset 10, 평단선·오늘 태그와 겹치면 제외)
    const nt = niceTicks(dom[0], dom[1], yOf, M.top, M.top + plotH, (t) => (avgY === null || Math.abs(t.y - avgY) >= 10) && (t.y < todayY ? todayY - t.y >= 12 : t.y - todayY >= 20));
    const ticks = nt.ticks;
    ticks.forEach((t) => { svg.append(st(el("line", { x1: M.left, x2: M.left + plotW, y1: t.y, y2: t.y, "stroke-width": 1 }), { stroke: "var(--foreground)", "stroke-opacity": 0.12 })); });
    const line = points.map((p, i) => `${i ? "L" : "M"}${xOf(i).toFixed(1)},${yOf(p.c).toFixed(1)}`).join("");
    svg.append(el("path", { d: `${line}L${xOf(n - 1)},${M.top + plotH}L${xOf(0)},${M.top + plotH}Z`, fill: `url(#${gid})` }), el("path", { d: line, fill: "none", stroke: lc, "stroke-width": 1.75, "stroke-linejoin": "round", "stroke-linecap": "round" }));
    if (avgY !== null) svg.append(st(el("line", { x1: M.left, x2: M.left + plotW, y1: avgY, y2: avgY, "stroke-width": 1.25, "stroke-dasharray": "4 3" }), { stroke: "var(--foreground)", "stroke-opacity": clamped === "none" ? 0.7 : 0.4 }));
    // 칩(종목 한 장)
    let chipMode = null;
    if (mode === "page" && avgY !== null) {
      const full = `내 평단 ${fmtFull(avg, cur)}${clamped === "up" ? " ↑" : clamped === "down" ? " ↓" : ""}`;
      const short = `평단 ${fmtAxis(avg, cur, nt.step || 1)}`;
      const xy = points.map((p, i) => ({ x: xOf(i), y: yOf(p.c) }));
      const dxy = (o.dots || []).map((d) => ({ x: xOf(d.i) + (d.dx || 0), y: yOf(d.c) }));
      const hits = (x, y, cw) => xy.filter((q) => q.x >= x - 2 && q.x <= x + cw + 2 && q.y >= y - 2 && q.y <= y + 22).length + dxy.filter((q) => q.x >= x - 8 && q.x <= x + cw + 8 && q.y >= y - 8 && q.y <= y + 28).length;
      const tryText = (txt) => {
        const cw = txt.length * 6.4 + 14; const best = [];
        // 1순위: 기존 4곳(좌·우 끝 × 선 위·아래)
        for (const y of [avgY - 24, avgY + 4]) for (const x of [M.left, M.left + plotW - cw]) if (y >= 0 && y + 20 <= h - M.bottom + 4 && hits(x, y, cw) === 0) best.push({ x, y, cw, d: 0 });
        // 2순위: 가로 8px 간격 스캔, 세로 ±(4..36)
        if (!best.length) for (const dy of [-24, 4, -32, 12, -40, 20]) for (let x = M.left; x <= M.left + plotW - cw; x += 8) { const y = avgY + dy; if (y >= 0 && y + 20 <= h - M.bottom + 4 && hits(x, y, cw) === 0) best.push({ x, y, cw, d: Math.abs(dy) }); }
        best.sort((a, b) => a.d - b.d); return best[0] || null;
      };
      let c = tryText(full); chipMode = "plot";
      if (!c) { c = tryText(short); chipMode = "short"; }
      if (c) { svg.append(st(el("text", { x: c.x + 7, y: c.y + 14, "font-size": 11, "font-weight": 500, fill: "var(--foreground)" }, chipMode === "plot" ? full : short), halo)); }
      else chipMode = "gutter";
    }
    // 마커(매수 원 · 매도 마름모)
    (o.dots || []).forEach((d) => {
      const x = xOf(d.i) + (d.dx || 0), y = yOf(d.c);
      if (o.selected === d) svg.append(el("circle", { cx: x, cy: y, r: 11, fill: "none", stroke: "#5b6fbf", "stroke-width": 2 }));
      if (d.kind === "buy") svg.append(st(el("circle", { cx: x, cy: y, r: o.selected === d ? 7 : 5, fill: COL.buy }), { stroke: "var(--card)", "stroke-width": 2.5 }));
      else { const r = o.selected === d ? 8.5 : 6.5; svg.append(st(el("path", { d: `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`, fill: COL.sell }), { stroke: "var(--card)", "stroke-width": 2.5, "stroke-linejoin": "round" })); }
    });
    // 오늘 점 + 우측 gutter 라벨
    const gx = M.left + plotW + 6;
    svg.append(st(el("circle", { cx: M.left + plotW, cy: todayY, r: 3.5, fill: lc }), { stroke: "var(--card)", "stroke-width": 2 }));
    ticks.forEach((t) => svg.append(el("text", { x: gx, y: t.y + 3.5, "font-size": 10, fill: "var(--muted-foreground)" }, fmtAxis(t.v, cur, nt.step))));
    svg.append(st(el("text", { x: gx, y: todayY + 1, "font-size": 11, "font-weight": 600, fill: "var(--foreground)" }, tagTxt), {}), el("text", { x: gx, y: todayY + 12, "font-size": 10, fill: "var(--muted-foreground)" }, "오늘"));
    if (mode === "mini" && avgY !== null && Math.abs(avgY - todayY) >= 26) svg.append(el("text", { x: gx, y: avgY + 3.5, "font-size": 10, fill: "var(--muted-foreground)" }, "평단"));
    if (chipMode === "gutter" && Math.abs(avgY - todayY) >= 26) { svg.append(el("text", { x: gx, y: avgY + 1, "font-size": 10, "font-weight": 500, fill: "var(--foreground)" }, "평단"), el("text", { x: gx, y: avgY + 12, "font-size": 10, fill: "var(--muted-foreground)" }, fmtAxis(avg, cur, nt.step || 1))); }
    if (mode === "page") { svg.append(el("text", { x: M.left, y: h - 6, "font-size": 11, fill: "var(--muted-foreground)" }, o.x0), el("text", { x: M.left + plotW, y: h - 6, "font-size": 11, "text-anchor": "end", fill: "var(--muted-foreground)" }, o.x1)); }
    svg._info = { dom, raw: nt.step, min, max, ticks: ticks.map((t) => fmtAxis(t.v, cur, nt.step)), step: nt.step, chipMode, gutter, tag: tagTxt };
    return svg;
  }
  const series = (n, a, b, wob, seed) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return { c: a + (b - a) * t + Math.sin(t * 9 + seed) * wob + (r() - 0.5) * wob * 0.5 }; }); };
  return { render, series, fmtFull };
})();
