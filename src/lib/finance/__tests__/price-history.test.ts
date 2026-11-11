// #157 종목 한 장 — 가격 이력 페이징·정규화(순수 함수 + 국내/해외 호출 mock)
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  buildPricePoints,
  collectPages,
  computeListedFrom,
  fetchPriceHistory,
  rangeStart,
  type RawRow,
} from "../price-history";

// 내림차순 일별 행 n개를 end(포함)부터 생성
function descRows(end: string, n: number, base = 100): RawRow[] {
  return Array.from({ length: n }, (_, i) => ({ d: addDays(end, -i), c: base + i }));
}

describe("rangeStart", () => {
  it("1년 = 365일 전, 5년 = 5년 전", () => {
    expect(rangeStart("2026-11-11", "1y")).toBe("2025-11-11");
    expect(rangeStart("2026-11-11", "5y")).toBe("2021-11-11");
  });
});

describe("buildPricePoints", () => {
  it("오름차순·날짜 중복 제거·c<=0 제외·시작일 이전 제외", () => {
    const pts = buildPricePoints(
      [
        { d: "2026-01-03", c: 3 },
        { d: "2026-01-01", c: 1 },
        { d: "2026-01-02", c: 0 },
        { d: "2026-01-03", c: 9 },
        { d: "2025-12-31", c: 5 },
        { d: "bad", c: 5 },
      ],
      "2026-01-01",
    );
    expect(pts).toEqual([
      { d: "2026-01-01", c: 1 },
      { d: "2026-01-03", c: 3 },
    ]);
  });
});

describe("collectPages 페이징", () => {
  it("250행 = 3회 호출, 종료일은 직전 회차 가장 오래된 날짜 − 1일", async () => {
    const ends: string[] = [];
    const total = 250;
    const fetchPage = vi.fn(async (end: string) => {
      ends.push(end);
      const done = ends.length - 1;
      const n = Math.max(0, Math.min(100, total - done * 100));
      return descRows(end, n);
    });
    const r = await collectPages(fetchPage, "2026-11-11", "2020-01-01");
    expect(fetchPage).toHaveBeenCalledTimes(3);
    expect(ends[1]).toBe(addDays("2026-11-11", -99 - 1));
    expect(r?.rows).toHaveLength(250);
    expect(r?.shortPage).toBe(true);
  });

  it("시작일에 닿으면 100행이어도 중단", async () => {
    const fetchPage = vi.fn(async (end: string) => descRows(end, 100));
    const r = await collectPages(fetchPage, "2026-11-11", addDays("2026-11-11", -50));
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(r?.shortPage).toBe(false);
  });

  it("회차 상한 4에서 멈춤(무한 루프 방지)", async () => {
    const fetchPage = vi.fn(async (end: string) => descRows(end, 100));
    await collectPages(fetchPage, "2026-11-11", "1990-01-01");
    expect(fetchPage).toHaveBeenCalledTimes(4);
  });

  it("호출 실패(null)면 전체 null", async () => {
    const fetchPage = vi.fn().mockResolvedValueOnce(descRows("2026-11-11", 100)).mockResolvedValueOnce(null);
    expect(await collectPages(fetchPage, "2026-11-11", "1990-01-01")).toBeNull();
  });
});

describe("computeListedFrom (C76 ⑤ 상장 1년 미만)", () => {
  it("짧은 회차로 끝났고 첫 점이 시작일보다 10일 넘게 늦으면 첫 점 날짜", () => {
    expect(computeListedFrom([{ d: "2026-03-02", c: 1 }], "2025-11-11", true)).toBe("2026-03-02");
  });
  it("시작일 근처(주말·휴일)면 없음, 회차 상한으로 끝났으면 없음", () => {
    expect(computeListedFrom([{ d: "2025-11-13", c: 1 }], "2025-11-11", true)).toBeUndefined();
    expect(computeListedFrom([{ d: "2026-03-02", c: 1 }], "2025-11-11", false)).toBeUndefined();
  });
});

