// #239 [5.125 4·5차] 점검 기록(reviews)·다시 볼 조건(plan) 복원 테스트 — tech-review 4차 R1~R10·C1~C2, redesign 5-5 P1~P8.
// 기존 ①~⑩(stock-labels-storage·sync·merge)은 그대로 두고, 이 파일은 새 필드만 본다. 운영에 키가 없어(미머지) v:1·마이그레이션 없음
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { applyImportedPayload, buildExportPayload, getAssetData, saveAssetData } from "../asset/asset-storage";
import {
  applyIncomingStockLabels, cleanPlanMemo, clearStockLabels, emptyStockLabels, hasStockLabelRecords, markStockChecked, mergeStockLabels,
  normalizeReviews, parseStockLabels, readStockLabels, readStockLabelsState, recordReview, sameStockLabels, setStockLabel, setStockLabelCycle,
  setStockPlan, STOCK_REVIEW_LIMIT, writeStockLabels, type StockLabelReview, type StockLabels,
} from "../asset/stock-labels";
import { buildBoardRows } from "../asset/grow-board";
import { stockLabelActions } from "@/hooks/use-stock-labels";
import { STORAGE_KEYS } from "../local-storage";
import { cashItem, g, memoryStorage } from "./physical-fixtures";

vi.mock("@/contexts/asset-data-context", () => ({ notifyAssetUserEdit: vi.fn(), useAssetData: vi.fn() }));
vi.mock("@/lib/analytics/ga", () => ({ track: vi.fn() }));

const KEY = STORAGE_KEYS.stockLabels;
const T = (d: string) => `${d}T03:00:00.000Z`;
const SNAP = { price: 205, rate: 10.8 };
const raw = () => localStorage.getItem(KEY);

// cb36907 형태 2벌(reviews·plan 없음) — 기존 형태 / base + 미래 필드(최상위·cycle·항목·base 4곳)
const cbPlain = (): StockLabels => {
  let s = setStockLabel(emptyStockLabels(), "005930", "keep", T("2026-09-01"));
  s = setStockLabel(s, "AAPL", "check", T("2026-09-02"));
  s = markStockChecked(s, "AAPL", T("2026-10-02"));
  s = setStockLabel(s, "NVDA", null, T("2026-10-03"));
  return setStockLabelCycle(s, 3, T("2026-09-01"));
};
const cbRich = (): StockLabels => {
  const s = cbPlain();
  return {
    ...s,
    futureTop: { from: "다음 버전" },
    cycle: { ...s.cycle, futureCycle: 1 },
    items: { ...s.items, AAPL: { ...s.items.AAPL, base: { qty: 12.5, price: 185.5, futureBase: [1] }, futureItem: "x" } },
  };
};
const rv = (t: string, at: string, o: Partial<StockLabelReview> = {}): StockLabelReview => ({ t, at, from: "check", choice: "same", price: 100, rate: 1, ...o });
const withReviews = (s: StockLabels, list: StockLabelReview[]): StockLabels => ({ ...s, reviews: normalizeReviews(list) });

// 시드 고정 난수(결합 테스트용)
const rng = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);

beforeEach(() => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  g.localStorage = memoryStorage();
});
afterEach(() => { delete g.window; delete g.localStorage; });

describe.each([["기존 형태", cbPlain], ["base + 미래 필드", cbRich]])("R1·P1 — cb36907 값(%s)", (_n, seed) => {
  it("읽으면 reviews·plan 없음, items·cycle·base·모르는 필드 원문 그대로. 다시 쓰면 바이트가 같다(빈 reviews·plan은 키를 쓰지 않는다)", () => {
    const text = JSON.stringify(seed());
    localStorage.setItem(KEY, text);
    const v = readStockLabels();
    expect(v.reviews).toBeUndefined();
    expect(Object.values(v.items).some((i) => "plan" in i)).toBe(false);
    expect(sameStockLabels(v, parseStockLabels(JSON.parse(text))!)).toBe(true);
    writeStockLabels(v);
    expect(JSON.parse(raw()!)).toEqual(JSON.parse(text));
    expect("reviews" in JSON.parse(raw()!)).toBe(false);
  });
});

