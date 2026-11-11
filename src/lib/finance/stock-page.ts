// 종목 한 장(#157) 순수 계산 — 머리 값(행과 같은 계산), 매수 점 위치, 평단선 범위, 창 밖 건수.
// 매수 점은 거래 기록(type === "buy")으로만 만든다 — purchaseDate(기본 1/1일 수 있음)로 점을 만들지 않는다(C74).
import {
  computeStockMetrics,
  formatByDisplayCurrency,
  mergeStockGroup,
  type StockDisplayCurrency,
} from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import { profitTone } from "@/app/(main)/_components/views/detail/detail-summary-header";
import { normalizeTicker } from "@/lib/finance/finance-service";
import type { PriceHistory, PricePoint } from "@/lib/finance/price-history";
import type { Stock } from "@/types/asset";
import type { Transaction } from "@/types/transaction";

type Rates = { USD: number; JPY: number };

export interface StockGroupHead {
  merged: Stock;
  currentVal: number;
  profit: number;
  profitRate: number;
  quantity: number;
  averagePrice: number; // 종목 통화(= 펼침 평단과 같은 값)
  // 상세·주식 행(StockRowHeader)과 같은 formatter·반올림 — 문자열까지 같다(C65)
  valueText: string;
  profitText: string; // 부호 + 금액
  rateText: string; // (부호 + n.n%)
  colorClass: string;
}

// 누른 행의 그룹 → 머리. 행은 mergeStockGroup + computeStockMetrics(비중 0)를 그대로 쓴다
export function buildStockGroupHead(items: Stock[], rates: Rates, displayCurrency: StockDisplayCurrency): StockGroupHead {
  const merged = mergeStockGroup(items);
  const m = computeStockMetrics(merged, rates, 0, displayCurrency);
  const tone = profitTone(m.profit, m.profitRate);
  const fmt = (v: number) => formatByDisplayCurrency(v, displayCurrency, rates.USD);
  return {
    merged,
    currentVal: m.currentVal,
    profit: m.profit,
    profitRate: m.profitRate,
    quantity: merged.quantity,
    averagePrice: merged.averagePrice,
    valueText: fmt(m.currentVal),
    profitText: `${tone.sign}${fmt(Math.round(tone.amount))}`,
    rateText: `(${tone.sign}${tone.rate.toFixed(1)}%)`,
    colorClass: tone.colorClass,
  };
}

// 가격 흐름을 조회할 수 있는 종목인가 — 비상장·티커 없음·상장폐지는 서버 요청 0
export function hasPriceFlow(stock: Pick<Stock, "ticker" | "category" | "inactiveStatus">): boolean {
  return !!stock.ticker && stock.category !== "unlisted" && stock.inactiveStatus !== "delisted";
}

// 시장 비교 종목 줄(티커) → 전체 탭 그룹(`t:ticker`)과 같은 구성
export function groupStocksByRowTicker(stocks: Stock[], ticker: string): Stock[] {
  return stocks.filter((s) => !!s.ticker && normalizeTicker(s) === ticker);
}

export interface BuyTx {
  id: string;
  date: string; // YYYY-MM-DD
  quantity: number;
  price: number; // 거래 원단가(차트 y로 쓰지 않는다)
  currency: string;
}

