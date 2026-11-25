// 5.152 E: 같은 사건이 홈·주·월·연에서 어떤 원인 행으로 보이는지 한 표로 고정(현재 동작 기록 — 좋고 나쁨은 qa가 확정).
// 프로덕션 코드 diff 0. 픽스처는 year-settlement-fixture 재사용. 화면 사이 차이마다 `의도`/`결함` 주석을 단다.
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { buildLiveAttributionCurr } from "../asset-report";
import { computeChainCauses, computeSettlementCauses } from "@/app/(main)/_components/views/activity/change-hero";
import { computeAttributionView, mapWeekCauses } from "@/app/(main)/_components/views/activity/week-attribution";
import { M, R0, R1, mkSnap, state, summaryOf } from "./year-settlement-fixture";
import type { AssetData, DailyAssetSnapshot } from "@/types/asset";

const TODAY = "2026-11-20";
const START = "2026-10-31";
beforeAll(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`)); });
afterAll(() => vi.useRealTimers());

type Mut = (d: AssetData) => void;
function run(opts: { mutate: Mut; rates?: typeof R0; noCashAccount?: boolean }) {
  const rates = opts.rates ?? R0;
  const base = { krwPrice: 60000, cash: 32 * M, loan: 10 * M, tx: [], y2026: 112 * M, noCashAccount: opts.noCashAccount };
  const startData = state(base);
  const start = mkSnap(startData, R0, "2026-10", START);
  const end = structuredClone(startData);
  opts.mutate(end);
  const summary = summaryOf(end, rates);
  const live = buildLiveAttributionCurr(end, rates, summary);
  const deltaNet = summary.netAsset - start.netAsset;
  const common = { live, deltaNet, endDate: TODAY, liveCash: summary.cashValue, exchangeHistory: {}, assetData: end, rates };
  const view = computeAttributionView({ assetData: end, rates, summary, daily: [start as unknown as DailyAssetSnapshot], monthly: [], exchangeHistory: {}, sinceDate: START })!;
  const month = computeSettlementCauses({ ...common, start, end: null, startDate: START }).mapped;
  const year = computeChainCauses({ ...common, points: [start] }).mapped;
  const week = mapWeekCauses(view);
  const asObj = (cs: { key: string; amount: number }[]) => Object.fromEntries(cs.map((c) => [c.key, Math.round(c.amount)]));
  return { deltaNet, home: asObj(view.causes), week: asObj(week.causes), month: asObj(month.causes), year: asObj(year.causes), sums: [view.causes, week.causes, month.causes, year.causes].map((cs) => Math.round(cs.reduce((s, c) => s + c.amount, 0))) };
}
const cashTx = (id: string, type: "deposit" | "withdrawal", amount: number, reflected = true) =>
  ({ id, cashId: "c_krw", date: "2026-11-10", type, amount, currency: "KRW", reflected }) as AssetData["cashTransactions"][number];
const buyTx = (qty: number, price: number) =>
  ({ id: "b1", stockId: "s_kr", ticker: "005930", stockName: "국내주식", type: "buy", quantity: qty, price, currency: "KRW", date: "2026-11-10", reflected: true, createdAt: "2026-11-10T01:00:00.000Z" }) as AssetData["transactions"][number];

const eq = (r: ReturnType<typeof run>, e: { home: object; week: object; month: object; year: object }) => {
  expect(r.home).toEqual(e.home);
  expect(r.week).toEqual(e.week);
  expect(r.month).toEqual(e.month);
  expect(r.year).toEqual(e.year);
  // 합 = Hero 증감(홈·주·월·연 모두)
  for (const sum of r.sums) expect(sum).toBe(r.deltaNet);
};

describe("E 원인 일관성 — 같은 사건 × 홈·주·월·연", () => {
  it("E1 구간 안 새 현금 계좌 5백만 등록", () => {
    const r = run({ mutate: (d) => { d.cash.push({ id: "c_new", type: "bank", name: "새 통장", balance: 5 * M, currency: "KRW" } as AssetData["cash"][number]); } });
    // 의도: 홈 Hero는 자산군 단위 세분(4.79 O-1 `신규 현금`), 주·월·연은 결산 6줄 어휘라 cash→`기록 안 된 변화`(weekLineOf)
    eq(r, { home: { cash: 5 * M }, week: { unrecorded: 5 * M }, month: { unrecorded: 5 * M }, year: { unrecorded: 5 * M } });
  });
  it("E2 기록만 입금(reflected=false) 2백만 — 잔액에는 이미 포함", () => {
    const r = run({ mutate: (d) => { d.cash[0].balance += 2 * M; d.cashTransactions = [cashTx("d1", "deposit", 2 * M, false)]; } });
    // 의도: #293 기준 — 이미 잔액에 든 변화는 4화면 모두 순유입(차이 없음)
    eq(r, { home: { income: 2 * M }, week: { income: 2 * M }, month: { income: 2 * M }, year: { income: 2 * M } });
  });
  it("E3 짝 없는 주식 매수 6백만(현금 계좌 없음)", () => {
    const r = run({ noCashAccount: true, mutate: (d) => { d.stocks[0].quantity += 100; d.transactions = [buyTx(100, 60000)]; } });
    // 의도: 월·연은 cashTracked=false(현금 미등록)라 사고판 금액 순액을 `순유입`으로(4.94 결정 4-4, 5.152 C′ 도움말과 같은 기준)
    // 결함: 홈·주는 같은 사건을 `기록 안 된 변화`로 보임(spec 예상은 주 `순유입`) — 이슈 미등록, qa 확정 후 별도 이슈. LEARNINGS 10 '매수는 원인 아님'과 대조 필요
    eq(r, { home: { "price:stock": 1 * M, unrecorded: 5 * M }, week: { price: 1 * M, unrecorded: 5 * M }, month: { price: 1 * M, income: 5 * M }, year: { price: 1 * M, income: 5 * M } });
  });
  it("E4 대출 1천만 받아 주식 매수", () => {
    const r = run({ mutate: (d) => {
      d.loans[0].balance += 10 * M; d.stocks[0].quantity += 100; d.transactions = [buyTx(100, 100000)];
      d.loanTransactions = [{ id: "l1b", loanId: "l1", type: "borrow", amount: 10 * M, date: "2026-11-10", reflected: true, createdAt: "2026-11-10T01:00:00.000Z" } as AssetData["loanTransactions"][number]];
    } });
    // 의도: 월·연의 대출 행 정의는 `이자·자산에 안 남은 몫`(CAUSE_HINT.month.loan), 주는 잔액 변화 ±(4.79) — 정의 차이(G 보류 근거)
    // 결함: 홈·주가 대출 몫을 `기록 안 된 변화`로 보임 — 월·연은 `대출`. 이슈 미등록, qa 확정 후 별도 이슈
    eq(r, { home: { "price:stock": 1 * M, unrecorded: -5 * M }, week: { price: 1 * M, unrecorded: -5 * M }, month: { price: 1 * M, loan: -5 * M }, year: { price: 1 * M, loan: -5 * M } });
  });
  it("E5 환율 1500→1515 (외화 종목 보유)", () => {
    const r = run({ rates: R1, mutate: () => {} });
    // 의도: 4화면 모두 환율 행 하나, 합 = Hero(차이 없음)
    eq(r, { home: { fx: 300_000 }, week: { fx: 300_000 }, month: { fx: 300_000 }, year: { fx: 300_000 } });
  });
  it("E6 잔액 직접 수정(현금 −2백만, 기록 없음)", () => {
    const r = run({ mutate: (d) => { d.cash[0].balance -= 2 * M; } });
    // 의도: 4화면 모두 기록 안 된 변화(홈은 `현금 정리` cash 키 — 이름만 다르고 weekLineOf가 같은 줄로 합침)
    eq(r, { home: { cash: -2 * M }, week: { unrecorded: -2 * M }, month: { unrecorded: -2 * M }, year: { unrecorded: -2 * M } });
  });
});
