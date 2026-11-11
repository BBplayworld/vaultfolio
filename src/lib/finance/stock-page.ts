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

// 그룹 거래 중 한 종류(기본 매수, 4.84 매도 점은 "sell")만. 날짜 오름차순. 점 표시 전용 — 평단·성적표 계산에 쓰지 않는다
export function pickBuyTransactions(transactions: Transaction[], groupStockIds: string[], type: "buy" | "sell" = "buy"): BuyTx[] {
  const ids = new Set(groupStockIds);
  return transactions
    .filter((t) => t.type === type && ids.has(t.stockId))
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

// 매수·매도 점을 한 배열로 — 날짜(봉) 순, 같은 봉이면 매수→매도(Tab 순서). 선택 키는 `${kind}:${index}`
export interface TradeMarker {
  key: string;
  kind: "buy" | "sell";
  index: number;
  d: string;
  c: number;
  txs: BuyTx[];
}

export function buildTradeMarkers(buyDots: BuyDot[], sellDots: BuyDot[]): TradeMarker[] {
  const mk = (kind: TradeMarker["kind"]) => (d: BuyDot): TradeMarker => ({ key: `${kind}:${d.index}`, kind, index: d.index, d: d.d, c: d.c, txs: d.buys });
  return [...buyDots.map(mk("buy")), ...sellDots.map(mk("sell"))].sort((a, b) => a.index - b.index || (a.kind === b.kind ? 0 : a.kind === "buy" ? -1 : 1));
}

export interface MarkerPos {
  marker: TradeMarker;
  x: number;
  y: number;
  spread: boolean; // 매수·매도가 가로 12px 미만이라 ±6px 벌렸는가
}

// 점 위치 — 서로 다른 종류가 가로 12px 미만이면 매수 −6px·매도 +6px로 벌린다(y는 봉 종가 그대로). 같은 종류끼리는 그대로
export function layoutMarkers(markers: TradeMarker[], xOf: (d: string) => number, yOf: (c: number) => number): MarkerPos[] {
  const pos: MarkerPos[] = markers.map((m) => ({ marker: m, x: xOf(m.d), y: yOf(m.c), spread: false }));
  for (const a of pos) {
    if (a.marker.kind !== "buy") continue;
    for (const b of pos) {
      if (b.marker.kind !== "sell" || a.spread || b.spread || Math.abs(a.x - b.x) >= 12) continue;
      const mid = (a.x + b.x) / 2;
      a.x = mid - 6;
      b.x = mid + 6;
      a.spread = true;
      b.spread = true;
    }
  }
  return pos;
}

// 점 히트 반경 — 이웃(매수+매도 모두) 거리의 절반, 최소 10·최대 20. 벌린 쌍은 6(좌우 반분)
export function markerHitRadius(pos: MarkerPos[], i: number): number {
  if (pos[i].spread) return 6;
  let nearest = Infinity;
  pos.forEach((o, j) => {
    if (j !== i) nearest = Math.min(nearest, Math.hypot(o.x - pos[i].x, o.y - pos[i].y));
  });
  return Math.max(10, Math.min(20, nearest / 2));
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
        const v = (e >= 0 ? i * m * pow(e) : (i * m) / pow(e)) + 0; // -0 → 0
        if (v < 0) continue; // 가격은 음수 눈금 없음
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
export function formatAxisPrice(raw: number, currency: string, step: number): string {
  const value = raw > 0 ? raw : 0; // -0·음수 방지
  if (currency === "USD") {
    const dec = step >= 1 || !(step > 0) ? 0 : Math.min(3, Math.ceil(-Math.log10(step) - 1e-9));
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
  }
  if (currency === "JPY") return `¥${Math.round(value).toLocaleString("en-US")}`;
  if (value >= 1e8) return `${trimDecimal(value / 1e8)}억`;
  if (value >= 1e4) return `${trimDecimal(value / 1e4)}만`;
  return Math.round(value).toLocaleString("ko-KR");
}

// 가격 칸(우측 gutter) 폭 — 11px 굵은 글꼴 글자별 폭 추정(숫자 6.8·쉼표/마침표 3.5·한글 12.5·그 외 7) + 텍스트 시작 오프셋 6 + 우측 여유 4, 46~82px
export const axisGutter = (tagText: string): number => {
  let w = 0;
  for (const ch of tagText) w += /[0-9]/.test(ch) ? 6.8 : /[,.]/.test(ch) ? 3.5 : /[\u3131-\uD79D]/.test(ch) ? 12.5 : 7;
  return Math.min(82, Math.max(46, w + 10));
};

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

// ---- 평단 칩 폴백(4.84 B) — 종목 한 장 차트. 칩이 가격선·점을 가리지 않는 곳만 쓴다 ----
export interface ChipPt {
  x: number;
  y: number;
}
export interface ChipPlacement {
  mode: "plot" | "short" | "gutter"; // plot = 전체 글자, short = 짧은 글자(`평단 6.15만`), gutter = 가격 칸 라벨
  text: string;
  x: number; // 칩 왼쪽(글자는 x+7)
  y: number; // 칩 위쪽(글자 baseline은 y+14)
}

export const CHIP_H = 20;
/** 칩 폭 = 글자 폭 추정(fontSize 11: 한글 10.5·숫자 6.2·구두점 3.1·공백 3·화살표 8) + 좌우 여백 7씩. 글자 수×상수로 재면 한글이 많은 문구가 칩 밖으로 넘친다(#4.85) */
export const chipWidth = (text: string) => {
  let w = 0;
  for (const ch of text) w += /[가-힣]/.test(ch) ? 10.5 : /[0-9]/.test(ch) ? 6.2 : /[,.]/.test(ch) ? 3.1 : ch === " " ? 3 : /[↑↓]/.test(ch) ? 8 : 6.5;
  return w + 14;
};
const SCAN_DY = [4, 12, 20, -24, -32, -40]; // 평단선 기준 세로 오프셋 — 선에서 가까운 순(|dy| 작은 순)
const SCAN_DX = 8;

// 1순위 기존 4곳(좌·우 끝 × 선 위·아래, 앞 후보) → 2순위 평단선 가까운 세로 오프셋 스캔 → 짧은 글자로 1·2 반복 → 가격 칸(gutter).
// 겹침 = 가격선 점이 칩 박스 ±2px 안, 매수·매도 점이 ±8px 안
export function placeAvgChip(a: { pts: ChipPt[]; dots: ChipPt[]; avgY: number; left: number; plotW: number; maxY: number; full: string; short: string; grid?: number[] }): ChipPlacement {
  const hits = (x: number, y: number, cw: number) =>
    a.pts.some((q) => q.x >= x - 2 && q.x <= x + cw + 2 && q.y >= y - 2 && q.y <= y + CHIP_H + 2) ||
    a.dots.some((q) => q.x >= x - 8 && q.x <= x + cw + 8 && q.y >= y - 8 && q.y <= y + CHIP_H + 8);
  const inBounds = (y: number) => y >= 0 && y + CHIP_H <= a.maxY;
  // 격자선이 칩 글자 띠를 지나면 글자가 취소선처럼 보인다 — 먼저 격자를 피하는 자리를 찾고, 없으면 격자 무시(#4.85)
  const onGrid = (y: number) => (a.grid ?? []).some((g) => g >= y - 1 && g <= y + CHIP_H + 1);
  const find = (text: string, avoidGrid = true): { x: number; y: number } | null => {
    const cw = chipWidth(text);
    if (cw > a.plotW) return null;
    for (const y of [a.avgY - CHIP_H - 4, a.avgY + 4]) {
      for (const x of [a.left, a.left + a.plotW - cw]) if (inBounds(y) && !(avoidGrid && onGrid(y)) && !hits(x, y, cw)) return { x, y };
    }
    for (const dy of SCAN_DY) {
      const y = a.avgY + dy;
      if (!inBounds(y) || (avoidGrid && onGrid(y))) continue;
      for (let x = a.left; x <= a.left + a.plotW - cw; x += SCAN_DX) if (!hits(x, y, cw)) return { x, y };
    }
    return null;
  };
  const f = find(a.full) ?? find(a.full, false);
  if (f) return { mode: "plot", text: a.full, ...f };
  const s = find(a.short) ?? find(a.short, false);
  if (s) return { mode: "short", text: a.short, ...s };
  return { mode: "gutter", text: "", x: a.left, y: a.avgY };
}
