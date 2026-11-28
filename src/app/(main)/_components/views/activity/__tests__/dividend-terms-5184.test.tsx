// #377(5.184) 배당 탭 용어·배지 — 지급·예상 두 낱말, 배지 월 오름차순·고정 key·sr-only 상태, 범례는 상태 2개 이상만, Hero `예상` 점선, InfoHint 문구
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Stock } from "@/types/asset";
import { computeDividends } from "@/lib/finance/dividend-calc";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";

vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: { stocks: [], transactions: [] }, exchangeRates: { USD: 1400, JPY: 900 } }) }));
const mocked = vi.hoisted(() => ({ value: {} as unknown }));
vi.mock("../use-dividend-data", async (importOriginal) => ({ ...(await importOriginal<typeof import("../use-dividend-data")>()), useDividendData: () => mocked.value }));

import { DividendCard } from "../dividend-chart";
import { MonthlyDividendStocks } from "../monthly-dividend-stocks";
import { buildDividendGroups } from "../use-dividend-data";

const TODAY = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const YEAR = TODAY.slice(0, 4);
const NOW_M = Number(TODAY.slice(5, 7));
const stock = (o: Partial<Stock>): Stock =>
  ({ id: "A", category: "domestic", name: "삼성", ticker: "005930", quantity: 65, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", ...o }) as Stock;
const pay = (m: number, a: number, est = false) =>
  ({ payoutDate: `${YEAR}-${String(m).padStart(2, "0")}-01`, amountPerShare: a, frequency: "quarterly", ...(est ? { isEstimated: true } : {}) }) as DividendPayoutResult;

function setup(stocks: Stock[], payouts: DividendPayoutResult[]) {
  const { grouped, jpyCount } = buildDividendGroups(stocks);
  const groups = grouped.map((g) => ({ ...g, payouts, isLoading: false }));
  const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), [], 1400, TODAY);
  mocked.value = { groups, calc, isLoading: false, loadedCount: groups.length, failedCount: 0, totalCount: groups.length, jpyCount };
  return { groups, calc };
}
const table = (stocks: Stock[], payouts: DividendPayoutResult[], m?: number) => {
  const { groups, calc } = setup(stocks, payouts);
  return renderToStaticMarkup(<MonthlyDividendStocks selectedMonth={m} groups={groups} calc={calc} />);
};
const chips = (html: string) =>
  [...html.matchAll(/class="([^"]*)" data-testid="dividend-month-chip" data-state="(\w+)"( data-selected="true")?>(\d+)월<span class="sr-only">([^<]*)</g)].map((x) => ({ cls: x[1], state: x[2], selected: !!x[3], month: +x[4], sr: x[5] }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

// 1월 매수 전(inactive) · 지난 달까지 지급(paid) · 12월 예상 — 테스트 날짜가 12월이면 12월은 이번 달이라 예상 그대로
const mixed = [pay(1, 100), pay(NOW_M > 2 ? 2 : 1, 100), pay(12, 100, true)];

describe("배당월 배지", () => {
  it("글자는 모두 `N월`, 월 오름차순, sr-only 상태 접미(지급·예상·보유 전, 0원)", () => {
    const html = table([stock({ purchaseDate: `${YEAR}-01-10` })], [pay(12, 100, true), pay(1, 100), ...(NOW_M > 4 ? [pay(4, 100)] : [])]);
    const c = chips(html);
    expect(c.map((x) => x.month)).toEqual([...c.map((x) => x.month)].sort((a, b) => a - b));
    expect(c[0]).toMatchObject({ month: 1, state: "inactive", sr: " 보유 전, 0원" });
    expect(c.at(-1)).toMatchObject({ month: 12, state: "expected", sr: " 예상" });
    if (NOW_M > 4) expect(c[1]).toMatchObject({ month: 4, state: "paid", sr: " 지급" });
    expect(html).not.toContain("예정");
    expect(html).not.toContain("opacity-25");
    expect(html).not.toContain("tracking-tighter");
  });
  it("모양: 지급 = brand 면·실선, 예상 = 점선·면 없음, 보유 전 = 테두리 투명. 인라인 팔레트색 0", () => {
    const html = table([stock({ purchaseDate: `${YEAR}-01-10` })], [pay(1, 100), pay(12, 100, true), ...(NOW_M > 4 ? [pay(4, 100)] : [])]);
    const cls = (state: string) => chips(html).find((x) => x.state === state)?.cls ?? "";
    expect(cls("expected")).toContain("border-dashed");
    expect(cls("expected")).toContain("bg-transparent");
    expect(cls("inactive")).toContain("border-transparent");
    if (NOW_M > 4) {
      expect(cls("paid")).toContain("bg-brand/15");
      expect(cls("paid")).not.toContain("border-dashed");
    }
    expect(html).not.toMatch(/dividend-month-chip[^>]*style=/);
  });
  it("선택된 달: data-selected, 지급은 brand 채움, 예상은 brand 점선(variant default 미사용)", () => {
    const sel = table([stock({})], [pay(1, 100), pay(12, 100, true)], 12);
    const c = chips(sel);
    expect(c.find((x) => x.month === 12)).toMatchObject({ selected: true, state: "expected" });
    expect(c.find((x) => x.month === 12)!.cls).toContain("border-dashed border-brand");
    const sel1 = table([stock({})], [pay(1, 100), pay(12, 100, true)], 1);
    expect(chips(sel1).find((x) => x.month === 1)).toMatchObject({ selected: true, state: "paid" });
    expect(chips(sel1).find((x) => x.month === 1)!.cls).toContain("bg-brand border-brand text-brand-foreground");
    for (const x of chips(sel1)) expect(x.cls).not.toContain("bg-primary");
  });
});

