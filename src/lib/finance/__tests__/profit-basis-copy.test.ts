import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PROFIT_BASIS_COPY, DEFAULT_PROFIT_BASIS } from "../profit-utils";

const OLD = ["동일 영업일", "KST 접속일", "종가 기준 옵션", "기간 수익 종가 기준"];
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

describe("PROFIT_BASIS_COPY (#222)", () => {
  it("옵션 value는 ProfitBasis 2값, label 중복 없음", () => {
    expect(PROFIT_BASIS_COPY.options.map((o) => o.value)).toEqual(["sameBusinessDay", "kstAccessDay"]);
    expect(PROFIT_BASIS_COPY.options[0].value).toBe(DEFAULT_PROFIT_BASIS);
    expect(new Set(PROFIT_BASIS_COPY.options.map((o) => o.label)).size).toBe(2);
  });
  it("확정 문구", () => {
    expect(PROFIT_BASIS_COPY.name).toBe("국내·해외 날짜 맞춤");
    expect(PROFIT_BASIS_COPY.options.map((o) => o.label)).toEqual(["같은 거래일", "시장별 최신"]);
    expect(PROFIT_BASIS_COPY.summary).not.toBe("");
    expect(PROFIT_BASIS_COPY.notes).toHaveLength(3);
    expect(PROFIT_BASIS_COPY.notes[0].label).toBe("같은 거래일");
    expect(PROFIT_BASIS_COPY.notes[1].label).toBe("시장별 최신");
    expect(PROFIT_BASIS_COPY.notes[2].text).toBe("기간 수익·성적표·시장 비교(홈·상세 포함)\u2060에 함께 적용돼요.");
  });
  it("옛 단어 미포함", () => {
    const all = JSON.stringify(PROFIT_BASIS_COPY);
    for (const w of OLD) expect(all).not.toContain(w);
  });
  it("두 화면이 상수를 참조하고 옛 문자열·Switch가 없다", () => {
    const files = ["src/app/(main)/_components/header-menu/settings-page.tsx", "src/app/(main)/_components/views/activity/profit-chart.tsx"];
    for (const f of files) {
      const src = read(f);
      for (const w of OLD) expect(src).not.toContain(w);
      expect(src).toContain("PROFIT_BASIS_COPY");
    }
    expect(read(files[1])).not.toMatch(/\bSwitch\b/);
  });
});