describe("R2 — 저장 → 읽기 왕복, 정규화 멱등", () => {
  it("무작위 순서·중복이 있어도 읽으면 정렬·티커당 12건, 다시 읽어도 같다", () => {
    const list = Array.from({ length: 15 }, (_, i) => rv("AAPL", T(`2026-0${(i % 9) + 1}-1${i % 10}`), { rate: i }));
    writeStockLabels({ ...cbPlain(), reviews: [...list].reverse() });
    const a = readStockLabels();
    expect(a.reviews!.filter((r) => r.t === "AAPL")).toHaveLength(STOCK_REVIEW_LIMIT);
    writeStockLabels(a);
    expect(sameStockLabels(readStockLabels(), a)).toBe(true);
    expect(raw()).toBe(JSON.stringify(a));
  });
});

describe("R3·R4·R5·R6 — 병합 교환·결합·동률·상한", () => {
  const A = withReviews(cbPlain(), [rv("AAPL", T("2026-07-16")), rv("AAPL", T("2026-06-11"))]);
  const B = withReviews(cbPlain(), [rv("AAPL", T("2026-08-01")), rv("NVDA", T("2026-09-19"), { choice: "none" })]);
  it("R3 두 기기 이력 합집합 + 교환", () => {
    const m = mergeStockLabels(A, B);
    expect(m.reviews!.map((r) => `${r.t}@${r.at.slice(0, 10)}`)).toEqual(["AAPL@2026-08-01", "AAPL@2026-07-16", "AAPL@2026-06-11", "NVDA@2026-09-19"]);
    expect(sameStockLabels(m, mergeStockLabels(B, A))).toBe(true);
  });
  it("R4 세 기기 결합(무작위 50회, 시드 고정)", () => {
    const r = rng(7);
    const gen = () => withReviews(cbPlain(), Array.from({ length: Math.floor(r() * 20) }, () =>
      rv(["AAPL", "NVDA"][Math.floor(r() * 2)], T(`2026-${String(1 + Math.floor(r() * 12)).padStart(2, "0")}-1${Math.floor(r() * 9)}`), { rate: Math.floor(r() * 5) })));
    for (let i = 0; i < 50; i++) {
      const [a, b, c] = [gen(), gen(), gen()];
      expect(sameStockLabels(mergeStockLabels(mergeStockLabels(a, b), c), mergeStockLabels(a, mergeStockLabels(b, c))), `#${i}`).toBe(true);
      expect(sameStockLabels(mergeStockLabels(a, b), mergeStockLabels(b, a)), `#${i}`).toBe(true);
      expect(sameStockLabels(mergeStockLabels(a, a), a), `#${i}`).toBe(true);
    }
  });
  it("R5 같은 `t@at`·다른 내용 → 어느 순서로 합쳐도 같은 승자", () => {
    const x = withReviews(cbPlain(), [rv("AAPL", T("2026-07-16"), { rate: 10.8 })]);
    const y = withReviews(cbPlain(), [rv("AAPL", T("2026-07-16"), { rate: 5.4, price: 999 })]);
    expect(mergeStockLabels(x, y).reviews).toEqual(mergeStockLabels(y, x).reviews);
    expect(mergeStockLabels(x, y).reviews).toHaveLength(1);
  });
  it("R6 13건째부터 가장 오래된 것이 빠지고, 두 기기에서 각자 자른 뒤 합쳐도 같은 12건", () => {
    const all = Array.from({ length: 20 }, (_, i) => rv("AAPL", new Date(Date.UTC(2025, 0, 1 + i * 20)).toISOString()));
    const top = normalizeReviews(all);
    expect(top).toHaveLength(12);
    expect(top[11].at).toBe(all[8].at);
    const a = withReviews(cbPlain(), all.filter((_, i) => i % 2 === 0));
    const b = withReviews(cbPlain(), all.filter((_, i) => i % 2 === 1));
    expect(mergeStockLabels(a, b).reviews).toEqual(top);
  });
});

