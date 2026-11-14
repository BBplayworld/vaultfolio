import { describe, it, expect, vi, beforeEach } from "vitest";

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("../cron-run", async (orig) => ({ ...(await orig<typeof import("../cron-run")>()), loadPushQuotes: load }));

import { buildTestPayloads, PUSH_PREVIEW_UNMET } from "../test-payloads";
import { nearestTaxMessage } from "../message";

const US = [{ label: "S&P 500", kind: "index", rate: 0.8, price: 1 }];
const KR = [{ label: "코스피", kind: "index", rate: 0.5, price: 1 }, { label: "환율", kind: "fx", rate: 0.4, price: 1385 }];
const NOW = Date.UTC(2026, 10, 14, 3, 0); // KST 2026-11-14

beforeEach(() => {
  load.mockReset();
  load.mockResolvedValue({ us: US, kr: KR, status: {} });
});

describe("buildTestPayloads", () => {
  it("고른 종류마다 1건씩 — m이 운영 도착 화면 키와 같다", async () => {
    const r = await buildTestPayloads(["morning", "kr", "settle", "tax"], "daily", NOW);
    expect(r.map((p) => p.m)).toEqual(["morning", "kr", "settle", "tax"]);
    expect(r[0].b).toContain("미국 S&P 500");
    expect(r[1].b).toContain("환율 1,385원");
  });
  it("고르지 않은 종류·시세 없는 시장 종류는 생략, 시세 조회는 필요할 때만", async () => {
    expect((await buildTestPayloads(["settle"], "daily", NOW)).map((p) => p.m)).toEqual(["settle"]);
    expect(load).not.toHaveBeenCalled();
    load.mockResolvedValue({ us: [], kr: [], status: { kis: "no-token" } });
    expect((await buildTestPayloads(["morning", "kr", "tax"], "daily", NOW)).map((p) => p.m)).toEqual(["tax"]);
  });
  it("pm2 조건 미충족이면 제목 앞에 미리보기 표시로 1건, 충족이면 표시 없음", async () => {
    const r = await buildTestPayloads(["kr"], "pm2", NOW);
    expect(r).toHaveLength(1);
    expect(r[0].t.startsWith(PUSH_PREVIEW_UNMET)).toBe(true);
    load.mockResolvedValue({ us: [], kr: [{ label: "코스피", kind: "index", rate: 2.5, price: 1 }], status: {} });
    expect((await buildTestPayloads(["kr"], "pm2", NOW))[0].t.startsWith("[")).toBe(false);
  });
  it("nearestTaxMessage — 가까운 다음 일정, 연말 이후는 다음 해 첫 일정", () => {
    expect(nearestTaxMessage("2026-11-14").t).toContain("연금저축");
    expect(nearestTaxMessage("2026-12-30").t).toContain("5월");
  });
  it("국내 장 마감 제목은 직전 영업일 종가 날짜(토요일 호출 → 금요일)", async () => {
    const r = await buildTestPayloads(["kr"], "daily", NOW);
    expect(r[0].t).toBe("11/13 국내 종가");
  });
});
