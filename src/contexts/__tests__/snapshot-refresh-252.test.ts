// #252 편집 시 오늘 일별 행 1줄 재계산 — 행 계산 추출 골든·no-op 조건·실패 시 기존 행 유지·월/연/assetData 불변·디바운스·push 순서
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeAssetCost, computeNetAsset, computeSnapshotRow, createEditDebouncer, refreshTodayDailyRow, tryRefreshTodayRow,
  SNAPSHOT_REFRESH_DEBOUNCE_MS,
} from "@/contexts/asset-data-context";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { STORAGE_KEYS } from "@/lib/asset/asset-storage";
import type { AssetData, DailyAssetSnapshot, Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { readFileSync } from "node:fs";
import path from "node:path";

const RATES = { USD: 1400, JPY: 900 };
const WED = "2026-11-25"; // 수
const SUN = "2026-11-29";

function installStorage() {
  const m = new Map<string, string>();
  const ls = {
    getItem: vi.fn((k: string) => (m.has(k) ? m.get(k)! : null)),
    setItem: vi.fn((k: string, v: string) => { m.set(k, v); }),
    removeItem: (k: string) => { m.delete(k); },
    clear: () => m.clear(),
  };
  vi.stubGlobal("localStorage", ls);
  return { m, ls };
}

const stock = (over: Partial<Stock> = {}): Stock => ({ id: "stk1", category: "domestic", name: "A", ticker: "000001", quantity: 20, averagePrice: 900_000, currentPrice: 1_000_000, currency: "KRW", purchaseDate: "2026-10-01", ...over } as Stock);
const usdStock = stock({ id: "u1", category: "foreign", ticker: "AAPL", currency: "USD", quantity: 3, averagePrice: 150, currentPrice: 200, purchaseExchangeRate: 1300 } as Partial<Stock>);
const data = (cash = 0, extra: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [stock(), usdStock], crypto: [],
  cash: cash > 0 ? [{ id: "c1", type: "bank", name: "계좌", balance: cash, currency: "KRW" }, { id: "c2", type: "bank", name: "달러", balance: 100, currency: "USD" }] : [],
  loans: [{ id: "l1", type: "credit", name: "대출", balance: 3_000_000, interestRate: 4, startDate: "2025-01-01" }],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [], physicalAssets: [],
  lastUpdated: "2026-11-25T03:00:00.000Z", nickname: "", ...extra,
} as unknown as AssetData);
const REF: ProfitRefResponse = { "000001": { refPrice: 990_000 } } as unknown as ProfitRefResponse;

// main(v5.141) saveSnapshots 행 계산부를 그대로 옮긴 골든 — 추출 함수가 같은 값을 내야 한다
function legacyRow(latest: AssetData, rates: { USD: number; JPY: number }, refMap: ProfitRefResponse) {
  const closePriceOf = (s: Stock): number => { const t = normalizeTicker(s); const e = t ? refMap[t] : null; return e?.refPrice ?? s.currentPrice; };
  const nab = computeNetAsset(latest, rates, closePriceOf);
  const cost = computeAssetCost(latest, rates);
  const fxBase = { USD: 0, JPY: 0 };
  for (const s of latest.stocks) {
    if (s.inactiveStatus === "delisted") continue;
    if (s.currency === "USD") fxBase.USD += s.quantity * closePriceOf(s) * rates.USD;
    else if (s.currency === "JPY") fxBase.JPY += s.quantity * closePriceOf(s) * (rates.JPY / 100);
  }
  for (const c of latest.cash ?? []) {
    if (c.currency === "USD") fxBase.USD += c.balance * rates.USD;
    else if (c.currency === "JPY") fxBase.JPY += c.balance * (rates.JPY / 100);
  }
  return {
    netAsset: nab.netAsset, financialAsset: nab.financialAsset,
    breakdown: { realEstate: nab.realEstateValue, stocks: nab.stockValue, crypto: nab.cryptoValue, cash: nab.cashValue, loans: nab.loanBalance, tenantDeposit: nab.tenantDepositTotal, physical: nab.physicalValue },
    fx: { USD: rates.USD, JPY: rates.JPY }, fxBase,
    cost: { total: cost.realEstateCost + cost.physicalCost + cost.stockCost + cost.cryptoCost + nab.cashValue, stock: cost.stockCost, crypto: cost.cryptoCost, realEstate: cost.realEstateCost, physical: cost.physicalCost },
  };
}

