// #242 [5.127] 복원·호환 7행 — "이전 버전(5.125) 데이터 → 새 버전"과 그 반대, 3자 동기화, 백업·롤백, 키 충돌, 삭제 뒤 남은 항목, 상한·격리.
// 옛 기기 = main 712d283의 stock-labels.ts를 그대로 둔 사본(fixtures/stock-labels-5125.ts, 수정 0 — 아래 첫 테스트가 해시를 고정한다).
// 저장 키·v:1·items·reviews는 그대로이고 마이그레이션 코드가 없다. 새 버전이 더한 것은 소문자 접두 키(c:·r:·p:)와 기록의 hit 필드뿐이다.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import * as cur from "../asset/stock-labels";
import * as old from "./fixtures/stock-labels-5125";
import { STORAGE_KEYS } from "../local-storage";
import { materializeDemo } from "../preview/demo-payload";
import { computePick } from "../asset/grow-pick";
import { buildOwnRows, buildCryptoRows, growStatus } from "../asset/grow-kinds";
import { g, memoryStorage } from "./physical-fixtures";
import type { Crypto, PhysicalAsset, RealEstate } from "@/types/asset";

const KEY = STORAGE_KEYS.stockLabels;
const T = (d: number, h = 3) => new Date(Date.UTC(2026, 10, 18, h) - d * 86_400_000).toISOString();
const NOW = Date.parse("2026-11-18T03:00:00Z");
const on = (s: Storage) => { g.localStorage = s; };
const raw = () => localStorage.getItem(KEY)!;

beforeEach(() => { g.window = globalThis; g.localStorage = memoryStorage(); });
afterEach(() => { delete g.window; delete g.localStorage; });

/** 새 버전이 쓴 값 — 주식 + 코인·부동산·실물 + hit 기록 */
function newValue(): cur.StockLabels {
  let v = cur.emptyStockLabels();
  v = cur.setStockLabelCycle(v, 3, T(300));
  v = cur.setStockLabel(v, "AAPL", "check", T(200), { qty: 10, price: 190, priceAt: "2026-05-02", weight: 20 });
  v = cur.setStockPlan(v, "AAPL", { down: 10, memo: "실적 뒤 다시 보기" }, T(199));
  v = cur.recordReview(v, "AAPL", "same", T(150), { price: 166, rate: -10.3 }, undefined, "down");
  v = cur.setStockLabel(v, "c:BTC", "check", T(120), { qty: 0.04, price: 132_000_000, priceAt: "2026-07-21" });
  v = cur.setStockPlan(v, "c:BTC", { down: 20, months: 6 }, T(119));
  v = cur.recordReview(v, "c:BTC", "same", T(60), { price: 120_000_000, rate: -9.1 }, undefined, "plan");
  v = cur.setStockLabel(v, "r:re_1731900000000", "keep", T(400));
  v = cur.recordReview(v, "r:re_1731900000000", "same", T(30), { price: 535_840_000, rate: 7.2 }, undefined, "keep");
  v = cur.setStockLabel(v, "p:ph_1731900000001", "check", T(90));
  v = cur.setStockPlan(v, "p:ph_1731900000001", { months: 12, memo: "보험 갱신 전 다시 보기" }, T(89));
  v = cur.recordReview(v, "p:ph_1731900000001", "keep", T(10), { price: 9_000_000, rate: 0 }, undefined, "cycle");
  return v;
}
const others = (v: { items: Record<string, unknown>; reviews?: { t: string }[] }) => ({
  items: Object.fromEntries(Object.entries(v.items).filter(([k]) => /^[a-z]:/.test(k))),
  reviews: (v.reviews ?? []).filter((r) => /^[a-z]:/.test(r.t)),
});

describe("0. 옛 기기 하네스", () => {
  it("fixtures/stock-labels-5125.ts = main 712d283 원문(수정 0)", () => {
    const src = readFileSync(path.resolve(__dirname, "fixtures/stock-labels-5125.ts"));
    expect(createHash("sha256").update(src).digest("hex")).toBe("4a2aa510bf38c78afbd5872bfc4dc82e315715777523dde4b4df914e1c234b6c");
    expect(src.toString("utf8").split("\n")).toHaveLength(555);
  });
  it("저장 키·버전은 그대로다(v:1, 새 키·새 최상위 필드·마이그레이션 없음)", () => {
    expect(KEY).toBe("secretasset.stock_labels");
    expect(Object.keys(newValue()).sort()).toEqual(["cycle", "items", "reviews", "v"]);
    expect(newValue().v).toBe(1);
    expect(cur.parseStockLabels({ v: 2, items: {} })).toBeNull(); // v를 올리면 5.125가 손상으로 본다 — 올리지 않는다
    expect(old.parseStockLabels({ v: 2, items: {} })).toBeNull();
  });
});

