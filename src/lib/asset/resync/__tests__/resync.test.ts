// #91 보유 현황 맞추기 순수 함수 — 매칭 표·C20 픽스처 ①~⑧·S1~S5·K1~K3·완료 기준 7~13
import { describe, expect, it } from "vitest";
import {
  confirmScreenBroker, isUnassignedBroker, matchExisting, sameBroker, changeCount, summarize, resolveRow,
} from "..";
import type { Stock } from "@/types/asset";
import { emptySel, row, run, screen, st, TODAY, USD } from "./fixtures";

describe("증권사 값 실데이터 형태", () => {
  it.each([
    [undefined, true], ["", true], ["  ", true], ["항목 2", true], ["항목2", true],
    ["토스증권", false], ["연금저축", false], ["데모증권", false],
  ])("isUnassignedBroker(%j) = %s", (b, want) => expect(isUnassignedBroker(b as string | undefined)).toBe(want));

  it.each([
    ["토스증권", "토스증권", true], ["토스 증권", "토스증권", true], ["연금저축", "연금저축", true],
    ["데모증권", "데모증권", true], ["토스", "토스증권", true],
    ["연금저축", "ISA", false], ["", "토스증권", false], ["항목 2", "토스증권", false], [undefined, undefined, false],
    ["데모증권", "토스증권", false],
  ])("sameBroker(%j, %j) = %s", (a, b, want) => expect(sameBroker(a as string | undefined, b as string | undefined)).toBe(want));
});

describe("장 증권사 확정 ①②", () => {
  it("① brokerHint가 목록명이면 그 값", () => {
    expect(confirmScreenBroker([row("005930", 1, 1, { brokerHint: "토스증권" })], [])).toEqual({ broker: "토스증권", source: "hint" });
  });
  it("② hint가 없고 티커 과반이 같은 broker 기존 항목과 일치하면 자유 텍스트도 그대로(데모증권)", () => {
    const ex = [st("a", "005930", "domestic", "데모증권", 1, 1), st("b", "000660", "domestic", "데모증권", 1, 1)];
    expect(confirmScreenBroker([row("005930", 1, 1), row("000660", 1, 1), row("035420", 1, 1)], ex)).toEqual({ broker: "데모증권", source: "existing" });
  });
  it("②는 미지정(``·항목 N) broker로는 확정하지 않는다", () => {
    const ex = [st("a", "005930", "domestic", "", 1, 1), st("b", "000660", "domestic", "항목 2", 1, 1)];
    expect(confirmScreenBroker([row("005930", 1, 1), row("000660", 1, 1)], ex)).toBeNull();
  });
  it("두 증권사가 모두 과반이면 확정하지 않는다", () => {
    const ex = [st("a", "AAPL", "foreign", "토스증권", 1, 1), st("b", "AAPL", "foreign", "키움증권", 1, 1)];
    expect(confirmScreenBroker([row("AAPL", 1, 1)], ex)).toBeNull();
  });
});

