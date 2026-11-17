// #239 [5.125] 인사이트 4종 — 요약 영역 연결 문장(배당 몫·올해 결산 3갈래)의 순수 계산(AC-39~42·45)
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { buildDividendLink, buildSettleLink, isBoughtThisYear, keepLabelKeys } from "../asset/grow-links";
import { buildGrowRows, sortGrowRowKeys } from "../asset/grow-rows";
import { parseStockLabels, type StockLabels } from "../asset/stock-labels";
import { materializeDemo } from "../preview/demo-payload";
import { assetDataSchema } from "@/types/asset";

const NOW = Date.parse("2026-11-17T03:00:00Z");
const RATES = { USD: 1400, JPY: 9 };
const T = (d: string) => `${d}T03:00:00.000Z`;
const st = (o: Partial<Stock> & { id: string }): Stock => ({
  category: "domestic", name: o.id, ticker: "", quantity: 1, averagePrice: 100, currentPrice: 100, currency: "KRW", purchaseDate: "2024-01-01", ...o,
} as Stock);
const labelsOf = (keep: string[], check: string[] = []): StockLabels => ({
  v: 1, cycle: { months: null, at: "" },
  items: Object.fromEntries([...keep.map((t) => [t, { label: "keep", labeledAt: T("2026-10-01"), at: T("2026-10-01") }]), ...check.map((t) => [t, { label: "check", labeledAt: T("2026-10-01"), at: T("2026-10-01") }])]),
} as StockLabels);
const refs = (o: Record<string, number | null>): ProfitRefResponse =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? null : { refPrice: v, refDate: "2025-12-30" }]));
const ready = (o: Record<string, number | null>) => ({ refs: refs(o), status: "ready" as const });

describe("keepLabelKeys", () => {
  it("'오래 둘 자산'만 — '점검할'·'정하지 않음' 표식은 들지 않는다", () => {
    const v = parseStockLabels({ v: 1, cycle: {}, items: { A: { label: "keep", labeledAt: "2026-01-01", at: "2026-01-01" }, B: { label: "check", labeledAt: "2026-01-01", at: "2026-01-01" }, C: { label: null, labeledAt: "2026-01-01", at: "2026-01-01" } } })!;
    expect([...keepLabelKeys(v)]).toEqual(["A"]);
  });
});

describe("배당 몫(AC-39) — 올해 예상 배당 중 오래 둘 자산 몫", () => {
  const input = (over: Record<string, unknown> = {}) => ({ annualTotal: 1000, byLabelKey: new Map([["AAA", 333.4], ["BBB", 666.6]]), isLoading: false, failedCount: 0, ...over });
  const keep = new Set(["AAA"]);
  it("분모 = 키별 금액의 합 = 배당 카드 금액(반올림 전 합을 반올림한 값)", () => {
    const i = input();
    const sum = [...i.byLabelKey.values()].reduce((a, b) => a + b, 0);
    expect(Math.round(sum)).toBe(i.annualTotal);
    expect(buildDividendLink(i, keep)).toEqual({ state: "shown", pct: 33, text: "33%" });
  });
  it("분자 0·분모 양수 → 0%, 전부 '오래 둘' → 100%", () => {
    expect(buildDividendLink(input(), new Set(["ZZZ"]))).toMatchObject({ state: "shown", text: "0%" });
    expect(buildDividendLink(input(), new Set(["AAA", "BBB"]))).toMatchObject({ state: "shown", text: "100%" });
  });
  it("조회 중 → loading, 조회 실패 1건 이상 → none(조회 중이어도), 분모 0 → none, '오래 둘' 0개 → none, 입력 없음 → none", () => {
    expect(buildDividendLink(input({ isLoading: true }), keep)).toEqual({ state: "loading" });
    expect(buildDividendLink(input({ failedCount: 1 }), keep)).toEqual({ state: "none" });
    expect(buildDividendLink(input({ failedCount: 1, isLoading: true }), keep)).toEqual({ state: "none" });
    expect(buildDividendLink(input({ annualTotal: 0, byLabelKey: new Map() }), keep)).toEqual({ state: "none" });
    expect(buildDividendLink(input(), new Set())).toEqual({ state: "none" });
    expect(buildDividendLink(undefined, keep)).toEqual({ state: "none" });
  });
  it("결과에 금액이 없다", () => {
    expect(JSON.stringify(buildDividendLink(input(), keep))).not.toMatch(/333|666|1000/);
  });
});

