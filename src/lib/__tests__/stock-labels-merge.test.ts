// #239 [5.125] 내 자산 불리기 — 이름표 저장 형태·병합·편집(순수 함수)과 화면 표시 값(기간 표기·행·정렬·접힘).
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import {
  countValidLabels, emptyStockLabels, hasStockLabelRecords, markStockChecked, mergeStockLabels, parseStockLabels, sameStockLabels,
  isStockLabelRevisit, setStockLabel, setStockLabelCycle, STOCK_LABEL_EXTRA_LIMIT, type StockLabels,
} from "../asset/stock-labels";
import {
  buildGrowRows, buildLabelBase, collapsedGrowRowKeys, elapsedSince, formatAgo, formatQty, formatSince, growTotals, qtyByLabelKey, sortGrowRowKeys,
  summarizeGrowRows,
} from "../asset/grow-rows";
import { computeStockMetrics, groupStocksByTicker, mergeStockGroup } from "@/app/(main)/_components/views/detail/asset-detail-tabs";

const T = (d: string) => `${d}T03:00:00.000Z`;
const mk = (items: StockLabels["items"], cycle: StockLabels["cycle"] = { months: null, at: "" }): StockLabels => ({ v: 1, cycle, items });
const keep = (at: string) => ({ label: "keep" as const, labeledAt: at, at });
const check = (at: string, checkedAt?: string) => ({ label: "check" as const, labeledAt: at, ...(checkedAt ? { checkedAt } : {}), at: checkedAt ?? at });
const none = (at: string) => ({ label: null, labeledAt: at, at });

describe("parseStockLabels — 완화 파싱", () => {
  it("정상 값은 그대로, 날짜만 있는 문자열도 읽는다(데모 시드)", () => {
    const v = { v: 1, cycle: { months: 3, at: "2026-03-01" }, items: { AAPL: { label: "check", labeledAt: "2026-03-01", checkedAt: "2026-07-15", at: "2026-07-15" } } };
    expect(parseStockLabels(v)).toEqual(v);
  });
  it.each([
    ["null", null], ["배열", []], ["문자열", "x"], ["v 불일치", { v: 2, items: {} }], ["items 없음", { v: 1 }], ["items 비객체", { v: 1, items: [] }],
  ])("%s → null", (_n, v) => expect(parseStockLabels(v)).toBeNull());
  it("잘못된 항목만 빠진다: 티커 키·label·시각", () => {
    const r = parseStockLabels({
      v: 1, cycle: { months: 5, at: T("2026-01-01") },
      items: {
        "005930": keep(T("2026-01-01")),
        "": keep(T("2026-01-01")),
        "has space": keep(T("2026-01-01")),
        "__proto__x": keep(T("2026-01-01")),
        BAD1: { label: "buy", labeledAt: T("2026-01-01"), at: T("2026-01-01") },
        BAD2: { label: "keep", labeledAt: "어제", at: T("2026-01-01") },
        BAD3: { label: "keep", labeledAt: T("2026-01-01") },
        "BRK/B": { ...none(T("2026-01-02")), memo: "저장하지 않는 필드", amount: 1 },
      },
    })!;
    expect(Object.keys(r.items).sort()).toEqual(["005930", "BRK/B"]);
    expect(r.items["BRK/B"]).toEqual({ ...none(T("2026-01-02")), memo: "저장하지 않는 필드", amount: 1 }); // 모르는 필드는 버리지 않고 싣는다(5.125 인사이트 — 다음 버전 필드 보존)
    expect(r.cycle).toEqual({ months: null, at: "" }); // 3·6·12 밖 주기는 미설정
  });
});

describe("mergeStockLabels — 티커별 at 최신 우선(AC-19 ⑤)", () => {
  const a = mk({ AAPL: keep(T("2026-01-01")), NVDA: check(T("2026-02-01")) }, { months: 3, at: T("2026-01-01") });
  const b = mk({ AAPL: check(T("2026-03-01")), "005930": keep(T("2026-02-10")) }, { months: 6, at: T("2026-02-01") });
  it("다른 티커는 합치고 같은 티커는 늦은 쪽, cycle도 늦은 쪽", () => {
    const m = mergeStockLabels(a, b);
    expect(m.items.AAPL.label).toBe("check");
    expect(Object.keys(m.items).sort()).toEqual(["005930", "AAPL", "NVDA"]);
    expect(m.cycle).toEqual({ months: 6, at: T("2026-02-01") });
  });
  it("교환법칙·멱등", () => {
    expect(sameStockLabels(mergeStockLabels(a, b), mergeStockLabels(b, a))).toBe(true);
    expect(sameStockLabels(mergeStockLabels(a, a), a)).toBe(true);
    expect(sameStockLabels(mergeStockLabels(mergeStockLabels(a, b), a), mergeStockLabels(a, b))).toBe(true);
  });
  it("삭제 표식: 더 새 '정하지 않음'이 예전 이름표를 이기고 되살아나지 않는다", () => {
    const old = mk({ AAPL: keep(T("2026-01-01")) });
    const cleared = mk({ AAPL: none(T("2026-02-01")) });
    expect(mergeStockLabels(old, cleared).items.AAPL.label).toBeNull();
    expect(mergeStockLabels(cleared, old).items.AAPL.label).toBeNull();
    // 표식보다 더 새로 붙인 이름표는 이긴다
    expect(mergeStockLabels(cleared, mk({ AAPL: check(T("2026-03-01")) })).items.AAPL.label).toBe("check");
  });
  it("at이 같으면 어느 쪽에서 합쳐도 같은 값(동률 규칙)", () => {
    const x = mk({ AAPL: keep(T("2026-01-01")) }, { months: 3, at: T("2026-01-01") });
    const y = mk({ AAPL: check(T("2026-01-01")) }, { months: 12, at: T("2026-01-01") });
    const xy = mergeStockLabels(x, y);
    expect(sameStockLabels(xy, mergeStockLabels(y, x))).toBe(true);
  });
  it("주기 미설정(at 빈 값)은 설정된 쪽에 진다", () => {
    expect(mergeStockLabels(emptyStockLabels(), a).cycle.months).toBe(3);
    expect(mergeStockLabels(a, emptyStockLabels()).cycle.months).toBe(3);
  });
});

