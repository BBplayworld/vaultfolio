// #246 홈 '내 종목 오늘' — 고르기(원화 등락 기여 절대값 최대)·문장·줄 상태 순수 함수 (spec 1-2 상태표 S1~S17, AC-2·3·4·6·16)
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { Stock } from "@/types/asset";
import { computeTodayChip, todayChipLabel } from "../today-chip";
import {
  buildMyStockRows, myStockAriaLabel, myStockLineState, myStockQueryKey, myStockText, myStockTickerList, pickMyStockToday,
} from "../my-stock-today";
import { PARAM_VALUES, featureTitleOf } from "@/lib/analytics/ga";
import { WHATS_NEW } from "@/config/whats-new";

const RATES = { USD: 1400, JPY: 900 };
const at = (kst: string) => new Date(`${kst}+09:00`);
// 목 19:00 KST — 국내 장 종료(11/19 종가), 미국 개장 전(11/18 종가)
const EVENING = at("2026-11-19T19:00:00");
// 목 10:00 KST — 국내 장중(`오늘`), 미국 마감(11/18 종가)
const KR_LIVE = at("2026-11-19T10:00:00");
// 목 23:40 KST — 미국 장중(`오늘`), 국내 마감(11/19 종가)
const US_LIVE = at("2026-11-19T23:40:00");
// 토 12:00 KST — 국내 11/20 종가
const SAT = at("2026-11-21T12:00:00");

let seq = 0;
type Case = { stocks: Stock[]; ref: ProfitRefResponse };
const empty = (): Case => ({ stocks: [], ref: {} });

// 국내 종목: 기준 금액 base(원)에서 r% 움직임 — 수량 1, 기여 = base × r/100(정확)
function addKr(c: Case, name: string, base: number, r: number, mode: "live" | "closed", date = "2026-11-19", prev = "2026-11-18", o: Partial<Stock> = {}) {
  const ticker = String(100000 + ++seq);
  const now = base * (1 + r / 100);
  c.stocks.push({ id: `kr${seq}`, ticker, category: "domestic", name, quantity: 1, averagePrice: base, currentPrice: now, currency: "KRW", purchaseDate: "2026-01-01", ...o } as Stock);
  c.ref[ticker] = mode === "live"
    ? { refPrice: base, refDate: prev, prevPrice: base, prevDate: "2026-11-17" }
    : { refPrice: now, refDate: date, prevPrice: base, prevDate: prev };
  return c;
}
// 미국 종목: 10주, 기준 가격 base(달러)에서 r%
function addUs(c: Case, name: string, ticker: string, base: number, r: number, mode: "live" | "closed") {
  const now = base * (1 + r / 100);
  c.stocks.push({ id: `us${++seq}`, ticker, category: "foreign", name, quantity: 10, averagePrice: base, currentPrice: now, currency: "USD", purchaseDate: "2026-01-01" } as Stock);
  c.ref[ticker] = mode === "live"
    ? { refPrice: base, refDate: "2026-11-18", prevPrice: base, prevDate: "2026-11-17" }
    : { refPrice: now, refDate: "2026-11-18", prevPrice: base, prevDate: "2026-11-17" };
  return c;
}
const line = (c: Case, now: Date) => {
  const p = pickMyStockToday(buildMyStockRows(c.stocks, c.ref, RATES, now));
  return p ? myStockText(p) : null;
};
const pick = (c: Case, now: Date) => pickMyStockToday(buildMyStockRows(c.stocks, c.ref, RATES, now));

