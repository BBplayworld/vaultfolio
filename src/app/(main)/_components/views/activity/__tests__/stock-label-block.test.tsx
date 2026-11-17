// #239 [5.125] 이름표·점검 블록 렌더 — 상태별 DOM(AC-5~9), 추천 아님 조건 1·2. 저장 동작은 use-stock-labels.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import type { StockLabels } from "@/lib/asset/stock-labels";

const h = vi.hoisted(() => ({ stocks: [] as unknown[], labels: null as unknown, ready: true, tx: [] as unknown[] }));

vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: { stocks: h.stocks, transactions: h.tx }, exchangeRates: { USD: 1400, JPY: 9 } }),
  notifyAssetUserEdit: () => {},
}));
vi.mock("@/hooks/use-stock-labels", () => ({
  useStockLabels: () => ({ labels: h.labels, ready: h.ready, setLabel: () => {}, markChecked: () => {}, setCycle: () => {} }),
}));
vi.mock("../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: () => {} }) }));

import { StockLabelBlock } from "../stock-label-block";

const st = (id: string, ticker: string, quantity: number, averagePrice = 100, currentPrice = 100): Stock => ({
  id, category: "foreign", name: `종목 ${ticker}`, ticker, quantity, averagePrice, currentPrice, currency: "KRW", purchaseDate: "2024-01-01",
} as Stock);
const day = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const mk = (items: StockLabels["items"], months: 3 | 6 | 12 | null = null): StockLabels => ({ v: 1, cycle: { months, at: months ? day(400) : "" }, items });
type BlockProps = Parameters<typeof StockLabelBlock>[0];
const render = (stocks: Stock[], labels: StockLabels, ready = true, props: BlockProps = {}, tx: unknown[] = []) => {
  h.stocks = stocks; h.labels = labels; h.ready = ready; h.tx = tx;
  return renderToStaticMarkup(<StockLabelBlock {...props} />);
};
const SIX = [st("a", "AAA", 60, 100, 50), st("b", "BBB", 50, 100, 200), st("c", "CCC", 40), st("d", "DDD", 30), st("e", "EEE", 20), st("f", "FFF", 10)];
const rowsOf = (html: string) => [...html.matchAll(/<li data-testid="grow-row"[^>]*>/g)].map((m) => m[0]);
const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}="([^"]*)"`))![1];
const summaryOf = (html: string) => html.match(/<(p|div) data-testid="grow-summary"[^>]*>.*?<\/(p|ul><\/div)>/)![0];
const legendOf = (html: string) => [...html.matchAll(/<li data-testid="grow-weight-(\w+)" data-count="(\d+)" data-pct="([^"]*)"[^>]*>(.*?)<\/li>/g)]
  .map((m) => ({ key: m[1], count: Number(m[2]), pct: m[3], text: m[4].replace(/<[^>]+>/g, "") }));

describe("블록 노출", () => {
  it("주식 0·티커 없는 종목만·저장소 읽기 전에는 DOM이 없다", () => {
    expect(render([], mk({}))).toBe("");
    expect(render([{ ...st("m", "", 1), ticker: "" }], mk({}))).toBe("");
    expect(render(SIX, mk({}), false)).toBe("");
  });
});

describe("이름표 0개(AC-6·6c·8)", () => {
  const html = render(SIX, mk({}));
  it("요약 자리에 숫자·분류가 없고 안내 문장만 있다", () => {
    const s = summaryOf(html);
    expect(s).toContain('data-state="empty"');
    expect(s).toContain("이름표를 붙이면 내 주식이 어떻게 나뉘는지 여기에 보여요.");
    expect(s).toContain("text-pretty break-keep");
    expect(s.replace(/<[^>]+>/g, "")).not.toMatch(/\d|오래 둘|점검할|정하지 않음/);
    // AC-21: 막대·범례도 없다
    expect(html).not.toMatch(/grow-weight-/);
  });
  it("이름표 3택·주기 어느 칸도 선택돼 있지 않고 `지났어요`가 없다", () => {
    expect(html).not.toContain('aria-checked="true"');
    expect(html.match(/aria-checked="false"/g)).toHaveLength(6 * 3 + 3);
    expect(html).not.toContain("지났어요");
    expect(html).not.toContain('data-slot="thumb"');
  });
  it("모든 행이 unset이고 점검 버튼은 닫혀 있다(inert)", () => {
    for (const r of rowsOf(html)) expect(attr(r, "data-label")).toBe("unset");
    expect(html.match(/data-testid="grow-check"/g)).toHaveLength(6); // 항상 마운트
    expect(html.match(/inert=""[^>]*class="[^"]*grid-rows-\[0fr\][^"]*"><div class="min-h-0 overflow-hidden"><button/g)).toHaveLength(6);
  });
});