describe("편집 함수", () => {
  it("이름표 붙이기·바꾸기·되돌리기, 같은 값이면 같은 객체", () => {
    let s = emptyStockLabels();
    s = setStockLabel(s, "AAPL", "keep", T("2026-01-01"));
    expect(s.items.AAPL).toEqual(keep(T("2026-01-01")));
    expect(setStockLabel(s, "AAPL", "keep", T("2026-01-05"))).toBe(s);
    s = setStockLabel(s, "AAPL", null, T("2026-01-10"));
    expect(s.items.AAPL).toEqual(none(T("2026-01-10"))); // 지우지 않고 표식
    expect(countValidLabels(s)).toBe(0);
    expect(hasStockLabelRecords(s)).toBe(true);
  });
  it("한 번도 고르지 않은 종목에 '정하지 않음'을 눌러도 표식이 남는다(AC-6c)", () => {
    const s = setStockLabel(emptyStockLabels(), "NVDA", null, T("2026-01-01"));
    expect(s.items.NVDA.label).toBeNull();
  });
  it("점검은 '점검할 자산'만, 이름표를 바꿔도 점검 기록은 남는다", () => {
    let s = setStockLabel(emptyStockLabels(), "AAPL", "keep", T("2026-01-01"));
    expect(markStockChecked(s, "AAPL", T("2026-01-02"))).toBe(s);
    expect(markStockChecked(s, "NONE", T("2026-01-02"))).toBe(s);
    s = setStockLabel(s, "AAPL", "check", T("2026-01-03"));
    s = markStockChecked(s, "AAPL", T("2026-02-03"));
    expect(s.items.AAPL).toMatchObject({ label: "check", labeledAt: T("2026-01-03"), checkedAt: T("2026-02-03"), at: T("2026-02-03") });
    s = setStockLabel(s, "AAPL", "keep", T("2026-02-04"));
    expect(s.items.AAPL.checkedAt).toBe(T("2026-02-03"));
  });
  it("주기: 고르기·바꾸기, 같은 값이면 같은 객체", () => {
    let s = setStockLabelCycle(emptyStockLabels(), 3, T("2026-01-01"));
    expect(s.cycle).toEqual({ months: 3, at: T("2026-01-01") });
    expect(setStockLabelCycle(s, 3, T("2026-01-02"))).toBe(s);
    s = setStockLabelCycle(s, 12, T("2026-01-03"));
    expect(s.cycle.months).toBe(12);
  });
  it("편집은 입력을 바꾸지 않는다", () => {
    const s = mk({ AAPL: keep(T("2026-01-01")) });
    const copy = JSON.stringify(s);
    setStockLabel(s, "AAPL", "check", T("2026-01-02"));
    setStockLabelCycle(s, 6, T("2026-01-02"));
    expect(JSON.stringify(s)).toBe(copy);
  });
});

describe("기간 표기(AC-6b) — 지난 달력 월 수, KST 날짜", () => {
  const now = Date.parse("2026-11-17T03:00:00Z");
  const ago = (from: string) => formatAgo(elapsedSince(from, now)!);
  const since = (from: string) => formatSince(elapsedSince(from, now)!);
  it("같은 날 오늘 / 29일 전 / 125일 전은 4개월 전 / 14개월 전은 1년 2개월 전", () => {
    expect(ago("2026-11-17T00:10:00Z")).toBe("오늘");
    expect(ago("2026-10-19")).toBe("29일 전");
    expect(ago("2026-07-15")).toBe("4개월 전"); // 125일 전
    expect(ago("2025-09-17")).toBe("1년 2개월 전");
    expect(ago("2025-11-17")).toBe("1년 전"); // 나머지 0
    expect(ago("2026-10-17")).toBe("1개월 전");
    expect(ago("2026-10-18")).toBe("30일 전"); // 날짜가 하루 모자라면 아직 1개월 미만
  });
  it("…한 지 꼴: N일 / N개월 / N년 N개월", () => {
    expect(since("2026-11-16")).toBe("1일");
    expect(since("2026-07-15")).toBe("4개월");
    expect(since("2025-09-17")).toBe("1년 2개월");
    expect(since("2024-11-17")).toBe("2년");
  });
  it("125일 전은 어느 날에도 4개월 전이다(데모 시드 @D-125)", () => {
    for (let i = 0; i < 366; i++) {
      const today = Date.parse("2026-01-01T03:00:00Z") + i * 86_400_000;
      const from = new Date(today - 125 * 86_400_000).toISOString().slice(0, 10);
      expect(formatAgo(elapsedSince(from, today)!)).toBe("4개월 전");
    }
  });
  it("KST 자정 경계: UTC로는 전날이어도 KST 같은 날이면 오늘", () => {
    const n = Date.parse("2026-11-17T16:00:00Z"); // KST 11/18 01:00
    expect(formatAgo(elapsedSince("2026-11-17T15:30:00Z", n)!)).toBe("오늘"); // KST 11/18 00:30
    expect(formatAgo(elapsedSince("2026-11-17T14:30:00Z", n)!)).toBe("1일 전"); // KST 11/17 23:30
  });
  it("읽을 수 없는 시각은 null, 미래 시각은 0으로", () => {
    expect(elapsedSince(undefined, now)).toBeNull();
    expect(elapsedSince("x", now)).toBeNull();
    expect(elapsedSince("2027-01-01", now)).toEqual({ days: 0, months: 0 });
  });
});

