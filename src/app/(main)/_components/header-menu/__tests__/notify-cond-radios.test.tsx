// 시장 알림 받는 날 라디오 — 시장 알림 선택 시에만 표시, 결산·세금만이면 숨김(#4.91 대표 피드백)
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CondRadios } from "../notify-section";

const noop = () => {};
const html = (sel: string[], cond: "daily" | "pm2" = "daily") => renderToStaticMarkup(<CondRadios cond={cond} sel={sel} onChange={noop} />);

describe("CondRadios", () => {
  it("결산·세금만 고르면 숨김", () => {
    expect(html(["settle", "tax"])).toBe("");
    expect(html([])).toBe("");
  });
  it("아침 요약 또는 국내 장 마감이면 라디오 2개 표시", () => {
    for (const sel of [["morning"], ["kr"], ["morning", "settle"]]) {
      const h = html(sel);
      expect(h).toContain("시장 알림 받는 날");
      expect(h.match(/type="radio"/g)).toHaveLength(2);
      expect(h).toContain("큰 움직임 있는 날만 (지수 ±2%·환율 ±1%)");
    }
  });
  it("cond 값에 따라 선택 상태", () => {
    expect(html(["morning"], "daily")).toMatch(/notify-cond-daily"[^>]*checked/);
    expect(html(["morning"], "pm2")).toMatch(/notify-cond-pm2"[^>]*checked/);
  });
});