describe("이름표 있음(AC-5·6·6a·9)", () => {
  const labels = mk({
    AAA: { label: "keep", labeledAt: day(40), at: day(40) },
    BBB: { label: "check", labeledAt: day(300), checkedAt: day(200), at: day(200) }, // 주기 3개월 경과
    EEE: { label: "check", labeledAt: day(300), checkedAt: day(150), at: day(150) }, // 경과(비중 5번째)
    DDD: { label: null, labeledAt: day(10), at: day(10) },
    FFF: { label: "check", labeledAt: day(5), checkedAt: day(0), at: day(0) },       // 오늘 점검함
    SOLD: { label: "keep", labeledAt: day(10), at: day(10) },                        // 보유하지 않는 티커
  }, 3);
  const html = render(SIX, labels);
  const rows = rowsOf(html);
  it("무게 줄: 종목 수 합 = 종목 수(보유하지 않는 티커 제외), 세 비중의 합 100.0, 순서 고정(AC-22)", () => {
    const legend = legendOf(html);
    expect(legend.map((l) => [l.key, l.count])).toEqual([["keep", 1], ["check", 3], ["none", 2]]);
    // 평가액: AAA 3000, BBB 10000, CCC 4000, DDD 3000, EEE 2000, FFF 1000 = 23000 → keep 3000, check 13000
    expect(legend.map((l) => l.pct)).toEqual(["13.0%", "56.5%", "30.5%"]);
    expect(legend.reduce((sum, l) => sum + Number(l.pct.slice(0, -1)), 0)).toBeCloseTo(100, 6);
    expect(legend.map((l) => l.text)).toEqual(["오래 둘 1종목 · 내 주식의 13.0%", "점검할 3종목 · 56.5%", "정하지 않음 2종목 · 30.5%"]);
    expect(summaryOf(html)).toContain('data-state="labeled"');
  });
  it("막대: 조각 3개가 표시 비중과 같은 폭, 무채색 3단, 값은 범례가 말한다(aria-hidden)", () => {
    expect(html).toMatch(/data-testid="grow-weight-bar" aria-hidden="true"/);
    const segs = [...html.matchAll(/data-testid="grow-weight-seg-(\w+)" class="([^"]*)" style="width:([\d.]+)%"/g)].map((m) => [m[1], m[3], m[2].match(/bg-foreground\/\d+/)![0]]);
    expect(segs).toEqual([["keep", "13", "bg-foreground/80"], ["check", "56.5", "bg-foreground/45"], ["none", "30.5", "bg-foreground/15"]]);
    // 범례 점과 조각이 같은 색
    expect(html.match(/size-2 shrink-0 rounded-full bg-foreground\/(80|45|15)/g)).toHaveLength(3);
  });
  it("주기가 지난 행이 위(비중 순), 그 밖은 비중 순. 처음 3행 + 전체 보기, 지난 행은 접힌 묶음에 없다", () => {
    expect(rows.map((r) => attr(r, "data-ticker"))).toEqual(["BBB", "EEE", "CCC", "AAA", "DDD", "FFF"]);
    expect(rows.map((r) => attr(r, "data-overdue"))).toEqual(["true", "true", "false", "false", "false", "false"]);
    const rest = html.slice(html.indexOf('data-testid="grow-rows-rest"'), html.indexOf('data-testid="grow-more"'));
    expect(rowsOf(rest).map((r) => attr(r, "data-ticker"))).toEqual(["AAA", "DDD", "FFF"]);
    expect(rest).toContain('inert=""');
    expect(html).toMatch(/data-testid="grow-more"[^>]*aria-expanded="false"[^>]*aria-controls="grow-rows-rest"/);
    expect(html.match(/<button[^>]*data-testid="grow-more"[^>]*>(.*?)<\/button>/)![1].replace(/<[^>]+>/g, "")).toBe("전체 보기"); // 숫자 없음
  });
  it("선택 표시: keep·check·'정하지 않음'을 누른 행은 그 칸, 한 번도 안 고른 행은 0칸", () => {
    const checkedIn = (ticker: string) => {
      const from = html.indexOf(`data-ticker="${ticker}"`);
      const to = html.indexOf("</li>", from);
      return [...html.slice(from, to).matchAll(/aria-checked="true"[^>]*data-testid="(grow-label-\w+)"/g)].map((m) => m[1]);
    };
    expect(checkedIn("AAA")).toEqual(["grow-label-keep"]);
    expect(checkedIn("BBB")).toEqual(["grow-label-check"]);
    expect(checkedIn("DDD")).toEqual(["grow-label-none"]);
    expect(checkedIn("CCC")).toEqual([]);
  });
  it("사실 문구: 붙인 날·마지막 점검·주기 경과, 오늘 점검한 행은 `오늘 점검함`", () => {
    expect(html).toContain("오래 두기로 한 지 1개월");
    expect(html).toContain("내가 정한 주기 3개월이 지났어요");
    expect(html.match(/지났어요/g)).toHaveLength(2);
    expect(html).toContain("마지막 점검 오늘");
    expect(html).toMatch(/data-testid="grow-check"[^>]*data-state="done"[^>]*aria-disabled="true"/);
    expect(html.match(/data-state="done"/g)).toHaveLength(1);
    expect(html.match(/>오늘 점검했어요</g)).toHaveLength(5);
  });
  it("손실 행과 이익 행의 사실 줄 클래스가 같고 손익색·경고색 클래스가 없다", () => {
    const facts = [...html.matchAll(/<span data-testid="grow-row-fact" class="([^"]*)">(.*?)<\/span><\/span>/g)];
    expect(facts).toHaveLength(6);
    expect(new Set(facts.map((m) => m[1])).size).toBe(1);
    // 값 span의 클래스도 한 종류(−50% 행과 +100% 행이 같은 색)
    const valueClasses = new Set([...html.matchAll(/내 매입가 대비 <span class="([^"]*)">/g)].map((m) => m[1]));
    expect([...valueClasses]).toEqual(["font-semibold text-foreground"]);
    expect(html).toContain(">-50.0%<");
    expect(html).toContain(">+100.0%<");
    // 공용 Button 기본 클래스의 입력 오류 표시(aria-invalid:*)는 상태 조건부라 제외하고 본다
    expect(html.replace(/(dark:)?aria-invalid:[^\s"]+/g, "")).not.toMatch(/rose-|blue-|red-|orange-|amber-|destructive|text-profit|text-loss/);
    // 모든 행의 뼈대(태그·testid 순서)가 같다
    // (수량 비교·주기 경과 조각은 있는 행에만 붙는 선택 조각이라 뼈대 비교에서 뺀다)
    // (이름표 있는 행에만 붙는 조각 — 주기 경과·정한 뒤 줄·매매 줄 — 은 뼈대 비교에서 뺀다)
    const OPTIONAL = ["grow-row-qty", "grow-row-overdue", "grow-row-since", "grow-row-price", "grow-row-trades"];
    const shape = (li: string) => [...li.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]).filter((id) => !OPTIONAL.includes(id)).join(",");
    const lis = html.split('<li data-testid="grow-row"').slice(1).map((x) => x.slice(0, x.indexOf("</li>")));
    expect(new Set(lis.map(shape)).size).toBe(1);
  });
  it("행마다 종목 페이지 입구 1개, 블록 안에 다른 화면으로 가는 링크 없음", () => {
    expect(html.match(/data-testid="grow-row-open"/g)).toHaveLength(6);
    expect(html).not.toMatch(/<a |X-Ray|성적표|배당|세금/);
    expect(html).toMatch(/aria-label="종목 AAA 종목 페이지 보기, 내 주식의 [\d.]+%, 내 매입가 대비 -50\.0%"/);
  });
});

describe("접힘 경계(AC-6a)", () => {
  it("종목 3개 이하면 전체 보기가 없다", () => {
    const html = render(SIX.slice(0, 3), mk({}));
    expect(html).not.toContain("grow-more");
    expect(rowsOf(html)).toHaveLength(3);
  });
  it("지난 행이 5개면 5행이 모두 보이고 나머지 1행만 접힌다. 전 행이 지난 행이면 버튼이 없다", () => {
    const od = { label: "check" as const, labeledAt: day(300), checkedAt: day(200), at: day(200) };
    const five = render(SIX, mk(Object.fromEntries(["AAA", "BBB", "CCC", "DDD", "EEE"].map((t) => [t, od])), 3));
    const rest = five.slice(five.indexOf('data-testid="grow-rows-rest"'), five.indexOf('data-testid="grow-more"'));
    expect(rowsOf(rest).map((r) => attr(r, "data-ticker"))).toEqual(["FFF"]);
    const all = render(SIX, mk(Object.fromEntries(SIX.map((s) => [s.ticker!, od])), 3));
    expect(all).not.toContain("grow-more");
    expect(rowsOf(all)).toHaveLength(6);
  });
});

describe("수량 비교 조각(AC-25~27) — 정한 날의 내 기록과 지금의 내 기록", () => {
  const item = (label: "keep" | "check", qty?: number, ago = 40) => ({ label, labeledAt: day(ago), at: day(ago), ...(qty ? { base: { qty } } : {}) });
  const labels = mk({
    AAA: item("keep", 60),          // 같음
    BBB: item("check", 20),         // 늘어남 20 → 50
    CCC: item("keep", 100),         // 줄어듦 100 → 40
    DDD: item("check", 30),         // 같음(점검할)
    EEE: item("keep"),              // base 없음
    FFF: item("keep", 99, 0),       // 정한 날 당일
  });
  const html = render(SIX, labels);
  // 수량 조각은 '→' 앞에서만 줄을 바꾸려고 안쪽을 nowrap 조각으로 나눈다(ui-review R-I1) — 글자는 태그를 걷어 비교한다
  const strip = (h: string) => h.replace(/<[^>]+>/g, "");
  const qty = [...html.matchAll(/<span data-testid="grow-row-qty" data-state="(\w+)" class="([^"]*)">((?:\s?<span class="whitespace-nowrap">[^<]*<\/span>)+)<\/span>/g)].map((m) => ({ state: m[1], cls: m[2], text: strip(m[3]) }));
  const liOf = (ticker: string) => { const from = html.indexOf(`data-ticker="${ticker}"`); return strip(html.slice(from, html.indexOf("</li>", from))); };
  it("같으면 `정한 뒤 수량 그대로`, 다르면 `정한 날 N주 → 지금 M주` — 두 형식뿐", () => {
    expect(liOf("AAA")).toContain("정한 뒤 수량 그대로 1개월");
    expect(liOf("BBB")).toContain("정한 날 20주 → 지금 50주");
    expect(liOf("CCC")).toContain("정한 날 100주 → 지금 40주");
    expect(liOf("DDD")).toContain("정한 뒤 수량 그대로 1개월");
    expect(qty).toHaveLength(4);
    expect(qty.map((q) => q.text).sort()).toEqual(["정한 날 100주 → 지금 40주", "정한 날 20주 → 지금 50주", "정한 뒤 수량 그대로 1개월", "정한 뒤 수량 그대로 1개월"]);
  });
  it("'오래 둘'·'점검할', 늘어난 행·줄어든 행의 클래스가 같고 안에 굵은 글자·아이콘·색이 없다", () => {
    expect(new Set(qty.map((q) => q.cls)).size).toBe(1);
    expect(qty[0].cls).toBe("@min-[33rem]:whitespace-nowrap");
    expect(qty.map((q) => q.state).sort()).toEqual(["changed", "changed", "same", "same"]);
  });
  it("base 없는 항목·정한 날 당일은 조각 자체가 없고 가운뎃점만 남지 않는다. 나머지 줄은 정상", () => {
    for (const t of ["EEE", "FFF"]) {
      const raw = html.slice(html.indexOf(`data-ticker="${t}"`), html.indexOf("</li>", html.indexOf(`data-ticker="${t}"`)));
      // 정한 뒤 줄 자체가 없고(AC-27·37) 이름표 줄 다음이 바로 매매 줄이다
      expect(raw).not.toMatch(/grow-row-since|grow-row-qty|grow-row-price/);
      const group = raw.slice(raw.indexOf('data-testid="grow-row-label-fact"'), raw.indexOf('data-testid="grow-label"'));
      expect(group.replace(/<[^>]+>/g, "")).not.toMatch(/·|—/);
      expect(group).toMatch(/<\/span><\/span><span data-testid="grow-row-trades"/);
    }
    expect(liOf("EEE")).toContain("오래 두기로 한 지 1개월");
    expect(liOf("FFF")).toContain("오늘 오래 두기로 했어요");
  });
  it("줄 순서: 이름표 줄(① · ③ 주기 경과) → 정한 뒤 줄(가격 · 수량) → 매매 줄(AC-34)", () => {
    const od = render(SIX, mk({ BBB: { label: "check", labeledAt: day(300), checkedAt: day(200), base: { qty: 20, price: 100 }, at: day(200) } }, 3));
    const from = od.indexOf('data-ticker="BBB"');
    const group = od.slice(od.indexOf('data-testid="grow-row-label-fact"', from), od.indexOf('data-testid="grow-label"', from));
    const ids = [...group.matchAll(/data-testid="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toEqual(["grow-row-label-fact", "grow-row-overdue", "grow-row-since", "grow-row-price", "grow-row-qty", "grow-row-trades"]);
    const text = group.replace(/<[^>]+>/g, "");
    const order = ["마지막 점검", "내가 정한 주기 3개월이 지났어요", "정한 날 가격 대비 +100.0%", "정한 날 20주 → 지금 50주", "이 앱에 기록한 매매 최근 3개월 0건"].map((t) => text.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 이름표 줄만 6px(mt-1.5), 나머지는 2px(mt-0.5). 줄 규칙은 폭 기준 30rem·33rem
    expect(group).toMatch(/data-testid="grow-row-label-fact" class="mt-1\.5 flex flex-col @min-\[30rem\]:flex-row/);
    expect(group).toMatch(/data-testid="grow-row-since" class="mt-0\.5 flex flex-col @min-\[33rem\]:flex-row/);
    expect(group).toMatch(/data-testid="grow-row-trades" data-count="0" class="mt-0\.5 block whitespace-nowrap"/);
  });
  it("수량 조각이 있어도 행 순서는 비중 순 그대로(이 값으로 정렬하지 않는다)", () => {
    expect(rowsOf(html).map((r) => attr(r, "data-ticker"))).toEqual(rowsOf(render(SIX, mk({}))).map((r) => attr(r, "data-ticker")));
  });
});

describe("시세 없는 종목·주기 안내(AC-24·29)", () => {
  it("시세 없는 종목이 하나라도 있으면 막대가 없고 범례 비중이 —, 종목 수는 그대로. 수량 비교는 나온다", () => {
    const stocks = [...SIX.slice(0, 2), st("z", "ZZZ", 5, 100, 0)];
    const html = render(stocks, mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40), base: { qty: 10 } }, ZZZ: { label: "check", labeledAt: day(40), at: day(40), base: { qty: 5 } } }));
    expect(html).not.toContain("grow-weight-bar");
    expect(legendOf(html).map((l) => l.text)).toEqual(["오래 둘 1종목 · 내 주식의 —", "점검할 1종목 · —", "정하지 않음 1종목 · —"]);
    expect(html.replace(/<[^>]+>/g, "")).toContain("정한 날 10주 → 지금 60주");
    expect(html.replace(/<[^>]+>/g, "")).toContain("정한 뒤 수량 그대로 1개월");
  });
  it("주기 안내 문장은 주기를 고르기 전에만 열려 있다(항상 마운트, 고른 뒤 접힘)", () => {
    const before = render(SIX, mk({}));
    const after = render(SIX, mk({}, 6));
    const wrap = (html: string) => html.match(/<div( aria-hidden="true")? class="([^"]*)"><div class="min-h-0 overflow-hidden"><p data-testid="grow-cycle-caption"/)!;
    expect(wrap(before)[1]).toBeUndefined();
    expect(wrap(before)[2]).toContain("grid-rows-[1fr]");
    expect(wrap(after)[1]).toBe(' aria-hidden="true"');
    expect(wrap(after)[2]).toContain("grid-rows-[0fr]");
  });
});

// ─── 인사이트 4종(AC-34~41) ─────────────────────────────────────────────

describe("정한 뒤 줄·매매 줄(AC-34~38)", () => {
  const item = (label: "keep" | "check", base?: { qty: number; price?: number }, ago = 40) => ({ label, labeledAt: day(ago), at: day(ago), ...(base ? { base } : {}) });
  const dayText = (n: number) => new Date(Date.now() + 9 * 3_600_000 - n * 86_400_000).toISOString().slice(0, 10);
  const tx = (stockId: string, ago: number, type = "buy") => ({ id: `t${stockId}${ago}${type}`, stockId, ticker: "X", stockName: "x", type, quantity: 1, price: 1, currency: "KRW", date: dayText(ago), reflected: true, createdAt: "" });
  // 지금 시세: AAA 50, BBB 200, CCC·DDD·EEE·FFF 100
  const labels = mk({
    AAA: item("keep", { qty: 60, price: 100 }),   // −50.0%, 수량 같음
    BBB: item("check", { qty: 20, price: 160 }),  // +25.0%, 늘어남
    CCC: item("keep", { qty: 100, price: 100 }),  // 0.0%, 줄어듦
    DDD: item("check", { qty: 30 }),              // 정한 날 시세 없음 → 수량만
    EEE: item("keep"),                            // base 없음 → 줄 없음
    FFF: item("keep", { qty: 10, price: 100 }, 0), // 당일 → 줄 없음
  });
  const txs = [tx("a", 5), tx("a", 20, "sell"), tx("b", 10), tx("zzz", 3)];
  const html = render(SIX, labels, true, {}, txs);
  const li = (t: string) => { const from = html.indexOf(`data-ticker="${t}"`); return html.slice(from, html.indexOf("</li>", from)); };
  const text = (t: string) => li(t).replace(/<[^>]+>/g, "");
  it("가격 조각: 양수·음수·0 같은 형식, 굵은 값은 % 하나, 손익색 없음", () => {
    expect(text("AAA")).toContain("정한 날 가격 대비 -50.0%");
    expect(text("BBB")).toContain("정한 날 가격 대비 +25.0%");
    expect(text("CCC")).toContain("정한 날 가격 대비 0.0%");
    const price = [...html.matchAll(/<span data-testid="grow-row-price" data-state="(\w+)" class="([^"]*)">정한 날 가격 대비 <span class="([^"]*)">([^<]*)<\/span><\/span>/g)];
    expect(price.map((m) => m[4])).toEqual(expect.arrayContaining(["-50.0%", "+25.0%", "0.0%"]));
    expect(price).toHaveLength(3);
    expect(new Set(price.map((m) => `${m[1]}|${m[2]}|${m[3]}`))).toEqual(new Set(["value|whitespace-nowrap|font-semibold text-foreground"]));
  });
  it("정한 날 시세 없음 → 가격 조각 없이 수량만(앞에 가운뎃점 없음). base 없음·당일 → 줄 없음", () => {
    const since = li("DDD").match(/<span data-testid="grow-row-since"[^>]*>(.*?)<span data-testid="grow-row-trades"/)![1];
    expect(since).not.toContain("grow-row-price");
    expect(since.replace(/<[^>]+>/g, "")).toBe("정한 뒤 수량 그대로 1개월");
    for (const t of ["EEE", "FFF"]) expect(li(t)).not.toContain("grow-row-since");
  });
  it("지금 시세가 없으면 그 행만 `정한 날 가격 대비 —`, 수량은 나온다", () => {
    const stocks = [...SIX.slice(0, 2), st("z", "ZZZ", 5, 100, 0)];
    const h2 = render(stocks, mk({ ZZZ: item("keep", { qty: 5, price: 100 }), AAA: item("keep", { qty: 60, price: 100 }) }), true, {}, []);
    expect(h2).toMatch(/data-testid="grow-row-price" data-state="dash"[^>]*>정한 날 가격 대비 <span class="font-semibold text-foreground">—<\/span>/);
    expect(h2.replace(/<[^>]+>/g, "")).toContain("정한 날 가격 대비 —·정한 뒤 수량 그대로 1개월");
    expect(h2.match(/data-state="dash"/g)).toHaveLength(1);
  });
  it("매매 줄: 이름표 있는 행 전부(당일 포함), 0건도 같은 문장·같은 클래스, 굵은 부분은 N건뿐", () => {
    const trades = [...html.matchAll(/<span data-testid="grow-row-trades" data-count="(\d+)" class="([^"]*)">이 앱에 기록한 매매 최근 3개월 <span class="([^"]*)">(\d+)건<\/span><\/span>/g)];
    expect(trades).toHaveLength(6);
    expect(new Set(trades.map((m) => `${m[2]}|${m[3]}`)).size).toBe(1);
    expect(text("AAA")).toContain("이 앱에 기록한 매매 최근 3개월 2건"); // 매수 1 + 매도 1 — 나눠 세지 않는다
    expect(text("BBB")).toContain("이 앱에 기록한 매매 최근 3개월 1건");
    expect(text("CCC")).toContain("이 앱에 기록한 매매 최근 3개월 0건");
    expect(text("FFF")).toContain("이 앱에 기록한 매매 최근 3개월 0건"); // 붙인 당일에도 보인다
    expect(html).not.toMatch(/매수 \d|매도 \d/);
  });
  it("이름표 없는 행·이름표 0개 화면에는 정한 뒤 줄·매매 줄·연결 문장이 DOM에 없다", () => {
    const zero = render(SIX, mk({}), true, { dividend: { annualTotal: 100, byLabelKey: new Map([["AAA", 100]]), isLoading: false, failedCount: 0 } }, txs);
    expect(zero).not.toMatch(/grow-row-since|grow-row-trades|grow-row-price|grow-link/);
    const one = render(SIX, mk({ AAA: item("keep", { qty: 60, price: 100 }) }), true, {}, txs);
    expect(one.match(/data-testid="grow-row-trades"/g)).toHaveLength(1);
    expect(one.match(/data-testid="grow-row-since"/g)).toHaveLength(1);
  });
  it("'오래 둘'·'점검할' 행의 3·4줄 구조가 같고, 행 순서는 인사이트 값과 무관하다", () => {
    const shape = (t: string) => [...li(t).matchAll(/data-testid="(grow-row-(?:since|price|qty|trades))"[^>]*class="([^"]*)"/g)].map((m) => `${m[1]}:${m[2]}`).join("|");
    expect(shape("AAA")).toBe(shape("BBB"));
    expect(rowsOf(html).map((r) => attr(r, "data-ticker"))).toEqual(rowsOf(render(SIX, mk({}))).map((r) => attr(r, "data-ticker")));
    expect(html.replace(/(dark:)?aria-invalid:[^\s"]+/g, "")).not.toMatch(/rose-|blue-|red-|orange-|amber-|destructive|text-profit|text-loss/);
    expect(html).not.toMatch(/[\d,]+원/); // 금액 문자열 없음(AC-41)
  });
});

describe("요약 영역 2 — 연결 문장(AC-39~41)", () => {
  const keepA = mk({ AAA: { label: "keep", labeledAt: day(40), at: day(40) }, BBB: { label: "check", labeledAt: day(40), at: day(40) } });
  const div = (over: Partial<NonNullable<BlockProps>["dividend"]> = {}) => ({ annualTotal: 1000, byLabelKey: new Map([["AAA", 250], ["BBB", 750]]), isLoading: false, failedCount: 0, ...over });
  const ref = (o: Record<string, number | null>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === null ? null : { refPrice: v, refDate: "2025-12-30" }]));
  const ALL = { AAA: 40, BBB: 100, CCC: 100, DDD: 100, EEE: 100, FFF: 100 };
  const settleOf = (html: string) => html.match(/<li data-testid="grow-link-settle" data-state="(\w+)" data-pct="([^"]*)" data-excluded="(\d+)"[^>]*>(.*?)<\/li>/);
  it("배당: `올해 배당 중 오래 둘 자산 몫은 N%예요` — 범례 아래, 링크·금액 없음, 블록 문장에 `예상 배당` 없음(R-C1)", () => {
    const html = render(SIX, keepA, true, { dividend: div() });
    const link = html.match(/<ul data-testid="grow-link"[^>]*>(.*?)<\/ul>/)![1];
    expect(link.replace(/<[^>]+>/g, "")).toBe("올해 배당 중 오래 둘 자산 몫은 25%예요");
    expect(link).not.toContain("예상");
    expect(link).toContain('data-testid="grow-link-dividend" data-pct="25%"');
    expect(link).toContain('<span class="font-semibold text-foreground">25%</span>');
    expect(link).not.toMatch(/<a |<button|[\d,]+원|1000|250/);
    expect(html.indexOf('data-testid="grow-link"')).toBeGreaterThan(html.indexOf('data-testid="grow-weight-none"'));
    expect(html.indexOf('data-testid="grow-link"')).toBeLessThan(html.indexOf('data-testid="grow-cycle"'));
  });
  it("배당: 조회 중 스켈레톤 1줄, 실패 1건 이상·분모 0·'오래 둘' 0개면 문장 없음, 분자 0이면 0%", () => {
    expect(render(SIX, keepA, true, { dividend: div({ isLoading: true }) })).toMatch(/data-testid="grow-link-skeleton" aria-hidden="true" class="flex h-5 items-center"/);
    expect(render(SIX, keepA, true, { dividend: div({ failedCount: 1 }) })).not.toContain("grow-link");
    expect(render(SIX, keepA, true, { dividend: div({ annualTotal: 0, byLabelKey: new Map() }) })).not.toContain("grow-link");
    const onlyCheck = mk({ BBB: { label: "check", labeledAt: day(40), at: day(40) } });
    expect(render(SIX, onlyCheck, true, { dividend: div() })).not.toContain("grow-link");
    expect(render(SIX, keepA, true, { dividend: div({ byLabelKey: new Map([["BBB", 1000]]) }) }).replace(/<[^>]+>/g, "")).toContain("오래 둘 자산 몫은 0%예요");
  });
  it("결산 3갈래: 같은 자리·같은 클래스, 금액 없음", () => {
    // AAA(오래 둘) 60주 × (50 − 40) = +600, BBB 50주 × (200 − 100) = +5000, 나머지 0 → 불어난 5600 중 600 = 11%
    const up = settleOf(render(SIX, keepA, true, { settle: { refs: ref(ALL), status: "ready" } }))!;
    expect([up[1], up[2], up[3]]).toEqual(["up", "11%", "0"]);
    expect(up[4].replace(/<[^>]+>/g, "")).toBe("올해 내 주식에서 불어난 돈 중 오래 둘 자산 몫은 11%예요");
    // 모두 줄어든 해: AAA −600, BBB −5000 → 줄어든 5600 중 11%
    const down = settleOf(render(SIX, keepA, true, { settle: { refs: ref({ ...ALL, AAA: 60, BBB: 300 }), status: "ready" } }))!;
    expect([down[1], down[2]]).toEqual(["down", "11%"]);
    expect(down[4].replace(/<[^>]+>/g, "")).toBe("올해 내 주식에서 줄어든 돈 중 오래 둘 자산 몫은 11%예요");
    // 섞임: AAA −600, BBB +5000
    const mixed = settleOf(render(SIX, keepA, true, { settle: { refs: ref({ ...ALL, AAA: 60 }), status: "ready" } }))!;
    expect([mixed[1], mixed[2]]).toEqual(["mixed", ""]);
    expect(mixed[4].replace(/<[^>]+>/g, "")).toBe("올해는 불어난 쪽과 줄어든 쪽이 섞여 있어 몫을 비율로 나타내지 않아요");
    expect(mixed[4]).toContain('class="text-pretty break-keep"');
    for (const m of [up, down, mixed]) expect(m[4]).not.toMatch(/[\d,]+원|5600|<a |<button/);
    // 세 문장의 요소(li) 클래스가 같다 — 클래스 없는 li, 부모 ul이 색·크기를 정한다
    for (const m of [up, down, mixed]) expect(m[0]).toMatch(/^<li data-testid="grow-link-settle" data-state="\w+" data-pct="[^"]*" data-excluded="0">/);
  });
  it("기준 가격이 없는 종목은 빼고 꼬리를 붙인다. 문장은 숨기지 않는다", () => {
    const m = settleOf(render(SIX, keepA, true, { settle: { refs: ref({ ...ALL, CCC: null, DDD: null }), status: "ready" } }))!;
    expect(m[3]).toBe("2");
    expect(m[4].replace(/<[^>]+>/g, "")).toBe("올해 내 주식에서 불어난 돈 중 오래 둘 자산 몫은 11%예요 (기준 가격이 없는 2종목 제외)");
    expect(m[4]).toContain('<span class="whitespace-nowrap">(기준 가격이 없는 2종목 제외)</span>');
  });
  it("결산: 조회 중 스켈레톤, 조회 실패·'오래 둘' 0개면 문장 없음. 배당 → 결산 순", () => {
    expect(render(SIX, keepA, true, { settle: { refs: undefined, status: "loading" } })).toContain("grow-link-skeleton");
    expect(render(SIX, keepA, true, { settle: { refs: undefined, status: "failed" } })).not.toContain("grow-link");
    const both = render(SIX, keepA, true, { dividend: div(), settle: { refs: ref(ALL), status: "ready" } });
    expect(both.indexOf("grow-link-dividend")).toBeLessThan(both.indexOf("grow-link-settle"));
    expect(both).not.toMatch(/점검할 자산 몫|정하지 않음 몫/);
  });
});

describe("블록 도움말(AC-43)", () => {
  it("블록 제목 옆 InfoHint 1개, 숨김 표식(data-screenshot-hide)", () => {
    const html = render(SIX, mk({}));
    expect(html).toMatch(/내 주식 이름표<\/span><span data-testid="grow-block-hint" data-screenshot-hide="true" class="inline-flex">/);
  });
});
