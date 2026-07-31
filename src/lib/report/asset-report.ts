// 자산 성적표 계산 유틸 (Plus 산출물)
// - point-in-time: getAssetSummary 결과로 "넣은 돈 vs 번 돈(그중 환차익)" 분해
// - 시계열 원인분해 델타: 인리치드 스냅샷 2건으로 Δ순자산을 시세/환율/입출금으로 분해
// 투자 조언 아님 — 사용자 자신의 자산의 사실·구조·변화만 계산

import type { AssetData, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";
import { isKrBusinessDay } from "@/lib/kr-holidays";
import { isUsBusinessDay } from "@/lib/us-holidays";

// ── point-in-time 성적표 ──────────────────────────────────────────────
export interface AssetReport {
  totalCost: number;      // 넣은 돈 (총 투입원가, 부채 무관)
  equity: number;         // 자기자본 (= totalCost - 부채) — 실제 내가 넣은 돈
  totalProfit: number;    // 번 돈 (평가손익)
  totalProfitRate: number;   // 총자산 수익률 (= totalProfit / totalCost)
  equityReturnRate: number;  // 자기자본 수익률 gross (= totalProfit / equity, 레버리지 반영·이자 미차감). 성적표 뷰는 이자 차감 net rate를 별도 계산해 표시(ROE 표준)
  currencyGain: number;   // 그중 환차익 (해외주식)
  priceGain: number;      // 그중 순수 시세손익 (= totalProfit - currencyGain)
  perClass: { key: string; label: string; cost: number; value: number; profit: number }[];
  // 부채 실질 비용
  annualInterest: number;         // 연간 이자 추정 = Σ 잔액 × 금리 (전체 부채)
  monthlyInterest: number;        // 월 이자 추정 = annualInterest / 12
  // 대출별 상세 (연이자 내림차순). id는 성적표에서 해당 대출 수정 다이얼로그를 여는 딥링크용
  loanInterest: { id: string; name: string; balance: number; rate: number; annual: number; isRealEstate: boolean }[];
  // 투자 레버리지 이자 — 부동산 담보(mortgage-home·부동산 연계) 제외.
  // 부동산은 시세 자동갱신이 없어 수익 측정이 불가하므로, "이자 vs 투자 수익" 비교에는
  // 주식·배당 수익과 짝이 되는 투자성 레버리지 이자만 사용한다.
  annualInterestInvest: number;
  monthlyInterestInvest: number;
  // 투자 레버리지 잔액(부동산 담보 제외)과, 금융 투자 원가(주식+암호화폐) 중 대출이 차지하는 비율.
  // "레버리지가 벌어온 수익" = 총 투자수익 × 이 비율 (빌린 돈도 내 돈과 같은 수익률로 일한다고 가정)
  investLoanBalance: number;
  financialInvestCost: number; // 대출비율의 분모 = 주식원가 + 코인원가 (부동산·현금 제외)
  investLeverageRatio: number; // 0~1 (cap 1)
  debtRatio: number;              // 부채비율 (%) = 대출잔액 / 총자산
  leverage: number;               // 레버리지 배수 = totalCost / equity (equity ≤ 0이면 0)
}

export function buildAssetReport(data: AssetData, summary: AssetSummary): AssetReport {
  const currencyGain = summary.stockCurrencyGain;
  const priceGain = summary.totalProfit - currencyGain;
  // 자기자본 = 총원가 - 부채(대출 + 임차보증금). 순자산과 동일한 부채 기준.
  const equity = summary.totalCost - summary.loanBalance - summary.tenantDepositTotal;
  const equityReturnRate = equity > 0 ? (summary.totalProfit / equity) * 100 : 0;
  // 연간 이자 추정 — risk 프롬프트와 동일 수식 (단순 잔액 × 금리)
  const loanInterest = data.loans
    .filter((l) => l.balance > 0 && l.interestRate > 0)
    .map((l) => ({
      id: l.id,
      name: l.name,
      balance: l.balance,
      rate: l.interestRate,
      annual: l.balance * (l.interestRate / 100),
      isRealEstate: l.type === "mortgage-home" || !!l.linkedRealEstateId,
    }))
    .sort((a, b) => b.annual - a.annual);
  const annualInterest = loanInterest.reduce((sum, l) => sum + l.annual, 0);
  const annualInterestInvest = loanInterest.filter((l) => !l.isRealEstate).reduce((sum, l) => sum + l.annual, 0);
  // 투자 레버리지 잔액 — 금리 0이어도 잔액은 비율에 포함 (부동산 담보만 제외)
  const investLoanBalance = data.loans
    .filter((l) => l.balance > 0 && !(l.type === "mortgage-home" || !!l.linkedRealEstateId))
    .reduce((sum, l) => sum + l.balance, 0);
  const financialInvestCost = summary.stockCost + summary.cryptoCost;
  const investLeverageRatio = financialInvestCost > 0 ? Math.min(1, investLoanBalance / financialInvestCost) : 0;
  const debtRatio = summary.totalValue > 0 ? (summary.loanBalance / summary.totalValue) * 100 : 0;
  const leverage = equity > 0 ? summary.totalCost / equity : 0;
  const perClass = [
    { key: "stock", label: "주식", cost: summary.stockCost, value: summary.stockValue, profit: summary.stockProfit },
    { key: "crypto", label: "암호화폐", cost: summary.cryptoCost, value: summary.cryptoValue, profit: summary.cryptoProfit },
    { key: "realEstate", label: "부동산", cost: summary.realEstateCost, value: summary.realEstateValue, profit: summary.realEstateProfit },
  ].filter((c) => c.cost > 0 || c.value > 0);
  return {
    totalCost: summary.totalCost,
    equity,
    totalProfit: summary.totalProfit,
    totalProfitRate: summary.totalProfitRate,
    equityReturnRate,
    currencyGain,
    priceGain,
    perClass,
    annualInterest,
    monthlyInterest: annualInterest / 12,
    annualInterestInvest,
    monthlyInterestInvest: annualInterestInvest / 12,
    investLoanBalance,
    financialInvestCost,
    investLeverageRatio,
    loanInterest,
    debtRatio,
    leverage,
  };
}

// ── 기간별 원인분해 (스냅샷 기반) ─────────────────────────────────────
// Δ순자산을 직관적 원인으로 분해: 시세 / 환율 / 새로 넣은 자산(저축·신규 매수) / 부채 증감.
// 표시용 주 원인은 절대값 상위 1~2개(topCauses), 나머지도 restCauses로 이름을 살려 노출한다
// ("그 외" 한 덩어리로 접으면 환율·부채가 뭉쳐 무엇 때문인지 알 수 없다).
export type AttributionPeriod = "1w" | "1m" | "3m" | "ytd";

// 원인 키 — 시세·매수/매도는 자산군까지 명시한다("시세 상승"만으로는 주식인지 코인인지 알 수 없음).
// "price"(자산군 없는 통합 시세)는 시작 스냅샷이 레거시라 자산군 분해가 불가능한 예측 모드 전용.
export type AttributionCauseKey =
  | "price" | "price:stock" | "price:crypto" | "price:realEstate"
  | "fx"
  | "buy:stock" | "sell:stock"
  | "buy:crypto" | "sell:crypto"
  | "buy:realEstate" | "sell:realEstate"
  | "income" | "debt" | "rest";

export interface AttributionCause {
  key: AttributionCauseKey;
  label: string;
  amount: number;
  sentence: string; // 뷰가 그대로 렌더하는 문장
}

export interface PeriodAttribution {
  fromDate: string;
  toDate: string;
  deltaNet: number;
  priceEffect: number;   // 투자 성과(시세)
  fxEffect: number;      // 환율 영향
  savingEffect: number;  // 새로 넣은 자산 중 거래내역으로 설명되지 않는 잔여 (직접 입력 수정·코인·부동산 매수 등)
  buyEffect: number;     // 기간 내 반영된 주식 매수 체결액 (KRW 환산)
  sellEffect: number;    // 기간 내 반영된 주식 매도 체결액 (음수)
  incomeEffect: number;  // 현금 순유입 (기간 내 입금−출금, 월급·목돈 등. 미반영 소급 기록 포함)
  debtEffect: number;    // 부채 증감 (−Δ대출: 상환=+, 증가=−)
  // 시작 스냅샷이 v2 미만 → 예측 분해: Δ순자산·과거 순자산은 실측(스냅샷) 그대로 쓰되,
  // 저축·부채는 현재 자산 정보의 매수일·대출일로, 환율은 환율 이력 + 현재 외화노출로 추정
  estimated: boolean;
  topCauses: AttributionCause[]; // 주요 원인 1~2개
  restEffect: number;    // topCauses 외 나머지 합 (표시 합계 검증용)
  restCauses: AttributionCause[]; // topCauses 외 원인 중 표시 임계값 이상인 것들 (환율·부채 등)
}

const PERIOD_DAYS: Record<AttributionPeriod, number> = { "1w": 7, "1m": 30, "3m": 91, ytd: 366 };

// 원인 항목을 따로 표시할 최소 금액 — 만원 단위 반올림 표기라 1만원 미만은 "+0만원"이 되어 노이즈
export const CAUSE_DISPLAY_MIN = 10000;

const fmtManwon = (v: number): string => {
  const man = Math.round(Math.abs(v) / 10000);
  const sign = v >= 0 ? "+" : "−";
  if (man >= 10000) return `${sign}${(man / 10000).toFixed(1)}억원`;
  return `${sign}${man.toLocaleString()}만원`;
};

// 축약 정의형 라벨 — 방향(부호)까지 반영해 짧게. 홈 헤더 등 좁은 공간용이자 모든 라벨의 단일 출처
// (AttributionCause.label·서술형 문장이 모두 이 값에서 파생된다).
export function causeShortLabel(key: AttributionCauseKey, amount: number): string {
  switch (key) {
    case "price": return amount >= 0 ? "시세 상승" : "시세 하락";
    case "price:stock": return amount >= 0 ? "주식 시세 상승" : "주식 시세 하락";
    case "price:crypto": return amount >= 0 ? "코인 시세 상승" : "코인 시세 하락";
    case "price:realEstate": return amount >= 0 ? "부동산 시세 상승" : "부동산 시세 하락";
    case "fx": return amount >= 0 ? "환율 상승" : "환율 하락";
    case "buy:stock": return "주식 매수";
    case "sell:stock": return "주식 매도";
    case "buy:crypto": return "코인 매수";
    case "sell:crypto": return "코인 매도";
    case "buy:realEstate": return "부동산 매수";
    case "sell:realEstate": return "부동산 매도";
    case "income": return amount >= 0 ? "소득 유입" : "인출·지출";
    case "debt": return amount >= 0 ? "대출 상환" : "신규 대출";
    case "rest": return "그 외";
  }
}

// 효과값 → 사용자 문장 (증가/감소 방향별). 라벨은 causeShortLabel에서 파생해 두 표기가 어긋나지 않게 한다.
export function causeSentence(key: AttributionCauseKey, amount: number): string {
  const amt = fmtManwon(amount);
  const label = causeShortLabel(key, amount);
  switch (key) {
    case "price":
    case "price:stock":
    case "price:crypto":
    case "price:realEstate":
      return amount >= 0 ? `${label}으로 ${amt} 늘었어요.` : `${label}이 ${amt} 깎았어요.`;
    case "fx":
      return amount >= 0 ? `${label}이 ${amt} 보탰어요.` : `${label}이 ${amt} 깎았어요.`;
    // 매수·매도는 자산군을 라벨에 명시해 "새로 넣은 돈"이 어디로 갔는지 바로 읽히게 한다.
    case "buy:stock":
    case "buy:crypto":
    case "buy:realEstate":
      return `${label}로 ${amt} 늘었어요.`;
    case "sell:stock":
    case "sell:crypto":
    case "sell:realEstate":
      return `${label}로 ${amt} 줄었어요.`;
    case "income":
      return amount >= 0
        ? `월급·목돈 유입으로 ${amt} 늘었어요.`
        : `현금 인출·지출로 ${amt} 줄었어요.`;
    case "debt":
      // debtEffect는 대출 잔액 증감만 반영(임차보증금 제외) → "부채"보다 "대출"이 정확한 용어.
      // 매수(신규 유입)와 대칭을 이루도록 "새로 추가한 대출" 구조로 통일.
      return amount >= 0 ? `대출 상환으로 ${amt} 늘었어요.` : `새로 추가한 대출로 ${amt} 줄었어요.`;
    case "rest":
      return `그 외 요인 ${amt}.`;
  }
}

const makeCause = (key: AttributionCauseKey, amount: number): AttributionCause => ({
  key,
  label: causeShortLabel(key, amount),
  amount,
  sentence: causeSentence(key, amount),
});

// 원인 표시 순서(연관 원인끼리 인접하도록) — 시세·환율(시장 요인) → 주식 매수·매도(거래) →
// 주식 외 자산 추가(저축·코인·부동산) → 소득 → 대출 → 그 외. topCauses[0](가장 큰 원인, 지난 접속
// 브리핑의 한 줄 요약용)은 이 순서와 무관하게 기존 절대값 기준 선정을 그대로 유지한다.
const CAUSE_ORDER: Record<AttributionCauseKey, number> = {
  "price:stock": 0,
  "price:crypto": 1,
  "price:realEstate": 2,
  price: 3,
  fx: 4,
  "buy:stock": 5,
  "sell:stock": 6,
  "buy:crypto": 7,
  "sell:crypto": 8,
  "buy:realEstate": 9,
  "sell:realEstate": 10,
  income: 11,
  debt: 12,
  rest: 13,
};

// 표시용 원인 전체(topCauses+restCauses)를 카테고리 순서로 정렬 — 매수·매도처럼 연관된 원인이
// 절대값 크기와 무관하게 항상 나란히 보이도록. 합계·포함 여부(=pickTopCauses의 선정 로직)는 그대로,
// 오직 나열 순서만 바꾼다.
export function getOrderedCauses(attr: PeriodAttribution): AttributionCause[] {
  return [...attr.topCauses, ...attr.restCauses].sort((a, b) => CAUSE_ORDER[a.key] - CAUSE_ORDER[b.key]);
}

// 원인 리스트 표시용 — 표시 금액 합계 = deltaNet(반올림 오차 제외)을 보장하는 **단일 출처**.
// 홈 헤더(축약 라벨+만원)·성적표 원인분해(서술형 문장+원 단위)가 모두 이 함수를 쓴다
// — 뷰가 잔차를 각자 다시 계산하면 임계값이 갈려 두 화면 합계가 어긋난다(과거 P1 회귀 지점).
export interface AttributionDisplayItem {
  key: AttributionCauseKey;
  label: string;    // 축약 라벨(부호 방향 반영)
  sentence: string; // 서술형 문장
  amount: number;   // 색상 판정용 원값
  text: string;     // 부호+만원 표기
}

export function getAttributionItems(attr: PeriodAttribution): AttributionDisplayItem[] {
  const causes = [...getOrderedCauses(attr)];
  // 임계값 미만이라 펼치지 못한 잔차만 "그 외"로 — 이게 있어야 표시 합계가 deltaNet과 맞는다.
  // 이미 "그 외" 항목이 있으면 새로 만들지 않고 합산한다(같은 key 두 줄 방지).
  const shownRest = attr.restCauses.reduce((s, c) => s + c.amount, 0);
  const residual = attr.restEffect - shownRest;
  if (Math.abs(residual) >= CAUSE_DISPLAY_MIN) {
    const i = causes.findIndex((c) => c.key === "rest");
    if (i >= 0) causes[i] = makeCause("rest", causes[i].amount + residual);
    else causes.push(makeCause("rest", residual));
  }
  return causes.map((c) => ({
    key: c.key, label: c.label, sentence: c.sentence, amount: c.amount, text: fmtManwon(c.amount),
  }));
}

// 원인 전체를 한 줄로 결합 — 좁은 공간(홈 헤더 스크린샷·폴백용). 항목 집합은 getAttributionItems와 동일.
export function formatAttributionSentence(attr: PeriodAttribution): string | null {
  if (attr.topCauses.length === 0) return null;
  return getAttributionItems(attr).map((i) => `${i.label} ${i.text}`).join(" · ");
}

// 비교 시작일 표기: YYYY-MM-DD → M/D, YYYY-MM → M월 (홈 헤더·성적표 공용)
export function formatAttributionDate(d: string): string {
  const parts = d.split("-");
  if (parts.length >= 3) return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  return `${parseInt(parts[1])}월`;
}

// 효과 목록에서 절대값 상위 1~2개를 topCauses로 선정 (2위가 1위의 25% 미만이면 1개만).
// top에 못 든 원인도 임계값(1만원) 이상이면 restCauses로 이름을 살려 함께 돌려준다.
function pickTopCauses(rawEffects: { key: AttributionCauseKey; amount: number }[]): {
  topCauses: AttributionCause[];
  restEffect: number;
  restCauses: AttributionCause[];
} {
  // 같은 key가 두 번 들어올 수 있다(휴장일 억제로 시세가 "그 외"로 재라벨되는 경우 등) → 먼저 합산
  const byKey = new Map<AttributionCauseKey, number>();
  for (const e of rawEffects) byKey.set(e.key, (byKey.get(e.key) ?? 0) + e.amount);
  const effects = [...byKey].map(([key, amount]) => ({ key, amount }));
  const sorted = [...effects].sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  const top: typeof sorted = [];
  if (sorted.length > 0 && Math.abs(sorted[0].amount) > 0) {
    top.push(sorted[0]);
    if (sorted.length > 1 && Math.abs(sorted[1].amount) >= Math.abs(sorted[0].amount) * 0.25) {
      top.push(sorted[1]);
    }
  }
  const topKeys = new Set(top.map((t) => t.key));
  const rest = effects.filter((e) => !topKeys.has(e.key));
  const restEffect = rest.reduce((s, e) => s + e.amount, 0);
  const toCause = (t: { key: AttributionCauseKey; amount: number }) => makeCause(t.key, t.amount);
  return {
    topCauses: top.map(toCause),
    restEffect,
    restCauses: rest
      .filter((e) => Math.abs(e.amount) >= CAUSE_DISPLAY_MIN)
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .map(toCause),
  };
}

// 과거 구간 예측용: 현재 자산 정보의 매수일·대출일로 기간 내 신규 투입(저축)·신규 부채를 추정.
// 한계(예측치인 이유): 매수일은 항목당 1개(추가 매수 미분리), 이미 매도·상환한 과거 자산은 미포착.
// 단, 기간 내 반영 거래가 있는 주식은 reflectedTradeFlow(buy/sell)가 권위 소스이므로 건너뛴다
//  — 매수 반영 시 purchaseDate는 갱신되지 않아(원매수일 유지) 추가 매수가 이 추정에서 통째로 누락되던 문제 해소.
function estimatePeriodInflows(
  data: AssetData,
  fromDate: string,
  toDate: string,
  rates: { USD: number; JPY: number },
): { stock: number; crypto: number; realEstate: number; debt: number } {
  const inPeriod = (d?: string) => !!d && d > fromDate && d <= toDate;
  // 기간 내 반영 거래를 가진 종목 id — 이 종목의 투입은 buy/sell로 계산되므로 매수일 추정에서 제외
  const tradedStockIds = new Set(
    (data.transactions || [])
      .filter((t) => t.reflected && t.date > fromDate && t.date <= toDate)
      .map((t) => t.stockId),
  );
  let stock = 0;
  for (const s of data.stocks) {
    if (tradedStockIds.has(s.id)) continue;
    if (!inPeriod(s.purchaseDate)) continue;
    // 매입 시점 환율 우선(purchaseExchangeRate), 없으면 현재 환율로 환산 (JPY는 100엔당)
    const pr = s.purchaseExchangeRate && s.purchaseExchangeRate > 0 ? s.purchaseExchangeRate : undefined;
    const mul = s.currency === "USD" ? (pr ?? rates.USD)
      : s.currency === "JPY" ? ((pr ?? rates.JPY) / 100)
        : 1;
    stock += s.averagePrice * s.quantity * mul;
  }
  let crypto = 0;
  for (const c of data.crypto) {
    if (inPeriod(c.purchaseDate)) crypto += c.averagePrice * c.quantity;
  }
  let realEstate = 0;
  for (const r of data.realEstate) {
    if (inPeriod(r.purchaseDate)) realEstate += r.purchasePrice;
  }
  let debt = 0;
  for (const l of data.loans) {
    if (inPeriod(l.startDate)) debt -= l.balance; // 기간 내 신규 대출 = 부채 증가(−)
  }
  return { stock, crypto, realEstate, debt };
}

// 통합 시계열 포인트: daily는 date 그대로, monthly는 실제 말일로 정렬(표시는 YYYY-MM).
// _isLive: buildLiveAttributionCurr가 만든 실시간 끝점 표시(스냅샷=refPrice 기준과 달리 currentPrice=실시간 quote 기준).
type AttributionPoint = (DailyAssetSnapshot | MonthlyAssetSnapshot) & { _date: string; _display: string; _isLive?: boolean };

// 국내·해외 주식시장이 모두 휴장인 날인지(주말·공휴일) — YYYY-MM-DD 문자열 기준.
// 실시간 quote(currentPrice)는 정산 종가(refPrice, 스냅샷 기준)와 소스가 달라, 휴장 중에도
// 재조회 시 미세하게 값이 흔들려 "시세 변동"으로 오인될 수 있다(실측 시세는 안 바뀌었음).
// 스냅샷 간 비교(과거 구간)는 이미 refPrice 기준이라 이 문제가 없으므로, 실시간 끝점(_isLive)에만 적용한다.
function isClosedForBothMarkets(dateStr: string): boolean {
  const d = new Date(dateStr);
  return !isKrBusinessDay(d) && !isUsBusinessDay(d);
}

function buildAttributionPoints(
  daily: DailyAssetSnapshot[],
  monthly: MonthlyAssetSnapshot[],
): { dailyPoints: AttributionPoint[]; monthlyPoints: AttributionPoint[] } {
  const monthEnd = (month: string): string => {
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate(); // 해당 월 마지막 날
    return `${month}-${String(last).padStart(2, "0")}`;
  };
  return {
    dailyPoints: daily.map((s) => ({ ...s, _date: s.date, _display: s.date })),
    monthlyPoints: monthly.map((s) => ({ ...s, _date: monthEnd(s.month), _display: s.month })),
  };
}

// 현재 시점: fx·fxBase 보유한 최신 daily (환율 분해 최소 요건).
// 월별을 임의의 미래 날짜로 두면 오늘자 daily보다 뒤로 정렬돼 현재 시점(curr)을 오염시키므로,
// curr은 반드시 최신 daily에서만 고른다 (daily는 접속 시마다 저장되어 항상 오늘자 존재).
function pickAttributionCurr(dailyPoints: AttributionPoint[]): AttributionPoint | null {
  const curr = [...dailyPoints]
    .sort((a, b) => a._date.localeCompare(b._date))
    .reverse()
    .find((s) => s.fx && s.fxBase);
  return curr?.fx && curr.fxBase ? curr : null;
}

// prev/curr 두 스냅샷으로 Δ순자산을 4효과 분해 (computePeriodAttribution·computeAttributionSince 공용)
function resolveAttribution(
  prev: AttributionPoint,
  curr: AttributionPoint,
  exchangeHistory: Record<string, { USD: number; JPY: number }>,
  assetData: AssetData,
  rates: { USD: number; JPY: number },
): PeriodAttribution {
  const deltaNet = curr.netAsset - prev.netAsset;
  const fromDate = prev._display;
  const toDate = curr._display;

  const bothEnriched = !!(prev.breakdown && prev.fx && prev.fxBase && prev.cost && curr.breakdown && curr.cost);

  // 실시간 끝점 + 오늘 휴장(국내·해외 모두)이면 **주식** 시세 원인을 "그 외"로 억제
  // (순자산 합계는 그대로, 라벨만 변경). 코인은 24시간 거래, 부동산은 사용자 직접 입력이라
  // 증시 휴장과 무관하므로 억제 대상이 아니다 — 억제하면 진짜 변동이 "그 외"에 묻힌다.
  const suppressPriceCause = !!curr._isLive && isClosedForBothMarkets(curr._date);
  const stockPriceKey: AttributionCauseKey = suppressPriceCause ? "rest" : "price:stock";

  // 기간(prev, curr] 내 현금 순유입(입금−출금, KRW 환산) — 월급·목돈 등을 saving에서 분리
  const inflow = cashInflow(assetData, prev._date, curr._date, rates);
  const incomeEffect = inflow.reflected + inflow.unreflected;

  if (bothEnriched) {
    // 정밀 분해. saving은 총원가 증감이라 현금 유입(income)을 포함 → income을 떼어내 투자자산 매수만 남긴다.
    const savingFull = curr.cost!.total - prev.cost!.total;                   // Δ총원가(현금 포함)
    // 외화 원가(주식·현금)는 cost.total이 현재 환율로 환산돼 환율만 움직여도 savingFull에 잡힌다 —
    // 신규 투입이 아니므로 제외한다. (fxEffect가 평가액 기준으로 환차익을 이미 잡으므로 saving에 남기면 이중 귀속)
    const costFx = costFxRevaluation(assetData, prev.fx!, curr.fx!);
    const savingFullReal = savingFull - (costFx.stock + costFx.cash);
    const savingInvest = savingFullReal - inflow.reflected;                   // 투자자산 신규 매수
    // 거래내역으로 설명되는 매수·매도를 떼어내고 나머지만 saving으로 남긴다.
    // (buy + sell + saving = savingInvest 항등식이라 표시 합계는 그대로 deltaNet)
    const { buy: buyEffect, sell: sellEffect } = reflectedTradeFlow(assetData, prev._date, curr._date, rates);
    const savingEffect = savingInvest - buyEffect - sellEffect;
    const debtEffect = -(curr.breakdown!.loans - prev.breakdown!.loans);     // 부채 증감 (상환=+)
    const fxByCurrency = (["USD", "JPY"] as const).map((c) => ({
      currency: c,
      effect: !prev.fx![c] || prev.fx![c] <= 0 ? 0 : prev.fxBase![c] * (curr.fx![c] / prev.fx![c] - 1),
    }));
    const fxEffect = fxByCurrency.reduce((sum, e) => sum + e.effect, 0);
    // 잔차 = 시세. 반영분 income은 savingFull에 포함돼 이미 차감됐고,
    // 미반영(소급) income은 savingFull에 없으므로 여기서 따로 뺀다. costFx는 fxEffect가 담당하므로 여기선 제외.
    const priceEffect = deltaNet - savingFullReal - debtEffect - fxEffect - inflow.unreflected;

    // ── 자산군별 분해 ─────────────────────────────────────────────
    // 스냅샷의 breakdown(자산군별 평가액)·cost(자산군별 원가)로 시세·매수를 자산군까지 쪼갠다.
    // priceEffect·savingEffect **총액은 건드리지 않고** 그 안을 나누므로 표시 합계 = deltaNet은 불변이며,
    // 분해되지 않고 남는 조각(현금 이자·미반영 소급 입금·환율 안분 오차)은 전부 rest가 흡수한다.
    const dCostStockRaw = curr.cost!.stock - prev.cost!.stock;
    const dCostStock = dCostStockRaw - costFx.stock;   // 환율 재평가를 뺀 순수 투입
    const dCostCrypto = curr.cost!.crypto - prev.cost!.crypto;
    const dCostRealEstate = curr.cost!.realEstate - prev.cost!.realEstate;

    // 환율효과 중 주식 몫 — prev 시점의 자산군별 fxBase가 스냅샷에 없어 현재 노출 비율로 안분한다(근사).
    const stockShare = stockFxShare(assetData, rates);
    const fxStock = fxByCurrency.reduce((s, e) => s + e.effect * stockShare[e.currency], 0);

    // 주식 평가손익의 환차익 = (평가액 기준 환차익) − (원가 기준 환차익) → 시세에서 제외
    const priceStock = (curr.breakdown!.stocks - prev.breakdown!.stocks - dCostStockRaw) - (fxStock - costFx.stock);
    const priceCrypto = (curr.breakdown!.crypto - prev.breakdown!.crypto) - dCostCrypto;
    const priceRealEstate = (curr.breakdown!.realEstate - prev.breakdown!.realEstate) - dCostRealEstate;

    // 거래내역 없이 수량·평단을 직접 수정한 분(스크린샷 일괄 등록 등)은 방향별로 매수/매도에 합산
    // — 같은 라벨이 두 줄로 갈라지지 않게 한다.
    const stockManual = dCostStock - buyEffect - sellEffect;
    const buyStock = buyEffect + Math.max(stockManual, 0);
    const sellStock = sellEffect + Math.min(stockManual, 0);

    // 투자자산 3종으로 설명되지 않는 원가 증감 = 현금성 원가(잔액) 변동. 입출금 기록 없이 잔액을
    // 직접 수정한 경우가 여기 남는데 성격이 입출금과 같으므로 소득 항목에 합산한다("그 외"로 묻지 않는다).
    const dCostCash = savingInvest - dCostStock - dCostCrypto - dCostRealEstate;
    // 자산군별 시세로 설명되지 않는 잔차(현금 이자·미반영 소급 입금·환율 안분 오차)만 "그 외"로 남긴다
    const restCarry = priceEffect - priceStock - priceCrypto - priceRealEstate;

    const { topCauses, restEffect, restCauses } = pickTopCauses([
      { key: stockPriceKey, amount: priceStock },
      { key: "price:crypto", amount: priceCrypto },
      { key: "price:realEstate", amount: priceRealEstate },
      { key: "fx", amount: fxEffect },
      { key: "buy:stock", amount: buyStock },
      { key: "sell:stock", amount: sellStock },
      { key: dCostCrypto >= 0 ? "buy:crypto" : "sell:crypto", amount: dCostCrypto },
      { key: dCostRealEstate >= 0 ? "buy:realEstate" : "sell:realEstate", amount: dCostRealEstate },
      { key: "income", amount: incomeEffect + dCostCash },
      { key: "debt", amount: debtEffect },
      { key: "rest", amount: restCarry },
    ]);
    return { fromDate, toDate, deltaNet, priceEffect, fxEffect, savingEffect, buyEffect, sellEffect, incomeEffect, debtEffect, estimated: false, topCauses, restEffect, restCauses };
  }

  // 예측 분해: 시작 스냅샷이 레거시(netAsset만) — Δ순자산은 실측 그대로 쓰고,
  //  - 저축·부채: 현재 자산 정보의 매수일·대출일로 기간 내 신규 투입 추정
  //  - 환율: 환율 이력 + 현재 외화노출(fxBase)로 추정 (이력 없으면 0)
  //  - 시세: 나머지 잔차
  const histDates = Object.keys(exchangeHistory).sort();
  const prevFxDate = [...histDates].reverse().find((d) => d <= prev._date);
  const prevFx = prevFxDate ? exchangeHistory[prevFxDate] : null;
  const fxEffect = prevFx
    ? (["USD", "JPY"] as const).reduce((sum, c) => {
      if (!prevFx[c] || prevFx[c] <= 0) return sum;
      return sum + curr.fxBase![c] * (curr.fx![c] / prevFx[c] - 1);
    }, 0)
    : 0;
  const inflows = estimatePeriodInflows(assetData, prev._date, curr._date, rates);
  const savingEffect = inflows.stock + inflows.crypto + inflows.realEstate;
  const debtEffect = inflows.debt;
  // 예측 모드의 saving은 매수일 기반이라 현금 유입을 포함하지 않음 → income을 별도 항으로 두고 잔차(price)에서 뺀다.
  // 거래내역이 있는 주식은 estimatePeriodInflows가 건너뛰므로(권위=거래내역) buy/sell을 여기서 분리해 노출한다.
  // (매수 반영 시 purchaseDate가 안 바뀌어 추가 매수가 saving에서 통째로 누락되던 문제 해소)
  const { buy: buyEffect, sell: sellEffect } = reflectedTradeFlow(assetData, prev._date, curr._date, rates);
  const priceEffect = deltaNet - fxEffect - savingEffect - buyEffect - sellEffect - debtEffect - incomeEffect;
  // 시작 스냅샷에 자산군별 평가액(breakdown)이 없어 **시세만** 통합 "price"로 남고, 매수·매도는 자산군별로 나뉜다.
  const buyStock = buyEffect + Math.max(inflows.stock, 0);
  const sellStock = sellEffect + Math.min(inflows.stock, 0);
  const { topCauses, restEffect, restCauses } = pickTopCauses([
    { key: suppressPriceCause ? "rest" : "price", amount: priceEffect },
    { key: "fx", amount: fxEffect },
    { key: "buy:stock", amount: buyStock },
    { key: "sell:stock", amount: sellStock },
    { key: inflows.crypto >= 0 ? "buy:crypto" : "sell:crypto", amount: inflows.crypto },
    { key: inflows.realEstate >= 0 ? "buy:realEstate" : "sell:realEstate", amount: inflows.realEstate },
    { key: "income", amount: incomeEffect },
    { key: "debt", amount: debtEffect },
  ]);
  return {
    fromDate, toDate, deltaNet,
    priceEffect, fxEffect, savingEffect, buyEffect, sellEffect, incomeEffect, debtEffect,
    estimated: true, topCauses, restEffect, restCauses,
  };
}

// KRW 환산 배수 — 원인분해 전 구간 공용 (JPY는 100엔당)
const krwMul = (cur: string | undefined, rates: { USD: number; JPY: number }): number =>
  cur === "USD" ? rates.USD : cur === "JPY" ? rates.JPY / 100 : 1;

// 외화 원가(주식 매입원가·현금 잔액)가 환율 변동으로만 재평가된 KRW 증감 — 신규 투입이 아님.
// computeAssetCost와 동일 원가 기준(주식=수량×평균단가, 현금=잔액), delisted 제외.
// 주식 몫은 자산군별 시세 분해에서 따로 쓰이므로 나눠 반환한다.
function costFxRevaluation(
  data: AssetData,
  prevFx: { USD: number; JPY: number },
  currFx: { USD: number; JPY: number },
): { stock: number; cash: number } {
  const d = (cur: string | undefined) => krwMul(cur, currFx) - krwMul(cur, prevFx); // KRW은 0
  let stock = 0;
  for (const s of data.stocks) {
    if (s.inactiveStatus === "delisted") continue;
    stock += s.quantity * s.averagePrice * d(s.currency);
  }
  let cash = 0;
  for (const c of data.cash ?? []) cash += c.balance * d(c.currency);
  return { stock, cash };
}

// 통화별 외화노출(KRW 환산) 중 주식이 차지하는 비율(0~1) — 환율효과를 주식/현금으로 안분할 때 쓴다.
// 스냅샷의 fxBase는 주식+현금 합계라 과거 시점 비율을 알 수 없어 현재 보유 기준으로 근사한다.
function stockFxShare(data: AssetData, rates: { USD: number; JPY: number }): { USD: number; JPY: number } {
  const { stock, cash } = fxBaseByClass(data, rates);
  const share = (cur: "USD" | "JPY") => {
    const total = stock[cur] + cash[cur];
    return total > 0 ? stock[cur] / total : 1;
  };
  return { USD: share("USD"), JPY: share("JPY") };
}

// 기간(from, to] 내 현금 거래 순유입(입금−출금)을 KRW로 환산해 반영/미반영으로 나눠 합산.
// - reflected: 앱이 잔액을 가감했으므로 cost.total 변화(savingFull)에 이미 포함 → saving에서 차감
// - 미반영(과거 소급 기록): 잔액을 건드리지 않았으나 그 입금은 이미 잔액에 녹아 있다
//   (폼 문구 "기록만 남기고 잔액은 변경하지 않습니다(과거 소급용)") → savingFull에는 없고
//   deltaNet에는 있으므로 price 잔차에서 차감해야 원인이 소득으로 귀속된다.
// 두 값을 나눠 써야 표시 합계 = deltaNet 항등식이 유지된다.
function cashInflow(
  assetData: AssetData,
  fromDate: string,
  toDate: string,
  rates: { USD: number; JPY: number },
): { reflected: number; unreflected: number } {
  const txns = assetData.cashTransactions || [];
  let reflected = 0;
  let unreflected = 0;
  for (const t of txns) {
    if (t.date <= fromDate || t.date > toDate) continue;
    const signed = (t.type === "deposit" ? t.amount : -t.amount) * krwMul(t.currency, rates);
    if (t.reflected) reflected += signed;
    else unreflected += signed;
  }
  return { reflected, unreflected };
}

// 기간(from, to] 내 반영된 주식 거래 체결액을 KRW로 환산해 매수/매도로 나눠 합산.
// 체결 시 환율(exchangeRate)이 있으면 그걸, 없으면 현재 환율로 환산한다.
// 한계 ①: transactionSchema는 주식 전용(stockId·ticker) — 코인·부동산 매수는 saving 잔여로 남는다.
// 한계 ②: 매도의 원가 감소분은 당시 평균단가를 알 수 없어 체결액으로 잡으므로,
//         실현손익만큼의 차이는 saving 잔여가 흡수한다(합계 정합은 유지).
function reflectedTradeFlow(
  assetData: AssetData,
  fromDate: string,
  toDate: string,
  rates: { USD: number; JPY: number },
): { buy: number; sell: number } {
  const txns = assetData.transactions || [];
  let buy = 0;
  let sell = 0;
  for (const t of txns) {
    if (!t.reflected || t.date <= fromDate || t.date > toDate) continue;
    const rate = t.exchangeRate && t.exchangeRate > 0
      ? (t.currency === "JPY" ? t.exchangeRate / 100 : t.currency === "KRW" ? 1 : t.exchangeRate)
      : krwMul(t.currency, rates);
    const amount = t.quantity * t.price * rate;
    if (t.type === "buy") buy += amount;
    else sell -= amount;
  }
  return { buy, sell };
}

// 기간 시작점에 가장 가까운(시작일 이하 최근) 스냅샷 선택.
// 1w는 daily 위주, 1m 이상은 monthly+daily를 합쳐 날짜 기준으로 고른다.
export function computePeriodAttribution(
  daily: DailyAssetSnapshot[],
  monthly: MonthlyAssetSnapshot[],
  exchangeHistory: Record<string, { USD: number; JPY: number }>,
  period: AttributionPeriod,
  assetData: AssetData,
  rates: { USD: number; JPY: number },
): PeriodAttribution | null {
  const { dailyPoints, monthlyPoints } = buildAttributionPoints(daily, monthly);
  const curr = pickAttributionCurr(dailyPoints);
  if (!curr) return null;

  // 기간 시작일 계산 (ytd = 올해 1/1)
  let targetStr: string;
  if (period === "ytd") {
    targetStr = `${curr._date.substring(0, 4)}-01-01`;
  } else {
    const t = new Date(curr._date);
    t.setDate(t.getDate() - PERIOD_DAYS[period]);
    targetStr = t.toISOString().split("T")[0];
  }
  // 시작 스냅샷: 시작일 이하 중 가장 최근 (daily+monthly 통합, curr 이전만)
  const prev = [...dailyPoints, ...monthlyPoints]
    .sort((a, b) => a._date.localeCompare(b._date))
    .reverse()
    .find((s) => s._date <= targetStr && s._date < curr._date);
  if (!prev) return null;

  return resolveAttribution(prev, curr, exchangeHistory, assetData, rates);
}

// "지난 접속 이후" 브리핑용: sinceDate(마지막 스냅샷 저장일) 이하 최근 스냅샷 vs 끝점 비교.
// 30일 롤링으로 sinceDate 이하 기록이 없으면 보유한 가장 오래된 포인트로 폴백
// (fromDate가 실제 비교 시작일이므로 표기와 자연스럽게 정합). 비교쌍이 없으면 null.
// liveCurr 전달 시 끝점을 종가 스냅샷 대신 실시간 현재값(buildLiveAttributionCurr)으로 사용 —
// 헤더 Hero 순자산(실시간)과 동일 기준이 되어 "Hero − 등락 = 지난 접속일 종가" 산수가 맞는다.
export function computeAttributionSince(
  daily: DailyAssetSnapshot[],
  monthly: MonthlyAssetSnapshot[],
  exchangeHistory: Record<string, { USD: number; JPY: number }>,
  sinceDate: string,
  assetData: AssetData,
  rates: { USD: number; JPY: number },
  liveCurr?: AttributionPoint,
): PeriodAttribution | null {
  const { dailyPoints, monthlyPoints } = buildAttributionPoints(daily, monthly);
  const curr = liveCurr ?? pickAttributionCurr(dailyPoints);
  if (!curr) return null;

  // 끝점이 실시간(liveCurr)이면 오늘자 종가 스냅샷은 시작점 후보에서 제외(_date < curr._date로 자동 처리)
  const candidates = [...dailyPoints, ...monthlyPoints]
    .filter((s) => s._date < curr._date)
    .sort((a, b) => a._date.localeCompare(b._date));
  if (candidates.length === 0) return null;

  const prev = [...candidates].reverse().find((s) => s._date <= sinceDate) ?? candidates[0];
  return resolveAttribution(prev, curr, exchangeHistory, assetData, rates);
}

// 실시간 현재값으로 원인분해 끝점(curr) 생성 — saveSnapshots의 enrich와 동일 수식(현재가 기준).
// getAssetSummary·computeFxExposure 결과를 재사용해 중복 수식을 만들지 않는다.
export function buildLiveAttributionCurr(
  data: AssetData,
  rates: { USD: number; JPY: number },
  summary: AssetSummary,
): AttributionPoint {
  const todayStr = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
  // 통화별 외화노출 기준액(KRW) — 환율효과 분리용. computeFxExposure의 exposureKrw 재사용.
  const fxBase = { USD: 0, JPY: 0 };
  for (const e of computeFxExposure(data, rates, summary.totalValue)) {
    fxBase[e.currency] = e.exposureKrw;
  }
  return {
    date: todayStr,
    netAsset: summary.netAsset,
    financialAsset: summary.stockValue + summary.cryptoValue + summary.cashValue,
    breakdown: {
      realEstate: summary.realEstateValue,
      stocks: summary.stockValue,
      crypto: summary.cryptoValue,
      cash: summary.cashValue,
      loans: summary.loanBalance,
    },
    fx: { USD: rates.USD, JPY: rates.JPY },
    fxBase,
    cost: {
      total: summary.realEstateCost + summary.stockCost + summary.cryptoCost + summary.cashValue,
      stock: summary.stockCost,
      crypto: summary.cryptoCost,
      realEstate: summary.realEstateCost,
    },
    _date: todayStr,
    _display: todayStr,
    _isLive: true,
  } as AttributionPoint;
}

// ── 환노출 (외화자산 KRW 환산·민감도) ────────────────────────────────
// saveSnapshots의 fxBase와 동일 수식 — 현재가 기준 (delisted 제외, JPY는 100엔당)
export interface FxExposure {
  currency: "USD" | "JPY";
  exposureKrw: number;   // 외화자산 KRW 환산액
  ratio: number;         // 총자산 대비 비중 (%)
  per10Won: number;      // 환율 10원 변동 시 영향 (KRW)
}

// 통화별 외화노출 기준액(KRW 환산)을 자산군별로 산출 — computeFxExposure와 stockFxShare가 공유하는 단일 수식
function fxBaseByClass(
  data: AssetData,
  rates: { USD: number; JPY: number },
): { stock: { USD: number; JPY: number }; cash: { USD: number; JPY: number } } {
  const stock = { USD: 0, JPY: 0 };
  const cash = { USD: 0, JPY: 0 };
  for (const s of data.stocks) {
    if (s.inactiveStatus === "delisted") continue;
    if (s.currency === "USD") stock.USD += s.quantity * s.currentPrice * rates.USD;
    else if (s.currency === "JPY") stock.JPY += s.quantity * s.currentPrice * (rates.JPY / 100);
  }
  for (const c of data.cash ?? []) {
    if (c.currency === "USD") cash.USD += c.balance * rates.USD;
    else if (c.currency === "JPY") cash.JPY += c.balance * (rates.JPY / 100);
  }
  return { stock, cash };
}

export function computeFxExposure(
  data: AssetData,
  rates: { USD: number; JPY: number },
  totalValue: number,
): FxExposure[] {
  const { stock, cash } = fxBaseByClass(data, rates);
  const base = { USD: stock.USD + cash.USD, JPY: stock.JPY + cash.JPY };
  return (["USD", "JPY"] as const)
    .filter((cur) => base[cur] > 0)
    .map((cur) => ({
      currency: cur,
      exposureKrw: base[cur],
      ratio: totalValue > 0 ? (base[cur] / totalValue) * 100 : 0,
      // 10원 변동 영향 = 외화 수량 × 10원 (JPY는 100엔당 환율이므로 동일 수식 적용)
      per10Won: rates[cur] > 0 ? (base[cur] / rates[cur]) * 10 : 0,
    }));
}

