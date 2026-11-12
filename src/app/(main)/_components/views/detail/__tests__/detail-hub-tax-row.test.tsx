// 4.89 상세 허브 하단 세금 행 — 보조줄 분기(파생 일정 / 임박 주황 / 기본 문구)·진입·스크린샷 숨김
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const h = vi.hoisted(() => ({ line: null as null | { dueLabel: string; title: string; imminent: boolean }, navigate: vi.fn() }));
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { loans: [] }, getAssetSummary: () => ({}) }),
}));
vi.mock("@/lib/tax-utils", () => ({ taxEntryLine: () => h.line }));
vi.mock("../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: h.navigate }) }));
vi.mock("../../../layout/ui/hub-share-button", () => ({ HubShareButton: () => null }));
vi.mock("../../../layout/ui/kpi-card", () => ({ KpiCard: () => null }));

import { DetailHub } from "../detail-hub";

beforeEach(() => { h.line = null; h.navigate.mockClear(); });

describe("상세 허브 세금 행", () => {
  it("파생 일정 없으면 기본 문구, 주황 없음, 스크린샷 숨김·전폭 클래스", () => {
    const html = renderToStaticMarkup(<DetailHub />);
    expect(html).toContain('data-testid="detail-hub-tax-row"');
    expect(html).toContain("data-screenshot-hide");
    expect(html).toContain("lg:col-span-2");
    expect(html).toContain("세금 일정과 연말 절세 시뮬레이션");
    expect(html).not.toContain("text-orange-600");
  });
  it("임박이면 날짜만 주황, 아니면 muted", () => {
    h.line = { dueLabel: "12/1~12/15", title: "종합부동산세 신고·납부", imminent: true };
    const html = renderToStaticMarkup(<DetailHub />);
    expect(html).toContain("12/1~12/15");
    expect(html).toContain("종합부동산세 신고·납부");
    expect(html).toContain("text-orange-600");
    h.line = { dueLabel: "12/1~12/15", title: "종합부동산세 신고·납부", imminent: false };
    expect(renderToStaticMarkup(<DetailHub />)).not.toContain("text-orange-600");
  });
});
