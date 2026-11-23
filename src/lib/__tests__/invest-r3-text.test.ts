// 5.141 #272: TERMS 글자 일치·A4(가장 깊었던 때/가장 길었던 때) 검산·진행 중 제외
import { describe, expect, it } from "vitest";
import { buildIndexView } from "@/lib/invest/calc";
import { marketHistory } from "@/lib/invest/market-history";
import { CALC_DIV, GLOSS, fmtPct, INDEX_INFO, LIST_SUB, PANEL_TERM_IDS, TERMS, recoverySummary } from "@/lib/invest/text";

const V = (k: "spx" | "ndx" | "kospi", asof?: number) => buildIndexView(marketHistory, k, asof);

describe("TERMS 사전", () => {
  it("정본 문장 글자 일치", () => {
    expect(TERMS.priceIndex.def).toBe("지수에 든 종목의 가격만으로 낸 값이에요. 배당은 들어 있지 않아요.");
    expect(TERMS.yearEnd.def).toBe("해마다 마지막 날(연말) 종가 기준이에요. 한 해 안의 움직임은 담지 않아요.");
    expect(TERMS.exDividend.def).toBe("받은 배당을 다시 넣지 않고 계산했어요. 배당을 다시 넣었다면 결과는 이보다 커요.");
    expect(TERMS.lumpDca.def).toBe("한 번에 넣기는 시작 해 말에 총액을 한 번에 넣은 경우, 매달 나눠 넣기는 같은 총액을 매달 같은 금액으로 나눠 넣은 경우예요.");
  });
  it("참조 문장이 TERMS와 글자 단위로 일치(ⓘ·LIST_SUB·CALC_DIV·GLOSS)", () => {
    expect(INDEX_INFO).toBe(`${TERMS.priceIndex.def} ${TERMS.yearEnd.def}`);
    expect(TERMS.bigDrop.def.startsWith(`${LIST_SUB}. `)).toBe(true);
    expect(TERMS.bigDrop.def.endsWith("한 해 연간 등락이 −15% 이하인 해와는 다른 기준이에요.")).toBe(true);
    expect(TERMS.exDividend.def.endsWith(CALC_DIV)).toBe(true);
    const gl = (t: string) => GLOSS.find((g) => g.term.startsWith(t))!.text;
    expect(gl("장단기")).toBe(TERMS.spread.def);
    expect(gl("경기침체")).toBe(TERMS.nber.def);
    expect(gl("10년물")).toBe(TERMS.y10.def);
    expect(gl("연준 금리")).toBe(TERMS.fedRate.def);
    expect(gl("연준 대차대조표")).toBe(TERMS.fedBs.def);
  });
  it("GLOSS 원문 유지(5.138 문장)", () => {
    expect(TERMS.nber.def).toBe("미국 경제연구소(NBER)가 정한 경기침체 기간이에요.");
    expect(TERMS.spread.def).toContain("마이너스면 짧은 쪽 금리가 더 높았다는 뜻이에요.");
  });
  it("출처 패널 용어 7개·중복 없음", () => {
    expect(PANEL_TERM_IDS).toHaveLength(7);
    expect(new Set(PANEL_TERM_IDS).size).toBe(7);
  });
});

describe("A4 recoverySummary", () => {
  it("S&P 500: 1973~74년 하락 −41.9%·가장 길었던 닷컴 14년", () => {
    const r = recoverySummary(V("spx"))!;
    expect([r.deep.name, fmtPct(r.deep.dd)]).toEqual(["1973~74년 하락", "−41.9%"]);
    expect(r.long).toEqual({ name: "닷컴 버블 붕괴", n: 14 });
    expect(r.merged).toBe(false);
    expect(r.skipped).toBe(0);
  });
  it("나스닥100: 닷컴 −73.5%·15년은 같은 하락(합친 문장)", () => {
    const r = recoverySummary(V("ndx"))!;
    expect([r.deep.name, fmtPct(r.deep.dd)]).toEqual(["닷컴 버블 붕괴", "−73.5%"]);
    expect(r.long).toEqual({ name: "닷컴 버블 붕괴", n: 15 });
    expect(r.merged).toBe(true);
  });
  it("코스피: 외환위기 −63.4%·가장 길었던 닷컴 6년", () => {
    const r = recoverySummary(V("kospi"))!;
    expect([r.deep.name, fmtPct(r.deep.dd)]).toEqual(["외환위기", "−63.4%"]);
    expect(r.long).toEqual({ name: "닷컴 버블 붕괴", n: 6 });
  });
  it("진행 중 하락은 비교에서 빼고 건수를 센다(asof=2022 모의)", () => {
    const v = V("spx", 2022), ongoing = v.eps.filter((e) => e.ongoing).length;
    expect(ongoing).toBeGreaterThan(0);
    const r = recoverySummary(v)!;
    expect(r.skipped).toBe(ongoing);
    expect(r.long!.n).toBeGreaterThan(0);
  });
  it("하락 0건이면 null, 전부 진행 중이면 깊이만", () => {
    const none = { ...V("spx"), eps: [] };
    expect(recoverySummary(none)).toBeNull();
    const v = V("spx"), only = { ...v, eps: v.eps.filter((e) => e.ongoing).length ? v.eps.filter((e) => e.ongoing) : [{ ...v.eps[0], ongoing: true, ry: null }] };
    const r = recoverySummary(only)!;
    expect(r.long).toBeNull();
    expect(r.skipped).toBe(0);
  });
});