describe("1. 5.125 실값 → 새 버전 읽기·재저장", () => {
  const demoRaw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
  it("5.125가 쓴 값(항목·plan·reviews·미래 필드 4곳)은 새 버전이 읽고 다시 써도 바이트가 같고 hit 키가 생기지 않는다", () => {
    // 5.125 데모 시드 꼴(주식만, hit 없음)을 옛 코드로 저장
    const seed = materializeDemo(demoRaw, "2026-11-18") as { stockLabels: Record<string, unknown> };
    const { items, reviews, ...rest } = seed.stockLabels as { items: Record<string, unknown>; reviews: Record<string, unknown>[] };
    const legacy = {
      ...rest,
      futureTop: { n: 1 },
      cycle: { months: 3, at: T(250), futureCycle: "x" },
      items: Object.fromEntries(Object.entries(items).filter(([k]) => !/^[a-z]:/.test(k)).map(([k, v], i) => [k, i === 0 ? { ...(v as object), futureItem: [1, 2], base: { ...((v as { base?: object }).base ?? { qty: 1 }), futureBase: true } } : v])),
      reviews: reviews.map(({ hit: _hit, ...r }, i) => (i === 0 ? { ...r, futureReview: "y" } : r)),
    };
    old.writeStockLabels(old.parseStockLabels(legacy)!);
    const before = raw();
    expect(before).not.toContain('"hit"');
    const read = cur.readStockLabelsState();
    expect(read.state).toBe("ok");
    cur.writeStockLabels(read.value!);
    expect(raw()).toBe(before);
    for (const f of ["futureTop", "futureCycle", "futureItem", "futureBase", "futureReview"]) expect(raw()).toContain(f);
    // 새 버전의 화면용 판정이 5.125 값에서 그대로 나온다(GA 판정 포함)
    expect(cur.countValidLabels(read.value!)).toBe(old.countValidLabels(old.readStockLabels()));
    expect(cur.countValidOtherLabels(read.value!)).toBe(0);
  });
  it("5.125에서 누른 기록에는 hit이 없어 `조건에 닿아 점검` 행에 들어가지 않는다(되살릴 수 없음 — 한계)", () => {
    let v = old.setStockLabel(old.emptyStockLabels(), "AAPL", "check", T(200), { qty: 10, price: 190 });
    v = old.recordReview(v, "AAPL", "same", T(150), { price: 166, rate: -10.3 });
    v = old.recordReview(v, "AAPL", "same", T(100), { price: 205, rate: 10.8 });
    old.writeStockLabels(v);
    const pick = computePick(cur.readStockLabels(), "stock", { held: new Map([["AAPL", { qty: 12, nowPrice: 225 }]]), buys: [], sells: new Map() }, NOW);
    expect([pick.n, pick.up, pick.hit.n]).toEqual([3, 2, 0]);
  });
});

describe("2. 새 버전 값 → 5.125 읽기·편집·저장 → 새 버전 재읽기", () => {
  it("5.125가 주식을 정하고·옮기고·점검하고·조건을 바꿔도 주식 외 항목·기록·hit이 무손실", () => {
    const v = newValue();
    cur.writeStockLabels(v);
    const want = others(v);
    // 옛 기기: 읽기 → 주식 편집 4종 → 저장
    let o = old.readStockLabels();
    expect(Object.keys(o.items).sort()).toEqual(Object.keys(v.items).sort()); // 키 정규식을 그대로 통과
    o = old.setStockLabel(o, "005930", "keep", T(5), { qty: 50, price: 64000 });
    o = old.recordReview(o, "AAPL", "keep", T(4), { price: 210, rate: 13.5 }); // 옮기기
    o = old.recordReview(o, "005930", "same", T(3), { price: 70000, rate: 9.4 });
    o = old.setStockLabelCycle(o, 6, T(2));
    old.writeStockLabels(o);
    const back = cur.readStockLabels();
    expect(others(back)).toEqual(want);
    expect(back.reviews!.filter((r) => r.hit).map((r) => [r.t, r.hit]).sort()).toEqual([["AAPL", "down"], ["c:BTC", "plan"], ["p:ph_1731900000001", "cycle"], ["r:re_1731900000000", "keep"]]);
    expect(back.items["c:BTC"].plan).toMatchObject({ down: 20, months: 6 });
    expect(back.items["p:ph_1731900000001"].label).toBe("keep"); // 실물은 @D-10에 장기 보유로 바꿨다
    expect(back.items.AAPL.label).toBe("keep");
    // 옛 기기가 다시 쓴 값을 새 버전이 재저장해도 값이 같다
    cur.writeStockLabels(back);
    expect(cur.sameStockLabels(cur.readStockLabels(), back)).toBe(true);
  });
  it("hit이 5종 밖이면 새 버전은 그 필드만 버리고 기록은 남긴다", () => {
    const v = cur.parseStockLabels({ v: 1, cycle: { months: null, at: "" }, items: {}, reviews: [{ t: "AAPL", at: T(40), from: "check", choice: "same", price: 100, rate: 1, hit: "moon" }, { t: "AAPL", at: T(50), from: "check", choice: "same", price: 100, rate: 1, hit: "up" }] })!;
    expect(v.reviews!.map((r) => r.hit)).toEqual([undefined, "up"]);
    expect("hit" in v.reviews![0]).toBe(false);
  });
});