describe("매칭 표 ①①'②③④", () => {
  const t = (o: Partial<{ ticker: string; name: string; category: Stock["category"]; broker: string }>) => ({ ticker: "005930", name: "삼성전자", category: "domestic" as const, broker: "토스증권", ...o });
  it("① 티커·category·broker 일치", () => {
    const ex = [st("a", "005930", "domestic", "토스증권", 1, 1), st("b", "005930", "domestic", "키움증권", 1, 1)];
    expect(matchExisting(t({}), ex)).toMatchObject({ kind: "linked", linkedBy: "exact", stock: { id: "a" } });
  });
  it("①' category만 다름(ISA↔일반) → 기존 항목", () => {
    const ex = [st("a", "005930", "isa", "토스증권", 1, 1)];
    expect(matchExisting(t({}), ex)).toMatchObject({ kind: "linked", linkedBy: "category", stock: { id: "a" } });
  });
  it.each([[""], [undefined], ["항목 2"]])("② broker %j 단일 줄 연결", (b) => {
    const ex = [st("a", "005930", "domestic", b, 1, 1)];
    expect(matchExisting(t({}), ex)).toMatchObject({ kind: "linked", linkedBy: "unassigned" });
  });
  it("② 미지정이 2줄이면 ④ 후보", () => {
    const ex = [st("a", "005930", "domestic", "", 1, 1), st("b", "005930", "domestic", "항목 2", 1, 1)];
    expect(matchExisting(t({}), ex)).toMatchObject({ kind: "ambiguous" });
  });
  it("③ 티커 미인식 + 종목명 공백 무시 정확 일치 1건 → 연결", () => {
    const ex = [st("a", "005930", "domestic", "", 1, 1, { name: "삼성 전자" })];
    expect(matchExisting(t({ ticker: "" }), ex)).toMatchObject({ kind: "linked", linkedBy: "name", stock: { id: "a" } });
  });
  it("③ 종목명 일치가 2건이면 ④, 0건이면 none", () => {
    const ex = [st("a", "005930", "domestic", "", 1, 1, { name: "삼성전자" }), st("b", "005935", "domestic", "토스증권", 1, 1, { name: "삼성전자" })];
    expect(matchExisting(t({ ticker: "" }), ex)).toMatchObject({ kind: "ambiguous" });
    expect(matchExisting(t({ ticker: "", name: "없는종목" }), ex)).toEqual({ kind: "none" });
  });
  it("비상장은 연결 후보가 아니다", () => {
    const ex = [st("u", "", "unlisted", "", 1, 1, { name: "삼성전자" })];
    expect(matchExisting(t({ ticker: "" }), ex)).toEqual({ kind: "none" });
  });
  it("이미 쓴 id는 제외한다(같은 장 중복 행)", () => {
    const ex = [st("a", "005930", "domestic", "토스증권", 1, 1)];
    expect(matchExisting(t({}), ex, new Set(["a"]))).toEqual({ kind: "none" });
  });
});

