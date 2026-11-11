// #132 U4 시장과 비교 화면 상태(ui.md 3절) — 정적 렌더로 칸 표기·색·문구 확인
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import { classifyHoldings, computeMarketCompare, summarizeCompare, type PeriodRefs } from "@/lib/finance/market-compare";
import { CompareNotice, MarketBlock, MarketList } from "../market-compare-view";

let seq = 0;
const stock = (o: Partial<Stock>): Stock => ({
  id: `s${++seq}`, category: "domestic", name: "종목", ticker: "005930", quantity: 10,
  averagePrice: 100, currentPrice: 100, currency: "KRW", purchaseDate: "2026-11-10", ...o,
} as Stock);
const PEERS = new Set(["005930", "000660"]);
const d = (prev: number, ref: number, prevDate = "2026-11-06", refDate = "2026-11-09") => ({ refPrice: ref, refDate, prevPrice: prev, prevDate });

const STOCKS = [
  stock({ name: "삼성전자", ticker: "005930", quantity: 10 }),
  stock({ name: "SK하이닉스", ticker: "000660", quantity: 1 }),
  stock({ name: "애플", ticker: "AAPL", category: "foreign", currency: "USD", quantity: 3 }),
  stock({ name: "TIGER 미국S&P500", ticker: "360750", category: "isa" }),
  stock({ name: "비상장", ticker: undefined, category: "unlisted" }),
];
const REFS: PeriodRefs = {
  daily: { "005930": d(100, 102), "000660": d(100, 96), AAPL: d(200, 202), "360750": d(100, 101) } as ProfitRefResponse,
  weekly: { "005930": { refPrice: 98, refDate: "2026-11-03" }, "000660": { refPrice: 100, refDate: "2026-11-03" }, AAPL: { refPrice: 200, refDate: "2026-11-03" }, "360750": { refPrice: 100, refDate: "2026-11-03" } },
  monthly: { "005930": { refPrice: 90, refDate: "2026-10-08" }, "000660": { refPrice: 90, refDate: "2026-10-08" }, AAPL: { refPrice: 210, refDate: "2026-10-09" }, "360750": { refPrice: 100, refDate: "2026-10-08" } },
  ytd: { "005930": { refPrice: 80, refDate: "2025-12-30" }, "000660": { refPrice: 120, refDate: "2025-12-30" }, AAPL: { refPrice: 180, refDate: "2025-12-31" }, "360750": { refPrice: 100, refDate: "2025-12-30" } },
};
const IDX: PeriodRefs<MarketIndexResponse> = {
  daily: { KOSPI: d(100, 101), SPX: d(100, 100.4) },
  weekly: { KOSPI: { refPrice: 99, refDate: "2026-11-03" }, SPX: { refPrice: 100, refDate: "2026-11-03" } },
  monthly: { KOSPI: { refPrice: 98, refDate: "2026-10-08" }, SPX: { refPrice: 99, refDate: "2026-10-09" } },
  ytd: { KOSPI: { refPrice: 85, refDate: "2025-12-30" }, SPX: { refPrice: 95, refDate: "2025-12-31" } },
};
const classified = classifyHoldings(STOCKS, PEERS);
// 보이지 않는 문자(U+2060 단어 결합자)는 지우고 U+00A0은 공백으로 본 뒤 비교(cto 판정 2 ①-5)
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\u2060/g, "").replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim();
// spec 5-5 금지어(금액 숫자는 원·$ 표기로 검사). `올해`는 기간 이름(행 라벨·기간 선택·pending 문구)으로만 해제, `1년`은 비교 기준 자세히 1줄에만(#150)
const FORBIDDEN = ["수익", "성과", "이겼", "졌다", "앞섰", "뒤처", "나았", "못했다", "선방", "초과", "알파", "우수", "부진", "순위", "등급", "축하", "아쉬워", "사세요", "파세요", "줄이세요", "늘리세요", "추천", "1년", "모든 종목", "내 주식 전체", "원", "$"];

