// 상세 > 주식 '오늘' 등락 칩 — 장중이면 현재가 vs 전 거래일 종가, 그 밖이면 마지막 거래일 종가 vs 그 전 거래일 종가.
// (#134) 기존 useLivePrice 분기는 기준 종가를 "refDate === 오늘(KST)"로만 골라 개장 전·주말·한국 낮 미국 종목에서
// 같은 종가끼리 비교(0.0%·환율분만)하던 문제를 고친다. 기간 수익 계산(computeDailyStockProfit 기본 분기)과는 무관.
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import type { Stock } from "@/types/asset";
import { classifyTickers, normalizeTicker } from "@/lib/finance/finance-service";
import { isKrBusinessDay, rollbackToBusinessDay } from "@/lib/finance/kr-holidays";
import { isUsBusinessDay, rollbackToUsBusinessDay } from "@/lib/finance/us-holidays";

export type ChipMarket = "domestic" | "foreign";
// live=정규장 중 / afterCloseGap=마감 ~ 데이터 컷오프(국내 15:30~16:00, 미국 마감~+1h) / closed=그 밖 전부
export type ChipPhase = "live" | "afterCloseGap" | "closed";

export interface ChipSession {
  phase: ChipPhase;
  // live·afterCloseGap: 오늘(현지) 거래일 / closed: 마지막 거래일
  tradeDate: string;
  // tradeDate 직전 거래일(기준 종가일)
  baseDate: string;
}

// 마감 ~ 컷오프 구간에서 '현재가 = 정규장 종가'가 실측으로 확인됐는지(cto Q6).
// 미확인 → 이 구간은 칩을 숨긴다. 서버 시세 캐시가 1시간 슬롯(stock-cache-slot)이라 이 구간의 현재가가
// 마감 전 값일 수 있어 지금은 둘 다 false. 실측으로 확인되면 여기만 true로 바꾼다.
export const AFTER_CLOSE_GAP_CONFIRMED: Readonly<Record<ChipMarket, boolean>> = { domestic: false, foreign: false };

// 마감 ~ 컷오프 구간 미확인 시 live 견적(`오늘`, main useLivePrice와 같은 값)으로 대체할지.
// 국내만 true(15:30~16:00 현재가 ≈ 종가). 미국은 KST 06~07시라 애프터마켓 값 혼입 가능 → 숨김 유지.
export const AFTER_CLOSE_GAP_FALLBACK_LIVE: Readonly<Record<ChipMarket, boolean>> = { domestic: true, foreign: false };

// 칩 라벨 — 한 곳에서만 정의(ui-designer 320 행 높이 실측 뒤 대안으로 바꿀 수 있게, cto Q4)
// 본안: 종목 `오늘` / `M/D 종가`, 헤더 `오늘` / `종가`(UI 검수: `종가 기준`은 375 헤더 줄바꿈 회귀, 설정명과 혼동)
// 대안: 종목 `종가`, 헤더는 종가일이 하나면 `M/D 종가`, 여럿이면 `종가 기준`
export const TODAY_CHIP_LABELS = {
  live: "오늘",
  rowClosed: (closeDate: string) => `${formatMonthDay(closeDate)} 종가`,
  headerClosed: (_closeDates: string[]) => "종가",
};

const DOMESTIC_CATEGORIES = new Set(["domestic", "irp", "isa", "pension"]);

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00.000Z`);
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + n);
  return r;
}

export function formatMonthDay(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(m)}/${Number(d)}`;
}

// 미국 동부 현지 날짜·시각(서머타임 자동 반영)
function getEasternClock(now: Date): { date: string; hhmm: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hhmm: Number(get("hour")) * 100 + Number(get("minute")) };
}

