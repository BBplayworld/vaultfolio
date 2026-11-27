// 5.176 #360 qa 재현(5.176-qa-repro.md) 회귀 — 분류 탭의 카드 %와 범례·바 %가 같은 '지금 탭' 기준인가.
// 값은 손으로 만든 객체를 바로 넘기지 않고 저장 관문(saveAssetData → getAssetData, assetDataSchemaLoose.parse)을 거쳐 다시 읽는다(C162).
// 합계는 앱과 같은 computeNetAsset·computeAssetCost로 만든다. 분류 탭 선택은 탭의 useState("all") 초기값만 바꿔 흉내 낸다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { AssetData } from "@/types/asset";

const h = vi.hoisted(() => ({ category: "all", data: null as unknown }));

vi.mock("react", async (importOriginal) => {
  const r = await importOriginal<typeof import("react")>();
  const useState = ((init: unknown) => (init === "all" ? [h.category, () => {}] : r.useState(init))) as typeof r.useState;
  return { ...r, default: { ...r, useState }, useState };
});
vi.mock("@/contexts/asset-data-context", async (importOriginal) => {
  const orig = await importOriginal<typeof import("@/contexts/asset-data-context")>();
  const rates = { USD: 1380, JPY: 900 };
  return {
    ...orig,
    useAssetData: () => {
      const data = h.data as AssetData;
      const b = orig.computeNetAsset(data, rates);
      const c = orig.computeAssetCost(data, rates);
      return {
        assetData: data, exchangeRates: rates,
        deleteCash: () => {}, deleteLoan: () => {}, deleteRealEstate: () => {}, deleteCrypto: () => {}, deleteCryptos: () => {},
        getAssetSummary: () => ({
          ...b,
          realEstateCost: c.realEstateCost, realEstateProfit: b.realEstateValue - c.realEstateCost,
          cryptoCost: c.cryptoCost, cryptoProfit: b.cryptoValue - c.cryptoCost,
        }),
      };
    },
  };
});
vi.mock("../../../../layout/navigation/navigation-context", () => ({ useAssetNavigation: () => ({ navigate: () => {} }) }));

import { saveAssetData, getAssetData } from "@/lib/asset/asset-storage";
import { CashTab } from "../cash-tab";
import { RealEstateTab } from "../real-estate-tab";
import { LoanTab } from "../loan-tab";
import { CryptoTab } from "../crypto-tab";

const D = "2026-11-28";
const cash = (id: string, name: string, type: string, balance: number) => ({ id, name, type, balance, currency: "KRW" });
const re = (id: string, name: string, type: string, purchasePrice: number, currentValue: number, extra: object = {}) =>
  ({ id, name, type, address: "", purchasePrice, currentValue, purchaseDate: D, ...extra });
const loan = (id: string, name: string, type: string, balance: number, extra: object = {}) =>
  ({ id, name, type, balance, interestRate: 4, startDate: D, ...extra });
const coin = (id: string, symbol: string, name: string, quantity: number, price: number) =>
  ({ id, symbol, name, quantity, averagePrice: price, currentPrice: price, purchaseDate: D });

// qa-repro 입력값 그대로(현금 1,000만·부동산 10억·대출 1억·코인 3,500만)
const RAW = {
  lastUpdated: `${D}T00:00:00.000Z`,
  stocks: [],
  cash: [
    cash("ca", "예금A", "deposit", 2_000_000), cash("cb", "예금B", "deposit", 2_000_000),
    cash("cc", "입출금C", "bank", 4_000_000), cash("cd", "CMA D", "cma", 2_000_000),
  ],
  realEstate: [
    re("rx", "아파트X", "apartment", 500_000_000, 600_000_000),
    re("ry1", "토지Y1", "land", 250_000_000, 300_000_000),
    re("ry2", "토지Y2", "land", 90_000_000, 100_000_000),
  ],
  loans: [
    loan("la", "신용A", "credit", 20_000_000), loan("lb", "신용B", "credit", 10_000_000),
    loan("lc", "담보C", "mortgage-home", 70_000_000, { linkedRealEstateId: "rx" }),
  ],
  crypto: [
    coin("k1", "BTC", "비트코인", 0.1, 150_000_000), coin("k2", "ETH", "이더리움", 2, 5_000_000),
    coin("k3", "XRP", "리플", 1000, 5_000), coin("k4", "SOL", "솔라나", 10, 300_000), coin("k5", "DOGE", "도지코인", 5000, 400),
  ],
};

beforeEach(() => {
  const store = new Map<string, string>();
  const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
  (globalThis as unknown as { window: unknown }).window = { localStorage: ls, dispatchEvent: () => true };
  (globalThis as unknown as { localStorage: unknown }).localStorage = ls;
  expect(saveAssetData(RAW as unknown as AssetData)).toBe(true);
  h.data = getAssetData();
  h.category = "all";
});
afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

