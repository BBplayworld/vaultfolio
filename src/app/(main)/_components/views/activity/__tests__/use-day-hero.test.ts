// 4.95 #184 항목 1 — 일 탭 Hero = 홈 Hero(computeAttributionView, sinceDate=어제). 순수 함수만(저장소 mock 없음)
import { describe, expect, it } from "vitest";
import { computeAttributionView, mapWeekCauses, type AttributionView } from "../week-attribution";
import { DAY_EMPTY_MESSAGE, dayYesterday, prevDailyRecord, resolveDayHero } from "../use-day-hero";
import { RICH_STEPS, TODAY, buildScenario } from "./week-fixtures";

const stub = (fromDate: string, windowFrom?: string) => ({ attr: { fromDate, windowFrom, deltaNet: 20_000 }, causes: [] }) as unknown as AttributionView;

describe("dayYesterday", () => {
  it("월초에도 전달 말일", () => {
    expect(dayYesterday("2026-12-01")).toBe("2026-11-30");
    expect(dayYesterday("2026-03-01")).toBe("2026-02-28");
  });
});

describe("resolveDayHero 제목·빈 상태", () => {
  it("시작이 어제면 전일 대비", () => {
    const h = resolveDayHero(stub("2026-11-11"), "2026-11-11", 1_000_000);
    expect(h.kind === "ok" && h.title).toBe("전일 대비");
  });
  it("아니면 M/D 기록 대비, 월 스냅샷은 windowFrom 날짜", () => {
    const a = resolveDayHero(stub("2026-11-08"), "2026-11-11", 1_000_000);
    expect(a.kind === "ok" && a.title).toBe("11/8 기록 대비");
    const b = resolveDayHero(stub("2026-10", "2026-10-31"), "2026-11-11", 1_000_000);
    expect(b.kind === "ok" && b.title).toBe("10/31 기록 대비");
  });
  it("비교 기록 없음 → empty, 문구는 홈 7일 카드와 같다", () => {
    expect(resolveDayHero(null, "2026-11-11", 1)).toEqual({ kind: "empty" });
    expect(DAY_EMPTY_MESSAGE).toBe("하루 더 쌓이면 날짜별 변화를 비교할 수 있어요.");
  });
});

describe("홈 Hero 동치(C65) — 소수 원화 픽스처(해외주식×환율·소수 코인)", () => {
  const sc = buildScenario(RICH_STEPS);
  const yesterday = dayYesterday(TODAY);
  const v = computeAttributionView({ ...sc, sinceDate: yesterday })!;
  const hero = resolveDayHero(v, yesterday, sc.summary.netAsset);
  it("증감·%·시작→끝이 홈 계산식과 같다", () => {
    if (hero.kind !== "ok") throw new Error("ok 기대");
    const prevNet = sc.summary.netAsset - v.attr.deltaNet;
    expect(hero.title).toBe("전일 대비");
    expect(hero.delta).toBe(v.attr.deltaNet);
    expect(hero.pct).toBe(prevNet > 0 ? (v.attr.deltaNet / prevNet) * 100 : 0);
    expect(hero.start).toBe(prevNet);
    expect(hero.end).toBe(sc.summary.netAsset);
  });
  it("원인 줄 합 = Hero 증감(반올림)", () => {
    if (hero.kind !== "ok") throw new Error("ok 기대");
    const sum = hero.mapped.causes.reduce((s, c) => s + c.amount, 0);
    expect(Math.abs(hero.delta) < 10_000 ? hero.mapped.causes.length : sum).toBe(Math.abs(hero.delta) < 10_000 ? 0 : Math.round(hero.delta));
    expect(hero.mapped).toEqual(mapWeekCauses(v));
  });
});

describe("prevDailyRecord — 달력 칸 직전 기록", () => {
  const all = [{ date: "2026-10-30" }, { date: "2026-10-31" }, { date: "2026-11-02" }];
  it("월초 1일 칸은 전달 마지막 기록", () => {
    expect(prevDailyRecord(all, "2026-11-01")).toEqual({ date: "2026-10-31" });
    expect(prevDailyRecord(all, "2026-11-02")).toEqual({ date: "2026-10-31" });
  });
  it("이전 기록이 없으면 null", () => {
    expect(prevDailyRecord(all, "2026-10-30")).toBeNull();
    expect(prevDailyRecord([], "2026-11-01")).toBeNull();
  });
});
