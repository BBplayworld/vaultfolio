// #239 5.125 — 데모·체험 이름표의 '정한 날 가격 대비 %'가 실시간 시세로 덮여도 현실적인 범위(−15%~+30%)에 있는지.
// 데모 시드의 정한 날 가격은 JSON 시세 눈금이라, 시세만 실시간으로 바뀌면 +500%처럼 보였다(대표 preview 확인 경로).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { materializeDemo } from "../preview/demo-payload";
import { demoCostRatio, demoSeedStockMap, pickRebaseRef, priceByLabelKey, rebaseDemoAveragePrices, rebaseDemoLabelPrices, rebaseDemoRows } from "../preview/demo-live-rebase";
import { computeStockMetrics } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { computeAssetCost } from "@/contexts/asset-data-context";
import type { AssetData, DailyAssetSnapshot } from "@/types/asset";
import { parseStockLabels, setStockLabel, type StockLabels } from "../asset/stock-labels";
import { buildGrowRows } from "../asset/grow-rows";
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
const pcts = (stocks: Stock[], labels: StockLabels, now: number) =>
  buildGrowRows(stocks, RATES, labels, now).filter((r) => r.priceFact).map((r) => ({ t: r.ticker, pct: Number(r.priceFact!.text.replace(/[+%]/g, "").replace("−", "-")), state: r.priceFact!.state }))
    .sort((a, b) => a.t.localeCompare(b.t)); // 행 순서는 비중을 따르므로 종목 순으로 비교

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
    for (const f of ["../asset/stock-labels.ts", "../asset/grow-rows.ts", "../asset/grow-links.ts", "../../hooks/use-stock-labels.ts"]) {
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
  it("스냅샷 주식 원가도 같은 만큼 — 어제 기록 원가 ≈ 지금 원가(가짜 넣은 돈 없음), 새로고침 뒤 다시 계산해도 배율 1", () => {
    const today = "2026-11-17";
    const p = materializeDemo(raw, today) as unknown as { assetData: AssetData; snapshots: { daily: DailyAssetSnapshot[] } };
    const stocks = assetDataSchema.parse(p.assetData).stocks;
    const seed = demoSeedStockMap(stocks);
    const ref = pickRebaseRef(p.snapshots.daily, today)!;
    expect(ref.costStock).toBeGreaterThan(0);
    const now = rebaseDemoAveragePrices(live(stocks, SCENES.실측), seed);
    const kcost = demoCostRatio(now, seed, LIVE_RATES, ref);
    expect(kcost).toBeGreaterThan(1.5);
    const rows = rebaseDemoRows(p.snapshots.daily, ref, 1, 1, kcost);
    const nowCost = computeAssetCost({ ...p.assetData, stocks: now }, LIVE_RATES).stockCost;
    const seedCostLive = computeAssetCost({ ...p.assetData, stocks }, LIVE_RATES).stockCost;
    const ref2 = pickRebaseRef(rows, today)!;
    // 어제 기록 원가 : 지금 원가 = 시드 원가(어제 환율) : 시드 원가(지금 환율) — 남는 차이는 환율 효과뿐
    expect(ref2.costStock! / nowCost).toBeCloseTo(ref.costStock! / seedCostLive, 3);
    // 새로고침: 옮긴 기록을 기준으로 다시 계산하면 더 옮기지 않는다(누적 없음)
    expect(demoCostRatio(now, seed, LIVE_RATES, ref2)).toBeCloseTo(1, 6);
    // 투입원가 total도 같은 차이만큼, 주식 외 원가는 그대로
    const before = p.snapshots.daily.find((d) => d.cost)!;
    const after = rows.find((d) => d.date === before.date)!;
    expect(after.cost!.total - before.cost!.total).toBe(after.cost!.stock - before.cost!.stock);
    expect(after.cost!.crypto).toBe(before.cost!.crypto);
  });
  it("가드: 평단 저장은 eligible(체험·preview + 모든 보유 id가 demo_)이고 시드를 읽은 뒤에만", () => {
    const comp = readFileSync(path.resolve(__dirname, "../../app/(main)/_components/preview/demo-snapshot-rebase.tsx"), "utf8");
    const at = comp.indexOf("rebaseDemoAveragePrices(assetData.stocks");
    expect(comp.slice(at - 120, at)).toContain("if (!eligible || !seed) return;");
    expect(comp).toContain("if (!isTrialMode() && !isPreviewEnv()) return false;");
    expect(comp.match(/saveData\(/g)).toHaveLength(1);
  });
});
