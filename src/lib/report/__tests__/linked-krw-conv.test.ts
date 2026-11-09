// #119 거래 연결 계좌 — 해외주식을 원화 계좌·대출로 연결: 통화 축 픽스처(C42·C49). 기대값은 spec 5절 선기재.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyImportedPayload, buildExportPayload, getAssetData } from "@/lib/asset/asset-storage";
import { g, memoryStorage } from "@/lib/__tests__/physical-fixtures";
import { computeSettlementCauses, matchRecordedTransferDetail } from "@/app/(main)/_components/views/activity/change-hero";
import { evaluateLink, linkPreviewText } from "@/lib/trade/link-text";
import { buildLink, linkAmount, linkAmountIn, linkCandidates, planRemoveLink, removeLink, stockLinkTrade, type LinkChoice, type LinkTrade } from "@/lib/trade/linked-record";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1390, JPY: 905 };
const TODAY = "2026-11-05";
const NOW = new Date("2026-11-05T03:00:00Z");
const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});
const base = (o: Partial<AssetData> = {}) => data({
  cash: [{ id: "a", type: "bank", name: "주거래", balance: 5_000_000, currency: "KRW" }],
  loans: [{ id: "l", type: "credit", name: "신용", balance: 3_000_000, interestRate: 0, startDate: "2025-01-01" }],
  ...o,
});
const usd = (type: "buy" | "sell", o: Partial<LinkTrade> = {}): LinkTrade =>
  type === "buy"
    ? { id: "tx_1", type, quantity: 10, price: 123.45, fee: 1.23, currency: "USD", exchangeRate: 1390, date: "2026-11-03", name: "Apple", ...o }
    : { id: "tx_1", type, quantity: 10, price: 130, fee: 1.3, currency: "USD", exchangeRate: 1390, date: "2026-11-03", name: "Apple", ...o };
const jpy = (o: Partial<LinkTrade> = {}): LinkTrade => ({ id: "tx_1", type: "buy", quantity: 100, price: 2500, currency: "JPY", exchangeRate: 905, date: "2026-11-03", name: "도요타", ...o });
const CASH: LinkChoice = { kind: "cash", cashId: "a" };
const LOAN: LinkChoice = { kind: "loan", loanId: "l" };
const link = (d: AssetData, t: LinkTrade, c: LinkChoice) => buildLink(d, t, c, TODAY, NOW);
const ok = (d: AssetData, t: LinkTrade, c: LinkChoice) => { const r = link(d, t, c); if (!r.ok) throw new Error(r.reason); return r; };
const txOf = (t: LinkTrade) => ({ id: t.id, stockId: "s", ticker: "AAPL", stockName: t.name, type: t.type, quantity: t.quantity, price: t.price, fee: t.fee, currency: t.currency, exchangeRate: t.exchangeRate, date: t.date, reflected: true, createdAt: "x" }) as AssetData["transactions"][number];

describe("금액 환산 — 원화 금액 = round((수량×단가±수수료)×배수)", () => {
  it("USD 매수·매도(수수료), JPY(100엔당)", () => {
    expect(linkAmountIn(usd("buy"), "KRW")).toBe(1_717_665);
    expect(linkAmountIn(usd("sell"), "KRW")).toBe(1_805_193); // 1298.70 × 1390 = 1,805,193
    expect(linkAmountIn(jpy(), "KRW")).toBe(2_262_500);
    expect(linkAmountIn(usd("buy"), "USD")).toBe(linkAmount(usd("buy"))); // 같은 통화는 환산 없음
  });
  it("소수 수량 0.5주×$123.45 = 85,798원 (USD 0.01 먼저 반올림한 85,805원이 아님)", () => {
    const t = usd("buy", { quantity: 0.5, price: 123.45, fee: 0 });
    expect(linkAmount(t)).toBe(61.73); // 중간 반올림 값
    expect(linkAmountIn(t, "KRW")).toBe(85_798);
    expect(Math.round(61.73 * 1390)).toBe(85_805);
  });
  it("환율 빈칸·0 -> rate, 원화 거래(국내·코인)는 환율 불필요", () => {
    expect(linkAmountIn(usd("buy", { exchangeRate: undefined }), "KRW")).toBe("rate");
    expect(linkAmountIn(usd("buy", { exchangeRate: 0 }), "KRW")).toBe("rate");
    expect(linkAmountIn({ ...usd("buy"), currency: "KRW", price: 1000, quantity: 3, fee: 0, exchangeRate: undefined }, "KRW")).toBe(3000);
  });
  it("priceInKrw: 달러 단가(÷환율, 소수 3자리)로 환산한 짝 금액이 입력 원화 총액과 ≤ 수량×0.0005×환율+1원", () => {
    const krwPrice = 171_600, qty = 7, rate = 1390;
    const price = Math.round((krwPrice / rate) * 1000) / 1000;
    const amt = linkAmountIn(usd("buy", { quantity: qty, price, fee: 0 }), "KRW") as number;
    expect(Math.abs(amt - krwPrice * qty)).toBeLessThanOrEqual(qty * 0.0005 * rate + 1);
  });
});