// 그룹 거래 중 매수만(점 대상). 날짜 오름차순
export function pickBuyTransactions(transactions: Transaction[], groupStockIds: string[]): BuyTx[] {
  const ids = new Set(groupStockIds);
  return transactions
    .filter((t) => t.type === "buy" && ids.has(t.stockId))
    .map((t) => ({ id: t.id, date: t.date, quantity: t.quantity, price: t.price, currency: t.currency }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface BuyDot {
  index: number; // points 인덱스(그날·그 주 봉)
  d: string; // 봉 날짜
  c: number; // 봉 종가 — 점의 y
  buys: BuyTx[]; // 같은 봉에 묶인 거래(점 1개)
}

// 매수일 이상인 첫 봉에 붙인다(일봉: 휴일 매수 → 다음 영업일 봉, 주봉: 그 주 마지막 영업일 봉). 마지막 봉보다 뒤면 마지막 봉.
// 창 시작(windowStart)보다 앞선 매수는 점 없이 건수만(outsideCount). y는 봉 종가이고 거래 단가는 쓰지 않는다.
// 주봉(interval W)은 봉 날짜가 그 주 첫 거래일이라 "매수일 이하인 마지막 봉"(그 주 봉)에 붙인다
export function placeBuyDots(points: PricePoint[], buys: BuyTx[], windowStart: string, interval: "D" | "W" = "D"): { dots: BuyDot[]; outsideCount: number } {
  let outsideCount = 0;
  const byIndex = new Map<number, BuyDot>();
  for (const b of buys) {
    if (b.date < windowStart) {
      outsideCount += 1;
      continue;
    }
    if (points.length === 0) continue;
    let idx: number;
    if (interval === "W") {
      idx = -1;
      points.forEach((p, i) => {
        if (p.d <= b.date) idx = i;
      });
      if (idx < 0) idx = 0;
    } else {
      idx = points.findIndex((p) => p.d >= b.date);
      if (idx < 0) idx = points.length - 1;
    }
    const hit = byIndex.get(idx);
    if (hit) hit.buys.push(b);
    else byIndex.set(idx, { index: idx, d: points[idx].d, c: points[idx].c, buys: [b] });
  }
  return { dots: [...byIndex.values()].sort((a, b) => a.index - b.index), outsideCount };
}

export interface YDomain {
  domain: [number, number];
  clamped: "none" | "up" | "down"; // 평단이 범위 밖이라 가장자리에 고정했는지
}

const PAD = 0.08; // 값 범위 위아래 여백
const AVG_REACH = 0.4; // 평단이 값 범위에서 이만큼(범위 폭 비율) 안이면 도메인을 평단까지 넓힌다

// y 도메인과 평단선 상태(ui.md §4). avg ≤ 0이면 평단선 없음(none)
export function computeYDomain(min: number, max: number, avg: number): YDomain {
  const span = Math.max(max - min, Math.abs(max) * 0.02, 1e-9);
  let lo = min;
  let hi = max;
  let clamped: YDomain["clamped"] = "none";
  if (avg > 0) {
    if (avg >= min - AVG_REACH * span && avg <= max + AVG_REACH * span) {
      lo = Math.min(lo, avg);
      hi = Math.max(hi, avg);
    } else if (avg > max) clamped = "up";
    else clamped = "down";
  }
  const pad = Math.max(hi - lo, Math.abs(max) * 0.02) * PAD;
  return { domain: [lo - pad, hi + pad], clamped };
}

// 등락률 표기 — 종목 한 장 머리 `stock-page-change`와 상세·주식 이름 줄 둘째 줄이 같은 함수(C65). 부호는 U+2212
export const signedRate = (v: number): string => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(1)}%`;

// 차트 구간 등락률(%) — 첫 점 대비 마지막 점. 점이 2개 미만이면 null
export function computePriceChange(points: PricePoint[]): number | null {
  if (points.length < 2) return null;
  const first = points[0].c;
  if (!(first > 0)) return null;
  return ((points[points.length - 1].c - first) / first) * 100;
}

// 행 미니 차트용 다운샘플(4.83) — 그리기 직전에만 쓴다(1년 %는 원본 points로 계산, C65). 첫·마지막 점 포함, x 순서 유지.
// 점이 max 이하면 그대로 돌려준다
export function downsample(points: PricePoint[], max: number): PricePoint[] {
  if (max < 2 || points.length <= max) return points;
  const out: PricePoint[] = [];
  const last = points.length - 1;
  for (let i = 0; i < max; i += 1) out.push(points[Math.round((i * last) / (max - 1))]);
  return out;
}

// ---- 가격 눈금(4.84) — 행 밴드와 종목 한 장이 같은 함수를 쓴다 ----
export interface AxisTick {
  v: number; // 눈금 가격 — 정확히 {1,2,5}×10^k
  y: number; // 픽셀 y
}
export interface NiceTicks {
  step: number;
  ticks: AxisTick[];
}

// {1,2,5}×10^k 눈금 2~3개를 고른다. 값은 정수 곱으로 만든다(i·m·10^e, 음수 지수는 정확한 10의 거듭제곱으로 나눔 — C59).
// keep(눈금 제거 조건)을 통과한 개수가 2~3인 가장 작은 간격, 없으면 1개, 그것도 없으면 0개. 픽셀 간격 12px 미만 후보·플롯 위아래 inset 밖 눈금은 제외
export function niceTicks(
  lo: number,
  hi: number,
  yOf: (v: number) => number,
  top: number,
  bottom: number,
  keep: (t: AxisTick) => boolean = () => true,
  inset = 6,
): NiceTicks {
  const span = hi - lo;
  if (!(span > 0) || !Number.isFinite(span)) return { step: 0, ticks: [] };
  const e0 = Math.floor(Math.log10(span / 3)) - 1;
  const pow = (n: number) => Math.pow(10, Math.abs(n));
  let fallback: NiceTicks | null = null;
  for (let k = 0; k < 5; k += 1) {
    for (const m of [1, 2, 5]) {
      const e = e0 + k;
      const step = e >= 0 ? m * pow(e) : m / pow(e);
      if (Math.abs(yOf(0) - yOf(step)) < 12) continue;
      const out: AxisTick[] = [];
      const first = Math.ceil(lo / step - 1e-9);
      const last = Math.floor(hi / step + 1e-9);
      for (let i = first; i <= last && out.length <= 12; i += 1) {
        const v = e >= 0 ? i * m * pow(e) : (i * m) / pow(e);
        const y = yOf(v);
        if (y >= top + inset && y <= bottom - inset) out.push({ v, y });
      }
      const kept = out.filter(keep);
      if (kept.length >= 2 && kept.length <= 3) return { step, ticks: kept };
      if (kept.length === 1 && !fallback) fallback = { step, ticks: kept };
    }
  }
  return fallback ?? { step: 0, ticks: [] };
}

const trimDecimal = (n: number) => String(+n.toFixed(2));

// 눈금 라벨 표기 — KRW 1.5억·5만·7.5만·5,000(원 생략), USD $160·$12.5·$0.25, JPY ¥1,500. 정밀값(태그·칩·호버)은 formatPrice를 쓴다
export function formatAxisPrice(value: number, currency: string, step: number): string {
  if (currency === "USD") {
    const dec = step >= 1 || !(step > 0) ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }
  if (currency === "JPY") return `¥${Math.round(value).toLocaleString("en-US")}`;
  if (value >= 1e8) return `${trimDecimal(value / 1e8)}억`;
  if (value >= 1e4) return `${trimDecimal(value / 1e4)}만`;
  return Math.round(value).toLocaleString("ko-KR");
}

// 가격 칸(우측 gutter) 폭 — 현재가 문자열 길이 기준 46~76px
export const axisGutter = (tagText: string): number => Math.min(76, Math.max(46, tagText.length * 6.4 + 10));

export interface PriceAxis {
  domain: [number, number];
  clamped: YDomain["clamped"];
  yOf: (v: number) => number;
  avgY: number | null; // 평단선 y — 범위 밖이면 가장자리(위 +7·아래 −7)에 고정. 평단 없음이면 null
  todayY: number | null; // 현재가 y — 없음/0이면 null
  step: number;
  ticks: (AxisTick & { label: string })[];
}

// 눈금·도메인은 **원본 points** 기준(다운샘플 40점 아님) + 현재가를 포함해 계산한다 — 선이 최고 눈금 위로 삐져나가지 않게.
// top·plotH는 플롯 영역(픽셀). 눈금은 평단선과 10px 미만, 현재가 태그와 겹치면(위 12px·아래 20px) 제외
export function buildPriceAxis(a: { points: PricePoint[]; avg: number | null; price: number | null; currency: string; top: number; plotH: number }): PriceAxis {
  const price = a.price && a.price > 0 ? a.price : null;
  const closes = a.points.map((p) => p.c);
  if (price !== null) closes.push(price);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const { domain, clamped } = computeYDomain(min, max, a.avg ?? 0);
  const yOf = (v: number) => a.top + (1 - (v - domain[0]) / (domain[1] - domain[0])) * a.plotH;
  const avgY = a.avg && a.avg > 0 ? (clamped === "up" ? a.top + 7 : clamped === "down" ? a.top + a.plotH - 7 : yOf(a.avg)) : null;
  const todayY = price !== null ? yOf(price) : null;
  const nt = niceTicks(domain[0], domain[1], yOf, a.top, a.top + a.plotH, (t) => {
    if (avgY !== null && Math.abs(t.y - avgY) < 10) return false;
    if (todayY !== null) return t.y < todayY ? todayY - t.y >= 12 : t.y - todayY >= 20;
    return true;
  });
  return { domain, clamped, yOf, avgY, todayY, step: nt.step, ticks: nt.ticks.map((t) => ({ ...t, label: formatAxisPrice(t.v, a.currency, nt.step) })) };
}

// 상세·주식 펼침 이름 줄(4.83) 상태 — none = 가격 흐름 없는 종목(`내 평단 보기`), loading, fallback = 실패·429·빈 응답(`주가 흐름과 내 평단 보기`).
// ready의 change·눈금 도메인은 원본 points로 계산(종목 한 장 `stock-page-change`와 같은 값 — C65). 선만 40점으로 줄여 그린다(밴드 컴포넌트)
export type RowFlow =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "fallback" }
  | { kind: "ready"; change: number; points: PricePoint[] };

export const ROW_SPARK_POINTS = 40;

export function buildRowFlow(flow: boolean, q: { isError: boolean; data?: PriceHistory }): RowFlow {
  if (!flow) return { kind: "none" };
  if (q.isError) return { kind: "fallback" };
  if (!q.data) return { kind: "loading" };
  const change = computePriceChange(q.data.points);
  if (change === null) return { kind: "fallback" };
  return { kind: "ready", change, points: q.data.points };
}