describe("R7·R8 — 틀린 항목만 빠짐, 배열이 아니면 자동 경로가 원문을 덮지 않음", () => {
  it("R7 티커 키·at·from·choice 열거·price≤0·rate NaN은 빠지고 나머지는 보존(모르는 필드 256B 안에서 보존)", () => {
    const v = parseStockLabels({ ...cbPlain(), reviews: [
      rv("AAPL", T("2026-07-16"), { futureReview: 1 } as never),
      rv("bad key!", T("2026-07-16")), rv("AAPL", "어제"), rv("AAPL", T("2026-07-17"), { from: "none" as never }),
      rv("AAPL", T("2026-07-18"), { choice: "sell" as never }), rv("AAPL", T("2026-07-19"), { price: 0 }), rv("AAPL", T("2026-07-20"), { rate: NaN }),
      "문자열", null,
    ] })!;
    expect(v.reviews).toEqual([{ ...rv("AAPL", T("2026-07-16")), futureReview: 1 }]);
    expect(Object.keys(v.items).sort()).toEqual(["005930", "AAPL", "NVDA"]);
  });
  it("R8 reviews가 배열이 아니면 읽기는 기록 없음, pull·내보내기가 원문을 덮지 않는다", () => {
    const text = JSON.stringify({ ...cbPlain(), reviews: { AAPL: "?" } });
    localStorage.setItem(KEY, text);
    expect(readStockLabels().reviews).toBeUndefined();
    applyIncomingStockLabels(cbPlain(), { merge: true });
    expect(raw()).toBe(text);
    buildExportPayload();
    expect(raw()).toBe(text);
  });
});

describe("R9 — 이름표 변경·정하지 않음·다시 정함 뒤에도 이력 유지(recordReview·setStockLabel 둘 다)", () => {
  it("이력은 최상위라 항목 교체와 무관하게 남는다. 변경 경로(recordReview)는 checkedAt을 새로 시작한다", () => {
    let s = recordReview(cbPlain(), "AAPL", "same", T("2026-11-01"), SNAP);
    s = recordReview(s, "AAPL", "keep", T("2026-11-02"), SNAP, { qty: 12 });
    expect(s.items.AAPL).toMatchObject({ label: "keep", labeledAt: T("2026-11-02"), base: { qty: 12 } });
    expect(s.items.AAPL.checkedAt).toBeUndefined();
    s = recordReview(s, "AAPL", "none", T("2026-11-03"), SNAP);
    s = setStockLabel(s, "AAPL", "check", T("2026-11-04"));
    expect(s.reviews!.map((r) => [r.from, r.choice])).toEqual([["keep", "none"], ["check", "keep"], ["check", "same"]]);
  });
  it("첫 결정(없음·정하지 않음 → 오래 둘·점검할)은 기록하지 않고, 같은 이름표로 옮기기는 아무 일도 없다", () => {
    const s = recordReview(emptyStockLabels(), "TSLA", "check", T("2026-11-01"), SNAP);
    expect(s.items.TSLA.label).toBe("check");
    expect(s.reviews).toBeUndefined();
    expect(recordReview(s, "TSLA", "check", T("2026-11-02"), SNAP)).toBe(s);
    expect(recordReview(cbPlain(), "NVDA", "same", T("2026-11-02"), SNAP)).toStrictEqual(cbPlain()); // 정하지 않음에는 그대로 둠이 없다
  });
  it("시세가 없으면(snap null) 기록 없이 이름표·점검 시각만", () => {
    const s = recordReview(cbPlain(), "AAPL", "same", T("2026-11-01"), null);
    expect(s.items.AAPL.checkedAt).toBe(T("2026-11-01"));
    expect(s.reviews).toBeUndefined();
  });
});

