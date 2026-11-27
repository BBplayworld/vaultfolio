// #245(5.130) 내 종목 화면이 내 결정을 안다 — 행 표시·머리 문장·홈 팁·타일 값 줄(순수 함수). spec 4절 문자열 상태표 대입.
// 값은 전부 점검 칸 행(buildBoardRows·buildGrowBoards)에서 읽기만 한다 — 여기 테스트도 그 행을 실제로 만들어 넣는다.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AssetData, Stock } from "@/types/asset";
import { recordReview, type StockLabels } from "../asset/stock-labels";
import { buildBoardRows, boardStatus, dueReasonText, hitOf } from "../asset/grow-board";
import { buildGrowBoards, growStatus } from "../asset/grow-kinds";
import { DECISION_TEXT, decisionKindOf, decisionRowsOf, dueEntryText, dueTipOf, headDecisionOf, headDecisionText } from "../asset/grow-decision";
import { featureTitleOf } from "../analytics/ga";

const RATES = { USD: 1400, JPY: 925 };
const NOW = Date.parse("2026-11-19T03:00:00Z"); // KST 11/19 12:00
const DAY = 86_400_000;
const iso = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString();
const mk = (items: StockLabels["items"] = {}, months: 3 | 6 | 12 | null = null, reviews?: StockLabels["reviews"]): StockLabels =>
  ({ v: 1, cycle: { months, at: months ? "2025-01-01T00:00:00.000Z" : "" }, items, ...(reviews ? { reviews } : {}) });
// 평단 100, 지금 now → 평단 대비 (now − 100)%
const st = (id: string, now = 110, o: Partial<Stock> = {}): Stock => ({
  id, category: "domestic", name: id, ticker: id.toUpperCase(), quantity: 10, averagePrice: 100, currentPrice: now, currency: "KRW", purchaseDate: "2025-01-10", ...o,
} as Stock);
const keep = (daysAgo: number, basePrice?: number) => ({ label: "keep" as const, labeledAt: iso(daysAgo), at: iso(daysAgo), ...(basePrice ? { base: { qty: 10, price: basePrice } } : {}) });
const check = (daysAgo: number, basePrice?: number, plan?: Record<string, unknown>) => ({
  label: "check" as const, labeledAt: iso(daysAgo), at: iso(daysAgo), ...(basePrice ? { base: { qty: 10, price: basePrice } } : {}), ...(plan ? { plan: { at: iso(daysAgo), ...plan } } : {}),
});

/** 종목 1개의 세 곳(행 표시 / 머리 문장 또는 진입) */
function one(stock: Stock, labels: StockLabels) {
  const row = decisionRowsOf(buildBoardRows([stock], RATES, labels, NOW)).get(stock.ticker!);
  if (!row) return { row: null, head: null, entry: null };
  const head = headDecisionOf(row, labels, NOW);
  return { row: DECISION_TEXT[decisionKindOf(row)], head: head ? headDecisionText(head) : null, entry: dueEntryText(row) };
}

