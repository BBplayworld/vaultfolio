// #242 [5.127] `내 선택` 계산(grow-pick) — 정의 3곳(가격 같음 / 판 종목 / 행 합 규칙), 상태표 문자열, 데모 시드 정합, 주식 외 행·전 종류 합(grow-kinds).
import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  computePick, cryptoPickInput, pickAfterOf, pickHeadline, pickTextOf, pickUpText, stockPickInput, PICK_ROWS, type PickInput,
} from "../asset/grow-pick";
import { buildCryptoLabelBase, buildCryptoRows, buildGrowBoards, buildOwnRows, cryptoTotal, firstGrowView, growStatus, heldViews, ownSnap, viewHasDue } from "../asset/grow-kinds";
import { hitOf } from "../asset/grow-board";
import { parseStockLabels, recordReview, setStockLabel, type StockLabels, type StockLabelReview } from "../asset/stock-labels";
import { materializeDemo } from "../preview/demo-payload";
import { priceByAnyLabelKey, rebaseDemoLabelPrices } from "../preview/demo-live-rebase";
import { assetDataSchema, type Crypto, type PhysicalAsset, type RealEstate, type Stock } from "@/types/asset";
import type { CryptoTransaction, Transaction } from "@/types/transaction";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";

const NOW = Date.parse("2026-11-18T03:00:00Z");
const T = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const D = (d: number) => T(d).slice(0, 10);
const mk = (items: StockLabels["items"], reviews: StockLabelReview[] = []): StockLabels => ({ v: 1, cycle: { months: 3, at: T(400) }, items, ...(reviews.length ? { reviews } : {}) });
const item = (label: "keep" | "check" | null, d: number, price?: number) => ({ label, labeledAt: T(d), at: T(d), ...(price ? { base: { qty: 1, price } } : {}) });
const rv = (t: string, d: number, choice: StockLabelReview["choice"], price: number, hit?: StockLabelReview["hit"]): StockLabelReview => ({ t, at: T(d), from: "check", choice, price, rate: 0, ...(hit ? { hit } : {}) });
const held = (o: Record<string, number | null>, buys: PickInput["buys"] = [], sells: Record<string, { date: string; price: number }[]> = {}): PickInput => ({
  held: new Map(Object.entries(o).map(([k, p]) => [k, { qty: 1, nowPrice: p }])), buys, sells: new Map(Object.entries(sells)),
});
const line = (labels: StockLabels, input: PickInput, view: "stock" | "crypto" = "stock") => pickTextOf(pickHeadline(computePick(labels, view, input, NOW)));

