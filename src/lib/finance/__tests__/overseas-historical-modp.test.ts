// #150 fetchOverseasHistoricalPrice MODP 인자 — 기본 0(미수정), adjusted=true면 1
import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOverseasHistoricalPrice } from "../finance-service";

afterEach(() => { vi.unstubAllGlobals(); });

const stub = () => {
  const f = vi.fn(async (_url: string) => new Response(JSON.stringify({ rt_cd: "0", output2: [{ xymd: "20251231", clos: "190.5" }] }), { status: 200 }));
  vi.stubGlobal("fetch", f);
  return f;
};

describe("fetchOverseasHistoricalPrice MODP", () => {
  it("기본은 MODP=0", async () => {
    const f = stub();
    expect(await fetchOverseasHistoricalPrice("AAPL", "2025-12-31", "t", "k", "s", "NAS")).toEqual({ price: 190.5, date: "2025-12-31" });
    expect(String(f.mock.calls[0][0])).toContain("MODP=0");
  });
  it("adjusted=true는 MODP=1", async () => {
    const f = stub();
    await fetchOverseasHistoricalPrice("AAPL", "2025-12-31", "t", "k", "s", "NAS", true);
    expect(String(f.mock.calls[0][0])).toContain("MODP=1");
  });
});
