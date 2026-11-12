import { describe, it, expect } from "vitest";
import { PUSH_CATALOG, PUSH_DEFAULT_TOPICS, normalizePushTopics, topicsOfMarket } from "../catalog";
import { buildPushMessage, PUSH_FALLBACK_BODY, PUSH_FALLBACK_TITLE } from "../message";

const BANNED = ["내 자산", "내자산", "보유", "평가", "순자산", "급락", "급등", "매수", "매도", "원)", "만원", "억"];

describe("catalog", () => {
  it("ID 유일·14개·기본값 2개", () => {
    const ids = PUSH_CATALOG.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(14);
    expect(ids).not.toContain("usdkrw");
    expect(PUSH_DEFAULT_TOPICS).toEqual(["kospi", "spx"]);
  });
  it("normalize — 알 수 없는 ID·중복 제거, 카탈로그 순서", () => {
    expect(normalizePushTopics(["spx", "zzz", "kospi", "spx", 3])).toEqual(["kospi", "spx"]);
  });
  it("회차 매핑 — 국내 지수·ETF는 kr, 해외 지수·미국 종목은 us", () => {
    const all = PUSH_CATALOG.map((t) => t.id);
    expect(topicsOfMarket(all, "kr").map((t) => t.id)).toContain("kosdaq");
    expect(topicsOfMarket(all, "us").map((t) => t.id)).toContain("sox");
    expect(topicsOfMarket(["kospi", "spx"], "us").map((t) => t.id)).toEqual(["spx"]);
  });
});

describe("buildPushMessage", () => {
  it("제목 M/D 국내 종가·부호·소수 1자리·0.0%", () => {
    const m = buildPushMessage("kr", "2026-11-12", [{ label: "코스피", rate: 0.84 }, { label: "코스닥", rate: -0.44 }, { label: "삼성전자", rate: 0.001 }], "daily");
    expect(m).toEqual({ m: "kr", t: "11/12 국내 종가", b: "코스피 +0.8% · 코스닥 -0.4% · 삼성전자 0.0%" });
  });
  it("미국 제목", () => {
    expect(buildPushMessage("us", "2026-01-05", [{ label: "S&P 500", rate: -0.3 }], "daily")?.t).toBe("1/5 미국 종가");
  });
  it("5개 이상이면 4개 + 외 N개", () => {
    const items = ["가", "나", "다", "라", "마", "바"].map((l) => ({ label: l, rate: 1 }));
    expect(buildPushMessage("kr", "2026-11-12", items, "daily")?.b).toMatch(/ 외 2개$/);
  });
  it("긴 이름은 글자수 상한으로 외 N개", () => {
    const items = ["TIGER 배당커버드콜액티브", "TIGER 반도체TOP10", "LG에너지솔루션", "필라델피아 반도체"].map((l) => ({ label: l, rate: 1.1 }));
    const b = buildPushMessage("kr", "2026-11-12", items, "daily")!.b;
    expect(b).toMatch(/ 외 \d개$/);
  });
  it("pm2 — ±2.0% 이상만, 없으면 null", () => {
    expect(buildPushMessage("kr", "2026-11-12", [{ label: "코스피", rate: 1.94 }], "pm2")).toBeNull();
    expect(buildPushMessage("kr", "2026-11-12", [{ label: "코스피", rate: 1.94 }, { label: "코스닥", rate: -2.0 }], "pm2")?.b).toBe("코스닥 -2.0%");
  });
  it("금지어·금액 패턴 없음", () => {
    const texts = [
      JSON.stringify(buildPushMessage("kr", "2026-11-12", PUSH_CATALOG.map((t) => ({ label: t.label, rate: 1.5 })), "daily")),
      PUSH_FALLBACK_TITLE,
      PUSH_FALLBACK_BODY,
    ].join(" ");
    for (const w of BANNED) expect(texts).not.toContain(w);
    expect(texts).not.toMatch(/(^|\s)내(\s|$)/);
    expect(texts).not.toMatch(/\d[\d,]*\s?원/);
  });
});