describe("기록 3종과 합 규칙", () => {
  // AAA 정함(100) → 그대로 두기(90, 조건에 닿음) → 그대로 두기(120) → 지금 130 / BBB 바꾸기 2번 / CCC 정함만
  const labels = mk(
    { AAA: item("check", 300, 100), BBB: item("keep", 100), CCC: item("keep", 200, 50), DDD: item("check", 10, 70) },
    [rv("AAA", 200, "same", 90, "down"), rv("AAA", 100, "same", 120, "cycle"), rv("BBB", 250, "check", 40, "up"), rv("BBB", 100, "keep", 30), rv("DDD", 5, "same", 71)],
  );
  const input = held({ AAA: 130, BBB: 30, CCC: 49, DDD: 80 }, [{ key: "AAA", price: 100 }, { key: "AAA", price: 130 }, { key: "CCC", price: 60 }]);
  const r = computePick(labels, "stock", input, NOW);
  it("정함 = 항목의 base.price(바꾼 날의 '정한 날'은 바꾸기가 센다), 그대로 두기 = same, 바꾸기 = keep·check·none", () => {
    expect(PICK_ROWS.map((x) => [x.kind, x.label])).toEqual([["set", "정함"], ["same", "그대로 두기"], ["move", "바꾸기"]]); // 고정 순서, enum 키 move 그대로
    expect([r.rows.set.n, r.rows.same.n, r.rows.move.n]).toEqual([2, 2, 2]);
    // BBB는 묶음을 바꾼 종목이라 정함이 없다(정함은 종목당 최대 1번)
    expect(r.events.filter((e) => e.key === "BBB").map((e) => e.kind)).toEqual(["move", "move"]);
  });
  it("그 뒤 가격 = 다음 기록 가격, 없으면 지금 가격. 오름 = 높은 것만", () => {
    const of = (k: string, kind: string) => r.events.find((e) => e.key === k && e.kind === kind)!;
    expect(of("AAA", "set")).toMatchObject({ price: 100, end: { kind: "next", price: 90 }, up: false });
    expect(r.events.filter((e) => e.key === "AAA" && e.kind === "same").map((e) => [e.end!.kind, e.end!.price, e.up])).toEqual([["next", 120, true], ["now", 130, true]]);
    expect(r.events.filter((e) => e.key === "BBB").map((e) => [e.end!.price, e.up])).toEqual([[30, false], [30, false]]); // 40→30 내림, 30→30 같음
    expect(of("CCC", "set")).toMatchObject({ end: { kind: "now", price: 49 }, up: false });
  });
  it("합 규칙 — 세 행의 번 수 합 = N, 오름 합 = M. 조건에 닿아 점검(hit down·up)은 그대로 두기·바꾸기의 부분집합, 매수는 합 밖", () => {
    expect(r.rows.set.n + r.rows.same.n + r.rows.move.n).toBe(r.n);
    expect(r.rows.set.up + r.rows.same.up + r.rows.move.up).toBe(r.up);
    expect([r.n, r.up]).toEqual([6, 2]);
    expect([r.hit.n, r.hit.up]).toEqual([2, 1]); // AAA down(오름) + BBB up(내림). cycle은 넣지 않는다
    expect(r.hit.n).toBeLessThanOrEqual(r.rows.same.n + r.rows.move.n);
    expect([r.buys.n, r.buys.up]).toEqual([3, 1]); // 100 < 130만 오름(130 = 130은 같음, 60 > 49)
    expect(r.state).toBe("count");
  });
  it("30일이 안 된 기록은 N에 넣지 않고 따로 센다(안내 줄 K) — DDD 정함 10일·그대로 두기 5일", () => {
    expect(r.late).toBe(2);
    expect(r.records).toBe(8);
    expect(r.events.filter((e) => e.key === "DDD").every((e) => !e.counted)).toBe(true);
  });
  it("거름용 키 — 그 묶음의 셀 수 있는 기록이 있는 지금 가진 종목", () => {
    expect([r.rows.set.keys, r.rows.same.keys, r.rows.move.keys, r.hit.keys.sort(), r.buys.keys]).toEqual([["AAA", "CCC"], ["AAA"], ["BBB"], ["AAA", "BBB"], ["AAA", "CCC"]]);
  });
  it("이력 줄 값 — 최신 줄 `지금까지`, 그 앞 줄 `다음 점검까지`(같은 계산의 결과). 지금 가격이 없으면 최신 줄은 비운다", () => {
    expect(pickAfterOf(r, "AAA", T(100))).toEqual({ kind: "now", pct: 8.3 });
    expect(pickAfterOf(r, "AAA", T(200))).toEqual({ kind: "next", pct: 33.3 });
    expect(pickAfterOf(r, "AAA", T(300))).toBeNull(); // 정함은 이력 줄이 아니다
    const noPrice = computePick(labels, "stock", held({ AAA: null, BBB: 30, CCC: 49, DDD: 80 }), NOW);
    expect(pickAfterOf(noPrice, "AAA", T(100))).toBeNull();
    expect(pickAfterOf(noPrice, "AAA", T(200))).toEqual({ kind: "next", pct: 33.3 });
  });
});

describe("가격이 같으면 오름이 아니다(조건 10)", () => {
  it("화면의 소수 1자리 %로 `+0.0%`가 되는 기록은 오름에 들어가지 않는다", () => {
    const labels = mk({ A: item("keep", 90, 1000), B: item("keep", 90, 1000), C: item("keep", 90, 1000) });
    const r = computePick(labels, "stock", held({ A: 1000, B: 1000.4, C: 1000.6 }), NOW); // ±0.0% / +0.04% → 0.0 / +0.06% → +0.1
    expect([r.n, r.up]).toEqual([3, 1]);
    expect(r.events.map((e) => e.pct)).toEqual([0, 0, 0.1]);
  });
});