const RATES = { USD: 1400, JPY: 9 };
const st = (o: Partial<Stock> & { id: string }): Stock => ({
  category: "domestic", name: o.id, ticker: "", quantity: 1, averagePrice: 100, currentPrice: 100, currency: "KRW", purchaseDate: "2024-01-01", ...o,
} as Stock);
const STOCKS: Stock[] = [
  st({ id: "s1", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 80_000, currentPrice: 60_000 }),          // 60만, 손실
  st({ id: "s2", name: "삼성전자", ticker: "005930", category: "isa", quantity: 10, averagePrice: 50_000, currentPrice: 60_000 }), // 병합 대상
  st({ id: "a1", name: "Apple", ticker: "AAPL", category: "foreign", currency: "USD", quantity: 5, averagePrice: 100, currentPrice: 200, purchaseExchangeRate: 1300 }), // 140만
  st({ id: "n1", name: "NVIDIA", ticker: "NVDA", category: "foreign", currency: "USD", quantity: 1, averagePrice: 100, currentPrice: 150 }), // 21만
  st({ id: "k1", name: "KODEX", ticker: "069500", quantity: 10, averagePrice: 30_000, currentPrice: 35_000 }),            // 35만
  st({ id: "u1", name: "비상장 수동", ticker: "", category: "unlisted", quantity: 1, averagePrice: 500_000, currentPrice: 500_000 }), // 티커 없음
];
const NOW = Date.parse("2026-11-17T03:00:00Z");

describe("buildGrowRows — 전체 탭과 같은 값(AC-4)", () => {
  const rows = buildGrowRows(STOCKS, RATES, emptyStockLabels(), NOW);
  it("티커 없는 종목은 행이 없고, 티커 병합 종목은 1행, 비중 큰 순", () => {
    expect(rows.map((r) => r.ticker)).toEqual(["AAPL", "005930", "069500", "NVDA"]);
    expect(rows.find((r) => r.ticker === "005930")!.groupStockIds).toEqual(["s1", "s2"]);
  });
  it("비중·매입가 대비 문자열 = 전체 탭 계산(computeStockMetrics, 분모에 티커 없는 종목 포함)", () => {
    const total = STOCKS.reduce((s, x) => s + x.quantity * x.currentPrice * (x.currency === "USD" ? RATES.USD : 1), 0);
    const groups = groupStocksByTicker(STOCKS);
    for (const r of rows) {
      const m = computeStockMetrics(mergeStockGroup(groups.get(r.key)!), RATES, total);
      expect(r.weightText).toBe(`${m.pct.toFixed(1)}%`);
      expect(r.rateText).toBe(`${m.profit >= 0 ? "+" : ""}${m.profitRate.toFixed(1)}%`);
    }
    // 원화 병합 종목(손실 1건 + 이익 1건 → 가중 평단 65,000), 외화 종목(매입환율 반영)
    expect(rows.find((r) => r.ticker === "005930")!.rateText).toBe("-7.7%");
    expect(rows.find((r) => r.ticker === "AAPL")!.rateText).toBe("+115.4%");
    const sum = rows.reduce((s, r) => s + parseFloat(r.weightText), 0);
    expect(sum).toBeLessThan(100); // 티커 없는 종목 몫만큼 100%가 안 된다
  });
  it("시세 미조회(현재가 0)는 값만 —", () => {
    const r = buildGrowRows([st({ id: "z", ticker: "ZZZ", currentPrice: 0 })], RATES, emptyStockLabels(), NOW)[0];
    expect([r.weightText, r.rateText]).toEqual(["—", "—"]);
  });
  it("티커 없는 종목만 있으면 행 0(주식 0과 같은 상태)", () => {
    expect(buildGrowRows([STOCKS[5]], RATES, emptyStockLabels(), NOW)).toEqual([]);
  });
  it("원문 티커가 달라 행이 나뉜 같은 종목은 이름표를 함께 쓴다", () => {
    const two = [st({ id: "x1", ticker: "005930" }), st({ id: "x2", ticker: "005930KS" })];
    const r = buildGrowRows(two, RATES, mk({ "005930": keep(T("2026-11-01")) }), NOW);
    expect(r.map((x) => [x.ticker, x.labelState])).toEqual([["005930", "keep"], ["005930", "keep"]]);
    expect(new Set(r.map((x) => x.key)).size).toBe(2);
  });
});

describe("이름표 사실 줄·주기 경과", () => {
  const labels = (cycle: StockLabels["cycle"]) => mk({
    "005930": keep(T("2025-09-17")),
    AAPL: check(T("2026-03-01"), "2026-07-15"),
    NVDA: check(T("2026-10-28")),
    "069500": none(T("2026-11-01")),
  }, cycle);
  const fact = (cycle: StockLabels["cycle"]) => Object.fromEntries(buildGrowRows(STOCKS, RATES, labels(cycle), NOW).map((r) => [r.ticker, r]));
  it("주기 미설정: 경과 문구 없음(AC-6)", () => {
    const f = fact({ months: null, at: "" });
    expect(f["005930"].labelFact).toBe("오래 두기로 한 지 1년 2개월");
    expect(f.AAPL.labelFact).toBe("마지막 점검 4개월 전");
    expect(f.NVDA.labelFact).toBe("점검하기로 한 지 20일");
    expect(f["069500"]).toMatchObject({ labelState: "none", labelFact: null });
    expect(Object.values(f).every((r) => r.overdueFact === null)).toBe(true);
  });
  it("주기 3개월: 지난 '점검할 자산'만 문구가 붙는다. 점검 기록이 없으면 이름표를 붙인 날부터 센다", () => {
    const f = fact({ months: 3, at: T("2026-03-01") });
    expect(f.AAPL.overdueFact).toBe("내가 정한 주기 3개월이 지났어요");
    expect(f.NVDA.overdueFact).toBeNull();
    expect(f["005930"].overdueFact).toBeNull(); // 오래 둘 자산은 주기와 무관
  });
  it("주기를 바꾸면 그 자리에서 다시 계산", () => {
    expect(fact({ months: 6, at: T("2026-03-01") }).AAPL.overdueFact).toBeNull();
    const longAgo = buildGrowRows(STOCKS, RATES, mk({ NVDA: check(T("2025-10-01")) }, { months: 12, at: T("2026-01-01") }), NOW);
    expect(longAgo.find((r) => r.ticker === "NVDA")!.overdueFact).toBe("내가 정한 주기 12개월이 지났어요");
  });
  it("같은 날: 오늘 문장, 점검한 날은 '오늘 점검함' 판정", () => {
    const today = T("2026-11-17");
    const r = Object.fromEntries(buildGrowRows(STOCKS, RATES, mk({
      "005930": keep(today), NVDA: check(today), AAPL: check(T("2026-03-01"), today),
    }, { months: 3, at: today }), NOW).map((x) => [x.ticker, x]));
    expect(r["005930"].labelFact).toBe("오늘 오래 두기로 했어요");
    expect(r.NVDA.labelFact).toBe("오늘 점검할 자산으로 정했어요");
    expect(r.NVDA.checkedToday).toBe(false);
    expect(r.AAPL).toMatchObject({ labelFact: "마지막 점검 오늘", checkedToday: true, overdueFact: null });
  });
  it("예전에 점검한 종목에 이름표를 다시 붙인 날에는 '지났어요'가 뜨지 않는다(기준 = 점검일과 붙인 날 중 늦은 쪽)", () => {
    const item = { label: "check" as const, labeledAt: T("2026-11-17"), checkedAt: "2025-01-01", at: T("2026-11-17") };
    const r = buildGrowRows(STOCKS, RATES, mk({ AAPL: item }, { months: 3, at: T("2026-01-01") }), NOW).find((x) => x.ticker === "AAPL")!;
    expect(r.overdueFact).toBeNull();
    expect(r.labelFact).toBe("마지막 점검 1년 10개월 전");
  });
});

