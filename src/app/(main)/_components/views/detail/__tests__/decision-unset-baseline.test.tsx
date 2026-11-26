// #245(5.130) 미정 기기 기준 스냅샷 — 코드 변경 전(분기 시점 = origin/issue-5.126 424c6b8) 마크업을 먼저 고정한다(AC-6).
// 이름표가 0개인 기기의 상세·주식(행·펼침)·종목 한 장 머리는 이 릴리스에서 diff 0, 달라지는 것은 '내 주식 도구' 타일 묶음뿐이다.
// 그래서 타일 묶음(stock-tools)은 따로 떼어 고정한다 — 구현 뒤 바뀌는 스냅샷은 그 1개여야 한다.
// jsdom 없음(정적 렌더): effect가 돌지 않아 이름표 저장소는 읽기 전 상태다. 읽은 뒤(이름표 0개·전부 정하지 않음) 동치는 구현 커밋의 테스트가 본다.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";

const NOW = new Date("2026-11-19T03:00:00Z");

const stock = (o: Partial<Stock>): Stock => ({
  id: "s", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 65,
  averagePrice: 70000, currentPrice: 80000, currency: "KRW", purchaseDate: "2025-03-04", ...o,
} as Stock);

const UNSET_STOCKS: Stock[] = [
  stock({ id: "s1" }),
  stock({ id: "s2", name: "SK하이닉스", ticker: "000660", quantity: 12, averagePrice: 150000, currentPrice: 190000 }),
  stock({ id: "s3", category: "foreign", name: "Apple", ticker: "AAPL", quantity: 30, averagePrice: 180, currentPrice: 150, currency: "USD", purchaseExchangeRate: 1300 }),
  // 같은 티커가 증권사 둘로 나뉜 묶음(증권사별 하위 항목)
  stock({ id: "s4", name: "TIGER 미국S&P500", ticker: "360750", quantity: 100, averagePrice: 15000, currentPrice: 20000, broker: "키움증권" } as Partial<Stock>),
  stock({ id: "s5", name: "TIGER 미국S&P500", ticker: "360750", quantity: 5, averagePrice: 16000, currentPrice: 20000, broker: "토스증권" } as Partial<Stock>),
  // 티커 없는 종목·상장폐지 — 이름표를 달 수 없는 행
  stock({ id: "s6", category: "unlisted", name: "비상장 스타트업", ticker: "", quantity: 10, averagePrice: 5000, currentPrice: 5000 }),
  stock({ id: "s7", name: "폐지전자", ticker: "999990", quantity: 3, averagePrice: 1000, currentPrice: 0, inactiveStatus: "delisted" } as Partial<Stock>),
];

const state: { stocks: Stock[] } = { stocks: UNSET_STOCKS };
const RATES = { USD: 1400, JPY: 900 };
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({
    assetData: { stocks: state.stocks, transactions: [], loans: [], crypto: [], realEstate: [], physicalAssets: [], cryptoTransactions: [] },
    exchangeRates: RATES,
    getAssetSummary: () => ({ stockCurrencyGain: 0, totalValue: 1 }),
    dataResetVersion: 0,
    deleteStock: () => {}, deleteStocks: () => {}, saveData: () => {},
  }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isError: false }),
  useQueryClient: () => ({}),
}));
vi.mock("../../../layout/navigation/navigation-context", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../../../layout/navigation/navigation-context")>();
  return { ...mod, useAssetNavigation: () => ({ navigate: () => {}, view: { type: "detail", tab: "stocks" }, back: () => {}, slideDir: null }) };
});
vi.mock("@/hooks/use-price-history", () => ({ usePriceHistory: () => ({ data: undefined, isError: false, refetch: () => {} }) }));
vi.mock("@/lib/xray/use-xray-classifications", () => ({ useXrayClassifications: () => ({ tick: 0, progress: null }) }));
vi.mock("../../activity/market-entry-line", () => ({
  useMarketEntryValue: () => ({ hasTickerStock: true, open: true }),
  MarketTileValue: () => <span data-testid="stock-tool-market-value">1주</span>,
}));

