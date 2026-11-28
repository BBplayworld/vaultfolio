// #371(5.181) 동승 — 투자 유형 PNG 설명의 35자 초과 단일 문장 2줄 결정적 분할(꼬리 줄 `챙기는 편.`·빈 줄 해소)
import { describe, expect, it } from "vitest";
import { resolveInvestorType, splitLongDescriptionLine, type AccountKey, type KrUsBalance, type RegionKey } from "../investor-type";
import { SECTOR_ENUM, STOCK_TYPE_ENUM } from "../classification-store";

const TARGET = 35; // share-card 캡처 targetChars(변경 0)

// share-card renderDescriptionInLines와 같은 그리디 묶음
function groupLines(text: string, target = TARGET): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?])\s+/).filter(Boolean)) {
    if (cur && cur.length + 1 + s.length > target) {
      lines.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) lines.push(cur);
  return lines;
}

function check(line: string, terms: readonly string[]) {
  const r = splitLongDescriptionLine(line, terms, TARGET);
  expect(r, line).not.toBeNull();
  const [a, b] = r!;
  expect(`${a} ${b}`).toBe(line);
  for (const h of [a, b]) {
    expect(h.length, line).toBeGreaterThan(10); // 10자 이하 짧은 줄 0
    expect(h.length, line).toBeLessThanOrEqual(TARGET);
  }
  for (const t of terms) if (line.includes(t)) expect(a.includes(t) || b.includes(t), `${t} @ ${line}`).toBe(true);
  expect(b.startsWith("("), line).toBe(false);
  expect(a.split(" ").at(-1)!.length, line).toBeGreaterThan(1); // 1자 어절 뒤에서 자르지 않음
}

describe("splitLongDescriptionLine", () => {
  const MID = ["게다가 ", "동시에 ", "여기에 ", "더불어 ", "이와 함께 ", "덧붙이면 ", "그러면서 ", "한편, ", "또한 ", "그리고 ", "거기에 더해 ", "아울러 ", "이어서 ", "한 걸음 더 나아가 ", "덧붙여 ", "그 밖에도 "];
  const CLOSING = ["종합하면, ", "전체적으로 보면, ", "정리하자면, ", "한마디로, ", "결론적으로, ", "한 줄 요약하면, ", "돌아보면, ", "마무리하자면, "];
  it("통화 문장 24연결어 × 3통화 — 쉼표 뒤에서 2줄, `챙기는 편.` 홀로 0", () => {
    for (const c of [...MID, ...CLOSING]) for (const cur of ["원화 (KRW)", "달러 (USD)", "엔화 (JPY)"]) {
      const line = `${c}환전은 걱정 없이, ${cur} 자산 비중을 든든히 챙기는 편.`;
      expect(line.length).toBeGreaterThan(TARGET);
      check(line, []);
      expect(splitLongDescriptionLine(line, [], TARGET)![0].endsWith("걱정 없이,")).toBe(true);
    }
  });
  it("지수 문장 `즐기는 편.` — 공백 포함 강조어(NASDAQ 100) 안에서는 자르지 않는다", () => {
    const line = "이와 함께 개별 종목 승부만큼 NASDAQ 100 같은 지수 투자도 즐기는 편.";
    check(line, ["NASDAQ 100"]);
    const [a, b] = splitLongDescriptionLine(line, ["NASDAQ 100"], TARGET)!;
    expect(a.endsWith("NASDAQ") || b.startsWith("100")).toBe(false);
  });
  it("앞 어절이 1자인 자리에서는 자르지 않는다 — 합성어 `홈 화면` 보존(5.182 ui-review)", () => {
    const line = "한 걸음 더 나아가 해외 계좌 앱이 홈 화면 첫 줄에 있을 것 같은 타입.";
    check(line, []);
    expect(splitLongDescriptionLine(line, [], TARGET)).toEqual(["한 걸음 더 나아가 해외 계좌 앱이", "홈 화면 첫 줄에 있을 것 같은 타입."]);
  });
  it("35자 이하는 분할 대상이 아니고, 자를 자리가 없으면 null(기존 최소 높이)", () => {
    expect(splitLongDescriptionLine("가나다라마바사아자차카타파하가나다라마바사아자차카타파하가나다라마바사아자차", [], TARGET)).toBeNull();
  });
  it("결정적 — 같은 입력은 같은 결과", () => {
    const line = "전체적으로 보면, 미국 주식이 메인이고 국내 주식도 함께 챙기는 편.";
    expect(splitLongDescriptionLine(line, [], TARGET)).toEqual(splitLongDescriptionLine(line, [], TARGET));
  });
  it("조합 열거 — 35자 초과 묶음은 모두 단일 문장이고 2줄(각 11~35자)로 나뉜다", () => {
    const regions: RegionKey[] = ["KR", "US"];
    const accounts: AccountKey[] = ["domestic", "foreign", "pension_irp"];
    const names = [undefined, "애플39", "RISE 차이나AI반도체TOP4Plus"];
    const indexes = [undefined, "NASDAQ 100", "S&P 500"];
    const bal: (KrUsBalance | undefined)[] = [undefined, "even", "us_only"];
    const seen = new Set<string>();
    let long = 0;
    for (const themeKey of SECTOR_ENUM) for (const concentration of ["high", "medium", "low"] as const) for (const regionKey of regions)
      for (const accountKey of accounts) for (const stockTypeKey of STOCK_TYPE_ENUM) for (const topStockName of names) for (const topCurrencyLabel of ["원화 (KRW)", "달러 (USD)", "엔화 (JPY)"])
        for (const topIndexLabel of indexes) for (const krUsBalance of bal) {
          const t = resolveInvestorType({ themeKey, concentration, regionKey, accountKey, stockTypeKey, topStockName, topCurrencyLabel, topIndexLabel, krUsBalance, secondStockName: topStockName ? "TIGER 미국S&P500" : undefined });
          for (const line of groupLines(t.description)) {
            if (line.length <= TARGET || seen.has(line)) continue;
            seen.add(line);
            long++;
            expect(line.split(/(?<=[.!?])\s+/)).toHaveLength(1);
            check(line, t.highlightTerms);
          }
        }
    expect(long).toBeGreaterThan(100);
  }, 60_000);
});