describe("C20 실데이터 형태 픽스처", () => {
  it("① broker 미지정 항목 → 연결 + 증권사 채움, id·매수일·메모 승계", () => {
    const ex = [st("a", "005930", "domestic", undefined, 10, 70000)];
    const { diff, result } = run(ex, [screen(0, [row("005930", 12, 70000, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0]).toMatchObject({ status: "change", linkedBy: "unassigned" });
    expect(result.stocks).toEqual([{ ...ex[0], quantity: 12, broker: "토스증권", positionSource: "manual", positionEffectiveDate: TODAY }]);
  });
  it("② `항목 2` 도 연결(증권사 미지정과 동일)", () => {
    const ex = [st("a", "005930", "domestic", "항목 2", 10, 70000)];
    const { diff, result } = run(ex, [screen(0, [row("005930", 10, 70000, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0]).toMatchObject({ status: "change", linkedBy: "unassigned", change: { brokerFill: { from: "항목 2", to: "토스증권" } } });
    expect(result.stocks[0].broker).toBe("토스증권");
    expect(result.stocks[0].positionSource).toBeUndefined(); // 수량·평단이 안 바뀌면 position 필드 불변
  });
  it("③ 같은 미국 종목 2증권사: 한 곳만 맞춰도 다른 줄의 수량·평단·매입 환율·id 불변", () => {
    const a = st("a", "AAPL", "foreign", "토스증권", 10, 150, { purchaseExchangeRate: 1300 });
    const b = st("b", "AAPL", "foreign", "키움증권", 5, 140, { purchaseExchangeRate: 1400 });
    const { result } = run([a, b], [screen(0, [row("AAPL", 12, 150, { brokerHint: "토스증권" })])]);
    expect(result.stocks.find((s) => s.id === "b")).toBe(b);
    expect(result.stocks.find((s) => s.id === "a")).toMatchObject({ quantity: 12, purchaseExchangeRate: 1300 });
  });
  it("④ 같은 증권사 일반+ISA+연금: 국내 탭만 올리면 비대상 계좌·해외는 유지 묶음, 삭제 0", () => {
    const ex = [
      st("g1", "005930", "domestic", "토스증권", 1, 1), st("g2", "000660", "domestic", "토스증권", 1, 1),
      st("i1", "360750", "isa", "토스증권", 1, 1), st("p1", "069500", "pension", "토스증권", 1, 1),
      st("f1", "AAPL", "foreign", "토스증권", 1, 1),
    ];
    const { diff, result } = run(ex, [screen(0, [row("005930", 1, 1, { brokerHint: "토스증권" }), row("000660", 1, 1)])]);
    expect(diff.removes).toHaveLength(0);
    expect(diff.kept.map((s) => s.id).sort()).toEqual(["f1", "i1", "p1"]);
    expect(result.stocks).toHaveLength(5);
  });
  it("⑤ 국내 탭만 올린 장: A증권 해외·ISA, B증권, 비상장 삭제 기본 체크 0, 일반 항목만 후보", () => {
    const ex = [
      st("a1", "005930", "domestic", "토스증권", 1, 1), st("a2", "000660", "domestic", "토스증권", 1, 1), st("a3", "035420", "domestic", "토스증권", 1, 1),
      st("a4", "035720", "domestic", "토스증권", 1, 1), st("a5", "005380", "domestic", "토스증권", 1, 1),
      st("aF", "AAPL", "foreign", "토스증권", 1, 1), st("aI", "360750", "isa", "토스증권", 1, 1),
      st("b1", "005930", "domestic", "키움증권", 1, 1), st("u1", "", "unlisted", "", 1, 1, { name: "비상장사" }),
    ];
    const { diff, sel } = run(ex, [screen(0, [row("005930", 1, 1, { brokerHint: "토스증권" }), row("000660", 1, 1), row("035420", 1, 1), row("035720", 1, 1)])]);
    expect(diff.removes.map((r) => r.stock.id)).toEqual(["a5"]);
    expect(diff.kept.map((s) => s.id).sort()).toEqual(["aF", "aI", "b1", "u1"]);
    expect([...sel.remove]).toEqual(["a5"]);
  });
  it("⑥ 티커 없는 비상장은 어떤 경우에도 삭제 후보가 아니다", () => {
    const ex = [st("u1", "", "unlisted", "토스증권", 1, 1, { name: "비상장사" }), st("a", "005930", "domestic", "토스증권", 1, 1)];
    const { diff } = run(ex, [screen(0, [row("005930", 1, 1, { brokerHint: "토스증권" })])]);
    expect(diff.removes).toHaveLength(0);
    expect(diff.kept.map((s) => s.id)).toEqual(["u1"]);
  });
  it("⑦ 거래정지 항목은 그 항목만 삭제 기본 해제", () => {
    const ex = [
      st("a", "005930", "domestic", "토스증권", 1, 1), st("b", "000660", "domestic", "토스증권", 1, 1), st("c", "035420", "domestic", "토스증권", 1, 1),
      st("h", "111111", "domestic", "토스증권", 1, 1, { inactiveStatus: "halted" }), st("x", "222222", "domestic", "토스증권", 1, 1),
    ];
    const { diff } = run(ex, [screen(0, [row("005930", 1, 1, { brokerHint: "토스증권" }), row("000660", 1, 1), row("035420", 1, 1)])]);
    const by = Object.fromEntries(diff.removes.map((r) => [r.stock.id, r]));
    expect(by.h).toMatchObject({ defaultChecked: false, offReason: "inactive" });
    expect(by.x.defaultChecked).toBe(true);
  });
  it("⑧ 고아 거래(stockId 불일치)가 있어도 stocks만 바뀌고 거래 배열은 건드리지 않는다", () => {
    const ex = [st("new1", "005930", "domestic", "토스증권", 10, 1)];
    const txs = [{ id: "t1", stockId: "old-gone", ticker: "005930", type: "buy" as const, quantity: 3, price: 1, date: "2026-10-01", reflected: true }];
    const { result } = run(ex, [screen(0, [row("005930", 7, 1, { brokerHint: "토스증권" })])]);
    const before = { stocks: ex, transactions: txs };
    const after = { stocks: result.stocks, transactions: before.transactions };
    expect(after.transactions).toBe(txs);
    expect(JSON.stringify(txs)).toBe(JSON.stringify(before.transactions));
  });
});

describe("S1·S2 삭제 기본 체크", () => {
  const ex = (n: number) => Array.from({ length: n }, (_, i) => st(`s${i}`, `00000${i}`.slice(-6), "domestic", "토스증권", 1, 1));
  const six = ex(6);
  const first = (k: number) => six.slice(0, k).map((s, i) => row(s.ticker!, 1, 1, i === 0 ? { brokerHint: "토스증권" } : {}));
  it("후보가 절반 미만이면 기본 체크", () => {
    const { diff } = run(six, [screen(0, first(5))]);
    expect(diff.removes).toHaveLength(1);
    expect(diff.removes[0].defaultChecked).toBe(true);
  });
  it("후보 수 ×2 ≥ 조합 기존 종목 수면 그 조합만 해제", () => {
    const { diff } = run(six, [screen(0, first(3))]);
    expect(diff.removes).toHaveLength(3);
    expect(diff.removes.every((r) => !r.defaultChecked && r.offReason === "half")).toBe(true);
  });
  it.each([["failed"], ["truncated"], ["limit"]] as const)("%s 장이 1장이라도 있으면 모든 범위 기본 해제", (status) => {
    const { diff, sel } = run(six, [screen(0, first(5)), screen(1, [], status)]);
    expect(diff.incomplete).toBe(true);
    expect(diff.removes.every((r) => !r.defaultChecked && r.offReason === "incomplete")).toBe(true);
    expect(sel.remove.size).toBe(0);
  });
  it("증권사 미확정 장이 있으면 기본 해제 + 그 장 종목은 전부 확인 필요(적용 안 됨)", () => {
    const other = [st("z", "999999", "domestic", "토스증권", 1, 1), st("y", "888888", "domestic", "토스증권", 1, 1), st("w", "777777", "domestic", "토스증권", 1, 1)];
    const { diff, result } = run([...six, ...other], [
      screen(0, first(5)),
      screen(1, [row("123456", 5, 100)]),
    ]);
    expect(diff.incomplete).toBe(true);
    const unconfirmed = diff.rows.find((r) => r.item?.ticker === "123456")!;
    expect(unconfirmed).toMatchObject({ status: "needs", reasons: ["brokerUnconfirmed"] });
    expect(result.stocks.some((s) => s.ticker === "123456")).toBe(false);
    expect(diff.removes.every((r) => !r.defaultChecked)).toBe(true);
  });
  it("사용자가 증권사를 고르면 그 장은 확정되고 추가로 처리된다", () => {
    const { diff, result } = run([], [screen(0, [row("123456", 5, 100)])], { brokers: { 0: "토스증권" } });
    expect(diff.rows[0].status).toBe("add");
    expect(result.stocks[0]).toMatchObject({ ticker: "123456", broker: "토스증권" });
  });
  it("유지 묶음에서 사용자가 체크한 항목만 삭제된다", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 1, 1), st("k", "AAPL", "foreign", "토스증권", 1, 1)];
    const { result } = run(e, [screen(0, [row("005930", 1, 1, { brokerHint: "토스증권" })])], { sel: () => ({ remove: new Set(["k"]) }) });
    expect(result.stocks.map((s) => s.id)).toEqual(["a"]);
  });
  it("연결·갱신된 항목은 remove에 들어 있어도 지우지 않는다", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 1, 1)];
    const { result } = run(e, [screen(0, [row("005930", 2, 1, { brokerHint: "토스증권" })])], { sel: () => ({ remove: new Set(["a"]) }) });
    expect(result.stocks).toHaveLength(1);
  });
});

