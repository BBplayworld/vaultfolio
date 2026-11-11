import { describe, expect, it } from "vitest";
import { normalizeEtfComponents, parseEtfCode } from "../etf-components";

const row = (c: unknown, n: unknown, w: unknown) => ({ stck_shrn_iscd: c, hts_kor_isnm: n, etf_cnfg_issu_rlim: w });

describe("parseEtfCode", () => {
  it("마스터의 ETF 코드만 통과(대문자 정규화), 그 외 null", () => {
    expect(parseEtfCode("069500")).toBe("069500");
    expect(parseEtfCode(" 122630 ")).toBe("122630");
    expect(parseEtfCode("005930")).toBeNull(); // 일반 종목
    expect(parseEtfCode("0069500")).toBeNull();
    expect(parseEtfCode("AAPL")).toBeNull();
    expect(parseEtfCode(null)).toBeNull();
    expect(parseEtfCode("069500&x=1")).toBeNull();
  });
});

describe("normalizeEtfComponents", () => {
  it("문자열 숫자·콤마 비중을 숫자로, 비중 합·구성 수·기준일을 계산", () => {
    const r = normalizeEtfComponents(
      "069500",
      { etf_cnfg_issu_cnt: "2", stck_bsop_date: "20261110" },
      [row("005930", " 삼성전자 ", "1,234"), row("000660", "SK하이닉스", "8.766")],
    )!;
    expect(r.components[0]).toEqual({ code: "005930", name: "삼성전자", weight: 1234 });
    expect(r.weightSum).toBe(1242.77);
    expect(r.count).toBe(2);
    expect(r.asOf).toBe("2026-11-10");
    expect(r.complete).toBe(true);
  });
  it("영숫자 신규 단축코드 유지, 비중 비숫자·음수 행 제외", () => {
    const r = normalizeEtfComponents("069500", {}, [row("0091p0", "신규", "5"), row("1", "x", "abc"), row("2", "y", "-1")])!;
    expect(r.components).toHaveLength(1);
    expect(r.components[0].code).toBe("0091P0");
    expect(r.count).toBeNull();
    expect(r.asOf).toBeNull();
    expect(r.complete).toBe(true);
  });
  it("선언 구성 수와 행 수가 다르면 complete=false", () => {
    expect(normalizeEtfComponents("069500", { etf_cnfg_issu_cnt: "10" }, [row("005930", "a", "1")])!.complete).toBe(false);
  });
  it("output2 없음·빈 배열·유효 행 0은 null", () => {
    expect(normalizeEtfComponents("069500", {}, undefined)).toBeNull();
    expect(normalizeEtfComponents("069500", {}, [])).toBeNull();
    expect(normalizeEtfComponents("069500", {}, [row("a", "b", "")])).toBeNull();
  });
});
