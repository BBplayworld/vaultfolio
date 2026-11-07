import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { MAIN_PALETTE, pickDonutLabelColor } from "@/config/theme";
import { DONUT_LABEL_MIN_PCT, DonutLabel } from "../dashboard";

const contrast = (hex: string, fg: string) => {
  const lum = (h: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  const [a, b] = [lum(hex), lum(fg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

const base = { cx: 100, cy: 100, midAngle: 45, innerRadius: 55, outerRadius: 130, value: 1, activeTab: "all", itemKey: "k" };
const render = (name: string, pct: number) => renderToStaticMarkup(<svg><DonutLabel {...base} name={name} pct={pct} color="#5b6fbf" /></svg>);

describe("홈 도넛 라벨 (#4.46 #82)", () => {
  it("라벨 최소 비율: 3자 9 / 4자 11 / 5자 13", () => {
    expect(DONUT_LABEL_MIN_PCT("부동산")).toBe(9);
    expect(DONUT_LABEL_MIN_PCT("금융자산")).toBe(11);
    expect(DONUT_LABEL_MIN_PCT("금융자산군")).toBe(13);
  });
  it("5.0%·3.0% 조각은 라벨 없음, 12% 금융자산은 라벨, 8% 부채는 없음", () => {
    expect(render("금융자산", 5)).not.toContain("<text");
    expect(render("부채", 3)).not.toContain("<text");
    expect(render("금융자산", 12)).toContain("12.0%");
    expect(render("부채", 8)).not.toContain("<text");
    expect(render("부채", 9)).toContain("<text");
  });
  it("라벨은 이름과 %만(금액 없음), 두 줄 x 동일", () => {
    const html = render("부동산", 60);
    expect(html.match(/<tspan/g)).toHaveLength(2);
    expect(html).toContain("부동산");
    expect(html).toContain("60.0%");
    const xs = [...html.matchAll(/<tspan x="([^"]+)"/g)].map((m) => m[1]);
    expect(xs[0]).toBe(xs[1]);
  });
  it("선택 필터와 다른 조각은 라벨 없음", () => {
    const html = renderToStaticMarkup(<svg><DonutLabel {...base} activeTab="other" name="부동산" pct={60} color="#5b6fbf" /></svg>);
    expect(html).not.toContain("<text");
  });
});

describe("pickDonutLabelColor — MAIN_PALETTE 12색 모두 4.5:1 이상", () => {
  it.each(MAIN_PALETTE.map((c, i) => [i, c.slice(0, 7)] as const))("[%i] %s", (_i, hex) => {
    const fg = pickDonutLabelColor(hex);
    expect(contrast(hex, fg)).toBeGreaterThanOrEqual(4.5);
  });
});
