// #157 종목 한 장 화면 — C76 수용 6구간을 화면 상태로(정적 렌더). jsdom 없음: 선택·기간 전환 상호작용은 순수 함수 테스트와 qa Playwright가 맡는다.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";
import type { PriceHistory } from "@/lib/finance/price-history";

const state: { stocks: Stock[]; transactions: Transaction[] } = { stocks: [], transactions: [] };
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { stocks: state.stocks, transactions: state.transactions }, exchangeRates: { USD: 1400, JPY: 900 } }),
}));
vi.mock("../../../../layout/navigation/navigation-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../../layout/navigation/navigation-context")>();
  return { ...mod, useAssetNavigation: () => ({ navigate: () => {}, view: { type: "home" }, back: () => {}, slideDir: null }) };
});
const hook = vi.fn();
vi.mock("@/hooks/use-price-history", () => ({ usePriceHistory: (...a: unknown[]) => hook(...a) }));

import { StockPageBody } from "../stock-page-view";

let seq = 0;
const stock = (o: Partial<Stock>): Stock => ({
  id: `s${++seq}`, category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10,
  averagePrice: 70000, currentPrice: 80000, currency: "KRW", purchaseDate: "2026-01-01", ...o,
} as Stock);
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`, stockId: "x", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 1, price: 1000,
  currency: "KRW", date: "2026-03-04", reflected: true, createdAt: "2026-03-04T00:00:00Z", ...o,
} as Transaction);

const POINTS = [
  { d: "2026-03-02", c: 100000 }, { d: "2026-03-03", c: 101000 }, { d: "2026-03-04", c: 99000 },
  { d: "2026-03-05", c: 102000 }, { d: "2026-03-06", c: 103000 },
];
const history = (o: Partial<PriceHistory> = {}): PriceHistory => ({
  ticker: "005930", range: "1y", currency: "KRW", interval: "D", from: "2025-11-11", points: POINTS, ...o,
});
const ok = (data: PriceHistory) => ({ data, isError: false, refetch: () => {} });

const render = (items: Stock[], txs: Transaction[], displayCurrency: "KRW" | "USD" = "KRW") => {
  state.stocks = items;
  state.transactions = txs;
  return renderToStaticMarkup(
    <StockPageBody target={{ groupStockIds: items.map((s) => s.id), name: items[0].name, ticker: items[0].ticker ?? "", category: items[0].category, displayCurrency, origin: "stocks" }} />,
  );
};
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const tid = (html: string, id: string) => html.includes(`data-testid="${id}"`);

beforeEach(() => {
  hook.mockReset().mockImplementation((_t: string, range: string, enabled: boolean) =>
    enabled ? ok(history({ range: range as "1y" | "5y" })) : { data: undefined, isError: false, refetch: () => {} });
  state.stocks = [];
  state.transactions = [];
});

describe("C76 ① 거래 0·분할 0 — 가장 흔한 경로", () => {
  it("차트·평단선 정상, 점 0, 거래 0건 안내 1줄, purchaseDate로 점을 만들지 않는다", () => {
    const s = stock({ purchaseDate: "2026-03-03" }); // 매수일 기본값 1/1류가 아니라 창 안의 날짜여도 점 없음(C74)
    const html = render([s], []);
    expect(tid(html, "stock-page-chart")).toBe(true);
    expect(html).toContain('data-state="ready"');
    expect(tid(html, "stock-page-avg-line")).toBe(true);
    expect(html).not.toContain('data-testid="stock-page-buy-dot"');
    expect(text(html)).toContain("거래를 기록하면 산 날이 점으로 표시돼요");
    expect(tid(html, "stock-page-no-trades")).toBe(true);
    expect(tid(html, "stock-page-outside")).toBe(false);
  });
  it("머리: 라벨 '내 수익'·차트 머리 '1년 주가 등락' — 서로의 단어를 쓰지 않는다(완료기준 7)", () => {
    const html = render([stock({})], []);
    const head = html.slice(html.indexOf('data-testid="stock-page-head"'), html.indexOf('data-testid="stock-page-chart-card"'));
    const chartCard = html.slice(html.indexOf('data-testid="stock-page-chart-card"'));
    expect(text(head)).toContain("내 수익");
    expect(text(head)).not.toContain("등락");
    expect(text(chartCard)).toContain("1년 주가 등락");
    const change = html.match(/data-testid="stock-page-change"[^>]*>([^<]*)</)![1];
    expect(change).toBe("+3.0%");
    expect(change).not.toContain("수익");
  });
});

describe("점 안내·정의 줄 문구", () => {
  it("점이 있고 선택 전이면 '점을 누르면 거래를 볼 수 있어요', 창 밖 안내가 있으면 그쪽이 우선", () => {
    const s = stock({ id: "a" });
    expect(text(render([s], [tx({ stockId: "a", date: "2026-03-04" })]))).toContain("점을 누르면 거래를 볼 수 있어요");
    const out = text(render([s], [tx({ stockId: "a", date: "2026-03-04" }), tx({ stockId: "a", date: "2024-01-01" })]));
    expect(out).not.toContain("점을 누르면");
    expect(out).toContain("1년보다 전 매수 1건");
  });
  it("정의 줄에 일별/주별 종가 기준", () => {
    expect(text(render([stock({})], []))).toContain("일별 종가 기준이에요.");
  });
});

describe("C76 ② 증권사 2곳 — 합산 평단선·두 계좌 점", () => {
  it("평단선 값 = 합산 평단, 점은 두 계좌 거래 모두(같은 봉은 1개)", () => {
    const a = stock({ id: "a", broker: "A", quantity: 10, averagePrice: 70000 });
    const b = stock({ id: "b", broker: "B", quantity: 30, averagePrice: 90000 });
    const html = render([a, b], [tx({ stockId: "a", date: "2026-03-03" }), tx({ stockId: "b", date: "2026-03-05" }), tx({ stockId: "b", date: "2026-03-05", type: "sell" })]);
    expect(html).toContain(`data-avg="${(70000 * 10 + 90000 * 30) / 40}"`);
    expect(html.match(/data-testid="stock-page-buy-dot"/g)).toHaveLength(2);
    expect(text(html)).toContain("총 40주");
  });
});

describe("C76 ③ 1년 밖 매수", () => {
  it("1년에서 창 밖 N건 + 5년에서 보기(버튼), 점 없는 날은 안내가 대신하지 않는다", () => {
    const s = stock({ id: "a" });
    const html = render([s], [tx({ stockId: "a", date: "2024-05-01" }), tx({ stockId: "a", date: "2024-06-01" })]);
    expect(text(html)).toContain("1년보다 전 매수 2건 · 5년에서 보기");
    expect(html).toContain('data-clickable="true"');
    expect(html).not.toContain('data-testid="stock-page-buy-dot"');
    expect(tid(html, "stock-page-no-trades")).toBe(false);
  });
});

describe("C76 ④ 분할 전 매수 — 수정 차트 위, 원단가", () => {
  it("점 aria-label에 거래 원단가, 점 y는 봉 종가(차트 값 범위 안)", () => {
    const s = stock({ id: "a" });
    const html = render([s], [tx({ stockId: "a", date: "2026-03-04", price: 1_000_000, quantity: 2 })]);
    expect(html).toContain('aria-label="2026.03.04 매수 2주 · 1,000,000원"');
    const cy = Number(html.match(/data-testid="stock-page-buy-dot"[^>]*>\s*<circle[^>]*cy="([\d.]+)"/)![1]);
    expect(cy).toBeGreaterThan(0);
    expect(cy).toBeLessThan(200);
  });
});

describe("C76 ⑤ 상장 1년 미만", () => {
  it("있는 구간만 그리고 정의 줄에 '상장 이후 기간만 있어요'", () => {
    const html = render([stock({})], [], "KRW");
    expect(text(html)).not.toContain("상장 이후 기간만 있어요");
    hook.mockImplementation(() => ok(history({ listedFrom: "2026-03-02" })));
    const short = render([stock({})], []);
    expect(tid(short, "stock-page-basis")).toBe(true);
    expect(text(short)).toContain("액면분할 등을 반영한 가격이에요. 점은 기록한 거래 날짜에 찍혀요. 상장 이후 기간만 있어요.");
  });
  it("해외는 달러 기준 문구", () => {
    const f = stock({ category: "foreign", ticker: "AAPL", currency: "USD" });
    hook.mockImplementation(() => ok(history({ currency: "USD", ticker: "AAPL" })));
    expect(text(render([f], []))).toContain("달러 가격 기준이에요.");
  });
});

describe("C76 ⑥ 비상장·티커 없음·상장폐지 — 서버 요청 0", () => {
  it.each([
    ["비상장", { category: "unlisted" as const }],
    ["티커 없음", { ticker: "" }],
    ["상장폐지", { inactiveStatus: "delisted" as const }],
  ])("%s: no-price 박스, 선택기·정의 줄 없음, 훅은 enabled=false", (_n, o) => {
    const html = render([stock(o)], []);
    expect(tid(html, "stock-page-no-price")).toBe(true);
    expect(text(html)).toContain("가격 흐름이 없는 종목이에요");
    expect(tid(html, "stock-page-range")).toBe(false);
    expect(tid(html, "stock-page-basis")).toBe(false);
    expect(tid(html, "stock-page-trades-link")).toBe(true);
    for (const c of hook.mock.calls) expect(c[2]).toBe(false);
  });
});

describe("요청·상태", () => {
  it("5년은 탭 전 요청 0 — 초기 렌더에서 1y만 enabled", () => {
    render([stock({})], []);
    const byRange = Object.fromEntries(hook.mock.calls.map((c) => [c[1], c[2]]));
    expect(byRange).toEqual({ "1y": true, "5y": false });
    for (const c of hook.mock.calls) expect(c[0]).toBe("005930");
  });
  it("오류: 다시 시도 + 등락 숨김, 로딩: 자리 유지(data-state)", () => {
    hook.mockImplementation(() => ({ data: undefined, isError: true, refetch: () => {} }));
    const err = render([stock({})], []);
    expect(tid(err, "stock-page-error")).toBe(true);
    expect(text(err)).toContain("가격 흐름을 불러오지 못했어요");
    expect(text(err)).toContain("다시 시도");
    expect(tid(err, "stock-page-change")).toBe(false);
    hook.mockImplementation(() => ({ data: undefined, isError: false, refetch: () => {} }));
    const loading = render([stock({})], []);
    expect(loading).toContain('data-state="loading"');
    // 카드 높이 점프 방지 — 로딩·오류에서도 상태 줄 슬롯·정의 줄이 자리를 잡는다
    for (const html of [loading, err]) {
      expect(html).toContain('aria-live="polite"');
      expect(tid(html, "stock-page-basis")).toBe(true);
    }
  });
  it("거래내역 N건 링크 = 그룹 전체 거래 수(매수·매도)", () => {
    const s = stock({ id: "a" });
    const html = render([s], [tx({ stockId: "a" }), tx({ stockId: "a", type: "sell" }), tx({ stockId: "other" })]);
    expect(text(html)).toContain("거래내역 2건");
  });
  it("평단 0이면 평단선 없음", () => {
    expect(tid(render([stock({ averagePrice: 0 })], []), "stock-page-avg-line")).toBe(false);
  });
  it("평가·내 수익 머리 문자열이 있고 금지어(평가어)가 없다", () => {
    const t = text(render([stock({})], []));
    expect(t).toContain("내 수익");
    for (const w of ["싸다", "비싸다", "물타기", "지금 사도", "목표가"]) expect(t).not.toContain(w);
  });
});
