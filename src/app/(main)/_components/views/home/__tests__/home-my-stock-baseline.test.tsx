// #246 홈 '내 종목 오늘' 줄 — 줄이 없는 상태(주식 없음·첫 저장 당일·캡처·칩 없음·체험 장중)의 순자산 카드 마크업 고정.
// 기준 스냅샷은 줄 구현 전(origin/issue-5.131 2b639a9) 코드에서 뽑았다. 줄이 off면 이 마크업과 글자 단위로 같아야 한다(AC-5).
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("@/app/(main)/_components/layout/navigation/navigation-context", () => ({
  useAssetNavigation: () => ({ navigate: () => {} }),
}));

import { NetAssetSummaryBox } from "../dashboard";
import type { MarketEntryValue } from "../../activity/market-entry-line";

// amount는 원 단위(만원 × 1만) — 홈 행 글자는 Hero 증감에 맞춘 배분값(5.153 #304)이라 deltaNet = 원인 합으로 둔다
const cause = (key: string, label: string, man: number) => ({ key, label, sentence: label, amount: man * 10_000, text: `${man > 0 ? "+" : "−"}${Math.abs(man).toLocaleString()}만원` });
const change = (o: Record<string, unknown> = {}) => ({
  deltaNet: -5_960_000, pct: -1, isBig: false, negligible: false, label: "전일 대비", estimated: false,
  sentence: "x", causes: [cause("stock", "주식 시세 하락", -1096), cause("cash", "현금 입금", 500)], ...o,
});
const market: MarketEntryValue = {
  hasTickerStock: true, markets: ["kr", "us"], ready: true, values: [{ m: "kr", rate: 0.8, endDate: "2026-11-18", holiday: false }],
  linkOnly: false, ytdLinkReady: false, open: true,
};
const tabs = [{ value: "all", label: "전체" }, { value: "financial", label: "금융자산" }];

// 줄이 없는 홈 상태 — 이름: 고정 props
const BASELINE_CASES: Record<string, Record<string, unknown>> = {
  "주식 없음(지수 줄 off, 원인 있음)": { change: change(), marketLine: "off", visibleTabs: tabs, onSegmentClick: () => {} },
  "첫 저장 당일(change null)": { change: null, marketLine: "off", visibleTabs: tabs, onSegmentClick: () => {} },
  "캡처 모드": { change: change(), market, marketLine: "on", onMarketOpen: () => {}, screenshotMode: true },
  "칩 없음·원인 있음·지수 on": { change: change(), market, marketLine: "on", onMarketOpen: () => {}, visibleTabs: tabs, onSegmentClick: () => {} },
  "칩 없음·원인 없음(예측만)·지수 card": { change: change({ causes: [], sentence: null, estimated: true }), market, marketLine: "on", onMarketOpen: () => {} },
  "칩 없음·변동 없음": { change: change({ negligible: true, causes: [], sentence: null }), market, marketLine: "on", onMarketOpen: () => {} },
};

const renderBox = (props: Record<string, unknown>) =>
  renderToStaticMarkup(<NetAssetSummaryBox netAsset={1_000_000_000} treemapData={[]} showRealtimeBadge {...(props as object)} />);

describe("#246 줄 없는 홈 순자산 카드 기준 스냅샷", () => {
  for (const [name, props] of Object.entries(BASELINE_CASES)) {
    it(name, () => {
      expect(renderBox(props)).toMatchSnapshot();
    });
    // 구현 뒤: 줄 off(주식 없음·첫 저장 당일·칩 없음·전부 0.0%·체험 장중)를 넘겨도 기준과 글자 단위로 같다
    it(`${name} — 줄 off diff 0`, () => {
      expect(renderBox({ ...props, myStock: { state: "off", pick: null, onOpen: () => {} } })).toBe(renderBox(props));
    });
  }
  it("캡처 모드는 줄이 on이어도 기준과 같다", () => {
    const props = BASELINE_CASES["캡처 모드"];
    const pick = { name: "삼성전자", label: "오늘", rateText: "+1.0%", sign: "up", rate: 1, more: 2 };
    expect(renderBox({ ...props, myStock: { state: "on", pick, onOpen: () => {} } })).toBe(renderBox(props));
  });
});