describe("R10·P6 — 내보내기 → 가져오기(merge=false) → pull(merge=true) 왕복 보존", () => {
  it("reviews·plan이 모두 건너간다", () => {
    saveAssetData({ ...getAssetData(), cash: [cashItem("c1", 1_000_000)] });
    let s = recordReview(cbRich(), "AAPL", "same", T("2026-11-01"), SNAP);
    s = setStockPlan(s, "AAPL", { down: 10, up: 25, months: 6, memo: "실적 발표 뒤 다시 보기" }, T("2026-11-02"));
    writeStockLabels(s);
    const payload = JSON.parse(JSON.stringify(buildExportPayload()));
    g.localStorage = memoryStorage();
    applyImportedPayload(payload);
    expect(sameStockLabels(readStockLabels(), s)).toBe(true);
    const r = applyIncomingStockLabels(payload.stockLabels, { merge: true });
    expect(r.repush).toBe(false);
    expect(readStockLabels().items.AAPL.plan).toEqual({ down: 10, up: 25, months: 6, memo: "실적 발표 뒤 다시 보기", at: T("2026-11-02") });
    expect(readStockLabels().reviews).toEqual(s.reviews);
  });
});

describe("C1 — 수신에 reviews가 없을 때(undefined) 로컬 이력을 손대지 않는다", () => {
  const local = () => withReviews(cbPlain(), [rv("AAPL", T("2026-07-16"))]);
  it("merge=false(파일 가져오기·데모): items·cycle은 교체, 로컬 reviews 유지", () => {
    writeStockLabels(local());
    const incoming = setStockLabel(cbPlain(), "TSLA", "keep", T("2026-11-01"));
    applyIncomingStockLabels(JSON.parse(JSON.stringify(incoming)), { merge: false });
    const v = readStockLabels();
    expect(Object.keys(v.items)).toContain("TSLA");
    expect(v.reviews).toEqual(local().reviews);
  });
  it("merge=false인데 수신에 reviews 키가 있으면 교체(데모 시드가 이력을 쓴다)", () => {
    writeStockLabels(local());
    applyIncomingStockLabels({ ...cbPlain(), reviews: [rv("NVDA", T("2026-09-19"))] }, { merge: false });
    expect(readStockLabels().reviews!.map((r) => r.t)).toEqual(["NVDA"]);
  });
  it("merge=true: 로컬 그대로 + 재-push 판정(수신 필드 없음 / 수신에 reviews만 없음)", () => {
    writeStockLabels(local());
    const before = raw();
    expect(applyIncomingStockLabels(undefined, { merge: true }).repush).toBe(true);
    expect(applyIncomingStockLabels(JSON.parse(JSON.stringify(cbPlain())), { merge: true }).repush).toBe(true);
    expect(raw()).toBe(before);
    // 기록만 있는 기기(이름표·주기 없음)도 재-push 대상
    expect(hasStockLabelRecords({ ...emptyStockLabels(), reviews: [rv("AAPL", T("2026-07-16"))] })).toBe(true);
  });
});

describe("C2 — 전체 삭제 뒤 다른 기기 pull: items와 reviews가 같이 돌아오고, 삭제는 퍼지지 않는다", () => {
  it("두 기기 메모리 저장소", () => {
    const devA = memoryStorage();
    const devB = memoryStorage();
    const shared = setStockPlan(recordReview(cbPlain(), "AAPL", "same", T("2026-11-01"), SNAP), "AAPL", { up: 25 }, T("2026-11-02"));
    g.localStorage = devA; writeStockLabels(shared);
    g.localStorage = devB; writeStockLabels(shared);
    // A 전체 삭제(동기화는 먼저 끊긴다 — 빈 값 push 없음)
    g.localStorage = devA; clearStockLabels();
    expect(readStockLabelsState().state).toBe("none");
    // B는 그대로 — 삭제가 퍼지지 않는다
    g.localStorage = devB;
    const fromB = JSON.parse(JSON.stringify(readStockLabels()));
    expect(sameStockLabels(readStockLabels(), shared)).toBe(true);
    // A를 같은 금고에 다시 연결해 pull → items·cycle·reviews·plan이 같이 돌아온다
    g.localStorage = devA;
    applyIncomingStockLabels(fromB, { merge: true });
    expect(sameStockLabels(readStockLabels(), shared)).toBe(true);
  });
});