describe("spec 4-1 — 종목 1개의 상태별 문자열(행 / 머리 / 진입)", () => {
  it("1 이름표 없음·정하지 않음 — 아무것도 없다", () => {
    expect(one(st("a"), mk())).toEqual({ row: null, head: null, entry: null });
    expect(one(st("a"), mk({ A: { label: null, labeledAt: iso(5), at: iso(5) } }))).toEqual({ row: null, head: null, entry: null });
  });
  it("2·3 장기 보유 — 수익이든 손실이든 같은 문장 꼴", () => {
    expect(one(st("a", 112), mk({ A: keep(30, 100) }))).toEqual({ row: "장기 보유", head: "장기 보유 · 정한 날 대비 +12.0%", entry: null });
    expect(one(st("a", 91.6), mk({ A: keep(30, 100) }))).toEqual({ row: "장기 보유", head: "장기 보유 · 정한 날 대비 -8.4%", entry: null });
  });
  it("4 오늘 정함 — % 대신 낱말(`0%` 없음)", () => {
    expect(one(st("a"), mk({ A: keep(0, 110) })).head).toBe("장기 보유 · 오늘 정함");
  });
  it("5 정한 날 가격 없음·시세 없음 — 조각이 통째로 없다(빈 꼬리·`—` 없음)", () => {
    expect(one(st("a"), mk({ A: keep(30) })).head).toBe("장기 보유");
    expect(one(st("a", 0), mk({ A: keep(30, 100) })).head).toBe("장기 보유");
  });
  it("6 점검 대상·조건 없음·주기 없음 — 조건 절 없음", () => {
    expect(one(st("a", 97.9), mk({ A: check(30, 100) }))).toEqual({ row: "점검 대상", head: "점검 대상 · 정한 날 대비 -2.1%", entry: null });
  });
  it("7 ±% 미도달·손실 — 조건 절은 `평단 대비` + `또는`(조건 안 가운뎃점 0), % 부호는 정본 그대로(- / −)", () => {
    const r = one(st("a", 93.7), mk({ A: check(30, 100, { down: 15, up: 25 }) }));
    expect(r).toEqual({ row: "점검 대상", head: "점검 대상 · 정한 날 대비 -6.3% · 다시 볼 조건 평단 대비 −15% 이하 또는 +25% 이상", entry: null });
    expect(one(st("a", 93.7), mk({ A: check(30, 100, { down: 15 }) })).head).toBe("점검 대상 · 정한 날 대비 -6.3% · 다시 볼 조건 평단 대비 −15% 이하");
    expect(one(st("a", 93.7), mk({ A: check(30, 100, { up: 25 }) })).head).toBe("점검 대상 · 정한 날 대비 -6.3% · 다시 볼 조건 평단 대비 +25% 이상");
  });
  it("8 기간만 — `다음 점검 {날짜}`(조건 기간·기본 주기 모두). ±%가 있으면 ±% 절이 먼저다", () => {
    // 8/18 정함 + 6개월 = 2/18
    const set = (NOW - Date.parse("2026-08-18T03:00:00Z")) / DAY;
    expect(one(st("a", 103), mk({ A: check(set, 100, { months: 6 }) })).head).toBe("점검 대상 · 정한 날 대비 +3.0% · 다음 점검 2월 18일");
    expect(one(st("a", 103), mk({ A: check(set, 100) }, 6)).head).toBe("점검 대상 · 정한 날 대비 +3.0% · 다음 점검 2월 18일");
    expect(one(st("a", 103), mk({ A: check(set, 100, { months: 6, down: 15 }) })).head).toBe("점검 대상 · 정한 날 대비 +3.0% · 다시 볼 조건 평단 대비 −15% 이하");
  });
  it("8 날짜가 11개월 넘게 떨어지면 연도를 붙인다(한 장과 같은 함수)", () => {
    expect(one(st("a", 103), mk({ A: check(1, 100, { months: 12 }) })).head).toBe("점검 대상 · 정한 날 대비 +3.0% · 다음 점검 2027년 11월 18일");
  });
  it("10·11 차례 — 행은 `점검 차례`만, 머리는 문장 대신 진입(이유는 dueReasonText 그대로)", () => {
    const down = one(st("a", 84), mk({ A: check(30, 100, { down: 15, up: 25 }) }));
    expect(down).toEqual({ row: "점검 차례", head: null, entry: "점검 차례 · 평단 대비 −15% 이하에 닿았어요" });
    const up = one(st("a", 126), mk({ A: check(30, 100, { down: 15, up: 25 }) }));
    expect(up).toEqual({ row: "점검 차례", head: null, entry: "점검 차례 · 평단 대비 +25% 이상에 닿았어요" });
  });
  it("12 ±% 차례를 그대로 둔 뒤(조건은 닿은 채) — 행 `점검 대상`, 당일 `오늘 점검함`, 다음 날부터 `점검일 대비`", () => {
    const base = mk({ A: check(30, 100, { down: 15, up: 25 }) }, 6);
    const stock = st("a", 84);
    const row = buildBoardRows([stock], RATES, base, NOW)[0];
    expect(row.due).toBe(true);
    const acked = recordReview(base, "A", "same", new Date(NOW).toISOString(), { price: 84, rate: -16 }, undefined, hitOf(row.dueReason));
    expect(one(stock, acked)).toEqual({ row: "점검 대상", head: "점검 대상 · 오늘 점검함 · 다시 볼 조건 평단 대비 −15% 이하 또는 +25% 이상", entry: null });
    // 어제 확인(가격 84.85) → 오늘 84: 점검일 대비 -1.0%
    const yesterday = recordReview(base, "A", "same", iso(1), { price: 84.85, rate: -15.2 }, undefined, "down");
    expect(one(stock, yesterday)).toEqual({ row: "점검 대상", head: "점검 대상 · 점검일 대비 -1.0% · 다시 볼 조건 평단 대비 −15% 이하 또는 +25% 이상", entry: null });
  });
  it("12b 반대 방향에 닿으면 다시 차례 / 12c 5.125 시절 기록(hit 없음)은 확인으로 치지 않는다", () => {
    const base = mk({ A: check(30, 100, { down: 15, up: 25 }) }, 6);
    const ackedDown = recordReview(base, "A", "same", iso(1), { price: 84, rate: -16 }, undefined, "down");
    expect(one(st("a", 126), ackedDown)).toMatchObject({ row: "점검 차례", entry: "점검 차례 · 평단 대비 +25% 이상에 닿았어요" });
    const old = recordReview(base, "A", "same", iso(1), { price: 84, rate: -16 });
    expect(one(st("a", 84), old)).toMatchObject({ row: "점검 차례", entry: "점검 차례 · 평단 대비 −15% 이하에 닿았어요" });
  });
  it("13 기간 차례 — 조건 기간 / 점검 주기 / 장기 보유 12개월", () => {
    expect(one(st("a"), mk({ A: check(100, 100, { months: 3 }) })).entry).toBe("점검 차례 · 정한 기간 3개월이 지났어요");
    expect(one(st("a"), mk({ A: check(100, 100) }, 3)).entry).toBe("점검 차례 · 점검 주기 3개월이 지났어요");
    expect(one(st("a"), mk({ A: keep(400, 100) }))).toEqual({ row: "점검 차례", head: null, entry: "점검 차례 · 장기 보유로 정한 지 12개월이 지났어요" });
  });
  it("9 기간 차례를 그대로 둔 뒤 — `점검일 대비` + 다음 점검일", () => {
    const base = mk({ A: check(100, 100, { months: 3 }) });
    const done = recordReview(base, "A", "same", iso(10), { price: 108.7, rate: 8.7 }, undefined, "plan");
    const r = one(st("a", 110), done);
    expect(r.row).toBe("점검 대상");
    expect(r.head).toMatch(/^점검 대상 · 점검일 대비 \+1\.2% · 다음 점검 2월 \d+일$/);
  });
  it("어느 문장도 `·`로 시작하거나 끝나지 않고 `—`·` 0%`가 없다", () => {
    const cases = [mk({ A: keep(30) }), mk({ A: keep(0, 110) }), mk({ A: check(30, 100) }), mk({ A: check(30) }), mk({ A: check(30, 100, { down: 15, up: 25 }) })];
    for (const l of cases) {
      const h = one(st("a"), l).head!;
      expect(h).not.toMatch(/^\s*·|·\s*$|—| 0%/);
    }
    // 실제 값이 0인 경우는 정본(불리기 행 2줄)과 같은 글자 `0.0%` — 빈 값 표기가 아니다
    expect(one(st("a"), mk({ A: check(30, 110) })).head).toBe("점검 대상 · 정한 날 대비 0.0%");
  });
});