describe("상태표 S1~S17 문장(글자 단위, AC-4)", () => {
  it("S1 오른 날: 엔비디아 700만원 +3.2%, 나머지 5행 기여 작음 → 빨강", () => {
    const c = addUs(empty(), "엔비디아", "NVDA", 500, 3.2, "closed");
    for (let i = 0; i < 5; i++) addKr(c, `작은${i}`, 1_000_000, i % 2 ? 0.5 : -0.4, "closed");
    expect(line(c, EVENING)).toBe("엔비디아 11/18 종가 +3.2% · 외 5종목");
    expect(pick(c, EVENING)!.sign).toBe("up");
  });
  it("S2 내린 날(장중): 삼성전자 1,000만원 -4.1% → ASCII 하이픈, 파랑", () => {
    const c = addKr(empty(), "삼성전자", 10_000_000, -4.1, "live");
    addKr(c, "B", 1_000_000, 1.0, "live");
    addKr(c, "C", 1_000_000, -0.5, "live");
    expect(line(c, KR_LIVE)).toBe("삼성전자 오늘 -4.1% · 외 2종목");
    expect(line(c, KR_LIVE)).toContain("-4.1%");
    expect(line(c, KR_LIVE)).not.toContain("−");
    expect(pick(c, KR_LIVE)!.sign).toBe("down");
  });
  it("S3 부호 혼합: 등락률은 B가 크지만 기여는 A", () => {
    const c = addKr(empty(), "A", 10_000_000, 2.4, "live");
    addKr(c, "B", 3_000_000, -5.0, "live");
    addKr(c, "C", 1_000_000, 0.3, "live");
    expect(line(c, KR_LIVE)).toBe("A 오늘 +2.4% · 외 2종목");
  });
  it("S3b 부호 혼합·내린 쪽", () => {
    const c = addKr(empty(), "A", 10_000_000, 0.5, "live");
    addKr(c, "B", 3_000_000, -5.0, "live");
    expect(line(c, KR_LIVE)).toBe("B 오늘 -5.0% · 외 1종목");
  });
  it("S4 기여 동률(원 단위) → 등락률 절대값 큰 쪽, 그것도 같으면 평가금 큰 쪽", () => {
    const c = addKr(empty(), "A", 10_000_000, 1.0, "live");
    addKr(c, "B", 5_000_000, -2.0, "live");
    expect(line(c, KR_LIVE)).toBe("B 오늘 -2.0% · 외 1종목");
    const d = addKr(empty(), "B", 10_000_000, -1.0, "live");
    addKr(d, "A", 10_000_000, 1.0, "live");
    expect(line(d, KR_LIVE)).toBe("A 오늘 +1.0% · 외 1종목"); // 평가금 1,010만 > 990만
  });
  it("S5 1종목: 꼬리·가운뎃점 없음", () => {
    expect(line(addKr(empty(), "삼성전자", 10_000_000, 0.8, "live"), KR_LIVE)).toBe("삼성전자 오늘 +0.8%");
  });
  it("S6 전부 0.0% → 줄 없음", () => {
    const c = addKr(empty(), "A", 10_000_000, 0.04, "live");
    addKr(c, "B", 5_000_000, -0.04, "live");
    expect(pick(c, KR_LIVE)).toBeNull();
  });
  it("S6b 기여 최대 행이 0.0%: 후보에서 빼고 N에는 센다", () => {
    const c = addKr(empty(), "주력", 20_000_000, 0.04, "live");
    addKr(c, "B", 500_000, 1.0, "live");
    expect(line(c, KR_LIVE)).toBe("B 오늘 +1.0% · 외 1종목");
  });
  it("S7 나머지가 0.0%여도 칩이 있으면 센다", () => {
    const c = addKr(empty(), "A", 10_000_000, -1.5, "live");
    addKr(c, "B", 10_000_000, 0, "live");
    expect(line(c, KR_LIVE)).toBe("A 오늘 -1.5% · 외 1종목");
  });
  it("S8 칩 없음: 비상장·일본만 / 종가쌍 조회 없음·실패 / 미국 마감 직후 → 줄 없음", () => {
    const jp: Stock = { id: "jp", ticker: "7203", category: "foreign", name: "도요타", quantity: 10, averagePrice: 1, currentPrice: 3000, currency: "JPY", purchaseDate: "2026-01-01" } as Stock;
    const un: Stock = { id: "un", ticker: "", category: "unlisted", name: "비상장", quantity: 10, averagePrice: 1, currentPrice: 3000, currency: "KRW", purchaseDate: "2026-01-01" } as Stock;
    expect(pickMyStockToday(buildMyStockRows([jp, un], {}, RATES, EVENING))).toBeNull();
    const c = addKr(empty(), "삼성전자", 10_000_000, 2.0, "closed");
    expect(pickMyStockToday(buildMyStockRows(c.stocks, undefined, RATES, EVENING))).toBeNull();
    expect(pickMyStockToday(buildMyStockRows(c.stocks, { [c.stocks[0].ticker!]: null }, RATES, EVENING))).toBeNull();
    const u = addUs(empty(), "엔비디아", "NVDA", 500, 3.2, "live");
    expect(pick(u, at("2026-11-20T06:30:00"))).toBeNull(); // ET 16:30 마감 직후 — 미국 칩 숨김
  });
  it("S11a 주력 vs 소액: 1주짜리 +20.0%가 아니라 주력 +0.4%", () => {
    const c = addKr(empty(), "삼성전자", 20_000_000, 0.4, "live");
    addKr(c, "에코프로", 100_000, 20.0, "live");
    for (let i = 0; i < 5; i++) addKr(c, `작은${i}`, 100_000, 0.1, "live");
    expect(line(c, KR_LIVE)).toBe("삼성전자 오늘 +0.4% · 외 6종목");
  });
  it("S11b 주력 미미·중간 비중 큼", () => {
    const c = addKr(empty(), "삼성전자", 20_000_000, 0.1, "live");
    addKr(c, "B", 3_000_000, -8.0, "live");
    for (let i = 0; i < 5; i++) addKr(c, `작은${i}`, 100_000, 0.1, "live");
    expect(line(c, KR_LIVE)).toBe("B 오늘 -8.0% · 외 6종목");
  });
  it("S11d·S12 국내 장중 + 미국 종가: 달러 종목은 현재 환율로 원화 환산해 견주고, 고른 종목 라벨을 붙인다", () => {
    const c = addKr(empty(), "삼성전자", 10_000_000, 0.8, "live"); // +8만
    addUs(c, "엔비디아", "NVDA", 500, 3.2, "closed"); // 16달러 × 10주 × 1400 = +22.4만
    expect(line(c, KR_LIVE)).toBe("엔비디아 11/18 종가 +3.2% · 외 1종목");
    // 환율이 낮으면(가정) 원화 기여가 줄어 삼성전자
    expect(myStockText(pickMyStockToday(buildMyStockRows(c.stocks, c.ref, { USD: 400, JPY: 900 }, KR_LIVE))!)).toBe("삼성전자 오늘 +0.8% · 외 1종목");
  });
  it("S13 미국 장중 + 국내 종가", () => {
    const c = addUs(empty(), "엔비디아", "NVDA", 500, -1.1, "live"); // -7.7만
    addKr(c, "삼성전자", 10_000_000, 2.0, "closed"); // +20만
    expect(line(c, US_LIVE)).toBe("삼성전자 11/19 종가 +2.0% · 외 1종목");
  });
  it("S14 주말: 마지막 거래일 종가", () => {
    const c = addKr(empty(), "삼성전자", 10_000_000, -1.2, "closed", "2026-11-20", "2026-11-19");
    addKr(c, "B", 1_000_000, 0.5, "closed", "2026-11-20", "2026-11-19");
    addKr(c, "C", 1_000_000, 0.3, "closed", "2026-11-20", "2026-11-19");
    expect(line(c, SAT)).toBe("삼성전자 11/20 종가 -1.2% · 외 2종목");
  });
  it("S17 데모 종목 장중: 칩 숨김 규칙 그대로 → 줄 없음, 장 종료 뒤에는 종가쌍으로 보인다", () => {
    const c = addKr(empty(), "삼성전자", 10_000_000, 1.0, "live", "2026-11-19", "2026-11-18", { id: "demo_st_1" });
    expect(pick(c, KR_LIVE)).toBeNull();
    const d = addKr(empty(), "삼성전자", 10_000_000, 1.0, "closed", "2026-11-19", "2026-11-18", { id: "demo_st_2" });
    expect(line(d, EVENING)).toBe("삼성전자 11/19 종가 +1.0%");
  });
});