import { StockCard, StockRowHeader, StockTab } from "../tabs/stock-tab";
// #317 종목 한 장 배당 줄은 별도 테스트(stock-page-dividend.test.tsx) — 여기서는 배당 조회 없음으로 둔다
vi.mock("../../activity/use-dividend-data", () => ({ useDividendData: () => ({ groups: [], calc: { byStock: new Map(), annual: { paid: 0, expected: 0, total: 0 }, months: [] }, isLoading: false, loadedCount: 0, failedCount: 0, totalCount: 0, jpyCount: 0 }) }));
import { StockPageBody } from "../stock-page/stock-page-view";
import { GrowTileValueLine } from "../stock-tools";
import { computeStockMetrics } from "../asset-detail-tabs";
import { buildBoardRows } from "@/lib/asset/grow-board";
import { growTileValueOf } from "@/lib/asset/grow-decision";
import type { StockLabels } from "@/lib/asset/stock-labels";

/** data-testid가 id인 첫 요소의 마크업(여는 태그~짝이 맞는 닫는 태그). 없으면 "" */
function cutByTestId(html: string, id: string): string {
  const at = html.indexOf(`data-testid="${id}"`);
  if (at < 0) return "";
  const start = html.lastIndexOf("<", at);
  const tag = /^<([a-z0-9]+)/i.exec(html.slice(start))![1].toLowerCase();
  const re = /<(\/?)([a-z0-9]+)(?=[\s>/])[^>]*>/gi;
  re.lastIndex = start;
  let depth = 0;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    if (m[2].toLowerCase() !== tag) continue;
    if (m[1]) depth--;
    else if (!m[0].endsWith("/>")) depth++;
    if (depth === 0) return html.slice(start, re.lastIndex);
  }
  return html.slice(start);
}

beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); });
afterAll(() => { vi.useRealTimers(); });

describe("#245 미정 기기 기준 마크업(코드 변경 전 고정)", () => {
  it("상세·주식 — 타일 묶음을 뺀 전체(요약·카테고리 줄·비중 막대·종목 행)", () => {
    state.stocks = UNSET_STOCKS;
    const html = renderToStaticMarkup(<StockTab />);
    const tools = cutByTestId(html, "stock-tools");
    expect(tools).not.toBe("");
    expect(html.replace(tools, "<!--stock-tools-->")).toMatchSnapshot();
  });

  it("상세·주식 — 내 주식 도구 타일 묶음(이 릴리스에서 바뀌는 유일한 곳)", () => {
    state.stocks = UNSET_STOCKS;
    expect(cutByTestId(renderToStaticMarkup(<StockTab />), "stock-tools")).toMatchSnapshot();
  });

  it("상세·주식 — 펼친 종목 행(이름 줄 입구·상세 표·거래 줄)", () => {
    state.stocks = UNSET_STOCKS;
    const s = UNSET_STOCKS[0];
    const m = computeStockMetrics(s, RATES, 10_000_000, "KRW");
    const html = renderToStaticMarkup(
      <StockCard
        stock={s} color="#5b6fbf" pct={m.pct} currentVal={m.currentVal} profit={m.profit} profitRate={m.profitRate}
        isForeign={m.isForeign} krwMul={m.krwMul} currencyGain={m.currencyGain} currencyGainRate={m.currencyGainRate}
        linkedLoans={[]} onDelete={() => {}} categoryLabels={["국내"]} defaultOpen groupItems={[s]} exchangeRates={RATES} totalValue={10_000_000}
        todayChip={{ rate: 1.2, label: "오늘" }}
      />,
    );
    expect(html).toContain('data-testid="stock-page-entry"');
    expect(html).toMatchSnapshot();
  });

  it("종목 한 장 — 머리(이름·평가금액·내 수익)", () => {
    state.stocks = UNSET_STOCKS;
    const s = UNSET_STOCKS[0];
    const html = renderToStaticMarkup(
      <StockPageBody target={{ groupStockIds: [s.id], name: s.name, ticker: s.ticker ?? "", category: s.category, displayCurrency: "KRW", origin: "stocks" }} />,
    );
    expect(cutByTestId(html, "stock-page-head")).toMatchSnapshot();
  });
});

