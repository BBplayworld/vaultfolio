// 종목 한 장(#157) 가격 흐름 — KIS 기간별 시세(수정주가)를 100행씩 순차 페이징해 종가 시계열로 정규화한다.
// 국내 FHKST03010100(inquire-daily-itemchartprice, 최대 100건·내림차순), 해외 HHDFS76240000(dailyprice, 회차 100행·내림차순).
// 요청값은 ticker·range뿐이고 응답은 공개 시세라 사용자 보유 정보와 무관하다.
import { fetchWithTimeout, isKisResponseOk } from "@/lib/finance/finance-service";
import { getUsExchange } from "@/lib/finance/us-master";

export type PriceRange = "1y" | "5y";
export const PRICE_RANGES = ["1y", "5y"] as const;

export interface PricePoint {
  d: string; // YYYY-MM-DD
  c: number; // 수정 종가
}

export interface PriceHistory {
  ticker: string;
  range: PriceRange;
  currency: "KRW" | "USD";
  interval: "D" | "W";
  // 조회 창 시작일(서버 기준) — 창 밖 매수 판정용. CDN 캐시된 응답과 같은 날짜 기준을 쓰려고 응답에 싣는다
  from?: string;
  points: PricePoint[];
  // 상장 이후 기간만 있을 때(시작일보다 한참 늦게 첫 점) 첫 점 날짜
  listedFrom?: string;
}

// 회차당 최대 행 수(KIS 고정)와 무한 루프 방지 회차 상한(1년 일봉≈3회·5년 주봉≈3회 + 여유 1)
export const PAGE_SIZE = 100;
export const MAX_PAGES = 4;
// 첫 점이 시작일보다 이만큼(일) 넘게 늦으면 '상장 이후 기간만'으로 본다(주말·휴일·주봉 오차 허용)
const LISTED_TOLERANCE_DAYS = 10;

export interface RawRow {
  d: string;
  c: number;
}

function ymdToDate(s: string): Date {
  return new Date(`${s}T00:00:00Z`);
}

function dateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  const d = ymdToDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return dateToYmd(d);
}

export function rangeStart(todayStr: string, range: PriceRange): string {
  const d = ymdToDate(todayStr);
  if (range === "1y") d.setUTCDate(d.getUTCDate() - 365);
  else d.setUTCFullYear(d.getUTCFullYear() - 5);
  return dateToYmd(d);
}

export function toCompact(ymd: string): string {
  return ymd.replace(/-/g, "");
}

function fromCompact(s: string): string {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

// 원시 행 → 오름차순·날짜 중복 제거·c>0·시작일 이전 제외
export function buildPricePoints(rows: RawRow[], startStr: string): PricePoint[] {
  const byDate = new Map<string, number>();
  for (const r of rows) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.d)) continue;
    if (!(r.c > 0) || !Number.isFinite(r.c)) continue;
    if (r.d < startStr) continue;
    if (!byDate.has(r.d)) byDate.set(r.d, r.c);
  }
  return [...byDate.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, c]) => ({ d, c }));
}

export function computeListedFrom(points: PricePoint[], startStr: string, stoppedByShortPage: boolean): string | undefined {
  if (!stoppedByShortPage || points.length === 0) return undefined;
  const gap = (ymdToDate(points[0].d).getTime() - ymdToDate(startStr).getTime()) / 86_400_000;
  return gap > LISTED_TOLERANCE_DAYS ? points[0].d : undefined;
}

// 한 회차 조회 결과 — rows는 내림차순 원시 행(날짜 YYYY-MM-DD), null = 호출 실패
export type PageFetcher = (endStr: string) => Promise<RawRow[] | null>;

// 종료일에서 과거로 순차 페이징(병렬 금지). 시작일보다 오래된 행이 나오거나 100행 미만이면 중단
export async function collectPages(
  fetchPage: PageFetcher,
  todayStr: string,
  startStr: string,
): Promise<{ rows: RawRow[]; shortPage: boolean } | null> {
  const all: RawRow[] = [];
  let end = todayStr;
  let shortPage = false;
  for (let i = 0; i < MAX_PAGES; i++) {
    const page = await fetchPage(end);
    if (page === null) return null;
    all.push(...page);
    const valid = page.filter((r) => r.c > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.d));
    if (page.length < PAGE_SIZE || valid.length === 0) {
      shortPage = true;
      break;
    }
    const oldest = valid.reduce((m, r) => (r.d < m ? r.d : m), valid[0].d);
    if (oldest <= startStr) break;
    end = addDays(oldest, -1);
  }
  return { rows: all, shortPage };
}

interface KisAuth {
  accessToken: string;
  appKey: string;
  appSecret: string;
}

function kisHeaders(auth: KisAuth, trId: string): HeadersInit {
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    appkey: auth.appKey,
    appsecret: auth.appSecret,
    tr_id: trId,
    "content-type": "application/json; charset=utf-8",
  };
}