const rowOf = (date: string, d: AssetData, grade?: DailyAssetSnapshot["grade"]): DailyAssetSnapshot => {
  const r = computeSnapshotRow(d, RATES, REF);
  return { date, netAsset: r.netAsset, financialAsset: r.financialAsset, ...r.enrich, ...(grade ? { grade } : {}) } as DailyAssetSnapshot;
};

describe("행 계산 추출 = 기존 saveSnapshots 수식(골든)", () => {
  it.each([["현금 없음", data(0)], ["현금·외화 있음", data(5_000_000)]])("%s", (_n, d) => {
    const r = computeSnapshotRow(d, RATES, REF);
    const g = legacyRow(d, RATES, REF);
    expect({ netAsset: r.netAsset, financialAsset: r.financialAsset, ...r.enrich }).toEqual(g);
  });
  it("종가 없는 종목은 currentPrice 폴백", () => {
    expect(computeSnapshotRow(data(0), RATES, {}).enrich.breakdown.stocks).toBe(legacyRow(data(0), RATES, {}).breakdown.stocks);
  });
});

describe("refreshTodayDailyRow", () => {
  let st: ReturnType<typeof installStorage>;
  const seed = (extra: Record<string, string> = {}) => {
    const daily = [rowOf("2026-11-23", data(0)), rowOf("2026-11-24", data(0)), rowOf(WED, data(0), { overall: "A" } as unknown as DailyAssetSnapshot["grade"])];
    st.m.set(STORAGE_KEYS.dailySnapshots, JSON.stringify(daily));
    st.m.set(STORAGE_KEYS.monthlySnapshots, JSON.stringify([{ month: "2026-11", date: WED, netAsset: 1 }]));
    st.m.set(STORAGE_KEYS.lastVisitDate, WED);
    st.m.set(STORAGE_KEYS.assetData, JSON.stringify(data(5_000_000)));
    for (const [k, v] of Object.entries(extra)) st.m.set(k, v);
    return daily;
  };
  beforeEach(() => { st = installStorage(); });
  afterEach(() => vi.unstubAllGlobals());

  it("S2 오늘 행만 새로 쓰고 grade 보존, 다른 행·월·lastVisitDate·assetData 바이트 동일, 키·행 수 동일", () => {
    const daily = seed();
    const before = new Map(st.m);
    expect(refreshTodayDailyRow(data(5_000_000), RATES, REF, WED)).toBe(true);
    const after = JSON.parse(st.m.get(STORAGE_KEYS.dailySnapshots)!) as DailyAssetSnapshot[];
    expect(after).toHaveLength(3);
    expect(after.slice(0, 2)).toEqual(daily.slice(0, 2));
    expect(after[2]).toEqual(rowOf(WED, data(5_000_000), { overall: "A" } as unknown as DailyAssetSnapshot["grade"]));
    expect(after[2].breakdown!.cash).toBeGreaterThan(daily[2].breakdown!.cash);
    expect([...st.m.keys()]).toEqual([...before.keys()]);
    for (const k of [STORAGE_KEYS.monthlySnapshots, STORAGE_KEYS.lastVisitDate, STORAGE_KEYS.assetData]) expect(st.m.get(k)).toBe(before.get(k));
    expect(st.ls.setItem).toHaveBeenCalledTimes(1);
  });

  it("S5 일요일은 no-op(토요일 행 불변)", () => {
    seed();
    const before = st.m.get(STORAGE_KEYS.dailySnapshots);
    expect(refreshTodayDailyRow(data(5_000_000), RATES, REF, SUN)).toBe(false);
    expect(st.m.get(STORAGE_KEYS.dailySnapshots)).toBe(before);
    expect(st.ls.setItem).not.toHaveBeenCalled();
  });

  it("오늘 행 없음·저장값 없음·파싱 불가 → no-op", () => {
    expect(refreshTodayDailyRow(data(1), RATES, REF, WED)).toBe(false);
    st.m.set(STORAGE_KEYS.dailySnapshots, JSON.stringify([rowOf("2026-11-24", data(0))]));
    expect(refreshTodayDailyRow(data(1), RATES, REF, WED)).toBe(false);
    st.m.set(STORAGE_KEYS.dailySnapshots, "{broken");
    expect(refreshTodayDailyRow(data(1), RATES, REF, WED)).toBe(false);
    expect(st.m.get(STORAGE_KEYS.dailySnapshots)).toBe("{broken");
    expect(st.ls.setItem).not.toHaveBeenCalled();
  });

  it("S10 setItem 예외 → false, 기존 행 유지·부분 쓰기 0", () => {
    seed();
    const before = st.m.get(STORAGE_KEYS.dailySnapshots);
    st.ls.setItem.mockImplementation(() => { throw new Error("quota"); });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(refreshTodayDailyRow(data(5_000_000), RATES, REF, WED)).toBe(false);
    expect(st.m.get(STORAGE_KEYS.dailySnapshots)).toBe(before);
  });

  it("계산 예외(비정상 데이터) → 기존 행 유지", () => {
    seed();
    const before = st.m.get(STORAGE_KEYS.dailySnapshots);
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(refreshTodayDailyRow(null as unknown as AssetData, RATES, REF, WED)).toBe(false);
    expect(st.m.get(STORAGE_KEYS.dailySnapshots)).toBe(before);
  });

  describe("S7 tryRefreshTodayRow 조건", () => {
    const last = { date: WED, refMap: REF };
    const base = { last, blocked: false, todayStr: WED, data: data(5_000_000), rates: RATES };
    it("정상: 재계산", () => { seed(); expect(tryRefreshTodayRow(base)).toBe(true); });
    it.each([
      ["세션 내 saveSnapshots 미성공(last=null)", { last: null }],
      ["차단(복원·앱 잠금·데모·preview)", { blocked: true }],
      ["자정 경과(ref 날짜≠오늘)", { todayStr: "2026-11-26" }],
    ])("%s → no-op, 저장값 바이트 동일·setItem 0", (_n, o) => {
      seed();
      const before = st.m.get(STORAGE_KEYS.dailySnapshots);
      expect(tryRefreshTodayRow({ ...base, ...o } as typeof base)).toBe(false);
      expect(st.m.get(STORAGE_KEYS.dailySnapshots)).toBe(before);
      expect(st.ls.setItem).not.toHaveBeenCalled();
    });
    it("네트워크 0 — fetch 호출 없음", () => {
      seed();
      const f = vi.fn(); vi.stubGlobal("fetch", f);
      tryRefreshTodayRow(base);
      expect(f).not.toHaveBeenCalled();
    });
  });
});

