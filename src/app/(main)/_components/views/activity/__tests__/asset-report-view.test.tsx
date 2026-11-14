// 5.108 C3·C4·C5·C7 — 성적표 요약/펼침. 정보 삭제 0 대조(이동한 값이 접힌 패널 안에 그대로 있음), 신규 testId 0.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({ debt: 0 }));

const baseSummary = () => ({
  totalValue: 100_000_000, totalCost: 80_000_000, totalProfit: 20_000_000, totalProfitRate: 25, netAsset: 100_000_000 - h.debt,
  stockCurrencyGain: 0, loanBalance: h.debt, tenantDepositTotal: 0, stockValue: 60_000_000, stockCost: 50_000_000, stockProfit: 10_000_000,
  cryptoValue: 0, cryptoCost: 0, cryptoProfit: 0, realEstateValue: 0, realEstateCost: 0, realEstateProfit: 0, cashValue: 40_000_000,
  totalLiabilities: h.debt,
});
const assetData = () => ({
  stocks: [], crypto: [], cash: [{ id: "c", name: "현금", balance: 40_000_000, currency: "KRW" }], realEstate: [], physicalAssets: [],
  loans: h.debt > 0 ? [{ id: "l1", name: "신용대출", balance: h.debt, interestRate: 5, type: "credit" }] : [],
  cashTransactions: [], transactions: [], cryptoTransactions: [], loanTransactions: [], yearlyNetAssets: [],
});

vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: assetData(), getAssetSummary: baseSummary, exchangeRates: { USD: 1400, JPY: 900 }, snapshotVersion: 0, recordGradeSnapshot: () => {} }),
}));
vi.mock("../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: () => {} }) }));
// Radix Collapsible은 닫힘이면 내용을 마운트하지 않는다 — 패널 안 값 대조를 위해 항상 렌더
vi.mock("@/components/ui/collapsible", () => ({
  Collapsible: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CollapsibleTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  CollapsibleContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("../performance-hub", () => ({ useDividendAnnualTotals: () => ({ isLoading: false, failedCount: 0, annualTotal: 0 }) }));

import { AssetReportView } from "../asset-report-view";

const render = (debt: number) => { h.debt = debt; return renderToStaticMarkup(<AssetReportView />); };

describe("성적표 요약/펼침(5.108)", () => {
  it("부채 있음: 남긴 돈 2줄 + 검산 캡션 + 입구 1개, 3기준·계산 근거·대출별 이자는 접힘 패널 안(삭제 0)", () => {
    const html = render(20_000_000);
    expect(html).toContain("실투자금 · 내 돈");
    expect(html).toContain("레버리지 · 빌린 돈");
    expect(html).toContain("실투자금 + 레버리지 = 모든 자산");
    expect(html).toContain("넣은 돈·이자 · 계산 근거");
    expect(html).not.toContain("레버리지 계산 근거 · 대출 상세");
    const panel = html.slice(html.indexOf("넣은 돈·이자 · 계산 근거"));
    for (const t of ["모든 자산", "실투자금", "레버리지", "넣은 돈", "이자·연", "계산 근거", "대출별 이자"]) expect(panel).toContain(t);
    expect(html.match(/>남긴 돈</g)).toHaveLength(1); // 계산 근거 행만 남음(3기준 표의 남긴 돈 열은 제거)
  });
  it("부채 0: 2줄·검산 캡션 없음, 입구는 '넣은 돈·이자', 모든 자산 행만", () => {
    const html = render(0);
    expect(html).not.toContain("실투자금 · 내 돈");
    expect(html).not.toContain("실투자금 + 레버리지");
    expect(html).toContain("넣은 돈·이자");
    expect(html).not.toContain("계산 근거");
    expect(html).toContain("모든 자산");
  });
  it("5축: 칩 제거, 5줄 모두 접힘(aria-expanded=false·패널 inert), 이유·행동은 패널 안에 유지", () => {
    const html = render(0);
    expect(html).not.toMatch(/\d\/5 측정/);
    const axes = [...html.matchAll(/aria-controls="axis-panel-(\w+)"/g)].map((m) => m[1]);
    expect(axes).toHaveLength(5);
    for (const k of axes) {
      const panel = html.match(new RegExp(`<div id="axis-panel-${k}"[^>]*>`))![0];
      expect(panel).toContain("grid-rows-[0fr]");
      expect(panel).toContain('inert=""');
    }
    expect(html.match(/aria-controls="axis-panel-[^"]+"/g)).toHaveLength(5);
    expect(html).toContain("5축 중"); // C1 등급 Hero 문구 유지
  });
  it("AI 버튼: 1행 버튼 제목·보조 문구, testId 없음, 옛 회색 상자 문구 제거(설명은 대화상자 안)", () => {
    const html = render(0);
    expect(html).toContain("AI에게 전체 자산 진단 물어보기");
    expect(html).toContain("복사해서 외부 AI에 붙여넣기");
    expect(html).not.toContain("전체 자산 AI 평가 프롬프트");
    expect(html).not.toContain("전체 자산 프롬프트 확인 · 복사");
    expect(html).not.toContain("settlement-ai-button");
  });
  it("신규 testId는 fx-exposure-lines 등 기존 것뿐(성적표에서 추가 0)", () => {
    const ids = new Set([...render(20_000_000).matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]));
    for (const id of ids) expect(/^(fx-exposure|benchmark|networth)/.test(id)).toBe(true);
  });
});
