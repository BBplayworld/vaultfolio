// #239 [5.125 재설계 5차 5b] 내 자산 불리기 블록 렌더 — 종합 카드(라벨 3행·기준 4칸)·내 종목(묶음·행 2줄)·점검 한 장·기본 주기.
// 값 계산은 grow-board.test.ts, 저장 동작은 use-stock-labels.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import type { StockLabels } from "@/lib/asset/stock-labels";
import { computeStockTotals } from "../../detail/asset-detail-tabs";

const h = vi.hoisted(() => ({
  stocks: [] as unknown[], labels: null as unknown, ready: true, tx: [] as unknown[],
  div: { isLoading: false, failedCount: 0, annualAtHeldQty: 0 },
}));

vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { stocks: h.stocks, transactions: h.tx }, exchangeRates: { USD: 1400, JPY: 9 } }),
  notifyAssetUserEdit: () => {},
}));
vi.mock("@/hooks/use-stock-labels", () => ({
  useStockLabels: () => ({ labels: h.labels, ready: h.ready, setLabel: () => {}, record: () => {}, setPlan: () => {}, setCycle: () => {} }),
}));
vi.mock("../performance-hub", () => ({ useDividendAnnualTotals: () => h.div }));
vi.mock("../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: () => {} }) }));

import { ReviewSheet, StockLabelBlock } from "../stock-label-block";
import { buildBoardRows } from "@/lib/asset/grow-board";

const ago = (n: number) => new Date(Date.now() - n * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const st = (id: string, ticker: string, quantity: number, averagePrice = 100, currentPrice = 100, heldDays = 400): Stock => ({
  id, category: "domestic", name: `종목 ${ticker || id}`, ticker, quantity, averagePrice, currentPrice, currency: "KRW", purchaseDate: ago(heldDays),
} as Stock);
const mk = (items: StockLabels["items"], months: 3 | 6 | 12 | null = null): StockLabels => ({ v: 1, cycle: { months, at: months ? day(400) : "" }, items });
const render = (stocks: Stock[], labels: StockLabels, opts: { ready?: boolean; tx?: unknown[]; div?: typeof h.div } = {}) => {
  h.stocks = stocks; h.labels = labels; h.ready = opts.ready ?? true; h.tx = opts.tx ?? [];
  h.div = opts.div ?? { isLoading: false, failedCount: 0, annualAtHeldQty: 0 };
  return renderToStaticMarkup(<StockLabelBlock />);
};
// 보유 일수: AAA 800(2년+), BBB 500, CCC 200, DDD 100, EEE 50, FFF 30 — 이익·손실 섞음
const SIX = [
  st("a", "AAA", 60, 100, 50, 800), st("b", "BBB", 50, 100, 200, 500), st("c", "CCC", 40, 100, 110, 200),
  st("d", "DDD", 30, 100, 100, 100), st("e", "EEE", 20, 100, 130, 50), st("f", "FFF", 10, 100, 90, 30),
];
const rowsOf = (html: string) => [...html.matchAll(/<li data-testid="grow-row"[^>]*>/g)].map((m) => m[0]);
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))![1];
const text = (html: string) => html.replace(/<[^>]+>/g, "");

describe("블록 노출", () => {
  it("주식 0·저장소 읽기 전에는 DOM이 없다", () => {
    expect(render([], mk({}))).toBe("");
    expect(render(SIX, mk({}), { ready: false })).toBe("");
  });
  it("티커 없는 종목도 행이 있다(합계에 들어간다)", () => {
    expect(rowsOf(render([st("m", "", 1), st("a", "AAA", 1)], mk({})))).toHaveLength(2);
  });
  it("화면 문자열에 '이름표' 단어가 없다(5차 대표 피드백 ③) — 정한 것 있음·없음 모두", () => {
    expect(text(render(SIX, mk({})))).not.toContain("이름표");
    expect(text(render(SIX, mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40) } }, 3)))).not.toContain("이름표");
    expect(render(SIX, mk({}))).not.toMatch(/aria-label="[^"]*이름표/);
  });
});

