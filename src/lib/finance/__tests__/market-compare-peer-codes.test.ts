// #132 K1 — 생성 목록 kr-kospi-peer-codes.ts가 마스터 JSON에서 다시 만든 목록과 같은지(드리프트 방지).
// 재생성: KR_PEER_WRITE=1 npx vitest run src/lib/finance/__tests__/market-compare-peer-codes.test.ts (src/lib/data/README.md)
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import path from "node:path";
import stockMaster from "@/lib/data/kr-stock-master.json";
import etfMaster from "@/lib/data/kr-etf-master.json";
import { KR_KOSPI_PEER_CODES } from "@/lib/data/kr-kospi-peer-codes";
import { deriveKospiPeerCodes, etfFundType, loadKospiPeerCodes, type KrMasterRow } from "../market-compare";

const derived = deriveKospiPeerCodes(stockMaster as KrMasterRow[], etfMaster as KrMasterRow[]);

const HEADER = `// 자동 생성 — 직접 고치지 않는다. 재생성 절차: src/lib/data/README.md (#132 K1)
// 코스피와 비교하는 국내 종목코드: 개별주 전부(KOSPI·KOSDAQ·KOSDAQ GLOBAL·KONEX) + 기초시장 '국내' 주식형 ETF(주식·주식-파생형·주식형).
// 비교 화면·진입 글줄에서만 동적 import(첫 화면 번들 제외). 규칙 정본: market-compare.ts deriveKospiPeerCodes
`;

describe("K1 국내 주식형 판별 목록", () => {
  if (process.env.KR_PEER_WRITE === "1") {
    it("생성 파일 다시 쓰기", () => {
      const file = path.resolve(__dirname, "../../data/kr-kospi-peer-codes.ts");
      writeFileSync(file, `${HEADER}export const KR_KOSPI_PEER_CODES =\n  "${derived.join(",")}";\n`, "utf8");
    });
    return;
  }

  it("생성 파일 = 마스터에서 다시 만든 목록(드리프트 0)", () => {
    expect(KR_KOSPI_PEER_CODES.split(",")).toEqual(derived);
  });

  it("규모: 개별주 2,875 + 국내 주식형 ETF 449 = 3,324 (2026-11 마스터)", () => {
    expect(derived.length).toBe(3324);
  });

  it("데모 F1: KODEX 200(069500)은 포함, TIGER 미국S&P500(360750)은 제외", () => {
    expect(derived).toContain("069500");
    expect(derived).not.toContain("360750");
    expect(derived).toContain("005930");
    expect(derived).toContain("000660");
  });

  it("IRP 파킹형(CD금리·KOFR)·채권·금·신탁은 제외, 인버스 주식-파생형(합성)은 포함", () => {
    for (const code of ["357870", "459580", "423160", "453010", "226490", "183710"]) expect(derived).not.toContain(code);
    expect(derived).toContain("465350"); // KB RISE 2차전지TOP10인버스 (주식-파생형)(합성)
  });

  it("loadKospiPeerCodes: 동적 import로 Set을 만든다", async () => {
    const set = await loadKospiPeerCodes();
    expect(set.size).toBe(3324);
    expect(set.has("069500")).toBe(true);
  });

  it("etfFundType: 마지막 괄호(합성 제외)", () => {
    expect(etfFundType("삼성 KODEX200 증권상장지수투자신탁[주식]")).toBe("주식");
    expect(etfFundType("KB RISE 2차전지TOP10인버스iSelect증권상장지수투자신탁(주식-파생형)(합성)")).toBe("주식-파생형");
    expect(etfFundType("BNK 27-12 특수채(AAA이상)액티브증권상장지수투자신탁(채권)")).toBe("채권");
    expect(etfFundType("이름만")).toBeNull();
  });
});
