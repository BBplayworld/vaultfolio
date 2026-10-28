// 동기화 pull 월 스냅샷 월 단위 병합(qa B) — 구버전(v4.33, 올해분만 보존) 기기가 섞여 있어도
// 신버전(v4.34, 13개월 보존) 기기의 월 스냅샷이 줄지 않음을 push→pull→저장→push 순환으로 증명한다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedPayload, buildExportPayload, mergeMonthlySnapshots, saveAssetData } from "../asset/asset-storage";
import { pruneMonthlySnapshots, shiftMonth } from "../report/settlement";
import { STORAGE_KEYS } from "../local-storage";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

// Object.keys(localStorage)로 키를 훑는 clearAssetData까지 동작하도록 데이터는 own 속성, 메서드는 비열거
function memoryStorage(): Storage {
  const s = {} as Record<string, string>;
  const def = (k: string, value: unknown) => Object.defineProperty(s, k, { value, enumerable: false });
  def("getItem", (k: string) => (Object.prototype.hasOwnProperty.call(s, k) ? s[k] : null));
  def("setItem", (k: string, v: string) => { s[k] = String(v); });
  def("removeItem", (k: string) => { delete s[k]; });
  def("clear", () => { for (const k of Object.keys(s)) delete s[k]; });
  def("key", (i: number) => Object.keys(s)[i] ?? null);
  Object.defineProperty(s, "length", { get: () => Object.keys(s).length, enumerable: false });
  return s as unknown as Storage;
}

const g = globalThis as unknown as { window?: unknown; localStorage?: Storage };
const onDevice = (st: Storage) => { g.localStorage = st; };
const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "",
});
const enriched = (month: string, netAsset = 100_000_000): MonthlyAssetSnapshot => ({
  month, date: `${month}-28`, netAsset, financialAsset: netAsset,
  breakdown: { realEstate: 0, stocks: 0, crypto: 0, cash: netAsset, loans: 0, tenantDeposit: 0 },
  fx: { USD: 1400, JPY: 900 }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: netAsset, stock: 0, crypto: 0, realEstate: 0 },
});
const readMonthly = (): MonthlyAssetSnapshot[] => JSON.parse(localStorage.getItem(STORAGE_KEYS.monthlySnapshots) ?? "[]");
const writeMonthly = (m: MonthlyAssetSnapshot[]) => localStorage.setItem(STORAGE_KEYS.monthlySnapshots, JSON.stringify(m));

// 두 버전의 saveSnapshots 월별 단계를 그대로 옮긴 것(v4.34 asset-data-context.tsx, v4.33 = main)
const saveV434 = (today: string) => {
  const currentMonth = today.slice(0, 7);
  const kept = pruneMonthlySnapshots(readMonthly(), currentMonth).filter((s) => s.month !== currentMonth);
  writeMonthly([...kept, { ...enriched(currentMonth), date: today }].sort((a, b) => a.month.localeCompare(b.month)));
};
const saveV433 = (today: string) => {
  const currentMonth = today.slice(0, 7);
  const kept = readMonthly().filter((s) => s.month.startsWith(today.slice(0, 4)) && s.month !== currentMonth);
  writeMonthly([...kept, { ...enriched(currentMonth), date: today }].sort((a, b) => a.month.localeCompare(b.month)));
};
let server: Record<string, unknown> = {};
const push = (st: Storage) => { onDevice(st); server = JSON.parse(JSON.stringify(buildExportPayload())); };
const pullV434 = (st: Storage) => { onDevice(st); applyImportedPayload(server, { keepLocalSnapshots: true, syncedIds: null }); };
// v4.33 pull = 수신 월 배열로 통째 교체
const pullV433 = (st: Storage) => {
  onDevice(st);
  const m = (server.snapshots as { monthly?: MonthlyAssetSnapshot[] } | undefined)?.monthly;
  if (m?.length) writeMonthly(m);
};
const setToday = (d: string) => vi.setSystemTime(new Date(`${d}T03:00:00Z`)); // KST 12:00

