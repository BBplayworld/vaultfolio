// #329(5.166) 받은 배당 기록 — 결론 줄 셋째 자리 3상태·계산값 불변·문자열 합(C150)·입금 폼 결선(소스 고정)
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import type { AssetData, Stock } from "@/types/asset";
import { computeDividends } from "@/lib/finance/dividend-calc";
import type { DividendPayoutResult } from "@/lib/finance/finance-service";
import { sumReceivedDividend } from "@/lib/finance/received-dividend";
import { formatPriceByMode } from "@/lib/number-utils";

const ctx = vi.hoisted(() => ({ assetData: {} as unknown, tags: {} as Record<string, unknown>, dividend: {} as unknown }));
vi.mock("@/contexts/asset-data-context", () => ({ useAssetData: () => ({ assetData: ctx.assetData, exchangeRates: { USD: 1400, JPY: 900 } }) }));
vi.mock("@/hooks/use-cash-tx-tags", () => ({ useDividendTags: () => ctx.tags }));
vi.mock("../use-dividend-data", async (importOriginal) => ({ ...(await importOriginal<typeof import("../use-dividend-data")>()), useDividendData: () => ctx.dividend }));

import { DividendCard } from "../dividend-chart";
import { buildDividendGroups } from "../use-dividend-data";

const TODAY = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
const YEAR = TODAY.slice(0, 4);
const stock = (o: Partial<Stock> = {}): Stock =>
  ({ id: "A", category: "domestic", name: "삼성", ticker: "005930", quantity: 100, averagePrice: 50_000, currentPrice: 60_000, currency: "KRW", purchaseDate: "2020-01-02", ...o }) as Stock;
const pay = (d: string, a: number, est = false) => ({ payoutDate: d, amountPerShare: a, isEstimated: est }) as DividendPayoutResult;
const cash = { id: "k1", type: "bank", name: "예금", balance: 1_000_000, currency: "KRW" };
type Tx = AssetData["cashTransactions"][number];
const dep = (id: string, amount: number, date: string, over: Partial<Tx> = {}): Tx =>
  ({ id, cashId: "k1", type: "deposit", amount, currency: "KRW", date, reflected: true, createdAt: `${date}T00:00:00.000Z`, ...over }) as Tx;
const BOTH = [pay(`${YEAR}-01-15`, 100), pay(`${YEAR}-12-31`, 50, true)];

function render({ stocks = [stock()], payouts = BOTH, accounts = [cash], txs = [] as Tx[], tagged = [] as string[] }) {
  const { grouped, jpyCount } = buildDividendGroups(stocks);
  const groups = grouped.map((g) => ({ ...g, payouts, isLoading: false }));
  const calc = computeDividends(groups.flatMap((g) => g.items.map((s) => ({ stock: s, payouts }))), [], 1400, TODAY);
  ctx.dividend = { groups, calc, isLoading: false, loadedCount: groups.length, failedCount: 0, totalCount: groups.length, jpyCount };
  ctx.assetData = { stocks, transactions: [], cash: accounts, cashTransactions: txs };
  ctx.tags = Object.fromEntries(tagged.map((id) => [id, { kind: "dividend" }]));
  return renderToStaticMarkup(<DividendCard />);
}
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const num = (t: string) => Number(t.replace(/[^\d]/g, ""));
const chip = (html: string) => html.match(/<button[^>]*data-testid="dividend-received"[^>]*>.*?<\/button>/)?.[0] ?? null;
const TXS = [dep("ctx_1", 50_000, `${YEAR}-11-20`), dep("ctx_2", 30_000, `${YEAR}-10-15`, { reflected: false })];

