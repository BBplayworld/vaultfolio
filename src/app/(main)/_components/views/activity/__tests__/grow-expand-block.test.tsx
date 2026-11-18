// #242 [5.127] 자산 불리기 확장 렌더 — 종류 줄·코인 보기·부동산·실물 보기·`내 선택` 결론 줄과 패널·값 구획·다음 점검 줄.
// 값 계산은 grow-pick.test.ts, 저장·호환은 stock-labels-5125-compat.test.ts
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Crypto, PhysicalAsset, RealEstate, Stock } from "@/types/asset";
import type { StockLabels, StockLabelReview } from "@/lib/asset/stock-labels";

const h = vi.hoisted(() => ({ data: {} as Record<string, unknown>, labels: null as unknown }));
vi.mock("@/contexts/asset-data-context", () => ({
  useAssetData: () => ({ assetData: h.data, exchangeRates: { USD: 1400, JPY: 9 } }),
  notifyAssetUserEdit: () => {},
}));
vi.mock("@/hooks/use-stock-labels", () => ({
  useStockLabels: () => ({ labels: h.labels, ready: true, setLabel: () => {}, record: () => {}, setPlan: () => {}, setCycle: () => {} }),
}));
vi.mock("../performance-hub", () => ({ useDividendAnnualTotals: () => ({ isLoading: false, failedCount: 0, annualAtHeldQty: 0 }) }));
vi.mock("../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: () => {} }) }));

import { ReviewSheet, StockLabelBlock } from "../stock-label-block";
import { GrowKindTabs, PickLine, PickPanel } from "../grow-pick-panel";
import { resetReportTab, setGrowView } from "../report-tab";
import { computePick, pickAfterOf, type PickInput } from "@/lib/asset/grow-pick";
import { buildBoardRows } from "@/lib/asset/grow-board";
import { buildCryptoRows, buildOwnRows } from "@/lib/asset/grow-kinds";
import { formatPriceByMode } from "@/lib/number-utils";

const NOW = Date.now();
const day = (n: number) => new Date(NOW - n * 86_400_000).toISOString();
const ago = (n: number) => new Date(NOW - n * 86_400_000 + 9 * 3_600_000).toISOString().slice(0, 10);
const st = (id: string, ticker: string, averagePrice = 100, currentPrice = 110, heldDays = 400): Stock => ({ id, category: "foreign", name: `종목 ${ticker}`, ticker, quantity: 10, averagePrice, currentPrice, currency: "USD", purchaseDate: ago(heldDays) } as Stock);
const btc = (o: Partial<Crypto> = {}): Crypto => ({ id: "c1", name: "비트코인", symbol: "BTC", quantity: 0.05, averagePrice: 120_000_000, currentPrice: 140_000_000, purchaseDate: ago(400), ...o } as Crypto);
const re = (o: Partial<RealEstate> = {}): RealEstate => ({ id: "re_1", type: "apartment", name: "우리 집", purchasePrice: 1_000_000_000, currentValue: 1_240_000_000, purchaseDate: ago(2600), ...o } as RealEstate);
const ph = (o: Partial<PhysicalAsset> = {}): PhysicalAsset => ({ id: "ph_1", type: "gold", name: "골드바 100g", purchasePrice: 8_000_000, currentValue: 11_056_000, purchaseDate: ago(1100), ...o } as PhysicalAsset);
const mk = (items: StockLabels["items"] = {}, reviews: StockLabelReview[] = [], months: 3 | 6 | 12 | null = 3): StockLabels => ({ v: 1, cycle: { months, at: months ? day(900) : "" }, items, ...(reviews.length ? { reviews } : {}) });
const it0 = (label: "keep" | "check", d: number, price?: number) => ({ label, labeledAt: day(d), at: day(d), ...(price ? { base: { qty: 1, price } } : {}) });
const render = (data: Record<string, unknown>, labels: StockLabels) => {
  resetReportTab();
  h.data = { stocks: [], crypto: [], realEstate: [], physicalAssets: [], transactions: [], cryptoTransactions: [], ...data };
  h.labels = labels;
  return renderToStaticMarkup(<StockLabelBlock />);
};
const text = (html: string) => html.replace(/<[^>]+>/g, "");
const tag = (html: string, id: string) => html.match(new RegExp(`<[a-z0-9]+[^>]*data-testid="${id}"[^>]*>`))?.[0] ?? null;
const inner = (html: string, id: string, el = "[a-z0-9]+") => { const m = html.match(new RegExp(`<(${el})[^>]*data-testid="${id}"[^>]*>([\\s\\S]*?)</\\1>`)); return m ? text(m[2]) : null; };
const attr = (t: string, name: string) => t.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null;
const kinds = (html: string) => [...html.matchAll(/<button[^>]*data-testid="grow-kind"[^>]*>([\s\S]*?)<\/button>/g)].map((m) => ({ kind: attr(m[0], "data-kind"), sel: attr(m[0], "aria-selected"), due: attr(m[0], "data-due"), text: text(m[1]) }));

// 30일 지난 정함 3번(오름 2) — 건수 문장이 나오는 주식 시드
const STOCKS = [st("a", "AAA", 100, 120), st("b", "BBB", 100, 90), st("c", "CCC", 100, 130), st("d", "DDD", 100, 100, 100)];
const COUNT = mk({ AAA: it0("keep", 90, 100), BBB: it0("keep", 90, 100), CCC: it0("check", 40, 100) });

describe("종류 줄(AC-10·19)", () => {
  it("가진 종류가 1개면 줄이 없다 — 주식만 / 코인만 / 부동산·실물만", () => {
    expect(render({ stocks: STOCKS }, mk())).not.toContain('data-testid="grow-kinds"');
    expect(render({ crypto: [btc()] }, mk())).not.toContain('data-testid="grow-kinds"');
    expect(render({ realEstate: [re()], physicalAssets: [ph()] }, mk())).not.toContain('data-testid="grow-kinds"');
    expect(render({}, mk())).toBe("");
  });
  it("순서 고정 주식 → 코인 → 부동산·실물, 갖지 않은 종류는 칸이 없고 숫자가 없다", () => {
    const html = render({ stocks: STOCKS, crypto: [btc()], realEstate: [re()] }, mk());
    expect(kinds(html).map((k) => [k.kind, k.text])).toEqual([["stock", "주식"], ["crypto", "코인"], ["real", "부동산·실물"]]);
    expect(text(html.match(/<div[^>]*data-testid="grow-kinds"[\s\S]*?<\/div>/)![0])).not.toMatch(/\d/);
    expect(kinds(render({ crypto: [btc()], physicalAssets: [ph()] }, mk())).map((k) => k.text)).toEqual(["코인", "부동산·실물"]);
  });
  it("꼬리 `점검 차례` = 선택하지 않은 칸 가운데 그 보기에 차례 행이 있는 칸(선택한 칸에는 없다). 처음 보기는 차례가 있는 첫 종류", () => {
    // 부동산만 차례(장기 보유 13개월) → 처음 보기 = 부동산·실물, 꼬리 0
    const ownDue = render({ stocks: STOCKS, crypto: [btc()], realEstate: [re()] }, mk({ "r:re_1": it0("keep", 400) }));
    expect(kinds(ownDue)).toEqual([{ kind: "stock", sel: "false", due: "false", text: "주식" }, { kind: "crypto", sel: "false", due: "false", text: "코인" }, { kind: "real", sel: "true", due: "true", text: "부동산·실물" }]);
    // 주식·부동산 둘 다 차례 → 처음 보기 = 주식(순서상 첫째), 꼬리는 부동산·실물 칸에만
    const both = render({ stocks: STOCKS, crypto: [btc()], realEstate: [re()] }, mk({ "r:re_1": it0("keep", 400), AAA: it0("keep", 400, 100) }));
    expect(kinds(both).map((k) => [k.sel, k.text])).toEqual([["true", "주식"], ["false", "코인"], ["false", "부동산·실물점검 차례"]]);
    expect(attr(tag(both, "grow-block")!, "data-view")).toBe("stock");
    // 차례가 없으면 가진 종류 중 첫째
    expect(attr(tag(render({ crypto: [btc()], realEstate: [re()] }, mk()), "grow-block")!, "data-view")).toBe("crypto");
  });
  it("화면 안에서 고른 종류는 기억하고(세션 메모리), 허브로 새로 들어오면 규칙대로", () => {
    const data = { stocks: STOCKS, crypto: [btc()], realEstate: [re()] };
    render(data, mk());
    setGrowView("own");
    h.data = { ...h.data, ...data };
    expect(attr(tag(renderToStaticMarkup(<StockLabelBlock />), "grow-block")!, "data-view")).toBe("own");
    expect(attr(tag(render(data, mk()), "grow-block")!, "data-view")).toBe("stock"); // render()는 resetReportTab부터
  });
  it("탭 역할·선택 표시(색만으로 알리지 않는다 — 꼬리는 낱말)", () => {
    const html = renderToStaticMarkup(<GrowKindTabs views={["stock", "crypto", "own"]} value="own" due={{ stock: true, crypto: true, own: true }} onChange={() => {}} />);
    expect(html).toContain('role="tablist"');
    expect(kinds(html).map((k) => k.text)).toEqual(["주식점검 차례", "코인점검 차례", "부동산·실물"]);
    expect(html.match(/role="tab"/g)).toHaveLength(3);
  });
});

describe("주식만 가진 사람(AC-1) — 5.125와 다른 곳은 `내 선택` 1행뿐", () => {
  it("정한 것 0·매수 3건 미만이면 `내 선택` 행·패널이 없고 안내는 1줄", () => {
    const html = render({ stocks: STOCKS }, mk());
    expect(html).not.toMatch(/grow-pick|내 선택|grow-kinds/);
    expect(html.match(/data-testid="grow-guide"/g)).toHaveLength(1);
    expect(inner(html, "grow-guide")).toBe("종목을 누르면 장기 보유·점검 대상을 정할 수 있어요");
    // 카드 라벨 행은 배당뿐
    expect([...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((m) => m[1])).toEqual(["배당"]);
  });
  it("처음인데 매수 3건 이상이면 매수 문장 + 안내 1줄", () => {
    const tx = [1, 2, 3].map((i) => ({ id: `t${i}`, stockId: "a", ticker: "AAA", stockName: "n", type: "buy", quantity: 1, price: i === 3 ? 500 : 50, currency: "USD", date: ago(5), reflected: true, createdAt: "" }));
    const html = render({ stocks: STOCKS, transactions: tx }, mk());
    expect(inner(html, "grow-pick")).toBe("매수 3건 중 2건은 매수가보다 오름");
    expect(attr(tag(html, "grow-pick")!, "data-state")).toBe("buy");
    expect(html.match(/data-testid="grow-guide"/g)).toHaveLength(1);
    // 위 묶음 자리 1줄 + 매수 행
    expect(inner(html, "grow-pick-empty")).toBe("30일이 지난 선택이 3번 되면 보여요");
    expect(html).not.toContain('data-testid="grow-pick-row"');
    expect(inner(html, "grow-pick-buy", "button")).toBe("이 앱에 기록한매수 3건오름 2건");
  });
});

describe("`내 선택` 결론 줄(AC-3·3b·4)", () => {
  it("넷째 라벨 행 `내 선택` — 건수 문장은 펼침 버튼, 닫힌 패널은 inert로 마운트돼 있다", () => {
    const html = render({ stocks: STOCKS }, COUNT);
    expect([...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((m) => m[1])).toEqual(["장기 보유", "점검 대상", "배당", "내 선택"]);
    const dd = tag(html, "grow-pick")!;
    expect([attr(dd, "data-state"), attr(dd, "data-n"), attr(dd, "data-up")]).toEqual(["count", "3", "2"]);
    expect(inner(html, "grow-pick")).toBe("3번 중 2번은 그때보다 오름");
    const btn = tag(html, "grow-pick-toggle")!;
    expect([attr(btn, "aria-expanded"), attr(btn, "aria-label")]).toEqual(["false", "내 선택, 3번 중 2번은 그때보다 오름, 펼치기"]);
    expect(html).toMatch(new RegExp(`<div id="${attr(btn, "aria-controls")}" inert=""[^>]*aria-hidden="true"[^>]*grid-rows-\\[0fr\\] opacity-0`));
    expect(html.match(/data-testid="grow-pick-toggle"/g)).toHaveLength(1); // 진입 1곳
  });
  it("아직 못 셈 — 글자만(muted), 화살표·버튼·패널 DOM이 없다", () => {
    const html = render({ stocks: STOCKS }, mk({ AAA: it0("keep", 90, 100), BBB: it0("keep", 5, 100) }));
    const dd = tag(html, "grow-pick")!;
    expect([attr(dd, "data-state"), attr(dd, "data-n"), attr(dd, "data-up")]).toEqual(["wait", "2", null]);
    expect(dd).toContain("text-muted-foreground");
    expect(inner(html, "grow-pick")).toBe("기록 2번 ·30일 지난 3번부터 보여요");
    expect(html).not.toMatch(/grow-pick-toggle|grow-pick-panel|grow-pick-empty/);
    // 가운뎃점 뒤에서만 줄이 바뀌는 nowrap 두 조각
    expect(html.match(/<dd[^>]*data-testid="grow-pick"[\s\S]*?<\/dd>/)![0].match(/whitespace-nowrap/g)).toHaveLength(2);
  });
  it("상태 문자열 — 0번·전부·기록 수 0. 손익색·경고색이 없고 굵은 것은 숫자뿐", () => {
    const line = (up: number[], labels = COUNT) => {
      const html = renderToStaticMarkup(<dl><PickLine pick={computePick(labels, "stock", { held: new Map([["AAA", { qty: 1, nowPrice: up[0] }], ["BBB", { qty: 1, nowPrice: up[1] }], ["CCC", { qty: 1, nowPrice: up[2] }]]), buys: [], sells: new Map() }, NOW)} open={false} panelId="p" onToggle={() => {}} /></dl>);
      return { html, bold: [...html.matchAll(/<b[^>]*>([^<]*)<\/b>/g)].map((m) => m[1]) };
    };
    expect([text(line([90, 90, 90]).html), line([90, 90, 90]).bold]).toEqual(["3번 중 그때보다 오른 것 없음", []]);
    expect([text(line([110, 110, 110]).html), line([110, 110, 110]).bold]).toEqual(["3번 모두 그때보다 오름", []]);
    expect([text(line([110, 90, 90]).html), line([110, 90, 90]).bold]).toEqual(["3번 중 1번은 그때보다 오름", ["1번"]]);
    expect(text(line([1, 1, 1], mk({ AAA: it0("keep", 90) })).html)).toBe("30일 지난 기록3번부터 보여요");
    for (const up of [[90, 90, 90], [110, 110, 110], [110, 90, 90]]) expect(line(up).html).not.toMatch(/rose|blue|red|orange|amber|important|destructive/);
  });
});

describe("`내 선택` 패널(AC-5·5b·5c·6)", () => {
  const rv = (t: string, d: number, choice: StockLabelReview["choice"], price: number, hit?: StockLabelReview["hit"]): StockLabelReview => ({ t, at: day(d), from: "check", choice, price, rate: 0, ...(hit ? { hit } : {}) });
  // 정함 4(오름 3) / 그대로 두기 5(오름 3) / 바꾸기 2(모두 오름) + 주석 3·2 + 30일 안 된 1 + 매수 12·9
  const labels = mk(
    { A: it0("keep", 300, 100), B: it0("keep", 300, 100), C: it0("check", 300, 100), D: it0("keep", 300, 100), E: it0("keep", 200), F: it0("keep", 10, 100) },
    [rv("A", 250, "same", 110, "down"), rv("A", 200, "same", 120, "up"), rv("A", 150, "same", 115), rv("B", 250, "same", 90, "cycle"), rv("B", 200, "same", 95), rv("E", 250, "check", 50, "down"), rv("E", 200, "keep", 60)],
  );
  const input: PickInput = {
    held: new Map(Object.entries({ A: 110, B: 96, C: 130, D: 110, E: 70, F: 100 }).map(([k, p]) => [k, { qty: 1, nowPrice: p }])),
    buys: Array.from({ length: 12 }, (_, i) => ({ key: "A", price: i < 9 ? 50 : 500 })),
    sells: new Map(),
  };
  const pick = computePick(labels, "stock", input, NOW);
  const html = renderToStaticMarkup(<PickPanel pick={pick} filter="same" onFilter={() => {}} />);
  const rows = [...html.matchAll(/<button[^>]*data-testid="grow-pick-row"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
  it("머리 `선택한 날 가격보다 오른 횟수`, 고정 순서 정함 → 그대로 두기 → 바꾸기(enum 키 move 유지), `옮기기`·`그중` 없음", () => {
    expect(text(html)).toMatch(/^선택한 날 가격보다 오른 횟수/);
    expect(rows.map((r) => [attr(r, "data-kind"), text(r)])).toEqual([["set", "정함4번오름 3번"], ["same", "그대로 두기5번오름 3번"], ["move", "바꾸기2번모두 오름"]]);
    expect(text(html)).not.toMatch(/옮기기|그중|내림|측정 중|아직 기록 없음|기록이 쌓이면|│/);
  });
  it("합 규칙 — 세 행 번 수 합 = 결론 줄 N, 오름 합 = M. 행마다 칸 수 = 번 수, 채운 칸 수 = 오름 수", () => {
    expect([pick.n, pick.up]).toEqual([11, 8]);
    expect(rows.reduce((s, r) => s + Number(attr(r, "data-n")), 0)).toBe(pick.n);
    expect(rows.reduce((s, r) => s + Number(attr(r, "data-up")), 0)).toBe(pick.up);
    for (const r of rows) {
      expect(r.match(/<i data-on=/g)).toHaveLength(Number(attr(r, "data-n")));
      expect(r.match(/<i data-on="true"/g) ?? []).toHaveLength(Number(attr(r, "data-up")));
    }
    expect(html.match(/data-testid="grow-pick-tally"/g)).toHaveLength(4); // 세 행 + 매수 행. 주석 줄에는 막대가 없다
    expect(html).not.toMatch(/data-testid="grow-pick-tally"[^>]*(rose|blue)/);
  });
  it("주석 줄 — 막대 없이 그대로 두기·바꾸기와 같은 세로선 안, n ≤ 두 행의 합. 늘 `오름 m번`/`오름 없음`", () => {
    const rail = html.match(/<div data-testid="grow-pick-rail"[^>]*>[\s\S]*?<\/div>/)![0];
    expect(rail).toContain("before:bg-foreground/22");
    expect([...rail.matchAll(/data-kind="(\w+)"/g)].map((m) => m[1])).toEqual(["same", "move"]);
    const hit = rail.match(/<button[^>]*data-testid="grow-pick-hit"[\s\S]*?<\/button>/)![0];
    expect(text(hit)).toBe("위 두 가지 중 내 조건에 닿아 점검 3번 ·오름 2번");
    expect(hit).not.toContain("grow-pick-tally");
    expect(Number(attr(hit, "data-n"))).toBeLessThanOrEqual(pick.rows.same.n + pick.rows.move.n);
    // 조건에 닿은 점검이 없으면 주석 줄도 세로선도 없다
    const none = renderToStaticMarkup(<PickPanel pick={{ ...pick, hit: { n: 0, up: 0, keys: [] } }} filter={null} onFilter={() => {}} />);
    expect(none).not.toMatch(/grow-pick-hit|before:bg-foreground/);
    const all = renderToStaticMarkup(<PickPanel pick={{ ...pick, hit: { n: 2, up: 2, keys: [] } }} filter={null} onFilter={() => {}} />);
    expect(inner(all, "grow-pick-hit", "button")).toBe("위 두 가지 중 내 조건에 닿아 점검 2번 ·오름 2번"); // `모두 오름`을 쓰지 않는다
  });
  it("안내 줄은 K ≥ 1일 때만, 매수 행은 구분선 아래. 0번인 행은 그리지 않는다", () => {
    expect(inner(html, "grow-pick-late")).toBe("30일이 안 된 기록 1번은 아직 넣지 않았어요");
    expect(html.indexOf("grow-pick-late")).toBeLessThan(html.indexOf("h-px bg-border"));
    expect(html.indexOf("h-px bg-border")).toBeLessThan(html.indexOf("grow-pick-buy"));
    expect(inner(html, "grow-pick-buy", "button")).toBe("이 앱에 기록한매수 12건오름 9건");
    const noLate = renderToStaticMarkup(<PickPanel pick={{ ...pick, late: 0, buys: { n: 0, up: 0, keys: [] }, rows: { ...pick.rows, move: { n: 0, up: 0, keys: [] } } }} filter={null} onFilter={() => {}} />);
    expect(noLate).not.toMatch(/grow-pick-late|grow-pick-buy|h-px bg-border|data-kind="move"/);
  });
  it("1번뿐인 행은 `오름 1번`(`모두 오름` 아님), 0번이면 `오름 없음` — 낱말은 같은 굵기", () => {
    const one = renderToStaticMarkup(<PickPanel pick={{ ...pick, rows: { set: { n: 3, up: 0, keys: [] }, same: { n: 2, up: 2, keys: [] }, move: { n: 1, up: 1, keys: [] } } }} filter={null} onFilter={() => {}} />);
    const r = [...one.matchAll(/<button[^>]*data-testid="grow-pick-row"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(r.map(text)).toEqual(["정함3번오름 없음", "그대로 두기2번모두 오름", "바꾸기1번오름 1번"]);
    expect(r.map((x) => [...x.matchAll(/<b[^>]*>([^<]*)<\/b>/g)].map((m) => m[1]))).toEqual([[], [], ["1번"]]);
  });
  it("누른 행 표시·aria-label — 두 행을 견주는 말이 없다(AC-5c)", () => {
    expect(rows.map((r) => attr(r, "aria-pressed"))).toEqual(["false", "true", "false"]);
    expect(attr(rows[0], "aria-label")).toBe("정함 4번, 오름 3번, 누르면 아래 종목을 이 기록이 있는 종목으로 걸러요");
    const labelsAll = [...html.matchAll(/aria-label="([^"]*)"/g)].map((m) => m[1]).join(" ") + text(html);
    expect(labelsAll).not.toMatch(/더 |덜 |보다 많이|차이|나았|승률|적중|성공|실패|맞혔|앞으로|그대로 뒀으면|팔지 않았다면/);
  });
  it("ⓘ 요약 줄·본문 3문단(문단마다 break-keep) — 시장 영향 1줄, 행끼리 견주는 문장 없음", () => {
    const src = readFileSync(path.resolve(__dirname, "../grow-pick-panel.tsx"), "utf8");
    expect(src).toContain('<InfoHint summary="가격이 오른 기록 수예요. 시장 전체가 오르내린 영향도 들어 있어요.">');
    const body = src.slice(src.indexOf("<InfoHint summary="), src.indexOf("</InfoHint>"));
    expect(body.match(/<p className="text-pretty break-keep">/g)).toHaveLength(3);
    for (const s of ["정하거나 점검한 날의 가격과, 그다음 점검한 날(없으면 지금)의 가격을 비교해요.", "30일이 지난 선택이 3번 되면 보여요. 가격이 같으면 오른 것으로 세지 않아요.", "이 앱에 기록한 매수는 지금 가격이 매수가보다 높은 건수예요.", "판 종목은 이 앱에 매도를 기록했을 때만 매도가까지 넣어요.", "처음 정한 종목을 나중에 바꾸면 바꾸기로 세요.", "부동산과 실물은 넣지 않아요."]) expect(body, s).toContain(s);
  });
});

describe("코인 보기(AC-10~13)", () => {
  it("주식이 없어도 블록이 열린다. 카드 = 평가손익(원 단위), 배당 행·기준 4칸 없음, 머리 `내 코인`", () => {
    const crypto = [btc(), btc({ id: "e", symbol: "ETH", name: "이더리움", quantity: 2, averagePrice: 4_000_000, currentPrice: 3_500_000, purchaseDate: ago(60) })];
    const html = render({ crypto }, mk({ "c:BTC": it0("check", 70, 132_000_000) }));
    const profit = crypto.reduce((s, c) => s + c.quantity * (c.currentPrice - c.averagePrice), 0);
    const cost = crypto.reduce((s, c) => s + c.quantity * c.averagePrice, 0);
    const total = tag(html, "grow-total")!;
    expect(Number(attr(total, "data-profit"))).toBe(Math.round(profit));
    expect(attr(total, "data-rate")).toBe(`${profit > 0 ? "+" : ""}${((profit / cost) * 100).toFixed(1)}%`);
    expect(text(html)).toContain("평단 대비 수익 · 내 코인 2종목");
    expect(html).not.toMatch(/grow-next-dividend|grow-axes|배당/);
    expect(text(html)).toContain("내 코인");
    expect(text(html)).toContain("점수 5점 만점 · 측정 중은 보유 6개월 미만");
    expect([...html.matchAll(/<dt[^>]*>([^<]*)<\/dt>/g)].map((m) => m[1])).toEqual(["장기 보유", "점검 대상", "내 선택"]);
    expect(inner(html, "grow-pick")).toBe("기록 1번 ·30일 지난 3번부터 보여요");
  });
  it("행 2줄 — `기간 · N점 · 정한 날 대비 %` / 정한 날이 없으면 칸 없음 / 6개월 미만 `측정 중`. 행 키는 c: 접두", () => {
    const html = render({ crypto: [btc(), btc({ id: "e", symbol: "ETH", name: "이더리움", quantity: 2, averagePrice: 4_000_000, currentPrice: 4_400_000, purchaseDate: ago(60) })] }, mk({ "c:BTC": it0("check", 70, 132_000_000) }));
    const rows = [...html.matchAll(/<li data-testid="grow-row"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(rows.map((r) => [attr(r, "data-key"), attr(r, "data-kind"), attr(r, "data-ticker")])).toEqual([["c:BTC", "crypto", "c:BTC"], ["c:ETH", "crypto", "c:ETH"]]);
    expect(text(rows[0])).toMatch(/^비트코인\+16\.7%1년 1개월·\d점·정한 날 대비 \+6\.1%$/);
    expect(text(rows[1])).toBe("이더리움+10.0%1개월·측정 중");
    expect(rows[1]).not.toContain("grow-row-since");
  });
  it("같은 심볼의 코인과 해외 티커는 서로 다른 행·다른 결정이다", () => {
    const data = { stocks: [st("s", "BTC", 30, 45)], crypto: [btc()] };
    const labels = mk({ BTC: it0("keep", 50, 40), "c:BTC": it0("check", 50, 130_000_000) });
    const stockView = render(data, labels);
    expect(attr(tag(stockView, "grow-row")!, "data-key")).toBe("t:BTC");
    expect(attr(tag(stockView, "grow-row")!, "data-label")).toBe("keep");
    setGrowView("crypto");
    const coinView = renderToStaticMarkup(<StockLabelBlock />);
    expect([attr(tag(coinView, "grow-row")!, "data-key"), attr(tag(coinView, "grow-row")!, "data-label")]).toEqual(["c:BTC", "check"]);
  });
  it("코인 한 장 — 주식과 같은 선택·±% 조건 폼, 바닥 줄은 코인 거래 건수 + 도착 화면 이름", () => {
    const labels: StockLabels = mk({ "c:BTC": { ...it0("check", 70, 132_000_000), plan: { down: 20 } } });
    const tx = [{ id: "x", cryptoId: "c1", symbol: "BTC", name: "비트코인", type: "buy", quantity: 0.01, price: 130_000_000, date: ago(20), reflected: true, createdAt: "" }];
    const row = buildCryptoRows([btc()], labels, NOW, tx as never)[0];
    const html = renderToStaticMarkup(<ReviewSheet row={row} labels={labels} nowMs={NOW} planOpen onPlanOpen={() => {}} onChoose={() => {}} onSavePlan={() => {}} onOpenPage={() => {}} />);
    expect([...html.matchAll(/data-testid="grow-choice-(same|keep|check|none)"/g)].map((m) => m[1])).toEqual(["same", "keep", "none"]);
    expect(html).toContain('data-testid="grow-plan-down"');
    expect(text(html)).toContain("최근 3개월 거래 1건 · 이 앱 기록매수/매도 내역");
    expect(html).not.toContain("grow-value");
  });
});

describe("부동산·실물 보기(AC-14~18)", () => {
  const data = { realEstate: [re()], physicalAssets: [ph(), ph({ id: "ph_0", name: "손목시계", purchasePrice: 0, purchaseDate: ago(860) })] };
  it("종합 카드·막대·점수·점수 안내 줄이 없다. 머리 `내 부동산·실물` / `매입가 대비`", () => {
    const html = render(data, mk({ "r:re_1": it0("keep", 400) }));
    expect(html).not.toMatch(/grow-total-card|grow-total"|grow-summary|grow-pick|grow-axes|grow-score-caption|grow-row-score|grow-next-dividend/);
    expect(text(html)).toMatch(/^내 부동산·실물/);
    expect(text(html)).toContain("매입가 대비");
    expect(text(html)).not.toMatch(/평단|점수|\d점/);
    const rows = [...html.matchAll(/<li data-testid="grow-row"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
    for (const r of rows) expect(r).not.toContain("rounded-full bg-foreground/7"); // 막대 없음
    expect(rows.map((r) => [attr(r, "data-key"), attr(r, "data-kind")])).toEqual([["r:re_1", "real"], ["p:ph_1", "physical"], ["p:ph_0", "physical"]]);
  });
  it("행 — `매입가 대비 %` + `내가 넣은 시세 기준`(실물 `평가액`). 매입가 0원 실물은 % 자리가 비고 `—`·`0%`가 없다", () => {
    const html = render(data, mk({ "r:re_1": it0("keep", 400) }));
    const rows = [...html.matchAll(/<li data-testid="grow-row"[^>]*>[\s\S]*?<\/button>/g)].map((m) => text(m[0]));
    expect(rows[0]).toMatch(/^우리 집\+24\.0%7년 \d+개월·내가 넣은 시세 기준점검 차례$/);
    expect(rows[1]).toMatch(/^골드바 100g\+38\.2%3년(?: \d+개월)?·내가 넣은 평가액 기준$/);
    expect(rows[2]).toMatch(/^손목시계2년 \d+개월·매입가를 넣으면 보여요$/);
    expect(html).not.toMatch(/>—<|>0%<|>0\.0%</);
    expect(html).toMatch(/data-testid="grow-row-rate" data-rate=""[^>]*><\/span>/);
  });
  it("처음 쓰는 사람 — 안내 1줄 `눌러서 …`(종목이라는 낱말 없음), 묶음 머리 `정하지 않음 3 · 눌러서 정해요`", () => {
    const html = render(data, mk());
    expect(html.match(/data-testid="grow-guide"/g)).toHaveLength(1);
    expect(inner(html, "grow-guide")).toBe("눌러서 장기 보유·점검 대상을 정할 수 있어요");
    expect(text(html)).toContain("정하지 않음3 · 눌러서 정해요");
  });
  const sheet = (labels: StockLabels, key: string, o: { planOpen?: boolean; reList?: RealEstate[] } = {}) => {
    const row = buildOwnRows(o.reList ?? data.realEstate, data.physicalAssets, labels, NOW).find((r) => r.key === key)!;
    return renderToStaticMarkup(<ReviewSheet row={row} labels={labels} nowMs={NOW} planOpen={!!o.planOpen} onPlanOpen={() => {}} onChoose={() => {}} onSavePlan={() => {}} onOpenPage={() => {}} afterOf={() => ({ kind: "now", pct: 9.9 })} onEditValue={() => {}} />);
  };
  it("한 장 순서 — 이유 줄 → 값 구획 → 선택 버튼 → 다음 점검 줄 → 이력. 장기 보유에는 다시 볼 조건이 없고 바닥 링크도 없다", () => {
    const labels = mk({ "r:re_1": it0("keep", 400) }, [{ t: "r:re_1", at: day(500), from: "keep", choice: "same", price: 1_200_000_000, rate: 20 }]);
    const html = sheet(labels, "r:re_1");
    const order = ["grow-sheet-reason", "grow-value", "grow-choice-same", "grow-choice-next", "grow-history"].map((id) => html.indexOf(`data-testid="${id}"`));
    expect(order.every((v) => v > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(inner(html, "grow-sheet-reason")).toBe("점검 차례 · 장기 보유로 정한 지 12개월이 지났어요");
    expect(html).not.toMatch(/grow-plan-summary|grow-plan-form|grow-row-open|최근 3개월 거래|종목 페이지/);
    // 값 수정 진입은 1개
    expect(html.match(/data-testid="grow-value-edit"/g)).toHaveLength(1);
    expect(inner(html, "grow-value-edit", "button")).toBe("시세 고치기 ");
    expect(inner(html, "grow-value-mine")).toBe(formatPriceByMode(1_240_000_000)); // 상세 카드와 같은 포맷 함수
    expect(text(html)).toContain("내가 넣은 시세");
    // 이력 — 날짜·선택만(오른쪽 값 없음: 가격이 시세가 아니다)
    expect(inner(html, "grow-history-row", "p")).toMatch(/^\d{1,2}월 \d{1,2}일그대로 두기$/);
    expect(html).not.toContain("grow-history-after");
  });
  it("다음 점검 줄 — 버튼 밖 아래 1줄, 날짜 = 오늘 + 12개월(장기 보유, 연도가 붙는다). 버튼 안에는 날짜가 없고 세 버튼이 같은 꼴", () => {
    const html = sheet(mk({ "r:re_1": it0("keep", 400) }), "r:re_1");
    const next = new Date(NOW + 9 * 3_600_000);
    const want = `${next.getUTCFullYear() + 1}년 ${next.getUTCMonth() + 1}월`;
    expect(inner(html, "grow-choice-next", "p")).toMatch(new RegExp(`^그대로 두면 다음 점검은${want} \\d{1,2}일$`));
    const buttons = [...html.matchAll(/<button[^>]*data-testid="grow-choice-[a-z]+"[^>]*>[\s\S]*?<\/button>/g)].map((m) => m[0]);
    expect(buttons.map(text)).toEqual(["그대로 두기", "점검 대상으로", "정하지 않음"]);
    for (const b of buttons) { expect(b).toContain("min-h-11"); expect(b).not.toContain("flex-col"); expect(b).not.toMatch(/\d{1,2}월/); }
    expect(buttons[0]).toContain(`aria-describedby="${attr(tag(html, "grow-choice-next")!, "id")}"`);
    // nowrap 두 조각(문장 | 날짜)
    expect(html.match(/<p[^>]*data-testid="grow-choice-next"[\s\S]*?<\/p>/)![0].match(/whitespace-nowrap/g)).toHaveLength(2);
  });
  it("점검 대상 — 다시 볼 조건은 기간·메모만(±% 칸 없음). 정한 기간 6개월이면 이유 줄·다음 점검 날짜가 6개월", () => {
    const labels: StockLabels = mk({ "p:ph_1": { ...it0("check", 200), plan: { months: 6, memo: "보험 갱신 전 다시 보기" } } });
    const closed = sheet(labels, "p:ph_1");
    expect(inner(closed, "grow-sheet-reason")).toBe("점검 차례 · 정한 기간 6개월이 지났어요");
    expect(inner(closed, "grow-plan-summary", "button")).toBe("다시 볼 조건6개월 · 메모");
    const six = new Date(Date.UTC(new Date(NOW + 9 * 3_600_000).getUTCFullYear(), new Date(NOW + 9 * 3_600_000).getUTCMonth() + 6, 1));
    expect(inner(closed, "grow-choice-next", "p")).toContain(`${six.getUTCMonth() + 1}월`);
    expect(text(closed)).toContain("내가 넣은 평가액");
    expect(inner(closed, "grow-value-edit", "button")).toBe("평가액 고치기 ");
    const open = sheet(labels, "p:ph_1", { planOpen: true });
    expect(open).toContain('data-testid="grow-plan-months"');
    expect(open).toContain('data-testid="grow-plan-memo"');
    expect(open).not.toMatch(/grow-plan-down|grow-plan-up|평단 대비|% 이하|% 이상/);
    expect(closed.indexOf("grow-choice-next")).toBeLessThan(closed.indexOf("grow-plan-summary"));
  });
  it("실거래 추정 줄 — 추정가가 저장된 부동산에만 1줄(금액·날짜는 상세 카드와 같은 값). 없는 부동산·실물에는 줄이 없다", () => {
    const labels = mk();
    const withEst = sheet(labels, "r:re_1", { reList: [re({ marketEstimate: 1_180_000_000, marketEstimateDate: "2026-09-14" })] });
    expect(inner(withEst, "grow-value-estimate", "p")).toBe(`실거래 추정 ${formatPriceByMode(1_180_000_000)} ·2026-09-14 기준`);
    expect(withEst.match(/data-testid="grow-value-estimate"/g)).toHaveLength(1);
    expect(sheet(labels, "r:re_1")).not.toContain("grow-value-estimate");
    expect(sheet(labels, "p:ph_1")).not.toContain("grow-value-estimate");
    // 두 값의 차이·비율·방향 낱말 없음
    expect(text(withEst)).not.toMatch(/차이|높|낮|%p|대비 [+-]/);
  });
});

describe("주식 한 장 이력 줄(AC-9) — `지금까지`·`다음 점검까지`, `그때 수익률` 없음", () => {
  it("최신 줄 `지금까지 ±x%`, 그 앞 줄 `다음 점검까지 ±x%` — `내 선택`과 같은 계산의 결과", () => {
    const labels = mk({ AAA: it0("check", 300, 100) }, [
      { t: "AAA", at: day(100), from: "check", choice: "same", price: 110, rate: 10 },
      { t: "AAA", at: day(200), from: "check", choice: "same", price: 90, rate: -10, hit: "down" },
    ]);
    const stocks = [st("a", "AAA", 100, 120)];
    const row = buildBoardRows(stocks, { USD: 1400, JPY: 9 }, labels, NOW)[0];
    const pick = computePick(labels, "stock", { held: new Map([["AAA", { qty: 10, nowPrice: 120 }]]), buys: [], sells: new Map() }, NOW);
    const html = renderToStaticMarkup(<ReviewSheet row={row} labels={labels} nowMs={NOW} planOpen={false} onPlanOpen={() => {}} onChoose={() => {}} onSavePlan={() => {}} onOpenPage={() => {}} afterOf={(r) => pickAfterOf(pick, r.t, r.at)} />);
    const lines = [...html.matchAll(/<p data-testid="grow-history-row"[\s\S]*?<\/p>/g)].map((m) => m[0]);
    expect(lines.map(text)).toEqual([expect.stringMatching(/그대로 두기지금까지 \+9\.1%$/), expect.stringMatching(/그대로 두기다음 점검까지 \+22\.2%$/)]);
    expect(lines.map((l) => attr(tag(l, "grow-history-after")!, "data-kind"))).toEqual(["now", "next"]);
    expect(text(html)).not.toContain("그때 수익률");
  });
});

describe("금지어·전송(AC-9·22)", () => {
  const files = ["../grow-pick-panel.tsx", "../stock-label-block.tsx", "../../../../../../lib/asset/grow-pick.ts", "../../../../../../lib/asset/grow-kinds.ts"].map((f) => readFileSync(path.resolve(__dirname, f), "utf8"));
  const visible = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
  it("화면 문자열에 금지어 0 — 승률·적중·성공·실패·맞혔·앞으로·그대로 뒀으면·팔지 않았다면·내림·추천·권유형", () => {
    for (const src of files) {
      for (const w of ["승률", "적중", "성공", "실패", "맞혔", "앞으로", "그대로 뒀으면", "팔지 않았다면", "내림", "추천", "유망", "사세요", "파세요", "목표가", "익절", "손절", "경고"]) expect(visible(src), w).not.toContain(w);
    }
  });
  it("`·내 선택` 전송은 값 있는 패널을 여는 한 곳(preview 가드 뒤, 로드당 1회 ref) — 새 파일은 GA·저장소·네트워크를 직접 쓰지 않는다", () => {
    const [panel, block, pickLib, kindsLib] = files;
    for (const src of [panel, pickLib, kindsLib]) expect(src).not.toMatch(/track\(|localStorage|sessionStorage|fetch\(|navigator\.sendBeacon/);
    expect(block).not.toMatch(/localStorage|sessionStorage|fetch\(/);
    const open = block.slice(block.indexOf("const onPickOpen"), block.indexOf("const onPickOpen") + 260);
    expect(open).toContain("if (pickSent.current) return;");
    expect(open).toContain('if (!isPreviewEnv()) track("feature_use", { category: "grow_pick" });');
    // 패널이 있는 상태(count·buy)에서만 토글이 있다 → wait에서는 어떤 조작으로도 나가지 않는다
    expect(panel.slice(panel.indexOf('if (pick.state === "wait")'), panel.indexOf("const n = pick.state"))).not.toContain("<button");
    expect(block).toContain('const pickHasPanel = showPick && pick.state !== "wait";');
  });
});

describe("세그먼트·허브(AC-19·20) — 칸 이름 `내 자산 점검`, 수는 같은 함수의 전 종류 합", () => {
  const view = readFileSync(path.resolve(__dirname, "../asset-report-view.tsx"), "utf8");
  const hub = readFileSync(path.resolve(__dirname, "../performance-hub.tsx"), "utf8");
  it("칸 이름·도움말·허브 설명이 같은 낱말이고 옛 이름 `종목 점검`이 화면 문자열에 없다", () => {
    expect(view).toContain('{ value: "grow" as const, title: "내 자산 점검", sub: growSub }');
    expect(view).toContain("내 자산 점검에서는 장기 보유·점검 대상과 다시 볼 조건을 내가 정하고");
    expect(hub).toContain('description="성적표와 내 자산 점검을 한곳에서"');
    for (const src of [view, hub]) expect(src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\s\/\/ .*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "")).not.toContain("종목 점검");
  });
  it("세그먼트 수 = 허브 수 — 둘 다 growStatus(buildGrowBoards(...)), 단위도 같은 값(unit)", () => {
    expect(view).toContain("growStatusOf(buildGrowBoards(assetData, exchangeRates, growStore.labels, growNow))");
    expect(hub).toContain("growStatus(buildGrowBoards(assetData, exchangeRates, labels, growNow))");
    expect(view).toContain("{growStatus.due}{growStatus.unit}");
    expect(hub).toContain("{grow.due}{grow.unit}");
    expect(view).toContain("`${growStatus.count}${growStatus.unit} · 정하기 전`");
  });
  it("둘째 줄 `장기 보유 N · 점검 대상 N`은 nowrap 두 조각 — 320에서 가운뎃점 뒤에서만 줄이 바뀐다", () => {
    expect(view).toContain('<span className="whitespace-nowrap">장기 보유 {growStatus.keep} ·</span><span className="whitespace-nowrap">점검 대상 {growStatus.check}</span>');
  });
});
