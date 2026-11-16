import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { financialDrillLinks, liabilityDrillLinks, DrillDownLinks } from "../dashboard";

const tabs = (l: { tab: string }[]) => l.map((x) => x.tab);

describe("#232 홈 자산 분포 이동 줄", () => {
  it("금융: 종류 조합별 도착 탭, 0개 종류 생략", () => {
    expect(tabs(financialDrillLinks({ stockCount: 6, cryptoCount: 1, cashCount: 3 }))).toEqual(["stocks", "crypto", "cash"]);
    expect(tabs(financialDrillLinks({ stockCount: 0, cryptoCount: 2, cashCount: 0 }))).toEqual(["crypto"]);
    expect(tabs(financialDrillLinks({ stockCount: 0, cryptoCount: 0, cashCount: 4 }))).toEqual(["cash"]);
    expect(tabs(financialDrillLinks({ stockCount: 5, cryptoCount: 0, cashCount: 1 }))).toEqual(["stocks", "cash"]);
    expect(financialDrillLinks({ stockCount: 0, cryptoCount: 0, cashCount: 0 })).toEqual([]);
  });

  it("부채: 대출만 loans / 임차보증금만 real-estate / 둘 다 분할", () => {
    expect(tabs(liabilityDrillLinks(2, 0))).toEqual(["loans"]);
    expect(tabs(liabilityDrillLinks(0, 1))).toEqual(["real-estate"]);
    expect(tabs(liabilityDrillLinks(2, 1))).toEqual(["loans", "real-estate"]);
  });

  it("렌더: 코인만이면 주식 0개 없음, testId·aria-label 존재, 히트영역 py-2.5", () => {
    const html = renderToStaticMarkup(<DrillDownLinks links={financialDrillLinks({ stockCount: 0, cryptoCount: 2, cashCount: 0 })} onNavigate={vi.fn()} />);
    expect(html).not.toContain("주식");
    expect(html).toContain('data-testid="home-alloc-link-crypto"');
    expect(html).toContain("암호화폐 2개 상세 보기");
    expect(html).toContain("보유 중");
    expect(html).toContain("py-2.5");
    const multi = renderToStaticMarkup(<DrillDownLinks links={financialDrillLinks({ stockCount: 1, cryptoCount: 1, cashCount: 1 })} onNavigate={vi.fn()} />);
    expect(multi).not.toContain("보유 중");
    expect(multi).toContain("flex-wrap");
  });

  it("정적 가드: 총액 박스 3개 삭제·탭 패널 testId·pt-4", () => {
    const src = readFileSync(join(__dirname, "../dashboard.tsx"), "utf8");
    for (const t of ["금융자산 총액", "부동산 총액", "부채 총액"]) expect(src).not.toContain(t);
    for (const id of ["financial", "realestate", "liability"]) expect(src).toContain(`data-testid="home-alloc-${id}"`);
    expect(src).not.toMatch(/DrillDownRow onClick=\{\(\) => navigate\(\{ type: "detail", tab: "(stocks|loans)"/);
  });
});