describe("배당월 범례", () => {
  it("상태 3개면 3항목(지급·예상·보유 전), 목록 역할", () => {
    const html = table([stock({ purchaseDate: `${YEAR}-01-10` })], [pay(1, 100), pay(12, 100, true), ...(NOW_M > 4 ? [pay(4, 100)] : [])]);
    expect(html).toContain('role="list" aria-label="배당월 표시" data-testid="dividend-month-legend"');
    const items = [...html.matchAll(/data-testid="dividend-legend-(\w+)"[^>]*>([^<]*)</g)].map((x) => [x[1], x[2]]);
    expect(items).toEqual(NOW_M > 4 ? [["paid", "지급"], ["expected", "예상"], ["inactive", "보유 전"]] : [["expected", "예상"], ["inactive", "보유 전"]]);
  });
  it("상태가 1개면 범례 없음(12월 말 전부 지급·1월 초 전부 예상)", () => {
    expect(table([stock({})], [pay(1, 100)])).not.toContain("dividend-month-legend");
    expect(table([stock({})], [pay(12, 100, true)])).not.toContain("dividend-month-legend");
  });
  it("월 선택 중에는 걸러진 행 기준", () => {
    const a = stock({ id: "A", ticker: "005930", name: "가" });
    const b = stock({ id: "B", ticker: "000660", name: "나" });
    const { grouped } = buildDividendGroups([a, b]);
    const per: Record<string, DividendPayoutResult[]> = { A: [pay(1, 100)], B: [pay(12, 100, true)] };
    const groups = grouped.map((g) => ({ ...g, payouts: per[g.stock.id], isLoading: false }));
    const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts: per[s.id] }))), [], 1400, TODAY);
    expect(renderToStaticMarkup(<MonthlyDividendStocks selectedMonth={undefined} groups={groups} calc={calc} />)).toContain("dividend-month-legend");
    expect(renderToStaticMarkup(<MonthlyDividendStocks selectedMonth={12} groups={groups} calc={calc} />)).not.toContain("dividend-month-legend");
  });
});

describe("표 머리·주당 칸", () => {
  it("연간 `최근 1주당 · 지급 · 올해 합계`, 월 선택 `M월 지급 · M월 합계`, `지금 N주`", () => {
    const html = table([stock({})], mixed);
    const heads = [...html.matchAll(/role="columnheader"[^>]*>([^<]*)</g)].map((m) => m[1]);
    expect(heads).toEqual(["종목명", "배당월", "최근 1주당", "지급", "올해 합계"]);
    expect(text(html)).toContain("지금 65주");
    expect(text(html)).not.toContain("보유 65주");
    const m = [...table([stock({})], mixed, 12).matchAll(/role="columnheader"[^>]*>([^<]*)</g)].map((x) => x[1]);
    expect(m.slice(3)).toEqual(["12월 지급", "12월 합계"]);
  });
  it("최근 1주당 = 최신 확정 회차(첫 회차 아님)", () => {
    if (NOW_M < 3) return; // 1·2월엔 지난 확정 회차가 1건이라 구별 불가
    const html = table([stock({})], [pay(1, 566), pay(2, 370), pay(12, 370, true)]);
    expect(html).toMatch(/data-testid="dividend-stock-pershare"[^>]*><p[^>]*>370원</);
  });
});

describe("Hero·범례·InfoHint 문구", () => {
  it("옛 낱말 0(예정·예상치·(옅음)·지급금액), InfoHint 3절 13~16 글자 그대로(팝오버는 닫힌 채 렌더되므로 소스로 확인)", () => {
    setup([stock({})], mixed);
    const html = renderToStaticMarkup(<DividendCard />) + table([stock({})], mixed) + table([stock({})], mixed, 12);
    for (const w of ["예정", "예상치", "(옅음)", "지급금액", "작년 지급 기록"]) expect(html, w).not.toContain(w);
    const src = readFileSync(join(__dirname, "../dividend-chart.tsx"), "utf8") + readFileSync(join(__dirname, "../monthly-dividend-stocks.tsx"), "utf8");
    for (const w of ["예정", "예상치", "(옅음)", "지급금액", "작년 지급 기록", "formatShortCurrency(actual)", "formatShortCurrency(total)"]) expect(src, w).not.toContain(w);
    for (const w of [
      "지급일이 지난 배당은 지급, 아직이면 예상이에요.",
      "예상분은 최근 지급액과 지급 주기로 추정한 값이라 실제와 다를 수 있어요. 투입 대비 배당은 평단이 없거나 엔화인 종목을 뺀 값이에요.",
      "표의 최근 1주당은 가장 최근 지급 1회 값이고, 금액은 지급마다 그때 1주당 × 그날 가진 수량을 더해요.",
      "해외 종목은 현지 기준일을 지급일로 보고 오늘 환율로 계산해요. 실제 입금은 한 달쯤 늦을 수 있어요.",
    ]) expect(src, w).toContain(w);
  });
  it("Hero 예상만 달 배지 `예상` 점선", () => {
    setup([stock({})], [pay(1, 100), pay(12, 100, true)]);
    // 월 선택은 내부 상태라 SSR로 열 수 없다 — 배지 마크업은 소스로 고정
    const src = readFileSync(join(__dirname, "../dividend-chart.tsx"), "utf8");
    expect(src).toMatch(/data-testid="dividend-hero-expected"[^>]*border-dashed border-muted-foreground[^>]*>\s*예상\s*</);
    expect(src).toMatch(/data-testid="dividend-hero-mixed"[^>]*border-dashed border-muted-foreground[^>]*>\s*일부 예상\s*</);
    expect(src).toMatch(/<span>\{month\} 배당<\/span>/);
  });
});
