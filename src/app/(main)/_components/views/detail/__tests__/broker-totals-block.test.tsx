// #319(5.160) 증권사별 합계 블록 — 정적 렌더(effect 없음): 접힘 기본·화면 문자열 합 = 헤더 문자열·DOM 0 조건·행 맞추기 이벤트
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
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

  it("소계 화면 문자열 합 = 헤더 합계 문자열, 비중 합 100.0%, 미지정 맨 아래", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    const t = computeStockTotals(STOCKS, RATES);
    const values = texts(html, "broker-row-value");
    expect(values).toHaveLength(4);
    expect(values.reduce((a, v) => a + num(v), 0)).toBe(num(formatCurrency(t.totalValue)));
    const shares = texts(html, "broker-row-share").map((v) => num(v) * 10);
    expect(Math.round(shares.reduce((a, b) => a + b, 0))).toBe(1000);
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
    expect(html).toContain('<div class="shrink-0 text-right"><p data-testid="broker-row-value"');
    expect(html).not.toContain("ml-auto\"><p");
    expect(texts(html, "broker-row-count").every((t) => /^\d+종목$/.test(t))).toBe(true);
  });

  it("투자 권유 문구 0", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html).not.toMatch(/사세요|파세요|추천|비중을 (맞추|조정)/);
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

  it("5.162 메타 줄: 종목 수·'· 비중' 두 조각 모두 nowrap(320 꺾임은 조각 사이에서만, C152)", () => {
    const long = [
      st({ id: "l1", broker: "한국투자증권 종합계좌 아주긴이름", quantity: 7 }),
      st({ id: "l2", broker: "미래에셋증권", ticker: "000660", quantity: 3 }),
    ];
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={long} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html).toMatch(/data-testid="broker-row-count" class="whitespace-nowrap"/);
    expect(html).toMatch(/data-testid="broker-row-share" class="whitespace-nowrap">· /);
  });
});
