// 시장과 비교(#132) — 보유 종목 등락(지금 수량 × 시작 종가 가중, 현지 통화 가격)과 코스피·S&P 500 등락을 기간별로 계산.
// 기존 기간 수익 계산(computeDailyStockProfit·computePeriodStockProfitTotal·profit-chart)은 건드리지 않고
// 같은 ProfitRefResponse(기존 fetchProfitRef 캐시)를 읽기만 한다. 저장 호출 0, 금액 출력 0.
import type { ProfitRefEntry } from "@/app/api/finance/profit/route";
import type { MarketIndexResponse } from "@/app/api/finance/market-index/route";
import type { Stock } from "@/types/asset";
import { classifyTickers, normalizeTicker } from "@/lib/finance/finance-service";
import { isKrBusinessDay } from "@/lib/finance/kr-holidays";
import { isUsBusinessDay } from "@/lib/finance/us-holidays";

export type CompareMarket = "kr" | "us";
export type ComparePeriod = "daily" | "weekly" | "monthly";
export const COMPARE_PERIODS: readonly ComparePeriod[] = ["daily", "weekly", "monthly"];

export const MARKET_INDEX_NAME: Readonly<Record<CompareMarket, string>> = { kr: "코스피", us: "S&P 500" };
export const MARKET_INDEX_KEY: Readonly<Record<CompareMarket, keyof MarketIndexResponse>> = { kr: "KOSPI", us: "SPX" };

// 키가 없는 종목 = 조회 중, null = 기준가 없음(tech-review 6절 ②)
type RefMap = Readonly<Record<string, ProfitRefEntry | null>>;

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

// ── K1 국내 주식형 판별 ──────────────────────────────────────────

export interface KrMasterRow {
  code: string;
  fullName: string;
  market: string;
}

const KR_EQUITY_FUND_TYPES = new Set(["주식", "주식-파생형", "주식형"]);

// ETF 정식 명칭 괄호 속 펀드 유형(마지막 괄호, `합성` 표기는 건너뜀). 예: `…투자신탁[주식]` → 주식, `…(주식-파생형)(합성)` → 주식-파생형
export function etfFundType(fullName: string): string | null {
  const tokens = [...fullName.matchAll(/[([]([^)\]]+)[)\]]/g)].map((m) => m[1].trim()).filter((t) => t !== "합성");
  return tokens.length > 0 ? tokens[tokens.length - 1] : null;
}

// 코스피와 비교하는 국내 코드 = 개별주 전부(KOSPI·KOSDAQ·KOSDAQ GLOBAL·KONEX) + 기초시장 '국내' 주식형 ETF(레버리지·인버스 포함).
// 생성 파일 kr-kospi-peer-codes.ts의 정본 규칙(드리프트는 market-compare.test.ts가 마스터로 다시 만들어 대조).
export function deriveKospiPeerCodes(stockMaster: readonly KrMasterRow[], etfMaster: readonly KrMasterRow[]): string[] {
  const codes = new Set<string>();
  for (const s of stockMaster) if (s.code) codes.add(s.code);
  for (const e of etfMaster) {
    if (e.market !== "국내") continue;
    const t = etfFundType(e.fullName);
    if (t && KR_EQUITY_FUND_TYPES.has(t)) codes.add(e.code);
  }
  return [...codes].sort();
}

// 생성 목록은 비교 화면·글줄에서만 동적 import(첫 화면 번들 제외)
let peerCodesPromise: Promise<ReadonlySet<string>> | null = null;
export function loadKospiPeerCodes(): Promise<ReadonlySet<string>> {
  if (!peerCodesPromise) {
    peerCodesPromise = import("@/lib/data/kr-kospi-peer-codes").then((m) => new Set(m.KR_KOSPI_PEER_CODES.split(",")));
  }
  return peerCodesPromise;
}

// ── 보유 종목 분류(조건 4·7) ─────────────────────────────────────

export type NotComparedReason = "krNonEquity" | "foreignNonUs";
export type ExcludedReason = "noRef" | "unlisted" | "dateMismatch";

export interface CompareHolding {
  ticker: string;
  name: string;
  quantity: number; // 같은 티커 병합 합계
}

export interface ClassifiedHoldings {
  kr: CompareHolding[];
  us: CompareHolding[];
  notCompared: { ticker: string; name: string; reason: NotComparedReason }[];
  // 비상장·티커 없음(기간과 무관한 제외)
  unlisted: { name: string }[];
  // 상장폐지 — 기간과 무관하게 기준가 없음으로 제외
  delisted: { ticker: string; name: string }[];
}

