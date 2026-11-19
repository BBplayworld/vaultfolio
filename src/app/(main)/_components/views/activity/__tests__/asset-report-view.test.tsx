// 5.108 C3·C4·C5·C7 — 성적표 요약/펼침. 정보 삭제 0 대조(이동한 값이 접힌 패널 안에 그대로 있음), 신규 testId 0.
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";

const h = vi.hoisted(() => ({ debt: 0, stocks: [] as unknown[], ready: false }));

const baseSummary = () => ({
  totalValue: 100_000_000, totalCost: 80_000_000, totalProfit: 20_000_000, totalProfitRate: 25, netAsset: 100_000_000 - h.debt,
  stockCurrencyGain: 0, loanBalance: h.debt, tenantDepositTotal: 0, stockValue: 60_000_000, stockCost: 50_000_000, stockProfit: 10_000_000,
  cryptoValue: 0, cryptoCost: 0, cryptoProfit: 0, realEstateValue: 0, realEstateCost: 0, realEstateProfit: 0, cashValue: 40_000_000,
  totalLiabilities: h.debt,
});
const assetData = () => ({
  stocks: h.stocks, crypto: [], cash: [{ id: "c", name: "현금", balance: 40_000_000, currency: "KRW" }], realEstate: [], physicalAssets: [],
  loans: h.debt > 0 ? [{ id: "l1", name: "신용대출", balance: h.debt, interestRate: 5, type: "credit" }] : [],
  cashTransactions: [], transactions: [], cryptoTransactions: [], loanTransactions: [], yearlyNetAssets: [],
});

vi.mock("@/contexts/asset-data-context", () => ({
  notifyAssetUserEdit: () => {}, // 5.125: 이름표 훅이 저장 뒤 부르는 push 신호(이 테스트는 주식 0이라 블록이 그려지지 않는다)
  useAssetData: () => ({ assetData: assetData(), getAssetSummary: baseSummary, exchangeRates: { USD: 1400, JPY: 900 }, snapshotVersion: 0, recordGradeSnapshot: () => {} }),
}));
// 세그먼트 유무 대조(5.126 p2)용 — 기본은 ready=false(세그먼트 없음, 기존 테스트와 같은 상태)
vi.mock("@/hooks/use-stock-labels", () => ({
  useStockLabels: () => ({ labels: { v: 1, cycle: { months: null, at: "" }, items: {} }, ready: h.ready, setLabel: () => {}, record: () => {}, setPlan: () => {}, setCycle: () => {}, clearLabel: () => {} }),
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

const render = (debt: number, seg = false) => {
  h.debt = debt; h.ready = seg;
  h.stocks = seg ? [{ id: "s1", category: "domestic", name: "종목 A", ticker: "AAA", quantity: 10, averagePrice: 100, currentPrice: 120, currency: "KRW", purchaseDate: "2025-01-02" }] : [];
  return renderToStaticMarkup(<AssetReportView />); };

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
  it("testId는 기존 것 + 5.125 ui.md 7절이 정한 것(grow-*·report-section-title·axis-link-*)뿐", () => {
    const ids = new Set([...render(20_000_000).matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]));
    for (const id of ids) expect(/^(fx-exposure|benchmark|networth|grow-|report-section-title$|report-panel-|report-tab|report-grade-hint$|axis-link-)/.test(id)).toBe(true);
  });
  it("6차 — 화면 제목 `자산 성적표·불리기`, 주식이 없으면 세그먼트 없이 성적표 칸이 보인다(hidden 아님)", () => {
    const html = render(0);
    expect(html).toContain('data-testid="grow-title">자산 성적표·불리기<');
    expect(html).not.toContain('data-testid="report-tabs"');
    expect(html.match(/<div[^>]*data-testid="report-panel-grade"[^>]*>/)![0]).not.toContain("hidden");
    expect(html.match(/<div[^>]*data-testid="report-panel-grow"[^>]*>/)![0]).toContain("hidden");
  });
  it("5.126 p2 — 세그먼트가 보이면 구획 제목 `자산 성적표`를 다시 쓰지 않고 5축 ⓘ는 Hero 안에 1개, 세그먼트가 없으면 구획 제목 옆 그대로", () => {
    const seg = render(0, true);
    expect(seg).toContain('data-testid="report-tabs"');
    expect(seg).not.toContain('data-testid="report-section-title"');
    expect(seg.match(/data-testid="report-grade-hint"/g)).toHaveLength(1);
    expect(seg.match(/>자산 성적표</g)).toHaveLength(1); // 세그먼트 둘째 칸 머리뿐
    const plain = render(0);
    expect(plain).toMatch(/data-testid="report-section-title"[^>]*>자산 성적표</);
    expect(plain).not.toContain('data-testid="report-grade-hint"');
  });
  it("5.126 p2 — 투입 대비 성과 ⓘ의 `실투자금(내 돈)과`·`레버리지(빌린 돈)는`은 닫는 괄호와 조사가 갈리지 않는 묶음(C114, 글자 그대로)", () => {
    const src = readFileSync(path.resolve(__dirname, "../asset-report-view.tsx"), "utf8");
    expect(src).toContain('<span className="whitespace-nowrap"><span className="font-semibold text-foreground">실투자금</span>(내 돈)과</span>');
    expect(src).toContain('<span className="whitespace-nowrap"><span className="font-semibold text-foreground">레버리지</span>(빌린 돈)는</span>');
  });
});
