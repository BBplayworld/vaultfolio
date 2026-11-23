// #250 홈 — 금융 1종만 있을 때 필터 대신 순자산 구성 사실 1줄 + 현금·대출 추가
import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { NetAssetSummaryBox, netWorthComposeKind, HomeCompose } from "../dashboard";
import { PARAM_VALUES, featureTitleOf } from "@/lib/analytics/ga";

const S0 = { stockValue: 0, cryptoValue: 0, realEstateValue: 0, tenantDepositTotal: 0, physicalValue: 0 };
const A0 = { cash: [] as unknown[], loans: [] as unknown[] };

describe("#250 대상 판정 (spec 2절 경우표)", () => {
  it("주식만 / 코인만 = 대상", () => {
    expect(netWorthComposeKind({ ...S0, stockValue: 100 }, A0)).toBe("stocks");
    expect(netWorthComposeKind({ ...S0, cryptoValue: 100 }, A0)).toBe("crypto");
  });
  it("비대상: 주식+코인·현금 1건·0원 현금·대출·0원 대출·부동산·보증금·실물·자산 0", () => {
    expect(netWorthComposeKind({ ...S0, stockValue: 1, cryptoValue: 1 }, A0)).toBeNull();
    expect(netWorthComposeKind({ ...S0, stockValue: 1 }, { ...A0, cash: [{}] })).toBeNull();
    expect(netWorthComposeKind({ ...S0, stockValue: 1 }, { ...A0, loans: [{}] })).toBeNull();
    expect(netWorthComposeKind({ ...S0, stockValue: 1, realEstateValue: 1 }, A0)).toBeNull();
    expect(netWorthComposeKind({ ...S0, stockValue: 1, tenantDepositTotal: 1 }, A0)).toBeNull();
    expect(netWorthComposeKind({ ...S0, stockValue: 1, physicalValue: 1 }, A0)).toBeNull();
    expect(netWorthComposeKind(S0, A0)).toBeNull();
    expect(netWorthComposeKind(S0, { ...A0, cash: [{}] })).toBeNull();
  });
});

describe("#250 블록 렌더", () => {
  afterEach(() => vi.restoreAllMocks());
  it("문장·버튼 글자, 숫자·금지 낱말 0", () => {
    const s = renderToStaticMarkup(<HomeCompose kind="stocks" />);
    expect(s).toContain("지금 순자산은 주식만 더한 값이에요");
    expect(s).toContain("현금 추가하기");
    expect(s).toContain("대출 추가하기");
    expect(s).toContain("data-screenshot-hide");
    expect(s).not.toContain("<svg");
    expect(s.replace(/<[^>]*>/g, "")).not.toMatch(/\d|실제|정확|맞추|부족|넣어 보세요|아직/);
    expect(renderToStaticMarkup(<HomeCompose kind="crypto" />)).toContain("암호화폐만 더한 값이에요");
  });
  it("NetAssetSummaryBox: 필터 없으면 슬롯, 필터 2칸↑이면 필터만, 슬롯 미전달(웰컴)이면 변화 없음", () => {
    const items = [{ key: "financial", name: "금융자산", value: 100, color: "#3a9e6e", pct: 100 }];
    const tabs = [{ value: "all", label: "전체" }, { value: "financial", label: "금융자산" }];
    const slot = <div data-testid="slot-x" />;
    const withSlot = renderToStaticMarkup(<NetAssetSummaryBox netAsset={100} treemapData={items} onSegmentClick={() => {}} composeSlot={slot} />);
    expect(withSlot).toContain("slot-x");
    expect(withSlot).not.toContain("자산 분포 필터");
    const filtered = renderToStaticMarkup(<NetAssetSummaryBox netAsset={100} treemapData={items} onSegmentClick={() => {}} visibleTabs={tabs} composeSlot={slot} />);
    expect(filtered).not.toContain("slot-x");
    expect(filtered).toContain("자산 분포 필터");
    const welcome = renderToStaticMarkup(<NetAssetSummaryBox netAsset={100} treemapData={items} screenshotMode />);
    expect(welcome).not.toContain("slot-x");
  });
  it("정적 가드: 이벤트 payload·GA·도넛 누름 분기", () => {
    const src = readFileSync(join(__dirname, "../dashboard.tsx"), "utf8");
    expect(src).toContain('new CustomEvent("open-add-asset-sheet", { detail: { category } })');
    expect(src).toMatch(/composeKind && key === "financial"\) navigate\(\{ type: "detail", tab: composeKind \}\)/);
    const welcome = readFileSync(join(__dirname, "../../../layout/onboarding/welcome-guide.tsx"), "utf8");
    expect(welcome).not.toContain("composeSlot");
  });
  it("GA: title 2종·allowlist", () => {
    expect(PARAM_VALUES.category).toContain("home_compose_cash");
    expect(PARAM_VALUES.category).toContain("home_compose_loan");
    expect(featureTitleOf("feature_use", { category: "home_compose_cash" }, "home")).toBe("홈·순자산 구성·현금");
    expect(featureTitleOf("feature_use", { category: "home_compose_loan" }, "home")).toBe("홈·순자산 구성·대출");
  });
});