describe("P2·P3·P4·P8 — plan 쓰기·읽기 정리·이름표 변경", () => {
  const chk = () => setStockLabel(emptyStockLabels(), "AAPL", "check", T("2026-09-01"));
  it("P2 plan 왕복 · 모두 비우면 plan 키를 지운다 · 같은 값이면 같은 객체", () => {
    const s = setStockPlan(chk(), "AAPL", { down: 10, memo: "실적 발표 뒤 다시 보기" }, T("2026-10-01"));
    expect(s.items.AAPL.plan).toEqual({ down: 10, memo: "실적 발표 뒤 다시 보기", at: T("2026-10-01") });
    expect(s.items.AAPL.at).toBe(T("2026-10-01"));
    writeStockLabels(s);
    expect(readStockLabels()).toEqual(s);
    expect(setStockPlan(s, "AAPL", { down: 10, memo: "실적 발표 뒤 다시 보기" }, T("2026-10-02"))).toBe(s);
    const cleared = setStockPlan(s, "AAPL", { memo: "  " }, T("2026-10-03"));
    expect("plan" in cleared.items.AAPL).toBe(false);
    expect(setStockPlan(setStockLabel(emptyStockLabels(), "X", "keep", T("2026-09-01")), "X", { down: 5 }, T("2026-10-01")).items.X.plan).toBeUndefined(); // 오래 둘에는 없다
  });
  it("P3 범위 밖 숫자·틀린 months만 빠지고, memo는 제어문자 제거·40자 절단(다른 기기에서 받은 값도 읽을 때 같은 정리)", () => {
    const longMemo = `가${"나".repeat(50)}`;
    const v = parseStockLabels({ v: 1, cycle: { months: null, at: "" }, items: { AAPL: { label: "check", labeledAt: T("2026-09-01"), at: T("2026-09-01"),
      plan: { down: 91, up: 25.5, months: 4, memo: `${String.fromCharCode(0)}실적${String.fromCharCode(0x202e)} 발표${String.fromCharCode(10)}뒤${longMemo}`, futurePlan: true } } } })!;
    expect(v.items.AAPL.plan!.down).toBeUndefined();
    expect(v.items.AAPL.plan!.up).toBeUndefined(); // 정수만
    expect(v.items.AAPL.plan!.months).toBeUndefined();
    expect(Array.from(v.items.AAPL.plan!.memo!)).toHaveLength(40);
    expect(v.items.AAPL.plan!.memo!.startsWith("실적 발표뒤가")).toBe(true);
    expect(v.items.AAPL.plan!.futurePlan).toBe(true); // 미래 필드 보존(항목 2KB 안)
    expect(cleanPlanMemo(42)).toBeUndefined();
    expect(cleanPlanMemo("\u0007")).toBeUndefined();
    const edge = parseStockLabels({ v: 1, cycle: { months: null, at: "" }, items: { AAPL: { label: "check", labeledAt: T("2026-09-01"), at: T("2026-09-01"), plan: { down: 90, up: 500, months: 12 } } } })!;
    expect(edge.items.AAPL.plan).toEqual({ down: 90, up: 500, months: 12 });
  });
  it("P4 점검할 → 오래 둘·정하지 않음이면 plan이 사라지고, 그대로 둠 기록 뒤에는 유지", () => {
    const s = setStockPlan(chk(), "AAPL", { up: 25 }, T("2026-10-01"));
    expect(recordReview(s, "AAPL", "same", T("2026-10-02"), SNAP).items.AAPL.plan).toEqual({ up: 25, at: T("2026-10-01") });
    expect(recordReview(s, "AAPL", "keep", T("2026-10-02"), SNAP).items.AAPL.plan).toBeUndefined();
    expect(recordReview(s, "AAPL", "none", T("2026-10-02"), SNAP).items.AAPL.plan).toBeUndefined();
  });
  it("P8 label이 check가 아닌데 plan이 있는 손상 값 — 읽을 때 무시, 자동 경로(pull·내보내기)는 원문을 덮지 않는다", () => {
    const text = JSON.stringify({ v: 1, cycle: { months: null, at: "" }, items: { AAPL: { label: "keep", labeledAt: T("2026-09-01"), at: T("2026-09-01"), plan: { down: 10 } } } });
    localStorage.setItem(KEY, text);
    expect(readStockLabels().items.AAPL.plan).toBeUndefined();
    applyIncomingStockLabels(JSON.parse(text), { merge: true });
    buildExportPayload();
    expect(raw()).toBe(text);
  });
});

