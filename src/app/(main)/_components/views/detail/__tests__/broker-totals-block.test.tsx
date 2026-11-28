// #319(5.160) 증권사별 합계 블록 — 정적 렌더(effect 없음): 접힘 기본·화면 문자열 합 = 헤더 문자열·DOM 0 조건·행 맞추기 이벤트
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Cash, Stock } from "@/types/asset";
import { readFileSync } from "node:fs";
import path from "node:path";
import { BrokerTotalsBlock } from "../tabs/broker-totals-block";
import { computeStockTotals } from "../asset-detail-tabs";
import { formatCurrency } from "@/lib/number-utils";
import { dispatchAddStock } from "../../../layout/navigation/asset-dispatch";

const RATES = { USD: 1387.3, JPY: 911 };
const st = (o: Partial<Stock>): Stock =>
  ({ id: "s", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 70000, currentPrice: 80001, currency: "KRW", purchaseDate: "2025-01-01", ...o }) as Stock;

const STOCKS: Stock[] = [
  st({ id: "a", broker: "키움증권", quantity: 7, currentPrice: 80333 }),
  st({ id: "b", broker: "미래에셋증권", ticker: "000660", quantity: 3, currentPrice: 190111 }),
  st({ id: "c", broker: "토스증권", category: "foreign", ticker: "AAPL", currency: "USD", quantity: 3.3, averagePrice: 180.55, currentPrice: 191.27, purchaseExchangeRate: 1301.7 } as Partial<Stock>),
  st({ id: "u", broker: "", ticker: "", category: "unlisted", quantity: 10, averagePrice: 5000, currentPrice: 5001 }),
];

const texts = (html: string, id: string) => [...html.matchAll(new RegExp(`data-testid="${id}"[^>]*>(.*?)</(?:span|p)>`, "g"))].map((m) => m[1]);
const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));

describe("BrokerTotalsBlock", () => {
  it("처음엔 접혀 있고(aria-expanded=false·패널 inert) 패널은 항상 마운트, 맞추기 버튼 40px", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html).toContain('data-testid="broker-totals"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('data-state="closed"');
    expect(html).toContain("inert");
    expect(html).toContain("증권사별");
    expect(html).toContain("4곳");
    expect(html).toContain("h-10");
    expect(html).not.toMatch(/data-state="open"/);
  });

  it("소계 화면 문자열 합 = 헤더 합계 문자열, 주식 행 비중 조각 0(5.179, 합 100.0%는 broker-totals.test), 미지정 맨 아래", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    const t = computeStockTotals(STOCKS, RATES);
    const values = texts(html, "broker-row-value");
    expect(values).toHaveLength(4);
    expect(values.reduce((a, v) => a + num(v), 0)).toBe(num(formatCurrency(t.totalValue)));
    // 5.179: 주식 행은 비중 조각을 그리지 않는다(코인 거래소 행은 유지)
    expect(html).not.toContain('data-testid="broker-row-share"');
    const names = texts(html, "broker-row-name");
    expect(names.at(-1)).toBe("증권사 미지정");
    expect(html).toContain('data-testid="broker-totals-note"');
  });

  it("묶음이 1개이거나 주식이 0건이면 DOM 0", () => {
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={[]} exchangeRates={RATES} displayCurrency="KRW" />)).toBe("");
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={[STOCKS[0], STOCKS[1].id ? { ...STOCKS[1], broker: "키움 증권" } : STOCKS[1]]} exchangeRates={RATES} displayCurrency="KRW" />)).toBe("");
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={[st({ broker: "" }), st({ id: "q", broker: "항목 1" })]} exchangeRates={RATES} displayCurrency="KRW" />)).toBe("");
  });

  it("해외 달러 보기는 $ 표기", () => {
    const foreign = [
      st({ id: "f1", broker: "토스증권", category: "foreign", ticker: "AAPL", currency: "USD", quantity: 3.3, averagePrice: 180.55, currentPrice: 191.27, purchaseExchangeRate: 1300 } as Partial<Stock>),
      st({ id: "f2", broker: "키움증권", category: "foreign", ticker: "MSFT", currency: "USD", quantity: 1.1, averagePrice: 400.12, currentPrice: 411.33, purchaseExchangeRate: 1300 } as Partial<Stock>),
    ];
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={foreign} exchangeRates={RATES} displayCurrency="USD" />);
    expect(texts(html, "broker-row-value").every((v) => v.startsWith("$"))).toBe(true);
  });

  it("5.163: 행을 코인 거래소별과 함께 써도 주식 행은 그대로(맞추기 버튼 행마다 1개, 금액 칸 클래스 불변, `N종목`)", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html.match(/data-testid="broker-row-resync"/g)).toHaveLength(4);
    // 5.167 E1: 금액 열 shrink-0 제거·손익 줄 flex-wrap(360 맞추기 넘침 해소)
    expect(html).toContain('<div class="text-right"><p data-testid="broker-row-value"');
    expect(html).toContain('data-testid="broker-row-profit" class="flex flex-row items-center gap-1 mt-0.5 flex-wrap justify-end"');
    expect(html).not.toContain("ml-auto\"><p");
    expect(texts(html, "broker-row-count").every((t) => /^\d+종목$/.test(t))).toBe(true);
  });

  it("투자 권유 문구 0", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html).not.toMatch(/사세요|파세요|추천|비중을 (맞추|조정)/);
  });
});

