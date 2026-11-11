// 4.83 상세·주식 입구 — 도구 타일(시장·X-Ray·세금)·펼침 이름 줄(종목 한 장 입구). C76 기본 경로(국내+미국·분류 완료·11/11~12/31·1년 성공)와 경계·폴백을 구간마다 단언.
// C83: 방문 기록은 실제 쓰기 함수 결과로, 요청 횟수는 실제 react-query 옵션으로 판정한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryObserver } from "@tanstack/react-query";
import type { Stock } from "@/types/asset";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import type { PriceHistory } from "@/lib/finance/price-history";
import { computeIndexSpan, formatCompareRate, type PeriodRefs } from "@/lib/finance/market-compare";
import { computeBreakdown, formatBreakdownPct, pickXrayTile } from "@/lib/xray/stock-xray";
import { computePriceChange, signedRate } from "@/lib/finance/stock-page";
import { groupStocksByTicker, mergeStockGroup } from "../asset-detail-tabs";

const h = vi.hoisted(() => ({
  stocks: [] as unknown[],
  peer: null as null | ReadonlySet<string>,
  idx: {} as unknown,
  navigate: vi.fn(),
  xrayCalls: [] as unknown[][],
  progress: null as unknown,
  priceCalls: [] as unknown[][],
  priceResult: { data: undefined, isError: false, refetch: () => {} } as unknown,
}));
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { stocks: h.stocks, transactions: [] }, exchangeRates: { USD: 1000, JPY: 900 } }),
}));
vi.mock("@/hooks/use-market-compare", () => ({
  useCompareBasis: () => ({ basis: "sameBusinessDay", hydrated: true }),
  useDailyRefToken: () => "t",
  useKospiPeerCodes: () => h.peer,
  useMarketIndexRefs: () => h.idx,
}));
vi.mock("@/lib/xray/use-xray-classifications", () => ({
  useXrayClassifications: (...a: unknown[]) => { h.xrayCalls.push(a); return { tick: 0, progress: h.progress }; },
}));
vi.mock("@/hooks/use-price-history", async (orig) => ({
  ...(await orig<typeof import("@/hooks/use-price-history")>()),
  usePriceHistory: (...a: unknown[]) => { h.priceCalls.push(a); return h.priceResult; },
}));
vi.mock("../../../layout/navigation/navigation-context", async (orig) => ({
  ...(await orig<typeof import("../../../layout/navigation/navigation-context")>()),
  useAssetNavigation: () => ({ navigate: h.navigate }),
}));

import { StockToolTiles } from "../stock-tools";
import { StockPageEntry } from "../stock-row-flow";
import { StockPageBody } from "../stock-page/stock-page-view";
import { priceHistoryQueryOptions } from "@/hooks/use-price-history";