// 시장·시각 → 장중/마감 직후/장 종료 후 + 종가일 쌍. 순수 함수(휴장 달력은 kr/us-holidays).
// 국내: 한국 영업일 09:00~15:30 장중, 15:30~16:00 마감 직후. 미국: 현지 영업일 09:30~16:00 장중, 16:00~17:00 마감 직후.
// 기준일은 설정 '기간 수익 종가 기준'과 무관하게 그 시장의 마지막 거래일이다.
export function getTodayChipSession(market: ChipMarket, now: Date = new Date()): ChipSession {
  let date: string;
  let hhmm: number;
  let open: number;
  let close: number;
  let cutoff: number;
  let isBiz: (d: Date) => boolean;
  let rollback: (d: Date) => Date;
  if (market === "domestic") {
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    date = ymd(kst);
    hhmm = kst.getUTCHours() * 100 + kst.getUTCMinutes();
    open = 900;
    close = 1530;
    cutoff = 1600;
    isBiz = isKrBusinessDay;
    rollback = rollbackToBusinessDay;
  } else {
    ({ date, hhmm } = getEasternClock(now));
    open = 930;
    close = 1600;
    cutoff = 1700;
    isBiz = isUsBusinessDay;
    rollback = rollbackToUsBusinessDay;
  }
  const today = parseYmd(date);
  const prevTradeOf = (d: Date) => ymd(rollback(addDays(d, -1)));
  if (isBiz(today) && hhmm >= open) {
    const phase: ChipPhase = hhmm < close ? "live" : hhmm < cutoff ? "afterCloseGap" : "closed";
    return { phase, tradeDate: date, baseDate: prevTradeOf(today) };
  }
  // 개장 전이면 전 거래일, 휴장·주말이면 직전 거래일이 마지막 거래일
  const last = isBiz(today) ? rollback(addDays(today, -1)) : rollback(today);
  return { phase: "closed", tradeDate: ymd(last), baseDate: prevTradeOf(last) };
}

export function getChipMarket(stock: Pick<Stock, "ticker" | "category">): ChipMarket {
  return classifyTickers([normalizeTicker(stock)]).krTickers.length > 0 ? "domestic" : "foreign";
}

// 종목 1개의 칩 등락(현지 통화 가격). 두 거래일 종가를 못 구하면 null — 같은 종가끼리의 0.0%를 내지 않는다.
export interface StockChipQuote {
  live: boolean;
  closeDate: string | null; // live면 null
  numerator: number; // 현지 통화 가격
  denominator: number;
}

export function getStockChipQuote(
  stock: Stock,
  refData: ProfitRefResponse | undefined,
  now: Date = new Date(),
  gapConfirmed: Readonly<Record<ChipMarket, boolean>> = AFTER_CLOSE_GAP_CONFIRMED,
): StockChipQuote | null {
  if (!refData || !stock.ticker || stock.category === "unlisted" || !stock.currentPrice) return null;
  const ref = refData[normalizeTicker(stock)];
  if (!ref || !(ref.refPrice > 0)) return null;
  const market = getChipMarket(stock);
  const s = getTodayChipSession(market, now);
  // 장중·마감 직후: 기준 종가 = 전 거래일 종가. 휴장 명목일(refDate가 휴장일, refPrice=직전 종가)도
  // baseDate ≤ refDate < 오늘이면 그 사이 거래가 없으므로 refPrice가 곧 전 거래일 종가다.
  const refIsBaseline = ref.refDate >= s.baseDate && ref.refDate < s.tradeDate;
  if (s.phase === "live") {
    return refIsBaseline ? { live: true, closeDate: null, numerator: stock.currentPrice, denominator: ref.refPrice } : null;
  }
  if (s.phase === "afterCloseGap") {
    if (!refIsBaseline) return null;
    if (!gapConfirmed[market]) {
      return AFTER_CLOSE_GAP_FALLBACK_LIVE[market]
        ? { live: true, closeDate: null, numerator: stock.currentPrice, denominator: ref.refPrice }
        : null;
    }
    return { live: false, closeDate: s.tradeDate, numerator: stock.currentPrice, denominator: ref.refPrice };
  }
  // 장 종료 후: 종가 응답의 두 거래일 종가로만(현재가 미사용 — 프리·애프터마켓 값 배제)
  if (ref.refDate === s.tradeDate && ref.prevDate === s.baseDate && ref.prevPrice !== undefined && ref.prevPrice > 0) {
    return { live: false, closeDate: s.tradeDate, numerator: ref.refPrice, denominator: ref.prevPrice };
  }
  // 휴장 구간 보강(U7): 서버가 덧붙인 칩 종가쌍이 지금 세션의 쌍과 같을 때만(서버 시각·CDN·로컬 캐시가 세션 경계를 넘은 응답 차단)
  const cp = ref.chipPair;
  if (cp && cp.closeDate === s.tradeDate && cp.baseDate === s.baseDate && cp.closePrice > 0 && cp.basePrice > 0) {
    return { live: false, closeDate: s.tradeDate, numerator: cp.closePrice, denominator: cp.basePrice };
  }
  return null;
}

export interface TodayChipResult {
  rate: number; // %
  anyLive: boolean;
  closeDates: string[]; // 장 종료 후 종목들의 종가일(중복 제거·오름차순)
}