describe("3. 새 A ↔ 5.125 B ↔ 새 C 동기화", () => {
  type Mod = { applyIncomingStockLabels: typeof cur.applyIncomingStockLabels; readStockLabelsForExport: () => unknown };
  const mod = (n: string): Mod => (n === "B" ? (old as unknown as Mod) : cur);
  const setup = () => {
    const dev: Record<string, Storage> = { A: memoryStorage(), B: memoryStorage(), C: memoryStorage() };
    on(dev.A);
    cur.writeStockLabels(newValue());
    on(dev.B);
    let b = old.setStockLabel(old.emptyStockLabels(), "005930", "keep", T(20), { qty: 50, price: 64000 });
    b = old.setStockLabel(b, "AAPL", "check", T(210), { qty: 9, price: 180 }); // A의 AAPL(@T199)보다 옛 값 — 진다
    b = old.recordReview(b, "005930", "same", T(8), { price: 70000, rate: 9.4 });
    old.writeStockLabels(b);
    on(dev.C);
    // C는 코인을 '정하지 않음'으로 뺐다(삭제 표식, A의 항목보다 새 값)
    let c = cur.setStockLabel(cur.emptyStockLabels(), "c:BTC", "check", T(130), { qty: 0.04, price: 130_000_000 });
    c = cur.recordReview(c, "c:BTC", "none", T(1), { price: 140_000_000, rate: 16.7 }, undefined, "down");
    cur.writeStockLabels(c);
    return dev;
  };
  // push = 그 기기의 내보내기 값, pull = 그 기기의 병합 수신. 서버는 마지막 push 값만 든다
  const sync = (dev: Record<string, Storage>, order: string[]) => {
    let server: unknown;
    let pushes = 0;
    for (let round = 0; round < 4; round++) {
      for (const n of order) {
        on(dev[n]);
        const repush = server === undefined ? true : mod(n).applyIncomingStockLabels(server, { merge: true }).repush;
        if (repush) { server = JSON.parse(JSON.stringify(mod(n).readStockLabelsForExport())); pushes++; }
      }
    }
    return { pushes, values: Object.fromEntries(Object.entries(dev).map(([n, s]) => { on(s); return [n, cur.readStockLabels()]; })) };
  };
  const ORDERS = [["A", "B", "C"], ["A", "C", "B"], ["B", "A", "C"], ["B", "C", "A"], ["C", "A", "B"], ["C", "B", "A"]];
  it("순서 6가지 결과가 같고(교환·결합), 세 기기가 같은 값으로 모이며, 더 돌려도 바뀌지 않는다(멱등 — 재-push가 멈춘다)", () => {
    const results = ORDERS.map((o) => sync(setup(), o));
    const first = results[0].values.A;
    for (const r of results) for (const n of ["A", "B", "C"]) expect(cur.sameStockLabels(r.values[n], first)).toBe(true);
    // 4바퀴(12번) 가운데 push는 처음 몇 번뿐 — 끝없이 다시 올리지 않는다
    for (const r of results) expect(r.pushes).toBeLessThanOrEqual(6);
    const dev = setup();
    const once = sync(dev, ORDERS[0]);
    const again = sync(dev, ORDERS[3]);
    expect(cur.sameStockLabels(again.values.B, once.values.B)).toBe(true);
    expect(again.pushes).toBeLessThanOrEqual(1);
  });
  it("삭제 표식(label: null)이 5.125 기기를 거쳐도 되살아나지 않고, 주식 외 기록·hit은 합집합으로 남는다", () => {
    for (const o of ORDERS) {
      const { values } = sync(setup(), o);
      for (const n of ["A", "B", "C"]) {
        const v = values[n];
        expect(v.items["c:BTC"].label, `${o.join("")} ${n}`).toBeNull();
        expect(v.items["r:re_1731900000000"].label).toBe("keep");
        expect(v.items.AAPL.base?.qty).toBe(10); // 더 새 A 값이 이긴다
        expect(v.items["005930"].label).toBe("keep");
        expect(v.reviews!.filter((r) => r.t === "c:BTC").map((r) => [r.choice, r.hit]).sort()).toEqual([["none", "down"], ["same", "plan"]]);
      }
    }
  });
});