describe("정렬·접힘(AC-6·6a)·요약(AC-5·8)", () => {
  const many = Array.from({ length: 7 }, (_, i) => st({ id: `m${i}`, name: `종목${i}`, ticker: `T${i}`, quantity: 10 - i }));
  const od = (at: string) => check(at, "2026-01-01");
  it("주기가 지난 행이 위, 그 밖은 비중 큰 순", () => {
    const rows = buildGrowRows(many, RATES, mk({ T5: od(T("2025-12-01")), T2: od(T("2025-12-01")), T1: keep(T("2026-01-01")) }, { months: 3, at: T("2026-01-01") }), NOW);
    expect(sortGrowRowKeys(rows)).toEqual(["t:T2", "t:T5", "t:T0", "t:T1", "t:T3", "t:T4", "t:T6"]);
  });
  it("접히는 행 = 4번째 이후이면서 지나지 않은 행. 지난 행은 4개 이상이어도 모두 보인다", () => {
    const pick = (overdue: string[]) => {
      const rows = buildGrowRows(many, RATES, mk(Object.fromEntries(overdue.map((t) => [t, od(T("2025-12-01"))])), { months: 3, at: T("2026-01-01") }), NOW);
      const by = new Map(rows.map((r) => [r.key, r]));
      const ordered = sortGrowRowKeys(rows).map((k) => by.get(k)!);
      const collapsed = collapsedGrowRowKeys(ordered);
      return { shown: ordered.length - collapsed.length, collapsedOverdue: collapsed.filter((k) => by.get(k)!.overdueFact).length };
    };
    expect(pick([])).toEqual({ shown: 3, collapsedOverdue: 0 });
    expect(pick(["T6"])).toEqual({ shown: 3, collapsedOverdue: 0 });
    expect(pick(["T1", "T2", "T3", "T4", "T5"])).toEqual({ shown: 5, collapsedOverdue: 0 });
    expect(pick(many.map((s) => s.ticker!))).toEqual({ shown: 7, collapsedOverdue: 0 }); // 전 행이 지난 행 → 버튼 없음
  });
  it("종목 3개 이하면 접히는 행 0", () => {
    const rows = buildGrowRows(many.slice(0, 3), RATES, emptyStockLabels(), NOW);
    expect(collapsedGrowRowKeys(rows)).toEqual([]);
  });
  it("요약 3개 수의 합 = 행 수. 한 번도 안 고른 행과 '정하지 않음'은 같이 센다. 보유하지 않는 티커는 세지 않는다", () => {
    const labels = mk({
      T0: keep(T("2026-01-01")), T1: check(T("2026-01-01"), "2026-07-15"), T2: check(T("2026-01-01"), "2026-10-19"), T3: none(T("2026-01-01")),
      SOLD: keep(T("2026-01-01")), SOLD2: check(T("2026-01-01"), "2026-11-16"),
    });
    const rows = buildGrowRows(many, RATES, labels, NOW);
    const s = summarizeGrowRows(rows, labels, NOW, growTotals(many, RATES));
    expect(s).toMatchObject({ keep: 1, check: 2, none: 4, lastCheckText: "마지막 점검 29일 전" }); // 보유 중인 것 중 가장 최근
    expect(s.keep + s.check + s.none).toBe(rows.length);
  });
  it("이름표 0개: 개수 0·점검 문구 없음(화면은 숫자를 그리지 않는다)", () => {
    const rows = buildGrowRows(many, RATES, emptyStockLabels(), NOW);
    expect(summarizeGrowRows(rows, emptyStockLabels(), NOW, growTotals(many, RATES))).toMatchObject({ keep: 0, check: 0, none: 7, lastCheckText: null });
    expect(rows.every((r) => r.labelState === "unset" && r.labelFact === null)).toBe(true);
  });
});

// ─── 5.125 인사이트 증분: 기준값 base · 모르는 필드 보존 · 수량 비교 · 무게 줄 · 다시 봄 ───────────────

const BASE = { qty: 12, price: 185.5, priceAt: "2026-03-01", weight: 21.84 };
// 다음 버전이 더했다고 가정한 필드 — 4곳(최상위·cycle·항목·base)
const FUTURE = (): StockLabels => ({
  futureTop: { goals: [1, 2], note: "최상위" },
  v: 1,
  cycle: { months: 3, at: T("2026-01-01"), futureCycle: "주기에 딸린 값" },
  items: {
    AAPL: { label: "check", labeledAt: T("2026-03-01"), base: { ...BASE, futureBase: { lots: [3, 9] } }, futureItem: ["x", { y: 1 }], at: T("2026-03-01") },
    "005930": { label: "keep", labeledAt: T("2026-02-01"), base: { qty: 65 }, at: T("2026-02-01") },
  },
} as StockLabels);

