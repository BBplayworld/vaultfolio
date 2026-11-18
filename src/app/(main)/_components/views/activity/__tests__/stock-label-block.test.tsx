// #239 [5.125 재설계 3차] 내 자산 불리기 블록 렌더 — 결론 카드·기준별 점검·종목별 표·이름표 칩·점검 주기.
// 값 계산은 grow-board.test.ts, 저장 동작은 use-stock-labels.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import type { StockLabels } from "@/lib/asset/stock-labels";
import { computeStockTotals } from "../../detail/asset-detail-tabs";

const h = vi.hoisted(() => ({
  stocks: [] as unknown[], labels: null as unknown, ready: true, tx: [] as unknown[],
  div: { isLoading: false, failedCount: 0, annualAtHeldQty: 0 },
}));

vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { stocks: h.stocks, transactions: h.tx }, exchangeRates: { USD: 1400, JPY: 9 } }),
  notifyAssetUserEdit: () => {},
}));
vi.mock("@/hooks/use-stock-labels", () => ({
  useStockLabels: () => ({ labels: h.labels, ready: h.ready, setLabel: () => {}, markChecked: () => {}, setCycle: () => {} }),
}));
vi.mock("../performance-hub", () => ({ useDividendAnnualTotals: () => h.div }));
vi.mock("../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: () => {} }) }));

import { StockLabelBlock } from "../stock-label-block";

const ago = (n: number) => new Date(Date.now() - n * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const st = (id: string, ticker: string, quantity: number, averagePrice = 100, currentPrice = 100, heldDays = 400): Stock => ({
  id, category: "domestic", name: `종목 ${ticker || id}`, ticker, quantity, averagePrice, currentPrice, currency: "KRW", purchaseDate: ago(heldDays),
} as Stock);
const mk = (items: StockLabels["items"], months: 3 | 6 | 12 | null = null): StockLabels => ({ v: 1, cycle: { months, at: months ? day(400) : "" }, items });
const render = (stocks: Stock[], labels: StockLabels, opts: { ready?: boolean; tx?: unknown[]; div?: typeof h.div } = {}) => {
  h.stocks = stocks; h.labels = labels; h.ready = opts.ready ?? true; h.tx = opts.tx ?? [];
  h.div = opts.div ?? { isLoading: false, failedCount: 0, annualAtHeldQty: 0 };
  return renderToStaticMarkup(<StockLabelBlock />);
};
// 보유 일수: AAA 800(2년+), BBB 500, CCC 200, DDD 100, EEE 50, FFF 30 — 이익·손실 섞음
const SIX = [
  st("a", "AAA", 60, 100, 50, 800), st("b", "BBB", 50, 100, 200, 500), st("c", "CCC", 40, 100, 110, 200),
  st("d", "DDD", 30, 100, 100, 100), st("e", "EEE", 20, 100, 130, 50), st("f", "FFF", 10, 100, 90, 30),
];
const rowsOf = (html: string) => [...html.matchAll(/<li data-testid="grow-row"[^>]*>/g)].map((m) => m[0]);
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))![1];
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("블록 노출", () => {
  it("주식 0·저장소 읽기 전에는 DOM이 없다", () => {
    expect(render([], mk({}))).toBe("");
    expect(render(SIX, mk({}), { ready: false })).toBe("");
  });
  it("티커 없는 종목도 행이 있고(합계에 들어간다) 이름표 칩만 없다", () => {
    const html = render([st("m", "", 1), st("a", "AAA", 1)], mk({}));
    expect(rowsOf(html)).toHaveLength(2);
    expect(html.match(/data-testid="grow-chip"/g)).toHaveLength(1);
  });
});

