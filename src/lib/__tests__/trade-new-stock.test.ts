// #258 검색으로 처음 사는 종목 — AC-4 보유 판정(normalizeTicker)·AC-5a 시장별 종류·AC-9 임시 현재가(baseDate 비움)·GA·키보드
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MARKET_CATEGORIES, buildPickedStockDraft, findHeldByPicked, marketDefaultCategory, withInitialPrice } from "@/lib/trade/new-stock";
import { nextSearchKey, shouldBlockEnter } from "@/lib/ticker-search-nav";
import { trackTradeNewStock } from "@/lib/trade/link-track";
import { stockSchema } from "@/types/asset";
import type { Stock } from "@/types/asset";

const calls = vi.hoisted(() => [] as unknown[][]);
vi.mock("@/lib/analytics/ga", () => ({ track: (...a: unknown[]) => { calls.push(a); } }));

const held = (id: string, ticker: string, category: Stock["category"]): Stock =>
  ({ id, name: ticker, ticker, category, currency: category === "foreign" ? "USD" : "KRW", broker: "토스증권", quantity: 1, averagePrice: 100, currentPrice: 100, purchaseDate: "2026-01-01" }) as Stock;

describe("AC-4 findHeldByPicked — 양쪽 normalizeTicker 비교", () => {
  it("005930.KS·소문자 005930 ↔ 검색 005930, aapl ↔ AAPL, brk.b ↔ BRK.B", () => {
    expect(findHeldByPicked([held("a", "005930.KS", "domestic")], { ticker: "005930", market: "kr" }).map((s) => s.id)).toEqual(["a"]);
    expect(findHeldByPicked([held("a", "aapl", "foreign")], { ticker: "AAPL", market: "us" }).map((s) => s.id)).toEqual(["a"]);
    expect(findHeldByPicked([held("a", "brk.b", "foreign")], { ticker: "BRK.B", market: "us" }).map((s) => s.id)).toEqual(["a"]);
  });
  it("국내 4종(IRP·ISA·연금 포함)은 같은 군으로 비교, 해외·국내 교차는 일치하지 않는다", () => {
    const stocks = [held("i", "360750", "isa"), held("p", "360750", "pension"), held("f", "360750", "foreign")];
    expect(findHeldByPicked(stocks, { ticker: "360750", market: "kr" }).map((s) => s.id)).toEqual(["i", "p"]);
    expect(findHeldByPicked(stocks, { ticker: "360750", market: "us" }).map((s) => s.id)).toEqual(["f"]);
    expect(findHeldByPicked([held("d", "005930", "domestic")], { ticker: "005930", market: "us" })).toEqual([]);
  });
  it("보유가 없거나 티커가 다르면 빈 배열", () => {
    expect(findHeldByPicked([], { ticker: "005930", market: "kr" })).toEqual([]);
    expect(findHeldByPicked([held("a", "000660", "domestic")], { ticker: "005930", market: "kr" })).toEqual([]);
  });
});

describe("AC-5a 시장별 종류", () => {
  it("국내 4개(비상장 없음), 해외 1개", () => {
    expect(MARKET_CATEGORIES.kr).toEqual(["domestic", "irp", "isa", "pension"]);
    expect(MARKET_CATEGORIES.us).toEqual(["foreign"]);
    expect(marketDefaultCategory("kr")).toBe("domestic");
    expect(marketDefaultCategory("us")).toBe("foreign");
  });
  it("picker는 allowedCategories가 없으면 전체(기존 화면 그대로)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/trade/stock-target-picker.tsx"), "utf8");
    expect(src).toContain("!allowedCategories || allowedCategories.includes(c.value)");
  });
});

describe("AC-9 임시 현재가 — baseDate 비움", () => {
  const draft = () => ({ ...buildPickedStockDraft("stock_1", { ticker: "AAPL", name: "Apple", market: "us" }, { broker: "토스증권", category: "foreign" }), purchaseDate: "2026-11-03", quantity: 3, averagePrice: 150.5 });
  it("해외 초안은 USD, 국내는 KRW", () => {
    expect(draft().currency).toBe("USD");
    expect(buildPickedStockDraft("s", { ticker: "005930", name: "삼성전자", market: "kr" }, { broker: "토스증권", category: "domestic" }).currency).toBe("KRW");
  });
  it("조회 실패: 현재가 = 유효 체결 단가(USD 환산 후), baseDate 키 없음, stockSchema 통과", () => {
    const s = withInitialPrice(draft(), undefined, 150.5);
    expect(s.currentPrice).toBe(150.5);
    expect("baseDate" in s).toBe(false);
    expect(stockSchema.safeParse(s).success).toBe(true);
  });
  it("초안에 baseDate가 남아 있어도 실패 폴백에서는 지운다(오늘 날짜를 시세 기준일인 척하지 않음)", () => {
    const s = withInitialPrice({ ...draft(), baseDate: "2026-11-20" }, { price: 0 }, 150.5);
    expect(s.currentPrice).toBe(150.5);
    expect(s.baseDate).toBeUndefined();
  });
  it("조회 성공: 조회 시세·기준일 사용, 기준일이 없으면 비움", () => {
    const ok = withInitialPrice(draft(), { price: 228.52, baseDate: "2026-11-19" }, 150.5);
    expect(ok.currentPrice).toBe(228.52);
    expect(ok.baseDate).toBe("2026-11-19");
    const noDate = withInitialPrice(draft(), { price: 228.52 }, 150.5);
    expect("baseDate" in noDate).toBe(false);
  });
  it("호출부: 새 종목 저장은 조회 결과를 withInitialPrice로 넣고 카운터 키를 쓰지 않는다", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/trade/trade-input.tsx"), "utf8");
    expect(src).toContain("withInitialPrice(built");
    expect(src).not.toMatch(/localStorage\.(setItem|removeItem)\(STORAGE_KEYS\.financeApiErrorCount/);
  });
});

