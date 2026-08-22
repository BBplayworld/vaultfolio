import { describe, it, expect } from "vitest";
import { reconcileAdditiveMerge, collectAssetIds } from "../asset/asset-storage";
import type { AssetData, Cash, Stock } from "@/types/asset";

// 클라우드 pull 병합 회귀 — 로컬에만 있는 항목이 "아직 안 올린 신규 추가"인지 "원격에서 삭제된
// 것"인지는 부재만으로 구분할 수 없다(삭제가 tombstone 없이 배열 제거라서). 마지막으로 서버와
// 맞춰진 항목 키 집합(syncedIds)을 기준점으로 3-way 판별한다:
//   - 기준점에 없음 → 신규 추가 → 보존 (다른 기기가 동시에 push해도 내 추가분이 안 사라짐)
//   - 기준점에 있음 → 원격에서 삭제됨 → 존중 (2026-08 P0: 삭제가 되살아나던 버그)

const emptyData = (): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-08-04T00:00:00.000Z", nickname: "",
});

const cash = (id: string, balance: number): Cash => ({
  id, name: `계좌 ${id}`, type: "bank", balance, currency: "KRW",
});

const stock = (id: string): Stock => ({
  id, category: "domestic", name: `종목 ${id}`, ticker: "005930",
  quantity: 10, averagePrice: 70_000, currentPrice: 75_000, currency: "KRW",
  purchaseDate: "2026-07-01",
});