// stocks 순서(호출부의 평가금 순)를 묶음 안 기본 순서로 유지한다. 같은 티커는 처음 나온 자리에 병합.
export function classifyHoldings(stocks: readonly Stock[], peerCodes: ReadonlySet<string>): ClassifiedHoldings {
  const out: ClassifiedHoldings = { kr: [], us: [], notCompared: [], unlisted: [], delisted: [] };
  const merged = new Map<string, CompareHolding>();
  const seenOther = new Set<string>();
  for (const st of stocks) {
    if (!(st.quantity > 0)) continue;
    const ticker = normalizeTicker(st);
    if (st.category === "unlisted" || !ticker) {
      out.unlisted.push({ name: st.name });
      continue;
    }
    let market: CompareMarket | null = null;
    let reason: NotComparedReason | null = null;
    if (DOMESTIC_CATEGORIES.has(st.category)) {
      if (peerCodes.has(ticker)) market = "kr";
      else reason = "krNonEquity";
    } else if (st.currency === "USD" && classifyTickers([ticker]).usTickers.length > 0) {
      market = "us";
    } else {
      reason = "foreignNonUs";
    }
    const key = `${market ?? reason}:${ticker}`;
    if (st.inactiveStatus === "delisted") {
      if (!seenOther.has(key)) out.delisted.push({ ticker, name: st.name });
      seenOther.add(key);
      continue;
    }
    if (market) {
      const prev = merged.get(key);
      if (prev) prev.quantity += st.quantity;
      else {
        const h = { ticker, name: st.name, quantity: st.quantity };
        merged.set(key, h);
        out[market].push(h);
      }
    } else if (reason && !seenOther.has(key)) {
      seenOther.add(key);
      out.notCompared.push({ ticker, name: st.name, reason });
    }
  }
  return out;
}

// ── 기간별 시작·끝 종가 ───────────────────────────────────────────

export interface PeriodRefs<T extends RefMap = RefMap> {
  daily?: T;
  weekly?: T;
  monthly?: T;
}

type Span =
  | { kind: "loading" }
  | { kind: "noRef" }
  | { kind: "ok"; start: number; end: number; startDate: string; endDate: string };

// 하루 = 일별 prev → ref, 1주·1개월 = 그 기간 ref → 일별 ref(기존 Hero와 같은 끝 종가)
function spanOf(key: string, period: ComparePeriod, refs: PeriodRefs): Span {
  const daily = refs.daily;
  if (!daily || !(key in daily)) return { kind: "loading" };
  const d = daily[key];
  if (period === "daily") {
    if (!d || !(d.refPrice > 0) || !(d.prevPrice !== undefined && d.prevPrice > 0) || !d.prevDate) return { kind: "noRef" };
    return { kind: "ok", start: d.prevPrice, end: d.refPrice, startDate: d.prevDate, endDate: d.refDate };
  }
  const p = refs[period];
  if (!p || !(key in p)) return { kind: "loading" };
  const pe = p[key];
  if (!d || !pe || !(d.refPrice > 0) || !(pe.refPrice > 0)) return { kind: "noRef" };
  return { kind: "ok", start: pe.refPrice, end: d.refPrice, startDate: pe.refDate, endDate: d.refDate };
}

const pctChange = (start: number, end: number) => (end / start - 1) * 100;

// ── 표시 규칙(소수 1자리, 차이 = 보이는 두 값의 차, C65) ──────────

// 표시 값(소수 1자리)을 정수 1/10 단위로 — toFixed는 상세·주식 칩과 같은 반올림
export function rateTenths(rate: number): number {
  const t = Math.round(Number(rate.toFixed(1)) * 10);
  return t === 0 ? 0 : t; // -0 제거
}

export function formatCompareRate(rate: number): string {
  const t = rateTenths(rate);
  return `${t > 0 ? "+" : t < 0 ? "-" : ""}${(Math.abs(t) / 10).toFixed(1)}%`;
}

export function formatCompareDiff(diffTenths: number): string {
  return `${diffTenths > 0 ? "+" : diffTenths < 0 ? "-" : ""}${(Math.abs(diffTenths) / 10).toFixed(1)}%p`;
}

// ── 시장 블록 계산 ───────────────────────────────────────────────

export type IndexState = "ok" | "loading" | "failed" | "dateMismatch";