// ─── 구현 뒤(#245) — 이름표를 읽은 뒤의 동치와 정한 종목의 표시 ─────────────────────────
// 정적 렌더는 effect가 돌지 않아 훅이 늘 '읽기 전'이다. 읽은 뒤 상태는 labelStore prop으로 값을 직접 넣는다(점검 블록 store 선례).

const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
const mk = (items: StockLabels["items"] = {}): StockLabels => ({ v: 1, cycle: { months: null, at: "" }, items });
const none = (daysAgo = 5) => ({ label: null, labeledAt: iso(daysAgo), at: iso(daysAgo) });
const keep = (daysAgo: number, price?: number) => ({ label: "keep" as const, labeledAt: iso(daysAgo), at: iso(daysAgo), ...(price ? { base: { qty: 1, price } } : {}) });
const check = (daysAgo: number, price?: number, plan?: Record<string, unknown>) => ({
  label: "check" as const, labeledAt: iso(daysAgo), at: iso(daysAgo), ...(price ? { base: { qty: 1, price } } : {}), ...(plan ? { plan: { at: iso(daysAgo), ...plan } } : {}),
});
const text = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, "\u00a0").replace(/&amp;/g, "&");
const withoutTools = (html: string) => html.replace(cutByTestId(html, "stock-tools"), "<!--stock-tools-->");
const tab = (labels: StockLabels | null, stocks = UNSET_STOCKS) => {
  state.stocks = stocks;
  return renderToStaticMarkup(labels ? <StockTab labelStore={{ labels, ready: true }} /> : <StockTab />);
};
const page = (s: Stock, labels: StockLabels | null) => {
  state.stocks = UNSET_STOCKS;
  const target = { groupStockIds: [s.id], name: s.name, ticker: s.ticker ?? "", category: s.category, displayCurrency: "KRW" as const, origin: "stocks" as const };
  return cutByTestId(renderToStaticMarkup(labels ? <StockPageBody target={target} labelStore={{ labels, ready: true }} /> : <StockPageBody target={target} />), "stock-page-head");
};
/** 정한 종목이 섞인 기기 — 삼성전자 장기 보유, SK하이닉스 +25% 조건에 닿음(차례), Apple −15% 조건 미도달, TIGER 미정, 상장폐지 종목에 남은 이름표 */
const MIXED = mk({
  "005930": keep(30, 76000),
  "000660": check(30, 180000, { down: 15, up: 25 }),
  AAPL: check(30, 160.1, { down: 15, up: 25 }),
  "999990": keep(30, 1000),
});

