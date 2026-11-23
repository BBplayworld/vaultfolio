// 5.142 #278 B1 내 첫 매입 해(기기 안 계산)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { firstBuyYear } from "@/lib/invest/default-index";
import { B1_OPTION } from "@/lib/invest/text";

const src = (p: string) => readFileSync(join(process.cwd(), "src", p), "utf8");

describe("#278 B1 첫 매입 해", () => {
  const st = (purchaseDate: string, extra = {}) => ({ quantity: 1, inactiveStatus: undefined, purchaseDate, ...extra });
  it("가장 이른 유효 매입 해, 상장폐지·수량 0·무효 날짜 제외", () => {
    expect(firstBuyYear([st("2019-03-02"), st("2015-01-10"), st("2021-01-01")])).toBe(2015);
    expect(firstBuyYear([st("2010-01-01", { inactiveStatus: "delisted" }), st("2018-05-05")])).toBe(2018);
    expect(firstBuyYear([st("2010-01-01", { quantity: 0 }), st("")])).toBeNull();
    expect(firstBuyYear([st("abcd-ef-gh"), st("2013-13-40")])).toBeNull();
    expect(firstBuyYear([])).toBeNull();
    expect(B1_OPTION(2019)).toBe("내 첫 매입 해 2019년");
  });
  it("저장·서버·GA 값 0(새 파일 정적 검사)", () => {
    for (const p of ["lib/invest/default-index.ts"]) expect(src(p)).not.toMatch(/localStorage\.setItem|fetch\(|track\(|sendBeacon/);
  });
});