describe("'올해 편입' 판정 — 매수일 1월 2일 이후 ~ 오늘, 보유 건마다", () => {
  const today = "2026-11-17";
  it.each([
    ["2026-01-02", true], ["2026-06-30", true], ["2026-11-17", true],
    ["2026-01-01", false],   // 등록 화면 기본값 — 휴장일이라 실제 매수일이 아니다
    ["2025-12-31", false], ["2026-11-18", false], ["2027-01-05", false],
    ["", false], [undefined, false], ["2026/03/01", false], ["작년", false],
  ])("%s → %s", (d, expected) => expect(isBoughtThisYear(d as string | undefined, today)).toBe(expected));
});

describe("올해 결산 몫(AC-40) — 지금 수량 × (지금 시세 − 기준) × 지금 환율", () => {
  // 연초 전 보유: A(오래 둘) 10주 100 → 150 = +500 / B 10주 100 → 200 = +1000
  const A = st({ id: "a", ticker: "AAA", quantity: 10, currentPrice: 150 });
  const B = st({ id: "b", ticker: "BBB", quantity: 10, currentPrice: 200 });
  const keep = new Set(["AAA"]);
  const run = (stocks: Stock[], r: Record<string, number | null>, k = keep) => buildSettleLink(stocks, RATES, k, ready(r), NOW);
  it("불어난 해: 0~100%", () => {
    expect(run([A, B], { AAA: 100, BBB: 100 })).toEqual({ state: "shown", kind: "up", pct: 33, excluded: 0 });
    expect(run([A, B], { AAA: 100, BBB: 100 }, new Set(["AAA", "BBB"]))).toMatchObject({ kind: "up", pct: 100 });
    expect(run([A, B], { AAA: 150, BBB: 100 })).toMatchObject({ kind: "up", pct: 0 }); // 오래 둘 변동 0
  });
  it("줄어든 해: 분모·분자 모두 음수면 같은 꼴", () => {
    expect(run([A, B], { AAA: 200, BBB: 300 })).toEqual({ state: "shown", kind: "down", pct: 33, excluded: 0 }); // −500 / −1500
  });
  it("부호가 섞이거나 100%를 넘으면 비율을 말하지 않는다", () => {
    expect(run([A, B], { AAA: 200, BBB: 100 })).toEqual({ state: "shown", kind: "mixed", pct: null, excluded: 0 });  // −500 / +500
    expect(run([A, B], { AAA: 100, BBB: 220 })).toMatchObject({ kind: "mixed" });                                      // +500 / +300 → 167%
    expect(run([A, B], { AAA: 200, BBB: 180 })).toMatchObject({ kind: "mixed" });                                      // −500 / −300
  });
  it("매수일이 올해인 보유 건은 기준 시세 대신 내 매입가(평단)", () => {
    const bought = st({ id: "a", ticker: "AAA", quantity: 10, currentPrice: 150, averagePrice: 140, purchaseDate: "2026-06-01" }); // +100
    expect(run([bought, B], { AAA: 100, BBB: 100 })).toMatchObject({ kind: "up", pct: 9 }); // 100 / 1100
    // 기준가가 없어도 올해 편입이면 계산된다
    expect(run([bought, B], { AAA: null, BBB: 100 })).toMatchObject({ kind: "up", pct: 9, excluded: 0 });
  });
  it("같은 종목의 작년 보유 건 + 올해 보유 건은 건마다 기준이 다르게 계산돼 합산된다", () => {
    const old = st({ id: "a1", ticker: "AAA", quantity: 10, currentPrice: 150 });                                                   // 기준 100 → +500
    const fresh = st({ id: "a2", ticker: "AAA", category: "isa", quantity: 10, currentPrice: 150, averagePrice: 130, purchaseDate: "2026-03-02" }); // 평단 130 → +200
    expect(run([old, fresh, B], { AAA: 100, BBB: 100 })).toMatchObject({ kind: "up", pct: 41 }); // 700 / 1700
  });
  it("매수일 없음·형식 오류·미래·1월 1일(기본값)은 연초 전 보유로 계산한다", () => {
    for (const purchaseDate of ["", "어제", "2027-02-01", "2026-01-01"]) {
      const s = st({ id: "a", ticker: "AAA", quantity: 10, currentPrice: 150, averagePrice: 149, purchaseDate });
      expect(run([s, B], { AAA: 100, BBB: 100 }), purchaseDate).toMatchObject({ kind: "up", pct: 33 });
    }
  });
  it("연중 추가 매수는 보정하지 않는다 — 지금 수량 전부를 같은 기준으로", () => {
    const more = st({ id: "a", ticker: "AAA", quantity: 30, currentPrice: 150 }); // +1500
    expect(run([more, B], { AAA: 100, BBB: 100 })).toMatchObject({ kind: "up", pct: 60 });
  });
  it("외화 종목은 지금 환율로 환산한다", () => {
    const usd = st({ id: "u", ticker: "USA", category: "foreign", currency: "USD", quantity: 1, currentPrice: 110 }); // +10달러 × 1400 = 14,000
    const krw = st({ id: "k", ticker: "KOR", quantity: 1, currentPrice: 14_100 });                                   // +14,000
    expect(buildSettleLink([usd, krw], RATES, new Set(["USA"]), ready({ USA: 100, KOR: 100 }), NOW)).toMatchObject({ kind: "up", pct: 50 });
    expect(buildSettleLink([usd, krw], { USD: 700, JPY: 9 }, new Set(["USA"]), ready({ USA: 100, KOR: 100 }), NOW)).toMatchObject({ kind: "up", pct: 33 });
  });
  it("가져온 날이 매수일로 들어간 형태(올해 등록·오래 가진 종목)는 '올해 편입'으로 잡힌다 — 알려진 한계 값 고정", () => {
    const imported = st({ id: "a", ticker: "AAA", quantity: 10, currentPrice: 150, averagePrice: 60, purchaseDate: "2026-09-10" }); // 평단부터 +900
    expect(run([imported, B], { AAA: 100, BBB: 100 })).toMatchObject({ kind: "up", pct: 47 }); // 900 / 1900 (기준 시세였다면 33%)
  });
  it("비상장·상장폐지·티커 없는 종목은 대상이 아니다", () => {
    const extra = [st({ id: "x", ticker: "UNL", category: "unlisted", currentPrice: 999 } as never), st({ id: "y", ticker: "DEAD", currentPrice: 0, inactiveStatus: "delisted" } as never), st({ id: "z", ticker: "", currentPrice: 500 })];
    expect(run([A, B, ...extra], { AAA: 100, BBB: 100 })).toMatchObject({ kind: "up", pct: 33, excluded: 0 });
  });
  it("기준 가격이 없는 종목은 분자·분모에서 빼고 종목 수를 돌려준다(문장은 숨기지 않는다)", () => {
    const J = st({ id: "j", ticker: "7203", category: "foreign", currency: "JPY", quantity: 100, currentPrice: 3000 });
    const J2 = st({ id: "j2", ticker: "7203", category: "foreign", currency: "JPY", quantity: 5, currentPrice: 3000 });
    expect(run([A, B, J, J2], { AAA: 100, BBB: 100, "7203": null })).toEqual({ state: "shown", kind: "up", pct: 33, excluded: 1 }); // 같은 종목 두 건은 1종목
  });
  it("문장이 없는 경우: '오래 둘' 0개, 조회 실패, 지금 시세 없는 종목, 분모 0, 전부 기준가 없음, '오래 둘'이 전부 빠짐, 입력 없음", () => {
    expect(run([A, B], { AAA: 100, BBB: 100 }, new Set())).toEqual({ state: "none" });
    expect(buildSettleLink([A, B], RATES, keep, { refs: refs({ AAA: 100, BBB: 100 }), status: "failed" }, NOW)).toEqual({ state: "none" });
    expect(run([A, B, st({ id: "n", ticker: "NOP", currentPrice: 0 })], { AAA: 100, BBB: 100, NOP: 100 })).toEqual({ state: "none" });
    expect(run([A, B], { AAA: 150, BBB: 200 })).toEqual({ state: "none" }); // 연초 첫 거래일 전: 기준 = 지금
    expect(run([A, B], { AAA: null, BBB: null })).toEqual({ state: "none" });
    expect(run([A, B], { AAA: null, BBB: 100 })).toEqual({ state: "none" });
    expect(buildSettleLink([A, B], RATES, keep, undefined, NOW)).toEqual({ state: "none" });
  });
  it("조회 중·일부만 받은 상태는 loading", () => {
    expect(buildSettleLink([A, B], RATES, keep, { refs: undefined, status: "loading" }, NOW)).toEqual({ state: "loading" });
    expect(buildSettleLink([A, B], RATES, keep, { refs: refs({ AAA: 100 }), status: "ready" }, NOW)).toEqual({ state: "loading" });
  });
  it("결과에 금액이 없다(%·종목 수뿐)", () => {
    expect(Object.keys(run([A, B], { AAA: 100, BBB: 100 })).sort()).toEqual(["excluded", "kind", "pct", "state"]);
  });
});

