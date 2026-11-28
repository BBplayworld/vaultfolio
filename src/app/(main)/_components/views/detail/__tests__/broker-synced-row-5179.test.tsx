// #366(5.179) 증권사별 행 `N종목 · M/D 맞춤` — 표시 규칙(모든 계좌 기록·수 일치일 때만 가장 이른 날)·dot-wrap 메타·코인 행 DOM 불변·데모 세 표기
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Stock } from "@/types/asset";
import { BrokerRow, BrokerTotalsBlock } from "../tabs/broker-totals-block";
import { ExchangeTotalsBlock } from "../tabs/exchange-totals-block";
import { FIXTURE } from "@/lib/asset/__tests__/exchange-totals.fixture";
import { computeBrokerTotals, type BrokerTotalRow } from "@/lib/asset/broker-totals";
import { syncedLabel } from "@/lib/asset/broker-synced";
import { parseBrokerSynced, type BrokerSyncEntry } from "@/lib/asset/asset-refresh-status";
import { buildDemoRefreshMeta, kstToday, materializeDemo } from "@/lib/preview/demo-payload";

// 데모 JSON은 정적 import 금지(preview-safety 9번) — 파일로 읽는다
const demo: unknown = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../../../lib/preview/demo-data.json"), "utf8"));

const RATES = { USD: 1400, JPY: 900 };
const TODAY = "2026-11-20";
const st = (o: Partial<Stock>): Stock =>
  ({ id: "s", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 70000, currentPrice: 80000, currency: "KRW", purchaseDate: "2025-01-01", ...o }) as Stock;
const entry = (broker: string, category: BrokerSyncEntry["category"], date: string, count: number): BrokerSyncEntry => ({ broker, category, date, count });
const rowOf = (rows: BrokerTotalRow[], name: string) => rows.find((r) => r.name === name)!;
const text = (html: string) => html.replace(/<[^>]+>/g, "");

const STOCKS: Stock[] = [
  st({ id: "k1", broker: "키움증권" }),
  st({ id: "k2", broker: "키움증권", ticker: "000660" }),
  st({ id: "k3", broker: "키움증권", ticker: "000660", quantity: 1 }), // 같은 티커 둘 — count(티커)는 2, 항목 수는 3
  st({ id: "k4", broker: "키움증권", category: "foreign", ticker: "AAPL", currency: "USD", averagePrice: 150, currentPrice: 160 }),
  st({ id: "k5", broker: "키움증권", ticker: "999990", inactiveStatus: "delisted" } as Partial<Stock>),
  st({ id: "t1", broker: "토스증권", ticker: "035420" }),
  st({ id: "t2", broker: "토스증권", category: "unlisted", ticker: "" }),
  st({ id: "u1", broker: "", ticker: "035720" }),
];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-20T03:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("scopeCounts(computeBrokerTotals)", () => {
  it("live 항목을 계좌별로 센다 — 상장폐지·비상장 제외, 미지정 행은 없음", () => {
    const { rows } = computeBrokerTotals(STOCKS, RATES);
    expect(rowOf(rows, "키움증권").scopeCounts).toEqual({ domestic: 3, foreign: 1 });
    expect(rowOf(rows, "키움증권").count).toBe(3); // 기존 정의(티커 중복 제거) 그대로
    expect(rowOf(rows, "토스증권").scopeCounts).toEqual({ domestic: 1 });
    expect(rowOf(rows, "증권사 미지정").scopeCounts).toBeUndefined();
  });
});

describe("syncedLabel 표시 규칙", () => {
  const { rows } = computeBrokerTotals(STOCKS, RATES);
  const kiwoom = rowOf(rows, "키움증권");
  it("모든 계좌 기록·수 일치 → 가장 이른 날, 올해는 M/D(앞 0 없음)", () => {
    expect(syncedLabel(kiwoom, [entry("키움증권", "domestic", "2026-11-20", 3), entry("키움 증권", "foreign", "2026-01-05", 1)], TODAY)).toEqual({ date: "2026-01-05", text: "1/5 맞춤" });
  });
  it("다른 해는 YYYY.M.D", () => {
    expect(syncedLabel(kiwoom, [entry("키움증권", "domestic", "2025-12-03", 3), entry("키움증권", "foreign", "2026-11-01", 1)], TODAY)?.text).toBe("2025.12.3 맞춤");
  });
  it("일부 계좌만 기록·수 불일치·미지정 행·비상장만 → null", () => {
    expect(syncedLabel(kiwoom, [entry("키움증권", "domestic", "2026-11-20", 3)], TODAY)).toBeNull();
    expect(syncedLabel(kiwoom, [entry("키움증권", "domestic", "2026-11-20", 2), entry("키움증권", "foreign", "2026-11-20", 1)], TODAY)).toBeNull();
    expect(syncedLabel(rowOf(rows, "증권사 미지정"), [entry("항목 1", "domestic", "2026-11-20", 1)], TODAY)).toBeNull();
    const onlyUnlisted = computeBrokerTotals([st({ id: "x", broker: "A증권", category: "unlisted", ticker: "" }), st({ id: "y", broker: "B증권" })], RATES).rows;
    expect(syncedLabel(rowOf(onlyUnlisted, "A증권"), [entry("A증권", "domestic", "2026-11-20", 0)], TODAY)).toBeNull();
  });
  it("탭 필터 반영: 국내만 맞춘 증권사는 전체 탭 0, 국내 탭 표시, 해외 탭 0", () => {
    const e = [entry("키움증권", "domestic", "2026-11-20", 3)];
    const tab = (cat: Stock["category"]) => rowOf(computeBrokerTotals(STOCKS.filter((s) => s.category === cat), RATES).rows, "키움증권");
    expect(syncedLabel(kiwoom, e, TODAY)).toBeNull();
    expect(syncedLabel(tab("domestic"), e, TODAY)?.text).toBe("11/20 맞춤");
    expect(syncedLabel(tab("foreign"), e, TODAY)).toBeNull();
  });
  it("맞춘 뒤 종목 추가·전량 매도로 수가 바뀌면 숨긴다", () => {
    const e = [entry("토스증권", "domestic", "2026-11-20", 1)];
    expect(syncedLabel(rowOf(rows, "토스증권"), e, TODAY)?.text).toBe("11/20 맞춤");
    const added = computeBrokerTotals([...STOCKS, st({ id: "t3", broker: "토스증권", ticker: "005380" })], RATES).rows;
    expect(syncedLabel(rowOf(added, "토스증권"), e, TODAY)).toBeNull();
    const sold = computeBrokerTotals(STOCKS.map((s) => (s.id === "t1" ? { ...s, quantity: 0 } : s)), RATES).rows;
    expect(rowOf(sold, "토스증권")?.scopeCounts ?? {}).toEqual({});
  });
});