describe("① 종합 카드", () => {
  it("합계 = 상세 › 주식 '전체' 헤더와 같은 공용 함수(원 단위), 손익색, 종목 수", () => {
    const html = render(SIX, mk({}));
    const t = computeStockTotals(SIX, { USD: 1400, JPY: 9 });
    const card = html.match(/<p data-testid="grow-total"[^>]*>/)![0];
    expect(Number(attr(card, "data-profit"))).toBe(Math.round(t.totalProfit));
    expect(attr(card, "data-rate")).toBe(`${t.totalProfitRate > 0 ? "+" : ""}${t.totalProfitRate.toFixed(1)}%`);
    expect(card).toMatch(/text-rose-|text-blue-/);
    expect(text(html)).toContain("산 날부터 지금까지 · 내 주식 6종목");
  });
  it("시세 없는 종목이 있으면 합계 대신 안내, 기준 4칸 숨김, 그 행은 —", () => {
    const html = render([...SIX.slice(0, 2), st("z", "ZZZ", 1, 100, 0)], mk({}));
    expect(html).toContain('data-state="unpriced"');
    expect(text(html)).toContain("시세를 불러오면 합계가 보여요.");
    expect(html).not.toContain('data-testid="grow-axes"');
    expect(html).toMatch(/data-testid="grow-row-rate" data-rate=""/);
  });
  it("배당 행: 조회 중 스켈레톤 / 실패 / 1년 약 N원 + 가정 표시 / 0이면 없음 문장", () => {
    const line = (div: typeof h.div) => render(SIX, mk({}), { div }).match(/<dd data-testid="grow-next-dividend"[^>]*>(.*?)<\/dd>/)![1];
    expect(line({ isLoading: true, failedCount: 0, annualAtHeldQty: 0 })).toMatch(/<span aria-hidden="true" class="inline-block h-4 w-32/);
    expect(text(line({ isLoading: false, failedCount: 1, annualAtHeldQty: 0 }))).toBe("배당 정보를 불러오지 못했어요");
    expect(text(line({ isLoading: false, failedCount: 0, annualAtHeldQty: 172_000 }))).toBe("1년 약 17만원지금 수량 기준 가정");
    expect(text(line({ isLoading: false, failedCount: 0, annualAtHeldQty: 0 }))).toBe("올해 예정된 배당이 없어요");
  });
  it("첫 사용자(정한 것 0): 라벨 2행 대신 안내 1줄, 배당 행은 남는다", () => {
    const html = render(SIX, mk({ CCC: { label: null, labeledAt: day(4), at: day(4) } }));
    expect(text(html.match(/<p data-testid="grow-guide"[^>]*>.*?<\/p>/)![0])).toBe("종목을 누르면 오래 둘·점검할을 정할 수 있어요");
    expect(html).not.toMatch(/grow-summary-keep|grow-summary-check/);
    expect(html).toContain('data-testid="grow-next-dividend"');
  });
  const dd = (html: string, id: string) => text(html.match(new RegExp(`<dd data-testid="${id}"[^>]*>(.*?)</dd>`))![1]);
  it("오래 둘 행 — 늘 수익률 꼴 + 산 날보다 낮은 수(없음 / K종목 / 모두), 문장 본문은 본문색이고 손익색은 %에만", () => {
    const keep = (t: string) => ({ [t]: { label: "keep" as const, labeledAt: day(40), at: day(40) } });
    expect(dd(render(SIX, mk({ ...keep("BBB"), ...keep("CCC") })), "grow-summary-keep")).toMatch(/^2종목 산 날부터 \+\d+\.\d% · 산 날보다 낮은 종목 없음$/);
    expect(dd(render(SIX, mk({ ...keep("AAA"), ...keep("BBB") })), "grow-summary-keep")).toMatch(/^2종목 산 날부터 [+-]?\d+\.\d% · 1종목 산 날보다 낮음$/);
    expect(dd(render(SIX, mk({ ...keep("AAA"), ...keep("FFF") })), "grow-summary-keep")).toMatch(/^2종목 산 날부터 -\d+\.\d% · 모두 산 날보다 낮음$/);
    const html = render(SIX, mk({ ...keep("AAA"), ...keep("BBB") }));
    const keepDd = html.match(/<dd data-testid="grow-summary-keep"[^>]*>(.*?)<\/dd>/)![1];
    expect(keepDd.match(/class="[^"]*text-(rose|blue)-/g)).toHaveLength(1);
    expect(dd(html, "grow-summary-check")).toBe("아직 없어요");
  });
  it("점검할 행 — 모두 / K종목 / 없음 점검 차례(종목명 없음)", () => {
    const chk = (t: string, d: number) => ({ [t]: { label: "check" as const, labeledAt: day(d), at: day(d) } });
    expect(dd(render(SIX, mk({ ...chk("BBB", 200), ...chk("CCC", 200) }, 3)), "grow-summary-check")).toBe("2종목 모두 점검 차례");
    expect(dd(render(SIX, mk({ ...chk("BBB", 200), ...chk("CCC", 10) }, 3)), "grow-summary-check")).toBe("2종목 중 1종목 점검 차례");
    expect(dd(render(SIX, mk({ ...chk("BBB", 10) }, 3)), "grow-summary-check")).toBe("1종목 · 점검 차례 없음");
  });
  it("기준 4칸 균등 버튼, 기본은 모두 닫힘(패널 없음). 묶음이 1개뿐인 축은 숨긴다(P2-7)", () => {
    const html = render(SIX, mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40) } }));
    const axes = [...html.matchAll(/data-testid="grow-axis-(\w+)" aria-expanded="(\w+)"/g)].map((m) => [m[1], m[2]]);
    // 분야·시가총액은 캐시가 없어 모두 미분류 1묶음 → 숨김. ETF·개별도 모두 개별 1묶음 → 숨김
    expect(axes).toEqual([["hold", "false"]]);
    expect(html).not.toContain('data-testid="grow-groups"');
    expect(render([SIX[0]], mk({}))).not.toContain('data-testid="grow-axes"');
  });
});