describe("후보·가드", () => {
  const d = base({ cash: [{ id: "u", type: "bank", name: "달러", balance: 100, currency: "USD" }, { id: "a", type: "bank", name: "주거래", balance: 5_000_000, currency: "KRW" }, { id: "j", type: "bank", name: "엔", balance: 100000, currency: "JPY" }] });
  it("USD 거래: 달러 현금 → 원화 현금 → 대출, 엔화 현금 제외 / 국내는 원화 현금만(v4.58)", () => {
    const c = linkCandidates(d, { type: "buy", currency: "USD", date: "2026-11-03" }, TODAY);
    expect(c.cash.map((x) => x.id)).toEqual(["u", "a"]);
    expect(c.loans.map((x) => x.id)).toEqual(["l"]);
    const k = linkCandidates(d, { type: "buy", currency: "KRW", date: "2026-11-03" }, TODAY);
    expect(k.cash.map((x) => x.id)).toEqual(["a"]);
  });
  it("매도는 잔액 0 대출 제외, 지난달이면 후보 0", () => {
    const z = base({ loans: [{ id: "l", type: "credit", name: "신용", balance: 0, interestRate: 0, startDate: "2025-01-01" }] });
    expect(linkCandidates(z, { type: "sell", currency: "USD", date: "2026-11-03" }, TODAY).loans).toEqual([]);
    expect(linkCandidates(d, { type: "buy", currency: "USD", date: "2026-10-31" }, TODAY)).toEqual({ cash: [], loans: [] });
  });
  it("현재 환율 0(체결 환율 없음) -> rate, 엔화 현금 <-> USD 거래는 currency", () => {
    expect(link(d, usd("buy", { exchangeRate: undefined }), CASH)).toEqual({ ok: false, reason: "rate" });
    expect(link(d, usd("buy", { exchangeRate: undefined }), LOAN)).toEqual({ ok: false, reason: "rate" });
    expect(link(d, usd("buy"), { kind: "cash", cashId: "j" })).toEqual({ ok: false, reason: "currency" });
  });
  it("잔액 = 대금 -> zero, 부족 -> balance, 초과 상환 -> balance", () => {
    expect(link(base({ cash: [{ id: "a", type: "bank", name: "주거래", balance: 1_717_665, currency: "KRW" }] }), usd("buy"), CASH)).toEqual({ ok: false, reason: "zero" });
    expect(link(base({ cash: [{ id: "a", type: "bank", name: "주거래", balance: 1_000_000, currency: "KRW" }] }), usd("buy"), CASH)).toEqual({ ok: false, reason: "balance" });
    expect(link(base({ loans: [{ id: "l", type: "credit", name: "신용", balance: 1_000_000, interestRate: 0, startDate: "2025-01-01" }] }), usd("sell"), LOAN)).toEqual({ ok: false, reason: "balance" });
  });
  it("미리보기 오류 문구의 통화 = 선택 계좌(원화)", () => {
    const e = evaluateLink(base({ cash: [{ id: "a", type: "bank", name: "주거래", balance: 1_717_665, currency: "KRW" }] }), usd("buy"), "cash:a", true);
    expect(e.state === "error" && e.message).toContain("0원");
    expect(e.state === "error" && e.message).not.toContain("$");
    const r = evaluateLink(d, usd("buy", { exchangeRate: undefined }), "cash:a", true);
    expect(r.state === "error" && r.message).toBe("환율을 확인할 수 없어요. 체결 환율을 입력하거나 연결 안 함으로 저장해 주세요.");
  });
});

