// 상세·주식 증권사별 합계(#319, 5.160) — 순수 함수(저장·React·서버 호출 없음).
// 평가·원가는 computeStockTotals를 묶음마다 그대로 호출한다(헤더와 값이 어긋나지 않게 재계산 금지).
// 화면 문자열의 합 = 헤더 문자열(C150): 원(달러 보기는 센트) 단위로 반올림한 뒤 최대 잔여 방식으로 흡수한다.
import type { Cash, Stock } from "@/types/asset";
import { ALL_SECURITIES_FIRMS, matchBrokerHint } from "@/config/asset-options";
import { isUnassignedBroker, sameBroker } from "@/lib/asset/resync/match";
import { largestRemainderTenths } from "@/lib/ratio-preview/ratio-list";
import { computeStockTotals, getMultiplier, type StockDisplayCurrency } from "@/app/(main)/_components/views/detail/asset-detail-tabs";

export const UNASSIGNED_BROKER_LABEL = "증권사 미지정";

export interface BrokerTotalRow {
  /** 표시 이름(목록 증권사와 맞으면 목록 이름, 아니면 사용자가 쓴 글자) */
  name: string;
  unassigned: boolean;
  /** 같은 종목(티커)은 이 증권사 안에서 1개로 센다 */
  count: number;
  /** 표시 단위 정수: KRW=원, USD=센트. 행 합 = 헤더 반올림값 */
  valueUnits: number;
  profitUnits: number;
  /** 수익률 %, 원가 0이면 null */
  profitRate: number | null;
  /** 비중 0.1% 단위 정수(합 1000, 값이 모두 0이면 0) */
  shareTenths: number;
}

export interface BrokerTotals {
  rows: BrokerTotalRow[];
  /** 1 = 원, 100 = 센트(달러 보기) */
  scale: 1 | 100;
}