describe("BrokerRow 메타 줄(dot-wrap)", () => {
  const { rows, scale } = computeBrokerTotals(STOCKS, RATES);
  const kiwoom = rowOf(rows, "키움증권");
  it("synced 있음: `N종목 · M/D 맞춤`, 조각 nowrap, data-date, 색·굵기는 메타 줄과 같음", () => {
    const html = renderToStaticMarkup(<BrokerRow row={kiwoom} scale={scale} synced={{ date: "2026-11-20", text: "11/20 맞춤" }} share={false} />);
    expect(html).toContain('<p data-testid="broker-row-meta" class="flex flex-wrap gap-x-1 text-sm text-muted-foreground tabular-nums -ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]">');
    expect(html).toContain('data-testid="broker-row-count" class="whitespace-nowrap ml-2"');
    expect(html).toMatch(/data-testid="broker-row-synced" data-date="2026-11-20" class="whitespace-nowrap"><span aria-hidden="true" class="-ml-1 inline-block w-3 text-center font-normal text-muted-foreground"> · <\/span>11\/20 맞춤<\/span>/);
    const meta = html.slice(html.indexOf('data-testid="broker-row-meta"'), html.indexOf("</p>"));
    expect(text(`<p ${meta}</p>`)).toMatch(/^3종목 · 11\/20 맞춤$/);
    expect(meta).not.toMatch(/font-(semibold|bold)|text-foreground|text-(rose|blue|amber)/);
    expect(html).not.toContain("broker-row-share");
  });
  it("synced null: 날짜 조각·DotLead DOM 0, `N종목`만", () => {
    const html = renderToStaticMarkup(<BrokerRow row={kiwoom} scale={scale} synced={null} share={false} />);
    expect(html).not.toContain("broker-row-synced");
    expect(html).not.toContain("aria-hidden");
    expect(text(html)).toContain("3종목");
  });
  it("synced 미전달(코인 행): 기존 인라인 `· 비중` 마크업 그대로", () => {
    const html = renderToStaticMarkup(<BrokerRow row={kiwoom} scale={scale} />);
    expect(html).not.toContain("broker-row-meta");
    expect(html).toContain('<span class="text-sm text-muted-foreground tabular-nums"><span data-testid="broker-row-count" class="whitespace-nowrap">3종목</span> <span data-testid="broker-row-share" class="whitespace-nowrap">· ');
  });
});

describe("코인 거래소별 행 DOM 불변", () => {
  it("ExchangeTotalsBlock 정적 마크업 sha256 = main 21bd696과 같다", () => {
    const html = renderToStaticMarkup(<ExchangeTotalsBlock crypto={FIXTURE} />);
    expect(html).toHaveLength(10174);
    expect(createHash("sha256").update(html).digest("hex")).toBe("b5188dca97f02627386ba0ab7e67ab2b7cf4f60625114465e87bc534095a3b17");
  });
});

describe("주식 블록 정적 렌더", () => {
  it("서버 렌더(저장소 없음)는 날짜 조각 0, 메타 줄은 dot-wrap", () => {
    const html = renderToStaticMarkup(<BrokerTotalsBlock stocks={STOCKS} exchangeRates={RATES} displayCurrency="KRW" />);
    expect(html).not.toContain("broker-row-synced");
    expect(html.match(/data-testid="broker-row-meta"/g)).toHaveLength(3);
  });
});

describe("데모 메타 세 표기", () => {
  it("데모증권 `M/D 맞춤`·연금저축 `YYYY.M.D 맞춤`·ISA 날짜 없음", () => {
    const now = Date.parse("2026-11-20T03:00:00Z");
    const today = kstToday(now);
    const p = materializeDemo(demo, today) as { assetData: { stocks: Stock[] } };
    const { rows } = computeBrokerTotals(p.assetData.stocks, RATES);
    const entries = parseBrokerSynced(buildDemoRefreshMeta(now), today);
    expect(entries).toHaveLength(3);
    expect(syncedLabel(rowOf(rows, "데모증권"), entries, today)?.text).toBe("11/18 맞춤");
    expect(syncedLabel(rowOf(rows, "연금저축"), entries, today)?.text).toBe("2025.12.3 맞춤");
    expect(syncedLabel(rowOf(rows, "ISA"), entries, today)).toBeNull();
  });
});