describe("reconcileAdditiveMerge — 기준점(syncedIds) 3-way 판별", () => {
  it("기준점에 없는 로컬 항목은 신규 추가로 보고 되살린다 — A기기 추가분과 공존", () => {
    // B가 막 추가한 c-local은 아직 서버에 올라간 적 없다(기준점에 없음).
    const before = { ...emptyData(), cash: [cash("c-shared", 1_000_000), cash("c-local", 86_000_000)] };
    const after = { ...emptyData(), cash: [cash("c-shared", 1_000_000), cash("c-remote", 5_000_000)] };
    const syncedIds = new Set(["c-shared"]); // c-local은 아직 미동기화
    const { data, changed } = reconcileAdditiveMerge(before, after, syncedIds);
    expect(changed).toBe(true);
    expect(data.cash.map((c) => c.id).sort()).toEqual(["c-local", "c-remote", "c-shared"]);
    expect(data.cash.find((c) => c.id === "c-local")?.balance).toBe(86_000_000);
    expect(data.cash.find((c) => c.id === "c-remote")?.balance).toBe(5_000_000);
  });

  it("기준점에 있던 항목이 원격에서 사라졌으면 삭제로 존중한다 — 부활 금지(P0 회귀)", () => {
    // A가 X를 삭제하고 push → 원격엔 Y만. B의 로컬엔 아직 X가 있지만 X는 이전에 동기화됐던 항목.
    const before = { ...emptyData(), stocks: [stock("X"), stock("Y")] };
    const after = { ...emptyData(), stocks: [stock("Y")] };
    const syncedIds = new Set(["X", "Y"]); // 둘 다 예전에 서버와 맞춰졌음
    const { data, changed } = reconcileAdditiveMerge(before, after, syncedIds);
    expect(changed).toBe(false);
    expect(data.stocks.map((s) => s.id)).toEqual(["Y"]); // X가 되살아나지 않는다
  });

  it("같은 pull에서 신규 보존과 삭제 존중이 동시에 올바르게 동작한다", () => {
    // B는 오프라인에서 new를 추가했고, 그 사이 A는 old를 삭제했다.
    const before = { ...emptyData(), stocks: [stock("old"), stock("keep"), stock("new")] };
    const after = { ...emptyData(), stocks: [stock("keep")] };
    const syncedIds = new Set(["old", "keep"]); // new만 미동기화
    const { data, changed } = reconcileAdditiveMerge(before, after, syncedIds);
    expect(changed).toBe(true);
    expect(data.stocks.map((s) => s.id).sort()).toEqual(["keep", "new"]); // old는 삭제, new는 보존
  });

  it("같은 id를 양쪽이 다르게 수정한 경우 원격 값이 유지된다 — 추가 전용 병합이라 충돌은 다루지 않는다", () => {
    const before = { ...emptyData(), cash: [cash("c1", 1_000_000)] };
    const after = { ...emptyData(), cash: [cash("c1", 9_999_999)] };
    const { data, changed } = reconcileAdditiveMerge(before, after, new Set(["c1"]));
    expect(changed).toBe(false);
    expect(data.cash).toHaveLength(1);
    expect(data.cash[0].balance).toBe(9_999_999);
  });

  it("되살릴 항목이 없으면 changed=false로 원격 객체를 그대로 반환한다(불필요한 재-push 방지)", () => {
    const before = { ...emptyData(), stocks: [stock("s1")] };
    const after = { ...emptyData(), stocks: [stock("s1"), stock("s2")] };
    const { data, changed } = reconcileAdditiveMerge(before, after, new Set(["s1"]));
    expect(changed).toBe(false);
    expect(data).toBe(after); // 동일 참조 — 새 객체를 만들지 않음
  });

  it("여러 자산 종류·거래내역에 걸쳐 동시에 되살린다", () => {
    const before = {
      ...emptyData(),
      stocks: [stock("s-local")],
      cash: [cash("c-local", 100)],
      transactions: [{ id: "t-local", stockId: "s-local", ticker: "005930", stockName: "삼성전자", type: "buy" as const, quantity: 1, price: 70_000, currency: "KRW" as const, date: "2026-08-04", reflected: true, createdAt: "2026-08-04T00:00:00.000Z" }],
    };
    const after = { ...emptyData(), stocks: [stock("s-remote")] };
    const { data, changed } = reconcileAdditiveMerge(before, after, new Set(["s-remote"]));
    expect(changed).toBe(true);
    expect(data.stocks.map((s) => s.id).sort()).toEqual(["s-local", "s-remote"]);
    expect(data.cash.map((c) => c.id)).toEqual(["c-local"]);
    expect(data.transactions.map((t) => t.id)).toEqual(["t-local"]);
  });

  it("yearlyNetAssets는 year 기준으로 판별한다 — 미동기화 연도는 보존, 동기화됐던 연도는 삭제 존중", () => {
    const before = { ...emptyData(), yearlyNetAssets: [{ year: 2023, netAsset: 500 }, { year: 2024, netAsset: 1_000 }, { year: 2025, netAsset: 2_000 }] };
    const after = { ...emptyData(), yearlyNetAssets: [{ year: 2025, netAsset: 9_000 }] };
    const syncedIds = new Set(["year:2023", "year:2025"]); // 2024만 미동기화(로컬 신규)
    const { data, changed } = reconcileAdditiveMerge(before, after, syncedIds);
    expect(changed).toBe(true);
    expect(data.yearlyNetAssets.map((y) => y.year).sort()).toEqual([2024, 2025]); // 2023은 삭제 존중
    expect(data.yearlyNetAssets.find((y) => y.year === 2025)?.netAsset).toBe(9_000); // 원격 우선
  });

  it("로컬이 비어있으면(신규 기기 첫 연결) 원격 데이터를 그대로 쓴다", () => {
    const before = emptyData();
    const after = { ...emptyData(), cash: [cash("c1", 500)], stocks: [stock("s1")] };
    const { data, changed } = reconcileAdditiveMerge(before, after, new Set());
    expect(changed).toBe(false);
    expect(data).toBe(after);
  });

  it("기준점이 비어 있으면(첫 동기화) 로컬 항목이 전부 신규로 간주돼 보존된다", () => {
    // 기준점이 아예 없는 경우(null)는 호출측이 병합 자체를 건너뛴다 — 여기선 빈 Set 의미를 고정.
    const before = { ...emptyData(), cash: [cash("c1", 100)] };
    const after = { ...emptyData(), cash: [cash("c2", 200)] };
    const { data, changed } = reconcileAdditiveMerge(before, after, new Set());
    expect(changed).toBe(true);
    expect(data.cash.map((c) => c.id).sort()).toEqual(["c1", "c2"]);
  });
});

describe("collectAssetIds", () => {
  it("자산 5종·거래 4종의 id와 yearlyNetAssets의 year 키를 모두 수집한다", () => {
    const data: AssetData = {
      ...emptyData(),
      stocks: [stock("s1")],
      cash: [cash("c1", 1)],
      yearlyNetAssets: [{ year: 2025, netAsset: 1 }],
    };
    expect(collectAssetIds(data).sort()).toEqual(["c1", "s1", "year:2025"]);
  });

  it("병합 판별과 같은 키 규칙을 쓴다 — 수집한 키로 판별하면 그 항목은 삭제로 존중된다", () => {
    // collectAssetIds가 만든 키가 reconcileAdditiveMerge의 판별 키와 어긋나면 삭제 존중이 깨진다.
    const local: AssetData = { ...emptyData(), stocks: [stock("s1")], yearlyNetAssets: [{ year: 2025, netAsset: 1 }] };
    const syncedIds = new Set(collectAssetIds(local));
    const { data, changed } = reconcileAdditiveMerge(local, emptyData(), syncedIds);
    expect(changed).toBe(false);
    expect(data.stocks).toEqual([]);
    expect(data.yearlyNetAssets).toEqual([]);
  });
});