describe("판 종목(조건 11)", () => {
  const labels = mk({ SOLD: item("check", 200, 100), GONE: item("keep", 200, 100), HELD: item("keep", 200, 100) }, [rv("SOLD", 120, "same", 110), rv("GONE", 120, "same", 90)]);
  it("매도 거래가 있으면 그 기록 뒤 가장 늦은 매도 단가까지, 매도 기록이 없으면 그 종목 기록 전부를 뺀다. 지금 가격은 쓰지 않는다", () => {
    const input: PickInput = {
      held: new Map([["SOLD", { qty: 0, nowPrice: 500 }], ["HELD", { qty: 2, nowPrice: 105 }]]), // SOLD는 수량 0으로 남은 보유 건 — 판 종목이다
      buys: [{ key: "SOLD", price: 1 }],
      sells: new Map([["SOLD", [{ date: D(100), price: 108 }, { date: D(80), price: 104 }, { date: D(150), price: 999 }]]]),
    };
    const r = computePick(labels, "stock", input, NOW);
    const sold = r.events.filter((e) => e.key === "SOLD");
    expect(sold.map((e) => [e.kind, e.end?.kind, e.end?.price, e.up])).toEqual([["set", "next", 110, true], ["same", "sell", 104, false]]); // 110 → 가장 늦은 매도 104(지금 500이 아니다)
    expect(r.events.filter((e) => e.key === "GONE").every((e) => e.end === null && !e.counted)).toBe(true);
    expect([r.n, r.up]).toEqual([3, 2]);
    // 판 종목은 건수에만 있고 거름 목록·기록 수·매수에는 없다
    expect([...r.rows.set.keys, ...r.rows.same.keys]).toEqual(["HELD"]);
    expect(r.records).toBe(1);
    expect(r.buys.n).toBe(0);
    expect(pickAfterOf(r, "SOLD", T(120))).toBeNull(); // 매도 단가는 이력 줄에 그리지 않는다
  });
  it("매도 거래가 기록보다 앞이면 넣지 않는다", () => {
    const r = computePick(labels, "stock", { held: new Map(), buys: [], sells: new Map([["SOLD", [{ date: D(150), price: 300 }]]]) }, NOW);
    expect(r.events.filter((e) => e.key === "SOLD").map((e) => e.counted)).toEqual([true, false]); // 정함(200일 전)은 그 뒤 매도가 있어 다음 기록 가격까지, 마지막 기록은 뒤 매도가 없다
  });
  it("입력 만들기 — 보유 건에 이은 거래만(통화 같음), 지워진 보유 건의 매도는 거래 티커로. 상장폐지·수량 0은 가진 종목이 아니다", () => {
    const st = (o: Partial<Stock>): Stock => ({ id: "s", category: "foreign", name: "n", ticker: "AAA", quantity: 1, averagePrice: 1, currentPrice: 10, currency: "USD", purchaseDate: "2025-01-01", ...o } as Stock);
    const tx = (o: Partial<Transaction>): Transaction => ({ id: "t", stockId: "s", ticker: "AAA", stockName: "n", type: "buy", quantity: 1, price: 5, currency: "USD", date: D(40), reflected: true, createdAt: "" , ...o } as Transaction);
    const input = stockPickInput(
      [st({}), st({ id: "z", ticker: "ZERO", quantity: 0 }), st({ id: "d", ticker: "DEAD", inactiveStatus: "delisted" } as Partial<Stock>), st({ id: "k", ticker: "005930", category: "domestic", currency: "KRW", currentPrice: 0 })],
      [tx({}), tx({ id: "t2", currency: "KRW" }), tx({ id: "t3", type: "sell", price: 9 }), tx({ id: "t4", stockId: "gone", ticker: "old", type: "sell", price: 7 }), tx({ id: "t5", stockId: "gone", ticker: "OLD" })],
    );
    expect([...input.held.entries()]).toEqual([["AAA", { qty: 1, nowPrice: 10 }], ["ZERO", { qty: 0, nowPrice: 10 }], ["005930", { qty: 1, nowPrice: null }]]);
    expect(input.buys).toEqual([{ key: "AAA", price: 5 }]); // 통화 다른 거래·지워진 보유 건의 매수는 뺀다
    expect([...input.sells.entries()]).toEqual([["AAA", [{ date: D(40), price: 9 }]], ["OLD", [{ date: D(40), price: 7 }]]]);
    const c = (o: Partial<Crypto>): Crypto => ({ id: "c", name: "비트코인", symbol: "btc", quantity: 0.1, averagePrice: 1, currentPrice: 10, purchaseDate: "2025-01-01", ...o } as Crypto);
    const ctx = (o: Partial<CryptoTransaction>): CryptoTransaction => ({ id: "x", cryptoId: "c", symbol: "BTC", name: "n", type: "buy", quantity: 1, price: 5, date: D(3), reflected: true, createdAt: "", ...o } as CryptoTransaction);
    const ci = cryptoPickInput([c({}), c({ id: "c2", quantity: 0.2 }), c({ id: "h", symbol: "한글" })], [ctx({}), ctx({ id: "x2", cryptoId: "gone", symbol: "eth", type: "sell", price: 3 }), ctx({ id: "x3", cryptoId: "gone", symbol: "eth" })]);
    expect([...ci.held.entries()]).toEqual([["c:BTC", { qty: 0.30000000000000004, nowPrice: 10 }]]); // 같은 심볼은 합친다. 키를 만들 수 없는 심볼은 뺀다
    expect(ci.buys).toEqual([{ key: "c:BTC", price: 5 }]);
    expect([...ci.sells.keys()]).toEqual(["c:ETH"]);
  });
});

