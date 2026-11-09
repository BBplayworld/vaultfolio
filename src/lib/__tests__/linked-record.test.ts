// #103 연결 계좌 — 짝 id 정본·금액·가드·되돌림(cto 5-5 픽스처 3종) 단위 테스트
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import {
  buildLink, cashLinkId, findLinkedRecord, isLinkDateAllowed, linkAmount, linkCandidates,
  linkedTradeIdOf, loanLinkId, planRemoveLink, removeLink, type LinkTrade,
} from "@/lib/trade/linked-record";
import type { AssetData } from "@/types/asset";

const TODAY = "2026-11-12";
const NOW = new Date("2026-11-12T03:00:00Z");
const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});
const cash = (id: string, balance: number, currency: "KRW" | "USD" | "JPY" = "KRW") =>
  ({ id, type: "bank", name: `계좌${id}`, balance, currency }) as AssetData["cash"][number];
const loan = (id: string, balance: number) =>
  ({ id, type: "credit", name: `대출${id}`, balance, interestRate: 4, startDate: "2025-01-01" }) as AssetData["loans"][number];
const trade = (o: Partial<LinkTrade> = {}): LinkTrade => ({
  id: "tx_1", type: "buy", quantity: 10, price: 100, currency: "KRW", date: "2026-11-10", name: "삼성전자", ...o,
});
const link = (d: AssetData, t: LinkTrade, l: Parameters<typeof buildLink>[2]) => buildLink(d, t, l, TODAY, NOW);

describe("id 규칙", () => {
  it("짝 id <-> 거래 id 왕복, 일반 id는 null", () => {
    expect(cashLinkId("crtx_1_ab")).toBe("ctx_link_crtx_1_ab");
    expect(loanLinkId("tx_9")).toBe("ltx_link_tx_9");
    expect(linkedTradeIdOf({ id: cashLinkId("tx_5") })).toBe("tx_5");
    expect(linkedTradeIdOf({ id: loanLinkId("tx_5") })).toBe("tx_5");
    for (const id of ["ctx_1731_ab", "ltx_1731_ab", "demo_ctx_1", "ctx_link_", "tx_1"]) expect(linkedTradeIdOf({ id })).toBeNull();
  });
  it("접두어 문자열은 linked-record.ts 밖 src에 없다", () => {
    const root = path.resolve(__dirname, "../..");
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const n of readdirSync(dir)) {
        const p = path.join(dir, n);
        if (statSync(p).isDirectory()) { if (n !== "node_modules") walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(n) || p.endsWith("linked-record.ts") || p.includes("__tests__")) continue;
        if (/ctx_link_|ltx_link_/.test(readFileSync(p, "utf8"))) hits.push(p);
      }
    };
    walk(root);
    expect(hits).toEqual([]);
  });
});

describe("금액·날짜·후보", () => {
  it("매수 +수수료, 매도 -수수료, 통화 최소 단위 반올림", () => {
    expect(linkAmount(trade({ fee: 50 }))).toBe(1050);
    expect(linkAmount(trade({ type: "sell", fee: 50 }))).toBe(950);
    expect(linkAmount(trade({ currency: "USD", quantity: 3, price: 10.005, fee: 0.333 }))).toBe(30.35);
    expect(linkAmount(trade({ quantity: 0.00123456, price: 91_000_000 }))).toBe(112345);
  });
  it("이번 달(KST)만 허용", () => {
    expect(isLinkDateAllowed("2026-11-01", TODAY)).toBe(true);
    expect(isLinkDateAllowed("2026-10-31", TODAY)).toBe(false);
    expect(isLinkDateAllowed("2025-11-10", TODAY)).toBe(false);
  });
  it("후보: 같은 통화 현금 + KRW만 대출, 0원 대출은 매도 후보 제외, 지난달이면 없음", () => {
    const d = data({ cash: [cash("a", 100), cash("u", 100, "USD")], loans: [loan("l1", 500), loan("l0", 0)] });
    expect(linkCandidates(d, trade(), TODAY).cash.map((c) => c.id)).toEqual(["a"]);
    expect(linkCandidates(d, trade(), TODAY).loans.map((l) => l.id)).toEqual(["l1", "l0"]);
    expect(linkCandidates(d, trade({ type: "sell" }), TODAY).loans.map((l) => l.id)).toEqual(["l1"]);
    const usd = linkCandidates(d, trade({ currency: "USD" }), TODAY);
    expect(usd.cash.map((c) => c.id)).toEqual(["u"]);
    expect(usd.loans).toEqual([]);
    expect(linkCandidates(d, trade({ date: "2026-10-31" }), TODAY)).toEqual({ cash: [], loans: [] });
  });
});