describe("행 표시 대상 — 정한 종목만(미정 기기 diff 0의 근거)", () => {
  it("이름표 없음·정하지 않음·티커 없음·상장폐지·수량 0은 Map에 없다", () => {
    const stocks = [
      st("a"), st("b"), st("c"),
      st("d", 110, { ticker: "" }),
      st("e", 110, { inactiveStatus: "delisted" } as Partial<Stock>),
      st("f", 110, { quantity: 0 }),
    ];
    const labels = mk({ A: keep(10, 100), B: { label: null, labeledAt: iso(5), at: iso(5) }, E: keep(10, 100), F: keep(10, 100) });
    const map = decisionRowsOf(buildBoardRows(stocks, RATES, labels, NOW));
    expect([...map.keys()]).toEqual(["A"]);
  });
  it("이름표 0개 / 전부 정하지 않음 / 티커 없는 종목만 — Map이 비어 있다", () => {
    expect(decisionRowsOf(buildBoardRows([st("a"), st("b")], RATES, mk(), NOW)).size).toBe(0);
    expect(decisionRowsOf(buildBoardRows([st("a")], RATES, mk({ A: { label: null, labeledAt: iso(5), at: iso(5) } }), NOW)).size).toBe(0);
    expect(decisionRowsOf(buildBoardRows([st("a", 110, { ticker: "" })], RATES, mk({ A: keep(10, 100) }), NOW)).size).toBe(0);
  });
  it("같은 티커의 여러 보유 건은 한 행(이름표 키 기준) — 상세·주식에서 여러 행으로 보여도 같은 표시", () => {
    const map = decisionRowsOf(buildBoardRows([st("a1", 110, { ticker: "A" }), st("a2", 110, { ticker: "A", category: "isa" })], RATES, mk({ A: keep(10, 100) }), NOW));
    expect(map.size).toBe(1);
    expect(decisionKindOf(map.get("A")!)).toBe("keep");
  });
});

