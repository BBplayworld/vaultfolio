// #132 U5 진입 글줄·홈 팁 문구 — 값 = 페이지와 같은 computeIndexSpan, 비교할 종목 0이면 접힘, 값 못 받으면 링크만
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import { computeIndexSpan, formatCompareRate, type PeriodRefs } from "@/lib/finance/market-compare";

const h = vi.hoisted(() => ({
  stocks: [] as unknown[],
  peer: null as null | ReadonlySet<string>,
  idx: {} as unknown,
  hydrated: true,
}));
vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: { stocks: h.stocks } }) }));
vi.mock("@/hooks/use-market-compare", () => ({
  useCompareBasis: () => ({ basis: "sameBusinessDay", hydrated: h.hydrated }),
  useDailyRefToken: () => "t",
  useKospiPeerCodes: () => h.peer,
  useMarketIndexRefs: () => h.idx,
}));

import { MarketEntryLine } from "../market-entry-line";
import { APP_FEATURES, MARKET_PAIR_TEXT } from "@/config/app-features";

const st = (o: Partial<Stock>): Stock => ({ id: Math.random().toString(), category: "domestic", name: "삼성전자", ticker: "005930", quantity: 1, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01", ...o } as Stock);
const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: { KOSPI: { refPrice: 101, refDate: "2026-11-09", prevPrice: 100, prevDate: "2026-11-06" }, SPX: { refPrice: 7550, refDate: "2026-11-09", prevPrice: 7377, prevDate: "2026-11-06" } },
  weekly: { KOSPI: { refPrice: 99.8, refDate: "2026-11-03" }, SPX: { refPrice: 7569, refDate: "2026-11-03" } },
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const render = (variant: "stock" | "hero", period: "daily" | "weekly" = "weekly", visible = true) =>
  renderToStaticMarkup(<MarketEntryLine variant={variant} period={period} visible={visible} testId="w" onOpen={() => {}} />);

beforeEach(() => {
  h.stocks = [st({}), st({ ticker: "AAPL", name: "애플", category: "foreign", currency: "USD" })];
  h.peer = new Set(["005930"]);
  h.idx = IDX;
  h.hydrated = true;
});

describe("MarketEntryLine", () => {
  it("상세·주식: `최근 1주 코스피 … · S&P 500 …  내 종목과 비교`, 값은 페이지와 같은 함수(A11)", () => {
    const t = text(render("stock"));
    const kr = formatCompareRate(computeIndexSpan("kr", "weekly", IDX).rate!);
    const us = formatCompareRate(computeIndexSpan("us", "weekly", IDX).rate!);
    expect(t).toBe(`최근 1주 코스피 ${kr} · S&P 500 ${us} 내 종목과 비교`);
    expect(render("stock")).toContain('max-[359px]:hidden">최근 </span>');
  });

  it("자산 변화: 선택 기간 값, 접두 없음, `시장과 비교`. 연 탭은 접힘(inert)", () => {
    const t = text(render("hero", "daily"));
    expect(t).toBe(`코스피 ${formatCompareRate(1)} · S&P 500 ${formatCompareRate((7550 / 7377 - 1) * 100)} 시장과 비교`);
    const year = render("hero", "weekly", false);
    expect(year).toContain("grid-rows-[0fr]");
    expect(year).toContain("inert");
  });

  it("비교할 시장의 값만: 미국 종목만이면 S&P 500만", () => {
    h.stocks = [st({ ticker: "AAPL", category: "foreign", currency: "USD" }), st({ ticker: "360750", category: "isa" })];
    expect(text(render("stock"))).toMatch(/^최근 1주 S&P 500 [+-]\d+\.\d% 내 종목과 비교$/);
  });

  it("비교할 종목 0(해외형 ETF만, F3) → 접힘 / 티커 있는 종목 0 → 렌더 없음", () => {
    h.stocks = [st({ ticker: "360750", category: "pension" })];
    const html = render("stock");
    expect(html).toContain("grid-rows-[0fr]");
    h.stocks = [st({ ticker: undefined, category: "unlisted" })];
    expect(render("stock")).toBe("");
  });

  it("판별 전·지수 조회 중: 자리는 잡고 내용은 투명(값 0% 없음), 지수 실패: 링크 문구만", () => {
    h.peer = null;
    const loading = render("stock");
    expect(loading).toContain("grid-rows-[1fr]");
    expect(loading).toContain("opacity-0");
    expect(text(loading)).not.toMatch(/%/);
    h.peer = new Set(["005930"]);
    h.idx = { daily: { KOSPI: null, SPX: null }, weekly: { KOSPI: null, SPX: null } };
    expect(text(render("stock"))).toBe("내 종목과 비교");
  });
});

describe("홈 팁 문구(cto 판정 2 ①-5)", () => {
  const f = APP_FEATURES.find((x) => x.id === "market-compare")!;
  it("`코스피·S&P 500` 덩어리는 U+2060·U+00A0로 묶고, 보이는 문자를 지우면 사양 문구와 같다", () => {
    expect(MARKET_PAIR_TEXT).toBe("코스피\u2060·\u2060S&P\u00A0500");
    const visible = f.description.replace(/\u2060/g, "").replace(/\u00A0/g, " ");
    expect(f.title).toBe("시장과 비교");
    expect(visible).toBe("지금 보유한 종목의 등락을 코스피·S&P 500 옆에서 봐요");
    for (const w of ["수익", "성과", "추천", "이겼", "앞섰", "뒤처", "나았", "모든 종목", "내 주식 전체", "올해"]) expect(visible).not.toContain(w);
    expect(f.target).toEqual({ type: "activity", tab: "change-market" });
  });
});
