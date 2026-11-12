// 4.88 자산 변화 시장 타일·홈 팁 문구 — 값 = 페이지와 같은 computeIndexSpan(도착 화면 1주/기간 값과 같은 함수), 비교할 종목 0이면 미렌더
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

import { MarketTile } from "../market-entry-line";
import { APP_FEATURES, MARKET_PAIR_TEXT } from "@/config/app-features";

const st = (o: Partial<Stock>): Stock => ({ id: Math.random().toString(), category: "domestic", name: "삼성전자", ticker: "005930", quantity: 1, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01", ...o } as Stock);
const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: { KOSPI: { refPrice: 101, refDate: "2026-11-09", prevPrice: 100, prevDate: "2026-11-06" }, SPX: { refPrice: 7550, refDate: "2026-11-09", prevPrice: 7377, prevDate: "2026-11-06" } },
  weekly: { KOSPI: { refPrice: 99.8, refDate: "2026-11-03" }, SPX: { refPrice: 7569, refDate: "2026-11-03" } },
  monthly: { KOSPI: { refPrice: 120, refDate: "2026-10-09" }, SPX: { refPrice: 7000, refDate: "2026-10-09" } },
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const render = (period: "daily" | "weekly" | "monthly" | "ytd" = "weekly") =>
  renderToStaticMarkup(<MarketTile period={period} testId="w" onOpen={() => {}} />);
const rate = (m: "kr" | "us", p: "daily" | "weekly" | "monthly") => formatCompareRate(computeIndexSpan(m, p, IDX as never).rate!);

beforeEach(() => {
  h.stocks = [st({}), st({ ticker: "AAPL", name: "애플", category: "foreign", currency: "USD" })];
  h.peer = new Set(["005930"]);
  h.idx = IDX;
  h.hydrated = true;
});

describe("MarketTile", () => {
  it("기간별 접두: 일 `하루`·주 `1주`·월 `1개월` + 값은 도착 화면과 같은 computeIndexSpan(C65·C84). 데스크톱은 두 지수, 이름·값 testid", () => {
    const d = render("daily");
    expect(text(d)).toBe(`시장과 비교 하루 코스피 ${rate("kr", "daily")} · S&P 500 ${rate("us", "daily")}`);
    expect(text(render("weekly"))).toBe(`시장과 비교 1주 코스피 ${rate("kr", "weekly")} · S&P 500 ${rate("us", "weekly")}`);
    expect(text(render("monthly"))).toBe(`시장과 비교 1개월 코스피 ${rate("kr", "monthly")} · S&P 500 ${rate("us", "monthly")}`);
    expect(d).toContain('data-testid="w"');
    expect(d).toContain('data-testid="w-button"');
    expect(d).toContain('data-testid="w-value"');
    expect(d).toContain("data-screenshot-hide");
    expect(d).toContain("sm:max-w-md");
    expect(d).not.toContain("<hr");
  });

  it("sm 미만은 첫 시장 1개만(둘째는 max-sm:hidden)", () => {
    expect(render("weekly")).toContain("max-sm:hidden");
  });

  it("연 탭(ytd): 값 없이 `올해 지수와 나란히 보기`, % 0(#150)", () => {
    const html = render("ytd");
    expect(text(html)).toBe("시장과 비교 올해 지수와 나란히 보기");
    expect(html).toContain('data-period="ytd"');
    expect(html).not.toMatch(/%/);
  });

  it("비교할 시장의 값만: 미국 종목만이면 S&P 500만", () => {
    h.stocks = [st({ ticker: "AAPL", category: "foreign", currency: "USD" }), st({ ticker: "360750", category: "isa" })];
    expect(text(render("weekly"))).toMatch(/^시장과 비교 1주 S&P 500 [+-−]\d+\.\d%$/);
  });

  it("비교할 종목 0(해외형 ETF만, F3)·티커 있는 종목 0 → 렌더 없음", () => {
    h.stocks = [st({ ticker: "360750", category: "pension" })];
    expect(render("weekly")).toBe("");
    h.stocks = [st({ ticker: undefined, category: "unlisted" })];
    expect(render("weekly")).toBe("");
  });

  it("판별 전·지수 조회 중: 타일은 자리 잡고 값 자리는 스켈레톤(값 0% 없음), 지수 0건: `지수와 나란히 보기`", () => {
    h.peer = null;
    const loading = render("weekly");
    expect(loading).toContain("시장과 비교");
    expect(loading).toContain("animate-pulse");
    expect(text(loading)).not.toMatch(/%/);
    h.peer = new Set(["005930"]);
    h.idx = { daily: { KOSPI: null, SPX: null }, weekly: { KOSPI: null, SPX: null } };
    expect(text(render("weekly"))).toBe("시장과 비교 지수와 나란히 보기");
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