let seq = 0;
const stock = (o: Partial<Stock>): Stock => ({
  id: `s${++seq}`, category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10,
  averagePrice: 70000, currentPrice: 80000, currency: "KRW", purchaseDate: "2026-01-01", ...o,
} as Stock);
const KR = () => stock({ quantity: 1, currentPrice: 753_000, averagePrice: 700_000 });
const US = () => stock({ category: "foreign", name: "애플", ticker: "AAPL", currency: "USD", quantity: 1, currentPrice: 247, averagePrice: 200 });
const RATES = { USD: 1000, JPY: 900 };
const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: { KOSPI: { refPrice: 101, refDate: "2026-11-09", prevPrice: 100, prevDate: "2026-11-06" }, SPX: { refPrice: 7550, refDate: "2026-11-09", prevPrice: 7377, prevDate: "2026-11-06" } },
  weekly: { KOSPI: { refPrice: 99.8, refDate: "2026-11-03" }, SPX: { refPrice: 7569, refDate: "2026-11-03" } },
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const valueOf = (html: string, id: string) => text(html.slice(html.indexOf(`data-testid="${id}"`)).split("</button>")[0].replace(/^[^>]*>/, ""));
const kst = (iso: string) => new Date(`${iso}T12:00:00+09:00`);
const tiles = () => renderToStaticMarkup(<StockToolTiles stocks={h.stocks as Stock[]} exchangeRates={RATES} />);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(kst("2026-11-11")); // 기본 경로: 11/11~12/31(세금 시즌 안)
  h.progress = null;
  h.stocks = [KR(), US()];
  h.peer = new Set(["005930"]);
  h.idx = IDX;
  h.navigate.mockClear();
  h.xrayCalls = [];
  h.priceCalls = [];
  h.priceResult = { data: undefined, isError: false, refetch: () => {} };
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("도구 타일 묶음 — 구조", () => {
  it("묶음 1개(role=group·보이는 제목 없음·캡처 제외), 옛 입구(시장 글줄·X-Ray 상자·세금 문장) DOM 0", () => {
    const html = tiles();
    expect(html.match(/data-testid="stock-tools"/g)).toHaveLength(1);
    expect(html).toContain('role="group" aria-label="내 주식 도구"');
    expect(html).toContain("data-screenshot-hide");
    expect(html).not.toContain("stock-market-entry-wrap");
    expect(text(html)).not.toContain("X-RAY 인사이트");
    expect(text(html)).not.toContain("양도소득은 1년 단위로");
    expect(html.match(/min-h-16/g)!.length).toBe(3); // 타일 높이 ≥ 64
  });
  it("3개면 세금이 아래 전폭, 2개(시즌 밖)는 한 줄, 시장 없음(비교 종목 0)이면 X-Ray만 전폭, lg는 개수만큼 칸", () => {
    const three = tiles();
    expect(three).toContain("lg:grid-cols-3");
    expect(three.match(/data-testid="stock-tool-tax"[^>]*class="[^"]*col-span-2/)).not.toBeNull();
    vi.setSystemTime(kst("2026-10-31"));
    const two = tiles();
    expect(two).toContain("lg:grid-cols-2");
    expect(two).not.toContain("col-span-2 lg:col-span-1");
    h.stocks = [stock({ ticker: undefined, category: "unlisted" })];
    const one = tiles();
    expect(one).toContain("lg:grid-cols-1");
    expect(one).not.toContain("stock-market-entry");
    expect(one).toContain("stock-tool-xray");
  });
  it("주식 0건이면 렌더 없음 + 분류 훅은 []로 호출(no-op)", () => {
    h.stocks = [];
    expect(tiles()).toBe("");
    expect(h.xrayCalls[0][0]).toEqual([]);
  });
});

describe("시장 타일 = 시장과 비교 페이지 1주 지수 문자열 (C76 보유 시장 구간)", () => {
  const kr = () => formatCompareRate(computeIndexSpan("kr", "weekly", IDX).rate!);
  const us = () => formatCompareRate(computeIndexSpan("us", "weekly", IDX).rate!);
  it("기본 국내+미국: 1주 코스피 … · S&P 500 …", () => {
    expect(valueOf(tiles(), "stock-tool-market-value")).toBe(`1주 코스피 ${kr()} · S&P 500 ${us()}`);
  });
  it("미국만: S&P 500만 / 국내만: 코스피만", () => {
    h.peer = new Set();
    expect(valueOf(tiles(), "stock-tool-market-value")).toMatch(new RegExp(`^1주 S&P 500 ${us().replace("+", "\\+")}`));
    h.stocks = [KR()];
    h.peer = new Set(["005930"]);
    expect(valueOf(tiles(), "stock-tool-market-value")).toBe(`1주 코스피 ${kr()}`);
  });
  it("좁은 폭: 첫 시장 외는 max-sm:hidden, 이름 `시장과 비교`, testid stock-market-entry 승계", () => {
    const html = tiles();
    expect(html).toContain('data-testid="stock-market-entry"');
    expect(html).toContain("max-sm:hidden");
    expect(text(html)).toContain("시장과 비교");
  });
  it("폴백: 지수 실패 `지수와 나란히 보기` / 판별 전 스켈레톤(숫자 0) / 비교 종목 0이면 타일 없음", () => {
    h.idx = { daily: { KOSPI: null, SPX: null }, weekly: { KOSPI: null, SPX: null } };
    expect(valueOf(tiles(), "stock-tool-market-value")).toBe("지수와 나란히 보기");
    h.idx = IDX;
    h.peer = null;
    const loading = tiles();
    expect(loading).toContain("animate-pulse");
    expect(valueOf(loading, "stock-tool-market-value")).not.toMatch(/%/);
    h.peer = new Set(["005930"]);
    h.stocks = [stock({ ticker: "360750", category: "pension" })]; // 해외형 ETF만 → 비교 종목 0
    expect(tiles()).not.toContain("stock-market-entry");
  });
});