describe("② 내 종목", () => {
  const L = mk({
    AAA: { label: "keep", labeledAt: day(400), at: day(400), base: { qty: 60, price: 40 } }, // −50%, 12개월 지남 → 점검 차례
    BBB: { label: "keep", labeledAt: day(380), at: day(380) }, // +100%, 점검 차례
    CCC: { label: "check", labeledAt: day(150), at: day(150) }, // 주기 3개월 지남
    DDD: { label: "check", labeledAt: day(10), at: day(10) },
  }, 3);
  const html = render(SIX, L);
  it("묶음 고정 순서 오래 둘 → 점검할 → 아직 안 정함, 머리에 개수(묶음 합계 %·금액 없음)", () => {
    expect([...html.matchAll(/data-testid="grow-bucket" data-bucket="(\w+)"/g)].map((m) => m[1])).toEqual(["keep", "check", "none"]);
    const heads = [...html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => text(m[1]));
    expect(heads).toEqual(["오래 둘2", "점검할2", "아직 안 정함2"]);
  });
  it("묶음 안: 점검 차례 → 오래 가진 순. 오래 둘 차례 안에서 산 날보다 낮은 행 먼저(낮은 행에 색·배지 추가 없음)", () => {
    expect(rowsOf(html).map((r) => attr(r, "data-key"))).toEqual(["t:AAA", "t:BBB", "t:CCC", "t:DDD", "t:EEE", "t:FFF"]);
    const flipped = render(SIX, mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40) }, BBB: { label: "keep", labeledAt: day(380), at: day(380) }, FFF: { label: "keep", labeledAt: day(20), at: day(20) } }, 3));
    expect(rowsOf(flipped).slice(0, 3).map((r) => attr(r, "data-key"))).toEqual(["t:BBB", "t:AAA", "t:FFF"]); // 차례인 BBB 먼저, 나머지 오래 가진 순
    const aaa = html.match(/<li data-testid="grow-row" data-key="t:AAA"[\s\S]*?<\/li>/)![0];
    expect(aaa).not.toMatch(/destructive|amber|orange|주의|badge/);
  });
  it("행 2줄: `기간 · 점수 N · 정한 뒤 %`, 오른쪽 `점검 차례`, 모든 행 끝 `›`", () => {
    const aaa = text(html.match(/<li data-testid="grow-row" data-key="t:AAA"[\s\S]*?<\/li>/)![0]);
    expect(aaa).toMatch(/^종목 AAA-50\.0%2년 2개월·점수 1·정한 뒤 \+25\.0%점검 차례/);
    expect(text(html.match(/<li data-testid="grow-row" data-key="t:EEE"[\s\S]*?<\/li>/)![0])).toContain("1개월·측정 중");
    expect(html.match(/data-testid="grow-row-toggle"/g)).toHaveLength(6);
    expect(html.match(/<svg[^>]*lucide-chevron-right[^>]*row-span-2/g)).toHaveLength(6);
    expect(text(html)).not.toMatch(/\d\/5|재확인 차례/);
  });
  it("점검 한 장은 닫혀 있다(inert), 열린 행이 없으면 내용도 그리지 않는다", () => {
    expect(html.match(/inert=""[^>]*class="grid[^"]*grid-rows-\[0fr\]/g)!.length).toBeGreaterThanOrEqual(6);
    expect(html).not.toContain('data-testid="grow-sheet"');
  });
  it("첫 사용자: `아직 안 정함 N · 눌러서 정해요`, 빈 묶음은 머리째 숨김", () => {
    const first = render(SIX, mk({}));
    expect([...first.matchAll(/<h3[^>]*>(.*?)<\/h3>/g)].map((m) => text(m[1]))).toEqual(["아직 안 정함6 · 눌러서 정해요"]);
  });
  it("손익색은 %·막대·큰 합계에만, 주황·경고색 없음. 목록 머리 오른쪽은 `산 날부터`만(범례 숫자 없음)", () => {
    expect(html).not.toMatch(/orange-|amber-|destructive|important/);
    expect(text(html.match(/<section data-testid="grow-list"[\s\S]*?<\/h2>|<section data-testid="grow-list"[\s\S]*?산 날부터/)![0])).toContain("내 종목");
    expect(html).not.toMatch(/0~\+30%|오래 가진 순/);
  });
  it("점검할 기본 주기는 맨 아래 설정 줄 1개", () => {
    const h3 = render(SIX, mk({}, 3));
    expect(text(h3.match(/<button[^>]*data-testid="grow-cycle-row"[^>]*>.*?<\/button>/)![0])).toBe("점검할 기본 주기3개월");
    expect(h3.indexOf('data-testid="grow-cycle-row"')).toBeGreaterThan(h3.lastIndexOf('data-testid="grow-row"'));
    expect(text(render(SIX, mk({})).match(/<button[^>]*data-testid="grow-cycle-row"[^>]*>.*?<\/button>/)![0])).toBe("점검할 기본 주기정하지 않음");
  });
});