const html = (el: React.ReactElement, category = "all") => { h.category = category; return renderToStaticMarkup(el); };
const pcts = (s: string, testId: string) => [...s.matchAll(new RegExp(`data-testid="${testId}"[^>]*?data-pct="([^"]+)"`, "g"))].map((m) => m[1]);
const rowShares = (s: string) => [...s.matchAll(/data-testid="row-share"[^>]*>([\d.]+)%</g)].map((m) => m[1]);
const legendNames = (s: string) => [...s.matchAll(/data-testid="share-legend-item"[\s\S]*?title="([^"]+)"/g)].map((m) => m[1]);
const barColors = (s: string) => s.slice(s.indexOf('data-testid="share-bar"'), s.indexOf('data-testid="share-legend"')).match(/background-color:[^;"]+/g) ?? [];

describe("현금 — 분류 탭 카드 % = 범례 % = 바 title", () => {
  it("'예금' 탭: 예금A·예금B 카드 50.0 = 범례 50.0 = 바 50.0, 다른 분류 계좌 0", () => {
    const s = html(<CashTab />, "deposit");
    expect(rowShares(s)).toEqual(["50.0", "50.0"]);
    expect(pcts(s, "share-legend-item")).toEqual(["50.0", "50.0"]);
    expect(pcts(s, "share-bar-seg")).toEqual(["50.0", "50.0"]);
    expect(s).toContain('title="예금A: 50.0%"');
    expect(s).not.toContain("입출금C");
    expect(s).toContain("4,000,000");
    // 같은 종류 두 계좌도 서로 다른 색(종류 고정색 폐지)
    const c = barColors(s);
    expect(new Set(c).size).toBe(2);
  });
  it.each([["bank", "입출금C"], ["cma", "CMA D"]])("'%s' 탭: 범례 1개 100.0", (cat, name) => {
    const s = html(<CashTab />, cat);
    expect(pcts(s, "share-legend-item")).toEqual(["100.0"]);
    expect(rowShares(s)).toEqual(["100.0"]);
    expect(legendNames(s)).toEqual([name]);
  });
  it("'전체' 탭: main과 같은 숫자·순서(입출금C 40.0 → 예금A 20.0 …), 4개라 그 외 없음, 색 중복 0", () => {
    const s = html(<CashTab />);
    expect(pcts(s, "share-legend-item")).toEqual(["40.0", "20.0", "20.0", "20.0"]);
    expect(legendNames(s)).toEqual(["입출금C", "예금A", "예금B", "CMA D"]);
    expect(s).not.toContain("share-legend-rest");
    expect(new Set(barColors(s)).size).toBe(4);
    // 카드(분류별 묶음 순서: 예금 → 입출금 → CMA)
    expect(rowShares(s)).toEqual(["20.0", "20.0", "40.0", "20.0"]);
  });
});

describe("부동산 — 분류 탭 기준·K3 '시세' 라벨", () => {
  it("'토지' 탭: 카드 75.0·25.0 = 범례 = 바", () => {
    const s = html(<RealEstateTab />, "land");
    expect(rowShares(s)).toEqual(["75.0", "25.0"]);
    expect(pcts(s, "share-legend-item")).toEqual(["75.0", "25.0"]);
    expect(pcts(s, "share-bar-seg")).toEqual(["75.0", "25.0"]);
  });
  it("'아파트' 탭: 범례 1개 100.0", () => {
    const s = html(<RealEstateTab />, "apartment");
    expect(pcts(s, "share-legend-item")).toEqual(["100.0"]);
    expect(rowShares(s)).toEqual(["100.0"]);
  });
  it("'전체' 탭: 60.0·30.0·10.0 그대로(main과 같은 숫자·순서·색)", () => {
    const s = html(<RealEstateTab />);
    expect(pcts(s, "share-legend-item")).toEqual(["60.0", "30.0", "10.0"]);
    expect(legendNames(s)).toEqual(["아파트X", "토지Y1", "토지Y2"]);
    expect(s).toContain("1,000,000,000");
  });
  it("펼침 라벨 '시세'·LTV '담보대출 ÷ 시세', '실거래가' 문자열 0, '실거래 추정' 유지", () => {
    // Collapsible 닫힘 상태라 정적 마크업에는 펼침부가 없다 — 원본 소스 문구로 확인
    const src = readFileSync(join(__dirname, "../real-estate-tab.tsx"), "utf8");
    expect(src).toContain('data-testid="re-value-label" className={ASSET_THEME.cardDetailLabel}>시세</p>');
    expect(src).toContain('data-testid="re-ltv-basis" className={ASSET_THEME.cardDetailMeta}>담보대출 ÷ 시세</p>');
    expect(src).not.toMatch(/>[^<]*실거래가[^<]*</);
    expect(src).toContain(">실거래 추정</span>");
  });
});

describe("대출(통제군) — 숫자 변화 0, 같은 색 0", () => {
  it("'신용대출' 탭 66.7·33.3, '부동산담보' 탭 100.0", () => {
    const a = html(<LoanTab />, "credit");
    expect(rowShares(a)).toEqual(["66.7", "33.3"]);
    expect(pcts(a, "share-legend-item")).toEqual(["66.7", "33.3"]);
    expect(new Set(barColors(a)).size).toBe(2);
    const b = html(<LoanTab />, "mortgage-home");
    expect(pcts(b, "share-legend-item")).toEqual(["100.0"]);
  });
  it("'전체' 탭: 70.0·20.0·10.0", () => {
    expect(pcts(html(<LoanTab />), "share-legend-item")).toEqual(["70.0", "20.0", "10.0"]);
  });
});

describe("코인 — 5개면 상위 3 + 그 외 2개, 목록 5개 그대로", () => {
  it("범례 42.9·28.6·14.3 + 그 외 2개 14.3, 카드 % 5개 그대로", () => {
    const s = html(<CryptoTab />);
    expect(pcts(s, "share-legend-item")).toEqual(["42.9", "28.6", "14.3"]);
    expect(s).toContain('data-testid="share-legend-rest" data-count="2" data-pct="14.3"');
    expect(pcts(s, "share-bar-seg")).toHaveLength(4);
    expect(rowShares(s)).toEqual(["42.9", "28.6", "14.3", "8.6", "5.7"]);
  });
});