describe("행 = 상세·주식 `전체` 행(AC-3)", () => {
  it("같은 티커 여러 계좌는 한 행(같은 묶음·같은 칩), 이름은 평가금 큰 계좌", () => {
    const c = addKr(empty(), "삼성전자", 10_000_000, 2.0, "live");
    const t = c.stocks[0].ticker;
    c.stocks.push({ ...c.stocks[0], id: "isa", category: "isa", name: "삼성전자(ISA)", currentPrice: c.stocks[0].currentPrice, quantity: 3 });
    addKr(c, "B", 1_000_000, 1.0, "live");
    const rows = buildMyStockRows(c.stocks, c.ref, RATES, KR_LIVE);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("삼성전자(ISA)");
    const group = c.stocks.filter((s) => s.ticker === t);
    const chip = computeTodayChip(group, c.ref, RATES, KR_LIVE)!;
    const p = pickMyStockToday(rows)!;
    expect(p.label).toBe(todayChipLabel(chip, "row"));
    expect(p.rateText).toBe(`+${chip.rate.toFixed(1)}%`);
  });
  it("줄 값 = 행 칩 값(소수 1자리), 라벨 = 행 칩 라벨 — 장중·종가 두 경우", () => {
    for (const [c, now] of [[addKr(empty(), "A", 7_654_321, -3.27, "live"), KR_LIVE], [addUs(empty(), "X", "AAPL", 231.4, 1.05, "closed"), EVENING]] as const) {
      const chip = computeTodayChip(c.stocks, c.ref, RATES, now)!;
      const p = pick(c, now)!;
      expect(p.label).toBe(todayChipLabel(chip, "row"));
      expect(p.rateText.replace("-", "")).toBe(`${p.sign === "up" ? "+" : ""}${Math.abs(chip.rate).toFixed(1)}%`);
    }
  });
});

