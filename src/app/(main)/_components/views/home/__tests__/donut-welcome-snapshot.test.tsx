// 웰컴 미리보기(screenshotMode) 도넛 마크업 고정 — #4.46 #82 이전(main 5391ba3)에서 뽑은 값.
// 홈 도넛 정돈이 웰컴 경로를 건드리지 않는지 이후 회귀도 잡는다.
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { AssetDonutChart, DonutLabel } from "../dashboard";

const ITEMS = [
  { key: "realEstate", name: "부동산", value: 300_000_000, color: "#5b6fbf", pct: 60 },
  { key: "financial", name: "금융자산", value: 150_000_000, color: "#3a9e6e", pct: 30 },
  { key: "liability", name: "부채", value: 50_000_000, color: "#c0625a", pct: 10 },
];

describe("웰컴 도넛(screenshotMode) 고정 스냅샷", () => {
  it("DonutLabel 3줄 라벨", () => {
    const html = renderToStaticMarkup(
      <svg>
        <DonutLabel cx={100} cy={100} midAngle={45} innerRadius={45} outerRadius={110} name="부동산" pct={60} value={300_000_000} activeTab="all" itemKey="realEstate" legacy />
        <DonutLabel cx={100} cy={100} midAngle={200} innerRadius={45} outerRadius={110} name="부채" pct={4} value={5_000_000} activeTab="all" itemKey="liability" legacy />
      </svg>,
    );
    expect(html).toMatchSnapshot();
  });
  it("AssetDonutChart 래퍼·범례", () => {
    const html = renderToStaticMarkup(<AssetDonutChart items={ITEMS} netAsset={400_000_000} screenshotMode />);
    expect(html).toMatchSnapshot();
  });
});
