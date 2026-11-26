// #325(5.163) 거래소별 합계 — 묶음 규칙(완전 일치)·헤더(computeNetAsset·computeAssetCost)와 같은 모집단·표시 문자열 합 = 헤더 문자열(C150)
import { describe, expect, it } from "vitest";
import { computeExchangeTotals, exactExchangeLabel, UNASSIGNED_EXCHANGE_LABEL } from "../exchange-totals";
import { co, FIXTURE, header } from "./exchange-totals.fixture";
import { formatBrokerUnits, formatShareTenths } from "@/app/(main)/_components/views/detail/tabs/broker-totals-block";
import { formatCurrency } from "@/lib/number-utils";

const num = (s: string) => Number(s.replace(/[^0-9.-]/g, ""));

describe("exactExchangeLabel", () => {
  it("공백·대소문자를 뺀 완전 일치만 목록 라벨, 부분 일치는 아님", () => {
    expect(exactExchangeLabel("업비트")).toBe("업비트");
    expect(exactExchangeLabel(" 업 비트 ")).toBe("업비트");
    expect(exactExchangeLabel("UPBIT")).toBe("업비트");
    expect(exactExchangeLabel("okx")).toBe("OKX");
    expect(exactExchangeLabel("기타")).toBe("기타");
    expect(exactExchangeLabel("코인")).toBeUndefined();
    expect(exactExchangeLabel("업비트 원화")).toBeUndefined();
    expect(exactExchangeLabel("")).toBeUndefined();
  });
});

describe("computeExchangeTotals", () => {
  const rows = computeExchangeTotals(FIXTURE);

  it("묶음: 업비트 표기 3종은 한 묶음, `코인`≠`코인원`, `기타`는 지정 묶음, 미지정은 맨 아래 1묶음, 수량 0만 가진 거래소는 행 없음", () => {
    const names = rows.map((r) => r.name);
    expect(names.filter((n) => n === "업비트")).toHaveLength(1);
    expect(names).toContain("코인");
    expect(names).toContain("코인원");
    expect(names).toContain("기타");
    expect(names).not.toContain("크라켄");
    expect(names.filter((n) => n === UNASSIGNED_EXCHANGE_LABEL)).toHaveLength(1);
    expect(names.at(-1)).toBe(UNASSIGNED_EXCHANGE_LABEL);
    expect(rows.find((r) => r.name === "기타")!.unassigned).toBe(false);
    expect(names).toHaveLength(8);
  });

  it("코인 수: 같은 거래소의 같은 심볼(대소문자 무시)은 1개", () => {
    expect(rows.find((r) => r.name === "업비트")!.count).toBe(2); // BTC·btc·ETH
    expect(rows.at(-1)!.count).toBe(2); // ADA×2·TRX
  });

  it("정렬: 미지정을 뺀 행은 평가금 내림차순", () => {
    const v = rows.filter((r) => !r.unassigned).map((r) => r.valueUnits);
    expect(v).toEqual([...v].sort((a, b) => b - a));
  });

  it("현재가 0 코인만 가진 거래소도 행을 그린다(평가금 0, 손익은 원가만큼 음수, 비중 0.0%)", () => {
    const z = rows.find((r) => r.name === "코빗")!;
    expect(z.valueUnits).toBe(0);
    expect(z.profitUnits).toBeLessThan(0);
    expect(z.shareTenths).toBe(0);
  });

  it("C150: 행 표시 문자열의 합 = 헤더 표시 문자열(평가금·손익), 비중 합 100.0%", () => {
    const h = header(FIXTURE);
    const valueSum = rows.reduce((a, r) => a + num(formatBrokerUnits(r.valueUnits, 1)), 0);
    const profitSum = rows.reduce((a, r) => a + num(formatBrokerUnits(r.profitUnits, 1)), 0);
    expect(valueSum).toBe(num(formatCurrency(h.cryptoValue)));
    expect(profitSum).toBe(num(formatCurrency(Math.round(h.cryptoProfit))));
    expect(rows.reduce((a, r) => a + num(formatShareTenths(r.shareTenths)) * 10, 0)).toBeCloseTo(1000, 6);
    expect(rows.reduce((a, r) => a + r.shareTenths, 0)).toBe(1000);
  });

  it("C150: 반올림 경계(.5 근처) 묶음 여러 개에서도 합이 헤더와 같다", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const list = Array.from({ length: 7 }, (_, i) =>
        co({ id: `r${i}`, exchange: ["업비트", "빗썸", "코인원", "", "내 지갑"][(i * seed) % 5], symbol: `S${i}`, quantity: 0.5 + ((seed * 37 + i * 11) % 97) / 7, averagePrice: 1000.5 + i * seed, currentPrice: 999.5 + ((seed * 13 + i) % 53) / 3 }),
      );
      const r = computeExchangeTotals(list);
      const h = header(list);
      expect(r.reduce((a, x) => a + x.valueUnits, 0)).toBe(Math.round(h.cryptoValue));
      expect(r.reduce((a, x) => a + x.profitUnits, 0)).toBe(Math.round(h.cryptoProfit));
    }
  });

  it("원가 0이면 수익률 null, 코인 0건이면 빈 배열", () => {
    expect(computeExchangeTotals([co({ exchange: "업비트", averagePrice: 0 })])[0].profitRate).toBeNull();
    expect(computeExchangeTotals([])).toEqual([]);
  });
});