const data = (o: Partial<AssetData>): AssetData => ({ stocks: [], crypto: [], realEstate: [], physicalAssets: [], transactions: [], cryptoTransactions: [], cash: [], loans: [], ...o } as unknown as AssetData);

describe("spec 4-3 — 홈 팁 수·단위·이유 1줄(허브 카드와 같은 값)", () => {
  const plan = { down: 15, up: 25 };
  const boards = (stocks: Stock[], labels: StockLabels, extra: Partial<AssetData> = {}) => buildGrowBoards(data({ stocks, ...extra }), RATES, labels, NOW);
  it("차례 0 → null(팁 없음). 정한 것이 있어도 차례가 없으면 없다", () => {
    expect(dueTipOf(boards([st("a")], mk()))).toBeNull();
    expect(dueTipOf(boards([st("a")], mk({ A: keep(10, 100) })))).toBeNull();
  });
  it("N=1 — 그 행의 이유 문장", () => {
    expect(dueTipOf(boards([st("a", 84), st("b")], mk({ A: check(30, 100, plan), B: keep(10, 100) })))).toEqual({ count: 1, unit: "종목", reason: "평단 대비 −15% 이하에 닿았어요" });
  });
  it("N≥2 이유 문장이 모두 같음 — 그 문장", () => {
    expect(dueTipOf(boards([st("a", 84), st("b", 80)], mk({ A: check(30, 100, plan), B: check(30, 100, plan) })))).toEqual({ count: 2, unit: "종목", reason: "평단 대비 −15% 이하에 닿았어요" });
  });
  it("N≥2 ±% 이유끼리 다름 — `내가 정한 조건에 닿았어요`(한 종목 이유를 전체 이유처럼 쓰지 않는다)", () => {
    const b = boards([st("a", 84), st("b", 126), st("c", 70)], mk({ A: check(30, 100, plan), B: check(30, 100, plan), C: check(30, 100, { down: 20 }) }));
    expect(dueTipOf(b)).toEqual({ count: 3, unit: "종목", reason: "내가 정한 조건에 닿았어요" });
  });
  it("N≥2 기간 이유가 섞임 — `내가 정한 조건·기간에 닿았어요`, 부동산·실물 차례가 있으면 단위 `개`", () => {
    const labels = mk({ A: check(30, 100, plan), B: check(100, 100, { months: 3 }), "r:h1": check(200, undefined, { months: 6 }) });
    const b = boards([st("a", 84), st("b")], labels, { realEstate: [{ id: "h1", name: "집", currentValue: 500, purchasePrice: 400, purchaseDate: "2020-01-01" }] as unknown as AssetData["realEstate"] });
    expect(dueTipOf(b)).toEqual({ count: 3, unit: "개", reason: "내가 정한 조건·기간에 닿았어요" });
  });
  it("상태 14 부동산만 차례 — `1개` + 그 이유", () => {
    const b = boards([st("a")], mk({ "r:h1": check(200, undefined, { months: 6 }) }), { realEstate: [{ id: "h1", name: "집", currentValue: 500, purchasePrice: 400, purchaseDate: "2020-01-01" }] as unknown as AssetData["realEstate"] });
    expect(dueTipOf(b)).toEqual({ count: 1, unit: "개", reason: "정한 기간 6개월이 지났어요" });
  });
  it("AC-4·8 수·단위 = growStatus(허브 카드), 팁이 뜨는 것 = growStatus().due ≥ 1", () => {
    const sets: [Stock[], StockLabels][] = [
      [[st("a")], mk()],
      [[st("a", 84)], mk({ A: check(30, 100, plan) })],
      [[st("a", 84), st("b", 126), st("c")], mk({ A: check(30, 100, plan), B: check(30, 100, plan), C: keep(400, 100) })],
      // 전량 매도(수량 0) 종목의 이름표는 차례 수에 들어가지 않는다(#243)
      [[st("a", 84, { quantity: 0 }), st("b", 84)], mk({ A: check(30, 100, plan), B: check(30, 100, plan) })],
    ];
    for (const [stocks, labels] of sets) {
      const b = boards(stocks, labels);
      const s = growStatus(b);
      const tip = dueTipOf(b);
      expect(tip !== null).toBe(s.due >= 1);
      if (tip) expect([tip.count, tip.unit]).toEqual([s.due, s.unit]);
    }
    expect(dueTipOf(boards(sets[3][0], sets[3][1]))!.count).toBe(1);
  });
  it("팁 문장에 종목명·금액·수량이 없다", () => {
    const tip = dueTipOf(boards([st("삼성", 84, { ticker: "A" })], mk({ A: check(30, 100, plan) })))!;
    expect(tip.reason).not.toMatch(/삼성|원|주\b/);
  });
});

