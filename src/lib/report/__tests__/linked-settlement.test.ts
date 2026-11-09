// #103 연결 계좌 — 결산·홈 id 짝: 과거 결산 diff 0 골든 속성 테스트 + 연결 픽스처(F5·F6·F13·F14·F23·경계)
import { describe, expect, it } from "vitest";
import { computeSettlementCauses, matchRecordedTransferDetail, matchRecordedTransfers } from "@/app/(main)/_components/views/activity/change-hero";
import { computeAttributionBetween, getAttributionItems, type AttributionTransfer } from "@/lib/report/asset-report";
import { buildLink, type LinkTrade } from "@/lib/trade/linked-record";
import type { AssetData, MonthlyAssetSnapshot } from "@/types/asset";

const RATES = { USD: 1400, JPY: 900 };
const M = 1_000_000;

// ── 골든: 4.55(9a582ac) matchRecordedTransferDetail 원문 사본. 수정 금지 ──
interface LegacyDetail { out: { stock: number; crypto: number; physical: number; loan: number }; in: { stock: number; crypto: number } }
const MATCH_DAYS = 3;
const dayDiff = (a: string, b: string) => Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
function legacyMatch(assetData: AssetData, from: string | null, to: string, rates: { USD: number; JPY: number }): LegacyDetail {
  const detail: LegacyDetail = { out: { stock: 0, crypto: 0, physical: 0, loan: 0 }, in: { stock: 0, crypto: 0 } };
  if (!from) return detail;
  type Kind = keyof LegacyDetail["out"];
  const inWin = (d: string) => d > from && d <= to;
  const krw = (cur: string | undefined) => (cur === "USD" ? rates.USD : cur === "JPY" ? rates.JPY / 100 : 1);
  const outs = (assetData.cashTransactions ?? [])
    .filter((t) => t.reflected && t.type === "withdrawal" && inWin(t.date))
    .map((t) => ({ id: t.id, date: t.date, left: t.amount * krw(t.currency) }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const cands: { id: string; date: string; left: number; kind: Kind }[] = [
    ...(assetData.transactions ?? []).filter((t) => t.reflected && t.type === "buy" && inWin(t.date)).map((t) => ({
      id: `s:${t.id}`, date: t.date, kind: "stock" as const,
      // 엔진 reflectedTradeFlow와 같은 환산 — 체결 환율 우선(JPY 100엔당), 없으면 현재 환율
      left: t.quantity * t.price * (t.exchangeRate && t.exchangeRate > 0 ? (t.currency === "JPY" ? t.exchangeRate / 100 : t.currency === "KRW" ? 1 : t.exchangeRate) : krw(t.currency)),
    })),
    ...(assetData.cryptoTransactions ?? []).filter((t) => t.reflected && t.type === "buy" && inWin(t.date)).map((t) => ({ id: `c:${t.id}`, date: t.date, kind: "crypto" as const, left: t.quantity * t.price })),
    ...(assetData.loanTransactions ?? []).filter((t) => t.reflected && t.type === "repay" && inWin(t.date)).map((t) => ({ id: `l:${t.id}`, date: t.date, kind: "loan" as const, left: t.amount })),
    // 실물(#58): 거래내역이 없으므로 구간 안 매입일이 있는 신규분을 후보로 둔다(금액 = 매입가, 엔진 buy:physical과 같은 값)
    ...(assetData.physicalAssets ?? []).filter((p) => p.purchaseDate && inWin(p.purchaseDate) && p.purchasePrice > 0).map((p) => ({ id: `p:${p.id}`, date: p.purchaseDate, kind: "physical" as const, left: p.purchasePrice })),
  ];
  for (const o of outs) {
    const near = cands
      .filter((c) => c.left > 0 && dayDiff(c.date, o.date) <= MATCH_DAYS)
      .sort((a, b) => dayDiff(a.date, o.date) - dayDiff(b.date, o.date) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
    for (const c of near) {
      if (o.left <= 0) break;
      const m = Math.min(o.left, c.left);
      o.left -= m; c.left -= m; detail.out[c.kind] += m;
    }
  }
  return detail;
}

const data = (o: Partial<AssetData> = {}): AssetData => ({
  realEstate: [], stocks: [], crypto: [], cash: [], loans: [],
  yearlyNetAssets: [], transactions: [], cashTransactions: [], loanTransactions: [], cryptoTransactions: [],
  lastUpdated: "2026-01-01T00:00:00.000Z", nickname: "", ...o,
});

// 고정 seed 난수(mulberry32)
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const day = (n: number) => `2026-11-${String(1 + (n % 28)).padStart(2, "0")}`;

function randomData(seed: number): AssetData {
  const r = rng(seed);
  const int = (n: number) => Math.floor(r() * n);
  const pick = <T,>(a: T[]) => a[int(a.length)];
  const d = data();
  const n = () => 1 + int(8);
  for (let i = 0; i < n(); i++) d.transactions.push({ id: `tx_${seed}_${i}`, stockId: "s", ticker: "T", stockName: "종목", type: pick(["buy", "sell"] as const), quantity: 1 + int(5), price: (1 + int(9)) * 100_000, currency: pick(["KRW", "USD", "JPY"] as const), date: day(int(30)), reflected: r() > 0.15, createdAt: "x" } as AssetData["transactions"][number]);
  for (let i = 0; i < n(); i++) d.cryptoTransactions!.push({ id: `crtx_${seed}_${i}`, cryptoId: "c", symbol: "BTC", name: "BTC", type: pick(["buy", "sell"] as const), quantity: 1, price: (1 + int(9)) * 300_000, date: day(int(30)), reflected: r() > 0.15, createdAt: "x" } as NonNullable<AssetData["cryptoTransactions"]>[number]);
  for (let i = 0; i < n(); i++) d.cashTransactions.push({ id: `ctx_${1000 + i}_${seed}`, cashId: "a", type: pick(["deposit", "withdrawal"] as const), amount: (1 + int(9)) * 200_000, currency: pick(["KRW", "USD"] as const), date: day(int(30)), reflected: r() > 0.15, createdAt: "x" } as AssetData["cashTransactions"][number]);
  for (let i = 0; i < n(); i++) d.loanTransactions.push({ id: `ltx_${2000 + i}_${seed}`, loanId: "l", type: pick(["repay", "borrow"] as const), amount: (1 + int(9)) * 300_000, date: day(int(30)), reflected: r() > 0.15, createdAt: "x" } as AssetData["loanTransactions"][number]);
  if (r() > 0.5) d.physicalAssets = [{ id: "p1", type: "gold", name: "금", purchasePrice: (1 + int(5)) * 500_000, currentValue: 1, purchaseDate: day(int(30)), createdAt: "x" } as unknown as NonNullable<AssetData["physicalAssets"]>[number]];
  return d;
}

describe("과거 결산 diff 0 — 링크 id 없는 데이터에서 신/구 짝 내역 동일(골든 속성 테스트)", () => {
  it("무작위 400건: detail, matchedTransfer 동일, viaLoan 0, in 0", () => {
    for (let seed = 1; seed <= 400; seed++) {
      const d = randomData(seed);
      const from = day(seed % 5), to = day(10 + (seed % 20));
      const old = legacyMatch(d, from, to, RATES);
      const now = matchRecordedTransferDetail(d, from, to, RATES);
      expect({ out: now.out, in: now.in }).toEqual(old);
      expect(now.viaLoan).toEqual({ buy: 0, sell: 0 });
      expect(matchRecordedTransfers(d, from, to, RATES)).toBe(old.out.stock + old.out.crypto + old.out.physical + old.out.loan);
    }
  });
  it("from null이면 신/구 모두 0", () => {
    expect(matchRecordedTransferDetail(randomData(7), null, "2026-11-30", RATES)).toEqual({ ...legacyMatch(randomData(7), null, "2026-11-30", RATES), viaLoan: { buy: 0, sell: 0 } });
  });
});

// ── 연결 픽스처: 기대값 선기재 ──
const snap = (month: string, date: string, o: { cash: number; stock: number; stockCost: number; loans: number }): MonthlyAssetSnapshot => ({
  month, date, netAsset: o.cash + o.stock - o.loans, financialAsset: o.cash + o.stock,
  breakdown: { realEstate: 0, stocks: o.stock, crypto: 0, cash: o.cash, loans: o.loans, tenantDeposit: 0, physical: 0 },
  fx: { ...RATES }, fxBase: { USD: 0, JPY: 0 },
  cost: { total: o.cash + o.stockCost, stock: o.stockCost, crypto: 0, realEstate: 0, physical: 0 },
});
const START = snap("2026-10", "2026-10-31", { cash: 10 * M, stock: 20 * M, stockCost: 20 * M, loans: 30 * M });
const LIVE = { date: "2026-11-05", _date: "2026-11-05", _display: "2026-11-05", netAsset: 0, financialAsset: 0 } as unknown as Parameters<typeof computeSettlementCauses>[0]["live"];
const END = (o: { cash: number; stock: number; stockCost: number; loans: number }) => snap("2026-11", "2026-11-05", o);
const TODAY = "2026-11-05";
const trade = (type: "buy" | "sell", o: Partial<LinkTrade> = {}): LinkTrade => ({ id: "tx_1", type, quantity: 1, price: M, currency: "KRW", date: "2026-11-03", name: "삼성", ...o });
const txOf = (t: LinkTrade) => ({ id: t.id, stockId: "s", ticker: "005930", stockName: t.name, type: t.type, quantity: t.quantity, price: t.price, currency: t.currency, date: t.date, reflected: true, createdAt: "x" }) as AssetData["transactions"][number];
const base = () => data({ cash: [{ id: "a", type: "bank", name: "주거래", balance: 10 * M, currency: "KRW" }], loans: [{ id: "l", type: "credit", name: "신용", balance: 30 * M, interestRate: 0, startDate: "2025-01-01" }] });
function linked(t: LinkTrade, l: Parameters<typeof buildLink>[2], today = TODAY): AssetData {
  const b = buildLink(base(), t, l, today);
  if (!b.ok) throw new Error(b.reason);
  return { ...b.data, transactions: [txOf(t)] };
}
function run(d: AssetData, e: MonthlyAssetSnapshot) {
  const mapped = computeSettlementCauses({ start: START, end: e, live: LIVE, deltaNet: e.netAsset - START.netAsset, startDate: START.date!, endDate: e.date!, liveCash: 0, exchangeHistory: {}, assetData: d, rates: RATES }).mapped;
  const attr = computeAttributionBetween(START, e, {}, d, RATES, true)!;
  const transfer = matchRecordedTransferDetail(d, START.date!, e.date!, RATES) as AttributionTransfer;
  const items = getAttributionItems(attr, transfer);
  return { mapped, items, sumMapped: mapped.causes.reduce((s, c) => s + c.amount, 0), sumItems: items.reduce((s, i) => s + i.amount, 0), attr, detail: matchRecordedTransferDetail(d, START.date!, e.date!, RATES) };
}
const keys = (r: ReturnType<typeof run>) => r.mapped.causes.map((c) => c.key);

describe("연결 쌍 4종 — 같은 달 결산·홈 헤더 원인 0", () => {
  it("F5 매수+출금: 결산 원인 0, 홈 항목 0, out.stock 짝", () => {
    const r = run(linked(trade("buy"), { kind: "cash", cashId: "a" }), END({ cash: 9 * M, stock: 21 * M, stockCost: 21 * M, loans: 30 * M }));
    expect(keys(r)).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.detail.out.stock).toBe(M);
  });
  it("F6 매도+입금(신규): 결산 원인 0(수정 전 순유입 +X·기록 안 된 변화 −X), in.stock 짝, matchedTransfer 음수", () => {
    const d = linked(trade("sell"), { kind: "cash", cashId: "a" });
    const e = END({ cash: 11 * M, stock: 19 * M, stockCost: 19 * M, loans: 30 * M });
    const r = run(d, e);
    expect(keys(r)).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.detail.in.stock).toBe(M);
    expect(matchRecordedTransfers(d, START.date!, e.date!, RATES)).toBe(-M);
  });
  it("F6' 비연결 입금+매도: 수정 전과 같은 모양(순유입 +, 기록 안 된 변화 −)", () => {
    const d = linked(trade("sell"), { kind: "cash", cashId: "a" });
    d.cashTransactions = d.cashTransactions.map((c) => ({ ...c, id: "ctx_1731_zz" }));
    const r = run(d, END({ cash: 11 * M, stock: 19 * M, stockCost: 19 * M, loans: 30 * M }));
    expect(r.mapped.causes.map((c) => [c.key, c.amount])).toEqual([["income", M], ["unrecorded", -M]]);
    expect(r.detail.in).toEqual({ stock: 0, crypto: 0 });
  });
  it("F13 매수+대출 증가: 결산 원인 0, 대출 0, viaLoan.buy 짝", () => {
    const r = run(linked(trade("buy"), { kind: "loan", loanId: "l" }), END({ cash: 10 * M, stock: 21 * M, stockCost: 21 * M, loans: 31 * M }));
    expect(keys(r)).toEqual([]);
    expect(r.items).toEqual([]);
    expect(r.detail.viaLoan).toEqual({ buy: M, sell: 0 });
  });
  it("F14 매도+상환: 결산 원인 0, 대출 상환 0, viaLoan.sell 짝, 상환 기록이 출금 추정 후보로 재사용되지 않음", () => {
    const d = linked(trade("sell"), { kind: "loan", loanId: "l" });
    d.cashTransactions = [{ id: "ctx_1731_w", cashId: "a", type: "withdrawal", amount: M, currency: "KRW", date: "2026-11-03", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number]];
    const r = run(d, END({ cash: 9 * M, stock: 19 * M, stockCost: 19 * M, loans: 29 * M }));
    expect(r.detail.viaLoan.sell).toBe(M);
    expect(r.detail.out.loan).toBe(0);
    expect(r.sumMapped).toBe(r.mapped.deltaNet);
  });
  it("F13 + 별도 현금 지출: 대출 몫에 연결 대출분이 들어가지 않는다(대출 0, 기록 안 된 변화 −100만)", () => {
    const r = run(linked(trade("buy"), { kind: "loan", loanId: "l" }), END({ cash: 9 * M, stock: 21 * M, stockCost: 21 * M, loans: 31 * M }));
    expect(r.mapped.causes.map((c) => [c.key, c.amount])).toEqual([["unrecorded", -M]]);
    expect(r.sumMapped).toBe(r.mapped.deltaNet);
  });
  it("F23 정기 월급 입금 같은 날 + 연결 매도: 연결 쌍 0, 월급은 순유입으로 남음", () => {
    const d = linked(trade("sell"), { kind: "cash", cashId: "a" });
    d.cashTransactions.push({ id: "ctx_1731_pay", cashId: "a", type: "deposit", amount: 2 * M, currency: "KRW", recurring: true, date: "2026-11-03", reflected: true, createdAt: "x" } as AssetData["cashTransactions"][number]);
    const r = run(d, END({ cash: 13 * M, stock: 19 * M, stockCost: 19 * M, loans: 30 * M }));
    expect(r.mapped.causes.map((c) => [c.key, c.amount])).toEqual([["income", 2 * M]]);
    expect(r.detail.in.stock).toBe(M);
  });
  it("구간 경계: 시작일 당일 연결 쌍은 짝에서 제외(C15)", () => {
    const d = linked(trade("sell", { date: "2026-10-31" }), { kind: "cash", cashId: "a" }, "2026-10-31");
    expect(matchRecordedTransferDetail(d, "2026-10-31", "2026-11-05", RATES).in.stock).toBe(0);
  });
  it("항등식: 연결 저장 결과 어떤 경우에도 Σ결산 원인 = Δ순자산", () => {
    for (const [t, l, e] of [
      [trade("buy"), { kind: "cash", cashId: "a" }, END({ cash: 9 * M, stock: 21 * M, stockCost: 21 * M, loans: 30 * M })],
      [trade("sell"), { kind: "cash", cashId: "a" }, END({ cash: 11 * M, stock: 19 * M, stockCost: 19 * M, loans: 30 * M })],
      [trade("buy"), { kind: "loan", loanId: "l" }, END({ cash: 10 * M, stock: 22 * M, stockCost: 21 * M, loans: 31 * M })],
      [trade("sell"), { kind: "loan", loanId: "l" }, END({ cash: 10 * M, stock: 19.5 * M, stockCost: 19 * M, loans: 29 * M })],
    ] as const) {
      const r = run(linked(t, l), e);
      expect(r.sumMapped).toBe(r.mapped.deltaNet);
      expect(Math.abs(r.sumItems - r.attr.deltaNet)).toBeLessThan(10_000);
    }
  });
});
