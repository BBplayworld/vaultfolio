// 4.79 T4 — 홈 Hero 계산부 분리(computeAttributionView) 골든: 리팩터 전 main 훅 본문이 낸 값(header-change.golden.json)과 같아야 한다.
// 골든은 main(v4.78) 훅 본문 verbatim으로 같은 픽스처에서 캡처했다. causes·offsetTotal·records·label·sentence·rangeLabel·deltaNet·pct.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatAttributionDate, CAUSE_DISPLAY_MIN } from "@/lib/report/asset-report";
import { computeAttributionView } from "../week-attribution";
import { buildScenario, deposit, NOW_ISO, RICH_STEPS, stockBuy, withdraw, type Scenario } from "./week-fixtures";
import golden from "./header-change.golden.json";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(NOW_ISO)); });
afterEach(() => vi.useRealTimers());

// 훅에 남은 계산(라벨·pct) — dashboard.tsx useHeaderNetChange와 같은 식
function headerOf(sc: Scenario, sinceDate: string, yesterdayStr: string) {
  const view = computeAttributionView({ ...sc, rates: sc.rates, sinceDate });
  if (!view) return null;
  const { attr } = view;
  const prevNet = sc.summary.netAsset - attr.deltaNet;
  const pct = prevNet > 0 ? (attr.deltaNet / prevNet) * 100 : 0;
  return {
    deltaNet: attr.deltaNet, pct, isBig: Math.abs(pct) >= 5, negligible: Math.abs(attr.deltaNet) < CAUSE_DISPLAY_MIN,
    label: attr.fromDate === yesterdayStr ? "전일 대비" : `지난 접속(${formatAttributionDate(attr.fromDate)}) 이후`,
    estimated: attr.estimated, sentence: view.sentence, causes: view.causes, offsetTotal: view.offsetTotal, rangeLabel: view.rangeLabel, records: view.records,
  };
}
const roundTrip = (v: unknown) => JSON.parse(JSON.stringify(v));

describe("T4 홈 Hero 출력 골든(main 동일)", () => {
  const rich = () => buildScenario(RICH_STEPS);
  it("7일 구간(시세·환율·입출금·매매·대출·평가)", () => {
    expect(roundTrip(headerOf(rich(), "2026-11-05", "2026-11-11"))).toEqual(golden.rich_week);
  });
  it("전일 대비(어제 시작)", () => {
    expect(roundTrip(headerOf(rich(), "2026-11-11", "2026-11-11"))).toEqual(golden.rich_yesterday);
  });
  it("레거시 시작점(통합 시세 예측)", () => {
    expect(roundTrip(headerOf(buildScenario(RICH_STEPS, { legacyStart: true }), "2026-11-05", "2026-11-11"))).toEqual(golden.legacy_start);
  });
  it("출금↔매수 짝 상쇄", () => {
    const sc = buildScenario([withdraw("2026-11-08", 5_000_000), stockBuy("2026-11-08", "s_sam", 70, 71000), deposit("2026-11-09", 1_000_000)]);
    expect(roundTrip(headerOf(sc, "2026-11-05", "2026-11-11"))).toEqual(golden.paired);
  });
  it("비교할 기록이 없으면 null", () => {
    expect(headerOf({ ...rich(), daily: [] }, "2026-11-05", "2026-11-11")).toBeNull();
    expect(golden.none).toBeNull();
  });
});