describe("4. 백업 내보내기·복원 양방향, 롤백", () => {
  it("새 내보내기 → 5.125 가져오기 → 5.125 내보내기 → 새 가져오기: 무손실", () => {
    const v = newValue();
    cur.writeStockLabels(v);
    const file1 = JSON.parse(JSON.stringify(cur.readStockLabelsForExport()));
    on(memoryStorage());
    old.applyIncomingStockLabels(file1, { merge: false });
    const file2 = JSON.parse(JSON.stringify(old.readStockLabelsForExport()));
    on(memoryStorage());
    cur.applyIncomingStockLabels(file2, { merge: false });
    expect(cur.sameStockLabels(cur.readStockLabels(), v)).toBe(true);
  });
  it("롤백 — 새 값 위에서 5.125 코드만 돌아도 값이 유지되고, 다시 새 코드로 오면 주식 외 항목이 그대로 보인다", () => {
    const v = newValue();
    cur.writeStockLabels(v);
    // 롤백 동안: 옛 코드가 읽고(손상 아님) 주식을 고치고 저장
    expect(old.readStockLabelsState().state).toBe("ok");
    old.writeStockLabels(old.markStockChecked(old.readStockLabels(), "AAPL", T(0)));
    // 옛 화면이 그리는 것은 주식 행뿐이다(행은 보유 주식에서만 만든다) — 주식 외 항목은 저장소에 남아 있을 뿐
    expect(Object.keys(old.readStockLabels().items).filter((k) => /^[a-z]:/.test(k))).toHaveLength(3);
    const back = cur.readStockLabels();
    expect(others(back)).toEqual(others(v));
    expect(back.items.AAPL.checkedAt).toBe(T(0));
  });
  it("한계(기록) — 5.125에 머문 기기는 주식 외 항목을 주식 이름표로 센다(GA `·정함` 미전송·`·다시 봄` 전송)", () => {
    const coinOnly = cur.setStockLabel(cur.emptyStockLabels(), "c:BTC", "check", T(5), { qty: 1, price: 1 });
    expect([old.countValidLabels(coinOnly as never), old.isStockLabelRevisit(coinOnly as never, NOW)]).toEqual([1, true]);
    // 새 버전은 주식 키만 본다
    expect([cur.countValidLabels(coinOnly), cur.isStockLabelRevisit(coinOnly, NOW), cur.countValidOtherLabels(coinOnly)]).toEqual([0, false, 1]);
  });
});