// 칩 대상 종목 = 국내 6자리·미국 USD 티커이고 비상장·상장폐지·거래정지가 아니며 현재가가 있는 종목. 그 밖(일본 등)은 원래 칩이 없다
function chipTargetMarket(st: Stock): ChipMarket | null {
  if (!st.ticker || st.category === "unlisted" || st.inactiveStatus || !(st.quantity > 0) || !st.currentPrice) return null;
  const t = normalizeTicker(st);
  const { krTickers, usTickers } = classifyTickers([t]);
  if (krTickers.length > 0) return "domestic";
  if (usTickers.length > 0 && st.currency === "USD") return "foreign";
  return null;
}

// 칩 값: 종목별 현지 가격 등락을 원화 평가액(현재 환율)으로 가중 — 분자·분모 같은 환율이라 환율 효과 0.
// 종목 1개(같은 티커 묶음)면 곧 그 종목의 현지 가격 등락률. 칩이 없는 종목은 합산에서 뺀다.
// 부분 합산 숨김(cto 판정 2 ③): 칩 대상 종목 중 ① 응답을 아직 못 받은 종목이 있거나 ② 응답이 null이 아닌 대상 종목을 가진
// 시장(국내·미국) 중 칩이 하나도 없는 시장이 있으면 null. 원래 값이 없는 종목(거래정지·일본·기준가 null)은 숨김을 만들지 않는다.
export function computeTodayChip(
  stocks: Stock[],
  refData: ProfitRefResponse | undefined,
  currentRates: { USD: number; JPY: number },
  now: Date = new Date(),
  gapConfirmed: Readonly<Record<ChipMarket, boolean>> = AFTER_CLOSE_GAP_CONFIRMED,
): TodayChipResult | null {
  let num = 0;
  let den = 0;
  let anyLive = false;
  const dates = new Set<string>();
  const marketHasRef: Record<ChipMarket, boolean> = { domestic: false, foreign: false };
  const marketHasChip: Record<ChipMarket, boolean> = { domestic: false, foreign: false };
  for (const st of stocks) {
    const target = chipTargetMarket(st);
    if (target) {
      const key = normalizeTicker(st);
      if (!refData || !(key in refData)) return null; // ① 조회 중·한도로 비어 있음
      if (refData[key] !== null) marketHasRef[target] = true;
    }
    const q = getStockChipQuote(st, refData, now, gapConfirmed);
    if (!q) continue;
    if (target) marketHasChip[target] = true;
    const isForeign = !DOMESTIC_CATEGORIES.has(st.category);
    const fx = isForeign && st.currency === "USD" ? currentRates.USD : isForeign && st.currency === "JPY" ? currentRates.JPY / 100 : 1;
    num += q.numerator * st.quantity * fx;
    den += q.denominator * st.quantity * fx;
    if (q.live) anyLive = true;
    else if (q.closeDate) dates.add(q.closeDate);
  }
  if (!(den > 0)) return null;
  // ② 시장 단위로 비면(장 종료 직후·휴장 구간 등) 다른 시장만의 값을 내지 않는다
  if ((["domestic", "foreign"] as const).some((m) => marketHasRef[m] && !marketHasChip[m])) return null;
  return { rate: (num / den - 1) * 100, anyLive, closeDates: [...dates].sort() };
}

export function todayChipLabel(chip: TodayChipResult, scope: "row" | "header"): string {
  if (chip.anyLive) return TODAY_CHIP_LABELS.live;
  if (scope === "header") return TODAY_CHIP_LABELS.headerClosed(chip.closeDates);
  return chip.closeDates[0] ? TODAY_CHIP_LABELS.rowClosed(chip.closeDates[0]) : TODAY_CHIP_LABELS.live;
}

// 상세·주식 `등락률 순`(#132 ③, cto Q3): 칩에 보이는 등락률(소수 1자리) 높은 순, 부호 그대로(+3% → +1% → −2%).
// 칩이 없는 종목(rateOf = null)은 맨 뒤, 동률·칩 없는 종목끼리는 입력 순서(= 평가금 순)를 유지한다. 오름차순 없음
export function sortByChipRate<T>(items: readonly T[], rateOf: (item: T) => number | null): T[] {
  const tenths = (r: number) => Math.round(Number(r.toFixed(1)) * 10);
  return items
    .map((item, i) => {
      const r = rateOf(item);
      return { item, i, t: r === null || !Number.isFinite(r) ? null : tenths(r) };
    })
    .sort((a, b) => {
      if (a.t === null || b.t === null) return a.t === null ? (b.t === null ? a.i - b.i : 1) : -1;
      return b.t - a.t || a.i - b.i;
    })
    .map((x) => x.item);
}