describe("저장·전송 0(AC-42·46)", () => {
  const src = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
  it("연결 문장·행 인사이트 모듈은 저장소·네트워크·GA를 쓰지 않는다", () => {
    for (const f of ["asset/grow-links.ts", "asset/grow-rows.ts"]) {
      expect(src(f), f).not.toMatch(/localStorage|sessionStorage|fetch\(|track\(|indexedDB/);
    }
  });
  it("기준 시세는 기존 ytd 조회를 쓴다 — 요청에 실리는 것은 종목코드 목록·기간·종가 기준뿐", () => {
    const view = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/activity/asset-report-view.tsx"), "utf8");
    expect(view).toContain('fetchProfitRef(tickerList, "ytd", {');
    expect(view).not.toContain("price-history");
    const call = view.slice(view.indexOf('fetchProfitRef(tickerList, "ytd"'), view.indexOf("});", view.indexOf('fetchProfitRef(tickerList, "ytd"')));
    expect(call).not.toMatch(/quantity|averagePrice|purchaseDate|labels|stockLabels/);
  });
  it("GA: 4종 표시로 새 전송이 없다 — 불리기 블록의 전송은 '다시 봄' 1개 그대로", () => {
    const block = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/activity/stock-label-block.tsx"), "utf8");
    expect(block.match(/track\(/g)).toHaveLength(1);
    const ga = src("analytics/ga.ts");
    expect(ga.match(/grow_\w+:/g)).toEqual(["grow_label:", "grow_check:", "grow_revisit:"]);
  });
});

describe("데모 시드(AC-45) — 조작 없이 처음 3행 안에 4종이 보인다", () => {
  const raw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
  it.each(["2026-11-17", "2026-03-10", "2027-01-31"])("기준일 %s", (today) => {
    const payload = materializeDemo(raw, today) as { assetData: unknown; stockLabels: unknown };
    const data = assetDataSchema.parse(payload.assetData);
    const labels = parseStockLabels(payload.stockLabels)!;
    const now = Date.parse(`${today}T03:00:00Z`);
    // 데모는 실시간 시세로 덮이지만 비중 순서는 시드와 같다고 본다(SK하이닉스 > TIGER) — 운영 시세 수준으로 맞춰 확인
    const stocks = data.stocks.map((s) => (s.ticker === "000660" ? { ...s, currentPrice: 1_000_000 } : s));
    const rows = buildGrowRows(stocks, RATES, labels, now, data.transactions);
    const by = new Map(rows.map((r) => [r.key, r]));
    const top3 = sortGrowRowKeys(rows).slice(0, 3).map((k) => by.get(k)!);
    expect(top3.map((r) => r.ticker).sort()).toEqual(["000660", "005930", "AAPL"]);
    expect(top3.every((r) => r.priceFact?.state === "value")).toBe(true);                 // 정한 날 가격 대비
    expect(top3.map((r) => r.qtyFact!.state).sort()).toEqual(["changed", "same", "same"]); // → 1행, 그대로 2행
    const counts = Object.fromEntries(top3.map((r) => [r.ticker, r.tradeCount]));
    expect(counts["000660"]).toBe(0);                                                      // 0건 행
    expect(counts.AAPL).toBeGreaterThanOrEqual(1);                                         // 1건 이상 행
    expect([...keepLabelKeys(labels)].sort()).toEqual(["005930", "360750"]);
  });
});