describe("S3 연결 사실·수량 감소 확인 필요", () => {
  it("② 연결에서 수량이 줄면 확인 필요, 체크하지 않으면 값이 바뀌지 않는다", () => {
    const e = [st("a", "005930", "domestic", "", 10, 70000)];
    const { diff, result } = run(e, [screen(0, [row("005930", 7, 70000, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0]).toMatchObject({ status: "needs", reasons: ["qtyDecrease"], linkedBy: "unassigned" });
    // 미리보기가 연결 사실(증권사 미지정 → 증권사)을 보일 수 있도록 채움 정보가 행에 있다(qa D2)
    expect(diff.rows[0].change?.brokerFill).toEqual({ from: undefined, to: "토스증권" });
    expect(result.stocks[0]).toBe(e[0]);
  });
  it("체크하면 적용된다", () => {
    const e = [st("a", "005930", "domestic", "", 10, 70000)];
    const { result } = run(e, [screen(0, [row("005930", 7, 70000, { brokerHint: "토스증권" })])], { sel: (d) => ({ include: new Set([d.rows[0].rowId]) }) });
    expect(result.stocks[0]).toMatchObject({ quantity: 7, broker: "토스증권" });
  });
  it("① 정확 일치 수량 감소는 확인 필요가 아니라 변경", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 10, 70000)];
    const { diff } = run(e, [screen(0, [row("005930", 7, 70000, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0].status).toBe("change");
  });
  it("④ 후보 2건은 확인 필요이고 고르기 전에는 적용 안 됨", () => {
    const e = [st("a", "005930", "domestic", "", 10, 1), st("b", "005930", "domestic", "항목 2", 4, 1)];
    const { diff, result } = run(e, [screen(0, [row("005930", 12, 1, { brokerHint: "토스증권" })])], { sel: (d) => ({ include: new Set([d.rows[0].rowId]) }) });
    expect(diff.rows[0]).toMatchObject({ status: "needs", reasons: ["ambiguous"] });
    expect(result.stocks).toEqual(e);
  });
  it("④ 같은 증권사·같은 유형 후보 2건은 multiAccount 사유 코드가 함께 붙는다 (#198)", () => {
    const e = [st("a", "005930", "irp", "키움증권", 10, 1), st("b", "005930", "irp", "키움증권", 4, 1)];
    const { diff } = run(e, [screen(0, [row("005930", 12, 1, { brokerHint: "키움증권", section: "기타", category: "irp" })])]);
    expect(diff.rows[0].reasons).toEqual(expect.arrayContaining(["ambiguous", "multiAccount"]));
  });
  it("④ 후보 증권사가 다르면 multiAccount 아님 (#198)", () => {
    const e = [st("a", "005930", "domestic", "", 10, 1), st("b", "005930", "domestic", "항목 2", 4, 1)];
    const { diff } = run(e, [screen(0, [row("005930", 12, 1, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0].reasons).not.toContain("multiAccount");
  });
  it("④ 줄을 고르고 포함하면 그 줄만 갱신", () => {
    const e = [st("a", "005930", "domestic", "", 10, 1), st("b", "005930", "domestic", "항목 2", 4, 1)];
    const { result } = run(e, [screen(0, [row("005930", 12, 1, { brokerHint: "토스증권" })])], {
      sel: (d) => ({ include: new Set([d.rows[0].rowId]), pick: { [d.rows[0].rowId]: "b" } }),
    });
    expect(result.stocks[0]).toBe(e[0]);
    expect(result.stocks[1]).toMatchObject({ quantity: 12, broker: "토스증권" });
  });
});

describe("S4 평단 규칙 (averagePriceEstimated)", () => {
  const e = () => [st("a", "005930", "domestic", "토스증권", 10, 70000)];
  it("화면 실값이 다르면 변경하고 positionSource manual", () => {
    const { diff, result } = run(e(), [screen(0, [row("005930", 10, 72000, { brokerHint: "토스증권" })])]);
    expect(diff.rows[0].change?.avg).toEqual({ before: 70000, after: 72000 });
    expect(result.stocks[0]).toMatchObject({ averagePrice: 72000, positionSource: "manual", positionEffectiveDate: TODAY });
  });
  it("역산값이면 기존 평단 유지(1% 넘게 달라도), 그대로 + 표시 플래그", () => {
    const { diff, result } = run(e(), [screen(0, [row("005930", 10, 80000, { brokerHint: "토스증권", averagePriceEstimated: true })])]);
    expect(diff.rows[0]).toMatchObject({ status: "same", change: { avg: null, avgKept: true } });
    expect(result.stocks[0].averagePrice).toBe(70000);
  });
  it("역산값이 1% 이내면 표시도 없다", () => {
    const { diff } = run(e(), [screen(0, [row("005930", 10, 70300, { brokerHint: "토스증권", averagePriceEstimated: true })])]);
    expect(diff.rows[0].change?.avgKept).toBe(false);
  });
  it("역산 평단 + 수량 변경: 수량만 바뀌고 평단 유지", () => {
    const { result } = run(e(), [screen(0, [row("005930", 12, 99999, { brokerHint: "토스증권", averagePriceEstimated: true })])]);
    expect(result.stocks[0]).toMatchObject({ quantity: 12, averagePrice: 70000 });
  });
  it("그대로 항목은 객체가 같다(toBe)", () => {
    const ex = e();
    const { result } = run(ex, [screen(0, [row("005930", 10, 70000, { brokerHint: "토스증권" })])]);
    expect(result.stocks[0]).toBe(ex[0]);
  });
});

describe("#193 2줄 헤더 재업로드 회귀 — 기존 평단이 현재가로 덮어써지지 않는다", () => {
  // 가공 숫자: 기존 평단은 소수 다자리 저장, 화면(서버 반올림 2자리)에는 같은 값이 읽힌다
  const e = () => [
    st("a", "AAA", "foreign", "키움증권", 100, 200.12345678),
    st("b", "BBB", "foreign", "키움증권", 50, 80.5),
  ];
  it("올바른 평단(기존과 같음)으로 다시 올리면 전부 그대로", () => {
    const ex = e();
    const { diff, result } = run(ex, [screen(0, [
      row("AAA", 100, 200.12, { brokerHint: "키움증권", currentPrice: 240 }),
      row("BBB", 50, 80.5, { brokerHint: "키움증권", currentPrice: 70 }),
    ])]);
    expect(diff.rows.map((r) => r.status)).toEqual(["same", "same"]);
    expect(result.stocks[0]).toBe(ex[0]);
    expect(result.stocks[1]).toBe(ex[1]);
  });
  it("현재가가 평단 칸에 들어온 행(수정 전 오인식 형태)은 평단 변경으로 잡힌다 — 서버 교정이 이를 막는 근거", () => {
    const { diff } = run(e(), [screen(0, [row("AAA", 100, 240, { brokerHint: "키움증권" })])]);
    expect(diff.rows[0].change?.avg).toEqual({ before: 200.12345678, after: 240 });
  });
});

describe("S4·S5 데이터 계약", () => {
  it("연결 항목의 id·매수일·매입 환율·메모·currency·inactive를 승계한다", () => {
    const a = st("a", "AAPL", "foreign", "토스증권", 10, 150, { purchaseExchangeRate: 1311, inactiveStatus: "halted", inactiveReason: "r", purchaseDate: "2024-05-05" });
    const { result } = run([a], [screen(0, [row("AAPL", 15, 160, { brokerHint: "토스증권" })])]);
    const n = result.stocks[0];
    expect(n).toMatchObject({ id: "a", purchaseDate: "2024-05-05", purchaseExchangeRate: 1311, description: "메모a", inactiveStatus: "halted", inactiveReason: "r", currency: "USD", category: "foreign", broker: "토스증권", positionSource: "manual", positionEffectiveDate: TODAY });
  });
  it("4.49 저장본(positionSource 없음)도 입력으로 쓸 수 있다", () => {
    const a = st("a", "005930", "domestic", "토스증권", 10, 100);
    expect(a.positionSource).toBeUndefined();
    const { result } = run([a], [screen(0, [row("005930", 11, 100, { brokerHint: "토스증권" })])]);
    expect(result.stocks[0].positionSource).toBe("manual");
  });
  it("현재가·baseDate는 화면 값으로 덮지 않고 승계한다", () => {
    const a = st("a", "005930", "domestic", "토스증권", 10, 100, { currentPrice: 123, baseDate: "2026-11-07" });
    const { result } = run([a], [screen(0, [row("005930", 11, 100, { brokerHint: "토스증권", currentPrice: 999 })])]);
    expect(result.stocks[0]).toMatchObject({ currentPrice: 123, baseDate: "2026-11-07" });
  });
});

describe("추가 항목·K2·K3", () => {
  it("K2 매수일 올해 1월 1일(#139 대표 결정, 이전 오늘), K3 해외 신규 매입 환율은 일괄 값(없으면 오늘 환율), 국내는 환율 없음", () => {
    const sc = [screen(0, [row("005930", 3, 70000, { brokerHint: "토스증권" }), row("TSLA", 2, 200, { brokerHint: "토스증권" })])];
    const d = run([], sc);
    const tsla = d.result.stocks.find((s) => s.ticker === "TSLA")!;
    expect(tsla).toMatchObject({ purchaseDate: "2026-01-01", positionEffectiveDate: TODAY, purchaseExchangeRate: USD, currency: "USD", positionSource: "manual", broker: "토스증권", category: "foreign" });
    expect(d.result.stocks.find((s) => s.ticker === "005930")).not.toHaveProperty("purchaseExchangeRate");
    const d2 = run([], sc, { sel: () => ({ fx: 1350 }) });
    expect(d2.result.stocks.find((s) => s.ticker === "TSLA")!.purchaseExchangeRate).toBe(1350);
  });
  it("해외 종목을 원화로 읽은 화면은 환율로 나눈다(현행 등록 규칙과 같은 출력)", () => {
    const d = run([], [screen(0, [row("TSLA", 2, 280000, { brokerHint: "토스증권", currentPrice: 294000, originalCurrency: "KRW" })])]);
    expect(d.result.stocks[0]).toMatchObject({ averagePrice: 200, currentPrice: 210 });
  });
  it("티커 미인식 신규는 입력 전까지 적용되지 않는다", () => {
    const sc = [screen(0, [row("", 2, 100, { brokerHint: "토스증권", name: "모르는종목", section: "국내", category: "domestic" })])];
    const a = run([], sc);
    expect(a.diff.rows[0]).toMatchObject({ status: "needs", reasons: ["tickerMissing"] });
    expect(a.result.stocks).toHaveLength(0);
    const b = run([], sc, { sel: (d) => ({ include: new Set([d.rows[0].rowId]), ticker: { [d.rows[0].rowId]: "123456" } }) });
    expect(b.result.stocks[0]).toMatchObject({ ticker: "123456", name: "모르는종목" });
  });
});

describe("quantityMissing (서버 플래그)", () => {
  it("연결 항목 수량이 1로 덮이지 않는다", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 10, 100)];
    const { diff, result } = run(e, [screen(0, [row("005930", 1, 100, { brokerHint: "토스증권", quantityMissing: true })])], { sel: (d) => ({ include: new Set([d.rows[0].rowId]) }) });
    expect(diff.rows[0]).toMatchObject({ status: "needs", reasons: ["quantityMissing"] });
    expect(result.stocks[0]).toBe(e[0]); // 포함해도 수량 입력이 없으면 적용 안 됨
  });
  it("수량을 입력하고 포함하면 그 값으로 적용", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 10, 100)];
    const { result } = run(e, [screen(0, [row("005930", 1, 100, { brokerHint: "토스증권", quantityMissing: true })])], { sel: (d) => ({ include: new Set([d.rows[0].rowId]), qty: { [d.rows[0].rowId]: 8 } }) });
    expect(result.stocks[0].quantity).toBe(8);
  });
});

