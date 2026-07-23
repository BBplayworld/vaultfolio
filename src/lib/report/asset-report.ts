// 자산 성적표 계산 유틸 (Plus 산출물)
// - point-in-time: getAssetSummary 결과로 "넣은 돈 vs 번 돈(그중 환차익)" 분해
// - 시계열 원인분해 델타: 인리치드 스냅샷 2건으로 Δ순자산을 시세/환율/입출금으로 분해
// 투자 조언 아님 — 사용자 자신의 자산의 사실·구조·변화만 계산

import type { AssetData, AssetSummary, DailyAssetSnapshot, MonthlyAssetSnapshot } from "@/types/asset";

// ── point-in-time 성적표 ──────────────────────────────────────────────
export interface AssetReport {
  totalCost: number;      // 넣은 돈 (총 투입원가, 부채 무관)
  equity: number;         // 자기자본 (= totalCost - 부채) — 실제 내가 넣은 돈
  totalProfit: number;    // 번 돈 (평가손익)
  totalProfitRate: number;   // 총자산 수익률 (= totalProfit / totalCost)
  equityReturnRate: number;  // 자기자본 수익률 (= totalProfit / equity, 레버리지 반영)
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

export interface AttributionCause {
  key: "price" | "fx" | "saving" | "debt" | "rest";
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
  savingEffect: number;  // 새로 넣은 자산 (Δ총원가 — 저축·신규 매수)
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
const CAUSE_DISPLAY_MIN = 10000;

const fmtManwon = (v: number): string => {
  const man = Math.round(Math.abs(v) / 10000);
  const sign = v >= 0 ? "+" : "−";
  if (man >= 10000) return `${sign}${(man / 10000).toFixed(1)}억원`;
  return `${sign}${man.toLocaleString()}만원`;
};

// 효과값 → 사용자 문장 (증가/감소 방향별)
export function causeSentence(key: AttributionCause["key"], amount: number): string {
  const amt = fmtManwon(amount);
  switch (key) {
    case "price":
      return amount >= 0 ? `시세 상승으로 ${amt} 늘었어요.` : `시세 하락이 ${amt} 깎았어요.`;
    case "fx":
      return amount >= 0 ? `환율 상승이 ${amt} 보탰어요.` : `환율 하락이 ${amt} 깎았어요.`;
    case "saving":
      return amount >= 0
        ? `새로 추가한 자산(저축·신규 매수)으로 ${amt} 늘었어요.`
        : `자산 회수·인출로 ${amt} 줄었어요.`;
    case "debt":
      return amount >= 0 ? `부채 상환으로 순자산이 ${amt} 늘었어요.` : `부채 증가가 ${amt} 깎았어요.`;
    case "rest":
      return `그 외 요인 ${amt}.`;
  }
}

const CAUSE_LABELS: Record<AttributionCause["key"], string> = {
  price: "시세 변동",
  fx: "환율 영향",
  saving: "새로 추가한 자산",
  debt: "부채 증감",
  rest: "그 외",
};

// 축약 정의형 라벨 — 방향(부호)까지 반영해 짧게. 홈 헤더 등 좁은 공간용.
function causeShortLabel(key: AttributionCause["key"], amount: number): string {
  switch (key) {
    case "price": return amount >= 0 ? "시세 상승" : "시세 하락";
    case "fx": return amount >= 0 ? "환율 상승" : "환율 하락";
    case "saving": return amount >= 0 ? "저축·매수" : "회수·인출";
    case "debt": return amount >= 0 ? "부채 상환" : "부채 증가";
    case "rest": return "그 외";
  }
}

// 원인 전체(topCauses + restCauses)를 한 줄로 결합 — 좁은 공간(홈 헤더 등)에서도
// 표시 금액 합계가 deltaNet과 항상 일치하도록(반올림 오차 제외) topCauses[0]만 쓰지 않는다.
// 전 항목을 서술형(causeSentence)이 아닌 축약 정의형("라벨 ±금액")으로 통일한다.
export function formatAttributionSentence(attr: PeriodAttribution): string | null {
  if (attr.topCauses.length === 0) return null;
  const short = (c: AttributionCause) => `${causeShortLabel(c.key, c.amount)} ${fmtManwon(c.amount)}`;
  const parts = [...attr.topCauses.map(short), ...attr.restCauses.map(short)];
  // 임계값 미만이라 펼치지 못한 잔차만 "그 외"로 — 이게 있어야 표시 합계가 deltaNet과 맞는다
  const shownRest = attr.restCauses.reduce((s, c) => s + c.amount, 0);
  const residual = attr.restEffect - shownRest;
  if (Math.abs(residual) >= CAUSE_DISPLAY_MIN) parts.push(`그 외 ${fmtManwon(residual)}`);
  return parts.join(" · ");
}

// 효과 목록에서 절대값 상위 1~2개를 topCauses로 선정 (2위가 1위의 25% 미만이면 1개만).
// top에 못 든 원인도 임계값(1만원) 이상이면 restCauses로 이름을 살려 함께 돌려준다.
function pickTopCauses(effects: { key: AttributionCause["key"]; amount: number }[]): {
  topCauses: AttributionCause[];
  restEffect: number;
  restCauses: AttributionCause[];
} {
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
  const toCause = (t: { key: AttributionCause["key"]; amount: number }): AttributionCause => ({
    key: t.key,
    label: CAUSE_LABELS[t.key],
    amount: t.amount,
    sentence: causeSentence(t.key, t.amount),
  });
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
function estimatePeriodInflows(
  data: AssetData,
  fromDate: string,
  toDate: string,
  rates: { USD: number; JPY: number },
): { saving: number; debt: number } {
  const inPeriod = (d?: string) => !!d && d > fromDate && d <= toDate;
  let saving = 0;
  for (const s of data.stocks) {
    if (!inPeriod(s.purchaseDate)) continue;
    // 매입 시점 환율 우선(purchaseExchangeRate), 없으면 현재 환율로 환산 (JPY는 100엔당)
    const pr = s.purchaseExchangeRate && s.purchaseExchangeRate > 0 ? s.purchaseExchangeRate : undefined;
    const mul = s.currency === "USD" ? (pr ?? rates.USD)
      : s.currency === "JPY" ? ((pr ?? rates.JPY) / 100)
        : 1;
    saving += s.averagePrice * s.quantity * mul;
  }
  for (const c of data.crypto) {
    if (inPeriod(c.purchaseDate)) saving += c.averagePrice * c.quantity;
  }
  for (const r of data.realEstate) {
    if (inPeriod(r.purchaseDate)) saving += r.purchasePrice;
  }
  let debt = 0;
  for (const l of data.loans) {
    if (inPeriod(l.startDate)) debt -= l.balance; // 기간 내 신규 대출 = 부채 증가(−)
  }
  return { saving, debt };
}

// 통합 시계열 포인트: daily는 date 그대로, monthly는 실제 말일로 정렬(표시는 YYYY-MM).
type AttributionPoint = (DailyAssetSnapshot | MonthlyAssetSnapshot) & { _date: string; _display: string };

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

  if (bothEnriched) {
    // 정밀 4효과 분해
    const savingEffect = curr.cost!.total - prev.cost!.total;                 // 새로 넣은 자산(저축·신규 매수)
    const debtEffect = -(curr.breakdown!.loans - prev.breakdown!.loans);     // 부채 증감 (상환=+)
    const fxEffect = (["USD", "JPY"] as const).reduce((sum, c) => {
      if (!prev.fx![c] || prev.fx![c] <= 0) return sum;
      return sum + prev.fxBase![c] * (curr.fx![c] / prev.fx![c] - 1);
    }, 0);
    const priceEffect = deltaNet - savingEffect - debtEffect - fxEffect;     // 잔차 = 시세
    const { topCauses, restEffect, restCauses } = pickTopCauses([
      { key: "price", amount: priceEffect },
      { key: "fx", amount: fxEffect },
      { key: "saving", amount: savingEffect },
      { key: "debt", amount: debtEffect },
    ]);
    return { fromDate, toDate, deltaNet, priceEffect, fxEffect, savingEffect, debtEffect, estimated: false, topCauses, restEffect, restCauses };
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
  const { saving: savingEffect, debt: debtEffect } = estimatePeriodInflows(assetData, prev._date, curr._date, rates);
  const priceEffect = deltaNet - fxEffect - savingEffect - debtEffect;
  const { topCauses, restEffect, restCauses } = pickTopCauses([
    { key: "price", amount: priceEffect },
    { key: "fx", amount: fxEffect },
    { key: "saving", amount: savingEffect },
    { key: "debt", amount: debtEffect },
  ]);
  return {
    fromDate, toDate, deltaNet,
    priceEffect, fxEffect, savingEffect, debtEffect,
    estimated: true, topCauses, restEffect, restCauses,
  };
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

export function computeFxExposure(
  data: AssetData,
  rates: { USD: number; JPY: number },
  totalValue: number,
): FxExposure[] {
  const base = { USD: 0, JPY: 0 };
  for (const s of data.stocks) {
    if (s.inactiveStatus === "delisted") continue;
    if (s.currency === "USD") base.USD += s.quantity * s.currentPrice * rates.USD;
    else if (s.currency === "JPY") base.JPY += s.quantity * s.currentPrice * (rates.JPY / 100);
  }
  for (const c of data.cash ?? []) {
    if (c.currency === "USD") base.USD += c.balance * rates.USD;
    else if (c.currency === "JPY") base.JPY += c.balance * (rates.JPY / 100);
  }
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