describe("상태표(spec 4절) — 결론 줄 문자열", () => {
  const many = (n: number, up: number) => {
    const items: StockLabels["items"] = {};
    const now: Record<string, number> = {};
    for (let i = 0; i < n; i++) { items[`T${i}`] = item("keep", 60 + i, 100); now[`T${i}`] = i < up ? 110 : 90; }
    return { labels: mk(items), input: held(now) };
  };
  const buys = (n: number, up: number) => Array.from({ length: n }, (_, i) => ({ key: "T0", price: i < up ? 50 : 500 }));
  it("정상·손실·0번·전부 — 문장을 뒤집지 않는다", () => {
    for (const [n, up, want] of [[11, 8, "11번 중 8번은 그때보다 오름"], [11, 2, "11번 중 2번은 그때보다 오름"], [11, 0, "11번 중 그때보다 오른 것 없음"], [11, 11, "11번 모두 그때보다 오름"], [3, 1, "3번 중 1번은 그때보다 오름"]] as const) {
      const { labels, input } = many(n, up);
      expect(line(labels, input)).toBe(want);
    }
  });
  it("굵은 것은 숫자뿐 — `모두`·`없음` 문장에는 굵은 조각이 없다", () => {
    const parts = (n: number, up: number) => { const { labels, input } = many(n, up); return pickHeadline(computePick(labels, "stock", input, NOW)); };
    expect(parts(6, 5).filter((p) => p.b).map((p) => p.t)).toEqual(["5번"]);
    expect(parts(6, 6).some((p) => p.b)).toBe(false);
    expect(parts(6, 0).some((p) => p.b)).toBe(false);
  });
  it("아직 못 셈 — 기록 2번 / 기록 수 0 / 시세 미수신. `측정 중`·`아직 기록 없음`을 쓰지 않는다", () => {
    const two = many(2, 1);
    expect(line(two.labels, two.input)).toBe("기록 2번 ·30일 지난 3번부터 보여요");
    expect(pickHeadline(computePick(two.labels, "stock", two.input, NOW)).map((p) => p.t)).toEqual(["기록 2번 ·", "30일 지난 3번부터 보여요"]); // 가운뎃점 뒤에서만 줄이 바뀌는 두 조각
    // 30일 미만이 섞여도 기록 수에는 들어간다
    const late = mk({ A: item("keep", 60, 100), B: item("keep", 3, 100), C: item("keep", 2, 100), D: item("keep", 1, 100) });
    expect(line(late, held({ A: 110, B: 110, C: 110, D: 110 }))).toBe("기록 4번 ·30일 지난 3번부터 보여요");
    // 정한 것은 있는데 그때 가격이 남지 않은 것뿐
    expect(line(mk({ A: item("keep", 60), B: item("check", 70) }), held({ A: 110, B: 110 }))).toBe("30일 지난 기록3번부터 보여요");
    // 지금 가격을 못 받아 3번 미만이 됨 — 30일 문장을 쓰면 거짓이 된다
    const four = many(4, 4);
    expect(line(four.labels, held({ T0: null, T1: null, T2: 110, T3: 110 }))).toBe("기록 4번 ·가격을 받으면 보여요");
    for (const s of [two, four]) expect(line(s.labels, held({}))).not.toMatch(/측정 중|아직 기록 없음|기록이 쌓이면|기록 0번/);
  });
  it("매수 문장 — 셀 수 있는 기록 3번 미만이고 매수 3건 이상일 때(일부·0건·전부)", () => {
    const two = many(2, 1);
    const withBuys = (n: number, up: number) => line(two.labels, { ...two.input, buys: buys(n, up) });
    expect(withBuys(12, 9)).toBe("매수 12건 중 9건은 매수가보다 오름");
    expect(withBuys(12, 0)).toBe("매수 12건 중 매수가보다 오른 것 없음");
    expect(withBuys(12, 12)).toBe("매수 12건 모두 매수가보다 오름");
    expect(withBuys(2, 2)).toBe("기록 2번 ·30일 지난 3번부터 보여요"); // 매수 3건 미만
    expect(computePick(two.labels, "stock", { ...two.input, buys: buys(3, 3) }, NOW).state).toBe("buy");
    // 기록 3번 이상이면 매수가 많아도 건수 문장이 먼저다(축은 값의 좋고 나쁨이 아니라 기록 수로만 고른다)
    const three = many(3, 0);
    expect(line(three.labels, { ...three.input, buys: buys(12, 12) })).toBe("3번 중 그때보다 오른 것 없음");
  });
  it("패널 행 오른쪽 — `오름 3번` / `모두 오름`(2번 이상) / `오름 없음`. 1번뿐인 행은 `오름 1번`. 주석 줄은 늘 `오름 m번`·`오름 없음`", () => {
    const t = (n: number, up: number, always = false) => pickTextOf(pickUpText({ n, up }, "번", always));
    expect([t(4, 3), t(2, 2), t(5, 0), t(1, 1), t(1, 0)]).toEqual(["오름 3번", "모두 오름", "오름 없음", "오름 1번", "오름 없음"]);
    expect([t(3, 3, true), t(3, 0, true)]).toEqual(["오름 3번", "오름 없음"]);
    expect(pickTextOf(pickUpText({ n: 12, up: 9 }, "건"))).toBe("오름 9건");
    expect(pickUpText({ n: 2, up: 2 }).some((p) => p.b)).toBe(false);
  });
  it("보기별로 따로 — 부동산·실물·예약 접두 키와 다른 종류의 기록은 어디에도 넣지 않는다", () => {
    const labels = mk(
      { AAA: item("keep", 90, 10), "c:BTC": item("check", 90, 10), "r:re_1": item("keep", 400, 10), "p:ph_1": item("check", 90, 10), "s:x": item("keep", 90, 10) },
      [rv("r:re_1", 40, "same", 500_000_000), rv("p:ph_1", 40, "keep", 9_000_000), rv("c:BTC", 40, "same", 12)],
    );
    const input = held({ AAA: 11, "c:BTC": 13, "r:re_1": 1, "p:ph_1": 1, "s:x": 1 });
    expect(computePick(labels, "stock", input, NOW).events.map((e) => e.key)).toEqual(["AAA"]);
    expect(computePick(labels, "crypto", input, NOW).events.map((e) => e.key)).toEqual(["c:BTC", "c:BTC"]);
  });
});