// #335(5.167) 증권사 행 아래 독립 줄 `현금 N원` — '전체' 탭만(부르는 쪽이 cash를 넘김)·원화 보기만·정확 일치·0원 숨김
describe("BrokerTotalsBlock 현금 줄(#335)", () => {
  const CASH = [
    { id: "c1", name: "CMA", type: "cma", balance: 1_234_567, currency: "KRW", institution: "키움증권" },
    { id: "c2", name: "예수금", type: "cma", balance: 100, currency: "USD", institution: "토스증권" },
    { id: "c3", name: "부분", type: "cma", balance: 5_000, currency: "KRW", institution: "미래에셋" },
    { id: "c4", name: "기타", type: "bank", balance: 7_000, currency: "KRW", institution: "기타" },
  ] as Cash[];
  const rowHtml = (html: string, broker: string) => {
    const i = html.indexOf(`data-broker="${broker}"`);
    const j = html.indexOf('data-testid="broker-row"', i + 1);
    return html.slice(i, j < 0 ? undefined : j);
  };

  it("정확 일치 행에만 1줄, 접두 `·` 0, 중립색·tabular-nums·nowrap, DOM 순서 금액 → 현금 → 맞추기", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" cash={CASH} />);
    expect(texts(html, "broker-row-cash").sort()).toEqual([`현금 ${Math.round(100 * RATES.USD).toLocaleString("ko-KR")}원`, "현금 1,234,567원"].sort());
    const kiwoom = rowHtml(html, "키움증권");
    expect(kiwoom).toContain('class="col-span-full row-start-2 mt-0.5 text-sm text-muted-foreground tabular-nums whitespace-nowrap"');
    expect(kiwoom).toContain("grid min-h-14 grid-cols-[minmax(4rem,1fr)_auto_auto]");
    expect(kiwoom.indexOf("broker-row-value")).toBeLessThan(kiwoom.indexOf("broker-row-cash"));
    expect(kiwoom.indexOf("broker-row-cash")).toBeLessThan(kiwoom.indexOf("broker-row-resync"));
    expect(kiwoom).not.toContain("basis-full");
    // 부분 일치('미래에셋')·미지정 행은 줄 없음, 기존 flex 마크업 그대로
    expect(rowHtml(html, "미래에셋증권")).not.toContain("broker-row-cash");
    expect(rowHtml(html, "미래에셋증권")).toContain("flex min-h-14 flex-wrap items-center gap-x-2 py-2 min-[360px]:flex-nowrap");
    expect(rowHtml(html, "증권사 미지정")).not.toContain("broker-row-cash");
  });

  it("헤더·행 평가금·손익·비중 문자열은 현금이 있어도 같다(C150·C156)", () => {
    const a = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    const b = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" cash={CASH} />);
    for (const id of ["broker-row-name", "broker-row-value", "broker-row-count", "broker-row-share"]) expect(texts(b, id)).toEqual(texts(a, id));
    expect(b.match(/data-testid="broker-row"/g)).toHaveLength(a.match(/data-testid="broker-row"/g)!.length);
    expect(b).toContain("4곳");
  });

  it("cash 미전달('전체' 외 탭)·달러 보기·현금 0건·0원 합이면 DOM 0", () => {
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />)).not.toContain("broker-row-cash");
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" cash={[]} />)).not.toContain("broker-row-cash");
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="USD" cash={CASH} />)).not.toContain("broker-row-cash");
    const zero = [{ ...CASH[0], balance: 0.2 }] as Cash[];
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" cash={zero} />)).not.toContain("broker-row-cash");
  });

  it("현금만 있는 증권사는 행이 생기지 않고, 묶음 1개면 현금이 있어도 블록 DOM 0", () => {
    const only = [{ ...CASH[0], institution: "삼성증권" }] as Cash[];
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" cash={only} />);
    expect(html).not.toContain('data-broker="삼성증권"');
    expect(renderToStaticMarkup(<BrokerTotalsBlock stocks={[STOCKS[0]]} exchangeRates={RATES} displayCurrency="KRW" cash={CASH} />)).toBe("");
  });

  it("stock-tab은 '전체' 탭에서만 cash를 넘긴다", () => {
    const src = readFileSync(path.resolve(__dirname, "../tabs/stock-tab.tsx"), "utf8");
    expect(src).toContain('cash={activeCategory === "all" ? assetData.cash : undefined}');
  });
});

describe("dispatchAddStock broker 전달(#319)", () => {
  it("broker가 있으면 detail에 담고, 없으면 기존과 같은 detail", () => {
    const events: CustomEvent[] = [];
    const orig = globalThis.window;
    // @ts-expect-error 테스트용 최소 window
    globalThis.window = { dispatchEvent: (e: CustomEvent) => (events.push(e), true) };
    class CE { type: string; detail: unknown; constructor(t: string, i: { detail: unknown }) { this.type = t; this.detail = i.detail; } }
    vi.stubGlobal("CustomEvent", CE);
    dispatchAddStock("screenshot", "키움증권");
    dispatchAddStock("screenshot");
    vi.unstubAllGlobals();
    globalThis.window = orig;
    expect(events.map((e) => e.detail)).toEqual([{ mode: "screenshot", broker: "키움증권" }, { mode: "screenshot" }]);
  });

  it("5.162 메타 줄: 종목 수 조각 nowrap(320 꺾임은 조각 사이에서만, C152) — 5.179부터 dot-wrap·비중 조각 0", () => {
    const long = [
      st({ id: "l1", broker: "한국투자증권 종합계좌 아주긴이름", quantity: 7 }),
      st({ id: "l2", broker: "미래에셋증권", ticker: "000660", quantity: 3 }),
    ];
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={long} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html).toMatch(/data-testid="broker-row-count" class="whitespace-nowrap ml-2"/);
    expect(html).not.toContain("broker-row-share");
  });
});