describe("5. 코인 BTC + 해외 티커 BTC 동시 보유", () => {
  it("서로 다른 항목·다른 기록이고, 한쪽 12건 상한이 다른 쪽을 밀지 않는다. 보기별 건수도 따로다", () => {
    expect(cur.cryptoLabelKey(" btc ")).toBe("c:BTC");
    expect([cur.labelKeyKind("BTC"), cur.labelKeyKind("c:BTC"), cur.labelKeyKind("r:x"), cur.labelKeyKind("p:x"), cur.labelKeyKind("s:x"), cur.labelKeyKind("005930")]).toEqual(["stock", "crypto", "real", "physical", "reserved", "stock"]);
    let v = cur.setStockLabel(cur.emptyStockLabels(), "BTC", "keep", T(500), { qty: 3, price: 40 });
    v = cur.setStockLabel(v, "c:BTC", "check", T(500), { qty: 0.1, price: 100_000_000 });
    for (let i = 0; i < 14; i++) v = cur.recordReview(v, "c:BTC", "same", T(480 - i * 31), { price: 100_000_000 + i, rate: i });
    v = cur.recordReview(v, "BTC", "same", T(100), { price: 44, rate: 10 });
    expect(v.items.BTC.label).toBe("keep");
    expect(v.items["c:BTC"].label).toBe("check");
    expect(v.reviews!.filter((r) => r.t === "c:BTC")).toHaveLength(cur.STOCK_REVIEW_LIMIT);
    expect(v.reviews!.filter((r) => r.t === "BTC")).toHaveLength(1);
    const input = { held: new Map([["BTC", { qty: 3, nowPrice: 50 }], ["c:BTC", { qty: 0.1, nowPrice: 140_000_000 }]]), buys: [], sells: new Map() };
    const stock = computePick(v, "stock", input, NOW);
    const coin = computePick(v, "crypto", input, NOW);
    expect(stock.events.every((e) => e.key === "BTC")).toBe(true);
    expect(coin.events.every((e) => e.key === "c:BTC")).toBe(true);
    expect(stock.n).toBe(2); // 정함 1 + 그대로 두기 1
    expect(coin.n).toBe(13); // 정함 1 + 남은 기록 12
    // 옛 기기를 거쳐도 둘은 섞이지 않는다
    old.writeStockLabels(old.parseStockLabels(JSON.parse(JSON.stringify(v)))!);
    expect(cur.sameStockLabels(cur.readStockLabels(), v)).toBe(true);
  });
});

describe("6. 자산 삭제 뒤 남은 항목", () => {
  const re = (id: string): RealEstate => ({ id, type: "apartment", name: "우리 집", purchasePrice: 500_000_000, currentValue: 620_000_000, purchaseDate: "2019-09-01" } as RealEstate);
  const ph = (id: string): PhysicalAsset => ({ id, type: "gold", name: "골드바", purchasePrice: 8_000_000, currentValue: 11_000_000, purchaseDate: "2023-10-01" } as PhysicalAsset);
  const btc: Crypto = { id: "cr_1", name: "비트코인", symbol: "BTC", quantity: 0.05, averagePrice: 120_000_000, currentPrice: 140_000_000, purchaseDate: "2025-11-10" } as Crypto;
  it("지운 자산의 항목·기록은 저장소에 남아도 행·`내 선택` 건수·허브 차례 수에 나타나지 않는다", () => {
    const v = newValue(); // r:·p:·c: 모두 정해 둔 값(부동산은 400일 전 장기 보유 = 점검 차례였다)
    const withAssets = { stock: [], crypto: buildCryptoRows([btc], v, NOW), own: buildOwnRows([re("re_1731900000000")], [ph("ph_1731900000001")], v, NOW) };
    expect(growStatus(withAssets).count).toBe(3);
    const gone = { stock: [], crypto: buildCryptoRows([], v, NOW), own: buildOwnRows([], [], v, NOW) };
    expect(growStatus(gone)).toMatchObject({ kind: "empty", due: 0, keep: 0, check: 0, count: 0 });
    // 코인을 지웠고 매도 기록이 없다 → 그 기록 전부가 건수에서 빠진다
    const pick = computePick(v, "crypto", { held: new Map(), buys: [], sells: new Map() }, NOW);
    expect([pick.n, pick.records, pick.late, pick.state]).toEqual([0, 0, 0, "wait"]);
    expect(Object.keys(v.items)).toContain("r:re_1731900000000"); // 저장 값은 지우지 않는다
  });
  it("부동산·실물은 같은 이름으로 다시 등록해도(새 id) 옛 결정이 붙지 않는다. 코인은 같은 심볼에 다시 붙는다(5.125 주식과 같은 동작)", () => {
    const v = newValue();
    const rows = buildOwnRows([re("re_1799999999999")], [ph("ph_1799999999998")], v, NOW);
    expect(rows.map((r) => [r.name, r.labelState, r.due])).toEqual([["우리 집", "unset", false], ["골드바", "unset", false]]);
    expect(buildCryptoRows([{ ...btc, id: "cr_new" }], v, NOW)[0].labelState).toBe("check");
  });
});