describe("mergeMonthlySnapshots — 월 키 합집합", () => {
  it("로컬 전용 달 보존, 같은 달은 수신값, 13개월 초과분 제거", () => {
    const local = [enriched("2025-10", 1), enriched("2025-11", 2), enriched("2026-10", 3)];
    const incoming = [enriched("2026-10", 30), enriched("2026-11", 40)];
    const r = mergeMonthlySnapshots(local, incoming, "2026-11");
    expect(r.map((s) => [s.month, s.netAsset])).toEqual([["2025-11", 2], ["2026-10", 30], ["2026-11", 40]]);
  });
  it("같은 달 수신값에 상세(breakdown)가 없고 로컬에 있으면 로컬 유지, 둘 다 있으면 수신값", () => {
    const legacy: MonthlyAssetSnapshot = { month: "2026-09", netAsset: 99, financialAsset: 99 };
    expect(mergeMonthlySnapshots([enriched("2026-09", 1)], [legacy], "2026-10")[0].netAsset).toBe(1);
    expect(mergeMonthlySnapshots([legacy], [enriched("2026-09", 2)], "2026-10")[0].netAsset).toBe(2);
    expect(mergeMonthlySnapshots([enriched("2026-09", 1)], [enriched("2026-09", 2)], "2026-10")[0].netAsset).toBe(2);
  });
  it("형식이 깨진 항목은 버린다", () => {
    expect(mergeMonthlySnapshots([{ foo: 1 }, null], [enriched("2026-10")], "2026-10").map((s) => s.month)).toEqual(["2026-10"]);
  });
});

describe("구버전 기기 혼재 순환 — A(v4.34) 데이터 감소 0", () => {
  let A: Storage; let B: Storage;
  beforeEach(() => {
    vi.useFakeTimers();
    g.window = globalThis;
    A = memoryStorage(); B = memoryStorage();
    for (const st of [A, B]) { onDevice(st); saveAssetData(emptyData()); }
    server = {};
  });
  afterEach(() => { vi.useRealTimers(); delete g.window; delete g.localStorage; });

  it("2027-01 경계: B가 올해분만 남겨 push해도 A는 13개월을 유지하고, 다음 push로 서버도 복원된다", () => {
    // A: 2025-12 ~ 2026-12 (13개월, 상세 포함). B: 올해분 + 서버 동기화 상태
    setToday("2026-12-28");
    onDevice(A); writeMonthly(Array.from({ length: 13 }, (_, i) => enriched(shiftMonth("2025-12", i))));
    push(A); pullV433(B);
    const countsA: number[] = [];
    let prev = 13;
    // 1월 2일 B 첫 저장(v4.33이 전년분 삭제) → B 편집 push → A pull → A 저장 → A push → B pull → 반복
    for (const day of ["2027-01-02", "2027-01-09", "2027-01-31", "2027-02-03"]) {
      setToday(day);
      onDevice(B); saveV433(day); push(B);
      pullV434(A); onDevice(A); saveV434(day);
      const m = readMonthly();
      countsA.push(m.length);
      // 13개월 창 안의 달은 하나도 사라지지 않는다(창 밖으로 밀려난 달만 롤링으로 빠짐)
      const cutoff = shiftMonth(day.slice(0, 7), -12);
      for (const month of Array.from({ length: 13 }, (_, i) => shiftMonth("2025-12", i)).filter((x) => x >= cutoff)) {
        expect(m.find((s) => s.month === month)?.breakdown).toBeDefined();
      }
      expect(m.length).toBeGreaterThanOrEqual(Math.min(prev, 13));
      prev = m.length;
      push(A); pullV433(B);
      // 서버에도 A의 13개월이 다시 올라간다
      expect(((server.snapshots as { monthly: MonthlyAssetSnapshot[] }).monthly).length).toBe(m.length);
    }
    expect(countsA).toEqual([13, 13, 13, 13]);
  });

  it("연중(11월): B 경유로 A의 전년 달(2025-11·12)이 지워지지 않는다", () => {
    setToday("2026-11-05");
    onDevice(A); writeMonthly(Array.from({ length: 13 }, (_, i) => enriched(shiftMonth("2025-11", i))));
    push(A); pullV433(B);
    onDevice(B); saveV433("2026-11-05"); push(B);
    pullV434(A);
    onDevice(A);
    const months = readMonthly().map((s) => s.month);
    expect(months).toContain("2025-11");
    expect(months).toContain("2025-12");
    expect(months.length).toBe(13);
  });

  it("파일 가져오기(keepLocalSnapshots=false)는 기존처럼 교체", () => {
    setToday("2026-11-05");
    onDevice(A); writeMonthly([enriched("2025-11"), enriched("2026-10")]);
    applyImportedPayload({ assetData: emptyData(), snapshots: { daily: [], monthly: [enriched("2026-11")] } });
    expect(readMonthly().map((s) => s.month)).toEqual(["2026-11"]);
  });

  it("수신 월 배열이 비면 로컬 유지(기존 동작)", () => {
    setToday("2026-11-05");
    onDevice(A); writeMonthly([enriched("2025-11"), enriched("2026-10")]);
    applyImportedPayload({ assetData: emptyData() }, { keepLocalSnapshots: true, syncedIds: null });
    expect(readMonthly().map((s) => s.month)).toEqual(["2025-11", "2026-10"]);
  });
});