describe("X-Ray 타일 — 소수 1자리·100% 단일 축 제외·도착 화면과 같은 값", () => {
  it("국내 75.3% + 해외 24.7%: 타일 `{항목} 75.3%` = X-Ray 페이지 해당 축 첫 줄(같은 병합·같은 표기)", () => {
    const merged = Array.from(groupStocksByTicker(h.stocks as Stock[]).values()).map((g) => mergeStockGroup(g));
    const pick = pickXrayTile(merged, RATES)!;
    expect(pick.pct).toBe(75.3);
    const first = computeBreakdown(pick.axis, merged, RATES).items[0];
    expect(first.label).toBe(pick.itemLabel);
    expect(formatBreakdownPct(first.ratio)).toBe(pick.pct);
    expect(valueOf(tiles(), "stock-tool-xray-value")).toBe(`${pick.itemLabel} 75.3%`);
  });
  it("국내만 보유(지역·통화 모두 100%): 100% 축은 건너뛰어 폴백 `분야·지역 비중 보기`, 값에 `100%` 없음", () => {
    h.stocks = [KR()];
    const merged = [mergeStockGroup([h.stocks[0] as Stock])];
    expect(pickXrayTile(merged, RATES)).toBeNull();
    const html = tiles();
    expect(valueOf(html, "stock-tool-xray-value")).toBe("분야·지역 비중 보기");
    expect(html).not.toContain("100%");
  });
  it("분류 수집 중(progress)에는 값 대신 폴백 문구, 끝나면 값", () => {
    h.progress = { done: 0, total: 1 };
    expect(valueOf(tiles(), "stock-tool-xray-value")).toBe("분야·지역 비중 보기");
    h.progress = null;
    expect(valueOf(tiles(), "stock-tool-xray-value")).toMatch(/75\.3%$/);
  });
  it("100% 축이 앞서도 다음 축을 쓴다(pickHighlights 정렬은 ratio 내림차순이라 100%가 1위일 때)", () => {
    // 같은 증권사 분할 종목 2건 = 티커 병합 1건 → 지역 100%(제외), 통화 100%(제외)
    h.stocks = [KR(), { ...KR(), id: "dup" } as Stock];
    const merged = Array.from(groupStocksByTicker(h.stocks as Stock[]).values()).map((g) => mergeStockGroup(g));
    expect(merged).toHaveLength(1);
    expect(pickXrayTile(merged, RATES)).toBeNull();
  });
  it("분류 수집 훅(useXrayClassifications)은 타일이 호출한다 — 상자 삭제 후에도 수집·완료 토스트 유지", () => {
    tiles();
    expect(h.xrayCalls).toHaveLength(1);
    expect(h.xrayCalls[0][0]).toBe(h.stocks);
  });
  it("X-Ray 타일은 하이라이트가 없어도 항상 렌더", () => {
    h.stocks = [KR()];
    expect(tiles()).toContain('data-testid="stock-tool-xray"');
  });
});

