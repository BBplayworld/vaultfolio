// 5.139 R2: 같은 해 1줄·겹쳐 보기 4항목·계단선·1280 표 열
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { buildPattern } from "@/lib/invest/pattern";
import { fmtPct } from "@/lib/invest/text";
import { EpisodeDetail } from "../drop-list";
import { RiseDetail } from "../rise-list";
import { SameYear } from "../nowrap";
import { MainChart } from "../main-chart";

const views = { spx: buildIndexView(marketHistory, "spx"), ndx: buildIndexView(marketHistory, "ndx"), kospi: buildIndexView(marketHistory, "kospi") };
const chart = (k: keyof typeof views, ov: "y10" | "cpi" | "unemp" | "fx" | null, selYear: number | null = null) =>
  renderToStaticMarkup(<MainChart data={marketHistory} view={views[k]} width={326} wide={false} selEp={null} selYear={selYear} overlay={ov} onPickYear={() => {}} />);

describe("SameYear 1줄", () => {
  it("현재 지수 제외·2개 값·단위만(인과·같이·함께 0)", () => {
    const h = renderToStaticMarkup(<SameYear view={views.spx} year={2008} />);
    expect(h).toContain('data-testid="same-year"');
    expect(h).toContain("같은 해");
    expect(h).toContain("나스닥100");
    expect(h).toContain("코스피");
    expect(h).not.toContain("S&amp;P 500");
    expect(h).toContain(fmtPct(views.ndx.ret[2008 - views.ndx.start] as number, 1));
    for (const w of ["같이", "함께", "때문"]) expect(h).not.toContain(w);
  });
  it("자료 없는 해는 줄 0", () => {
    expect(renderToStaticMarkup(<SameYear view={views.spx} year={1970} />)).toBe("");
  });
  it("하락 펼침·오른 해 펼침 안에 한 번씩", () => {
    const p = buildPattern(marketHistory, views.spx);
    const ep = views.spx.eps.find((e) => e.ty === 2008)!;
    const d = renderToStaticMarkup(<EpisodeDetail data={marketHistory} view={views.spx} ep={ep} index={0} width={326} />);
    expect(d.match(/data-testid="same-year"/g)).toHaveLength(1);
    const r = p.rise.find((x) => views.spx.same[x.y])!;
    expect(renderToStaticMarkup(<RiseDetail view={views.spx} r={r} />).match(/data-testid="same-year"/g)).toHaveLength(1);
  });
});

describe("겹쳐 보기 계단선", () => {
  it("물가·실업률은 연 값 점(overlay-dot)이 해마다 1개, 2024에서 끝나고 10년물은 점 0", () => {
    const h = chart("spx", "cpi");
    const n = (h.match(/data-testid="overlay-dot"/g) || []).length;
    expect(n).toBe(2024 - 1961 + 1);
    expect(chart("spx", "y10")).not.toContain('data-testid="overlay-dot"');
    expect(chart("spx", null)).toContain('data-testid="overlay-line"');
  });
  it("켜기 전후 SVG 높이 같음, 해 선택 시 그 해 점만 r=3.3", () => {
    const h = (s: string) => s.match(/viewBox="[^"]+"/)![0];
    expect(h(chart("spx", null))).toBe(h(chart("spx", "unemp")));
    const sel = chart("spx", "cpi", 2008);
    expect((sel.match(/data-testid="overlay-dot"[^>]*r="3.3"/g) || []).length).toBe(1);
  });
});

describe("겹쳐 보기 원/달러(5.143)", () => {
  const chartW = (ov: "fx" | "y10" | null, wide: boolean) => renderToStaticMarkup(<MainChart data={marketHistory} view={views.kospi} width={wide ? 700 : 326} wide={wide} selEp={null} selYear={null} overlay={ov} onPickYear={() => {}} />);
  it("점 44개(1982~2025), 눈금 좁은 폭 3개·넓은 폭 4개, 원 단위 쉼표", () => {
    const n = (chart("kospi", "fx").match(/data-testid="overlay-dot"/g) || []).length;
    expect(n).toBe(44);
    const t = (h: string) => [...h.matchAll(/data-testid="fx-tick"[^>]*>([^<]+)</g)].map((m) => m[1]);
    expect(t(chartW("fx", false))).toEqual(["600원", "1,000원", "1,500원"]);
    expect(t(chartW("fx", true))).toEqual(["600원", "900원", "1,200원", "1,500원"]);
    expect(t(chartW("fx", false)).every((x) => /^[0-9,]+원$/.test(x))).toBe(true);
  });
  it("켜기 전후 SVG 높이 같고, 원 눈금이 켜면 % 글자는 숨고 끄면 눈금 0", () => {
    const h = (s: string) => s.match(/viewBox="[^"]+"/)![0];
    expect(h(chart("kospi", null))).toBe(h(chart("kospi", "fx")));
    expect(chart("kospi", "y10")).not.toContain("fx-tick");
    const on = chart("kospi", "fx");
    expect(on).not.toMatch(/textAnchor="end"[^>]*>\d+%</);
  });
});