describe("미리보기 = 저장 = 잔액 변화, 표시 통화 = 선택 계좌 통화", () => {
  it("USD 매수 × 원화 현금: 환산식 보조 줄, `$` 금액은 식에만", () => {
    const d = base();
    const e = evaluateLink(d, usd("buy"), "cash:a", true);
    if (e.state !== "ok") throw new Error(e.state);
    const p = linkPreviewText(e, "buy", true);
    expect(p.main).toEqual(["주거래", "5,000,000원", "3,282,335원"]);
    expect(p.sub).toBe("$1,235.73 × 1,390원만큼 현금이 줄어요 (수수료 포함)");
    expect(p.main.join("")).not.toContain("$");
    const saved = ok(d, usd("buy"), CASH);
    expect(saved.amount).toBe(e.result.amount);
    expect(saved.after).toBe(e.result.after);
  });
  it("JPY·대출·매도 문구", () => {
    const j = evaluateLink(base(), jpy(), "cash:a", true);
    if (j.state !== "ok") throw new Error(j.state);
    expect(linkPreviewText(j, "buy", false).sub).toBe("¥250,000 × 100엔당 905원만큼 현금이 줄어요");
    const l = evaluateLink(base(), usd("buy"), "loan:l", true);
    if (l.state !== "ok") throw new Error(l.state);
    expect(linkPreviewText(l, "buy", true).sub).toBe("$1,235.73 × 1,390원만큼 대출이 늘어요 (수수료 포함)");
    const s = evaluateLink(base(), usd("sell"), "cash:a", true);
    if (s.state !== "ok") throw new Error(s.state);
    expect(linkPreviewText(s, "sell", true).sub).toBe("$1,298.7 × 1,390원만큼 현금이 늘어요 (수수료 포함)");
  });
  it("같은 통화 USD 현금은 v4.58 그대로(환산식 없음, 달러 표시)", () => {
    const d = base({ cash: [{ id: "u", type: "bank", name: "달러", balance: 5000, currency: "USD" }] });
    const e = evaluateLink(d, usd("buy"), "cash:u", true);
    if (e.state !== "ok") throw new Error(e.state);
    const p = linkPreviewText(e, "buy", true);
    expect(p.sub).toBe("거래 금액만큼 현금이 줄어요 (수수료 포함)");
    expect(p.main[2]).toBe("$3,764.27");
  });
});

describe("저장 데이터·삭제 되돌림", () => {
  it("USD 매수 × 원화 현금: 잔액 3,282,335, KRW 출금 1,717,665", () => {
    const r = ok(base(), usd("buy"), CASH);
    expect(r.data.cash[0].balance).toBe(3_282_335);
    expect(r.data.cashTransactions[0]).toMatchObject({ id: "ctx_link_tx_1", type: "withdrawal", amount: 1_717_665, currency: "KRW" });
  });
  it("USD 매도 × 원화 현금: +1,805,193 입금 / JPY: −2,262,500", () => {
    const r = ok(base(), usd("sell"), CASH);
    expect(r.data.cash[0].balance).toBe(6_805_193);
    expect(r.data.cashTransactions[0]).toMatchObject({ type: "deposit", amount: 1_805_193, currency: "KRW" });
    expect(ok(base(), jpy(), CASH).data.cash[0].balance).toBe(2_737_500);
  });
  it("USD × 대출: 매수 borrow 1,717,665 -> 4,717,665 / 매도 repay 1,805,193 -> 1,194,807", () => {
    const b = ok(base(), usd("buy"), LOAN);
    expect(b.data.loans[0].balance).toBe(4_717_665);
    expect(b.data.loanTransactions[0]).toMatchObject({ id: "ltx_link_tx_1", type: "borrow", amount: 1_717_665 });
    const s = ok(base(), usd("sell"), LOAN);
    expect(s.data.loans[0].balance).toBe(1_194_807);
    expect(s.data.loanTransactions[0]).toMatchObject({ type: "repay", amount: 1_805_193 });
  });
  it("삭제: 짝 기록 금액 그대로 되돌림(환율 재계산 없음), 현재 환율이 바뀌어도 같다", () => {
    for (const [t, c, pick] of [[usd("buy"), CASH, (x: AssetData) => x.cash[0].balance], [usd("sell"), CASH, (x: AssetData) => x.cash[0].balance], [usd("buy"), LOAN, (x: AssetData) => x.loans[0].balance], [jpy(), CASH, (x: AssetData) => x.cash[0].balance]] as const) {
      const before = base();
      const mid = ok(before, t, c).data;
      const plan = planRemoveLink(mid, t.id)!;
      expect(plan.currency).toBe("KRW");
      const back = removeLink({ ...mid, transactions: [txOf(t)] }, t.id).data;
      expect(pick(back)).toBe(pick(before));
      expect(back.cashTransactions).toEqual([]);
      expect(back.loanTransactions).toEqual([]);
    }
  });
  it("같은 거래 id 중복 연결 거부", () => {
    const r = ok(base(), usd("buy"), CASH);
    expect(link(r.data, usd("buy"), CASH)).toEqual({ ok: false, reason: "duplicate" });
  });
  it("stockLinkTrade가 거래의 exchangeRate를 넘긴다(저장 거래 자체로 환산)", () => {
    expect(stockLinkTrade(txOf(usd("buy"))).exchangeRate).toBe(1390);
    const r = ok(base(), stockLinkTrade(txOf(usd("buy"))), CASH);
    expect(r.amount).toBe(1_717_665);
  });
});