describe("① 결론 카드", () => {
  it("합계 = 상세 › 주식 '전체' 헤더와 같은 공용 함수(원 단위), 손익색, 종목 수", () => {
    const html = render(SIX, mk({}));
    const t = computeStockTotals(SIX, { USD: 1400, JPY: 9 });
    const card = html.match(/<p data-testid="grow-total"[^>]*>/)![0];
    expect(Number(attr(card, "data-profit"))).toBe(Math.round(t.totalProfit));
    expect(attr(card, "data-rate")).toBe(`${t.totalProfitRate > 0 ? "+" : ""}${t.totalProfitRate.toFixed(1)}%`);
    expect(card).toMatch(/text-rose-|text-blue-/);
    expect(text(html)).toContain("산 날부터 지금까지 · 내 주식 6종목");
  });
  it("시세 없는 종목이 있으면 합계 대신 안내, 기준별 점검 숨김, 그 행은 —", () => {
    const html = render([...SIX.slice(0, 2), st("z", "ZZZ", 1, 100, 0)], mk({}));
    expect(html).toContain('data-state="unpriced"');
    expect(text(html)).toContain("시세를 불러오면 합계가 보여요.");
    expect(html).not.toContain('data-testid="grow-axes"');
    expect(html).toMatch(/data-testid="grow-row-rate" data-rate=""/);
  });
  it("앞으로 · 배당: 조회 중 스켈레톤 / 실패 / 1년 약 N원 + 가정 표시 / 0이면 없음 문장", () => {
    const line = (div: typeof h.div) => render(SIX, mk({}), { div }).match(/<dd data-testid="grow-next-dividend"[^>]*>(.*?)<\/dd>/)![1];
    expect(line({ isLoading: true, failedCount: 0, annualAtHeldQty: 0 })).toMatch(/<span aria-hidden="true" class="inline-block h-4 w-32/);
    expect(text(line({ isLoading: false, failedCount: 1, annualAtHeldQty: 0 }))).toBe("배당 정보를 불러오지 못했어요");
    expect(text(line({ isLoading: false, failedCount: 0, annualAtHeldQty: 172_000 }))).toBe("1년 약 17만원지금 수량 기준 가정");
    expect(text(line({ isLoading: false, failedCount: 0, annualAtHeldQty: 0 }))).toBe("올해 예정된 배당이 없어요");
  });
  it("앞으로 · 점검: 점검할 자산 없음 / 주기 없음 / 지난 종목 `지금` 먼저 + 다음 날짜", () => {
    const line = (labels: StockLabels) => text(render(SIX, labels).match(/<dd data-testid="grow-next-check"[^>]*>(.*?)<\/dd>/)![1]);
    expect(line(mk({}))).toBe("점검할 자산으로 정한 종목이 없어요");
    expect(line(mk({ BBB: { label: "check", labeledAt: day(10), at: day(10) } }))).toBe("점검 주기를 정하면 다음 점검일이 보여요");
    const both = line(mk({ BBB: { label: "check", labeledAt: day(10), at: day(10) }, CCC: { label: "check", labeledAt: day(300), checkedAt: day(200), at: day(200) } }, 3));
    expect(both).toMatch(/^종목 CCC 지금 · 종목 BBB \d{1,2}월 \d{1,2}일$/);
  });
});

describe("② 기준별 점검", () => {
  const html = render(SIX, mk({}));
  it("탭 4개(보유 기간 선택), 묶음 순서 고정(1년 이상 → 1년 미만), 묶음 손익 합 = 결론 합계", () => {
    for (const k of ["hold", "etf", "sector", "cap"]) expect(html).toContain(`data-testid="grow-axis-${k}"`);
    expect(html.match(/<button[^>]*data-testid="grow-axis-hold"[^>]*>/)![0]).toContain('aria-checked="true"');
    const groups = [...html.matchAll(/<button type="button" data-testid="grow-group" data-key="(\w+)" data-rate="([^"]*)" data-profit="(-?\d+)"/g)];
    expect(groups.map((g) => g[1])).toEqual(["long", "short"]);
    const total = Number(attr(html.match(/<p data-testid="grow-total"[^>]*>/)![0], "data-profit"));
    expect(groups.reduce((s, g) => s + Number(g[3]), 0)).toBe(total);
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
  });
  it("점선 기준선이 묶음마다 1개, 라벨은 `전체 ±x.x%` 사실만", () => {
    expect(html.match(/data-testid="grow-ref-line"/g)).toHaveLength(2);
    expect(text(html.match(/<span data-testid="grow-ref-label"[^>]*>.*?<\/span>/)![0])).toMatch(/^전체 [+-]?\d+\.\d%$/);
  });
  it("주식 1종목이면 숨긴다(비교할 묶음이 없다)", () => {
    expect(render([SIX[0]], mk({}))).not.toContain('data-testid="grow-axes"');
  });
});

describe("③ 종목별 표", () => {
  it("오래 가진 순(매수일 오름차순) — 입력 순서·수익률·점수와 무관", () => {
    const html = render([...SIX].reverse(), mk({}));
    expect(rowsOf(html).map((r) => attr(r, "data-key"))).toEqual(["t:AAA", "t:BBB", "t:CCC", "t:DDD", "t:EEE"]);
  });
  it("점수: 6개월 이상은 N점, 미만은 측정 중. 기준표 ⓘ가 있다", () => {
    const html = render(SIX, mk({}));
    const scores = [...html.matchAll(/data-testid="grow-row-score" data-state="(\w+)" data-score="(\d*)"/g)].map((m) => `${m[1]}:${m[2]}`);
    // AAA −50%(800일) → 1점, BBB +100%(500일) → 5점, CCC +10%(200일, 연 환산 약 +19%) → 5점, DDD·EEE 측정 중
    expect(scores).toEqual(["score:1", "score:5", "score:5", "measuring:", "measuring:"]);
    expect(html).toContain('data-testid="grow-score-hint"');
  });
  it("처음 5행 + 전체 보기. 점검 차례인 행은 접지 않는다", () => {
    expect(rowsOf(render(SIX, mk({})))).toHaveLength(5);
    expect(render(SIX, mk({}))).toContain('data-testid="grow-more"');
    const due = render(SIX, mk({ FFF: { label: "check", labeledAt: day(200), at: day(200) } }, 3));
    expect(rowsOf(due)).toHaveLength(6);
    expect(attr(rowsOf(due)[5], "data-due")).toBe("true");
    expect(due).toContain("점검 차례");
    expect(due).not.toContain('data-testid="grow-more"');
  });
  it("이름표 칩: 오래 둘·점검할·이름표, 펼침 면은 닫혀 있고(inert) 점검 버튼은 '점검할' 행에만", () => {
    const html = render(SIX, mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40) }, BBB: { label: "check", labeledAt: day(40), at: day(40) }, CCC: { label: null, labeledAt: day(4), at: day(4) } }));
    const chips = [...html.matchAll(/data-testid="grow-chip"[^>]*>(.*?)<svg/g)].map((m) => m[1]);
    expect(chips.slice(0, 3)).toEqual(["오래 둘", "점검할", "이름표"]);
    expect(html.match(/data-testid="grow-check"/g)).toHaveLength(1);
    expect(html.match(/inert=""[^>]*class="grid[^"]*grid-rows-\[0fr\]/g)!.length).toBeGreaterThanOrEqual(5);
  });
  it("펼침 면 캡션: 최근 3개월 매매 N건 · 이 앱 기록 · 이름표 사실", () => {
    const tx = [{ id: "1", stockId: "b", ticker: "BBB", type: "buy", date: ago(10), quantity: 1, price: 1, currency: "KRW", reflected: true }];
    const html = render(SIX, mk({ BBB: { label: "check", labeledAt: day(300), checkedAt: day(125), at: day(125) } }), { tx });
    expect(text(html)).toContain("최근 3개월 매매 1건 · 이 앱 기록 · 마지막 점검 4개월 전");
  });
  it("손익색은 %·막대·큰 합계에만(손익 금액 열은 muted), 주황·경고색 없음", () => {
    const html = render(SIX, mk({}));
    expect(html).not.toMatch(/orange-|amber-|destructive|important/);
    const profitCells = [...html.matchAll(/<span data-testid="grow-row-profit"[^>]*class="([^"]*)"/g)].map((m) => m[1]);
    expect(profitCells.length).toBeGreaterThan(0);
    for (const c of profitCells) expect(c).not.toMatch(/rose-|blue-/);
  });
  it("점검 주기는 맨 아래 설정 줄 1개(위쪽 선택기 없음)", () => {
    const html = render(SIX, mk({}, 3));
    expect(text(html.match(/<button[^>]*data-testid="grow-cycle-row"[^>]*>.*?<\/button>/)![0])).toBe("점검 주기3개월");
    expect(html.indexOf('data-testid="grow-cycle-row"')).toBeGreaterThan(html.lastIndexOf('data-testid="grow-row"'));
    expect(text(render(SIX, mk({})).match(/<button[^>]*data-testid="grow-cycle-row"[^>]*>.*?<\/button>/)![0])).toBe("점검 주기정하지 않음");
  });
});

describe("삭제한 것 — 이전 인사이트 4종·무게·정한 날 지표", () => {
  const html = render(SIX, mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40), base: { qty: 50, price: 80 } } }, 3));
  it("무게 막대·범례·몫 문장·정한 날 지표·행 4줄이 DOM에 없다", () => {
    expect(html).not.toMatch(/grow-weight-|grow-link|grow-row-since|grow-row-price|grow-row-qty|grow-row-trades|grow-summary/);
    expect(text(html)).not.toMatch(/정한 날|몫은|내 주식의 \d|내 매입가 대비/);
  });
});
