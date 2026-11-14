// #103 C42 전용 — GA 전송 횟수(완료 기준 14), F18(맞추기 양순서·삭제 뒤 맞추기), F24(삭제 진입점 Δ잔액 0·짝 유지), F27(토큰 수신 후 삭제), 경고 문구 분리
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { __resetGaStateForTest } from "@/lib/analytics/ga";
import { trackLinkedTrade } from "@/lib/trade/link-track";
import { applyBalanceEdits, linkResyncWarningText, resyncWarningText, shouldWarnTxAfterResync } from "@/lib/asset/balance-edits";
import { buildLink, cryptoLinkTrade, findLinkedRecord, planRemoveLink, removeLink, stockLinkTrade } from "@/lib/trade/linked-record";
import { generateShareToken, parseShareToken } from "@/lib/asset/asset-storage";
import { cashItem, emptyData, g, memoryStorage } from "./physical-fixtures";
import type { AssetData } from "@/types/asset";

const root = path.resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
const TODAY = "2026-11-12";
const stockTx = (id = "tx_1", type: "buy" | "sell" = "buy") => ({ id, stockId: "s1", ticker: "005930", stockName: "삼성", type, quantity: 10, price: 100_000, currency: "KRW" as const, date: "2026-11-10", reflected: true, createdAt: "x" });
const seed = (): AssetData => ({ ...emptyData(), cash: [cashItem("a", 5_000_000)], loans: [{ id: "l", type: "credit", name: "신용", balance: 3_000_000, interestRate: 0, startDate: "2025-01-01" }] });
const linkedSeed = (type: "buy" | "sell" = "buy") => {
  const t = stockTx("tx_1", type);
  const b = buildLink({ ...seed(), transactions: [t] }, stockLinkTrade(t), { kind: "cash", cashId: "a" }, TODAY);
  if (!b.ok) throw new Error(b.reason);
  return b.data;
};

