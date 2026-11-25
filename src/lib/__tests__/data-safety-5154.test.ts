// #306 [5.154] 데이터 안전 회귀 — ① 구버전 백업 → 현재 버전 복원 왕복, ② 구·신 저장 키 공존 로드 고정
// (③ fetchProfitRef dedup abort는 finance/__tests__/profit-ref-dedup.test.ts가 #141로 이미 고정 — 중복 작성 안 함)
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedPayload, buildExportPayload, getAssetData } from "../asset/asset-storage";
import { LEGACY_KEYS, STORAGE_KEYS, migrateStorageKeys } from "../local-storage";
import { g, memoryStorage } from "./physical-fixtures";

beforeEach(() => {
  g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never;
  g.localStorage = memoryStorage();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-25T03:00:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  delete g.window; delete g.localStorage;
});

// 4.x 초기 백업 형태: 래퍼 없는 assetData 단독, 이후 추가된 배열·필드(cash·loans·거래·nickname·currency·baseDate…)가 없다
const oldBareBackup = () => ({
  realEstate: [{ id: "re1", name: "아파트", type: "apartment", purchasePrice: 500_000_000, currentValue: 700_000_000, purchaseDate: "2020-01-01" }],
  stocks: [{ id: "s1", category: "domestic", name: "삼성전자", ticker: "005930", quantity: 10, averagePrice: 60000, currentPrice: 70000, purchaseDate: "2023-01-02" }],
  crypto: [{ id: "c1", name: "비트코인", symbol: "BTC", quantity: 0.5, averagePrice: 40_000_000, currentPrice: 90_000_000, purchaseDate: "2022-05-01" }],
  lastUpdated: "2024-02-01T00:00:00.000Z",
});

// 중간 버전 백업: 래퍼 { assetData, snapshots } + 거래·현금·대출, 현재 스키마에 없는 필드(legacyFlag)가 섞여 있다
const midWrappedBackup = () => ({
  assetData: {
    ...oldBareBackup(),
    cash: [{ id: "k1", type: "bank", name: "예금", balance: 3_000_000 }], // currency 없음 → KRW
    loans: [{ id: "l1", type: "credit", name: "신용", balance: 1_000_000, interestRate: 5, startDate: "2024-01-01" }],
    transactions: [
      { id: "tx_1", stockId: "s1", ticker: "005930", stockName: "삼성전자", type: "buy", quantity: 10, price: 60000, currency: "KRW", date: "2023-01-02", reflected: true, createdAt: "2023-01-02T00:00:00.000Z" },
      { id: "tx_2", stockId: "s1", ticker: "005930", stockName: "삼성전자", type: "sell", quantity: 2, price: 72000, currency: "KRW", date: "2024-01-02", reflected: false, createdAt: "2024-01-02T00:00:00.000Z", legacyFlag: "x" },
    ],
    cashTransactions: [{ id: "ctx_1", cashId: "k1", type: "deposit", amount: 500_000, date: "2024-01-05", reflected: true, createdAt: "2024-01-05T00:00:00.000Z" }],
    nickname: "홍",
  },
  snapshots: { daily: [{ date: "2024-01-31", netAsset: 100 }], monthly: [{ month: "2024-01", netAsset: 100 }] },
  profitBasis: "sameBusinessDay",
});

