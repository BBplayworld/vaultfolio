// #239 5.125 — 데모·체험 이름표의 '정한 날 가격 대비 %'가 실시간 시세로 덮여도 현실적인 범위(−15%~+30%)에 있는지.
// 데모 시드의 정한 날 가격은 JSON 시세 눈금이라, 시세만 실시간으로 바뀌면 +500%처럼 보였다(대표 preview 확인 경로).
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { materializeDemo } from "../preview/demo-payload";
import { priceByLabelKey, rebaseDemoLabelPrices } from "../preview/demo-live-rebase";
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
  it("쓰기는 eligible(체험·preview + 모든 보유 id가 demo_) 안에서만, 동기화 신호 없음", () => {
    const eff = comp.slice(comp.indexOf("rebaseDemoLabelPrices(cur.value") - 300, comp.indexOf("rebaseDemoLabelPrices(cur.value"));
    expect(eff).toContain("if (!eligible || !labelSeed) return;");
    expect(comp).toContain('held.every((a) => a.id.startsWith("demo_"))');
    expect(comp).not.toMatch(/notifyAssetUserEdit|setStockLabel\(|track\(/);
  });
  it("이름표 모듈·훅·불리기 화면은 데모 코드를 읽지 않는다", () => {
    for (const f of ["../asset/stock-labels.ts", "../asset/grow-rows.ts", "../asset/grow-links.ts", "../../hooks/use-stock-labels.ts"]) {
      expect(readFileSync(path.resolve(__dirname, f), "utf8"), f).not.toMatch(/preview\/demo|isPreviewEnv|isTrialMode/);
    }
  });
});
