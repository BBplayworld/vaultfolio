import { afterEach, describe, expect, it, vi } from "vitest";
import type { Stock } from "@/types/asset";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));
vi.mock("@/lib/analytics/ga", () => ({ track: vi.fn() }));
vi.mock("../classification-store", () => ({
  getAllClassifications: () => ({}),
  upsertClassifications: vi.fn(),
  SECTOR_ENUM: [],
  STOCK_TYPE_ENUM: [],
  STOCK_TYPE_PROMPT_VERSION: 2,
}));

import { fetchAndStoreClassifications, type ClassifyProgress } from "../fetch-classifications";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("D5 분류 진행 알림 — 요청 시작 즉시 '분류 중'", () => {
  it("fetch 응답(첫 chunk) 전에 이미 done 0/total 알림이 나가 타일이 폴백 문구를 보인다", async () => {
    vi.stubGlobal("window", {});
    let resolveFetch!: (r: unknown) => void;
    vi.stubGlobal("fetch", vi.fn(() => new Promise((r) => { resolveFetch = r; })));
    const seen: ClassifyProgress[] = [];
    const stocks = [{ ticker: "AAPL", name: "애플", category: "foreign", currency: "USD" }, { ticker: "005930", name: "삼성", category: "domestic" }] as unknown as Stock[];
    const p = fetchAndStoreClassifications(stocks, (x) => seen.push(x));
    // 응답 전: 이미 진행 중 표시
    expect(seen).toEqual([{ done: 0, total: 2 }]);
    resolveFetch({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ classifications: {} }) });
    await p;
    expect(seen[seen.length - 1]).toEqual({ done: 2, total: 2 });
  });
});