describe("결론 줄 셋째 자리 — 언제나 1개", () => {
  it("올해 받은 기록 합계 > 0: 칩 `받은 기록 N`(반영 + 기록만 합), 다음 지급은 보이지 않는다", () => {
    const html = render({ txs: TXS, tagged: ["ctx_1", "ctx_2"] });
    const c = chip(html)!;
    expect(c).toContain('data-state="sum"');
    expect(c).toContain('data-received="80000"');
    expect(text(c)).toBe(`받은 기록 ${formatPriceByMode(80_000)}`);
    expect(c).toContain(`aria-label="받은 기록 ${formatPriceByMode(80_000)}, 받은 배당 적기"`);
    expect(html).not.toContain("dividend-conclusion-next");
    expect(html).not.toContain("다음 지급");
    // 순서: 지급 · 예상 · 받은 기록
    const order = ["dividend-conclusion-paid", "dividend-conclusion-expected", "dividend-conclusion-received"].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("기록 0 · 현금 계좌 1개 이상: 칩 `받은 배당 적기`, 다음 지급은 보이지 않는다", () => {
    const html = render({ txs: TXS, tagged: [] }); // 표시 없는 입금은 세지 않는다
    const c = chip(html)!;
    expect(c).toContain('data-state="empty"');
    expect(text(c)).toBe("받은 배당 적기");
    expect(c).not.toContain("aria-label");
    expect(html).not.toContain("dividend-conclusion-next");
  });

  it("기록 0 · 현금 계좌 0: 현행 `다음 지급 M월 K종목` 유지, 칩 없음", () => {
    const html = render({ accounts: [] });
    expect(chip(html)).toBeNull();
    expect(html).toContain('data-testid="dividend-conclusion-next"');
    expect(text(html)).toContain("다음 지급");
  });

  it("계산 합계 0 · 기록만 있음: Hero 없이 `올해 받은 기록 N` 칩 혼자. 기록도 0이면 아무것도 없다", () => {
    const solo = render({ payouts: [], txs: TXS, tagged: ["ctx_1"] });
    expect(solo).toContain('data-testid="dividend-received-solo"');
    expect(text(chip(solo)!)).toBe(`올해 받은 기록 ${formatPriceByMode(50_000)}`);
    expect(solo).not.toContain("dividend-hero-label");
    const none = render({ payouts: [], txs: TXS, tagged: [] });
    expect(none).not.toContain("dividend-received");
  });

  it("O-1: 계산 0 · 기록 있음이면 빈 상태 첫 줄 `올해 배당이 아직 없어요`를 그리지 않는다(둘째 줄·상자는 그대로). 기록 없음은 현행 두 줄", () => {
    const withRecord = render({ payouts: [], txs: TXS, tagged: ["ctx_1"] });
    expect(withRecord).toContain("올해 받은 기록");
    expect(withRecord).not.toContain("올해 배당이 아직 없어요");
    expect(withRecord).toContain("보유 종목에서 올해 받을 배당이 없어요");
    expect(withRecord).toContain("flex h-48 items-center justify-center rounded-lg border border-dashed");
    const noRecord = render({ payouts: [], txs: TXS, tagged: [] });
    expect(noRecord).toContain("올해 배당이 아직 없어요");
    expect(noRecord).toContain("보유 종목에서 올해 받을 배당이 없어요");
    expect(noRecord).toContain("flex h-48 items-center justify-center rounded-lg border border-dashed");
    // 엔화만 있는 사용자: 둘째 줄은 엔화 안내 그대로
    const jpy = render({ stocks: [stock({ currency: "JPY", ticker: "7203", category: "foreign" })], payouts: [], txs: TXS, tagged: ["ctx_1"] });
    expect(jpy).not.toContain("올해 배당이 아직 없어요");
    expect(jpy).toContain("엔화 종목 1개는 배당 조회 안 됨");
  });

  it("칩은 중립 면만 쓴다(주황·손익색·brand 면 0) — 줄 높이와 같은 높이, 히트영역 확장", () => {
    const c = chip(render({ txs: TXS, tagged: ["ctx_1"] }))!;
    expect(c).toContain("bg-secondary");
    expect(c).toContain("h-[1lh]");
    expect(c).toContain("after:-inset-y-2.5");
    expect(c).not.toMatch(/important|rose|red-|blue-|emerald|amber|bg-brand|text-brand/);
  });
});

describe("섞지 않는다 — 기록 전후로 계산값(Hero·지급·예상) 불변", () => {
  it("Hero 금액·data-paid·data-expected·지급/예상 문자열이 같다", () => {
    const pick = (html: string) => ({
      attrs: html.match(/data-testid="dividend-conclusion"[^>]*data-paid="(\d+)" data-expected="(\d+)"/)!.slice(1),
      hero: html.match(/<p class="text-2xl[^>]*>([^<]*)</)![1],
      paid: text(html.match(/data-testid="dividend-conclusion-paid"[^>]*>(.*?)<\/span>\s*<\/span>/)![0]),
      yield: html.match(/data-testid="dividend-yield-value"[^>]*>([^<]*)</)?.[1],
    });
    const before = pick(render({}));
    const after = pick(render({ txs: TXS, tagged: ["ctx_1", "ctx_2"] }));
    expect(after).toEqual(before);
    expect(num(before.hero)).toBeGreaterThan(0);
  });
});

describe("C150 — 12개 달 표시 문자열의 합 = 연 합계 표시 문자열", () => {
  it("외화·소수 입금이 섞여도 달별 표시 금액을 더하면 연 합계 표시 금액이다(같은 포맷터)", () => {
    const txs = [
      dep("ctx_a", 10.25, `${YEAR}-03-02`, { currency: "USD" }), dep("ctx_b", 0.333, `${YEAR}-03-09`, { currency: "USD" }),
      dep("ctx_c", 1_234, `${YEAR}-06-01`, { currency: "JPY" }), dep("ctx_d", 49_999, `${YEAR}-06-20`),
      dep("ctx_e", 7.777, `${YEAR}-09-30`, { currency: "USD" }), dep("ctx_f", 123_456, `${YEAR}-12-01`, { reflected: false }),
    ];
    const tags = Object.fromEntries(txs.map((t) => [t.id, {}]));
    const r = sumReceivedDividend(txs, tags, Number(YEAR), (c) => (c === "USD" ? 1400 : c === "JPY" ? 9 : 1));
    expect(r.months.reduce((s, m) => s + num(formatPriceByMode(m)), 0)).toBe(num(formatPriceByMode(r.annual)));
    // 화면의 연 합계 칩도 같은 값
    const html = render({ txs, tagged: txs.map((t) => t.id) });
    expect(chip(html)!).toContain(`data-received="${r.annual}"`);
    expect(text(chip(html)!)).toBe(`받은 기록 ${formatPriceByMode(r.annual)}`);
  });
});

describe("결선(소스 고정)", () => {
  const read = (p: string) => readFileSync(resolve(__dirname, p), "utf8");
  it("칩은 화면 이동 없이 기존 입금 폼 이벤트를 dividend로 연다. 새 라우트·목록 0", () => {
    const src = read("../dividend-chart.tsx");
    expect(src).toContain("dispatchAddCashTx(undefined, { dividend: true })");
    expect(src).not.toMatch(/router\.push|navigate\(/);
    expect(read("../../../layout/navigation/asset-dispatch.ts")).toContain('detail: opts?.dividend ? { cashId, dividend: true } : { cashId }');
  });

  it("입금 폼: 배당은 입금에서만, 정기와 상호 배타·비활성, 중복 확인을 거쳐도 표시가 실린다", () => {
    const src = read("../../../forms/asset-update/input/cash-tx-input.tsx");
    expect(src).toContain('disabled={dividend}');                              // 정기 체크 비활성(숨기지 않는다)
    expect(src).toContain('checked={!dividend && recurring}');
    expect(src).toContain('if (on) form.setValue("recurring", false);');
    expect(src).toContain('recurring: data.type === "deposit" ? (dividend ? false : data.recurring) : undefined'); // 저장 recurring은 false
    expect(src).toContain('field.onChange("withdrawal"); toggleDividend(false);'); // 출금으로 바꾸면 false
    expect(src).toContain("setDupPending({ tx, cash, tag });");
    expect(src).toContain("commit(dupPending.tx, dupPending.cash, dupPending.tag)");
    expect(src).toContain('dupPending.tag ? "배당 입금"');
    expect(src).toContain('toast.success(tag ? "배당 입금을 기록했어요"');
    // GA는 category만
    expect(src).toContain('if (tag) track("feature_use", { category: "cash_dividend" });');
    // 현금 거래 레코드에 새 필드를 쓰지 않는다 — buildTx가 만드는 키 고정
    const build = src.slice(src.indexOf("const buildTx"), src.indexOf("// 반영 시 계좌 잔액 패치"));
    expect([...build.matchAll(/^\s{6}(\w+):/gm)].map((m) => m[1])).toEqual(["id", "cashId", "type", "amount", "currency", "recurring", "date", "memo", "reflected", "reflectedAt", "reflectionId", "createdAt"]);
  });

  it("ui-review R1~R3: 정기 상자는 label 단위로 두 상태를 겹치고, 결론 줄 clip 왼쪽은 5px, 종목 Select 히트는 ±3px", () => {
    const form = read("../../../forms/asset-update/input/cash-tx-input.tsx");
    const label = form.slice(form.indexOf('<label htmlFor="cash-tx-recurring"'), form.indexOf("</label>", form.indexOf('<label htmlFor="cash-tx-recurring"')));
    expect(label).toContain("grid min-h-10 min-w-0 flex-1 items-center leading-none [&>*]:[grid-area:1/1]");
    expect(label.match(/매월 정기 입금 \(월급·목돈\)/g)).toHaveLength(2);             // 보이는 묶음 + 자리 묶음
    expect(label).toContain('<span aria-hidden className="invisible flex flex-col">'); // 자리 묶음은 읽히지 않는다
    expect(label.match(/id="cash-tx-recurring-help"/g)).toHaveLength(1);              // 도움말 id는 보이는 쪽 1개
    expect(label).toContain("{dividend ? RECURRING_HELP_OFF : RECURRING_HELP_ON}");
    expect(label).toContain("{dividend ? RECURRING_HELP_ON : RECURRING_HELP_OFF}");
    expect(form).toContain('const RECURRING_HELP_OFF = "배당을 끄면 선택할 수 있어요";');
    expect(form).toContain("after:-inset-y-[3px]");
    expect(form).not.toContain("after:-inset-y-0.5");
    const chart = read("../dividend-chart.tsx");
    expect(chart).toContain('const CONCLUSION_ROW = "-ml-2 [clip-path:inset(-0.625rem_-100vw_-0.625rem_0.3125rem)]";');
    // 공용 상수는 그대로
    expect(read("../../../layout/ui/dot-wrap.tsx")).toContain('export const DOT_WRAP_ROW = "-ml-2 [clip-path:inset(-2px_-100vw_-2px_0.5rem)]";');
  });

  it("거래 행: 배지 글자는 `배당` 고정(면), 종목명은 날짜 아래 줄", () => {
    const src = read("../../detail/cash-tx/cash-tx-view.tsx");
    expect(src).toMatch(/data-testid="tx-dividend-badge" variant="secondary"[^>]*>배당<\/Badge>/);
    const date = src.indexOf('<span className="whitespace-nowrap">{t.date}</span>');
    const line = src.indexOf('data-testid="tx-dividend-stock"');
    expect(date).toBeGreaterThan(0);
    expect(line).toBeGreaterThan(date);
    expect(line).toBeLessThan(src.indexOf("<TxMemo memo={t.memo} />"));
  });
});