describe("기여 금액 노출 0 (AC-16)", () => {
  it("고른 결과에 기여 금액 필드 없음, 문장·접근성 이름에 금액·순위 낱말 0", () => {
    const c = addKr(empty(), "삼성전자", 20_000_000, 0.4, "live");
    addKr(c, "에코프로", 100_000, 20.0, "live");
    const p = pick(c, KR_LIVE)!;
    expect(Object.keys(p).sort()).toEqual(["label", "more", "name", "rate", "rateText", "sign"]);
    for (const s of [myStockText(p), myStockAriaLabel(p)]) {
      expect(s).not.toMatch(/원|만|천|80000|8만|가장|1위|급등|급락|많이|확인하세요|지금|추천|기회|주의|!/);
    }
    expect(myStockAriaLabel(p)).toBe("내 종목 보기, 삼성전자 오늘 +0.4%, 외 1종목");
  });
});

describe("줄 상태(AC-2) — 입력에 팁 값 없음", () => {
  const p = { name: "A", label: "오늘", rateText: "+1.0%", sign: "up" as const, rate: 1, more: 0 };
  const base = { hasHeaderChange: true, hasTickerStock: true, fetching: false, picked: p };
  it("on", () => expect(myStockLineState(base)).toBe("on"));
  it("off 5가지: 캡처·첫 저장 당일·주식(조회 대상) 없음·칩 없음·전부 0.0%(picked null)", () => {
    expect(myStockLineState({ ...base, screenshotMode: true })).toBe("off");
    expect(myStockLineState({ ...base, hasHeaderChange: false })).toBe("off");
    expect(myStockLineState({ ...base, hasTickerStock: false })).toBe("off");
    expect(myStockLineState({ ...base, picked: null })).toBe("off");
    expect(myStockLineState({ ...base, picked: null, fetching: false })).toBe("off");
  });
  it("pending: 결과 없이 조회 진행 중일 때만", () => {
    expect(myStockLineState({ ...base, picked: null, fetching: true })).toBe("pending");
    expect(myStockLineState({ ...base, hasHeaderChange: false, picked: null, fetching: true })).toBe("off");
  });
  it("입력 키에 팁이 없다", () => {
    const src = readFileSync("src/lib/finance/my-stock-today.ts", "utf8");
    expect(src).not.toMatch(/HomeTip|home-tip|visibleTip|tipKind|tipDecided/);
  });
});