describe("주식 외 행(grow-kinds)", () => {
  const btc = (o: Partial<Crypto> = {}): Crypto => ({ id: "c1", name: "비트코인", symbol: "BTC", quantity: 0.05, averagePrice: 120_000_000, currentPrice: 140_000_000, purchaseDate: D(400), ...o } as Crypto);
  const re = (o: Partial<RealEstate> = {}): RealEstate => ({ id: "re_1", type: "apartment", name: "우리 집", purchasePrice: 500_000_000, currentValue: 620_000_000, purchaseDate: "2019-09-01", ...o } as RealEstate);
  const ph = (o: Partial<PhysicalAsset> = {}): PhysicalAsset => ({ id: "ph_1", type: "gold", name: "골드바", purchasePrice: 8_000_000, currentValue: 11_056_000, purchaseDate: "2023-10-01", ...o } as PhysicalAsset);
  it("코인 행 — 심볼 묶음, 평가액 0인 묶음은 없음, 점수·측정 중·정한 날 대비는 주식과 같은 규칙", () => {
    const labels = mk({ "c:BTC": item("check", 70, 132_000_000) });
    const rows = buildCryptoRows([btc(), btc({ id: "c2", quantity: 0.05, averagePrice: 100_000_000 }), btc({ id: "e", symbol: "ETH", name: "이더리움", quantity: 1, averagePrice: 4_000_000, currentPrice: 5_000_000, purchaseDate: D(60) }), btc({ id: "z", symbol: "ZERO", quantity: 0 })], labels, NOW);
    expect(rows.map((r) => [r.key, r.labelKey, r.kind])).toEqual([["c:BTC", "c:BTC", "crypto"], ["c:ETH", "c:ETH", "crypto"]]);
    const b = rows[0];
    expect([b.value, b.cost, Math.round(b.rate! * 10) / 10]).toEqual([14_000_000, 11_000_000, 27.3]);
    expect(b.score.state).toBe("score");
    expect(rows[1].score.state).toBe("measuring"); // 보유 6개월 미만
    expect(b.since).toMatchObject({ kind: "labeled", today: false });
    expect(b.since!.pct).toBeCloseTo(6.06, 1);
    expect(rows[1].since).toBeNull(); // 정한 날이 없으면 칸이 없다
    // 오늘 정하면 `오늘 정함`
    const today = setStockLabel(mk({}), "c:ETH", "keep", T(0), buildCryptoLabelBase([btc({ symbol: "eth", currentPrice: 5_000_000 })], "c:ETH"));
    expect(buildCryptoRows([btc({ symbol: "ETH", currentPrice: 5_000_000 })], today, NOW)[0].since).toMatchObject({ kind: "labeled", today: true });
    expect(today.items["c:ETH"].base).toEqual({ qty: 0.05, price: 5_000_000 }); // 비중은 쓰지 않는다
    // 키를 만들 수 없는 심볼 — 행은 보이고 정할 수 없다
    expect(buildCryptoRows([btc({ symbol: "한글코인" })], mk({}), NOW)[0]).toMatchObject({ labelKey: null, labelState: "unset" });
  });
  it("코인 조건 — 평단 대비 −N% 이하에 닿으면 점검 차례(주식과 같은 판정), hit = down", () => {
    const labels: StockLabels = mk({ "c:BTC": { ...item("check", 20, 150_000_000), plan: { down: 5 } } });
    const row = buildCryptoRows([btc({ averagePrice: 150_000_000 })], labels, NOW)[0]; // −6.7%
    expect(row.dueReason).toEqual({ kind: "down", pct: 5 });
    expect(hitOf(row.dueReason)).toBe("down");
    expect([hitOf({ kind: "date", months: 12, source: "keep" }), hitOf({ kind: "date", months: 3, source: "cycle" }), hitOf({ kind: "date", months: 6, source: "plan" }), hitOf(null)]).toEqual(["keep", "cycle", "plan", undefined]);
  });
  it("코인 카드 합계 = 상세 › 암호화폐 헤더 평가손익(getAssetSummary와 같은 식, 원 단위)", () => {
    const crypto = [btc(), btc({ id: "e", symbol: "ETH", quantity: 1.5, averagePrice: 4_123_457, currentPrice: 5_000_001 })];
    const t = cryptoTotal(crypto, buildCryptoRows(crypto, mk({}), NOW));
    const data = { crypto, stocks: [], cash: [], realEstate: [], loans: [], physicalAssets: [] } as never;
    const value = computeNetAsset(data, { USD: 1400, JPY: 9 }).cryptoValue;
    const cost = computeAssetCost(data, { USD: 1400, JPY: 9 }).cryptoCost;
    expect(t.profit).toBe(value - cost);
    expect(t.rate).toBe(((value - cost) / cost) * 100);
    expect(t.count).toBe(2);
  });
  it("부동산·실물 행 — 매입가 대비 %는 상세 카드와 같은 식. 점수·정한 날 대비·±% 조건 없음. 부동산이 위, 실물이 아래", () => {
    const labels: StockLabels = mk({ "r:re_1": item("keep", 400), "p:ph_1": { ...item("check", 20), plan: { down: 1, up: 1 } } });
    const rows = buildOwnRows([re(), re({ id: "re_0", name: "옛집", purchaseDate: "2010-01-01", marketEstimate: 590_000_000, marketEstimateDate: "2026-09-14" })], [ph(), ph({ id: "ph_0", name: "손목시계", purchasePrice: 0, purchaseDate: "" })], labels, NOW);
    expect(rows.map((r) => [r.kind, r.name])).toEqual([["real", "옛집"], ["real", "우리 집"], ["physical", "골드바"], ["physical", "손목시계"]]);
    const [old, home, gold, watch] = rows;
    expect(home.rate).toBeCloseTo(((620_000_000 - 500_000_000) / 500_000_000) * 100, 10);
    expect(gold.rate).toBeCloseTo(38.2, 5);
    for (const r of rows) expect([r.score.state, r.since, r.nowPrice, r.rep]).toEqual(["none", null, null, null]);
    expect(home).toMatchObject({ labelKey: "r:re_1", labelState: "keep", due: true, dueReason: { kind: "date", months: 12, source: "keep" } });
    expect(gold).toMatchObject({ labelKey: "p:ph_1", labelState: "check", due: false }); // ±% 조건(손상·다른 기기 값)은 차례 판정에 쓰지 않는다
    expect(old.own).toEqual({ assetId: "re_0", value: 620_000_000, estimate: 590_000_000, estimateDate: "2026-09-14" });
    expect(home.own).toEqual({ assetId: "re_1", value: 620_000_000 }); // 추정가가 없으면 참고값도 없다
    // 매입가 0원 실물 — %를 만들지 않는다(`—`·`0%` 없음), 매입일 없음 = 기간 미상
    expect([watch.rate, watch.holdText, watch.purchaseDate]).toEqual([null, "기간 미상", null]);
    // 기록에 남길 값 — 매입가 0이면 rate 0, 평가액 0이면 기록하지 않는다
    expect(ownSnap(watch)).toEqual({ price: 11_056_000, rate: 0 });
    expect(ownSnap(home)).toEqual({ price: 620_000_000, rate: home.rate });
    expect(ownSnap(buildOwnRows([], [ph({ currentValue: 0 })], labels, NOW)[0])).toBeNull();
  });
  it("부동산·실물에서 `그대로 두기`를 눌러도 어떤 보기의 `내 선택` 건수에도 들어가지 않는다", () => {
    const labels = mk({ "r:re_1": item("keep", 400) });
    const row = buildOwnRows([re()], [], labels, NOW)[0];
    const next = recordReview(labels, row.labelKey!, "same", T(0), ownSnap(row), undefined, hitOf(row.dueReason));
    expect(next.reviews).toEqual([{ t: "r:re_1", at: T(0), from: "keep", choice: "same", price: 620_000_000, rate: 24, hit: "keep" }]);
    for (const view of ["stock", "crypto"] as const) expect(computePick(next, view, held({ "r:re_1": 1 }), NOW + 40 * 86_400_000).events).toEqual([]);
    expect(buildOwnRows([re()], [], next, NOW)[0]).toMatchObject({ due: false, checkedToday: true });
  });
  it("전 종류 합 상태 — 차례 수 = 각 보기 `점검 차례` 행 수의 합. 단위는 부동산·실물이 섞이면 `개`", () => {
    const labels: StockLabels = mk({ "r:re_1": item("keep", 400), "c:BTC": { ...item("check", 20, 150_000_000), plan: { down: 5 } } });
    const boards = { stock: [], crypto: buildCryptoRows([btc({ averagePrice: 150_000_000 })], labels, NOW), own: buildOwnRows([re()], [ph()], labels, NOW) };
    const s = growStatus(boards);
    expect(s).toEqual({ kind: "due", due: 2, keep: 1, check: 1, count: 3, unit: "개" });
    expect(s.due).toBe(boards.crypto.filter((r) => r.due).length + boards.own.filter((r) => r.due).length);
    expect(growStatus({ ...boards, own: [] })).toMatchObject({ kind: "due", due: 1, unit: "종목" });
    // 차례가 코인뿐이면 부동산을 가졌어도 `종목`(그 합에 부동산·실물이 들어가지 않는다)
    expect(growStatus({ ...boards, own: buildOwnRows([re()], [], mk({}), NOW) })).toMatchObject({ kind: "due", due: 1, unit: "종목" });
    expect(growStatus({ stock: [], crypto: [], own: buildOwnRows([re()], [ph()], mk({}), NOW) })).toMatchObject({ kind: "first", count: 2, unit: "개" });
    expect(growStatus({ stock: [], crypto: [], own: [] }).kind).toBe("empty");
    // 처음 열리는 보기 — 차례가 있는 종류 중 순서상 첫째, 없으면 가진 종류 중 첫째
    expect([heldViews(boards), firstGrowView(boards), viewHasDue(boards, "own")]).toEqual([["crypto", "own"], "crypto", true]);
    expect(firstGrowView({ ...boards, crypto: buildCryptoRows([btc()], mk({}), NOW) })).toBe("own");
    expect(firstGrowView({ stock: [], crypto: buildCryptoRows([btc()], mk({}), NOW), own: buildOwnRows([re()], [], mk({}), NOW) })).toBe("crypto");
  });
});

