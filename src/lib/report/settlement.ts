// 월말 결산(#32) 순수 함수 — 월 스냅샷 보존·결산 구간·표시 매핑·.ics·주간 목록.
// 엔진(asset-report.ts)·홈 헤더는 건드리지 않고, 엔진 결과(effects)를 입력으로만 쓴다.
// 투자 조언 아님 — 사용자 자신의 기록 사이 변화만 계산한다. 서버로 보내는 값 없음(전부 기기 안 계산).

import type { DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import type { AttributionCauseKey } from "./asset-report";

// ── 13개월 롤링 보존 ─────────────────────────────────────────────

/** 보존 개월 수 — 현재월 포함 13개(전년 같은 달까지 비교 가능) */
export const SETTLEMENT_KEEP_MONTHS = 13;

/** "YYYY-MM"에 delta개월을 더한다(연 경계 처리) */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = idx - ny * 12 + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/**
 * 월 스냅샷 보존 규칙 — `month >= 현재월 − 12개월`만 남긴다(현재월 포함 최대 13개).
 * 종전 `startsWith(올해)` 필터는 1월 첫 저장에 전년분을 모두 지웠다(qa 확정 결함).
 * 입력보다 건수가 늘지 않고, 형식이 깨진 항목(month 없음)·현재월보다 미래인 달은 버린다.
 */
export function pruneMonthlySnapshots<T extends { month: string }>(all: T[], currentMonth: string): T[] {
  const cutoff = shiftMonth(currentMonth, -(SETTLEMENT_KEEP_MONTHS - 1));
  // 상한 = 현재월 — 시계가 앞선 기기가 보낸 미래 달이 병합·저장에 남아 결산·습관 축을 왜곡하지 않게(cto 축소 판정)
  return all.filter((s) => typeof s?.month === "string" && /^\d{4}-\d{2}$/.test(s.month) && s.month >= cutoff && s.month <= currentMonth);
}

// ── 결산 구간 ───────────────────────────────────────────────────

const lastDayOf = (month: string): number => {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};

/** 월 스냅샷의 기준일 — 실제 마지막 기록일(date), 레거시는 월말(엔진과 같은 폴백) */
export function snapshotDate(s: MonthlyAssetSnapshot): string {
  return s.date ?? `${s.month}-${String(lastDayOf(s.month)).padStart(2, "0")}`;
}

/** 두 YYYY-MM-DD 사이 일수(b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** 전월 스냅샷 date가 이 날 이후면 "전월 결산"으로 본다(추정 임계, 조정 가능) */
export const SETTLED_FROM_DAY = 21;
/** 진행 중 구간이라도 간격이 이 일수 이상이면 날짜 구간만 표기한다(추정 임계) */
export const RANGE_MIN_DAYS = 25;
/** 간격이 이 일수를 넘으면 헤더에 "기록 간격이 길어요" 안내(추정 임계) */
export const LONG_GAP_DAYS = 35;
/** 카드 노출 — 말일−3일부터 다음 달 이 날짜까지 */
export const CARD_UNTIL_DAY = 10;
const CARD_FROM_BEFORE_END = 3;

/** settled=지난 달 결산, range=진행 중이지만 25일 이상(날짜 구간 표기), in_progress=25일 미만, first_month=비교할 직전 기록 없음 */
export type SettlementKind = "settled" | "range" | "in_progress" | "first_month";

export interface SettlementWindow {
  month: string;                       // 대상 달 YYYY-MM
  kind: SettlementKind;
  start: MonthlyAssetSnapshot | null;  // 직전 기록(없으면 첫 달)
  end: MonthlyAssetSnapshot | null;    // 대상 달 기록. null = 진행 중(끝=오늘 실시간)
  startDate: string | null;
  endDate: string;
  startLegacy: boolean;                // date 없는 레거시 기록 → 날짜 대신 "YYYY-MM 기록"
  endLegacy: boolean;
  gapDays: number | null;
  longGap: boolean;
}

const sortByMonth = (monthly: MonthlyAssetSnapshot[]) =>
  [...monthly].filter((s) => typeof s?.month === "string").sort((a, b) => a.month.localeCompare(b.month));

/**
 * 대상 달의 결산 구간. 시작 = 대상 달 직전의 가장 최근 스냅샷(달이 건너뛰어도 허용).
 * 대상 달이 이번 달이면 끝 = 오늘(실시간), 지난 달이면 끝 = 그 달 스냅샷.
 */
export function resolveSettlementWindow(monthly: MonthlyAssetSnapshot[], month: string, today: string): SettlementWindow {
  const sorted = sortByMonth(monthly);
  const currentMonth = today.slice(0, 7);
  const start = [...sorted].reverse().find((s) => s.month < month) ?? null;
  const isCurrent = month >= currentMonth;
  const end = isCurrent ? null : sorted.find((s) => s.month === month) ?? null;
  const endDate = end ? snapshotDate(end) : today;
  const startDate = start ? snapshotDate(start) : null;
  const gapDays = startDate ? daysBetween(startDate, endDate) : null;
  let kind: SettlementKind;
  if (!start) kind = "first_month";
  else if (!isCurrent) kind = "settled";
  else kind = (gapDays ?? 0) >= RANGE_MIN_DAYS ? "range" : "in_progress";
  return {
    month, kind, start, end, startDate, endDate,
    startLegacy: !!start && !start.date,
    endLegacy: !!end && !end.date,
    gapDays,
    longGap: gapDays !== null && gapDays > LONG_GAP_DAYS,
  };
}

/**
 * 오늘 기준 결산 대상 달 — 1~10일이고 전월 스냅샷 기준일이 전월 21일 이후면 전월(결산),
 * 그 밖에는 이번 달(진행 중 구간). 메뉴 진입 시 월 탭의 기본 선택 달로도 쓴다.
 */
export function pickSettlementMonth(monthly: MonthlyAssetSnapshot[], today: string): string {
  const currentMonth = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  if (day <= CARD_UNTIL_DAY) {
    const prevMonth = shiftMonth(currentMonth, -1);
    const prev = monthly.find((s) => s.month === prevMonth);
    if (prev && Number(snapshotDate(prev).slice(8, 10)) >= SETTLED_FROM_DAY) return prevMonth;
  }
  return currentMonth;
}

/** 허브 결산 카드 노출 기간(말일−3일 ~ 다음 달 10일) */
export function isSettlementCardPeriod(today: string): boolean {
  const day = Number(today.slice(8, 10));
  return day <= CARD_UNTIL_DAY || day >= lastDayOf(today.slice(0, 7)) - CARD_FROM_BEFORE_END;
}

/** 허브 카드에 띄울 구간. 기간 밖·첫 달(비교할 직전 기록 없음)이면 null */
export function pickSettlementCard(monthly: MonthlyAssetSnapshot[], today: string): SettlementWindow | null {
  if (!isSettlementCardPeriod(today)) return null;
  const w = resolveSettlementWindow(monthly, pickSettlementMonth(monthly, today), today);
  return w.kind === "first_month" ? null : w;
}

/** 월 선택기 항목 — 현재월 포함 최근 13개월(오래된 순). 저장된 달·이번 달만 선택 가능 */
export function listSettlementMonths(monthly: MonthlyAssetSnapshot[], today: string): { month: string; enabled: boolean }[] {
  const currentMonth = today.slice(0, 7);
  const stored = new Set(monthly.map((s) => s.month));
  return Array.from({ length: SETTLEMENT_KEEP_MONTHS }, (_, i) => {
    const month = shiftMonth(currentMonth, i - (SETTLEMENT_KEEP_MONTHS - 1));
    return { month, enabled: month === currentMonth || stored.has(month) };
  });
}

/** "M/D" — 레거시는 "YYYY-MM 기록" */
export function formatSettlementPoint(date: string | null, legacyMonth?: string): string {
  if (legacyMonth) return `${legacyMonth} 기록`;
  if (!date) return "";
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
}

export function settlementRangeLabel(w: SettlementWindow): string {
  const a = formatSettlementPoint(w.startDate, w.startLegacy ? w.start!.month : undefined);
  const b = formatSettlementPoint(w.endDate, w.endLegacy ? w.end!.month : undefined);
  return `${a} → ${b}`;
}

const monthNum = (month: string) => Number(month.slice(5, 7));

/** 월 탭 헤더 제목 */
export function settlementTitle(w: SettlementWindow): string {
  if (w.kind === "range") return `${settlementRangeLabel(w)} 변화`;
  if (w.kind === "in_progress") return `${monthNum(w.month)}월 변화`;
  return `${monthNum(w.month)}월 결산`;
}

/** 허브 카드 제목 */
export function settlementCardTitle(w: SettlementWindow): string {
  if (w.kind === "range") return `${settlementRangeLabel(w)} 변화`;
  if (w.kind === "in_progress") return `${monthNum(w.month)}월 변화 · 진행 중`;
  return `${monthNum(w.month)}월 결산이 준비됐어요`;
}

/** GA settlement_view의 result — 월 1회 방문자의 날짜 구간 표기(range)는 settled로 분류 */
export function settlementGaResult(w: SettlementWindow): "settled" | "in_progress" | "first_month" {
  if (w.kind === "first_month") return "first_month";
  return w.kind === "in_progress" ? "in_progress" : "settled";
}

// ── 표시 매핑: 엔진 키 15종 → 결산 5항목 ──────────────────────────────

export type SettlementCauseKey = "price" | "valuation" | "fx" | "income" | "unrecorded";

export interface SettlementCause {
  key: SettlementCauseKey;
  amount: number;       // 원 단위 정수(반올림). 표시 항목 합계 = 반올림한 Δ순자산
  estimated: boolean;   // 기여 효과 중 하나라도 예측이면 true
}

export interface SettlementCauses {
  causes: SettlementCause[];  // 0원 항목 제외, 고정 순서
  deltaNet: number;           // 반올림한 Δ순자산
  showUnrecordedHint: boolean;
}

const PRICE_KEYS = new Set<AttributionCauseKey>(["price", "price:stock", "price:crypto"]);
const TRADE_KEYS = new Set<AttributionCauseKey>(["buy:stock", "sell:stock", "buy:crypto", "sell:crypto", "buy:realEstate", "sell:realEstate"]);
const POOL_EXTRA_KEYS = new Set<AttributionCauseKey>(["debt", "deposit"]);

const NOISE_WON = 10;

/** 기록 안 된 변화가 Δ순자산의 이 비율 이상이면 안내 한 줄(추정 임계) */
export const UNRECORDED_HINT_RATIO = 0.5;

/**
 * 월 탭 전용 매핑(spec §5-3). 내부 이동 풀 G = 매수·매도·대출·보증금, C = 현금 잔차.
 * - cashTracked(현금 등록 사용자): G와 C가 반대 부호면 min(|G|,|C|)만큼 서로 지운다(앱 안 이동은 순자산을 안 바꿈).
 * - !cashTracked(현금 미등록·입출금 기록 없음): 매수·매도만 순유입으로 귀속. 대출·보증금은 예외에 넣지 않는다.
 * 남은 G·C는 "기록 안 된 변화" = Δ순자산 − (시세+평가 갱신+환율+순유입) — 항등식 보장.
 */
export function mapSettlementCauses(
  effects: { key: AttributionCauseKey; amount: number; estimated?: boolean }[],
  ctx: {
    deltaNet: number;
    cashTracked: boolean;
    // 아래 3개는 월·연 탭 화면이 넘긴다(미지정 시 종전 동작, qa R1~R5)
    matchedTransfer?: number;           // 기록된 출금 ↔ 기록된 매수·상환으로 짝지어진 금액(KRW, 양수)
    hasCashRecords?: boolean;           // 구간 안 현금 거래 존재 — 있으면 "입출금을 기록하면" 안내를 띄우지 않음
    estimatedPriceAsUnrecorded?: boolean; // 예측 구간의 통합 시세 잔차는 시세가 아니라 기록 안 된 변화(예측)
  },
): SettlementCauses {
  const acc = { price: 0, valuation: 0, fx: 0, income: 0 };
  const est = { price: false, valuation: false, fx: false, income: false, unrecorded: false };
  // 기록으로 짝이 확인된 출금 → 매수·상환은 앱 안 이동 — 출금(순유입 −)을 그 금액만큼 되돌려, 같은 금액의 매수·상환
  // (내부 이동 풀)과 함께 0이 되게 한다(C23). 짝 없는 출금은 순유입 −로 남는다(qa R4·R5, cto 판정 b).
  if (ctx.matchedTransfer && ctx.matchedTransfer > 0) acc.income += ctx.matchedTransfer;
  for (const e of effects) {
    const flag = !!e.estimated;
    if (ctx.estimatedPriceAsUnrecorded && e.key === "price" && flag) { est.unrecorded = true; continue; } // qa R3
    if (PRICE_KEYS.has(e.key)) { acc.price += e.amount; est.price ||= flag; }
    else if (e.key === "price:realEstate") { acc.valuation += e.amount; est.valuation ||= flag; }
    else if (e.key === "fx") { acc.fx += e.amount; est.fx ||= flag; }
    else if (e.key === "income") { acc.income += e.amount; est.income ||= flag; }
    else if (TRADE_KEYS.has(e.key)) {
      if (ctx.cashTracked) est.unrecorded ||= flag; // 내부 이동 풀
      else { acc.income += e.amount; est.income ||= flag; }
    }
    else if (POOL_EXTRA_KEYS.has(e.key) || e.key === "cash") est.unrecorded ||= flag; // 내부 이동 풀
  }
  // 풀 G와 C를 반대 부호끼리 min(|G|,|C|)만큼 지워도 G+C는 그대로다 — 남은 몫(= 기록 안 된 변화)은
  // 아래 항등식(Δ순자산 − 표시 4항목)과 같으므로 별도 상쇄 계산 없이 항등식으로 구한다.
  const deltaNet = Math.round(ctx.deltaNet);
  const rounded = {
    price: Math.round(acc.price),
    valuation: Math.round(acc.valuation),
    fx: Math.round(acc.fx),
    income: Math.round(acc.income),
  };
  const unrecorded = deltaNet - rounded.price - rounded.valuation - rounded.fx - rounded.income;
  const all: SettlementCause[] = [
    { key: "price", amount: rounded.price, estimated: est.price },
    { key: "valuation", amount: rounded.valuation, estimated: est.valuation },
    { key: "fx", amount: rounded.fx, estimated: est.fx },
    { key: "income", amount: rounded.income, estimated: est.income },
    { key: "unrecorded", amount: unrecorded, estimated: est.unrecorded },
  ];
  return {
    // 0원 항목 숨김. 엔진 합계의 부동소수 오차로 생기는 10원 미만 잔차도 0원으로 본다.
    causes: all.filter((c) => Math.abs(c.amount) >= NOISE_WON),
    deltaNet,
    showUnrecordedHint: !ctx.hasCashRecords && Math.abs(unrecorded) >= NOISE_WON && Math.abs(unrecorded) >= Math.abs(deltaNet) * UNRECORDED_HINT_RATIO,
  };
}

export const SETTLEMENT_CAUSE_LABEL: Record<SettlementCauseKey, string> = {
  price: "시세 변동",
  valuation: "평가 갱신",
  fx: "환율 효과",
  income: "순유입",
  unrecorded: "기록 안 된 변화",
};

// ── 전체·주: 최근 7일 목록 ──────────────────────────────────────

export interface WeekRow { date: string; netAsset: number; diff: number | null }

/**
 * 일별 스냅샷(30일 롤링)에서 최근 7일(오늘 포함) 행과 7일 전 대비 증감.
 * 7일 전 기준점이 없으면 목록의 첫 행 대비. 기록이 없으면 rows=[]·weekDiff=null.
 */
export function buildWeekRows(daily: DailyAssetSnapshot[], today: string): { rows: WeekRow[]; weekDiff: number | null } {
  const sorted = [...daily].filter((s) => s?.date).sort((a, b) => a.date.localeCompare(b.date));
  const from = new Date(`${today}T00:00:00Z`);
  from.setUTCDate(from.getUTCDate() - 6);
  const fromStr = from.toISOString().slice(0, 10);
  const inWeek = sorted.filter((s) => s.date >= fromStr && s.date <= today);
  const rows = inWeek.map((s) => {
    const idx = sorted.indexOf(s);
    const prev = idx > 0 ? sorted[idx - 1] : null;
    return { date: s.date, netAsset: s.netAsset, diff: prev ? s.netAsset - prev.netAsset : null };
  });
  if (rows.length === 0) return { rows, weekDiff: null };
  const base = [...sorted].reverse().find((s) => s.date < fromStr) ?? inWeek[0];
  const last = inWeek[inWeek.length - 1];
  return { rows: rows.reverse(), weekDiff: base === last ? null : last.netAsset - base.netAsset };
}

// ── .ics (RFC 5545) ─────────────────────────────────────────────

const pad = (n: number) => String(n).padStart(2, "0");
const icsUtc = (d: Date) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

// 75옥텟 초과 줄은 CRLF + 공백으로 접는다(RFC 5545 3.1). UTF-8 멀티바이트 문자는 쪼개지 않는다.
function foldLine(line: string): string {
  const enc = new TextEncoder();
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length;
    const limit = out.length === 0 ? 75 : 74;
    if (bytes + b > limit) { out.push(cur); cur = ""; bytes = 0; }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

/**
 * "시크릿에셋 월말 결산" 반복 일정 1개 — 매월 마지막 날 21:00 KST(=12:00Z), 금액 없음.
 * 첫 일정은 now가 속한 KST 달의 말일. 서버 호출 없음(클라이언트 Blob 다운로드).
 */
// 정적 배포본(public/calendar) — iOS 서드파티 브라우저(WKWebView)·인앱은 blob 다운로드를 처리하지 못해
// 같은 출처 URL(text/calendar)로 연다(C19). 내용은 사용자 데이터 없는 고정 반복 일정이라 기준 시각을 고정한다.
// 파일 = buildSettlementIcs(SETTLEMENT_ICS_STAMP) — settlement-ics-static.test.ts가 일치를 고정
export const SETTLEMENT_ICS_PATH = "/calendar/secretasset-monthly-settlement.ics";
export const SETTLEMENT_ICS_STAMP = new Date("2026-10-01T00:00:00Z");

export function buildSettlementIcs(now: Date = new Date()): string {
  const kst = new Date(now.getTime() + 9 * 3_600_000);
  const y = kst.getUTCFullYear();
  const m = kst.getUTCMonth() + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dtStart = `${y}${pad(m)}${pad(last)}T120000Z`;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SecretAsset//Monthly Settlement//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    "UID:monthly-settlement@secretasset.xyz",
    `DTSTAMP:${icsUtc(now)}`,
    `DTSTART:${dtStart}`,
    "DURATION:PT30M",
    "RRULE:FREQ=MONTHLY;BYMONTHDAY=-1",
    "SUMMARY:시크릿에셋 월말 결산",
    "DESCRIPTION:이번 달 자산 변화를 확인해 보세요",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

// ── 전체·연: 올해 변화 원인 체인(#32 보완, B안) ──────────────────

const isEnriched = (s: MonthlyAssetSnapshot): boolean => !!(s.breakdown && s.fx && s.fxBase && s.cost);

/**
 * 연 탭 원인 체인 점 — [앵커, 올해 enrich 월 스냅샷(이번 달 제외)…]. 끝(실시간)은 호출부가 붙인다.
 * 앵커 = 전년 12월 월 스냅샷(있으면) 또는 Hero 시작과 같은 전년 수동 순자산(`${prevYear}-12-31`, netAsset만 → 예측 경로).
 * 체인은 올해(today 기준) 월만 쓴다 — 13개월 보존분의 전년 1~11월은 쓰지 않는다(C8). 레거시 달은 건너뛰어
 * 첫 구간(예측)에 흡수된다. 이번 달은 월 탭처럼 "직전 기록 → 실시간"이 되도록 점에서 뺀다.
 * 앵커를 만들 근거(전년 12월 스냅샷·수동값)가 없으면 null(기록 부족).
 */
export function resolveYearChain(
  monthly: MonthlyAssetSnapshot[],
  prevYear: number,
  prevYearNetAsset: number | null,
  today: string,
): MonthlyAssetSnapshot[] | null {
  const dec = monthly.find((s) => s?.month === `${prevYear}-12`);
  const anchor: MonthlyAssetSnapshot | null = dec
    ?? (prevYearNetAsset !== null
      ? { month: `${prevYear}-12`, date: `${prevYear}-12-31`, netAsset: prevYearNetAsset, financialAsset: prevYearNetAsset }
      : null);
  if (!anchor || snapshotDate(anchor) >= today) return null;
  const year = today.slice(0, 4);
  const currentMonth = today.slice(0, 7);
  const anchorDate = snapshotDate(anchor);
  const rest = monthly
    .filter((s) => typeof s?.month === "string" && s.month.startsWith(year) && s.month < currentMonth && isEnriched(s) && snapshotDate(s) > anchorDate)
    .sort((a, b) => a.month.localeCompare(b.month));
  return [anchor, ...rest];
}