/** 합이 target이 되도록 정수로 반올림(최대 잔여). 음수 허용 */
export function apportionUnits(raws: number[], target: number): number[] {
  const floors = raws.map((r) => Math.floor(r + 1e-9));
  let remain = target - floors.reduce((a, b) => a + b, 0);
  if (raws.length === 0) return floors;
  const order = raws
    .map((r, i) => ({ i, frac: r - floors[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  let k = 0;
  while (remain > 0) {
    floors[order[k % order.length].i] += 1;
    remain -= 1;
    k += 1;
  }
  k = order.length - 1;
  while (remain < 0) {
    floors[order[((k % order.length) + order.length) % order.length].i] -= 1;
    remain += 1;
    k -= 1;
  }
  return floors;
}

interface Group {
  name: string;
  raw: string;
  unassigned: boolean;
  rows: Stock[];
}

export function computeBrokerTotals(
  stocks: Stock[],
  exchangeRates: { USD: number; JPY: number },
  displayCurrency: StockDisplayCurrency = "KRW",
): BrokerTotals {
  const scale: 1 | 100 = displayCurrency === "USD" ? 100 : 1;
  const usd = exchangeRates.USD > 0 ? exchangeRates.USD : 1;
  const toUnits = (krw: number) => (scale === 100 ? (krw / usd) * 100 : krw);

  // 상장폐지·수량 0 행은 뺀다(헤더 합계와 같은 정책)
  const live = stocks.filter((s) => s.inactiveStatus !== "delisted" && s.quantity > 0);
  const groups: Group[] = [];
  for (const s of live) {
    const unassigned = isUnassignedBroker(s.broker);
    let g = unassigned ? groups.find((x) => x.unassigned) : groups.find((x) => !x.unassigned && sameBroker(x.raw, s.broker));
    if (!g) {
      const raw = (s.broker ?? "").trim();
      g = { name: unassigned ? UNASSIGNED_BROKER_LABEL : matchBrokerHint(raw) ?? raw, raw, unassigned, rows: [] };
      groups.push(g);
    }
    g.rows.push(s);
  }
  if (groups.length === 0) return { rows: [], scale };

  const totals = groups.map((g) => computeStockTotals(g.rows, exchangeRates, displayCurrency));
  const all = computeStockTotals(live, exchangeRates, displayCurrency);
  // 헤더 표시: 평가금 = round(합계 환산), 손익 = round(Math.round(손익) 환산)
  const valueTarget = Math.round(toUnits(all.totalValue));
  const profitTarget = Math.round(toUnits(Math.round(all.totalProfit)));
  const values = apportionUnits(totals.map((t) => toUnits(t.totalValue)), valueTarget);
  const profits = apportionUnits(totals.map((t) => toUnits(t.totalProfit)), profitTarget);
  const shares = largestRemainderTenths(totals.map((t) => Math.max(0, t.totalValue)));

  const rows: BrokerTotalRow[] = groups.map((g, i) => ({
    name: g.name,
    unassigned: g.unassigned,
    count: new Set(g.rows.map((s) => (s.ticker ? `t:${s.ticker}` : s.id))).size,
    valueUnits: values[i],
    profitUnits: profits[i],
    profitRate: totals[i].totalCost > 0 ? totals[i].totalProfitRate : null,
    shareTenths: shares[i],
  }));
  // 평가금 내림차순, 미지정은 항상 맨 아래
  const rawValue = new Map(rows.map((r, i) => [r, totals[i].totalValue]));
  rows.sort((a, b) => Number(a.unassigned) - Number(b.unassigned) || (rawValue.get(b) ?? 0) - (rawValue.get(a) ?? 0));
  return { rows, scale };
}

const noSpace = (s: string) => s.replace(/\s/g, "");
// 증권사 목록 값(공백 제거, '기타' 제외) — 현금 조인은 이 목록 안에서 정확히 같은 글자만
const FIRM_NAMES = new Set(ALL_SECURITIES_FIRMS.filter((f) => f !== "기타").map(noSpace));

/**
 * 증권사별 행 이름 → 그 증권사 현금 원화 합(#335, 5.167). 읽기 전용 참고값 — 헤더·행 평가금·비중에는 더하지 않는다(C150).
 * 매칭: 행 이름이 증권사 목록 값('기타' 제외)이고, 공백을 지운 cash.institution이 그 이름과 정확히 같을 때만.
 * sameBroker(부분 일치)는 쓰지 않는다 — '하나'·'키움' 같은 부분 글자, 은행('하나은행'), '기타'끼리가 붙지 않게.
 * 값 = round(Σ balance × getMultiplier) — 현금 카드와 같은 환산. 합 0원인 행은 Map에 넣지 않는다(줄 숨김).
 */
export function brokerCashByRow(rows: BrokerTotalRow[], cash: Cash[], exchangeRates: { USD: number; JPY: number }): Map<string, number> {
  const sums = new Map<string, number>();
  for (const c of cash) {
    const inst = noSpace(c.institution ?? "");
    if (!inst || !FIRM_NAMES.has(inst)) continue;
    sums.set(inst, (sums.get(inst) ?? 0) + c.balance * getMultiplier(c.currency, exchangeRates));
  }
  const out = new Map<string, number>();
  for (const r of rows) {
    if (r.unassigned) continue;
    const key = noSpace(r.name);
    if (!FIRM_NAMES.has(key)) continue;
    const krw = Math.round(sums.get(key) ?? 0);
    if (krw !== 0) out.set(r.name, krw);
  }
  return out;
}

/**
 * 배당 입금 폼 계좌 기본값(#339, 5.169) — 고른 종목 묶음(티커 단위 원본 행)의 증권사 현금 계좌 id, 없으면 null.
 * 증권사: 행 broker를 matchBrokerHint(raw) ?? raw로 맞춘 뒤(증권사별 행 이름과 같은 규칙) 미지정·목록 밖·'기타'를 빼고
 * 서로 다른 증권사가 정확히 1곳일 때만. 계좌: 공백을 지운 cash.institution이 그 이름과 정확히 같은 것만(5.167과 같은 규칙,
 * sameBroker 부분 일치 금지). 1개면 그 계좌, 2개 이상이면 종목 통화와 같은 통화 계좌가 1개일 때만. 잔액 0 계좌도 대상.
 */
export function brokerCashDefault(items: readonly Stock[], cash: readonly Cash[]): string | null {
  const firms = new Set<string>();
  for (const s of items) {
    if (isUnassignedBroker(s.broker)) continue;
    const raw = (s.broker ?? "").trim();
    const name = noSpace(matchBrokerHint(raw) ?? raw);
    if (FIRM_NAMES.has(name)) firms.add(name);
  }
  if (firms.size !== 1 || items.length === 0) return null;
  const [firm] = firms;
  const hits = cash.filter((c) => noSpace(c.institution ?? "") === firm);
  if (hits.length === 1) return hits[0].id;
  const currency = items[0].currency || "KRW";
  const same = hits.filter((c) => (c.currency || "KRW") === currency);
  return same.length === 1 ? same[0].id : null;
}

/**
 * 종목을 고를 때 계좌 칸을 어떻게 할지(#339) — 바꿀 게 없으면 null.
 * current가 비어 있거나 직전에 규칙이 채운 값(auto)일 때만 candidate로 바꾼다(없으면 빈칸으로 되돌림).
 * 통화 가드: 금액 > 0이고 바뀐 뒤 표시 통화(빈칸=원)가 지금과 다르면 손대지 않는다(₩ 금액이 $로 읽히는 오입력 방지).
 */
export function nextAutoCash(p: {
  current: string;
  auto: string | null;
  candidate: string | null;
  amount: number;
  cash: readonly Cash[];
}): { cashId: string; auto: string | null } | null {
  if (p.current !== "" && p.current !== p.auto) return null; // 사용자가 고른 계좌
  const target = p.candidate ?? "";
  if (target === p.current) return null;
  const currencyOf = (id: string) => (id ? p.cash.find((c) => c.id === id)?.currency || "KRW" : "KRW");
  if (p.amount > 0 && currencyOf(target) !== currencyOf(p.current)) return null;
  return { cashId: target, auto: p.candidate };
}