describe("fetchPriceHistory KIS 호출", () => {
  afterEach(() => vi.unstubAllGlobals());
  const base = { todayStr: "2026-11-11", accessToken: "t", appKey: "k", appSecret: "s" };

  it("국내 1년: 일봉(D)·수정주가(ORG_ADJ_PRC=0)·시작/종료일 전달, 종가 정규화", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        const out = Array.from({ length: 30 }, (_, i) => ({
          stck_bsop_date: addDays("2026-11-10", -i).replace(/-/g, ""),
          stck_clpr: String(70000 + i),
        }));
        return { ok: true, json: async () => ({ rt_cd: "0", output2: out }) };
      }),
    );
    const r = await fetchPriceHistory({ ...base, ticker: "005930", market: "kr", range: "1y" });
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("FID_PERIOD_DIV_CODE=D");
    expect(urls[0]).toContain("FID_ORG_ADJ_PRC=0");
    expect(urls[0]).toContain("FID_INPUT_DATE_1=20251111");
    expect(urls[0]).toContain("FID_INPUT_DATE_2=20261111");
    expect(r?.currency).toBe("KRW");
    expect(r?.points).toHaveLength(30);
    expect(r!.points[0].d < r!.points[29].d).toBe(true);
    expect(r?.listedFrom).toBe("2026-10-12");
  });

  it("해외 5년: 주봉(GUBN=1)·MODP=1·NCNT 없음, 알려진 거래소로 호출, 달러", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        return { ok: true, json: async () => ({ rt_cd: "0", output2: [{ xymd: "20261106", clos: "200.5" }] }) };
      }),
    );
    const r = await fetchPriceHistory({ ...base, ticker: "AAPL", market: "us", range: "5y" });
    expect(urls[0]).toContain("GUBN=1");
    expect(urls[0]).toContain("MODP=1");
    expect(urls[0]).not.toContain("NCNT");
    expect(urls[0]).toContain("EXCD=NAS");
    expect(r?.currency).toBe("USD");
    expect(r?.interval).toBe("W");
    expect(r?.points).toEqual([{ d: "2026-11-06", c: 200.5 }]);
  });

  it("D1 마스터 NAS·실제 NYS: NAS 실패 시 NYS로 폴백하고 이후 회차는 NYS 고정", async () => {
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        urls.push(url);
        if (url.includes("EXCD=NAS")) return { ok: true, json: async () => ({ rt_cd: "1", msg1: "no data" }) };
        const n = url.includes("BYMD=20261111") ? 100 : 5;
        const out = Array.from({ length: n }, (_, i) => ({ xymd: addDays(url.includes("BYMD=20261111") ? "2026-11-10" : "2026-08-01", -i).replace(/-/g, ""), clos: "60" }));
        return { ok: true, json: async () => ({ rt_cd: "0", output2: out }) };
      }),
    );
    const r = await fetchPriceHistory({ ...base, ticker: "KO", market: "us", range: "1y" });
    expect(r?.points.length).toBeGreaterThan(100);
    expect(urls.filter((u) => u.includes("EXCD=NAS"))).toHaveLength(1);
    expect(urls.slice(1).every((u) => u.includes("EXCD=NYS"))).toBe(true);
  });

  it("R3 해외 모든 거래소가 오류 없이 빈 응답이면 빈 시세(null 아님), 하나라도 오류면 null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ rt_cd: "0", output2: [] }) })));
    const empty = await fetchPriceHistory({ ...base, ticker: "ZZZZQ", market: "us", range: "1y" });
    expect(empty?.points).toEqual([]);
    let n = 0;
    vi.stubGlobal("fetch", vi.fn(async () => (++n === 2 ? { ok: false, json: async () => ({}) } : { ok: true, json: async () => ({ rt_cd: "0", output2: [] }) })));
    expect(await fetchPriceHistory({ ...base, ticker: "ZZZZQ", market: "us", range: "1y" })).toBeNull();
  });

  it("호출 실패(HTTP 500) → null", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect(await fetchPriceHistory({ ...base, ticker: "005930", market: "kr", range: "1y" })).toBeNull();
  });
});