function domesticPager(ticker: string, startStr: string, range: PriceRange, auth: KisAuth): PageFetcher {
  const period = range === "1y" ? "D" : "W";
  return async (endStr) => {
    try {
      const url =
        `https://openapi.koreainvestment.com:9443/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice` +
        `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${encodeURIComponent(ticker)}` +
        `&FID_INPUT_DATE_1=${toCompact(startStr)}&FID_INPUT_DATE_2=${toCompact(endStr)}` +
        `&FID_PERIOD_DIV_CODE=${period}&FID_ORG_ADJ_PRC=0`;
      const res = await fetchWithTimeout(url, { headers: kisHeaders(auth, "FHKST03010100"), cache: "no-store" });
      if (!res.ok) return null;
      const data = await res.json();
      if (!isKisResponseOk(data, `국내 가격이력 ${ticker}/${endStr}`)) return null;
      const out = data.output2 as Record<string, string>[] | undefined;
      if (!Array.isArray(out)) return [];
      return out
        .filter((r) => r?.stck_bsop_date)
        .map((r) => ({ d: fromCompact(r.stck_bsop_date), c: parseFloat(r.stck_clpr ?? "0") }));
    } catch (e) {
      console.error(`[KIS 국내 가격이력 오류 - ${ticker}/${endStr}]:`, e);
      return null;
    }
  };
}

function overseasPager(ticker: string, range: PriceRange, auth: KisAuth): PageFetcher {
  const gubn = range === "1y" ? "0" : "1";
  // 거래소는 마스터에서, 없으면(ETF 등) 첫 성공 회차의 EXCD로 고정
  // 마스터 거래소는 힌트일 뿐(마스터가 전부 NAS) — [힌트, NAS, NYS, AMS] 순 폴백, 성공하면 고정
  const known = getUsExchange(ticker);
  let excdList = [...new Set([...(known ? [known] : []), "NAS", "NYS", "AMS"])];
  let succeeded = false;
  return async (endStr) => {
    let emptyOk = false;
    for (const excd of excdList) {
      try {
        // NCNT는 넣지 않는다(회차 100행). 수정주가 MODP=1
        const url =
          `https://openapi.koreainvestment.com:9443/uapi/overseas-price/v1/quotations/dailyprice` +
          `?AUTH=&EXCD=${excd}&SYMB=${encodeURIComponent(ticker)}&GUBN=${gubn}&MODP=1&BYMD=${toCompact(endStr)}`;
        const res = await fetchWithTimeout(url, { headers: kisHeaders(auth, "HHDFS76240000"), cache: "no-store" });
        if (!res.ok) continue;
        const data = await res.json();
        if (!isKisResponseOk(data, `해외 가격이력 ${ticker}/${excd}/${endStr}`)) continue;
        const out = data.output2 as Record<string, string>[] | undefined;
        if (!Array.isArray(out) || out.length === 0) {
          emptyOk = true;
          continue;
        }
        excdList = [excd];
        succeeded = true;
        return out
          .filter((r) => r?.xymd)
          .map((r) => ({ d: fromCompact(r.xymd), c: parseFloat(r.clos ?? "0") }));
      } catch (e) {
        console.error(`[KIS 해외 가격이력 오류 - ${ticker}/${excd}/${endStr}]:`, e);
      }
    }
    // 이미 데이터를 받은 뒤의 정상 빈 응답 = 상장 이전 끝, 그 밖(첫 회차 전원 실패·HTTP 오류)은 실패
    return succeeded && emptyOk ? [] : null;
  };
}

export interface FetchPriceHistoryInput {
  ticker: string;
  market: "kr" | "us";
  range: PriceRange;
  todayStr: string; // YYYY-MM-DD(KST)
  accessToken: string;
  appKey: string;
  appSecret: string;
}

// 실패(호출 오류)면 null. 시세 0건이면 points: []
export async function fetchPriceHistory(input: FetchPriceHistoryInput): Promise<PriceHistory | null> {
  const { ticker, market, range, todayStr } = input;
  const auth: KisAuth = { accessToken: input.accessToken, appKey: input.appKey, appSecret: input.appSecret };
  const startStr = rangeStart(todayStr, range);
  const pager = market === "kr" ? domesticPager(ticker, startStr, range, auth) : overseasPager(ticker, range, auth);
  const collected = await collectPages(pager, todayStr, startStr);
  if (!collected) return null;
  const points = buildPricePoints(collected.rows, startStr);
  const listedFrom = computeListedFrom(points, startStr, collected.shortPage);
  return {
    ticker,
    range,
    currency: market === "kr" ? "KRW" : "USD",
    interval: range === "1y" ? "D" : "W",
    from: startStr,
    points,
    ...(listedFrom ? { listedFrom } : {}),
  };
}