describe("buildLink — 저장", () => {
  it("매수·현금: 출금 기록 1건 + 잔액 감소, 입력 data 불변", () => {
    const d = data({ cash: [cash("a", 5000)] });
    const r = link(d, trade(), { kind: "cash", cashId: "a" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.amount).toBe(1000);
    expect(r.data.cash[0].balance).toBe(4000);
    expect(r.data.cashTransactions).toHaveLength(1);
    expect(r.data.cashTransactions[0]).toMatchObject({ id: "ctx_link_tx_1", cashId: "a", type: "withdrawal", amount: 1000, date: "2026-11-10", reflected: true, memo: "삼성전자 매수" });
    expect(r.data.cashTransactions[0].recurring).toBeUndefined();
    expect(d.cash[0].balance).toBe(5000);
    expect(d.cashTransactions).toHaveLength(0);
  });
  it("매도·현금: 입금 기록 + 잔액 증가", () => {
    const r = link(data({ cash: [cash("a", 5000)] }), trade({ type: "sell" }), { kind: "cash", cashId: "a" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.data.cash[0].balance).toBe(6000);
    expect(r.data.cashTransactions[0]).toMatchObject({ type: "deposit", memo: "삼성전자 매도" });
  });
  it("매수·대출: borrow, 매도·대출: repay(전액 상환 가)", () => {
    const b = link(data({ loans: [loan("l", 3000)] }), trade(), { kind: "loan", loanId: "l" });
    if (!b.ok) throw new Error(b.reason);
    expect(b.data.loans[0].balance).toBe(4000);
    expect(b.data.loanTransactions[0]).toMatchObject({ id: "ltx_link_tx_1", type: "borrow", amount: 1000 });
    const s = link(data({ loans: [loan("l", 1000)] }), trade({ type: "sell" }), { kind: "loan", loanId: "l" });
    if (!s.ok) throw new Error(s.reason);
    expect(s.data.loans[0].balance).toBe(0);
    expect(s.data.loanTransactions[0].type).toBe("repay");
  });
  it("가드: 잔액 부족·초과 상환·대금 0 이하·중복·통화·지난달·계좌 없음 -> 실패", () => {
    const d = data({ cash: [cash("a", 999), cash("u", 99999, "USD")], loans: [loan("l", 999)] });
    expect(link(d, trade(), { kind: "cash", cashId: "a" })).toEqual({ ok: false, reason: "balance" });
    expect(link(data({ cash: [cash("e", 1000)] }), trade(), { kind: "cash", cashId: "e" })).toEqual({ ok: false, reason: "zero" }); // 전액 사용 = 0원 현금 저장 불가
    expect(link(d, trade({ type: "sell" }), { kind: "loan", loanId: "l" })).toEqual({ ok: false, reason: "balance" });
    expect(link(d, trade({ type: "sell", fee: 1000 }), { kind: "cash", cashId: "a" })).toEqual({ ok: false, reason: "amount" });
    expect(link(d, trade({ quantity: 0 }), { kind: "cash", cashId: "a" })).toEqual({ ok: false, reason: "amount" });
    expect(link(d, trade(), { kind: "cash", cashId: "u" })).toEqual({ ok: false, reason: "currency" });
    expect(link(d, trade({ currency: "USD" }), { kind: "loan", loanId: "l" })).toEqual({ ok: false, reason: "currency" });
    expect(link(d, trade({ date: "2026-10-30" }), { kind: "cash", cashId: "a" })).toEqual({ ok: false, reason: "month" });
    expect(link(d, trade(), { kind: "cash", cashId: "zz" })).toEqual({ ok: false, reason: "no-account" });
    const ok = link(data({ cash: [cash("a", 5000)] }), trade(), { kind: "cash", cashId: "a" });
    if (!ok.ok) throw new Error();
    expect(link(ok.data, trade(), { kind: "cash", cashId: "a" })).toEqual({ ok: false, reason: "duplicate" });
  });
  it("외화: USD 종목 + USD 계좌, 소수 단가·수수료", () => {
    const r = link(data({ cash: [cash("u", 1000, "USD")] }), trade({ currency: "USD", quantity: 2, price: 10.25, fee: 0.5 }), { kind: "cash", cashId: "u" });
    if (!r.ok) throw new Error(r.reason);
    expect(r.amount).toBe(21);
    expect(r.data.cash[0].balance).toBe(979);
    expect(r.data.cashTransactions[0].currency).toBe("USD");
  });
});

describe("removeLink — 되돌림(cto 5-5 픽스처)", () => {
  it("연결 저장 -> 삭제 왕복: 잔액·기록 원복", () => {
    const d = data({ cash: [cash("a", 5000)] });
    const r = link(d, trade({ type: "sell" }), { kind: "cash", cashId: "a" });
    if (!r.ok) throw new Error();
    const back = removeLink(r.data, "tx_1");
    expect(back.data.cash[0].balance).toBe(5000);
    expect(back.data.cashTransactions).toHaveLength(0);
    expect(back.plan).toMatchObject({ delta: -1000, clamped: false });
  });
  it("픽스처1: 현금 100 -> 매도 입금 500 -> 출금 450 -> 삭제: 잔액 하한(1원), -149 + 꼬리, 출금 기록 유지", () => {
    const wd = { id: "ctx_1_x", cashId: "a", type: "withdrawal", amount: 450, currency: "KRW", date: "2026-11-11", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number];
    const dep = { id: cashLinkId("tx_1"), cashId: "a", type: "deposit", amount: 500, currency: "KRW", date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number];
    const d = data({ cash: [cash("a", 150)], cashTransactions: [dep, wd] });
    const plan = planRemoveLink(d, "tx_1")!;
    // 현금은 0원 저장 불가(cashSchema > 0) -> 하한 1원 (대출은 0)
    expect(plan).toMatchObject({ delta: -149, clamped: true });
    const r = removeLink(d, "tx_1");
    expect(r.data.cash[0].balance).toBe(1);
    expect(r.data.cashTransactions.map((x) => x.id)).toEqual(["ctx_1_x"]);
  });
  it("F28 불변식: 되돌림 Δ = -min(금액, 현재 잔액 - 하한), 현금 하한 KRW 1·USD 0.01, 이미 하한이면 Δ 0", () => {
    const mk = (bal: number, cur: "KRW" | "USD", amt: number) => data({ cash: [cash("a", bal, cur)], cashTransactions: [{ id: cashLinkId("tx_1"), cashId: "a", type: "deposit", amount: amt, currency: cur, date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number]] });
    for (const [bal, cur, amt, floor] of [[150, "KRW", 500, 1], [800, "KRW", 500, 1], [1, "KRW", 500, 1], [3, "USD", 10, 0.01], [20, "USD", 10, 0.01]] as const) {
      const r = removeLink(mk(bal, cur, amt), "tx_1");
      expect(r.data.cash[0].balance - bal).toBeCloseTo(-Math.min(amt, bal - floor), 6);
      expect(r.data.cashTransactions).toHaveLength(0);
    }
  });
  it("픽스처2(F19): 대출 300 -> 매도 상환 300(0) -> 삭제: 대출 300, 상환 기록 -1", () => {
    const rep = { id: loanLinkId("tx_1"), loanId: "l", type: "repay", amount: 300, date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["loanTransactions"][number];
    const r = removeLink(data({ loans: [loan("l", 0)], loanTransactions: [rep] }), "tx_1");
    expect(r.data.loans[0].balance).toBe(300);
    expect(r.data.loanTransactions).toHaveLength(0);
    expect(r.plan?.clamped).toBe(false);
  });
  it("픽스처3: 대출 300 -> 매수 대출 증가 200(500) -> 상환 400(100) -> 삭제: 대출 0, -100 + 꼬리", () => {
    const bor = { id: loanLinkId("tx_1"), loanId: "l", type: "borrow", amount: 200, date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["loanTransactions"][number];
    const rep = { id: "ltx_2_y", loanId: "l", type: "repay", amount: 400, date: "2026-11-11", reflected: true, createdAt: "x" } as AssetData["loanTransactions"][number];
    const d = data({ loans: [loan("l", 100)], loanTransactions: [bor, rep] });
    expect(planRemoveLink(d, "tx_1")).toMatchObject({ delta: -100, clamped: true });
    const r = removeLink(d, "tx_1");
    expect(r.data.loans[0].balance).toBe(0);
    expect(r.data.loanTransactions.map((x) => x.id)).toEqual(["ltx_2_y"]);
  });
  it("매수 출금 되돌림은 항상 전액(증가 방향)", () => {
    const wd = { id: cashLinkId("tx_1"), cashId: "a", type: "withdrawal", amount: 700, currency: "KRW", date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number];
    const r = removeLink(data({ cash: [cash("a", 5)], cashTransactions: [wd] }), "tx_1");
    expect(r.data.cash[0].balance).toBe(705);
  });
  it("짝 기록의 현재 값으로 되돌린다(거래 금액 아님)", () => {
    const dep = { id: cashLinkId("tx_1"), cashId: "a", type: "deposit", amount: 300, currency: "KRW", date: "2026-11-10", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number];
    const r = removeLink(data({ cash: [cash("a", 1000)], cashTransactions: [dep] }), "tx_1");
    expect(r.data.cash[0].balance).toBe(700);
  });
  it("reflected:false 짝은 기록만 삭제, 짝 없음·계좌 없는 고아는 건드리지 않음", () => {
    const un = { id: cashLinkId("tx_1"), cashId: "a", type: "deposit", amount: 300, currency: "KRW", date: "2026-11-10", reflected: false, createdAt: "x" } as AssetData["cashTransactions"][number];
    const r = removeLink(data({ cash: [cash("a", 1000)], cashTransactions: [un] }), "tx_1");
    expect(r.data.cash[0].balance).toBe(1000);
    expect(r.data.cashTransactions).toHaveLength(0);
    const none = data({ cash: [cash("a", 1000)] });
    expect(removeLink(none, "tx_1")).toEqual({ data: none, plan: null });
    const orphan = data({ cashTransactions: [un] });
    const o = removeLink(orphan, "tx_1");
    expect(o.plan).toBeNull();
    expect(o.data.cashTransactions).toHaveLength(1);
    expect(findLinkedRecord(orphan, "tx_1")?.kind).toBe("cash");
  });
});