describe("MarketBlock — 4기간 표(행=기간)", () => {
  const blocks = computeMarketCompare(classified, REFS, IDX);
  const summary = summarizeCompare(classified, blocks)!;

  it("F1형 기본: 머리 문장·열 머리 구간·보유/시장/차이, 차이 = 보이는 두 값의 차·전경색", () => {
    const html = renderToStaticMarkup(<MarketBlock market="kr" block={blocks[0]} count={summary.blockCounts.kr} />);
    const t = text(html);
    expect(t).toContain("코스피와 비교한 국내 주식 2종목");
    // 전치: 열 머리 보유 종목·코스피·차이, 행 = 하루·1주·1개월·올해(구간은 행 머리 아래)
    expect(t).toContain("보유 종목 코스피 차이");
    expect(html.match(/data-period="(daily|weekly|monthly|ytd)"/g)).toEqual(['data-period="daily"', 'data-period="weekly"', 'data-period="monthly"', 'data-period="ytd"']);
    expect(t).toContain("하루 11/6→ 11/9");
    expect(t).toContain("1주 11/3→ 11/9");
    expect(t).toContain("올해 25.12.30→ 26.11.9");
    // 하루 보유 = (10×102+1×96)/(10×100+1×100)−1 = +1.5%, 코스피 +1.0% → 같은 행에서 +1.5% +1.0% +0.5%p
    expect(t).toMatch(/하루 11\/6→ 11\/9 \+1\.5% \+1\.0% \+0\.5%p/);
    // 올해 보유 = (10×102+1×96)/(10×80+1×120)−1 = +21.3%, 코스피 101/85 = +18.8% → 차이 +2.5%p
    expect(t).toMatch(/올해 25\.12\.30→ 26\.11\.9 \+21\.3% \+18\.8% \+2\.5%p/);
    // 399px 이하: 보유 값 14px·차이 12px — 최악값 `+123.4%`·`-123.4%p`가 열(≈64px) 안에 들어가게(ui-review)
    expect(html).toContain("max-[399px]:text-sm");
    expect(html).toContain("max-[399px]:text-xs");
    expect(html).toMatch(/text-sm font-semibold text-foreground tabular-nums max-\[399px\]:text-xs">\+0\.5%p/);
    expect(html).toContain('role="table"');
    expect(html).toContain('aria-label="코스피와 비교한 국내 주식 2종목"');
  });

  it("미국 블록 머리에 (달러)", () => {
    const t = text(renderToStaticMarkup(<MarketBlock market="us" block={blocks[1]} count={summary.blockCounts.us} />));
    expect(t).toContain("S&amp;P 500과 비교한 미국 주식 1종목 (달러)");
  });

  it("불러오는 중: 머리·숫자 없이 스켈레톤 + 머리 줄 자리(market-loading-slot, 완료 후 머리 줄과 같은 높이)", () => {
    const loading = computeMarketCompare(classified, { daily: REFS.daily }, IDX);
    const html = renderToStaticMarkup(<MarketBlock market="kr" block={loading[0]} count={undefined} />);
    expect(html).toContain("market-loading");
    expect(html).not.toMatch(/%/);
    expect(html).not.toContain("2종목");
  });

  it("지수 실패: 시장·차이 —, 안내 1줄, %p 없음", () => {
    const failed = computeMarketCompare(classified, REFS, { daily: { KOSPI: null, SPX: null }, weekly: { KOSPI: null, SPX: null }, monthly: { KOSPI: null, SPX: null }, ytd: { KOSPI: null, SPX: null } });
    const t = text(renderToStaticMarkup(<MarketBlock market="kr" block={failed[0]} count={2} />));
    expect(t).toContain("시장 값을 불러오지 못했어요");
    expect(t).not.toContain("%p");
    expect(t).toMatch(/하루 11\/6→ 11\/9 \+1\.5% —/);
  });

  it("기준일 어긋남: 그 열만 시장·차이 —, 0.0%p 없음", () => {
    const mis = computeMarketCompare(classified, REFS, { ...IDX, weekly: { KOSPI: { refPrice: 99, refDate: "2026-11-02" }, SPX: IDX.weekly!.SPX } });
    const t = text(renderToStaticMarkup(<MarketBlock market="kr" block={mis[0]} count={2} />));
    expect(t).toContain("— 기준일이 달라 비교하지 않았어요");
    expect(t).not.toContain("0.0%p");
    expect((t.match(/%p/g) ?? []).length).toBe(3);
  });

  it("올해 연초 휴장(끝 종가일이 작년): 올해 행 집계 전·값 칸 —·안내 1줄, 0.0% 없음, 다른 행 불변(Y3)", () => {
    const jan = (p: string) => ({ refPrice: 100, refDate: p });
    const pend = computeMarketCompare(classified, { ...REFS, daily: { "005930": d(100, 101, "2025-12-29", "2025-12-30"), "000660": d(100, 101, "2025-12-29", "2025-12-30"), AAPL: d(200, 202), "360750": d(100, 101) } as ProfitRefResponse, ytd: { "005930": jan("2025-12-30"), "000660": jan("2025-12-30"), AAPL: jan("2025-12-31"), "360750": jan("2025-12-30") } }, { ...IDX, daily: { ...IDX.daily!, KOSPI: d(100, 101, "2025-12-29", "2025-12-30") }, ytd: { KOSPI: jan("2025-12-30"), SPX: jan("2025-12-31") } });
    expect(pend[0].periods.ytd.state).toBe("pending");
    const html = renderToStaticMarkup(<MarketBlock market="kr" block={pend[0]} count={2} />);
    const t = text(html);
    expect(t).toContain("올해 집계 전 — — —");
    expect(t).toContain("— 올해 첫 종가가 나오면 보여드려요");
    expect(html).toContain('data-testid="market-ytd-pending"');
    expect(t.slice(t.indexOf("올해 집계 전"))).not.toContain("%");
    const list = text(renderToStaticMarkup(<MarketList blocks={[pend[0]]} classified={{ ...classified, notCompared: [] }} period="ytd" stockRefs={REFS} />));
    expect(list).toBe("국내 집계 전 삼성전자 — SK하이닉스 —");
  });

  it("올해 상장(시작 종가 없음): 올해 칸만 제외·기준가 없음, 다른 기간 값 불변(Y4)", () => {
    const noYtd = computeMarketCompare(classified, { ...REFS, ytd: { ...REFS.ytd!, "000660": null } }, IDX);
    expect(noYtd[0].periods.ytd.excluded).toEqual([{ ticker: "000660", name: "SK하이닉스", reason: "noRef" }]);
    expect(noYtd[0].periods.daily.excluded).toEqual([]);
    expect(noYtd[0].periods.daily.holdingsRate).toBe(blocks[0].periods.daily.holdingsRate);
    const sum = summarizeCompare(classified, noYtd)!;
    expect(sum.excluded.reasons).toContainEqual({ label: "올해 기준가 없음", count: 1 });
  });

  it("하루 휴장: 행 구간 휴장·세 칸 —, 0.0% 없음", () => {
    const hol = computeMarketCompare(classified, { ...REFS, daily: { ...REFS.daily, "005930": d(100, 100, "2026-11-06", "2026-11-06"), "000660": d(100, 100, "2026-11-06", "2026-11-06") } }, { ...IDX, daily: { ...IDX.daily!, KOSPI: d(100, 100, "2026-11-06", "2026-11-06") } });
    const html = renderToStaticMarkup(<MarketBlock market="kr" block={hol[0]} count={2} />);
    expect(text(html)).toContain("하루 휴장");
    expect(text(html)).toMatch(/하루 휴장 — — —/);
    expect(text(html)).not.toContain("0.0%");
  });
});

describe("CompareNotice·MarketList", () => {
  const blocks = computeMarketCompare(classified, REFS, IDX);
  const summary = summarizeCompare(classified, blocks)!;

  it("비교하지 않은 종목 N + 이유, 제외 N + 사유별", () => {
    const t = text(renderToStaticMarkup(<CompareNotice summary={summary} />));
    expect(t).toContain("비교하지 않은 종목 1 · 해외 자산·채권·금리형 ETF는 코스피와 비교하지 않아요");
    expect(t).toContain("제외 1 · 비상장·티커 없음 1");
  });

  it("이유가 2개면 줄마다 나눈다(첫 줄은 개수만), 줄바꿈 방지 문자는 상수에", () => {
    const c2 = classifyHoldings([...STOCKS, stock({ name: "토요타", ticker: "7203", category: "foreign", currency: "JPY" })], PEERS);
    const s2 = summarizeCompare(c2, computeMarketCompare(c2, REFS, IDX))!;
    const html = renderToStaticMarkup(<CompareNotice summary={s2} />);
    expect(text(html)).toContain("비교하지 않은 종목 2 해외 자산·채권·금리형 ETF는 코스피와 비교하지 않아요 미국 밖 해외 종목은 S&amp;P 500과 비교하지 않아요");
    expect(html.match(/<span class="block">/g)).toHaveLength(2);
    expect(html).not.toMatch(/비교하지 않은 종목 2<\/span> · /);
    expect(html).toContain("자산\u2060·\u2060채권\u2060·\u2060금리형");
    expect(html).toContain("S&amp;P\u00A0500과");
    // 이유 1개: 360 이상은 ` · ` 한 문단 그대로, 320(359px 이하)은 개수 / 이유 줄로 나눔(D3)
    const one = renderToStaticMarkup(<CompareNotice summary={summary} />);
    expect(one).not.toContain('class="block"');
    expect(one).toContain('<span class="max-[359px]:hidden"> · </span><span class="max-[359px]:block">해외 자산');
  });

  it("목록: 등락률 높은 순 안에 시장 줄, 묶음 머리 같은 표기, 비교하지 않은 종목 묶음엔 시장 줄 없음", () => {
    const html = renderToStaticMarkup(<MarketList blocks={blocks} classified={classified} period="weekly" stockRefs={REFS} />);
    const t = text(html);
    // 1주: 삼성 102/98=+4.1%, 코스피 101/99=+2.0%, 하이닉스 96/100=−4.0%
    expect(t).toMatch(/국내 11\/3→11\/9 삼성전자 \+4\.1% 코스피 \+2\.0% SK하이닉스 -4\.0%/);
    expect(t).toContain("미국 (달러)");
    expect((html.match(/market-list-index/g) ?? []).length).toBe(2);
    expect(t).toMatch(/비교하지 않은 종목 TIGER 미국S&amp;P500 \+1\.0%/);
  });

  it("종목 줄 탭 진입(#157): stockLink가 있으면 매칭 종목 줄만 버튼(≥44px), 지수 줄·비매칭 줄은 그대로, 표시 값은 같다", () => {
    const plain = renderToStaticMarkup(<MarketList blocks={blocks} classified={classified} period="weekly" stockRefs={REFS} />);
    const linked = renderToStaticMarkup(
      <MarketList blocks={blocks} classified={classified} period="weekly" stockRefs={REFS} stockLink={{ has: (t) => t === "005930", open: () => {} }} />,
    );
    expect((linked.match(/<button/g) ?? []).length).toBe(1);
    expect(linked).toContain("min-h-11");
    expect(text(linked)).toBe(text(plain));
    expect(linked.match(/data-testid="market-list-index"/g)).toHaveLength(2);
    expect(plain).not.toContain("<button");
  });

  it("올해 목록: 묶음 머리 구간 `25.12.30→26.11.9`(공백 없음), 올해 시장 줄 포함", () => {
    const t = text(renderToStaticMarkup(<MarketList blocks={blocks} classified={classified} period="ytd" stockRefs={REFS} />));
    expect(t).toContain("국내 25.12.30→26.11.9");
    expect(t).toMatch(/국내 25\.12\.30→26\.11\.9 삼성전자 \+27\.5% 코스피 \+18\.8% SK하이닉스 -20\.0%/);
  });

  it("하루 휴장 목록: 묶음 머리 휴장·종목 —·시장 줄 없음·평가금 순", () => {
    const hol = computeMarketCompare(classified, { ...REFS, daily: { ...REFS.daily, "005930": d(100, 100, "2026-11-06", "2026-11-06"), "000660": d(100, 100, "2026-11-06", "2026-11-06") } }, IDX);
    const t = text(renderToStaticMarkup(<MarketList blocks={[hol[0]]} classified={{ ...classified, notCompared: [] }} period="daily" stockRefs={REFS} />));
    expect(t).toBe("국내 휴장 삼성전자 — SK하이닉스 —");
  });

  it("화면 텍스트에 금지어·금액 0(A10)", () => {
    const all = [
      renderToStaticMarkup(<MarketBlock market="kr" block={blocks[0]} count={2} />),
      renderToStaticMarkup(<MarketBlock market="us" block={blocks[1]} count={1} />),
      renderToStaticMarkup(<CompareNotice summary={summary} />),
      renderToStaticMarkup(<MarketList blocks={blocks} classified={classified} period="monthly" stockRefs={REFS} />),
    ].map(text).join(" ");
    for (const w of FORBIDDEN) expect(all, w).not.toContain(w);
  });
});

describe("페이지 고정 문구", () => {
  it("정의·(i)·접기 문구에 금지어 0(주석 제외 소스 검사)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("../market-compare-view.tsx", import.meta.url), "utf8")
      .split("\n").filter((l) => !l.trim().startsWith("//")).join("\n").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
    const korean = (src.match(/[가-힣][^"`<>{}\n]*/g) ?? []).join(" ");
    expect(korean).toContain("지금 보유한 종목을 그대로 들고 있었다고 보고 계산한 가격 등락이에요");
    // `1년`은 비교 기준 자세히 1줄에만(Y8)
    expect(korean.match(/1년/g)).toHaveLength(1);
    expect(korean).toContain("자산 변화의 연은 최근 1년 기준이라 올해 값과 달라요.");
    for (const w of FORBIDDEN.filter((x) => x !== "원" && x !== "$" && x !== "1년")) expect(korean, w).not.toContain(w);
  });
});