describe("base 읽기(AC-27) — qty가 손상이면 base 전체가 없는 것, 나머지는 틀린 필드만 뺀다", () => {
  const parseBase = (base: unknown) => parseStockLabels({ v: 1, cycle: {}, items: { AAPL: { ...keep(T("2026-01-01")), base } } })!.items.AAPL;
  it("정상 4필드는 그대로", () => expect(parseBase(BASE).base).toEqual(BASE));
  it.each([["0", 0], ["음수", -3], ["문자열", "12"], ["NaN", Number.NaN], ["없음", undefined]])("qty %s → base 없음(항목은 정상)", (_n, qty) => {
    const item = parseBase({ ...BASE, qty });
    expect(item.base).toBeUndefined();
    expect(item.label).toBe("keep");
  });
  it("base가 객체가 아니면 없음", () => {
    for (const bad of [null, 5, "x", [1]]) expect(parseBase(bad).base).toBeUndefined();
  });
  it("price·priceAt·weight는 틀린 것만 빠진다", () => {
    expect(parseBase({ qty: 1.5, price: 0, priceAt: "언젠가", weight: 120 }).base).toEqual({ qty: 1.5 });
    expect(parseBase({ qty: 1.5, price: -1, priceAt: "2026-03-01", weight: 0 }).base).toEqual({ qty: 1.5, priceAt: "2026-03-01", weight: 0 });
  });
});