describe("점검 한 장", () => {
  const rates = { USD: 1400, JPY: 9 };
  const sheet = (labels: StockLabels, ticker: string, opts: { planOpen?: boolean; tx?: unknown[] } = {}) => {
    const row = buildBoardRows(SIX, rates, labels, Date.now(), (opts.tx ?? []) as never).find((r) => r.labelKey === ticker)!;
    return renderToStaticMarkup(
      <ReviewSheet row={row} labels={labels} nowMs={Date.now()} planOpen={!!opts.planOpen} onPlanOpen={() => {}} onChoose={() => {}} onSavePlan={() => {}} onOpenPage={() => {}} />,
    );
  };
  const CHECK = (o: Partial<StockLabels["items"][string]> = {}) => mk({ BBB: { label: "check", labeledAt: day(150), at: day(150), ...o } }, 3);
  it("섹션 5개: 차례 이유 → 선택 3버튼(그대로 둠 둘째 줄 `다음 점검 M월 D일`) → 조건 요약 → 이동 안내 → 최근 기록·바닥 줄", () => {
    const html = sheet(CHECK({ plan: { down: 10, memo: "실적 발표 뒤 다시 보기" } }), "BBB");
    const t = text(html);
    expect(t).toMatch(/^점검 차례 · 정한 기간 3개월이 지났어요/);
    expect([...html.matchAll(/data-testid="grow-choice-(same|keep|check|none)"/g)].map((m) => m[1])).toEqual(["same", "keep", "none"]);
    expect(text(html.match(/<button[^>]*data-testid="grow-choice-same"[\s\S]*?<\/button>/)![0])).toMatch(/^그대로 둠다음 점검 \d{1,2}월 \d{1,2}일$/);
    expect(text(html.match(/<button[^>]*data-testid="grow-plan-summary"[\s\S]*?<\/button>/)![0])).toBe("다시 볼 조건−10% 이하 · 3개월 · 메모");
    expect(t).toContain("점검할에서 옮기면 다시 볼 조건과 메모도 지워져요");
    expect(t).toContain("아직 점검 기록이 없어요");
    expect(t).toContain("매매 0건 · 최근 3개월 이 앱 기록종목 페이지");
    // 메모 값은 요약에 없다(표시만)
    expect(t).not.toContain("실적 발표");
  });
  it("조건이 없으면 `다시 볼 조건 정하기`, 이동 안내 없음. 오래 둘은 조건 없이 `그대로 오래 둠·점검할로·정하지 않음`", () => {
    const html = sheet(CHECK(), "BBB");
    expect(text(html.match(/<button[^>]*data-testid="grow-plan-summary"[\s\S]*?<\/button>/)![0])).toBe("다시 볼 조건 정하기");
    expect(html).not.toContain("grow-plan-warn");
    const keep = sheet(mk({ BBB: { label: "keep", labeledAt: day(40), at: day(40) } }, 3), "BBB");
    expect([...keep.matchAll(/aria-label="종목 BBB ([^"]+)"/g)].map((m) => m[1])).toEqual(["그대로 오래 둠", "점검할로", "정하지 않음"]);
    expect(keep).not.toContain("grow-plan-summary");
    const unset = sheet(mk({}), "BBB");
    expect([...unset.matchAll(/data-testid="grow-choice-(same|keep|check|none)"/g)].map((m) => m[1])).toEqual(["keep", "check"]);
    expect(unset).not.toContain("grow-history");
  });
  it("조건 폼: 빈 칸 시작(예시 숫자 없음), 기간 기본, 메모 칸은 캡처 숨김·글자 수, 안내 1줄", () => {
    const html = sheet(CHECK({ plan: { up: 25 } }), "BBB", { planOpen: true });
    const inputs = [...html.matchAll(/<input[^>]*>/g)].map((m) => m[0]);
    expect(inputs).toHaveLength(3);
    for (const i of inputs) expect(i).not.toMatch(/placeholder=/);
    expect(attr(inputs.find((i) => i.includes("grow-plan-down"))!, "value")).toBe("");
    expect(attr(inputs.find((i) => i.includes("grow-plan-up"))!, "value")).toBe("25");
    expect(html).toMatch(/<label data-screenshot-hide="[^"]*"[^>]*>(?:(?!<\/label>)[\s\S])*grow-plan-memo/);
    expect(html).toMatch(/maxlength="40"/i);
    expect(text(html)).toContain("기본 3개월");
    expect(text(html)).toContain("내가 정한 조건이에요. 앱이 권하는 값이 아니에요");
  });
  it("최근 기록: `점검 N번 · 그대로 M번`, 최신 3건, `그때 산 날부터 ±x%`", () => {
    const L: StockLabels = { ...CHECK(), reviews: [
      { t: "BBB", at: day(20), from: "check", choice: "same", price: 190, rate: 90 },
      { t: "BBB", at: day(60), from: "check", choice: "same", price: 150, rate: 50.04 },
      { t: "BBB", at: day(90), from: "keep", choice: "check", price: 120, rate: 20 },
      { t: "BBB", at: day(120), from: "check", choice: "keep", price: 110, rate: -10 },
      { t: "AAA", at: day(20), from: "keep", choice: "same", price: 50, rate: -50 },
    ] };
    const html = sheet(L, "BBB");
    expect(text(html)).toContain("최근 기록 · 점검 4번 · 그대로 2번");
    const rows = [...html.matchAll(/<p data-testid="grow-history-row"[\s\S]*?<\/p>/g)].map((m) => text(m[0]));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatch(/^\d{1,2}월 \d{1,2}일그대로 둠그때 산 날부터 \+90\.0%$/);
    expect(rows[2]).toMatch(/점검할로그때 산 날부터 \+20\.0%$/);
    // 점검 뒤 % 행 2줄 기준은 마지막 그대로 둠 가격(190)
    expect(text(html)).toMatch(/^다음 점검|^점검 차례|^오늘 점검함/);
  });
  it("오늘 그대로 둔 행은 `오늘 점검함` — 다시 누를 수 없다(aria-disabled), 이유 줄에 다음 점검일", () => {
    const html = sheet({ ...CHECK({ checkedAt: day(0), at: day(0) }), reviews: [{ t: "BBB", at: day(0), from: "check", choice: "same", price: 200, rate: 100 }] }, "BBB");
    expect(html.match(/<button[^>]*data-testid="grow-choice-same"[^>]*>/)![0]).toContain('aria-disabled="true"');
    expect(text(html)).toMatch(/^오늘 점검함 · 다음 점검 \d{1,2}월 \d{1,2}일/);
  });
});