describe("K1 두 장 중복", () => {
  const e = [st("a", "005930", "domestic", "토스증권", 10, 100)];
  it("같은 키·같은 수량은 1건으로 센다", () => {
    const { diff } = run(e, [screen(0, [row("005930", 10, 100, { brokerHint: "토스증권" })]), screen(1, [row("005930", 10, 100, { brokerHint: "토스증권" })])]);
    expect(diff.rows).toHaveLength(1);
    expect(diff.rows[0].status).toBe("same");
  });
  it("수량이 다르면 확인 필요 1칸 + 큰 값 기본 + 두 값 후보, 체크 안 하면 불변", () => {
    const sc = [screen(0, [row("005930", 10, 100, { brokerHint: "토스증권" })]), screen(1, [row("005930", 12, 100, { brokerHint: "토스증권" })])];
    const a = run(e, sc);
    expect(a.diff.rows).toHaveLength(1);
    expect(a.diff.rows[0]).toMatchObject({ status: "needs", reasons: ["qtyConflict"] });
    expect(a.diff.rows[0].item).toMatchObject({ quantity: 12, quantityCandidates: [10, 12] });
    expect(a.result.stocks[0]).toBe(e[0]);
    const b = run(e, sc, { sel: (d) => ({ include: new Set([d.rows[0].rowId]) }) });
    expect(b.result.stocks[0].quantity).toBe(12);
  });
  it("다른 장의 같은 종목이라도 증권사가 다르면 합치지 않는다", () => {
    const { diff } = run([], [screen(0, [row("005930", 10, 1, { brokerHint: "토스증권" })]), screen(1, [row("005930", 12, 1, { brokerHint: "키움증권" })])]);
    expect(diff.rows).toHaveLength(2);
  });
  it("같은 장 안 중복 행은 합치지 않는다(분리 행)", () => {
    const { diff } = run([], [screen(0, [row("005930", 10, 1, { brokerHint: "토스증권" }), row("005930", 3, 1)])]);
    expect(diff.rows).toHaveLength(2);
  });
});