// ── 결산·홈: Σ원인 = 순자산 증감, 새 원인 줄 0 ──
const snap = (month: string, date: string, o: { cash: number; stock: number; stockCost: number; loans: number }): MonthlyAssetSnapshot => ({
  month, date, netAsset: o.cash + o.stock - o.loans, financialAsset: o.cash + o.stock,
  breakdown: { realEstate: 0, stocks: o.stock, crypto: 0, cash: o.cash, loans: o.loans, tenantDeposit: 0, physical: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: o.cash + o.stockCost, stock: o.stockCost, crypto: 0, realEstate: 0, physical: 0 },
});
const START = snap("2026-10", "2026-10-31", { cash: 5_000_000, stock: 20_000_000, stockCost: 20_000_000, loans: 3_000_000 });
const LIVE = { date: TODAY, _date: TODAY, _display: TODAY, netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
function run(d: AssetData, e: MonthlyAssetSnapshot) {
  const mapped = computeSettlementCauses({ start: START, end: e, live: LIVE, deltaNet: e.netAsset - START.netAsset, startDate: START.date!, endDate: e.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
  return { mapped, sum: mapped.causes.reduce((s, c) => s + c.amount, 0), detail: matchRecordedTransferDetail(d, START.date!, e.date!, RATES) };
}
// 주식 평가·원가는 체결 환율로 환산한 거래 금액(수수료 제외 시장가치)만큼 변한다
const stockKrw = (t: LinkTrade) => Math.round(t.quantity * t.price * (t.currency === "JPY" ? 9.05 : 1390));

describe("결산·홈 — Σ원인 = Δ순자산, 새 원인 줄 0, 짝 금액 차 ≤ 수수료 몫", () => {
  const cases: [string, LinkTrade, LinkChoice][] = [
    ["USD 매수 × 원화 현금", usd("buy"), CASH],
    ["USD 매도 × 원화 현금", usd("sell"), CASH],
    ["JPY 매수 × 원화 현금", jpy(), CASH],
    ["USD 매수 × 대출", usd("buy"), LOAN],
    ["USD 매도 × 대출", usd("sell"), LOAN],
    ["USD 소수 수량 0.5주 × 원화 현금", usd("buy", { quantity: 0.5, fee: 0 }), CASH],
  ];
  for (const [name, t, c] of cases) {
    it(name, () => {
      const r = ok(base(), t, c);
      const d = { ...r.data, transactions: [txOf(t)] };
      const buy = t.type === "buy";
      const sk = stockKrw(t) * (buy ? 1 : -1);
      const e = snap("2026-11", TODAY, {
        cash: d.cash[0].balance, stock: 20_000_000 + sk, stockCost: 20_000_000 + sk, loans: d.loans[0].balance,
      });
      const res = run(d, e);
      expect(Math.abs(res.sum - res.mapped.deltaNet)).toBeLessThan(1);
      // 연결이 없는 같은 데이터(짝 기록·잔액 변경 제거, 맞춘 잔액만)와 원인 키가 같거나 적다 — 새 원인 줄 0
      const keys = res.mapped.causes.map((x) => x.key);
      const allowed = new Set(["income", "unrecorded", "fx", "buy:stock", "sell:stock", "loan", "stockManual", "debt", "price", "stock"]);
      for (const k of keys) expect(allowed.has(k), `새 원인 줄: ${k}`).toBe(true);
      // 남는 원인은 수수료 몫 한 줄(국내 연결과 같은 유형)뿐, 수수료 0이면 원인 0
      const feeKrw = Math.round((t.fee ?? 0) * 1390);
      if (feeKrw === 0) expect(keys).toEqual([]);
      else { expect(keys.length).toBe(1); expect(Math.abs(res.sum)).toBeLessThanOrEqual(feeKrw + 1); }
      // id 짝: 내부 이동으로 잡힌 금액 = min(기록, 거래 KRW), 차이는 수수료 몫(+반올림 ≤ 1원)
      const tradeKrw = Math.round(t.quantity * t.price * (t.currency === "JPY" ? 9.05 : 1390));
      const paired = c.kind === "loan" ? (buy ? res.detail.viaLoan.buy : res.detail.viaLoan.sell) : buy ? res.detail.out.stock : res.detail.in.stock;
      expect(paired).toBeGreaterThan(0);
      expect(Math.abs(paired - Math.min(r.amount, tradeKrw))).toBeLessThanOrEqual(1); // id 짝 = min(기록, 거래 KRW)
      expect(Math.abs(r.amount - tradeKrw)).toBeLessThanOrEqual(feeKrw + 1);
    });
  }
  it("연결 없는 외화 거래는 결과 동일(diff 0): 짝 id 없음 -> 짝 0", () => {
    const d = { ...base(), transactions: [txOf(usd("buy"))] };
    const res = run(d, snap("2026-11", TODAY, { cash: 5_000_000, stock: 21_715_955, stockCost: 21_715_955, loans: 3_000_000 }));
    expect(res.detail.out.stock).toBe(0);
  });
});

describe("백업 왕복 — 짝 id·체결 환율·KRW 금액 보존 (저장 형식 변경 0)", () => {
  beforeEach(() => {
    g.window = globalThis; g.localStorage = memoryStorage();
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-08T03:00:00Z"));
  });
  afterEach(() => { vi.useRealTimers(); delete g.window; delete g.localStorage; });
  it("USD 거래 + 원화 현금·대출 짝 기록이 내보내기 -> 가져오기 후 그대로", () => {
    for (const c of [CASH, LOAN]) {
      const t = usd("buy");
      const d = { ...ok(base(), t, c).data, transactions: [txOf(t)] };
      const payload = JSON.parse(JSON.stringify({ assetData: d }));
      const back = applyImportedPayload(payload).assetData;
      expect(back.transactions[0].exchangeRate).toBe(1390);
      expect(back.cashTransactions.map((r) => [r.id, r.amount, r.currency])).toEqual(d.cashTransactions.map((r) => [r.id, r.amount, r.currency]));
      expect(back.loanTransactions.map((r) => [r.id, r.amount])).toEqual(d.loanTransactions.map((r) => [r.id, r.amount]));
      expect(getAssetData().transactions[0].exchangeRate).toBe(1390);
      expect(JSON.stringify((buildExportPayload().assetData as AssetData).cashTransactions)).toBe(JSON.stringify(back.cashTransactions));
    }
  });
});

describe("화면 소스 단언 — 환율 채움·안내 1줄·문구 규칙", () => {
  const root = path.resolve(__dirname, "../../..");
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");
  const input = read("app/(main)/_components/forms/trade/trade-input.tsx");
  const row = read("app/(main)/_components/forms/trade/link-account-row.tsx");
  it("buildTransaction이 연결 환산 시 체결 환율을 저장 시점에 채운다(화면 setValue만으로 처리하지 않음)", () => {
    expect(input).toMatch(/!\(data\.exchangeRate! > 0\) && linkEval\.state === "ok" && linkEval\.conv \? linkEval\.conv\.rate/);
    expect(input).toContain("onChange={handleLinkChange}");
  });
  it("환산 배수 사본 금지: tradeKrwRate는 asset-report 한 곳 export", () => {
    expect(read("lib/report/asset-report.ts")).toMatch(/export const tradeKrwRate/);
    expect(read("lib/trade/linked-record.ts")).toContain("tradeKrwRate");
  });
  it("안내 1줄: account-link-note, 문구 고정, 금지어·금액 없음", () => {
    expect(row).toContain('data-testid="account-link-note"');
    expect(row).toContain("지난달 거래는 계좌 잔액을 바꾸지 않아요");
    for (const w of ["연동", "계좌 연결", "자동", "동기화", "환전"]) expect(row.slice(row.indexOf("account-link-note") - 200, row.indexOf("account-link-note") + 300)).not.toContain(w);
  });
  it("그룹 라벨: 달러 현금·엔화 현금·원화 현금·현금 계좌·대출", () => {
    for (const l of ["달러 현금", "엔화 현금", "원화 현금", "현금 계좌"]) expect(row).toContain(l);
  });
});