describe("문장 정본 일치 · GA title(AC-10)", () => {
  it("진입 문장 = 점검 한 장 이유 줄과 같은 꼴(`점검 차례 · {dueReasonText}`)", () => {
    const row = buildBoardRows([st("a", 84)], RATES, mk({ A: check(30, 100, { down: 15 }) }), NOW)[0];
    expect(dueEntryText(row)).toBe(`점검 차례 · ${dueReasonText(row.dueReason!)}`);
    const block = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/activity/stock-label-block.tsx"), "utf8");
    expect(block).toContain("text: `점검 차례 · ${dueReasonText(row.dueReason)}`");
  });
  it("title 4개 — 종목·값·건수는 실리지 않는다(title만 나간다)", () => {
    expect(featureTitleOf("feature_use", { category: "home_tip_due" }, "home")).toBe("홈 팁·점검 차례");
    expect(featureTitleOf("feature_use", { category: "stock_decision" }, "home")).toBe("상세·주식·내 결정");
    expect(featureTitleOf("feature_use", { category: "stock_check_tile" }, "home")).toBe("상세·주식·내 자산 점검");
    expect(featureTitleOf("feature_use", { category: "stock_decision_view" }, "home")).toBe("상세·주식·내 결정 보임");
    // 기존 홈 팁 집계는 그대로
    expect(featureTitleOf("feature_use", { category: "home_tip", method: "click" }, "home")).toBe("홈 팁·누름");
    expect(featureTitleOf("feature_use", { category: "home_tip", method: "view" }, "home")).toBe("홈 팁");
  });
  it("GA 호출부는 category만 넘기고 preview 가드가 앞에 있다", () => {
    const root = path.resolve(__dirname, "../../app/(main)/_components/views");
    for (const [file, cat] of [["activity/grow-due-entry.tsx", "stock_decision"], ["detail/tabs/stock-tab.tsx", "stock_decision_view"], ["home/home-tip-box.tsx", "home_tip_due"]] as const) {
      const src = readFileSync(path.join(root, file), "utf8");
      expect(src).toContain(`if (!isPreviewEnv()) track("feature_use", { category: "${cat}" });`);
      expect(src.split(`category: "${cat}"`)).toHaveLength(2); // 전송 1곳
    }
  });
  it("5.171: `내 자산 점검` 타일 제거 — stock_check_tile 전송 0(이름표는 지난 데이터 판독용으로 남음)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/views/detail/stock-tools.tsx"), "utf8");
    expect(src).not.toContain("stock_check_tile");
    expect(src).not.toContain("track(");
  });
});