describe("요약·버튼 활성(완료 기준 13·14)", () => {
  it("변경 0이면 changeCount 0", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 10, 100)];
    const { diff, sel } = run(e, [screen(0, [row("005930", 10, 100, { brokerHint: "토스증권" })])]);
    const c = summarize(diff, sel);
    expect(c).toEqual({ add: 0, change: 0, remove: 0, same: 1, needs: 0 });
    expect(changeCount(c)).toBe(0);
  });
  it("추가·변경·삭제·그대로 건수", () => {
    const e = [st("a", "005930", "domestic", "토스증권", 10, 100), st("b", "000660", "domestic", "토스증권", 5, 100), st("c", "035420", "domestic", "토스증권", 5, 100), st("d", "035720", "domestic", "토스증권", 5, 100), st("x", "111111", "domestic", "토스증권", 5, 100), st("y", "222222", "domestic", "토스증권", 5, 100), st("z", "333333", "domestic", "토스증권", 5, 100)];
    const { diff, sel } = run(e, [screen(0, [row("005930", 12, 100, { brokerHint: "토스증권" }), row("000660", 5, 100), row("035420", 5, 100), row("035720", 5, 100), row("005380", 1, 100)])]);
    // 후보 x,y,z 3 ×2 ≥ 7? 6 < 7 → 기본 체크
    expect(summarize(diff, sel)).toEqual({ add: 1, change: 1, remove: 3, same: 3, needs: 0 });
    expect(resolveRow(diff.rows[0], emptySel()).type).toBe("change");
  });
});
