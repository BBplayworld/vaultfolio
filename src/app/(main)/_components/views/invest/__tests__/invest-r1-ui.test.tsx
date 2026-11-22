// 5.138 UI 묶음: 축 라벨 규칙·클립 상한·스테퍼·이름표 탭·브래킷·클립 값 라벨·낙폭 상시·히트맵 라벨
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { fmtPct } from "@/lib/invest/text";
import { DropList } from "../drop-list";
import { YearGrid } from "../year-grid";
import { InvestView } from "../invest-view";
import { layoutMain, MainChart, retAxisCap, xLabelPlan } from "../main-chart";

const views = { spx: buildIndexView(marketHistory, "spx"), ndx: buildIndexView(marketHistory, "ndx"), kospi: buildIndexView(marketHistory, "kospi") };
const chart = (k: keyof typeof views, w: number) =>
  renderToStaticMarkup(<MainChart data={marketHistory} view={views[k]} width={w} wide={false} selEp={null} selYear={null} overlayOn={false} onPickYear={() => {}} />);

describe("x축 라벨 규칙 xLabelPlan(D-4·D-5)", () => {
  const plan = (k: keyof typeof views, w: number) => { const v = views[k]; return xLabelPlan(w - 50 - 24, v.last - v.start); };
  it("S&P: 1280은 5년 4자리, 390은 10년 4자리, 320은 10년 `'80` 축약", () => {
    expect(plan("spx", 928)).toEqual({ step: 5, short: false });
    expect(plan("spx", 326)).toEqual({ step: 10, short: false });
    expect(plan("spx", 264)).toEqual({ step: 10, short: true });
  });
  it("모든 지수·폭에서 라벨 사이 간격 ≥4px(근사 폭 기준)", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) for (const w of [264, 296, 326, 928]) {
      const v = views[k], PW = w - 74, span = v.last - v.start, p = xLabelPlan(PW, span), gap = ((PW / span) * p.step) - (p.short ? 19.5 : 29.5);
      expect(gap, `${k} ${w}`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("연간 등락 클립(D-7)", () => {
  it("상한: S&P 0 · 나스닥 +60 · 코스피 +80, 하락 쪽은 −60 초과일 때만", () => {
    const cap = (k: keyof typeof views) => { const r = views[k].ret.filter((x): x is number => x != null); return retAxisCap(views[k], Math.max(...r), Math.min(...r)); };
    expect(cap("spx")).toEqual({ up: null, dn: null });
    expect(cap("ndx").up).toBe(60);
    expect(cap("kospi").up).toBe(80);
  });
  it("자른 막대마다 실제 값 라벨(나스닥 3·코스피 2·S&P 0), 값 = fmtPct(실제)", () => {
    for (const [k, n] of [["spx", 0], ["ndx", 3], ["kospi", 2]] as const) {
      const html = chart(k, 326);
      expect((html.match(/data-testid="clip-label"/g) || []).length, k).toBe(n);
    }
    const html = chart("ndx", 326);
    for (const y of [1991, 1998, 1999]) expect(html).toContain(fmtPct(views.ndx.ret[y - views.ndx.start] as number));
  });
});

describe("해 스테퍼·이름표 탭·브래킷(D-1·D-8)", () => {
  it("이름표 탭 히트 rect(name-hit)와 하락 브래킷이 이름표 수만큼 있다", () => {
    for (const [k, n] of [["spx", 4], ["ndx", 3], ["kospi", 6]] as const) {
      const html = chart(k, 326);
      expect(html).toContain('data-testid="name-hit"');
      expect((html.match(/data-testid="drop-bracket"/g) || []).length, k).toBe(n);
    }
  });
  it("글자는 전부 12px 이상(SVG fontSize)", () => {
    const html = chart("kospi", 264);
    const sizes = [...html.matchAll(/font-size="(\d+)"/g)].map((m) => +m[1]);
    expect(sizes.length).toBeGreaterThan(10);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });
  it("이름표 단 3단 이내 배치는 유지(320 코스피 ≤3단)", () => {
    expect(layoutMain(views.kospi, 264, false).nameRows).toBeLessThanOrEqual(3);
  });
  it("스테퍼 소스: 기존 pickYear만 호출, 40px 버튼·경계 disabled·키보드 ←/→·상태 신설 0", () => {
    const src = readFileSync(join(__dirname, "..", "invest-view.tsx"), "utf8");
    for (const id of ["year-stepper", "year-prev", "year-next", "year-stepper-label"]) expect(src).toContain(`data-testid="${id}"`);
    expect(src).toContain('aria-label="해 이동"');
    expect(src).toContain('"ArrowLeft"');
    expect(src).toMatch(/size-10/);
    expect(src).toContain("pickYear(yr == null ? view.last");
    expect(src).not.toMatch(/useState<number \| null>\(null\);\s*const \[stepYr/);
    expect(renderToStaticMarkup(<InvestView variant="app" />)).toContain("invest-chart-skeleton");
  });
});

describe("낙폭 상시(D-3)·히트맵 라벨(D-9)", () => {
  it("모든 하락 행에 `drop-dd` 낙폭 값, 펼친 detail-dd와 같은 문자열", () => {
    for (const k of ["spx", "ndx", "kospi"] as const) {
      const html = renderToStaticMarkup(<DropList data={marketHistory} view={views[k]} sel={null} yr={null} onSelect={() => {}} inlineDetail width={300} />);
      const dd = [...html.matchAll(/data-testid="drop-dd"[^>]*>([^<]+)</g)].map((m) => m[1]);
      expect(dd).toEqual(views[k].eps.map((e) => fmtPct(e.dd)));
    }
  });
  it("히트맵: 열 머리 aria-label은 전체 `1960년대`, 측정 전 기본은 좁은 표기(`60년대`)·행 라벨 `0`", () => {
    const html = renderToStaticMarkup(<YearGrid view={views.spx} period={{ sy: 2015, ey: 2025 }} showLevels />);
    expect(html).toContain('aria-label="1960년대"');
    expect(html).toContain(">60년대<");
    expect(html).not.toContain(">0년<");
  });
});
