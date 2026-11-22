// 투자 탭(#263) 데이터·계산 공용 타입. 데이터는 scripts/market-history/build.mjs가 CSV에서 만든 정적 JSON이다.
export type IndexKey = "spx" | "ndx" | "kospi";
export type RateKey = "us" | "kr";
export type EventIndex = "S&P" | "나스닥" | "코스피";
export type EventCategory = "금리·통화 정책" | "금융위기" | "시장 급락" | "전쟁·지정학" | "기술 거품" | "팬데믹" | "에너지";

/** 연속 월 계열: from(YYYY-MM)부터 한 달씩 v[0], v[1]… */
export interface MonthSeries {
  from: string;
  v: number[];
}
export interface IndexSeries {
  /** 첫 연말값의 연도 */
  start: number;
  close: number[];
  /** 위키 리비전 ID(출처 문구용) */
  rev: string;
}
export interface Recession {
  /** 고점 다음 달(YYYY-MM) */
  s: string;
  /** 저점 월(YYYY-MM) */
  e: string;
  n: number;
  peak: string;
}
export interface UsYearRow {
  y: number;
  y10: number | null;
  y10d: string;
  s2: number | null;
  s3: number | null;
  rec: number;
}
/** 미국 CPI-U 연평균 전년 대비 %·실업률 연평균 %(BLS 원자료, FRED 월값의 12개월 평균). 값 없으면 null */
export interface BlsYearRow {
  y: number;
  cpi: number | null;
  un: number | null;
}
export interface KrYearRow {
  y: number;
  base: number | null;
  k3: number | null;
  k10: number | null;
  d: string;
}
export interface MarketEvent {
  id: string;
  name: string;
  /** 표시 날짜(1차 출처 정밀도까지) */
  date: string;
  /** 점 위치 월(YYYY-MM) */
  pm: string;
  cat: EventCategory;
  fact: string;
  urls: string[];
  idx: EventIndex[];
}
export interface MarketHistoryData {
  last: number;
  idx: Record<IndexKey, IndexSeries>;
  rate: Record<RateKey, MonthSeries>;
  ovl: Record<RateKey, MonthSeries>;
  rec: Recession[];
  usYear: UsYearRow[];
  /** R2: 1961~ 미국 물가·실업률 연평균 */
  bls: BlsYearRow[];
  krYear: KrYearRow[];
  events: MarketEvent[];
  /** R4: 행 펼침·표 전용 사건(점 없음) */
  eventsExtra: MarketEvent[];
  /** R4: 금리차 월평균(%p), from부터 한 달씩. 없는 달 null */
  spread: { from: string; a: (number | null)[]; b: (number | null)[] };
  /** 해별 경제 이슈(1990~2026): 읽기 줄·격자·표·오른 해 펼침 공통 출처 */
  eventsYear: YearEvent[];
}
export interface YearEvent {
  y: number;
  id: string;
  name: string;
  date: string;
  cat: EventCategory;
  fact: string;
  urls: string[];
  region: "미국" | "글로벌" | "한국";
  /** 같은 해 안 시간순 키(월) */
  m: number;
  /** 2026 '진행 중' 행 */
  wip: boolean;
  /** 기존 정본 사건 id(있으면 이름·사실이 같다) */
  ref: string;
}