describe("AC-6 미정 기기 — 이름표를 읽은 뒤에도 타일 1개 외 diff 0", () => {
  const before = tab(null);
  it.each([
    ["이름표 0개", mk()],
    ["전부 정하지 않음", mk({ "005930": none(), "000660": none(), AAPL: none(), "360750": none() })],
    ["이름표를 달 수 없는 종목에만 남은 값(상장폐지)", mk({ "999990": keep(30, 1000) })],
  ])("%s — 행·펼침·요약 마크업이 읽기 전과 같다", (_n, labels) => {
    const after = tab(labels);
    expect(withoutTools(after)).toBe(withoutTools(before));
    expect(after).not.toContain("stock-row-decision");
    expect(after).not.toContain("decision-entry");
  });
  it("티커 없는 종목만 가진 기기 — 같다", () => {
    const only = UNSET_STOCKS.filter((s) => !s.ticker);
    expect(withoutTools(tab(mk({ x: keep(1, 1) }), only))).toBe(withoutTools(tab(null, only)));
  });
  it("타일 — 읽기 전에는 값 줄만 비고(높이 유지), 읽은 뒤 `장기 보유 · 점검 대상 정하기 전`", () => {
    const pending = cutByTestId(before, "stock-tool-grow");
    const first = cutByTestId(tab(mk()), "stock-tool-grow");
    expect(text(cutByTestId(pending, "stock-tool-grow-value"))).toBe("\u00a0");
    expect(pending).toContain('data-kind="pending"');
    expect(text(cutByTestId(first, "stock-tool-grow-value"))).toBe("장기 보유 · 점검 대상 정하기 전");
    expect(first).toContain('data-kind="first"');
    // 타일 자리 — 시장과 비교 → X-Ray → 내 자산 점검 → 해외주식 세금(11월)
    const tools = cutByTestId(before, "stock-tools");
    const order = ["stock-market-entry", "stock-tool-xray", "stock-tool-grow", "stock-tool-tax"].map((id) => tools.indexOf(`data-testid="${id}"`));
    expect(order.every((v) => v >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
  it("종목 한 장 머리 — 이름표를 읽은 뒤에도 미정 종목은 읽기 전과 같다", () => {
    const s = UNSET_STOCKS[0];
    expect(page(s, mk())).toBe(page(s, null));
    expect(page(s, mk({ "005930": none() }))).toBe(page(s, null));
    expect(page(UNSET_STOCKS[5], mk({ x: keep(1, 1) }))).toBe(page(UNSET_STOCKS[5], null)); // 티커 없는 종목
  });
});

describe("AC-1·2·7 상세·주식 행 표시", () => {
  const html = tab(MIXED);
  const rows = html.split('data-testid="stock-row-left"').slice(1).map((r) => r.slice(0, r.indexOf('data-testid="stock-row-right"')));
  const rowOf = (name: string) => rows.find((r) => r.includes(`>${name}<`))!;
  const decisionOf = (name: string) => /data-testid="stock-row-decision" data-kind="(\w+)"[^>]*>(.*?)<\/span><\/div>/.exec(rowOf(name));
  it("정한 종목 행에만 표시 — 장기 보유 / 점검 대상 / 차례면 점검 차례 하나만", () => {
    expect(text(decisionOf("삼성전자")![0].replace(/^[^>]*>/, ""))).toBe(" · 장기 보유");
    expect(decisionOf("삼성전자")![1]).toBe("keep");
    expect(decisionOf("Apple")![1]).toBe("check");
    expect(text(rowOf("Apple"))).toContain("점검 대상");
    expect(decisionOf("SK하이닉스")![1]).toBe("due");
    expect(text(rowOf("SK하이닉스"))).toContain("점검 차례");
    expect(text(rowOf("SK하이닉스"))).not.toContain("점검 대상");
    expect(html.match(/data-testid="stock-row-decision"/g)).toHaveLength(3);
  });
  it("미정·티커 없음·상장폐지 행은 마크업이 읽기 전과 같다(같은 화면 안에서도)", () => {
    const before = tab(null).split('data-testid="stock-row-left"').slice(1).map((r) => r.slice(0, r.indexOf('data-testid="stock-row-right"')));
    for (const name of ["TIGER 미국S&amp;P500", "비상장 스타트업", "폐지전자"]) {
      const a = rows.find((r) => r.includes(`>${name}<`));
      expect(a).toBeDefined();
      expect(a).toBe(before.find((r) => r.includes(`>${name}<`)));
    }
  });
  it("`점검 차례`만 인디고·굵게, 나머지는 muted. 390 미만은 차례 행에만(장기 보유·점검 대상 숨김 — 좁은 폭 행 높이 +0, qa D-1)", () => {
    const cls = (name: string) => /data-testid="stock-row-decision" data-kind="\w+" class="([^"]*)"/.exec(rowOf(name))![1];
    expect(cls("SK하이닉스")).toContain("font-semibold text-indigo-600 dark:text-indigo-200");
    expect(cls("SK하이닉스")).not.toMatch(/max-\[\d+px\]:hidden/);
    for (const n of ["삼성전자", "Apple"]) {
      expect(cls(n)).toContain("text-muted-foreground");
      // C99 — 폭 < 390이면 숨김(1을 빼서 쓰지 않는다)
      expect(cls(n)).toContain("max-[390px]:hidden");
      expect(cls(n)).not.toMatch(/max-\[3[0-8]\dpx\]/);
    }
  });
  it("390 미만 비차례 행 — 숨김 표시 말고는 미정 행과 글자·조각이 같다(행 높이 +0 회귀)", () => {
    const before = tab(null);
    for (const n of ["삼성전자", "Apple"]) {
      const b = before.split('data-testid="stock-row-left"').slice(1).find((r) => r.includes(`>${n}<`))!;
      const narrow = rowOf(n).replace(/<span data-testid="stock-row-decision"[^>]*><span[^>]*>[^<]*<\/span>[^<]*<\/span>/, "");
      expect(narrow).not.toContain("stock-row-decision");
      // 보이는 글자(숨김 표시 제외)가 미정 상태와 같다 — 좁은 폭에서 그려지는 조각은 수량 하나뿐
      expect(text(narrow)).toBe(text(b.slice(0, b.indexOf('data-testid="stock-row-right"'))));
    }
  });
  it("메타 줄 글자 — `65주 · 장기 보유` 꼴이고 줄 머리·줄 끝에 가운뎃점이 없다. 가운뎃점은 뒤 조각의 머리에 있다(줄이 바뀌면 잘린 자리로 들어간다)", () => {
    const meta = /<div class="flex items-center gap-1 mt-0\.5 flex-wrap[^"]*">(.*?)<\/div><\/div>/.exec(rowOf("삼성전자"))![1];
    const t = text(meta.replace(/<span class="text-sm text-muted-foreground max-sm:hidden">·<\/span><span class="text-sm font-semibold text-primary max-sm:hidden">[^<]*<\/span>/, "")).trim();
    expect(t).toBe("65주 · 장기 보유");
    expect(rowOf("삼성전자")).toContain("-ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]");
    expect(/<span[^>]*data-testid="stock-row-decision"[^>]*><span aria-hidden="true"[^>]*> · <\/span>장기 보유<\/span>/.test(rowOf("삼성전자"))).toBe(true);
    // PC 순서 — 비중 뒤·오늘 등락 칩 앞
    const s = UNSET_STOCKS[0];
    const pc = renderToStaticMarkup(<StockRowHeader stock={s} color="#000" pct={31.3} currentVal={1} profit={1} profitRate={1} todayChip={{ rate: 1.2, label: "오늘" }} decision="keep" />);
    expect(pc.indexOf("31.3%")).toBeLessThan(pc.indexOf("stock-row-decision"));
    expect(pc.indexOf("stock-row-decision")).toBeLessThan(pc.indexOf("오늘"));
  });
  it("인증카드(screenshotMode)에는 표시가 없다", () => {
    const s = UNSET_STOCKS[0];
    const shot = renderToStaticMarkup(<StockRowHeader stock={s} color="#000" pct={31.3} currentVal={1} profit={1} profitRate={1} screenshotMode decision="due" />);
    expect(shot).not.toContain("stock-row-decision");
    expect(shot).not.toContain("점검 차례");
  });
});

describe("AC-5 점검 한 장 진입 — 차례 행 펼침 맨 위 = 종목 한 장 머리(같은 컴포넌트)", () => {
  const card = (s: Stock, decision?: { kind: "keep" | "check" | "due"; entry: { text: string; labelKey: string } | null }) => {
    state.stocks = UNSET_STOCKS;
    const m = computeStockMetrics(s, RATES, 10_000_000, "KRW");
    return renderToStaticMarkup(
      <StockCard
        stock={s} color="#5b6fbf" pct={m.pct} currentVal={m.currentVal} profit={m.profit} profitRate={m.profitRate}
        isForeign={m.isForeign} krwMul={m.krwMul} currencyGain={m.currencyGain} currencyGainRate={m.currencyGainRate}
        linkedLoans={[]} onDelete={() => {}} categoryLabels={["국내"]} defaultOpen groupItems={[s]} exchangeRates={RATES} totalValue={10_000_000}
        todayChip={{ rate: 1.2, label: "오늘" }} decision={decision}
      />,
    );
  };
  const hynix = UNSET_STOCKS[1];
  const TEXT = "점검 차례 · 평단 대비 +25% 이상에 닿았어요";
  it("차례 행 펼침 — 진입이 이름 줄 입구 위에 1개", () => {
    const html = card(hynix, { kind: "due", entry: { text: TEXT, labelKey: "000660" } });
    expect(html.match(/data-testid="decision-entry"/g)).toHaveLength(1);
    expect(html.indexOf('data-testid="decision-entry"')).toBeLessThan(html.indexOf('data-testid="stock-page-entry"'));
    expect(text(cutByTestId(html, "decision-entry"))).toBe(TEXT);
  });
  it("차례가 아닌 행 펼침은 진입이 없고, 펼침 안은 미정 종목과 같다", () => {
    const keepOpen = card(hynix, { kind: "keep", entry: null });
    expect(keepOpen).not.toContain("decision-entry");
    const body = (h: string) => h.slice(h.indexOf('data-testid="stock-page-entry"'));
    expect(body(keepOpen)).toBe(body(card(hynix)));
  });
  it("머리 진입과 행 펼침 진입 — 문장·면·화살표·aria가 같다(위치 표시와 머리 간격만 다르다). 종목 정보를 속성에 싣지 않는다", () => {
    const row = cutByTestId(card(hynix, { kind: "due", entry: { text: TEXT, labelKey: "000660" } }), "decision-entry");
    const head = cutByTestId(page(hynix, MIXED), "decision-entry");
    expect(head).not.toBe("");
    expect(head.replace('data-at="head"', 'data-at="row"').replace(" -mt-1", " ")).toBe(row);
    expect(row).toContain('aria-label="SK하이닉스 점검 차례, 평단 대비 +25% 이상에 닿았어요, 점검 한 장 열기"');
    expect(row).toContain("min-h-10");
    expect(row).not.toMatch(/data-key|data-ticker|000660/);
  });
});

describe("AC-3 종목 한 장 머리", () => {
  const head = (s: Stock, labels: StockLabels) => page(s, labels);
  const sentence = (h: string) => text(cutByTestId(h, "stock-page-decision"));
  it("차례면 문장 대신 진입 — 둘을 같이 그리지 않는다", () => {
    const h = head(UNSET_STOCKS[1], MIXED);
    expect(h).toContain('data-testid="decision-entry"');
    expect(h).not.toContain('data-testid="stock-page-decision"');
  });
  it("장기 보유 — `장기 보유 · 정한 날 대비 +5.3%`(조건 절 없음), 내 수익 줄 아래", () => {
    const h = head(UNSET_STOCKS[0], MIXED);
    expect(sentence(h)).toBe("장기 보유 · 정한 날 대비 +5.3%");
    expect(h).toContain('data-kind="keep" data-since="set"');
    expect(h.indexOf('data-testid="stock-page-profit"')).toBeLessThan(h.indexOf('data-testid="stock-page-decision"'));
    expect(h).not.toContain("decision-entry");
  });
  it("점검 대상·±% 미도달·손실 — 조건 절까지, % 숫자만 손익색", () => {
    const h = head(UNSET_STOCKS[2], MIXED);
    expect(sentence(h)).toBe("점검 대상 · 정한 날 대비 -6.3% · 다시 볼 조건 평단 대비 −15% 이하 또는 +25% 이상");
    expect(/<span class="font-semibold ([^"]*)">-6\.3%<\/span>/.exec(h)![1]).not.toContain("muted");
    // 조건 절 — 하한·상한 둘 다면 360 미만에서 생략, 줄은 `또는` 앞에서만 끊긴다
    const plan = cutByTestId(h, "stock-page-decision-plan");
    expect(plan).toContain("max-[360px]:hidden");
    // 조각 안에서 접히는 줄이 보이는 가장자리에서 시작 — 조각 ml-2 + 점 -ml-3(같은 줄 간격은 그대로 12px), ui p1-1
    expect(/^<span[^>]*>/.exec(plan)![0]).toContain("ml-2 min-w-0");
    expect(plan).toMatch(/<span aria-hidden="true" class="-ml-3 inline-block w-3/);
    expect(plan).toContain('<span class="whitespace-nowrap font-medium text-foreground">또는 +25% 이상</span>');
    expect(text(plan)).not.toMatch(/·.*·/);
  });
  it("한쪽 조건만이면 360 미만에서도 조건 절을 지킨다", () => {
    const h = head(UNSET_STOCKS[2], mk({ AAPL: check(30, 160.1, { down: 15 }) }));
    expect(sentence(h)).toBe("점검 대상 · 정한 날 대비 -6.3% · 다시 볼 조건 평단 대비 −15% 이하");
    expect(cutByTestId(h, "stock-page-decision-plan")).not.toMatch(/max-\[\d+px\]:hidden/);
  });
  it("값 없는 조각은 통째로 없다 — 빈 꼬리·`—` 없음", () => {
    const h = head(UNSET_STOCKS[0], mk({ "005930": check(30) }));
    expect(sentence(h)).toBe("점검 대상");
    expect(h).toContain('data-since="none"');
    expect(h).not.toContain("stock-page-decision-plan");
    expect(sentence(head(UNSET_STOCKS[0], mk({ "005930": keep(0, 80000) })))).toBe("장기 보유 · 오늘 정함");
  });
  it("줄 끝 가운뎃점 0 — 가운뎃점은 뒤 조각의 머리에만 있다(줄이 바뀌면 잘린 자리로 들어간다)", () => {
    const h = cutByTestId(head(UNSET_STOCKS[2], MIXED), "stock-page-decision");
    expect(h).toContain("-ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]");
    // 조각마다 닫히기 직전 글자가 가운뎃점이 아니다
    expect(h).not.toMatch(/·\s*<\/span>\s*<span class="whitespace-nowrap"/);
    expect(h.match(/aria-hidden="true"[^>]*> · </g)).toHaveLength(2);
  });
  it("머리에 '정하기' 진입·권유 낱말이 없다", () => {
    for (const s of [UNSET_STOCKS[0], UNSET_STOCKS[1], UNSET_STOCKS[2], UNSET_STOCKS[3]]) {
      expect(text(head(s, MIXED))).not.toMatch(/정하기|팔|사세요|늦|위험|기회|추천/);
    }
  });
});

describe("AC-14 `내 자산 점검` 타일", () => {
  const rowsOf = (labels: StockLabels) => buildBoardRows(UNSET_STOCKS, RATES, labels, NOW.getTime());
  const line = (labels: StockLabels) => renderToStaticMarkup(<GrowTileValueLine value={growTileValueOf(rowsOf(labels))!} />);
  it("3상태 값 줄 — 화면 글자 = 순수 함수 조각", () => {
    const due = line(MIXED);
    expect(text(due)).toBe("주식 점검 차례 1종목");
    expect(due).toContain('<span class="font-semibold text-indigo-600 dark:text-indigo-200">1종목</span>');
    const labeled = line(mk({ "005930": keep(30, 76000), AAPL: check(30, 160) }));
    expect(text(labeled)).toBe("주식 장기 보유 1 · 점검 대상 1");
    expect(text(line(mk()))).toBe("장기 보유 · 점검 대상 정하기 전");
    for (const l of [MIXED, mk({ "005930": keep(30, 76000) }), mk()]) expect(text(line(l))).toBe(growTileValueOf(rowsOf(l))!.parts.join(" · "));
  });
  it("타일 차례 수 = 같은 화면 목록의 `점검 차례` 표시 수", () => {
    const html = tab(MIXED);
    const n = Number(/data-testid="stock-tool-grow-value" data-kind="due" data-due="(\d+)"/.exec(html)![1]);
    expect(n).toBe(html.match(/data-testid="stock-row-decision" data-kind="due"/g)!.length);
  });
  it("격자 — 4개는 모바일·PC 모두 2×2(360 미만은 아래 두 타일 한 줄씩), 줄 끝 가운뎃점 숨김", () => {
    const tools = cutByTestId(tab(MIXED), "stock-tools");
    expect(tools).toContain("grid grid-cols-2 gap-2 lg:grid-cols-2");
    expect(/^<button[^>]*>/.exec(cutByTestId(tools, "stock-tool-grow"))![0]).toContain("max-[360px]:col-span-2");
    expect(/^<button[^>]*>/.exec(cutByTestId(tools, "stock-tool-tax"))![0]).toContain("max-[360px]:col-span-2");
    expect(line(mk())).toContain("-ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]");
  });
  it("주식 보기에 행이 없으면(전부 상장폐지·수량 0) 타일이 없다", () => {
    const gone = [UNSET_STOCKS[6]];
    expect(tab(mk(), gone)).not.toContain("stock-tool-grow");
  });
});
