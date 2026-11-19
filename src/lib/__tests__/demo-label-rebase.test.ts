// #239 5.125 — 데모·체험 이름표의 '정한 날 가격 대비 %'가 실시간 시세로 덮여도 현실적인 범위(−15%~+30%)에 있는지.
// 데모 시드의 정한 날 가격은 JSON 시세 눈금이라, 시세만 실시간으로 바뀌면 +500%처럼 보였다(대표 preview 확인 경로).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { materializeDemo } from "../preview/demo-payload";
import { demoCostShifts, demoSeedStockMap, pickRebaseRef, priceByLabelKey, rebaseDemoAveragePrices, rebaseDemoLabelPrices, rebaseDemoRows, rebaseRatio, withAveragePrices, withCryptoAveragePrices, priceByAnyLabelKey } from "../preview/demo-live-rebase";
import { buildLiveAttributionCurr, computeAttributionSince, computePeriodAttribution } from "../report/asset-report";
import { resolveSettlementWindow } from "../report/settlement";
import { computeSettlementCauses, settlementDelta } from "@/app/(main)/_components/views/activity/change-hero";
import { buildYearSettlementModel } from "@/app/(main)/_components/views/activity/year-settlement-block";
import { computeStockMetrics } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { computeAssetCost, computeNetAsset } from "@/contexts/asset-data-context";
import type { AssetData, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { parseStockLabels, setStockLabel, type StockLabels } from "../asset/stock-labels";
import { buildGrowRows } from "../asset/grow-rows";
import { buildCryptoRows, buildGrowBoards, growStatus } from "../asset/grow-kinds";
import { assetDataSchema } from "@/types/asset";
import type { Stock } from "@/types/asset";

const raw = JSON.parse(readFileSync(path.resolve(__dirname, "../preview/demo-data.json"), "utf8"));
const RATES = { USD: 1400, JPY: 925 };
const load = (today: string) => {
  const p = materializeDemo(raw, today) as { assetData: unknown; stockLabels: unknown };
  return { stocks: assetDataSchema.parse(p.assetData).stocks, labels: parseStockLabels(p.stockLabels)! };
};
/** 종목별 배율로 시세를 옮긴 보유 목록(실시간 시세 흉내) */
const live = (stocks: Stock[], k: Record<string, number>) => stocks.map((s) => ({ ...s, currentPrice: s.currentPrice * (k[s.ticker!] ?? 1) }));
/** 이름표별 정한 날 가격 대비 %(지금 시세 ÷ base.price − 1, 소수 1자리) — 화면에는 그리지 않지만 저장값(base)이 현실 범위인지 본다 */
const pcts = (stocks: Stock[], labels: StockLabels, _now: number) => {
  const price = priceByLabelKey(stocks);
  return Object.entries(labels.items).filter(([t, i]) => i.base?.price && price.has(t))
    .map(([t, i]) => ({ t, pct: Math.round((price.get(t)! / i.base!.price! - 1) * 1000) / 10, state: "value" as const }))
    .sort((a, b) => a.t.localeCompare(b.t));
};

// 2026-11-17 preview 실측 배율(삼성전자 ×2.7, SK하이닉스 ×5.8, AAPL ×1.56)과 하락·혼합 장면
const SCENES: Record<string, Record<string, number>> = {
  시드: {},
  실측: { "005930": 2.7, "000660": 5.8, AAPL: 1.56, "360750": 1.2, NVDA: 1.4 },
  하락: { "005930": 0.4, "000660": 0.5, AAPL: 0.6, "360750": 0.7, NVDA: 0.5 },
  혼합: { "005930": 6, "000660": 0.45, AAPL: 3.1, "360750": 0.9, NVDA: 2 },
};

describe("데모 이름표 정한 날 가격 — 실시간 시세 배율만큼 옮긴다", () => {
  for (const today of ["2026-11-17", "2026-03-10", "2027-01-31"]) {
    const { stocks, labels } = load(today);
    const now = Date.parse(`${today}T03:00:00Z`);
    const seedPrices = priceByLabelKey(stocks);
    it.each(Object.keys(SCENES))(`${today} %s: 이름표 4종목 모두 −15%~+30%`, (scene) => {
      const nowStocks = live(stocks, SCENES[scene]);
      const next = rebaseDemoLabelPrices(labels, labels, seedPrices, priceByLabelKey(nowStocks));
      const got = pcts(nowStocks, next, now);
      expect(got.map((g) => g.t).sort()).toEqual(["000660", "005930", "360750", "AAPL"]);
      for (const g of got) {
        expect(g.state, g.t).toBe("value");
        expect(g.pct, g.t).toBeGreaterThanOrEqual(-15);
        expect(g.pct, g.t).toBeLessThanOrEqual(30);
      }
      // 장면과 무관하게 같은 값(= JSON 시세 ÷ 시드 기준가 − 1) — 체험(시드 시세)과 데모(실시간)가 같은 %
      expect(got).toEqual(pcts(stocks, labels, now));
    });
  }
  it("옮기지 않으면(수정 전) 실측 배율에서 범위를 벗어난다 — 이 테스트가 잡는 문제", () => {
    const { stocks, labels } = load("2026-11-17");
    const got = pcts(live(stocks, SCENES.실측), labels, Date.parse("2026-11-17T03:00:00Z"));
    expect(got.some((g) => g.pct > 30)).toBe(true);
  });
  it("시드 그대로인 항목만 — 사용자가 다시 붙인 항목·없는 항목은 그대로, base의 다른 필드 보존", () => {
    const { stocks, labels } = load("2026-11-17");
    const relabeled = setStockLabel(setStockLabel(labels, "005930", "check", "2026-11-17T01:00:00.000Z", { qty: 65, price: 190000, priceAt: "2026-11-17" }), "AAPL", null, "2026-11-17T01:00:00.000Z");
    const next = rebaseDemoLabelPrices(relabeled, labels, priceByLabelKey(stocks), priceByLabelKey(live(stocks, SCENES.실측)));
    expect(next.items["005930"]).toBe(relabeled.items["005930"]);
    expect(next.items.AAPL).toBe(relabeled.items.AAPL);
    expect(next.items["000660"].base).toEqual({ ...labels.items["000660"].base, price: 175000 * 5.8 });
    expect(next.items["000660"].labeledAt).toBe(labels.items["000660"].labeledAt);
    expect(next.cycle).toBe(relabeled.cycle);
  });
  it("멱등 — 같은 시세로 다시 부르면 같은 객체, 시세가 또 바뀌어도 시드에서 다시 계산(누적 곱셈 없음)", () => {
    const { stocks, labels } = load("2026-11-17");
    const seedPrices = priceByLabelKey(stocks);
    const a = rebaseDemoLabelPrices(labels, labels, seedPrices, priceByLabelKey(live(stocks, SCENES.실측)));
    expect(rebaseDemoLabelPrices(a, labels, seedPrices, priceByLabelKey(live(stocks, SCENES.실측)))).toBe(a);
    const b = rebaseDemoLabelPrices(a, labels, seedPrices, priceByLabelKey(live(stocks, SCENES.하락)));
    expect(b.items["000660"].base!.price).toBeCloseTo(175000 * 0.5, 6);
    expect(rebaseDemoLabelPrices(labels, labels, seedPrices, seedPrices)).toBe(labels); // 시세가 시드와 같으면 그대로
  });
});

describe("데모 점검 기록(reviews) 그때 가격 — base.price와 같은 배율(5.125 4·5차)", () => {
  /**
   * 화면에 보이는 '그날 가격부터' % — 그 종목의 다음 기록 가격(이력 줄 `다음 점검까지`), 없으면 지금 시세(`지금까지`·행 2줄 점검일 대비)까지(#242).
   * AAPL @D-160(166, 조건 −10%에 닿아 한 점검)은 다음 기록 205까지 +23.5%로 보인다 — 지금 시세까지의 값(+35.5%)은 화면에 없다
   */
  const reviewPcts = (stocks: Stock[], labels: StockLabels) => {
    const price = priceByLabelKey(stocks);
    const list = labels.reviews ?? [];
    return list.map((r) => {
      const later = list.filter((x) => x.t === r.t && x.at > r.at).sort((a, b) => (a.at < b.at ? -1 : 1))[0];
      return { k: `${r.t}@${r.at}`, pct: Math.round(((later?.price ?? price.get(r.t)!) / r.price - 1) * 1000) / 10 };
    });
  };
  for (const today of ["2026-11-17", "2026-03-10", "2027-01-31"]) {
    const { stocks, labels } = load(today);
    it.each(Object.keys(SCENES))(`${today} %s: 기록 3건 모두 −15%~+30%, 장면과 무관하게 같은 %`, (scene) => {
      const nowStocks = live(stocks, SCENES[scene]);
      const next = rebaseDemoLabelPrices(labels, labels, priceByLabelKey(stocks), priceByLabelKey(nowStocks));
      const got = reviewPcts(nowStocks, next);
      expect(got).toHaveLength(3);
      for (const g of got) {
        expect(g.pct, g.k).toBeGreaterThanOrEqual(-15);
        expect(g.pct, g.k).toBeLessThanOrEqual(30);
      }
      expect(got).toEqual(reviewPcts(stocks, labels));
      // rate(그때 산 날부터 %)는 옮기지 않는다
      expect(next.reviews!.map((r) => r.rate)).toEqual(labels.reviews!.map((r) => r.rate));
    });
  }
  it("TIGER 정한 뒤 +10.5% < 산 날부터 +16.7%(COO P1-6, base.price 19,000)", () => {
    const { stocks, labels } = load("2026-11-17");
    expect(labels.items["360750"].base!.price).toBe(19000);
    expect(pcts(stocks, labels, 0).find((g) => g.t === "360750")!.pct).toBe(10.5);
    const tiger = stocks.find((s) => s.ticker === "360750")!;
    expect(Math.round((tiger.currentPrice / tiger.averagePrice - 1) * 1000) / 10).toBe(16.7);
  });
  it("시드에 같은 `t@at`이 있는 기록만 — 데모에서 새로 남긴 기록은 그때 시세라 그대로", () => {
    const { stocks, labels } = load("2026-11-17");
    const mine = { t: "AAPL", at: "2026-11-17T01:00:00.000Z", from: "check" as const, choice: "same" as const, price: 300, rate: 50 };
    const withMine: StockLabels = { ...labels, reviews: [mine, ...labels.reviews!] };
    const next = rebaseDemoLabelPrices(withMine, labels, priceByLabelKey(stocks), priceByLabelKey(live(stocks, SCENES.실측)));
    expect(next.reviews![0]).toBe(mine);
    expect(next.reviews!.find((r) => r.t === "NVDA")!.price).toBeCloseTo(120 * 1.4, 6);
    expect(rebaseDemoLabelPrices(next, labels, priceByLabelKey(stocks), priceByLabelKey(live(stocks, SCENES.실측)))).toBe(next); // 멱등
  });
});

describe("데모·체험 전용 — 사용자 저장 경로 영향 0", () => {
  const comp = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/preview/demo-snapshot-rebase.tsx"), "utf8");
  it("쓰기는 eligible(체험·preview + 모든 보유 id가 demo_) 안에서만. 이름표는 직접 쓰기(동기화 신호 없음), 평단은 saveData 1곳 — 동기화는 preview·체험에서 꺼져 있다", () => {
    const eff = comp.slice(comp.indexOf("rebaseDemoLabelPrices(cur.value") - 300, comp.indexOf("rebaseDemoLabelPrices(cur.value"));
    expect(eff).toContain("if (!eligible || !seed?.labels) return;");
    expect(comp).toContain('held.every((a) => a.id.startsWith("demo_"))');
    expect(comp).not.toMatch(/notifyAssetUserEdit|setStockLabel\(|track\(/);
    const cfg = readFileSync(path.resolve(__dirname, "../cloud-sync/config.ts"), "utf8");
    expect(cfg).toContain("!isPreviewEnv()");
    expect(cfg).toContain("!isTrialMode()");
  });
  it("이름표 모듈·훅·불리기 화면은 데모 코드를 읽지 않는다", () => {
    for (const f of ["../asset/stock-labels.ts", "../asset/grow-rows.ts", "../asset/grow-board.ts", "../../hooks/use-stock-labels.ts"]) {
      expect(readFileSync(path.resolve(__dirname, f), "utf8"), f).not.toMatch(/preview\/demo|isPreviewEnv|isTrialMode/);
    }
  });
});

// ui-review R2(C132 ①) — 같은 행 첫 줄 `내 매입가 대비`도 실시간 시세 배율만큼 평단을 옮겨 체험과 같은 %로
describe("데모 평단 재기준 — 내 매입가 대비 %가 현실 범위·체험과 같다", () => {
  const LIVE_RATES = { USD: 1470, JPY: 925 };
  const rate = (s: Stock, rates: typeof RATES) => Math.round(computeStockMetrics(s, rates).profitRate * 10) / 10;
  for (const today of ["2026-11-17", "2027-01-31"]) {
    const { stocks } = load(today);
    const seed = demoSeedStockMap(stocks);
    it.each(Object.keys(SCENES))(`${today} %s: 데모 주식 전부 −20%~+40%, 체험(JSON 시세)과 같은 값`, (scene) => {
      const nowStocks = live(stocks, SCENES[scene]);
      const next = rebaseDemoAveragePrices(nowStocks, seed);
      for (const [i, s] of next.entries()) {
        const r = rate(s, LIVE_RATES);
        expect(r, s.ticker).toBeGreaterThanOrEqual(-20);
        expect(r, s.ticker).toBeLessThanOrEqual(40);
        expect(r, s.ticker).toBe(rate(stocks[i], LIVE_RATES)); // 같은 환율이면 체험 값과 같다
        expect(s.purchaseExchangeRate).toBe(stocks[i].purchaseExchangeRate); // 매입 환율은 그대로
        expect(s.currentPrice).toBe(nowStocks[i].currentPrice);
      }
    });
  }
  it("옮기지 않으면(수정 전) 실측 배율에서 SK하이닉스가 범위를 벗어난다", () => {
    const { stocks } = load("2026-11-17");
    const hynix = live(stocks, SCENES.실측).find((s) => s.ticker === "000660")!;
    expect(rate(hynix, RATES)).toBeGreaterThan(40);
  });
  it("실사용자 데이터에서 작동 0회 — 시드에 없는 id는 그대로(같은 배열), 수량이 바뀐 데모 보유 건도 그대로", () => {
    const { stocks } = load("2026-11-17");
    const seed = demoSeedStockMap(stocks);
    const user = live(stocks, SCENES.실측).map((s) => ({ ...s, id: s.id.replace("demo_", "u_") }));
    expect(rebaseDemoAveragePrices(user, seed)).toBe(user);
    const traded = live(stocks, SCENES.실측).map((s) => ({ ...s, quantity: s.quantity + 1 }));
    expect(rebaseDemoAveragePrices(traded, seed)).toBe(traded);
    const once = rebaseDemoAveragePrices(live(stocks, SCENES.실측), seed);
    expect(rebaseDemoAveragePrices(once, seed)).toBe(once); // 멱등
    expect(rebaseDemoAveragePrices(stocks, seed)).toBe(stocks); // 시세가 시드와 같으면 그대로
  });
  it("가드: 평단 저장은 eligible(체험·preview + 모든 보유 id가 demo_)이고 시드를 읽은 뒤에만", () => {
    const comp = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/preview/demo-snapshot-rebase.tsx"), "utf8");
    const at = comp.indexOf("rebaseDemoAveragePrices(assetData.stocks");
    expect(comp.slice(at - 120, at)).toContain("if (!eligible || !seed) return;");
    expect(comp).toContain("if (!isTrialMode() && !isPreviewEnv()) return false;");
    expect(comp.match(/saveData\(/g)).toHaveLength(1);
  });
});

// ui-review R2 재판정·qa D-2 — 평단을 옮겨도 홈·자산 변화·결산의 원인 분해가 평단 재기준 전(eb7316a)과 같다
describe("평단 재기준 전후 원인 분해 일치(기록 원가를 같은 만큼 옮긴다)", () => {
  type P = { assetData: AssetData; snapshots: { daily: DailyAssetSnapshot[]; monthly: MonthlyAssetSnapshot[] } };
  const RATES_LIVE = { USD: 1470, JPY: 925 };
  const summaryOf = (d: AssetData, rates: typeof RATES) => ({ ...computeNetAsset(d, rates), ...computeAssetCost(d, rates) }) as unknown as AssetSummary;
  const liveOf = (d: AssetData, rates: typeof RATES) => buildLiveAttributionCurr(d, rates, summaryOf(d, rates));
  /** 한 세션의 재기준 — 기준 기록(rows)·기준 평단(avg)에서 지금 데이터로. withAvg=false면 평단 재기준 전(eb7316a) 동작 */
  const session = (daily: DailyAssetSnapshot[], monthly: MonthlyAssetSnapshot[], baseStocks: Stock[], data: AssetData, rates: typeof RATES, today: string, seed: ReturnType<typeof demoSeedStockMap>, withAvg: boolean) => {
    const ref = pickRebaseRef(daily, today)!;
    const next = withAvg ? { ...data, stocks: rebaseDemoAveragePrices(data.stocks, seed) } : data;
    const n = computeNetAsset(next, rates);
    const ks = rebaseRatio(n.stockValue, ref.stocks);
    const kc = rebaseRatio(n.cryptoValue, ref.crypto);
    const prev = withAveragePrices(next, demoSeedStockMap(baseStocks));
    const shifts = withAvg ? demoCostShifts([...daily, ...monthly], prev, next, liveOf(prev, rates), liveOf(next, rates), rates) : undefined;
    return { data: next, daily: rebaseDemoRows(daily, ref, ks, kc, shifts), monthly: rebaseDemoRows(monthly, ref, ks, kc, shifts) };
  };
  /** 화면이 쓰는 원인 분해 전부 — 홈(지난 접속 이후)·자산 변화 기간 4개·이번 달 결산·연 결산 */
  type Eff = Record<string, number> | null;
  type Causes = { home: Eff; "1w": Eff; "1m": Eff; "3m": Eff; ytd: Eff; month: [string, number][]; year: string };
  const causes = (w: { data: AssetData; daily: DailyAssetSnapshot[]; monthly: MonthlyAssetSnapshot[] }, rates: typeof RATES, today: string): Causes => {
    const live = liveOf(w.data, rates);
    const n = computeNetAsset(w.data, rates);
    const eff = (a: { effects: readonly { key: string; amount: number }[] } | null) => a ? Object.fromEntries(a.effects.map((e) => [e.key, Math.round(e.amount)])) : null;
    const yesterday = w.daily.filter((d) => d.date < today).sort((a, b) => b.date.localeCompare(a.date))[0].date;
    const win = resolveSettlementWindow(w.monthly, today.slice(0, 7), today);
    const month = computeSettlementCauses({ start: win.start, end: null, live, deltaNet: settlementDelta(win as never, n.netAsset).delta, startDate: win.startDate, endDate: today, liveCash: n.cashValue, exchangeHistory: {}, assetData: w.data, rates });
    // 올해 항목은 앱이 스냅샷 저장 때 넣는다(saveSnapshots) — 같은 값으로 채운다
    const y = Number(today.slice(0, 4));
    const withYear = { ...w.data, yearlyNetAssets: [...(w.data.yearlyNetAssets ?? []).filter((x) => x.year !== y), { year: y, netAsset: n.netAsset, note: "자동" }] } as AssetData;
    const year = buildYearSettlementModel({ assetData: withYear, monthly: w.monthly, daily: w.daily, rates, exchangeHistory: {}, summary: summaryOf(w.data, rates), today });
    return {
      ...({} as Pick<Causes, "1w" | "1m" | "3m" | "ytd">),
      home: eff(computeAttributionSince(w.daily, w.monthly, {}, yesterday, w.data, rates, live)),
      ...Object.fromEntries((["1w", "1m", "3m", "ytd"] as const).map((k) => [k, eff(computePeriodAttribution(w.daily, w.monthly, {}, k, w.data, rates, live))])),
      month: month.mapped.causes.map((c) => [c.key, Math.round(c.amount)] as [string, number]),
      year: JSON.stringify(year?.groups ?? null, (_k, v) => (typeof v === "number" ? Math.round(v) : v)),
    };
  };
  for (const today of ["2026-11-17", "2027-01-31"]) {
    it(`${today}: 홈·기간 4개·월 결산·연 결산이 평단 재기준 전과 같다(실측 배율, USD 1470)`, () => {
      const p = materializeDemo(raw, today) as unknown as P;
      const stocks = assetDataSchema.parse(p.assetData).stocks;
      const data = { ...p.assetData, stocks: live(stocks, SCENES.실측) } as AssetData;
      const seed = demoSeedStockMap(stocks);
      const before = session(p.snapshots.daily, p.snapshots.monthly, stocks, data, RATES_LIVE, today, seed, false);
      const after = session(p.snapshots.daily, p.snapshots.monthly, stocks, data, RATES_LIVE, today, seed, true);
      expect(after.data.stocks.find((s) => s.ticker === "000660")!.averagePrice).not.toBe(stocks.find((s) => s.ticker === "000660")!.averagePrice);
      const a = causes(after, RATES_LIVE, today);
      const b = causes(before, RATES_LIVE, today);
      expect(b.year).not.toBe("null");
      // 실측 구간만 쓰는 화면(홈·1주·1개월·이번 달 결산·연 결산)은 원 단위까지 같다
      for (const k of ["home", "1w", "1m", "month", "year"] as const) expect(a[k], k).toEqual(b[k]);
      // 3개월·올해는 시작점이 원가 없는 예측 기록이라 그 구간의 매수 추정(매수일 × 평단 × 수량)이 평단을 따른다 — 합계는 같고 매수·시세 사이에서만 옮겨 간다
      for (const k of ["3m", "ytd"] as const) {
        const x = a[k]!; const y = b[k]!;
        const sum = (o: Record<string, number>) => Object.values(o).reduce((m, v) => m + v, 0);
        expect(Math.abs(sum(x) - sum(y)), k).toBeLessThanOrEqual(3);
        const diff = Object.keys({ ...x, ...y }).filter((c) => Math.abs((x[c] ?? 0) - (y[c] ?? 0)) > 2);
        for (const c of diff) expect(["buy:stock", "price", "price:stock", "price:crypto", "price:realEstate"], `${k}.${c}`).toContain(c);
      }
    });
  }
  // #242 qa D2(C132) — 실시세 데모에서 코인 `평단 대비`·`정한 날 대비`·조건 도달이 서로 모순되지 않게 코인 평단도 옮긴다
  for (const [today, k] of [["2026-11-17", 0.61], ["2026-11-17", 1.8], ["2027-01-31", 0.61]] as const) {
    it(`${today} 코인 ${k}배: 코인 한 장의 세 값이 체험(시드 시세)과 같고, 홈·기간 4개·월 결산·연 결산이 코인 평단 재기준 전과 원 단위까지 같다`, () => {
      const p = materializeDemo(raw, today) as unknown as P;
      const parsed = assetDataSchema.parse(p.assetData);
      const stocks = parsed.stocks;
      const seed = demoSeedStockMap(stocks);
      const cseed = demoSeedStockMap(parsed.crypto);
      const labels = parseStockLabels((materializeDemo(raw, today) as { stockLabels: unknown }).stockLabels)!;
      const now = Date.parse(`${today}T03:00:00Z`);
      const liveCrypto = parsed.crypto.map((c) => ({ ...c, currentPrice: c.currentPrice * k }));
      const data = { ...p.assetData, stocks: live(stocks, SCENES.실측), crypto: liveCrypto } as AssetData;
      // 재기준 전(f366ed2 동작): 이름표의 c: 가격만 옮기고 코인 평단은 그대로 → 세 값이 어긋난다
      const movedLabels = rebaseDemoLabelPrices(labels, labels, priceByAnyLabelKey(stocks, parsed.crypto), priceByAnyLabelKey(data.stocks, liveCrypto));
      const coin = (crypto: typeof liveCrypto) => buildCryptoRows(crypto, movedLabels, now)[0];
      const round = (v: number) => Math.round(v * 10) / 10;
      const seedRow = buildCryptoRows(parsed.crypto, labels, now)[0];
      const stale = coin(liveCrypto);
      if (k < 1) expect([round(stale.rate!), stale.due]).toEqual([-28.8, true]); // 평단 대비 −28.8%·조건 −20% 도달인데 정한 날 대비는 +6.1% — qa D2
      expect(round(stale.since!.pct)).toBe(6.1);
      // 재기준 뒤: 평단 대비·정한 날 대비·차례가 체험과 같다
      const nextCrypto = rebaseDemoAveragePrices(liveCrypto, cseed);
      const fixed = coin(nextCrypto);
      expect([round(fixed.rate!), round(fixed.since!.pct), fixed.due, fixed.dueReason]).toEqual([round(seedRow.rate!), round(seedRow.since!.pct), seedRow.due, seedRow.dueReason]);
      expect([round(fixed.rate!), round(fixed.since!.pct), fixed.due]).toEqual([16.7, 6.1, false]);
      // 정한 날 가격이 평단보다 높고 지금 가격보다 낮다(정한 날 이미 조건에 닿아 있던 모순 없음)
      const base = movedLabels.items["c:BTC"].base!.price!;
      expect(base).toBeGreaterThan(nextCrypto[0].averagePrice);
      expect(base).toBeLessThan(nextCrypto[0].currentPrice);
      // 전 종류 합 = 체험과 같은 `점검 차례 4개`
      expect(growStatus(buildGrowBoards({ ...data, stocks: rebaseDemoAveragePrices(data.stocks, seed), crypto: nextCrypto }, RATES_LIVE, movedLabels, now))).toMatchObject({ kind: "due", due: 4, unit: "개" });
      // 원인 분해 — 코인 평단을 옮긴 만큼 기록의 코인 원가를 옮겨 전과 같다(C134). 거래 단가·수량·시세·그 밖 필드는 그대로
      const before = session(p.snapshots.daily, p.snapshots.monthly, stocks, data, RATES_LIVE, today, seed, true);
      const nextData = { ...before.data, crypto: nextCrypto } as AssetData;
      const prev = withCryptoAveragePrices(nextData, cseed);
      const rows = [...p.snapshots.daily, ...p.snapshots.monthly];
      const cShifts = demoCostShifts(rows, prev, nextData, liveOf(prev, RATES_LIVE), liveOf(nextData, RATES_LIVE), RATES_LIVE);
      const ref = pickRebaseRef(p.snapshots.daily, today)!;
      const n = computeNetAsset(nextData, RATES_LIVE);
      const prevS = withAveragePrices(nextData, demoSeedStockMap(stocks));
      const sShifts = demoCostShifts(rows, prevS, nextData, liveOf(prevS, RATES_LIVE), liveOf(nextData, RATES_LIVE), RATES_LIVE);
      const scale = <T extends DailyAssetSnapshot | MonthlyAssetSnapshot>(r: T[]) => rebaseDemoRows(r, ref, rebaseRatio(n.stockValue, ref.stocks), rebaseRatio(n.cryptoValue, ref.crypto), sShifts, cShifts);
      const after = { data: nextData, daily: scale(p.snapshots.daily), monthly: scale(p.snapshots.monthly) };
      expect(cShifts.size).toBeGreaterThan(0);
      const a = causes(after, RATES_LIVE, today);
      const b = causes(before, RATES_LIVE, today);
      expect(b.year).not.toBe("null");
      for (const key of ["home", "1w", "1m", "3m", "ytd", "month", "year"] as const) expect(a[key], key).toEqual(b[key]);
      // 주식 원가 칸은 건드리지 않는다 — 코인 칸과 합계만
      for (const [i, r] of after.daily.entries()) if (r.cost && before.daily[i].cost) { expect(r.cost.stock).toBe(before.daily[i].cost!.stock); expect(r.cost.total - before.daily[i].cost!.total).toBe(r.cost.crypto - before.daily[i].cost!.crypto); }
      expect(nextData.cryptoTransactions).toBe(before.data.cryptoTransactions); // 거래 단가는 옮기지 않는다(올해 결산 '넣은 돈'에 번진다)
      expect(nextCrypto.map((c) => [c.quantity, c.currentPrice])).toEqual(liveCrypto.map((c) => [c.quantity, c.currentPrice]));
    });
  }
  it("코인 평단 재기준 — 실사용자 데이터에서 작동 0회(시드에 없는 id·수량이 바뀐 코인은 같은 배열), 멱등, 가드는 주식과 같은 한 곳", () => {
    const parsed = assetDataSchema.parse((materializeDemo(raw, "2026-11-17") as unknown as P).assetData);
    const cseed = demoSeedStockMap(parsed.crypto);
    const moved = parsed.crypto.map((c) => ({ ...c, currentPrice: c.currentPrice * 0.61 }));
    const user = moved.map((c) => ({ ...c, id: c.id.replace("demo_", "u_") }));
    expect(rebaseDemoAveragePrices(user, cseed)).toBe(user);
    const traded = moved.map((c) => ({ ...c, quantity: c.quantity + 0.01 }));
    expect(rebaseDemoAveragePrices(traded, cseed)).toBe(traded);
    const once = rebaseDemoAveragePrices(moved, cseed);
    expect(once[0].averagePrice).toBeCloseTo(120_000_000 * 0.61, 3);
    expect(rebaseDemoAveragePrices(once, cseed)).toBe(once);
    expect(rebaseDemoAveragePrices(parsed.crypto, cseed)).toBe(parsed.crypto); // 시세가 시드와 같으면(체험) 그대로
    const comp = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/preview/demo-snapshot-rebase.tsx"), "utf8");
    const at = comp.indexOf("rebaseDemoAveragePrices(assetData.crypto");
    expect(comp.slice(comp.lastIndexOf("useEffect", at), at)).toContain("if (!eligible || !seed) return;");
    expect(comp.match(/saveData\(/g)).toHaveLength(1);
    expect(comp).toContain("saveData({ ...assetData, stocks: next, crypto: nextCrypto });");
    expect(comp).not.toMatch(/cryptoTransactions/); // 거래는 쓰지 않는다
  });
  it("새로고침을 반복해도 누적되지 않는다 — 옮긴 기록·평단을 기준으로 다시 옮겨도 처음부터 옮긴 것과 같다", () => {
    const today = "2026-11-17";
    const p = materializeDemo(raw, today) as unknown as P;
    const stocks = assetDataSchema.parse(p.assetData).stocks;
    const seed = demoSeedStockMap(stocks);
    const s1 = session(p.snapshots.daily, p.snapshots.monthly, stocks, { ...p.assetData, stocks: live(stocks, SCENES.실측) } as AssetData, RATES_LIVE, today, seed, true);
    // 2·3번째 새로고침: 저장된 기록·평단이 기준, 시세가 또 움직임
    let cur = s1;
    for (const k of [1.1, 0.95]) {
      const moved = { ...cur.data, stocks: cur.data.stocks.map((s) => ({ ...s, currentPrice: s.currentPrice * k })) } as AssetData;
      cur = session(cur.daily, cur.monthly, cur.data.stocks, moved, RATES_LIVE, today, seed, true);
      const fresh = session(p.snapshots.daily, p.snapshots.monthly, stocks, { ...p.assetData, stocks: moved.stocks.map((s, i) => ({ ...s, averagePrice: stocks[i].averagePrice })) } as AssetData, RATES_LIVE, today, seed, false);
      const a = causes(cur, RATES_LIVE, today);
      const b = causes(fresh, RATES_LIVE, today);
      // 비교 기준(fresh)은 평단 재기준 전 동작 — 실측 구간 화면만 비교한다(3개월·올해의 예측 구간은 위 테스트 참고)
      for (const key of ["home", "1w", "1m"] as const) {
        const ak = a[key] as Record<string, number>;
        for (const [ck, v] of Object.entries(b[key] ?? {})) expect(Math.abs(ak[ck] - v), `${key}.${ck}`).toBeLessThanOrEqual(2);
      }
      for (const [i, [ck, v]] of (b.month as [string, number][]).entries()) { expect(a.month[i][0]).toBe(ck); expect(Math.abs((a.month[i][1] as number) - v)).toBeLessThanOrEqual(2); }
    }
  });
});