describe("데모 시드 — 무조작 화면 값과 정합표(C132, AC-24)", () => {
  const raw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
  const RATES = { USD: 1400, JPY: 925 };
  const load = (today: string) => {
    const p = materializeDemo(raw, today) as { assetData: unknown; stockLabels: unknown };
    return { data: assetDataSchema.parse(p.assetData), labels: parseStockLabels(p.stockLabels)!, now: Date.parse(`${today}T03:00:00Z`) };
  };
  it.each(["2026-11-18", "2026-03-01", "2026-07-31", "2027-01-31", "2028-02-29"])("기준일 %s: 주식 `6번 중 5번은 그때보다 오름` — 정함 3·오름 2 / 그대로 두기 2·모두 오름 / 바꾸기 1·오름 1번, 주석 1·1, 안내 1, 매수 5건", (today) => {
    const { data, labels, now } = load(today);
    const r = computePick(labels, "stock", stockPickInput(data.stocks, data.transactions), now);
    expect(pickTextOf(pickHeadline(r))).toBe("6번 중 5번은 그때보다 오름");
    expect(PICK_ROWS.map((x) => [r.rows[x.kind].n, pickTextOf(pickUpText(r.rows[x.kind]))])).toEqual([[3, "오름 2번"], [2, "모두 오름"], [1, "오름 1번"]]);
    expect([r.hit.n, r.hit.up, r.late]).toEqual([1, 1, 1]);
    expect([r.buys.n, r.buys.up]).toEqual([5, 5]);
    // 금지 조합(`그대로 두기 모두 오름` + `바꾸기 오름 없음`)이 아니다 — 오르지 않은 1번은 정함에 있다
    expect(r.rows.move.up).toBeGreaterThan(0);
    expect(r.events.find((e) => e.kind === "set" && !e.up)!.key).toBe("AAPL");
    // 매수 건수 ↔ 거래 목록: 지금 가진 종목의 매수 거래 수
    expect(data.transactions.filter((t) => t.type === "buy")).toHaveLength(5);
  });
  it("정합표 3줄 — ① rate = 가격 ÷ 평단 − 1 ② 조건을 정한 날 ≤ 조건에 닿아 한 점검 날 ③ 실시간 배율로 옮긴 뒤에도 같은 %", () => {
    const { data, labels, now } = load("2026-11-18");
    const aapl = data.stocks.find((s) => s.ticker === "AAPL")!;
    const hit = labels.reviews!.find((r) => r.hit)!;
    expect([hit.t, hit.hit, hit.price]).toEqual(["AAPL", "down", 166]);
    expect(hit.rate).toBe(Math.round((166 / aapl.averagePrice - 1) * 1000) / 10); // −10.3
    expect(hit.rate).toBeLessThanOrEqual(-labels.items.AAPL.plan!.down!);
    expect(labels.items.AAPL.plan!.at! <= hit.at).toBe(true);
    const before = computePick(labels, "stock", stockPickInput(data.stocks, data.transactions), now);
    expect(pickAfterOf(before, "AAPL", hit.at)).toEqual({ kind: "next", pct: 23.5 });
    // 실시간 시세(주식 2.4배·코인 1.3배)로 덮인 데모 — 기록 가격·정한 날 가격이 같은 배율로 옮겨진다
    const live = { ...data, stocks: data.stocks.map((s) => ({ ...s, currentPrice: s.currentPrice * 2.4 })), crypto: data.crypto.map((c) => ({ ...c, currentPrice: c.currentPrice * 1.3 })) };
    const moved = rebaseDemoLabelPrices(labels, labels, priceByAnyLabelKey(data.stocks, data.crypto), priceByAnyLabelKey(live.stocks, live.crypto));
    const after = computePick(moved, "stock", stockPickInput(live.stocks, live.transactions), now);
    expect(after.events.map((e) => [e.key, e.kind, e.pct])).toEqual(before.events.map((e) => [e.key, e.kind, e.pct]));
    expect(moved.reviews!.map((r) => r.rate)).toEqual(labels.reviews!.map((r) => r.rate)); // rate는 평단과 같은 눈금이라 옮기지 않는다
    // 코인 키(c:)도 옮긴다 — 안 옮기면 정한 날 대비가 +37.9%로 튄다
    expect(moved.items["c:BTC"].base!.price).toBeCloseTo(132_000_000 * 1.3, 3);
    expect(buildCryptoRows(live.crypto, moved, now)[0].since!.pct).toBeCloseTo(6.06, 1);
    expect(buildCryptoRows(live.crypto, labels, now)[0].since!.pct).toBeGreaterThan(30);
    expect(moved.items["r:demo_re_1"]).toEqual(labels.items["r:demo_re_1"]); // 부동산 항목은 시세가 없어 그대로
  });
  it.each(["2026-11-18", "2026-03-01", "2027-01-31"])("기준일 %s: 종류 3개가 조작 없이 보이고 세그먼트·허브 수 = 주식 3 + 부동산 1 = `점검 차례 4개`. 코인은 `기록 1번`으로 아직 못 셈", (today) => {
    const { data, labels, now } = load(today);
    const boards = buildGrowBoards(data, RATES, labels, now);
    expect(heldViews(boards)).toEqual(["stock", "crypto", "own"]);
    expect(firstGrowView(boards)).toBe("stock");
    expect(growStatus(boards)).toMatchObject({ kind: "due", due: 4, unit: "개", keep: 3, check: 3 });
    expect([boards.stock.filter((r) => r.due).length, boards.crypto.filter((r) => r.due).length, boards.own.filter((r) => r.due).length]).toEqual([3, 0, 1]);
    const coin = boards.crypto[0];
    expect([coin.labelState, coin.due, coin.score.state]).toEqual(["check", false, "score"]);
    expect(Math.round(coin.since!.pct * 10) / 10).toBe(6.1);
    expect(Math.round(coin.rate! * 10) / 10).toBe(16.7);
    // 정한 날 수량 0.04 = 지금 0.05 − 정한 뒤 매수 0.01
    const boughtAfter = data.cryptoTransactions.filter((t) => t.date >= labels.items["c:BTC"].labeledAt.slice(0, 10)).reduce((s, t) => s + t.quantity, 0);
    expect(labels.items["c:BTC"].base!.qty).toBeCloseTo(data.crypto[0].quantity - boughtAfter, 10);
    const pick = computePick(labels, "crypto", cryptoPickInput(data.crypto, data.cryptoTransactions), now);
    expect(pickTextOf(pickHeadline(pick))).toBe("기록 1번 ·30일 지난 3번부터 보여요");
    expect(pick.state).toBe("wait");
    const home = boards.own[0];
    expect([home.name, home.labelState, home.due, Math.round(home.rate! * 10) / 10]).toEqual(["데모 아파트", "keep", true, 7.2]);
    expect(home.holdText).toMatch(/^(3년|2년 11개월)$/); // 매입 @M-36D15 — 그 달 15일 전이면 2년 11개월
    expect(home.own!.estimate).toBeUndefined(); // 데모 아파트에는 추정가가 없다(실거래 추정 줄은 직접 등록으로 확인)
  });
  it("시드 변경은 stockLabels뿐 — assetData·snapshots는 main 712d283과 같다(C134)", () => {
    // 자산·스냅샷 원문 해시(이 값이 바뀌면 홈·결산·성적표 숫자가 번진다)
        const h = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex").slice(0, 16);
    expect([h(raw.assetData), h(raw.snapshots), h(raw.xrayClassifications)]).toEqual(SEED_HASH);
  });
});
const SEED_HASH = ["23f860b9bb5b27d6", "ba623b2607de141b", "758c136fb63c0bc2"];