describe("GA: 연결 저장 성공 1회 = linked_trade 1건 (완료 기준 14)", () => {
  const gtag = vi.fn();
  beforeEach(() => {
    gtag.mockClear();
    __resetGaStateForTest();
    g.window = { location: { origin: "https://secretasset.xyz", pathname: "/", hash: "", search: "" }, gtag } as never;
    g.localStorage = memoryStorage();
    (globalThis as unknown as { sessionStorage: Storage }).sessionStorage = memoryStorage();
  });
  afterEach(() => { delete g.window; delete g.localStorage; });

  it("연결 선택 + 저장 성공: 1건, 파라미터는 page_title·page_location뿐(금액·계좌명·매수/매도·현금/대출 없음)", () => {
    trackLinkedTrade({ kind: "cash", cashId: "a" });
    expect(gtag).toHaveBeenCalledTimes(1);
    const [, name, payload] = gtag.mock.calls[0];
    expect(name).toBe("feature_use");
    expect(Object.keys(payload).sort()).toEqual(["page_location", "page_title"]);
    expect(payload.page_title).toBe("거래 저장·계좌 함께 반영");
    expect(JSON.stringify(payload)).not.toMatch(/cash|loan|buy|sell|amount|주거래/i);
    trackLinkedTrade({ kind: "loan", loanId: "l" });
    expect(gtag).toHaveBeenCalledTimes(2); // 대출도 같은 이벤트 1건(구분 없음)
  });
  it("연결 안 함: 0건", () => {
    trackLinkedTrade(undefined);
    expect(gtag).not.toHaveBeenCalled();
  });
  it("호출 위치: 저장 성공 분기에서만(차단·기존 유지·저장 실패·삭제 되돌림 0건)", () => {
    const FILES = ["app/(main)/_components/forms/trade/trade-input.tsx", "app/(main)/_components/forms/asset-update/input/crypto-tx-input.tsx"];
    let count = 0;
    for (const f of FILES) {
      const src = read(f);
      for (const m of src.matchAll(/trackLinkedTrade\(link\);/g)) {
        count++;
        // 직전 두 문장 안에서 저장 함수가 true를 돌려준 분기(`if (ok) {` / `if (addTransactionsBatch(...)) {`) 안
        const before = src.slice(Math.max(0, m.index! - 260), m.index!);
        expect(before).toMatch(/if \(ok\) \{|if \(addTransactionsBatch\(/);
        expect(before).not.toMatch(/return;/);
      }
      expect(src).not.toMatch(/dupPending\(null\);[^}]*trackLinkedTrade/); // '기존 유지'
    }
    expect(count).toBe(3);
    for (const f of ["contexts/asset-data-context.tsx", "app/(main)/_components/views/detail/trades/stock-trades-view.tsx", "app/(main)/_components/views/detail/crypto-tx/crypto-tx-view.tsx"]) {
      expect(read(f)).not.toMatch(/linked_trade|trackLinkedTrade/);
    }
  });
});

describe("F18: 연결 후 잔액 맞추기 양순서 · 삭제 뒤 맞추기", () => {
  it("연결 저장 -> 같은 값으로 맞추기: 변화 0(이중 반영 없음), 다른 값은 절대값으로 덮음", () => {
    const d = linkedSeed();
    expect(d.cash[0].balance).toBe(4_000_000);
    expect(applyBalanceEdits(d.cash, { a: 4_000_000 }).applied).toBe(0);
    expect(applyBalanceEdits(d.cash, { a: 3_900_000 }).list[0].balance).toBe(3_900_000);
  });
  it("맞추기 먼저(맞춘 날 >= 거래일) -> 연결 선택 시 이중 반영 경고, 연결 안 함이면 잔액 불변", () => {
    const refreshed = "2026-11-11T03:00:00.000Z"; // KST 11/11
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-10", reflected: true, refreshedAtIso: refreshed })).toBe(true);
    expect(shouldWarnTxAfterResync({ txDate: "2026-11-12", reflected: true, refreshedAtIso: refreshed })).toBe(false);
  });
  it("삭제 되돌림 뒤 맞추기: 맞추기는 절대값이라 되돌린 잔액과 겹치지 않음", () => {
    const back = removeLink({ ...linkedSeed(), transactions: [] }, "tx_1").data;
    expect(back.cash[0].balance).toBe(5_000_000);
    expect(applyBalanceEdits(back.cash, { a: 4_700_000 }).list[0].balance).toBe(4_700_000);
  });
});

describe("연결 행 경고 문구 분리(F3)", () => {
  it("입출금 폼은 '체크를 꺼 주세요', 거래 폼 연결 행은 '연결 안 함으로 바꿔 주세요'", () => {
    const iso = "2026-11-11T03:00:00.000Z";
    expect(resyncWarningText("cash", iso, TODAY)).toMatch(/체크를 꺼 주세요$/);
    const t = linkResyncWarningText("cash", iso, TODAY);
    expect(t).toBe("11월 11일에 맞춘 현금 잔액에 이미 들어간 금액이면 연결 안 함으로 바꿔 주세요");
    expect(t).not.toMatch(/체크/);
    expect(linkResyncWarningText("loan", iso, "2026-11-11")).toBe("오늘 맞춘 대출 잔액에 이미 들어간 금액이면 연결 안 함으로 바꿔 주세요");
    expect(read("app/(main)/_components/forms/trade/link-account-row.tsx")).toMatch(/linkVariant/);
  });
});

describe("F24: 삭제 진입점 — 잔액 불변·짝 기록 유지(되돌림은 거래 삭제 다이얼로그 2곳뿐)", () => {
  const src = read("contexts/asset-data-context.tsx");
  const bodyOf = (name: string) => { const s = src.indexOf(`const ${name} = useCallback(`); const ends = ["[assetData", "[deleteStocks", "[deleteCryptos"].map((k) => src.indexOf(k, s)).filter((i) => i > 0); return src.slice(s, Math.min(...ends)); };
  it.each(["deleteStock", "deleteStocks", "deleteCrypto", "deleteCryptos", "deleteCash", "deleteLoan"])("%s는 revertLink·removeLink를 쓰지 않고 잔액을 가감하지 않는다", (name) => {
    const body = bodyOf(name);
    expect(body).not.toMatch(/removeLink|revertLink|balance:/);
  });
  it("revertLink는 반영 거래 삭제 2함수에서만 쓰인다", () => {
    expect([...src.matchAll(/revertLink/g)].length).toBeGreaterThan(0);
    for (const n of ["deleteTransactionWithPosition", "deleteCryptoTransactionWithPosition"]) expect(bodyOf(n)).toMatch(/revertLink/);
    for (const n of ["deleteTransaction", "deleteCryptoTransaction", "deleteStock", "deleteStocks", "deleteCrypto", "deleteCryptos", "deleteCash", "deleteLoan"]) expect(bodyOf(n)).not.toMatch(/removeLink/);
  });
  it("종목 삭제 후(거래만 사라짐) 짝 기록은 고아로 유지, 잔액 불변, 되돌림 대상 아님", () => {
    const d = linkedSeed();
    const after = { ...d, transactions: [] }; // deleteStock: 해당 종목 거래 삭제
    expect(after.cash[0].balance).toBe(4_000_000);
    expect(findLinkedRecord(after, "tx_1")?.kind).toBe("cash");
    expect(planRemoveLink(after, "tx_1")).not.toBeNull(); // 거래 삭제 다이얼로그를 거치지 않으니 호출되지 않을 뿐, 고아는 일반 입출금
  });
  it("코인 연결: 코인 거래가 남아도 짝 기록 유지(코인 삭제는 거래를 지우지 않음)", () => {
    const ct = { id: "crtx_1", cryptoId: "c1", symbol: "BTC", name: "비트코인", type: "buy" as const, quantity: 0.01, price: 50_000_000, date: "2026-11-10", reflected: true, createdAt: "x" };
    const b = buildLink({ ...seed(), cryptoTransactions: [ct] }, cryptoLinkTrade(ct), { kind: "cash", cashId: "a" }, TODAY);
    if (!b.ok) throw new Error();
    expect(b.data.cash[0].balance).toBe(4_500_000);
    expect(findLinkedRecord(b.data, "crtx_1")).not.toBeNull();
  });
  it("현금 계좌 삭제: 계좌와 그 기록이 함께 사라지면 거래만 남고 연결 풀림(계획 null)", () => {
    const d = linkedSeed();
    const gone = { ...d, cash: [], cashTransactions: d.cashTransactions.filter((c) => c.cashId !== "a") };
    expect(planRemoveLink(gone, "tx_1")).toBeNull();
    expect(removeLink(gone, "tx_1").data).toEqual(gone);
  });
  it("대출 계좌 삭제 / 3년 정리로 짝만 사라짐: 거래 삭제는 되돌림 없이 거래만", () => {
    const t = stockTx("tx_2", "sell");
    const b = buildLink({ ...seed(), transactions: [t] }, stockLinkTrade(t), { kind: "loan", loanId: "l" }, TODAY);
    if (!b.ok) throw new Error();
    const noLoan = { ...b.data, loans: [], loanTransactions: [] };
    expect(planRemoveLink(noLoan, "tx_2")).toBeNull();
    const pruned = { ...b.data, loanTransactions: [] }; // 3년 정리로 짝만 소실
    expect(removeLink(pruned, "tx_2").data.loans[0].balance).toBe(b.data.loans[0].balance);
  });
});

describe("F27: 공유 토큰 수신 후 연결 풀림 -> 거래 삭제 = 되돌림 없음", () => {
  beforeEach(() => { g.window = Object.assign(globalThis, { dispatchEvent: () => true }) as never; g.localStorage = memoryStorage(); });
  afterEach(() => { delete g.window; delete g.localStorage; });
  it("토큰 왕복: 기록·잔액 합계 같고 짝 id 소멸, 수신 쪽 삭제는 거래만", async () => {
    const d = linkedSeed();
    const parsed = await parseShareToken(await generateShareToken(d));
    if (!parsed || "pinRequired" in parsed) throw new Error("parse");
    const r = parsed.data;
    expect(r.cashTransactions).toHaveLength(1);
    expect(r.cash[0].balance).toBe(4_000_000);
    expect(r.cashTransactions.some((c) => c.id.includes("link"))).toBe(false);
    const txId = r.transactions[0].id;
    expect(planRemoveLink(r, txId)).toBeNull();
    const after = removeLink({ ...r, transactions: [] }, txId).data;
    expect(after.cash[0].balance).toBe(4_000_000);
    expect(after.cashTransactions).toHaveLength(1);
  });
});