export interface CompareRow {
  kind: "stock" | "index";
  ticker?: string; // stock만
  name: string;
  rate: number | null; // 휴장이면 null
}

export interface PeriodCell {
  // loading: 종목 또는 지수 응답 대기(부분 합 숫자 금지, A8) / holiday: 하루 구간이 그 시장 휴장 / empty: 합산할 종목 0 / ok
  state: "loading" | "holiday" | "empty" | "ok";
  startDate: string | null;
  endDate: string | null;
  holdingsRate: number | null;
  indexState: IndexState;
  indexRate: number | null;
  diffTenths: number | null; // 보유 종목·시장 둘 다 보일 때만
  includedCount: number;
  excluded: { ticker: string; name: string; reason: Exclude<ExcludedReason, "unlisted"> }[];
  // 종목별 목록: 등락률 높은 순 + 시장 줄(지수 ok일 때만). 휴장이면 입력 순서(평가금 순)·rate null·시장 줄 없음
  rows: CompareRow[];
}

const isBusinessDay = (market: CompareMarket, ymd: string) =>
  (market === "kr" ? isKrBusinessDay : isUsBusinessDay)(new Date(`${ymd}T00:00:00.000Z`));

// 지수 등락률 — 페이지 표와 진입 글줄이 같이 쓴다(같은 값·같은 반올림, A11)
export function computeIndexSpan(
  market: CompareMarket,
  period: ComparePeriod,
  index: PeriodRefs<MarketIndexResponse>,
): { state: "loading" | "failed" | "ok"; rate: number | null; startDate: string | null; endDate: string | null } {
  const s = spanOf(MARKET_INDEX_KEY[market], period, index as PeriodRefs);
  if (s.kind === "loading") return { state: "loading", rate: null, startDate: null, endDate: null };
  if (s.kind === "noRef") return { state: "failed", rate: null, startDate: null, endDate: null };
  return { state: "ok", rate: pctChange(s.start, s.end), startDate: s.startDate, endDate: s.endDate };
}

export function computePeriodCell(
  market: CompareMarket,
  period: ComparePeriod,
  holdings: readonly CompareHolding[],
  stockRefs: PeriodRefs,
  indexRefs: PeriodRefs<MarketIndexResponse>,
): PeriodCell {
  const cell: PeriodCell = {
    state: "loading", startDate: null, endDate: null, holdingsRate: null,
    indexState: "loading", indexRate: null, diffTenths: null, includedCount: 0, excluded: [], rows: [],
  };
  const idx = computeIndexSpan(market, period, indexRefs);
  const spans = holdings.map((h) => ({ h, s: spanOf(h.ticker, period, stockRefs) }));
  if (idx.state === "loading" || spans.some((x) => x.s.kind === "loading")) return cell;

  // 기준일 합의: 가장 많은 종목의 (시작, 끝) 쌍. 동수면 지수와 같은 쌍 → 더 늦은 쌍
  const counts = new Map<string, number>();
  for (const { s } of spans) if (s.kind === "ok") counts.set(`${s.startDate}|${s.endDate}`, (counts.get(`${s.startDate}|${s.endDate}`) ?? 0) + 1);
  const idxPair = idx.state === "ok" ? `${idx.startDate}|${idx.endDate}` : null;
  let pair: string | null = null;
  for (const [k, c] of counts) {
    const best = pair ? counts.get(pair)! : -1;
    if (c > best || (c === best && (k === idxPair || (pair !== idxPair && k > pair!)))) pair = k;
  }

  const included: { h: CompareHolding; start: number; end: number }[] = [];
  for (const { h, s } of spans) {
    if (s.kind === "noRef") cell.excluded.push({ ticker: h.ticker, name: h.name, reason: "noRef" });
    else if (s.kind === "ok" && `${s.startDate}|${s.endDate}` !== pair) cell.excluded.push({ ticker: h.ticker, name: h.name, reason: "dateMismatch" });
    else if (s.kind === "ok") included.push({ h, start: s.start, end: s.end });
  }
  cell.includedCount = included.length;
  if (!pair || included.length === 0) {
    cell.state = "empty";
    cell.indexState = idx.state === "ok" ? "ok" : "failed";
    cell.indexRate = idx.rate;
    return cell;
  }
  const [startDate, endDate] = pair.split("|");
  cell.startDate = startDate;
  cell.endDate = endDate;

  // 하루 구간이 그 시장 휴장(끝 종가일이 비영업일 = 휴장 명목일, 또는 시작·끝이 같은 날) → 0.0% 대신 휴장
  if (period === "daily" && (!isBusinessDay(market, endDate) || startDate === endDate)) {
    cell.state = "holiday";
    cell.indexState = idx.state === "ok" ? "ok" : "failed";
    cell.rows = included.map(({ h }) => ({ kind: "stock", ticker: h.ticker, name: h.name, rate: null }));
    return cell;
  }

  let startSum = 0;
  let endSum = 0;
  for (const { h, start, end } of included) {
    startSum += h.quantity * start;
    endSum += h.quantity * end;
  }
  cell.state = "ok";
  cell.holdingsRate = pctChange(startSum, endSum);

  if (idx.state === "failed") cell.indexState = "failed";
  else if (idx.startDate !== startDate || idx.endDate !== endDate) cell.indexState = "dateMismatch";
  else {
    cell.indexState = "ok";
    cell.indexRate = idx.rate;
    cell.diffTenths = rateTenths(cell.holdingsRate) - rateTenths(idx.rate!);
  }

  // 종목별 목록: 표시 등락률 높은 순(부호 그대로), 동률은 이름순. 시장 줄은 같은 값 종목들 뒤에 끼운다
  const stockRows: CompareRow[] = included
    .map(({ h, start, end }) => ({ kind: "stock" as const, ticker: h.ticker, name: h.name, rate: pctChange(start, end) }))
    .sort((a, b) => rateTenths(b.rate) - rateTenths(a.rate) || b.rate - a.rate || a.name.localeCompare(b.name, "ko"));
  if (cell.indexState === "ok") {
    const it = rateTenths(cell.indexRate!);
    const at = stockRows.findIndex((r) => rateTenths(r.rate!) < it);
    const indexRow: CompareRow = { kind: "index", name: MARKET_INDEX_NAME[market], rate: cell.indexRate };
    if (at === -1) stockRows.push(indexRow);
    else stockRows.splice(at, 0, indexRow);
  }
  cell.rows = stockRows;
  return cell;
}

