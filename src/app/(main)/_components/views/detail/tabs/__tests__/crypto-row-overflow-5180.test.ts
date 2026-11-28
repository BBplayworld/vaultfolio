// #369(5.180) 코인 카드 행·거래소별 하위 행 넘침 회귀 — 금액 열 shrink-0으로 `˅`·금액이 카드 밖으로 잘리던 구조가 돌아오지 않게.
// 동시에 qa D-1·D-2(1차 수정의 수량 말줄임 회귀): 수량은 자르지 않고(truncate 0), 넘치지 않는 행은 main과 같은 배치(고정 상한 0).
// 실측(320~440 2px·1280 × 라이트·다크 × 픽스처 A~E)은 dev-notes에 둔다. 여기서는 배선만 고정한다
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const src = readFileSync(path.resolve(__dirname, "../crypto-tab.tsx"), "utf8");
const cardRow = src.slice(src.indexOf("function CryptoCard"), src.indexOf("<ChevronDown", src.indexOf("function CryptoCard")));
const subRow = src.slice(src.indexOf("function SubCryptoCard"), src.indexOf("<CollapsibleContent>", src.indexOf("function SubCryptoCard")));
const tagOf = (s: string, testId: string) => s.slice(s.lastIndexOf("<", s.indexOf(`data-testid="${testId}"`)), s.indexOf(">", s.indexOf(`data-testid="${testId}"`)) + 1);

describe("코인 카드 행", () => {
  it("수량은 자르지 않음(truncate·말줄임 0) — 모자라면 마지막 수단으로만 줄바꿈", () => {
    const qty = tagOf(cardRow, "crypto-row-qty");
    expect(qty).not.toContain("truncate");
    expect(qty).not.toContain("text-ellipsis");
    expect(qty).toContain("[overflow-wrap:anywhere]");
  });
  it("메타 줄은 왼쪽 열 + 당김 8px + 여유 2px 폭(금액 열이 줄 때 서브픽셀로 꺾이지 않게)", () => {
    expect(tagOf(cardRow, "crypto-row-meta")).toContain("w-[calc(100%+0.625rem)]");
  });
  it("왼쪽 열: 기준 폭 = 메타 한 줄(flex-auto), 이름 줄은 폭 계산에서 빠짐, 최소폭 = 수량 조각(min-w-0 0)", () => {
    expect(tagOf(cardRow, "crypto-row-left")).toBe('<div data-testid="crypto-row-left" className="flex-auto">');
    expect(cardRow).toContain("${ASSET_THEME.cardInfoTitle} w-0 min-w-full");
  });
  it("메타 줄은 조각 사이에서만 꺾는다(DotLead, C152)", () => {
    expect(tagOf(cardRow, "crypto-row-meta")).toMatch(/\bflex\b.*\bflex-wrap\b/);
    expect(tagOf(cardRow, "crypto-row-meta")).toContain("${DOT_WRAP_ROW}");
    expect(cardRow).toMatch(/<span className="text-sm whitespace-nowrap"><DotLead \/><span data-testid="row-share"/);
  });
  it("금액 열은 고정 상한·shrink-0 없이 먼저 줄어들고(shrink-[100], 최소 = 금액 한 줄), 손익 줄은 넘칠 때만 줄바꿈", () => {
    expect(tagOf(cardRow, "crypto-row-right")).toBe('<div data-testid="crypto-row-right" className="shrink-[100] text-right">');
    expect(cardRow).not.toMatch(/max-w-\[\d+%\]/);
    expect(cardRow).not.toContain("cardInfoRight");
    expect(cardRow).toContain("${ASSET_THEME.text.default} whitespace-nowrap");
    expect(cardRow).toContain("${ASSET_THEME.cardAmountProfitRow} flex-wrap justify-end gap-y-0");
  });
});

describe("거래소별 하위 행", () => {
  it("640 미만은 거래소명 위·수량 아래 2줄, 거래소명 최소폭 강제 0", () => {
    expect(subRow).toContain('<div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">');
    expect(subRow).not.toContain("min-w-14");
  });
  it("수량은 자르지 않음(마지막 수단으로만 줄바꿈)·보조 색·2px 여유", () => {
    const qty = tagOf(subRow, "sub-row-qty");
    expect(qty).toContain("text-muted-foreground");
    expect(qty).not.toContain("truncate");
    expect(qty).toContain("[overflow-wrap:anywhere]");
    expect(qty).toContain("w-[calc(100%+2px)]");
  });
  it("금액 열 고정 상한·shrink-0 0, 금액 nowrap·손익과 수익률은 nowrap 조각 2개", () => {
    expect(subRow).not.toMatch(/max-w-\[\d+%\]/);
    expect(subRow).toContain('<div className="flex shrink-[100] flex-col items-end ml-auto mr-2 sm:mr-4 text-right">');
    expect(subRow).toMatch(/whitespace-nowrap">\{formatCurrency\(Math\.round\(value\)\)\}/);
    expect(subRow).toMatch(/data-testid="profit-text"[^>]*flex flex-wrap justify-end/);
    expect(subRow.match(/<span className="whitespace-nowrap">/g)).toHaveLength(2);
  });
});