describe("GA — 저장 성공 뒤 새 종목 1회, 연결이면 _linked 1회 더", () => {
  it("연결 안 함: trade_new_stock만, 연결: 둘 다", () => {
    calls.length = 0;
    trackTradeNewStock(undefined);
    expect(calls).toEqual([["feature_use", { category: "trade_new_stock" }]]);
    calls.length = 0;
    trackTradeNewStock({ kind: "cash", cashId: "a" });
    expect(calls).toEqual([["feature_use", { category: "trade_new_stock" }], ["feature_use", { category: "trade_new_stock_linked" }]]);
  });
  it("호출 위치: 새 종목 저장 성공 분기(pickedNew)에서만", () => {
    const src = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/forms/trade/trade-input.tsx"), "utf8");
    expect(src.match(/trackTradeNewStock\(link\)/g)).toHaveLength(1);
    expect(src).toMatch(/if \(pickedNew\) trackTradeNewStock\(link\);/);
  });
});

describe("키보드 — ↑↓ 순환·Enter 선택·Esc 닫기 (주식 추가·거래 입력 공용)", () => {
  it("↓는 다음(끝에서 처음), ↑는 이전(처음에서 끝)", () => {
    expect(nextSearchKey("ArrowDown", -1, 3)).toEqual({ type: "move", index: 0 });
    expect(nextSearchKey("ArrowDown", 2, 3)).toEqual({ type: "move", index: 0 });
    expect(nextSearchKey("ArrowUp", 0, 3)).toEqual({ type: "move", index: 2 });
    expect(nextSearchKey("ArrowUp", -1, 3)).toEqual({ type: "move", index: 1 }); // 기존 주식 추가 계산식 그대로
  });
  it("Enter는 활성 칸이 있을 때만 선택", () => {
    expect(nextSearchKey("Enter", 1, 3)).toEqual({ type: "select", index: 1 });
    expect(nextSearchKey("Enter", -1, 3)).toEqual({ type: "none" });
  });
  it("인라인은 결과 없음(0건·로딩) Enter를 막고, 결과가 있거나 popover(주식 추가)면 막지 않는다", () => {
    expect(shouldBlockEnter("Enter", false, true)).toBe(true);
    expect(shouldBlockEnter("Enter", true, true)).toBe(false);
    expect(shouldBlockEnter("Enter", false, false)).toBe(false);
    expect(shouldBlockEnter("a", false, true)).toBe(false);
  });
  it("Esc는 닫기, 결과 0건·그 밖의 키는 무시", () => {
    expect(nextSearchKey("Escape", 0, 3)).toEqual({ type: "close" });
    expect(nextSearchKey("ArrowDown", 0, 0)).toEqual({ type: "none" });
    expect(nextSearchKey("a", 0, 3)).toEqual({ type: "none" });
  });
});

describe("검색 공용 컴포넌트 (AC-12 주식 추가 화면 diff 0)", () => {
  const read = (rel: string) => readFileSync(path.resolve(__dirname, "../..", rel), "utf8");
  it("주식 추가는 popover 모드 공용 컴포넌트를 쓰고 자체 검색 상태·바깥 클릭 effect가 없다", () => {
    const src = read("app/(main)/_components/forms/asset-update/input/stock-input.tsx");
    expect(src).toContain("<TickerSearchField");
    expect(src).not.toContain("setShowDropdown");
    expect(src).not.toContain("searchAbortRef");
    // 시세 조회·재조회·토스트는 주식 추가 쪽에 그대로(공용 컴포넌트는 조회하지 않는다)
    expect(src).toContain("void fetchPrice(r.ticker, form.getValues(\"category\"));");
    expect(read("app/(main)/_components/forms/common/ticker-search-field.tsx")).not.toContain("/api/finance");
  });
  it("popover 기존 문구·키·카테고리 전환 초기화(resetKey)를 유지한다", () => {
    const src = read("app/(main)/_components/forms/common/ticker-search-field.tsx");
    expect(src).toContain("검색 결과가 없습니다. 티커(종목코드)를 직접 입력한 뒤 &lsquo;조회&rsquo;를 눌러주세요.");
    expect(src).toContain("nextSearchKey(e.key, activeIndex, results.length)");
    expect(src).toContain("[market, resetKey]");
    // 인라인은 Esc를 가로채지 않는다
    expect(src).toMatch(/action\.type === "close" && !inline/);
  });
});
