// #239 [5.125] 내 자산 불리기 — 이름표 저장 형태·병합·편집(순수 함수)과 화면 표시 값(기간 표기·행·정렬·접힘).
import { describe, expect, it } from "vitest";
import type { Stock } from "@/types/asset";
import {
  countValidLabels, emptyStockLabels, hasStockLabelRecords, markStockChecked, mergeStockLabels, parseStockLabels, sameStockLabels,
  setStockLabel, setStockLabelCycle, type StockLabels,
} from "../asset/stock-labels";
import {
  buildGrowRows, collapsedGrowRowKeys, elapsedSince, formatAgo, formatSince, sortGrowRowKeys, summarizeGrowRows,
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
    expect(r.items["BRK/B"]).toEqual(none(T("2026-01-02"))); // 모르는 필드(메모·금액)는 버린다
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
    const s = summarizeGrowRows(rows, labels, NOW);
    expect(s).toEqual({ keep: 1, check: 2, none: 4, lastCheckText: "마지막 점검 29일 전" }); // 보유 중인 것 중 가장 최근
    expect(s.keep + s.check + s.none).toBe(rows.length);
  });
  it("이름표 0개: 개수 0·점검 문구 없음(화면은 숫자를 그리지 않는다)", () => {
    const rows = buildGrowRows(many, RATES, emptyStockLabels(), NOW);
    expect(summarizeGrowRows(rows, emptyStockLabels(), NOW)).toEqual({ keep: 0, check: 0, none: 7, lastCheckText: null });
    expect(rows.every((r) => r.labelState === "unset" && r.labelFact === null)).toBe(true);
  });
});