describe("S10 연속 편집 디바운스", () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());
  it("2초 안 5회 편집 → 1회 실행, 동기화 push 디바운스(2.5초)보다 먼저", () => {
    const run = vi.fn();
    const d = createEditDebouncer(SNAPSHOT_REFRESH_DEBOUNCE_MS, run);
    for (let i = 0; i < 5; i++) { d.onEdit(); vi.advanceTimersByTime(400); }
    expect(run).not.toHaveBeenCalled();
    vi.advanceTimersByTime(SNAPSHOT_REFRESH_DEBOUNCE_MS);
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("마지막 편집 후 재계산 대기시간 < 푸시 디바운스(2.5초)", () => {
    const src = readFileSync(path.resolve(__dirname, "../../lib/cloud-sync/cloud-sync-provider.tsx"), "utf8");
    const push = Number(/AUTO_PUSH_DEBOUNCE_MS = (\d+)/.exec(src)![1]);
    expect(SNAPSHOT_REFRESH_DEBOUNCE_MS).toBeLessThan(push);
  });
  it("대기 중 언마운트(dispose) → 실행 0·타이머 0", () => {
    const run = vi.fn();
    const d = createEditDebouncer(800, run);
    d.onEdit(); d.dispose();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(5000);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("C16 정적 점검 — 렌더·effect에서 편집 신호·assetData 쓰기 추가 0", () => {
  const src = readFileSync(path.resolve(__dirname, "../asset-data-context.tsx"), "utf8");
  it("재계산 경로는 setAssetData·saveAssetData·notifyAssetUserEdit·fetch를 쓰지 않는다", () => {
    const a = src.indexOf("export function refreshTodayDailyRow");
    const b = src.indexOf("export function createEditDebouncer");
    const body = src.slice(a, src.indexOf("// 토스트가 일정 시간"));
    expect(a).toBeGreaterThan(0); expect(b).toBeGreaterThan(a);
    for (const w of ["setAssetData", "saveAssetData", "notifyAssetUserEdit", "fetch(", "monthlySnapshots", "lastVisitDate"]) expect(body.includes(w)).toBe(false);
  });
  it("S6·S7 열기·pull·복원(initAndSync·refreshData) 직후 재계산 표지를 비운다 — 원격 행을 덮어쓰지 않음", () => {
    expect(src.match(/lastSnapshotRef\.current = null/g)?.length).toBe(2);
    expect(src).toMatch(/lastSnapshotRef\.current = \{ date: todayStr, refMap \}/);
  });
});