describe("① 구버전 백업 → 현재 버전 복원 왕복(#306)", () => {
  it("래퍼 없는 구 백업: 누락 배열은 [], currency는 KRW, nickname은 \"\"로 채우고 금액·수량은 그대로", () => {
    const r = applyImportedPayload(oldBareBackup());
    const d = getAssetData();
    expect(d.realEstate[0].currentValue).toBe(700_000_000);
    expect(d.stocks[0]).toMatchObject({ quantity: 10, averagePrice: 60000, currentPrice: 70000, currency: "KRW" });
    expect(d.crypto[0]).toMatchObject({ quantity: 0.5, currentPrice: 90_000_000 });
    for (const k of ["cash", "loans", "yearlyNetAssets", "transactions", "cashTransactions", "loanTransactions", "cryptoTransactions"] as const) {
      expect(d[k]).toEqual([]);
    }
    expect(d.nickname).toBe("");
    expect(d.physicalAssets).toBeUndefined(); // 구 백업엔 실물 키 없음 = 손대지 않음(빈 배열로 만들지 않음)
    expect(r.snapshotRestored).toBe(false);
  });

  it("중간 버전 래퍼 백업: 거래 수·금액 불변, 스냅샷·종가 기준·닉네임 복원, 미지 필드는 현행 스키마가 버린다(현행 고정)", () => {
    const r = applyImportedPayload(midWrappedBackup());
    const d = getAssetData();
    expect(d.transactions).toHaveLength(2);
    expect(d.transactions.map((t) => t.price)).toEqual([60000, 72000]);
    expect(d.transactions.map((t) => t.reflected)).toEqual([true, false]);
    expect(d.transactions[1]).not.toHaveProperty("legacyFlag"); // zod strip — 현행 동작 고정
    expect(d.cash[0]).toMatchObject({ balance: 3_000_000, currency: "KRW" });
    expect(d.cashTransactions).toHaveLength(1);
    expect(d.loans[0].balance).toBe(1_000_000);
    expect(d.nickname).toBe("홍");
    expect(r.snapshotRestored).toBe(true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.dailySnapshots)!)).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.monthlySnapshots)!)).toHaveLength(1);
    expect(localStorage.getItem(STORAGE_KEYS.profitBasis)).toContain("sameBusinessDay");
  });

  it("복원 → 현재 버전 내보내기 → 다시 복원해도 자산·거래·스냅샷이 같다(왕복 불변)", () => {
    applyImportedPayload(midWrappedBackup());
    const first = getAssetData();
    const exported = JSON.parse(JSON.stringify(buildExportPayload()));
    applyImportedPayload(exported);
    const second = getAssetData();
    const strip = (x: typeof first) => ({ ...x, lastUpdated: "" });
    expect(strip(second)).toEqual(strip(first));
    expect(exported.snapshots.daily).toHaveLength(1);
    expect(exported.nickname).toBe("홍");
  });

  it("검증 실패 백업은 기존 데이터를 건드리지 않는다(1단계 메모리 검증)", () => {
    applyImportedPayload(oldBareBackup());
    const before = localStorage.getItem(STORAGE_KEYS.assetData);
    expect(() => applyImportedPayload({ assetData: { realEstate: "깨짐" } })).toThrow();
    expect(localStorage.getItem(STORAGE_KEYS.assetData)).toBe(before);
  });
});

describe("② 구·신 저장 키 공존 로드(#306, 현행 동작 고정)", () => {
  const legacyRaw = JSON.stringify({ ...oldBareBackup(), stocks: [] });
  const currentRaw = JSON.stringify({ ...oldBareBackup() });

  it("신 키가 있으면 신 키 우선 — 구 키는 지우지도 덮지도 않고 남는다", () => {
    localStorage.setItem(LEGACY_KEYS.assetData, legacyRaw);
    localStorage.setItem(STORAGE_KEYS.assetData, currentRaw);
    migrateStorageKeys();
    expect(localStorage.getItem(STORAGE_KEYS.assetData)).toBe(currentRaw);
    expect(localStorage.getItem(LEGACY_KEYS.assetData)).toBe(legacyRaw);
    expect(getAssetData().stocks).toHaveLength(1);
  });

  it("신 키가 없으면 구 키를 신 키로 옮기고 구 키는 제거", () => {
    localStorage.setItem(LEGACY_KEYS.assetData, currentRaw);
    migrateStorageKeys();
    expect(localStorage.getItem(STORAGE_KEYS.assetData)).toBe(currentRaw);
    expect(localStorage.getItem(LEGACY_KEYS.assetData)).toBeNull();
    expect(getAssetData().stocks[0].quantity).toBe(10);
  });

  it("getAssetData는 구 키를 직접 읽지 않는다 — 마이그레이션 전엔 구 키만 있으면 빈 자산(현행 고정)", () => {
    localStorage.setItem(LEGACY_KEYS.assetData, currentRaw);
    expect(getAssetData().stocks).toEqual([]);
  });

  it("신 키 값이 빈 문자열이면 구 키를 채택(falsy 판정 — 현행 고정)", () => {
    localStorage.setItem(STORAGE_KEYS.assetData, "");
    localStorage.setItem(LEGACY_KEYS.assetData, currentRaw);
    migrateStorageKeys();
    expect(localStorage.getItem(STORAGE_KEYS.assetData)).toBe(currentRaw);
  });

  it("닉네임 단독 구 키 + 본 키 닉네임 공존: 본 키 닉네임이 있으면 단독 키는 남고 본 키 값 유지", () => {
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify({ ...oldBareBackup(), nickname: "신" }));
    localStorage.setItem(STORAGE_KEYS.nickname, "구");
    expect(getAssetData().nickname).toBe("신");
    expect(localStorage.getItem(STORAGE_KEYS.nickname)).toBe("구");
  });

  it("본 키 닉네임이 비면 단독 키 값을 본 키로 옮기고 단독 키 제거", () => {
    localStorage.setItem(STORAGE_KEYS.assetData, JSON.stringify(oldBareBackup()));
    localStorage.setItem(STORAGE_KEYS.nickname, "구");
    expect(getAssetData().nickname).toBe("구");
    expect(localStorage.getItem(STORAGE_KEYS.nickname)).toBeNull();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.assetData)!).nickname).toBe("구");
  });
});