describe("P5 — 두 기기 경합: A 점검 기록, B 조건 설정(B가 나중) → plan은 B, 차례는 A 기록 기준", () => {
  it("병합 뒤 checkedAt이 진 쪽에 있어도 reviews 합집합으로 '차례 아님'", () => {
    const base = setStockLabel(setStockLabelCycle(emptyStockLabels(), 3, T("2026-01-01")), "AAPL", "check", T("2026-05-01"));
    const A = recordReview(base, "AAPL", "same", T("2026-10-20"), SNAP);
    const B = setStockPlan(base, "AAPL", { down: 30 }, T("2026-10-25"));
    const m = mergeStockLabels(A, B);
    expect(m.items.AAPL.plan).toEqual({ down: 30, at: T("2026-10-25") });
    expect(m.items.AAPL.checkedAt).toBeUndefined(); // 항목은 B가 이겼다
    const stocks = [{ id: "a", category: "foreign", name: "Apple", ticker: "AAPL", quantity: 1, averagePrice: 185, currentPrice: 205, currency: "USD", purchaseDate: "2026-04-01", purchaseExchangeRate: 1400 }] as never;
    const row = buildBoardRows(stocks, { USD: 1400, JPY: 9 }, m, Date.parse(T("2026-11-18")))[0];
    expect(row.due).toBe(false); // 기준일 = A의 그대로 둠(10/20) + 3개월
    expect(row.since).toMatchObject({ kind: "checked" });
  });
});

describe("P7 — GA·AI 프롬프트·공유 payload에 메모·조건 문자열 0건", () => {
  it("GA 동작은 category 이름만 보낸다(조건·메모 저장 포함)", () => {
    const send = vi.fn();
    const a = stockLabelActions({ notify: () => {}, track: send, now: () => T("2026-11-18") });
    a.setLabel("AAPL", "check");
    a.setPlan("AAPL", { down: 10, up: 25, memo: "실적 발표 뒤 다시 보기" });
    a.record("AAPL", "same", SNAP);
    expect(JSON.stringify(send.mock.calls)).not.toMatch(/실적|10|25|AAPL|memo|down|up/);
  });
  it("AI 프롬프트·공유 토큰·홈 팁·알림·GA 모듈은 이름표 모듈·plan·memo를 읽지 않는다", () => {
    const src = (p: string) => readFileSync(path.resolve(__dirname, "..", p), "utf8");
    for (const f of ["ai-prompts.ts", "home-tip.ts", "analytics/ga.ts"]) expect(src(f), f).not.toMatch(/stock-labels|stockLabels|\.plan\b|\.memo\b|reviews/);
    // 공유 토큰은 자산 데이터·스냅샷·닉네임만 싣는다(이름표 키 없음)
    const storage = src("asset/asset-storage.ts");
    const share = storage.slice(storage.indexOf("export async function generateShareToken"), storage.indexOf("export async function parseShareToken"));
    expect(share.length).toBeGreaterThan(100);
    expect(share).not.toMatch(/StockLabels|stockLabels|reviews|memo/);
    for (const f of ["../hooks/use-share-artifacts.ts", "asset/share-crypto.ts"]) expect(src(f), f).not.toMatch(/stock-labels|stockLabels|reviews|\.memo\b/);
  });
});