describe("⑨ 모르는 필드 보존(AC-31) — 읽기·편집·병합 순수 함수", () => {
  it("4곳의 미래 필드가 읽기 뒤에 값 그대로 있다", () => {
    const r = parseStockLabels(JSON.parse(JSON.stringify(FUTURE())))!;
    expect(r).toEqual(FUTURE());
    expect(r.futureTop).toEqual({ goals: [1, 2], note: "최상위" });
    expect(r.cycle.futureCycle).toBe("주기에 딸린 값");
    expect(r.items.AAPL.futureItem).toEqual(["x", { y: 1 }]);
    expect(r.items.AAPL.base!.futureBase).toEqual({ lots: [3, 9] });
  });
  it("다른 종목 이름표 저장·같은 항목 점검 뒤에도 남는다", () => {
    let s = parseStockLabels(FUTURE())!;
    s = setStockLabel(s, "NVDA", "keep", T("2026-04-01"), { qty: 8 });
    s = markStockChecked(s, "AAPL", T("2026-04-02"));
    expect(s.futureTop).toEqual(FUTURE().futureTop);
    expect(s.cycle).toEqual(FUTURE().cycle);
    expect(s.items.AAPL).toEqual({ ...FUTURE().items.AAPL, checkedAt: T("2026-04-02"), at: T("2026-04-02") });
    expect(s.items.NVDA).toEqual({ label: "keep", labeledAt: T("2026-04-01"), base: { qty: 8 }, at: T("2026-04-01") });
  });
  it("값을 새로 정하는 편집만 그 객체의 모르는 필드를 버린다: 이름표 변경 → 그 항목, 주기 변경 → cycle. 최상위는 항상 남는다", () => {
    let s = parseStockLabels(FUTURE())!;
    s = setStockLabel(s, "AAPL", "keep", T("2026-04-01"), { qty: 15 });
    expect(s.items.AAPL).toEqual({ label: "keep", labeledAt: T("2026-04-01"), base: { qty: 15 }, at: T("2026-04-01") });
    expect(s.cycle.futureCycle).toBe("주기에 딸린 값"); // 다른 객체는 그대로
    s = setStockLabelCycle(s, 6, T("2026-04-02"));
    expect(s.cycle).toEqual({ months: 6, at: T("2026-04-02") });
    s = setStockLabel(s, "005930", null, T("2026-04-03"));
    expect(s.futureTop).toEqual(FUTURE().futureTop);
  });
  it("병합: 이긴 항목이 모르는 필드를 통째로 가져오고, cycle은 이긴 쪽, 최상위는 키별 합집합", () => {
    const local = parseStockLabels(FUTURE())!;
    const remote = mk({ AAPL: keep(T("2026-01-01")), TSLA: keep(T("2026-05-01")) }, { months: 12, at: T("2025-01-01") });
    (remote as StockLabels).otherTop = 7;
    const m = mergeStockLabels(local, remote);
    expect(m.items.AAPL).toEqual(FUTURE().items.AAPL);
    expect(m.cycle).toEqual(FUTURE().cycle);
    expect([m.futureTop, m.otherTop]).toEqual([FUTURE().futureTop, 7]);
    expect(sameStockLabels(m, mergeStockLabels(remote, local))).toBe(true);
    // 진 쪽이 되면 통째로 사라진다(필드 단위로 섞이지 않는다)
    const newerRemote = mk({ AAPL: keep(T("2026-06-01")) }, { months: 12, at: T("2026-06-01") });
    const m2 = mergeStockLabels(local, newerRemote);
    expect(m2.items.AAPL).toEqual(keep(T("2026-06-01")));
    expect(m2.cycle).toEqual({ months: 12, at: T("2026-06-01") });
    expect(m2.futureTop).toEqual(FUTURE().futureTop);
  });
  it("최상위 같은 키가 다르면 어느 쪽에서 합쳐도 같은 값", () => {
    const a = { ...mk({}), shared: "짧음" } as StockLabels;
    const b = { ...mk({}), shared: "더 긴 값" } as StockLabels;
    expect(mergeStockLabels(a, b).shared).toBe("더 긴 값");
    expect(mergeStockLabels(b, a).shared).toBe("더 긴 값");
  });
  it("크기 상한: 넘은 객체의 모르는 필드만 전부 버린다(아는 필드와 다른 객체는 그대로)", () => {
    const big = "가".repeat(STOCK_LABEL_EXTRA_LIMIT.item);
    const v = FUTURE();
    v.items.AAPL.futureItem = big;                       // 항목 상한 초과(base 안 포함)
    v.items["005930"].small = "남는다";
    const r = parseStockLabels(v)!;
    expect(r.items.AAPL).toEqual({ label: "check", labeledAt: T("2026-03-01"), base: BASE, at: T("2026-03-01") });
    expect(r.items["005930"].small).toBe("남는다");
    expect(r.cycle.futureCycle).toBe("주기에 딸린 값");
    const top = parseStockLabels({ ...FUTURE(), huge: "나".repeat(STOCK_LABEL_EXTRA_LIMIT.top) })!;
    expect(top.futureTop).toBeUndefined();
    expect(top.huge).toBeUndefined();
    expect(top.items.AAPL.futureItem).toEqual(["x", { y: 1 }]);
    const cyc = parseStockLabels({ ...FUTURE(), cycle: { months: 3, at: T("2026-01-01"), huge: "다".repeat(STOCK_LABEL_EXTRA_LIMIT.cycle) } })!;
    expect(cyc.cycle).toEqual({ months: 3, at: T("2026-01-01") });
    expect([STOCK_LABEL_EXTRA_LIMIT.item, STOCK_LABEL_EXTRA_LIMIT.cycle, STOCK_LABEL_EXTRA_LIMIT.top]).toEqual([2048, 8192, 8192]);
  });
  it("위험 키(__proto__·constructor·prototype)는 싣지 않는다", () => {
    const raw = JSON.parse('{"v":1,"__proto__":{"polluted":1},"constructor":{"a":1},"cycle":{"months":3,"at":"2026-01-01","prototype":1},"items":{"AAPL":{"label":"keep","labeledAt":"2026-01-01","at":"2026-01-01","__proto__":{"x":1},"constructor":2,"base":{"qty":1,"__proto__":{"z":1}}}}}');
    const r = parseStockLabels(raw)!;
    expect(Object.keys(r).sort()).toEqual(["cycle", "items", "v"]);
    expect(Object.keys(r.cycle).sort()).toEqual(["at", "months"]);
    expect(Object.keys(r.items.AAPL).sort()).toEqual(["at", "base", "label", "labeledAt"]);
    expect(Object.keys(r.items.AAPL.base!)).toEqual(["qty"]);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it("원문 키 순서가 달라도 같은 값으로 본다(재-push가 반복되지 않는다)", () => {
    const a = parseStockLabels(FUTURE())!;
    const b = parseStockLabels(JSON.parse('{"items":{"005930":{"at":"2026-02-01T03:00:00.000Z","base":{"qty":65},"labeledAt":"2026-02-01T03:00:00.000Z","label":"keep"},"AAPL":{"futureItem":["x",{"y":1}],"at":"2026-03-01T03:00:00.000Z","base":{"futureBase":{"lots":[3,9]},"weight":21.84,"priceAt":"2026-03-01","price":185.5,"qty":12},"labeledAt":"2026-03-01T03:00:00.000Z","label":"check"}},"cycle":{"futureCycle":"주기에 딸린 값","at":"2026-01-01T03:00:00.000Z","months":3},"futureTop":{"note":"최상위","goals":[1,2]},"v":1}'))!;
    expect(sameStockLabels(a, b)).toBe(true);
    expect(sameStockLabels(mergeStockLabels(a, b), a)).toBe(true);
  });
});

describe("⑩ base와 병합·편집(AC-28·31)", () => {
  it("base는 labeledAt이 새로 쓰일 때만 쓰인다: 붙임·바꿈에는 새 값, '정하지 않음' 표식에는 없음", () => {
    let s = setStockLabel(emptyStockLabels(), "AAPL", "keep", T("2026-01-01"), BASE);
    expect(s.items.AAPL).toEqual({ label: "keep", labeledAt: T("2026-01-01"), base: BASE, at: T("2026-01-01") });
    s = setStockLabel(s, "AAPL", "check", T("2026-02-01"), { qty: 15, price: 200 });
    expect(s.items.AAPL).toEqual({ label: "check", labeledAt: T("2026-02-01"), base: { qty: 15, price: 200 }, at: T("2026-02-01") });
    s = setStockLabel(s, "AAPL", null, T("2026-03-01"), { qty: 99 });
    expect(s.items.AAPL).toEqual(none(T("2026-03-01")));
    expect("base" in s.items.AAPL).toBe(false);
  });
  it("점검·주기 변경·같은 이름표 다시 누름으로는 base가 바뀌지 않는다", () => {
    let s = setStockLabel(emptyStockLabels(), "AAPL", "check", T("2026-01-01"), BASE);
    s = markStockChecked(s, "AAPL", T("2026-02-01"));
    s = setStockLabelCycle(s, 6, T("2026-02-02"));
    expect(setStockLabel(s, "AAPL", "check", T("2026-03-01"), { qty: 99 })).toBe(s);
    expect(s.items.AAPL.base).toEqual(BASE);
    expect(s.items.AAPL.labeledAt).toBe(T("2026-01-01"));
  });
  it("기준값이 없거나 qty가 틀리면 base 없이 저장한다", () => {
    expect("base" in setStockLabel(emptyStockLabels(), "AAPL", "keep", T("2026-01-01")).items.AAPL).toBe(false);
    expect("base" in setStockLabel(emptyStockLabels(), "AAPL", "keep", T("2026-01-01"), { qty: 0 }).items.AAPL).toBe(false);
  });
  it("같은 티커를 두 기기가 다른 base로 저장 → 늦은 쪽 4필드만 남는다(필드 단위로 섞이지 않는다)", () => {
    const a = mk({ AAPL: { ...keep(T("2026-01-01")), base: { qty: 10, price: 100, priceAt: "2026-01-01", weight: 5 } } });
    const b = mk({ AAPL: { ...keep(T("2026-02-01")), base: { qty: 20 } } });
    for (const m of [mergeStockLabels(a, b), mergeStockLabels(b, a)]) expect(m.items.AAPL.base).toEqual({ qty: 20 });
  });
  it("at이 같으면 base 있는 쪽이 이긴다(base를 버리는 내부 빌드가 되돌려 보낸 값에 지지 않는다)", () => {
    const withBase = mk({ AAPL: { ...keep(T("2026-01-01")), base: BASE } });
    const without = mk({ AAPL: keep(T("2026-01-01")) });
    expect(mergeStockLabels(withBase, without).items.AAPL.base).toEqual(BASE);
    expect(mergeStockLabels(without, withBase).items.AAPL.base).toEqual(BASE);
  });
  it("base만 다른 값은 다른 값이다(같음 판정에 base가 들어간다)", () => {
    const a = mk({ AAPL: { ...keep(T("2026-01-01")), base: { qty: 10 } } });
    const b = mk({ AAPL: { ...keep(T("2026-01-01")), base: { qty: 11 } } });
    expect(sameStockLabels(a, b)).toBe(false);
    expect(sameStockLabels(a, JSON.parse(JSON.stringify(a)))).toBe(true);
  });
});

describe("수량 비교(AC-25·27) — 정한 날의 내 기록과 지금의 내 기록", () => {
  const withBase = (ticker: string, qty: number, labeledAt = T("2026-11-01"), kind: "keep" | "check" = "keep") =>
    mk({ [ticker]: { label: kind, labeledAt, base: { qty }, at: labeledAt } });
  const row = (stocks: Stock[], labels: StockLabels, ticker: string) => buildGrowRows(stocks, RATES, labels, NOW).find((r) => r.ticker === ticker)!;
  it("수량이 같으면 `정한 뒤 수량 그대로`, 다르면 `정한 날 N주 → 지금 M주`(늘어남·줄어듦 같은 형식)", () => {
    expect(row(STOCKS, withBase("AAPL", 5), "AAPL").qtyFact).toEqual({ state: "same", text: "정한 뒤 수량 그대로" });
    expect(row(STOCKS, withBase("AAPL", 3), "AAPL").qtyFact).toEqual({ state: "changed", text: "정한 날 3주 → 지금 5주" });
    expect(row(STOCKS, withBase("AAPL", 12), "AAPL").qtyFact).toEqual({ state: "changed", text: "정한 날 12주 → 지금 5주" });
  });
  it("'오래 둘'·'점검할' 같은 문장", () => {
    expect(row(STOCKS, withBase("AAPL", 3, T("2026-11-01"), "check"), "AAPL").qtyFact).toEqual(row(STOCKS, withBase("AAPL", 3), "AAPL").qtyFact);
  });
  it("지금 수량 = 같은 이름표 키를 쓰는 모든 보유 건의 합(계좌·분류 무관) = 종목 페이지 `총 N주` 표기", () => {
    expect(qtyByLabelKey(STOCKS).get("005930")).toBe(20); // 일반 10 + ISA 10
    expect(row(STOCKS, withBase("005930", 12), "005930").qtyFact!.text).toBe(`정한 날 12주 → 지금 ${(20).toLocaleString()}주`);
    expect(formatQty(1234567)).toBe(`${(1234567).toLocaleString()}주`);
  });
  it("소수 수량: 표시 문자열이 같으면 그대로(부동소수 오차로 다르게 뜨지 않는다)", () => {
    const frac = [st({ id: "f1", ticker: "VOO", quantity: 0.1 }), st({ id: "f2", ticker: "VOO", quantity: 0.2, category: "isa" })];
    expect(qtyByLabelKey(frac).get("VOO")).not.toBe(0.3); // 0.30000000000000004
    expect(row(frac, withBase("VOO", 0.3), "VOO").qtyFact).toEqual({ state: "same", text: "정한 뒤 수량 그대로" });
    expect(row(frac, withBase("VOO", 1.25), "VOO").qtyFact!.text).toBe("정한 날 1.25주 → 지금 0.3주");
  });
  it("원문 티커가 달라 두 행으로 나뉜 종목은 두 행에 같은 문장(두 행의 합)", () => {
    const two = [st({ id: "x1", ticker: "005930", quantity: 7 }), st({ id: "x2", ticker: "005930KS", quantity: 5 })];
    const rows = buildGrowRows(two, RATES, withBase("005930", 10), NOW);
    expect(rows.map((r) => r.qtyFact!.text)).toEqual(["정한 날 10주 → 지금 12주", "정한 날 10주 → 지금 12주"]);
  });
  it("정한 날 당일은 없음, 다음 날부터 나온다", () => {
    expect(row(STOCKS, withBase("AAPL", 3, T("2026-11-17")), "AAPL").qtyFact).toBeNull();
    expect(row(STOCKS, withBase("AAPL", 3, T("2026-11-16")), "AAPL").qtyFact).not.toBeNull();
  });
  it("base 없는 항목·'정하지 않음'·이름표 없는 행은 없음(나머지 줄은 정상)", () => {
    const noBase = row(STOCKS, mk({ AAPL: keep(T("2026-11-01")) }), "AAPL");
    expect(noBase.qtyFact).toBeNull();
    expect(noBase.labelFact).toBe("오래 두기로 한 지 16일");
    const damaged = parseStockLabels({ v: 1, cycle: {}, items: { AAPL: { ...keep(T("2026-11-01")), base: { qty: -1 } } } })!;
    expect(row(STOCKS, damaged, "AAPL").qtyFact).toBeNull();
    expect(row(STOCKS, mk({ AAPL: { ...none(T("2026-11-01")), base: { qty: 3 } } as never }), "AAPL").qtyFact).toBeNull();
    expect(row(STOCKS, emptyStockLabels(), "AAPL").qtyFact).toBeNull();
  });
  it("시세가 없어도 수량 비교는 나온다", () => {
    const unpriced = [st({ id: "z", ticker: "ZZZ", currentPrice: 0, quantity: 4 })];
    expect(row(unpriced, withBase("ZZZ", 9), "ZZZ").qtyFact!.text).toBe("정한 날 9주 → 지금 4주");
  });
});

describe("기준값 만들기 buildLabelBase", () => {
  it("수량은 이름표 키 합, 시세는 종목 통화 그대로, 비중은 행 비중과 같은 분모", () => {
    const total = growTotals(STOCKS, RATES).totalValue;
    expect(buildLabelBase(STOCKS, RATES, "AAPL")).toEqual({ qty: 5, price: 200, weight: Math.round(((5 * 200 * 1400) / total) * 10000) / 100 });
    expect(buildLabelBase(STOCKS, RATES, "005930")).toMatchObject({ qty: 20, price: 60_000 });
    const dated = [st({ id: "d", ticker: "AAA", quantity: 2, currentPrice: 50, baseDate: "2026-11-14" } as never)];
    expect(buildLabelBase(dated, RATES, "AAA")).toEqual({ qty: 2, price: 50, priceAt: "2026-11-14", weight: 100 });
  });
  it("시세 없는 종목이 하나라도 있으면 비중만 비운다. 그 종목 자체가 시세 없음이면 시세도 비운다", () => {
    const mixed = [...STOCKS, st({ id: "z", ticker: "ZZZ", currentPrice: 0, quantity: 4 })];
    expect(buildLabelBase(mixed, RATES, "AAPL")).toEqual({ qty: 5, price: 200 });
    expect(buildLabelBase(mixed, RATES, "ZZZ")).toEqual({ qty: 4 });
  });
  it("보유하지 않는 티커는 기준값이 없다", () => expect(buildLabelBase(STOCKS, RATES, "NOPE")).toBeUndefined());
});

describe("무게 줄(AC-22~24) — 이름표별 내 주식 비중", () => {
  const sum = (stocks: Stock[], labels: StockLabels) => summarizeGrowRows(buildGrowRows(stocks, RATES, labels, NOW), labels, NOW, growTotals(stocks, RATES));
  const labels = mk({ AAPL: keep(T("2026-11-01")), "005930": keep(T("2026-11-01")), NVDA: check(T("2026-11-01")) });
  it("세 표시값의 합이 100.0이고 종목 수 합 = 행 수. '정하지 않음'은 티커 없는 종목 몫 포함", () => {
    const w = sum(STOCKS, labels).weights;
    const total = growTotals(STOCKS, RATES).totalValue;
    expect(w.keep).toEqual({ count: 2, pct: Number((((1_400_000 + 1_200_000) / total) * 100).toFixed(1)), pctText: `${(((1_400_000 + 1_200_000) / total) * 100).toFixed(1)}%` });
    expect(w.check.pctText).toBe(`${((210_000 / total) * 100).toFixed(1)}%`);
    expect((w.keep.pct! * 10 + w.check.pct! * 10 + w.none.pct! * 10) / 10).toBeCloseTo(100, 6);
    expect(Number(w.keep.pctText.slice(0, -1)) + Number(w.check.pctText.slice(0, -1)) + Number(w.none.pctText.slice(0, -1))).toBeCloseTo(100, 6);
    expect(w.keep.count + w.check.count + w.none.count).toBe(4);
    // '오래 둘' 비중이 해당 행들의 `내 주식의 N%` 합과 ±0.1 안
    const rows = buildGrowRows(STOCKS, RATES, labels, NOW).filter((r) => r.labelState === "keep");
    expect(Math.abs(w.keep.pct! - rows.reduce((s, r) => s + parseFloat(r.weightText), 0))).toBeLessThanOrEqual(0.1 + 1e-9);
  });
  it("전부 '오래 둘'이면 100.0 / 0.0 / 0.0, 이름표 0개면 0.0 / 0.0 / 100.0", () => {
    const only = STOCKS.slice(2, 3);
    expect(Object.values(sum(only, mk({ AAPL: keep(T("2026-11-01")) })).weights).map((x) => x.pctText)).toEqual(["100.0%", "0.0%", "0.0%"]);
    expect(Object.values(sum(only, emptyStockLabels()).weights).map((x) => x.pctText)).toEqual(["0.0%", "0.0%", "100.0%"]);
  });
  it("시세 없는 종목이 하나라도 있으면 비중은 —, 종목 수는 그대로", () => {
    const mixed = [...STOCKS, st({ id: "z", ticker: "ZZZ", currentPrice: 0, quantity: 4 })];
    const w = sum(mixed, labels).weights;
    expect(Object.values(w).map((x) => [x.count, x.pctText, x.pct])).toEqual([[2, "—", null], [1, "—", null], [2, "—", null]]);
  });
  it("상장폐지 보유분은 분모에서 빠지므로 분자에서도 빠지고 종목 수에만 센다", () => {
    const withDelisted = [...STOCKS.slice(2, 4), st({ id: "x", ticker: "DEAD", quantity: 100, currentPrice: 500, inactiveStatus: "delisted" } as never)];
    const w = sum(withDelisted, mk({ DEAD: keep(T("2026-11-01")), AAPL: keep(T("2026-11-01")) })).weights;
    expect(w.keep.count).toBe(2);
    expect(w.keep.pctText).toBe(`${((1_400_000 / 1_610_000) * 100).toFixed(1)}%`);
    expect(w.keep.pct! + w.check.pct! + w.none.pct!).toBeCloseTo(100, 6);
  });
  it("정렬은 무게·수량과 무관하다(비중 순 그대로)", () => {
    const a = sortGrowRowKeys(buildGrowRows(STOCKS, RATES, labels, NOW));
    const b = sortGrowRowKeys(buildGrowRows(STOCKS, RATES, mk({ NVDA: { ...keep(T("2026-11-01")), base: { qty: 999 } } }), NOW));
    expect(a).toEqual(b);
  });
});

describe("'다시 봄' 판정(AC-30)", () => {
  const now = Date.parse("2026-11-17T03:00:00Z");
  it("유효 이름표가 있고 가장 이른 붙인 날이 어제 이전이면 true", () => {
    expect(isStockLabelRevisit(mk({ AAPL: keep(T("2026-11-16")) }), now)).toBe(true);
    expect(isStockLabelRevisit(mk({ AAPL: keep(T("2026-11-17")), NVDA: check("2026-07-15") }), now)).toBe(true);
  });
  it("이름표 0개·오늘만 붙인 기기·표식만 있는 기기는 false", () => {
    expect(isStockLabelRevisit(emptyStockLabels(), now)).toBe(false);
    expect(isStockLabelRevisit(mk({ AAPL: keep(T("2026-11-17")), NVDA: check("2026-11-17T00:10:00Z") }), now)).toBe(false);
    expect(isStockLabelRevisit(mk({ AAPL: none(T("2026-01-01")) }), now)).toBe(false);
  });
  it("KST 날짜 기준: UTC로는 같은 날이어도 KST 전날이면 true", () => {
    const n = Date.parse("2026-11-17T16:00:00Z"); // KST 11/18 01:00
    expect(isStockLabelRevisit(mk({ AAPL: keep("2026-11-17T14:30:00Z") }), n)).toBe(true);  // KST 11/17 23:30
    expect(isStockLabelRevisit(mk({ AAPL: keep("2026-11-17T15:30:00Z") }), n)).toBe(false); // KST 11/18 00:30
  });
});