describe("조회 비용 — 상세·주식과 같은 키(AC-6·7)", () => {
  it("queryKey·티커 필터가 stock-tab useFilteredStockData와 같다", () => {
    const tab = readFileSync("src/app/(main)/_components/views/detail/tabs/stock-tab.tsx", "utf8");
    expect(tab).toContain('queryKey: ["profit", "daily", "kstAccessDay", tickerList]');
    expect(tab).toContain('(s) => s.ticker && s.category !== "unlisted" && s.currentPrice > 0 && s.inactiveStatus !== "delisted"');
    expect(myStockQueryKey("A,B")).toEqual(["profit", "daily", "kstAccessDay", "A,B"]);
    const lib = readFileSync("src/lib/finance/my-stock-today.ts", "utf8");
    expect(lib).toContain('(s) => s.ticker && s.category !== "unlisted" && s.currentPrice > 0 && s.inactiveStatus !== "delisted"');
  });
  it("티커 목록: 중복 제거·정렬, 비상장·현재가 0·상장폐지 제외", () => {
    const s = (o: Partial<Stock>) => ({ id: String(++seq), ticker: "005930", category: "domestic", name: "x", quantity: 1, averagePrice: 1, currentPrice: 1, currency: "KRW", purchaseDate: "2026-01-01", ...o }) as Stock;
    expect(myStockTickerList([s({ ticker: "NVDA", category: "foreign", currency: "USD" }), s({}), s({ category: "isa" }), s({ ticker: "000660", currentPrice: 0 }), s({ ticker: "035720", inactiveStatus: "delisted" }), s({ ticker: "X", category: "unlisted" })])).toBe("005930,NVDA");
    expect(myStockTickerList([])).toBe("");
  });
  it("홈 조회는 useQuery 1개뿐 — useFilteredStockData·취소 effect를 달지 않는다", () => {
    const dash = readFileSync("src/app/(main)/_components/views/home/dashboard.tsx", "utf8");
    expect(dash.match(/useQuery\(/g)).toHaveLength(1);
    expect(dash).not.toMatch(/useFilteredStockData|cancelThenRefetchProfit|cancelQueries/);
    expect(dash).toContain("myStockQueryKey(tickerList)");
    expect(dash).toContain('fetchProfitRef(tickerList, "daily", { signal, caller: "home:my-stock", basis: "kstAccessDay" })');
  });
  it("GA: home_my_stock → 홈·내 종목 오늘", () => {
    expect(PARAM_VALUES.category).toContain("home_my_stock");
    expect(featureTitleOf("feature_use", { category: "home_my_stock" }, "home")).toBe("홈·내 종목 오늘");
    // 송출처는 홈 대시보드 1곳, 누름 1건(노출 이벤트 0), 이동은 상세·주식 목록
    const dash = readFileSync("src/app/(main)/_components/views/home/dashboard.tsx", "utf8");
    expect(dash.match(/category: "home_my_stock"/g)).toHaveLength(1);
    expect(dash).toMatch(/category: "home_my_stock" \}\);\s*navigate\(\{ type: "detail", tab: "stocks" \}\)/);
  });
});

describe("새 소식 20261120-01 (CEO 확정 본문·ui-review 제목)", () => {
  it("제목·본문 글자 그대로, `한 줄로`는 U+00A0으로 묶음, `오늘`·순위 낱말·금액 0", () => {
    const e = WHATS_NEW.find((x) => x.id === "20261120-01")!;
    expect(e.title).toBe("순자산 아래에 내 종목 등락이 나와요");
    expect(e.body).toBe("홈에서 내 자산을 크게 움직인 내 종목을 한\u00a0줄로 보여 줘요");
    expect(e.body!.replace(/\u00a0/g, " ")).toBe("홈에서 내 자산을 크게 움직인 내 종목을 한 줄로 보여 줘요");
    for (const t of [e.title, e.body!]) expect(t).not.toMatch(/오늘|가장|1위|원\b|\d/);
  });
});