describe("7. 상한·격리·전송", () => {
  it("키당 13건째에서 12건 유지 + hit 유지. 새 버전이 쓰는 hit은 5.125의 모르는 필드 상한(256B) 안이다", () => {
    let v = cur.setStockLabel(cur.emptyStockLabels(), "r:re_1", "keep", T(900));
    for (let i = 0; i < 13; i++) v = cur.recordReview(v, "r:re_1", "same", T(800 - i * 40), { price: 500_000_000 + i, rate: 1 }, undefined, "keep");
    expect(v.reviews).toHaveLength(12);
    expect(v.reviews!.every((r) => r.hit === "keep")).toBe(true);
    expect(JSON.stringify({ hit: "cycle" }).length).toBeLessThan(old.STOCK_LABEL_EXTRA_LIMIT.review);
    const through = old.parseStockLabels(JSON.parse(JSON.stringify(v)))!;
    expect((through.reviews as unknown as { hit?: string }[]).every((r) => r.hit === "keep")).toBe(true);
  });
  it("미래 필드가 함께 붙어 257B를 넘으면 5.125는 모르는 필드만 버리고 기록은 남긴다(한계 — 선택 필드는 합계 200B 이하로 쓴다)", () => {
    const big = { t: "c:BTC", at: T(40), from: "check", choice: "same", price: 1, rate: 1, hit: "down", pad: "x".repeat(250) };
    const o = old.parseStockLabels({ v: 1, cycle: { months: null, at: "" }, items: {}, reviews: [big] })!;
    expect(o.reviews).toHaveLength(1);
    expect("hit" in o.reviews![0]).toBe(false);
    // 새 버전은 hit을 아는 필드로 읽어 같은 값에서도 hit을 지킨다
    expect(cur.parseStockLabels({ v: 1, cycle: { months: null, at: "" }, items: {}, reviews: [big] })!.reviews![0].hit).toBe("down");
  });
  it("범위 밖 값은 5.125와 같은 규칙으로 걸러진다 — 부동산·실물 기록도 price 양수·rate 유한수·from·choice 집합 안", () => {
    const bad = (r: object) => ({ v: 1, cycle: { months: null, at: "" }, items: {}, reviews: [{ t: "p:ph_1", at: T(40), from: "check", choice: "same", price: 1, rate: 0, ...r }] });
    for (const m of [cur, old]) {
      expect(m.parseStockLabels(bad({}))!.reviews).toHaveLength(1); // 매입가 0원 실물의 rate 0은 정상 기록
      expect(m.parseStockLabels(bad({ price: 0 }))!.reviews).toBeUndefined();
      expect(m.parseStockLabels(bad({ rate: Number.NaN }))!.reviews).toBeUndefined();
      expect(m.parseStockLabels(bad({ from: "none" }))!.reviews).toBeUndefined();
    }
  });
  it("체험·데모 격리 — 저장소를 바꾸면(체험은 메모리 Storage) 실제 저장소 키에 닿지 않는다", () => {
    const real = memoryStorage();
    const trial = memoryStorage();
    on(real);
    cur.writeStockLabels(cur.setStockLabel(cur.emptyStockLabels(), "AAPL", "keep", T(9)));
    const before = raw();
    on(trial);
    cur.writeStockLabels(newValue());
    on(real);
    expect(raw()).toBe(before);
    expect(raw()).not.toContain("c:BTC");
  });
  it("전송 — 이름표·`내 선택`을 읽는 파일이 정해진 곳뿐이다(AI 프롬프트·공유·알림·API 라우트 0, 홈은 #245 팁 상자 1곳만 읽기 전용)", () => {
    const root = path.resolve(__dirname, "../..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = path.join(dir, name);
        if (statSync(p).isDirectory()) { if (name !== "__tests__" && name !== "node_modules") walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(name)) continue;
        if (/grow-pick|grow-kinds|stock-labels|grow-board/.test(readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""))) hits.push(path.relative(root, p));
      }
    };
    walk(root);
    // #245(5.130): 홈 팁 상자 1곳만 읽기 전용으로 읽는다(점검 차례 수·단위·이유 문장 — 종목명·금액·수량 없음, 서버 전송 0). 홈의 다른 파일·AI 프롬프트·공유·알림·API는 그대로 0
    const HOME_TIP = "app/(main)/_components/views/home/home-tip-box.tsx";
    for (const f of hits) if (f !== HOME_TIP) expect(f, f).not.toMatch(/^app\/api\/|ai-prompts|share|push|home|analytics/);
    expect(hits).toContain(HOME_TIP);
    const tipBox = readFileSync(path.join(root, HOME_TIP), "utf8");
    expect(tipBox).not.toMatch(/fetch\(|writeStockLabels|recordReview|setStockLabel|setStockPlan/);
    expect(tipBox).toContain('track("feature_use", { category: "home_tip_due" })'); // 나가는 것은 title 1개뿐(수·종목 미전송)
    expect(hits.some((f) => f.endsWith("stock-label-block.tsx"))).toBe(true);
  });
});
