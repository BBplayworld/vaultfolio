/**
 * asset/grow-links.ts
 * 내 자산 불리기(#239) 요약 영역의 연결 문장 2개(순수 함수) — 기존 기능(배당·올해 결산)에서 '오래 둘 자산' 몫을 %로만 말한다.
 *  - 금액은 쓰지 않는다. '점검할'·'정하지 않음' 몫은 만들지 않는다(이름표끼리 견주지 않는다)
 *  - 문장을 없애는 것은 계산할 수 없을 때뿐이다. 줄어든 해에도 같은 자리에 문장이 있다(불어난 해만 골라 보이지 않게)
 *  - 저장·전송 0. 기준 시세는 기존 `profit?period=ytd`(작년 마지막 거래일 종가) 응답을 화면이 받아 넘긴다
 */

import type { Stock } from "@/types/asset";
import type { ProfitRefResponse } from "@/app/api/finance/profit/route";
import { normalizeTicker } from "@/lib/finance/finance-service";
import { getMultiplier } from "@/app/(main)/_components/views/detail/asset-detail-tabs";
import type { StockLabels } from "@/lib/asset/stock-labels";
import { kstDayText } from "@/lib/asset/grow-rows";

/** '오래 둘 자산' 이름표가 붙은 키 */
export function keepLabelKeys(labels: StockLabels): Set<string> {
  return new Set(Object.entries(labels.items).filter(([, i]) => i.label === "keep").map(([k]) => k));
}

export type GrowLink<T> = { state: "none" } | { state: "loading" } | ({ state: "shown" } & T);

// ─── 배당 ────────────────────────────────────────────────────────────────

export interface DividendLinkInput {
  /** 올해 배당(지급 + 예상) — 성과 허브 배당 카드와 같은 값 */
  annualTotal: number;
  /** 같은 조회에서 모은 이름표 키별 금액(반올림 전) */
  byLabelKey: ReadonlyMap<string, number>;
  isLoading: boolean;
  failedCount: number;
}

/**
 * `올해 예상 배당 중 오래 둘 자산 몫은 N%예요`.
 * 조회 중 → loading, 조회 실패가 1건이라도 있으면 none(비율이 틀려진다), 분모 0 → none, 분자 0 → `0%`.
 */
export function buildDividendLink(input: DividendLinkInput | undefined, keepKeys: ReadonlySet<string>): GrowLink<{ pct: number; text: string }> {
  if (!input || keepKeys.size === 0) return { state: "none" };
  if (input.failedCount > 0) return { state: "none" };
  if (input.isLoading) return { state: "loading" };
  // 분모도 반올림 전 합으로 낸다(카드 금액은 이 합을 반올림한 값)
  let total = 0;
  let keep = 0;
  for (const [key, amount] of input.byLabelKey) {
    total += amount;
    if (keepKeys.has(key)) keep += amount;
  }
  if (!(total > 0) || !(input.annualTotal > 0)) return { state: "none" };
  const pct = Math.min(100, Math.max(0, Math.round((keep / total) * 100)));
  return { state: "shown", pct, text: `${pct}%` };
}

// ─── 올해 결산 ───────────────────────────────────────────────────────────

/**
 * '올해 편입' 판정 — 매수일이 올해 1월 2일 이후이고 오늘 이하인 보유 건. 보유 건마다 본다(티커 묶음이 아니다).
 * 1월 1일은 휴장이라 실제 매수일일 수 없고 등록 화면의 기본값만 그 날짜다 — 기본값 그대로인 종목을 올해 산 것으로 잡지 않는다.
 * 비었거나 형식이 틀리거나 미래면 연초 전 보유로 본다.
 */
export function isBoughtThisYear(purchaseDate: string | undefined, today: string): boolean {
  if (!purchaseDate || !/^\d{4}-\d{2}-\d{2}$/.test(purchaseDate)) return false;
  return purchaseDate >= `${today.slice(0, 4)}-01-02` && purchaseDate <= today;
}

export interface SettleLinkInput {
  /** ytd 기준가(작년 마지막 거래일 종가). 키 = normalizeTicker, null = 기준가 없음으로 확정된 종목 */
  refs: ProfitRefResponse | undefined;
  /** 조회 상태 — failed면 문장 없음 */
  status: "loading" | "ready" | "failed";
}

export type SettleLink = GrowLink<{
  kind: "up" | "down" | "mixed";
  /** up·down일 때만 */
  pct: number | null;
  /** 기준 가격이 없어 계산에서 뺀 종목 수(0이면 꼬리 없음) */
  excluded: number;
}>;

/**
 * 올해 내 주식의 변동 중 '오래 둘 자산' 몫.
 *  - 대상: 티커 있고 비상장·상장폐지가 아닌 보유 건(기준가 조회 목록과 같은 집합)
 *  - 변동 = 수량 × (지금 시세 − 기준) × 지금 환율. 기준은 올해 편입이면 그 보유 건의 평단, 아니면 ytd 기준가
 *  - 기준가가 없는 종목(연초 전 보유인데 기준가 null)은 분자·분모에서 빼고 종목 수를 돌려준다(문장 끝 꼬리)
 *  - 분모·분자를 원 단위로 반올림한 뒤 3갈래 판정
 *  - none: '오래 둘' 0개, 조회 실패, 지금 시세 없는 종목이 있음, 분모 0, 계산에 든 종목이 없음(전부 기준가 없음),
 *    '오래 둘' 종목이 하나도 계산에 들지 못함
 */
export function buildSettleLink(
  stocks: Stock[],
  exchangeRates: { USD: number; JPY: number },
  keepKeys: ReadonlySet<string>,
  input: SettleLinkInput | undefined,
  nowMs: number,
): SettleLink {
  if (!input || keepKeys.size === 0 || input.status === "failed") return { state: "none" };
  const targets = stocks.filter((s) => s.ticker && s.category !== "unlisted" && s.inactiveStatus !== "delisted");
  if (targets.length === 0) return { state: "none" };
  if (targets.some((s) => !(s.currentPrice > 0))) return { state: "none" };
  if (input.status === "loading" || !input.refs) return { state: "loading" };

  const today = kstDayText(nowMs);
  let total = 0;
  let keep = 0;
  let included = 0;
  let keepIncluded = 0;
  const excluded = new Set<string>();
  for (const s of targets) {
    const key = normalizeTicker(s);
    let basis: number;
    if (isBoughtThisYear(s.purchaseDate, today)) {
      basis = s.averagePrice;
    } else {
      if (!(key in input.refs)) return { state: "loading" }; // 아직 다 받지 못했다
      const ref = input.refs[key];
      if (!ref || !(ref.refPrice > 0)) { excluded.add(key); continue; }
      basis = ref.refPrice;
    }
    const change = s.quantity * (s.currentPrice - basis) * getMultiplier(s.currency, exchangeRates);
    total += change;
    if (keepKeys.has(key)) { keep += change; keepIncluded++; }
    included++;
  }
  // 계산에 든 종목이 없거나, '오래 둘' 종목이 전부 기준가 없음으로 빠졌으면 몫을 말할 수 없다
  if (included === 0 || keepIncluded === 0) return { state: "none" };
  const den = Math.round(total);
  const num = Math.round(keep);
  if (den === 0) return { state: "none" };
  const base = { state: "shown" as const, excluded: excluded.size };
  if (den > 0 && num >= 0 && num <= den) return { ...base, kind: "up", pct: Math.round((num / den) * 100) };
  if (den < 0 && num <= 0 && num >= den) return { ...base, kind: "down", pct: Math.round((num / den) * 100) };
  return { ...base, kind: "mixed", pct: null };
}