describe("D4 320 타일 제목 줄 — chevron이 타일 안에 머문다", () => {
  it("이름 span min-w-0·nowrap(어절 유지), 320 미만(359px 이하)에서 아이콘 숨김, chevron shrink-0", () => {
    const html = tiles();
    expect(html).toMatch(/<span class="min-w-0 whitespace-nowrap text-sm font-semibold/);
    expect(html).toContain("max-[359px]:hidden");
    expect(html).toMatch(/lucide-chevron-right[^>]*ml-auto size-4 shrink-0|ml-auto size-4 shrink-0[^>]*lucide-chevron-right/);
  });
});

describe("세금 타일 — KST 날짜 경계(C76 날짜 구간)", () => {
  it.each([["2026-10-31", 0], ["2026-11-01", 1], ["2026-11-11", 1], ["2026-12-31", 1], ["2027-01-01", 0]])("%s → 타일 %i개", (d, n) => {
    vi.setSystemTime(kst(d));
    expect((tiles().match(/data-testid="stock-tool-tax"/g) ?? []).length).toBe(n);
  });
  it("문구에 숫자·금액·D- 없음 / 해외 보유 없으면 시즌이어도 없음", () => {
    expect(valueOf(tiles(), "stock-tool-tax-value")).toBe("1년 합산 · 기본공제 적용");
    // 고정 문구의 `1년`만 숫자 — 금액·날짜·D-day 숫자는 0
    expect(valueOf(tiles(), "stock-tool-tax-value").replace("1년", "")).not.toMatch(/\d|D-|원/);
    h.stocks = [KR()];
    expect(tiles()).not.toContain("stock-tool-tax");
  });
});

// ── 펼침 이름 줄 ──
const POINTS = Array.from({ length: 250 }, (_, i) => ({ d: `2025-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`, c: 100 + i * 0.4 + (i % 7) }));
const history = (o: Partial<PriceHistory> = {}): PriceHistory => ({ ticker: "005930", range: "1y", currency: "KRW", interval: "D", from: "2025-11-11", points: POINTS, ...o });
const entry = (items: Stock[], p: Partial<Parameters<typeof StockPageEntry>[0]> = {}) =>
  renderToStaticMarkup(
    <StockPageEntry stock={items[0]} groupItems={items} displayCurrency="KRW" exchangeRates={RATES} open categoryLabels={["국내"]} onOpen={() => {}} {...p} />,
  );

describe("종목 이름 줄 입구", () => {
  it("1년 성공: 줄 전체가 버튼 1개·≥56px, `총 N주`·`종목 보기` 0, 값 = 종목 한 장 stock-page-change(같은 쿼리 응답)", () => {
    const s = stock({});
    h.stocks = [s]; // 종목 한 장이 같은 그룹을 읽는다
    h.priceResult = { data: history(), isError: false, refetch: () => {} };
    const html = entry([s]);
    expect(html.match(/data-testid="stock-page-entry"/g)).toHaveLength(1);
    expect(html).toContain("min-h-14");
    expect(html).toContain(`aria-label="${s.name} 주가 흐름과 평단 보기"`);
    expect(text(html)).not.toContain("총 ");
    expect(text(html)).not.toContain("종목 보기");
    expect(text(html)).toContain("1년 주가 등락");
    expect(html).toContain('data-testid="stock-page-entry-spark"');
    const rowChange = html.match(/data-testid="stock-page-entry-change"[^>]*>([^<]*)</)![1];
    // 종목 한 장
    const page = renderToStaticMarkup(
      <StockPageBody target={{ groupStockIds: [s.id], name: s.name, ticker: s.ticker!, category: s.category, displayCurrency: "KRW", origin: "stocks" }} />,
    );
    expect(page.match(/data-testid="stock-page-change"[^>]*>([^<]*)</)![1]).toBe(rowChange);
    // 원본 points로 계산(다운샘플 전)
    expect(rowChange).toBe(signedRate(computePriceChange(POINTS)!));
  });
  it("종목 한 장 머리와 같은 평단 점선: 평단이 가격 범위 안이면 점선, 범위 밖이면 생략", () => {
    h.priceResult = { data: history(), isError: false, refetch: () => {} };
    expect(entry([stock({ averagePrice: 150 })])).toContain("stroke-dasharray");
    expect(entry([stock({ averagePrice: 5 })])).not.toContain("stroke-dasharray");
  });
  it("로딩: `1년 주가 등락` + 값 자리 예약(%·스파크 없음, 스파크 칸 예약), 높이 클래스는 성공과 같다", () => {
    const html = entry([stock({})]);
    expect(text(html)).toContain("1년 주가 등락");
    expect(text(html)).not.toMatch(/%/);
    expect(html).toContain("animate-pulse");
    expect(html).toContain("min-h-14");
    expect(html).toContain("min-h-5");
  });
  it("실패·429·빈 응답: `주가 흐름과 내 평단 보기`, 가격 흐름 없는 종목(티커 없음·비상장·상장폐지): `내 평단 보기` + 요청 안 함", () => {
    h.priceResult = { data: undefined, isError: true, refetch: () => {} };
    expect(text(entry([stock({})]))).toContain("주가 흐름과 내 평단 보기");
    h.priceResult = { data: history({ points: [] }), isError: false, refetch: () => {} };
    expect(text(entry([stock({})]))).toContain("주가 흐름과 내 평단 보기");
    for (const o of [{ ticker: undefined }, { category: "unlisted" as const }, { inactiveStatus: "delisted" as const }]) {
      h.priceCalls = [];
      const html = entry([stock(o)]);
      expect(text(html)).toContain("내 평단 보기");
      expect(text(html)).not.toContain("주가 흐름과");
      expect(h.priceCalls[0][2]).toBe(false);
    }
  });
  it("실패·429 폴백도 로딩과 같은 크기의 빈 aria-hidden 스파크 칸을 둔다(이름 줄 높이 불변)", () => {
    const spark = (html: string) => html.match(/<span[^>]*[^>]*h-8 w-12[^>]*>/)?.[0] ?? "";
    const loading = entry([stock({})]);
    h.priceResult = { data: undefined, isError: true, refetch: () => {} };
    const failed = entry([stock({})]);
    expect(failed).toContain('data-testid="stock-page-entry-spark-slot"');
    const size = (x: string) => x.match(/h-8 w-12.*?shrink-0/)?.[0];
    // 320에서 `1년 주가 등락 +x%`가 한 줄: 둘째 줄 nowrap, 스파크 폭 w-12(<360)·360 이상은 기존 w-24 유지
    expect(loading).toContain("whitespace-nowrap");
    expect(loading).toContain("min-[360px]:w-24");
    expect(size(spark(failed))).toBeDefined();
    expect(size(spark(failed))).toBe(size(spark(loading)));
    expect(spark(failed)).toContain("aria-hidden");
  });
  it("요청 조건: open && 가격 흐름 있음 && 캡처 아님일 때만, 행 쿼리는 retryOnMount:false", () => {
    entry([stock({})]);
    expect(h.priceCalls[0]).toEqual(["005930", "1y", true, { retryOnMount: false }]);
    h.priceCalls = [];
    entry([stock({})], { open: false });
    expect(h.priceCalls[0][2]).toBe(false);
    h.priceCalls = [];
    entry([stock({})], { screenshotMode: true });
    expect(h.priceCalls[0][2]).toBe(false);
  });
  it("분할 종목: 합산 그룹으로 연다(종목 한 장과 같은 ticker 키), 접힌 행 수량 = 증권사별 합(총 N주 삭제의 근거)", () => {
    const a = stock({ id: "a", quantity: 3, broker: "A증권" });
    const b = stock({ id: "b", quantity: 7, broker: "B증권" });
    expect(mergeStockGroup([a, b]).quantity).toBe(a.quantity + b.quantity);
    entry([mergeStockGroup([a, b])], { groupItems: [a, b] });
    expect(h.priceCalls[0][0]).toBe("005930");
  });
});

describe("C2 실패 재요청 차단 — 실제 react-query 옵션으로 fetch 횟수 판정(C83)", () => {
  const mountOnce = async (qc: QueryClient, opts: ReturnType<typeof priceHistoryQueryOptions>) => {
    const o = new QueryObserver(qc, opts);
    const un = o.subscribe(() => {});
    await vi.waitFor(() => expect(o.getCurrentResult().isFetching).toBe(false));
    un();
  };
  it("503 실패 티커를 3회 접었다 펴도 fetch 1회(행 쿼리 retryOnMount:false)", async () => {
    const f = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    vi.stubGlobal("fetch", f);
    const qc = new QueryClient();
    for (let i = 0; i < 3; i += 1) await mountOnce(qc, priceHistoryQueryOptions("AAPL", "1y", true, { retryOnMount: false }));
    expect(f).toHaveBeenCalledTimes(1);
    qc.clear();
  });
  it("대조군: 기본값(종목 한 장 방식)은 마운트마다 다시 요청 — 위 단언이 의미 있음", async () => {
    const f = vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    vi.stubGlobal("fetch", f);
    const qc = new QueryClient();
    for (let i = 0; i < 3; i += 1) await mountOnce(qc, priceHistoryQueryOptions("AAPL", "1y", true));
    expect(f).toHaveBeenCalledTimes(3);
    qc.clear();
  });
  it("성공은 접었다 펴도 재사용(30분 stale), 서로 다른 티커는 각각 1회", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ currency: "USD", interval: "D", points: [{ d: "2026-01-02", c: 1 }, { d: "2026-01-03", c: 2 }] }) }));
    vi.stubGlobal("fetch", f);
    const qc = new QueryClient();
    for (let i = 0; i < 3; i += 1) await mountOnce(qc, priceHistoryQueryOptions("AAPL", "1y", true, { retryOnMount: false }));
    await mountOnce(qc, priceHistoryQueryOptions("MSFT", "1y", true, { retryOnMount: false }));
    expect(f).toHaveBeenCalledTimes(2);
    qc.clear();
  });
  it("캡처 모드·접힘(enabled=false)에서는 fetch 0회", async () => {
    const f = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
    vi.stubGlobal("fetch", f);
    const qc = new QueryClient();
    await mountOnce(qc, priceHistoryQueryOptions("AAPL", "1y", false, { retryOnMount: false }));
    expect(f).not.toHaveBeenCalled();
    qc.clear();
  });
  it("요청 값은 ticker·range 둘뿐(서버로 나가는 값 증가 0)", () => {
    const o = priceHistoryQueryOptions("AAPL", "1y", true, { retryOnMount: false });
    expect(o.queryKey).toEqual(["price-history", "AAPL", "1y"]);
  });
});