export interface MarketCompareBlock {
  market: CompareMarket;
  count: number; // 비교 대상 종목 수(병합 후)
  periods: Record<ComparePeriod, PeriodCell>;
}

// 가진 시장만(국내 → 미국). 비교할 종목 0인 시장은 블록 없음
export function computeMarketCompare(
  classified: ClassifiedHoldings,
  stockRefs: PeriodRefs,
  indexRefs: PeriodRefs<MarketIndexResponse>,
): MarketCompareBlock[] {
  const blocks: MarketCompareBlock[] = [];
  for (const market of ["kr", "us"] as const) {
    const holdings = classified[market];
    if (holdings.length === 0) continue;
    const periods = {} as Record<ComparePeriod, PeriodCell>;
    for (const p of COMPARE_PERIODS) periods[p] = computePeriodCell(market, p, holdings, stockRefs, indexRefs);
    blocks.push({ market, count: holdings.length, periods });
  }
  return blocks;
}

// '비교하지 않은 종목' 묶음 — 시장 줄 없이 각자 등락만(현지 통화 가격). 조회 중이면 null, 기준가 없음·같은 날 종가는 rate null로 맨 뒤
export function computeNotComparedRows(
  notCompared: ClassifiedHoldings["notCompared"],
  period: ComparePeriod,
  stockRefs: PeriodRefs,
): CompareRow[] | null {
  const rows: CompareRow[] = [];
  for (const n of notCompared) {
    const s = spanOf(n.ticker, period, stockRefs);
    if (s.kind === "loading") return null;
    rows.push({
      kind: "stock",
      ticker: n.ticker,
      name: n.name,
      rate: s.kind === "ok" && s.startDate !== s.endDate ? pctChange(s.start, s.end) : null,
    });
  }
  return rows.sort((a, b) => {
    if (a.rate === null || b.rate === null) return a.rate === null ? (b.rate === null ? 0 : 1) : -1;
    return rateTenths(b.rate) - rateTenths(a.rate) || b.rate - a.rate || a.name.localeCompare(b.name, "ko");
  });
}

// 기준가 조회 대상 티커 — 비교 대상 + 비교하지 않은 종목(목록에 등락만 보임)
export function compareTickers(classified: ClassifiedHoldings): string[] {
  return [...classified.kr.map((h) => h.ticker), ...classified.us.map((h) => h.ticker), ...classified.notCompared.map((n) => n.ticker)];
}
