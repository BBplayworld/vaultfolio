// #369(5.180) 코인 카드 행·거래소별 하위 행 넘침 회귀 — 금액 열 shrink-0·왼쪽 열 min-w-0 없음으로 `˅`·금액이 카드 밖으로 잘리던 구조가 돌아오지 않게.
// 실측(320~440 2px·1280 × 라이트·다크)은 dev-notes에 둔다. 여기서는 배선만 고정한다
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.resolve(__dirname, "../crypto-tab.tsx"), "utf8");
const cardRow = src.slice(src.indexOf("function CryptoCard"), src.indexOf("<ChevronDown", src.indexOf("function CryptoCard")));
const subRow = src.slice(src.indexOf("function SubCryptoCard"), src.indexOf("<CollapsibleContent>", src.indexOf("function SubCryptoCard")));

describe("코인 카드 행", () => {
  it("왼쪽 열 min-w-0·수량 말줄임·비중 줄바꿈 0", () => {
    expect(cardRow).toContain("${ASSET_THEME.cardInfoLeft} min-w-0");
    expect(cardRow).toMatch(/className="min-w-0 text-sm text-foreground truncate">\{coin\.quantity/);
    expect(cardRow).toMatch(/data-testid="row-share" className="shrink-0 [^"]*whitespace-nowrap/);
  });
  it("금액 열은 전 폭 최대 50%(좁은 폭 전용 접두 없음), 금액 조각 nowrap, 손익 줄은 넘칠 때만 줄바꿈", () => {
    expect(cardRow).toContain('data-testid="crypto-row-right" className={`${ASSET_THEME.cardInfoRight} max-w-[50%]`}');
    expect(cardRow).not.toContain("max-[360px]:max-w-[45%]");
    expect(cardRow).toContain("${ASSET_THEME.text.default} whitespace-nowrap");
    expect(cardRow).toContain("${ASSET_THEME.cardAmountProfitRow} flex-wrap justify-end gap-y-0");
    expect(cardRow).not.toContain("max-sm:flex-wrap");
  });
});

describe("거래소별 하위 행", () => {
  it("거래소명 최소 폭·수량 말줄임(shrink-0 아님)", () => {
    expect(subRow).toMatch(/className="min-w-14 [^"]*truncate">\{label\}/);
    expect(subRow).toMatch(/className="min-w-0 [^"]*truncate">\{coin\.quantity/);
    expect(subRow).not.toMatch(/shrink-0 tabular-nums">\{coin\.quantity/);
  });
  it("금액 열 최대 55%·금액 nowrap·손익과 수익률은 각각 nowrap 조각으로 넘칠 때만 줄바꿈", () => {
    expect(subRow).toContain("flex max-w-[55%] shrink-0 flex-col items-end");
    expect(subRow).toMatch(/whitespace-nowrap">\{formatCurrency\(Math\.round\(value\)\)\}/);
    expect(subRow).toMatch(/data-testid="profit-text"[^>]*flex flex-wrap justify-end/);
    expect(subRow.match(/<span className="whitespace-nowrap">/g)).toHaveLength(2);
  });
});
