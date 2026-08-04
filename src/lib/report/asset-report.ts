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
// 순자산 변동의 원인은 시세·환율·자산 유입/유출뿐이므로 "그 외"(잔차) 범주는 두지 않는다.
// "income"과 "cash"는 서로 다른 것이다 — income은 cashTransactions에 실제로 기록된 입출금만,
// cash는 기록으로 설명되지 않는 현금 잔액의 실측 변동(직접 잔액 수정 등, 사건을 단정하지 않음).
export type AttributionCauseKey =
  | "price" | "price:stock" | "price:crypto" | "price:realEstate"
  | "fx"
  | "buy:stock" | "sell:stock"
  | "buy:crypto" | "sell:crypto"
  | "buy:realEstate" | "sell:realEstate"
  | "income" | "cash" | "deposit" | "debt";

export interface AttributionCause {
  key: AttributionCauseKey;
  label: string;
  amount: number;
  sentence: string; // 뷰가 그대로 렌더하는 문장
  // 금액에 예측치(자산군 미분리 구간 안분 등)가 섞여 있는지 — 뷰의 항목별 "일부 예측" 배지가 이 값을 쓴다.
  estimated?: boolean;
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
  // 현금 순유입 (기간 내 입금−출금, 월급·목돈 등). **반영된 기록만** — cashTransactions에 실제
  // 기록이 없으면 0이다. 기록 없이 잔액이 변한 부분은 별도 "cash" 원인으로 분리된다.
  incomeEffect: number;
  debtEffect: number;    // 부채 증감 (−Δ대출: 상환=+, 증가=−)
  // 시작 스냅샷이 v2 미만 → 예측 분해: Δ순자산·과거 순자산은 실측(스냅샷) 그대로 쓰되,
  // 저축·부채는 현재 자산 정보의 매수일·대출일로, 환율은 환율 이력 + 현재 외화노출로 추정
  estimated: boolean;
  // 하이브리드 구간 합성 시: 이 날짜 **이전** 구간만 예측이고 이후는 실측. undefined=전체 실측,
  // toDate와 같으면 전체 예측(구 estimated===true와 동일 의미). 뷰의 "일부 예측" 배지가 이 필드를 쓴다.
  estimatedUntil?: string;
  // pickTopCauses에 넘긴 key별 raw 효과 벡터(top/rest 분류 전) — 하이브리드 구간 합성이
  // key별로 합산할 수 있도록 버리지 않고 보존한다. estimated: 이 구간 자체가 예측 분해인지
  // (resolveAttribution의 예측 분기 산출물은 전부 true, 정밀 분기는 전부 false).
  effects: { key: AttributionCauseKey; amount: number; estimated?: boolean }[];
  topCauses: AttributionCause[]; // 주요 원인 1~2개
  restEffect: number;    // topCauses 외 나머지 합 (표시 합계 검증용)
  restCauses: AttributionCause[]; // topCauses 외 원인 중 표시 임계값 이상인 것들 (환율·부채 등)
  // 기간 중 현금 잔액이 크게 움직였다가 순변화 없이(또는 미미하게) 되돌아온 경우 — resolveAttribution은
  // 두 끝점만 비교해 "cash" 순변화만 보므로, 왕복은 net에 안 잡혀 원인 목록에서 통째로 사라진다.
  // 없으면(왕복이 없거나 daily 세부가 없는 예측 구간) undefined.
  cashRoundTrip?: { peakAmount: number; peakDate: string };
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
    case "price": return amount >= 0 ? "보유자산 시세 상승" : "보유자산 시세 하락";
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
    case "income": return amount >= 0 ? "현금 입금" : "현금 출금";
    case "cash": return amount >= 0 ? "현금 증가(추정)" : "현금 감소(추정)";
    case "deposit": return amount >= 0 ? "임차보증금 반환" : "임차보증금 증가";
    case "debt": return amount >= 0 ? "대출 상환" : "추가 대출";
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
        ? `${label}으로 ${amt} 늘었어요.`
        : `${label}으로 ${amt} 줄었어요.`;
    case "cash":
      // 기록된 입출금(income)과 달리 이 값은 잔차다 — 실사례 분석 결과 대부분 현금 계좌 잔액을
      // 입출금 기록 없이 직접 수정(정정·목돈 반영 등)한 경우였다. 다만 100% 단정은 아니므로
      // "추정"으로 표기해 실제 원인이 다를 가능성(계좌 삭제, 극히 드문 계산 오차 등)을 남긴다.
      return amount >= 0
        ? `현금 잔액 직접 수정으로 ${amt} 늘어난 것으로 추정돼요.`
        : `현금 잔액 직접 수정으로 ${amt} 줄어든 것으로 추정돼요.`;
    case "deposit":
      return amount >= 0
        ? `임차보증금 반환으로 ${amt} 늘었어요.`
        : `임차보증금 증가로 ${amt} 줄었어요.`;
    case "debt":
      // debtEffect는 대출 잔액 증감만 반영(임차보증금 제외) → "부채"보다 "대출"이 정확한 용어.
      // 매수(신규 유입)와 대칭을 이루도록 "새로 추가한 대출" 구조로 통일.
      return amount >= 0 ? `대출 상환으로 ${amt} 늘었어요.` : `새로 추가한 대출로 ${amt} 줄었어요.`;
  }
}

const makeCause = (key: AttributionCauseKey, amount: number, estimated?: boolean): AttributionCause => ({
  key,
  label: causeShortLabel(key, amount),
  amount,
  sentence: causeSentence(key, amount),
  ...(estimated ? { estimated: true } : {}),
});

// 원인 표시 순서(연관 원인끼리 인접하도록) — 시세·환율(시장 요인) → 주식 매수·매도(거래) →
// 주식 외 자산 추가(저축·코인·부동산) → 소득 → 대출. topCauses[0](가장 큰 원인, 지난 접속
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
  cash: 12,
  debt: 13,
  deposit: 14,
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
  estimated?: boolean; // 이 항목 금액에 예측치가 섞여 있는지 — 뷰의 항목별 "일부 예측" 배지
}

export function getAttributionItems(attr: PeriodAttribution): AttributionDisplayItem[] {
  const causes = [...getOrderedCauses(attr)];
  // 임계값 미만이라 펼치지 못한 원인들의 합(잔차)은 **부호가 같은 원인 중 절대값 최대**에 얹는다 —
  // "그 외" 범주를 만들지 않으면서 표시 합계 = deltaNet을 유지하기 위함.
  // 부호를 가리지 않고 아무 원인에나 얹으면 buy:stock처럼 방향이 라벨에 고정된 항목에 반대
  // 부호 잔차가 붙어 "주식 매수로 −3만원 늘었어요" 같은 모순 문장이 나온다.
  const shownRest = attr.restCauses.reduce((s, c) => s + c.amount, 0);
  const residual = attr.restEffect - shownRest;
  if (Math.abs(residual) >= CAUSE_DISPLAY_MIN && causes.length > 0) {
    const sameSign = causes
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => (residual >= 0 ? c.amount >= 0 : c.amount <= 0));
    if (sameSign.length > 0) {
      let best = sameSign[0];
      for (const cand of sameSign) if (Math.abs(cand.c.amount) > Math.abs(best.c.amount)) best = cand;
      causes[best.i] = makeCause(causes[best.i].key, causes[best.i].amount + residual, causes[best.i].estimated);
    } else {
      // 부호가 맞는 원인이 하나도 없다 = 설명되지 않는 방향 전환이므로 정직하게 cash로 보낸다
      const cashIdx = causes.findIndex((c) => c.key === "cash");
      if (cashIdx >= 0) causes[cashIdx] = makeCause("cash", causes[cashIdx].amount + residual, causes[cashIdx].estimated);
      else causes.push(makeCause("cash", residual));
    }
  }
  return causes.map((c) => ({
    key: c.key, label: c.label, sentence: c.sentence, amount: c.amount, text: fmtManwon(c.amount),
    ...(c.estimated ? { estimated: true } : {}),
  }));
}

// 자산 타입별 그룹 — 성적표 화면이 같은 자산군 원인(시세·매수·매도, 대출 상환·추가 대출)을
// 박스 하나에 묶어 보여줄 때 쓴다. fx·deposit·통합 price처럼 자산 타입이 없는 원인은 그룹을 만들지 않는다.
export type AttributionGroupKey = "stock" | "crypto" | "realEstate" | "cash" | "loan";

const ATTRIBUTION_GROUP: Partial<Record<AttributionCauseKey, AttributionGroupKey>> = {
  "price:stock": "stock", "buy:stock": "stock", "sell:stock": "stock",
  "price:crypto": "crypto", "buy:crypto": "crypto", "sell:crypto": "crypto",
  "price:realEstate": "realEstate", "buy:realEstate": "realEstate", "sell:realEstate": "realEstate",
  income: "cash", cash: "cash",
  debt: "loan",
};

const ATTRIBUTION_GROUP_LABEL: Record<AttributionGroupKey, string> = {
  stock: "주식", crypto: "코인", realEstate: "부동산", cash: "현금", loan: "대출",
};

export interface AttributionItemGroup {
  key: AttributionGroupKey | null; // null = 그룹 없는 단독 항목(fx·deposit·통합 price)
  label: string | null;
  items: AttributionDisplayItem[];
}

// getAttributionItems 결과(이미 CAUSE_ORDER로 정렬됨)를 자산 타입별로 묶은 뒤, 그룹 내 금액
// 합계(양음 상쇄 반영)의 절대값이 큰 순서로 재정렬한다 — 변동이 큰 자산 타입이 위로 오게.
// 그룹핑 자체(어떤 항목이 어떤 그룹에 속하는지)만 첫 등장 순서로 만들고, 이후 정렬만 별도로 한다
// — 그래야 그룹 소속 판정과 표시 순서가 서로 얽히지 않는다.
export function groupAttributionItems(items: AttributionDisplayItem[]): AttributionItemGroup[] {
  // 이 기간에 대출 활동(debt)이 있으면, 설명되지 않는 현금 잔차(cash)를 현금 그룹이 아니라
  // 대출 그룹에 묶는다 — 대출 상환/추가대출에 쓰인 미기록 현금일 가능성이 높아 같은 사건의
  // 다른 면으로 보이게 하기 위함(2026-08). 금액은 절대 합치지 않고 각자 그대로 보여준다 —
  // 더해서 하나로 합치면 상환액과 그 현금 유출이 상쇄돼 "대출 상환" 사실 자체가 사라질 수 있다.
  const hasDebt = items.some((i) => i.key === "debt");
  const groups: AttributionItemGroup[] = [];
  const byGroup = new Map<AttributionGroupKey, AttributionItemGroup>();
  for (const item of items) {
    const g = item.key === "cash" && hasDebt ? "loan" : ATTRIBUTION_GROUP[item.key];
    if (!g) { groups.push({ key: null, label: null, items: [item] }); continue; }
    let bucket = byGroup.get(g);
    if (!bucket) {
      bucket = { key: g, label: ATTRIBUTION_GROUP_LABEL[g], items: [] };
      byGroup.set(g, bucket);
      groups.push(bucket);
    }
    bucket.items.push(item);
  }
  const groupAmount = (g: AttributionItemGroup) => Math.abs(g.items.reduce((s, i) => s + i.amount, 0));
  return groups.sort((a, b) => groupAmount(b) - groupAmount(a));
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
function pickTopCauses(rawEffects: { key: AttributionCauseKey; amount: number; estimated?: boolean }[]): {
  effects: { key: AttributionCauseKey; amount: number; estimated?: boolean }[];
  topCauses: AttributionCause[];
  restEffect: number;
  restCauses: AttributionCause[];
} {
  // 같은 key가 두 번 들어와도 두 줄로 갈라지지 않게 먼저 합산(방어적). 합쳐지는 항목 중
  // 하나라도 estimated면 합계 전체를 "일부 예측"으로 표시한다(실측+예측 혼합이므로 정직한 상한).
  const byKey = new Map<AttributionCauseKey, { amount: number; estimated: boolean }>();
  for (const e of rawEffects) {
    const prev = byKey.get(e.key);
    byKey.set(e.key, {
      amount: (prev?.amount ?? 0) + e.amount,
      estimated: !!prev?.estimated || !!e.estimated,
    });
  }
  const effects = [...byKey].map(([key, v]) => ({ key, amount: v.amount, estimated: v.estimated }));
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
  const toCause = (t: { key: AttributionCauseKey; amount: number; estimated?: boolean }) =>
    makeCause(t.key, t.amount, t.estimated);
  return {
    effects,
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
  // 기간 내 반영된 대출 거래를 가진 대출 id — 이 대출의 증감은 reflectedLoanFlow가 권위 소스이므로
  // startDate 기반 신규대출 추정에서 제외(이중계산 방지, S-4.24. tradedStockIds와 동일 패턴)
  const loanTxLoanIds = new Set(
    (data.loanTransactions || [])
      .filter((t) => t.reflected && t.date > fromDate && t.date <= toDate)
      .map((t) => t.loanId),
  );
  // 기간 내 반영된 코인 거래를 가진 코인 id — reflectedCryptoFlow가 권위 소스이므로 매수일 추정에서
  // 제외(이중계산 방지, tradedStockIds와 동일 패턴, S-4.25)
  const tradedCryptoIds = new Set(
    (data.cryptoTransactions || [])
      .filter((t) => t.reflected && t.date > fromDate && t.date <= toDate)
      .map((t) => t.cryptoId),
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
    if (tradedCryptoIds.has(c.id)) continue;
    if (inPeriod(c.purchaseDate)) crypto += c.averagePrice * c.quantity;
  }
  let realEstate = 0;
  for (const r of data.realEstate) {
    if (inPeriod(r.purchaseDate)) realEstate += r.purchasePrice;
  }
  let debt = 0;
  for (const l of data.loans) {
    if (loanTxLoanIds.has(l.id)) continue;
    if (inPeriod(l.startDate)) debt -= l.balance; // 기간 내 신규 대출 = 부채 증가(−)
  }
  return { stock, crypto, realEstate, debt };
}

// 기간[from, to] 내 반영된 대출 상환/추가대출 순액(Σ상환−Σ추가대출)을 집계.
// 대출은 통화 필드가 없어(항상 KRW) rates 불필요 — reflectedCashInflow·reflectedTradeFlow와 동형.
// 예측(estimated) 경로 전용: 정밀(bothEnriched) 경로의 debtEffect는 스냅샷 breakdown 델타로 이미 정확하다.
// 시작일(fromDate) 당일 거래도 포함(<)한다 — 과거 "(from,to] 시작일 제외" 규칙은 "시작 스냅샷이
// 그날 거래를 이미 반영했을 것"이란 전제였는데, 소급 기록·마지막 방문일과 같은 날짜로 남긴 거래는
// 스냅샷에 반영되지 않은 채 통째로 걸러져 debt/income이 사라지고 무관한 cash 잔차로 둔갑했다(2026-08 P1).
function reflectedLoanFlow(assetData: AssetData, fromDate: string, toDate: string): number {
  const txns = assetData.loanTransactions || [];
  let net = 0;
  for (const t of txns) {
    if (!t.reflected || t.date < fromDate || t.date > toDate) continue;
    net += t.type === "repay" ? t.amount : -t.amount;
  }
  return net;
}

// 기간[from, to] 내 반영된 코인 매수/매도 체결액을 매수/매도로 나눠 합산.
// 코인은 항상 KRW 취급(currency·exchangeRate 없음)이라 rates 불필요 — reflectedTradeFlow(주식)와
// 동형이나 통화 변환이 없다는 점만 다르다(reflectedLoanFlow와 동일한 이유로 rates 불필요).
// 시작일(fromDate) 당일 거래 포함 이유는 reflectedCashInflow와 동일(2026-08 P1).
function reflectedCryptoFlow(assetData: AssetData, fromDate: string, toDate: string): { buy: number; sell: number } {
  const txns = assetData.cryptoTransactions || [];
  let buy = 0;
  let sell = 0;
  for (const t of txns) {
    if (!t.reflected || t.date < fromDate || t.date > toDate) continue;
    const amount = t.quantity * t.price;
    if (t.type === "buy") buy += amount;
    else sell -= amount;
  }
  return { buy, sell };
}

// 통합 시계열 포인트: daily는 date 그대로, monthly는 실제 말일로 정렬(표시는 YYYY-MM).
// _isLive: buildLiveAttributionCurr가 만든 실시간 끝점 표시(스냅샷=refPrice 기준과 달리 currentPrice=실시간 quote 기준).
type AttributionPoint = (DailyAssetSnapshot | MonthlyAssetSnapshot) & {
  _date: string; _display: string; _isLive?: boolean; _isMonthly?: boolean;
};

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
    // _date는 범위 경계(fromDate)로도 쓰이므로 실제 캡처일(s.date)을 우선한다 — 월말로 강제하면
    // 실제 캡처일~월말 사이에 일어난 거래가 reflectedXFlow 범위 필터에서 누락된다. 레거시(필드
    // 없음)만 월말로 폴백. _display는 차트·문구용 "YYYY-MM" 표기이므로 그대로 둔다.
    monthlyPoints: monthly.map((s) => ({ ...s, _date: s.date ?? monthEnd(s.month), _display: s.month, _isMonthly: true })),
  };
}

// 날짜 오름차순, 같은 날짜(월말=daily)면 daily가 뒤 — 시작점은 이 배열을 reverse해서 고르므로
// daily가 우선 선택된다. monthly는 v2 필드(breakdown·cost)가 없거나 갱신이 늦어 예측 모드로
// 떨어질 수 있고, 표기도 "지난 접속(7월) 이후"가 아니라 "전일 대비"가 맞다.
const byDateThenDaily = (a: AttributionPoint, b: AttributionPoint): number =>
  a._date.localeCompare(b._date) || (a._isMonthly ? 0 : 1) - (b._isMonthly ? 0 : 1);

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

// 정밀 분해에 필요한 필드를 모두 가졌는지 — computePeriodAttribution의 하이브리드 구간 탐색과
// resolveAttribution의 bothEnriched 판정이 반드시 같은 술어를 써야 두 곳의 실측/예측 경계가 일치한다.
function isFullyEnriched(p: AttributionPoint): boolean {
  return !!(p.breakdown && p.fx && p.fxBase && p.cost);
}

// prev/curr 두 스냅샷으로 Δ순자산을 여러 효과로 분해 (computePeriodAttribution·computeAttributionSince 공용)
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

  const bothEnriched = isFullyEnriched(prev) && isFullyEnriched(curr);

  // 기간(prev, curr] 내 현금 순유입(입금−출금, KRW 환산) — 월급·목돈 등을 saving에서 분리
  const incomeEffect = reflectedCashInflow(assetData, prev._date, curr._date, rates);

  if (bothEnriched) {
    // 정밀 분해. saving은 총원가 증감이라 현금 유입(income)을 포함 → income을 떼어내 투자자산 매수만 남긴다.
    const savingFull = curr.cost!.total - prev.cost!.total;                   // Δ총원가(현금 포함)
    // 외화 원가(주식·현금)는 cost.total이 현재 환율로 환산돼 환율만 움직여도 savingFull에 잡힌다 —
    // 신규 투입이 아니므로 제외한다. (fxEffect가 평가액 기준으로 환차익을 이미 잡으므로 saving에 남기면 이중 귀속)
    const costFx = costFxRevaluation(assetData, prev.fx!, curr.fx!);
    const savingFullReal = savingFull - (costFx.stock + costFx.cash);
    const savingInvest = savingFullReal - incomeEffect;                       // 투자자산 신규 매수
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
    // 잔차 = 시세. income은 savingFull에 이미 포함돼 차감됐고,
    // costFx는 fxEffect가 담당하므로 여기선 제외.
    const priceEffect = deltaNet - savingFullReal - debtEffect - fxEffect;

    // ── 자산군별 분해 ─────────────────────────────────────────────
    // 스냅샷의 breakdown(자산군별 평가액)·cost(자산군별 원가)로 시세·매수를 자산군까지 쪼갠다.
    // priceEffect·savingEffect **총액은 건드리지 않고** 그 안을 나누므로 표시 합계 = deltaNet은 불변이다.
    const dCostStockRaw = curr.cost!.stock - prev.cost!.stock;
    const dCostStock = dCostStockRaw - costFx.stock;   // 환율 재평가를 뺀 순수 투입
    const dCostCrypto = curr.cost!.crypto - prev.cost!.crypto;
    const dCostRealEstate = curr.cost!.realEstate - prev.cost!.realEstate;

    // 환율효과 중 주식 몫 = 전체 − 현금 몫. 현금은 원가=잔액이라 costFxRevaluation이 정확히 계산하므로,
    // 나머지를 주식 몫으로 두면 안분 근사 오차가 0이 된다(= 설명되지 않는 잔차가 남지 않는다).
    const fxStock = fxEffect - costFx.cash;

    // 주식 평가손익의 환차익 = (평가액 기준 환차익) − (원가 기준 환차익) → 시세에서 제외
    const priceStock = (curr.breakdown!.stocks - prev.breakdown!.stocks - dCostStockRaw) - (fxStock - costFx.stock);
    const priceCrypto = (curr.breakdown!.crypto - prev.breakdown!.crypto) - dCostCrypto;
    const priceRealEstate = (curr.breakdown!.realEstate - prev.breakdown!.realEstate) - dCostRealEstate;

    // 거래내역 없이 수량·평단을 직접 수정한 분(스크린샷 일괄 등록 등)은 방향별로 매수/매도에 합산
    // — 같은 라벨이 두 줄로 갈라지지 않게 한다.
    const stockManual = dCostStock - buyEffect - sellEffect;
    const buyStock = buyEffect + Math.max(stockManual, 0);
    const sellStock = sellEffect + Math.min(stockManual, 0);

    // 코인도 주식과 동형 — 반영된 매수/매도 거래(reflectedCryptoFlow)를 권위 소스로 쓰고,
    // 거래내역 없이 수량·평단만 직접 수정한 나머지(cryptoManual)는 방향별로 합산한다(S-4.25).
    const { buy: buyCryptoEffect, sell: sellCryptoEffect } = reflectedCryptoFlow(assetData, prev._date, curr._date);
    const cryptoManual = dCostCrypto - buyCryptoEffect - sellCryptoEffect;
    const buyCrypto = buyCryptoEffect + Math.max(cryptoManual, 0);
    const sellCrypto = sellCryptoEffect + Math.min(cryptoManual, 0);

    // 자산군별 시세로 설명되지 않는 잔차 — fxStock 정의상 이론값은 0이고, 스냅샷의 netAsset과
    // breakdown 합이 어긋날 때(반올림·구버전 기록·breakdown에 없는 필드의 변동)만 비영이 된다.
    // 성격이 현금성 변동이므로 아래 dCostCash에 합산한다 — 이 항이 있어야 표시 합계 = deltaNet이 무조건 성립한다.
    const priceResidual = priceEffect - priceStock - priceCrypto - priceRealEstate;

    // 임차보증금 증감 — netAsset = totalValue − loans − tenantDeposit이라 breakdown에 이 필드가
    // 없으면 그 변동이 통째로 priceResidual(→ 현금 잔차)로 새어나간다. 필드가 있는 스냅샷끼리만
    // 분리 가능(구버전은 여전히 잔차로 남음). debt와 대칭: 증가=−(부채성이므로), 반환=+.
    const depositEffect = (prev.breakdown!.tenantDeposit != null && curr.breakdown!.tenantDeposit != null)
      ? -(curr.breakdown!.tenantDeposit - prev.breakdown!.tenantDeposit)
      : 0;

    // 투자자산 3종+임차보증금으로 설명되지 않는 원가 증감 = 현금성 잔액 변동. 입출금 기록 없이
    // 잔액을 직접 수정한 경우가 여기 남는다 — "income"과 합치지 않고 별도 "cash"로 방출해
    // incomeEffect(실제 기록)가 대수적으로 소거되지 않게 한다(기록 없이도 표시가 바뀌던 회귀 수정).
    const dCostCash = savingInvest - dCostStock - dCostCrypto - dCostRealEstate + priceResidual - depositEffect;

    const { effects, topCauses, restEffect, restCauses } = pickTopCauses([
      { key: "price:stock", amount: priceStock },
      { key: "price:crypto", amount: priceCrypto },
      { key: "price:realEstate", amount: priceRealEstate },
      { key: "fx", amount: fxEffect },
      { key: "buy:stock", amount: buyStock },
      { key: "sell:stock", amount: sellStock },
      { key: "buy:crypto", amount: buyCrypto },
      { key: "sell:crypto", amount: sellCrypto },
      { key: dCostRealEstate >= 0 ? "buy:realEstate" : "sell:realEstate", amount: dCostRealEstate },
      { key: "income", amount: incomeEffect },
      { key: "cash", amount: dCostCash },
      { key: "deposit", amount: depositEffect },
      { key: "debt", amount: debtEffect },
    ]);
    return { fromDate, toDate, deltaNet, priceEffect, fxEffect, savingEffect, buyEffect, sellEffect, incomeEffect, debtEffect, estimated: false, effects, topCauses, restEffect, restCauses };
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
  // breakdown(자산군별 평가액)은 fx/fxBase/cost 없이도 양쪽에 있을 수 있다 — breakdown.loans는
  // breakdown 존재 시 항상 채워지는 필수 필드이므로, 있으면 정밀 분기와 동일하게 잔액 차이로
  // 대출 증감을 직접 계산한다(대출 상환을 기록 없이 잔액만 수정한 경우도 정확히 잡힘).
  // 없으면(완전 레거시) 매수일 기반 신규대출 추정(inflows.debt) + 반영된 대출 거래로 폴백.
  const debtFromBreakdown = prev.breakdown && curr.breakdown
    ? -(curr.breakdown.loans - prev.breakdown.loans)
    : null;
  const debtEffect = debtFromBreakdown ?? (inflows.debt + reflectedLoanFlow(assetData, prev._date, curr._date));
  // 예측 모드의 saving은 매수일 기반이라 현금 유입을 포함하지 않음 → income을 별도 항으로 두고 잔차(price)에서 뺀다.
  // 거래내역이 있는 주식은 estimatePeriodInflows가 건너뛰므로(권위=거래내역) buy/sell을 여기서 분리해 노출한다.
  // (매수 반영 시 purchaseDate가 안 바뀌어 추가 매수가 saving에서 통째로 누락되던 문제 해소)
  const { buy: buyEffect, sell: sellEffect } = reflectedTradeFlow(assetData, prev._date, curr._date, rates);
  // 코인도 동일 — estimatePeriodInflows가 tradedCryptoIds를 건너뛰므로(권위=거래내역) 여기서 분리 노출(S-4.25)
  const { buy: buyCryptoEffect, sell: sellCryptoEffect } = reflectedCryptoFlow(assetData, prev._date, curr._date);
  const priceEffect = deltaNet - fxEffect - savingEffect - buyEffect - sellEffect - buyCryptoEffect - sellCryptoEffect - debtEffect - incomeEffect;
  // 시작 스냅샷에 자산군별 평가액(breakdown)이 없어 **시세만** 통합 "price"로 남고, 매수·매도는 자산군별로 나뉜다.
  const buyStock = buyEffect + Math.max(inflows.stock, 0);
  const sellStock = sellEffect + Math.min(inflows.stock, 0);
  const buyCrypto = buyCryptoEffect + Math.max(inflows.crypto, 0);
  const sellCrypto = sellCryptoEffect + Math.min(inflows.crypto, 0);
  // 예측 분해 구간에서 실제로 추정치인 것만 표시 — income(reflectedCashInflow)은 이 분기에서도
  // 기록된 거래내역을 그대로 쓰므로 예측이 아니다. debt·buy:stock/sell:stock은 실측(반영 거래)과
  // 추정(매수일·대출일 기반 inflows)이 섞여 있어 일부만 예측이라도 estimated:true로 표시한다.
  const { effects, topCauses, restEffect, restCauses } = pickTopCauses([
    { key: "price", amount: priceEffect, estimated: true },
    { key: "fx", amount: fxEffect, estimated: true },
    { key: "buy:stock", amount: buyStock, estimated: true },
    { key: "sell:stock", amount: sellStock, estimated: true },
    { key: "buy:crypto", amount: buyCrypto, estimated: true },
    { key: "sell:crypto", amount: sellCrypto, estimated: true },
    { key: inflows.realEstate >= 0 ? "buy:realEstate" : "sell:realEstate", amount: inflows.realEstate, estimated: true },
    { key: "income", amount: incomeEffect },
    { key: "debt", amount: debtEffect, estimated: debtFromBreakdown === null },
  ]);
  return {
    fromDate, toDate, deltaNet,
    priceEffect, fxEffect, savingEffect, buyEffect, sellEffect, incomeEffect, debtEffect,
    estimated: true, estimatedUntil: toDate, effects, topCauses, restEffect, restCauses,
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

// 기간[from, to] 내 **반영된** 현금 거래 순유입(입금−출금)을 KRW로 환산해 합산.
// 앱이 잔액을 가감했으므로 cost.total 변화(savingFull)에 이미 포함 → saving에서 차감해 소득으로 귀속한다.
// 미반영(과거 소급 기록)은 잔액을 건드리지 않아 순자산을 움직이지 않았으므로 변동 원인이 아니다 → 제외.
// (그 입금이 실제로 잔액에 반영돼 있었다면 그 증감은 dCostCash로 이미 소득 항목에 잡힌다)
// 시작일(fromDate) 당일 거래도 포함(<)한다 — reflectedLoanFlow와 동일 이유(2026-08 P1):
// "(from,to] 시작일 제외"는 소급 기록·마지막 방문일과 같은 날짜의 거래를 통째로 걸러
// income이 0으로 계산되고 그 금액이 무관한 cash 잔차("현금 잔액 증가/감소")로 새어나갔다.
function reflectedCashInflow(
  assetData: AssetData,
  fromDate: string,
  toDate: string,
  rates: { USD: number; JPY: number },
): number {
  const txns = assetData.cashTransactions || [];
  let reflected = 0;
  for (const t of txns) {
    if (!t.reflected || t.date < fromDate || t.date > toDate) continue;
    reflected += (t.type === "deposit" ? t.amount : -t.amount) * krwMul(t.currency, rates);
  }
  return reflected;
}

// 기간[from, to] 내 반영된 주식 거래 체결액을 KRW로 환산해 매수/매도로 나눠 합산.
// 체결 시 환율(exchangeRate)이 있으면 그걸, 없으면 현재 환율로 환산한다.
// 한계 ①: transactionSchema는 주식 전용(stockId·ticker) — 부동산 매수는 saving 잔여로 남는다
// (코인은 cryptoTransactionSchema·reflectedCryptoFlow로 동일하게 분리됨, S-4.25).
// 한계 ②: 매도의 원가 감소분은 당시 평균단가를 알 수 없어 체결액으로 잡으므로,
//         실현손익만큼의 차이는 saving 잔여가 흡수한다(합계 정합은 유지).
// 시작일(fromDate) 당일 거래 포함 이유는 reflectedCashInflow와 동일(2026-08 P1).
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
    if (!t.reflected || t.date < fromDate || t.date > toDate) continue;
    const rate = t.exchangeRate && t.exchangeRate > 0
      ? (t.currency === "JPY" ? t.exchangeRate / 100 : t.currency === "KRW" ? 1 : t.exchangeRate)
      : krwMul(t.currency, rates);
    const amount = t.quantity * t.price * rate;
    if (t.type === "buy") buy += amount;
    else sell -= amount;
  }
  return { buy, sell };
}

// 작년 이전 yearlyNetAssets(연도별 종가 순자산, netAsset만)를 12/31 앵커 포인트로 승격 —
// daily(30일 롤링)·monthly(올해분만)가 못 미치는 먼 과거 구간에서도 "기록 없음" 대신
// 예측이라도 시작점을 잡을 수 있게 후보 풀을 넓힌다. 값의 정확한 저장 시점은 알 수 없어(그 해
// 마지막 접속일) 12/31은 근사 표기일 뿐이지만, 이 포인트는 enrich가 없어 항상 예측 경로로만 쓰인다.
function yearlyAnchorPoints(assetData: AssetData): AttributionPoint[] {
  return (assetData.yearlyNetAssets || []).map((y) => {
    const d = `${y.year}-12-31`;
    return { date: d, netAsset: y.netAsset, financialAsset: y.netAsset, _date: d, _display: d } as AttributionPoint;
  });
}

// older(예측 구간)의 통합 "price" 효과를 mid 시점의 **주식·코인** 구성비(breakdown)로 안분해
// price:stock/price:crypto로 재배분한다 — 그래야 newer(실측 구간)의 같은 key와 pickTopCauses에서
// 합쳐져 "시세 하락"·"주식 시세 하락"이 별도 줄로 뜨는 문제가 없어진다.
// 부동산은 안분 대상에서 제외한다 — 부동산 currentValue는 주식·코인과 달리 시장가 자동 갱신이
// 없고 사용자가 실거래가 조회 후 수동으로만 바꾸는 계단식 값이라(real-estate-input.tsx),
// "정체불명 시세 변동"을 부동산 비중만큼 떼어주면 사용자가 값을 건드리지도 않았는데
// "부동산 시세 하락"이 뜨는 근거 없는 추정이 된다. 부동산의 실제 시세 변동은 정밀 분해
// (bothEnriched) 경로에서 breakdown.realEstate 차이로 직접 재는 것만 신뢰한다.
// 구성비를 알 수 없으면(mid breakdown 없음·주식+코인 구성 0) 안분하지 않고 통합 "price" 그대로
// 남긴다(이 경우 causeShortLabel의 "보유자산 시세" 라벨이 자산군 통합임을 대신 알려준다).
function reallocatePriceEffects(
  effects: { key: AttributionCauseKey; amount: number; estimated?: boolean }[],
  mid: AttributionPoint,
): { key: AttributionCauseKey; amount: number; estimated?: boolean }[] {
  const priceIdx = effects.findIndex((e) => e.key === "price");
  if (priceIdx < 0) return effects;
  const bd = mid.breakdown;
  const total = bd ? bd.stocks + bd.crypto : 0;
  if (!bd || total <= 0) return effects;
  const priceAmount = effects[priceIdx].amount;
  const splits = ([
    ["price:stock", bd.stocks],
    ["price:crypto", bd.crypto],
  ] as const)
    .filter(([, v]) => v > 0)
    .map(([key, v]) => ({ key, amount: priceAmount * (v / total), estimated: true }));
  return [...effects.slice(0, priceIdx), ...effects.slice(priceIdx + 1), ...splits];
}

// 두 인접 구간((prevOld, mid] 예측 + (mid, curr] 실측)의 raw 효과를 key별로 합산해 하나로 재구성.
// 각 필드가 텔레스코핑(가산적)이라 성립 — deltaNet·집계 필드 모두 단순 합, effects도 key별 합산 뒤
// pickTopCauses를 1회만 다시 돌려 표시용 top/rest를 재선정한다(합계 = deltaNet 항등식은 자동 유지).
function mergeAttributions(older: PeriodAttribution, newer: PeriodAttribution, mid: AttributionPoint): PeriodAttribution {
  const reallocatedOlder = reallocatePriceEffects(older.effects, mid);
  const { effects, topCauses, restEffect, restCauses } = pickTopCauses([...reallocatedOlder, ...newer.effects]);
  return {
    fromDate: older.fromDate,
    toDate: newer.toDate,
    deltaNet: older.deltaNet + newer.deltaNet,
    priceEffect: older.priceEffect + newer.priceEffect,
    fxEffect: older.fxEffect + newer.fxEffect,
    savingEffect: older.savingEffect + newer.savingEffect,
    buyEffect: older.buyEffect + newer.buyEffect,
    sellEffect: older.sellEffect + newer.sellEffect,
    incomeEffect: older.incomeEffect + newer.incomeEffect,
    debtEffect: older.debtEffect + newer.debtEffect,
    estimated: false, // 실측 구간이 섞였으므로 "전체 예측"은 아님 — 부분예측은 estimatedUntil로 표현
    // older가 실제로 예측이었을 때만 경계를 표시한다(하드코딩하면 호출부가 실측끼리도 쪼개 넘길 때
    // 근거 없이 "일부 예측" 배지가 붙는다 — computePeriodAttribution의 mid 탐색 가드와 별개로 방어).
    estimatedUntil: older.estimated ? older.toDate : undefined,
    effects, topCauses, restEffect, restCauses,
  };
}

// 기간 내 breakdown.cash가 baselineCash에서 일시적으로 크게 벗어났다가 순변화 없이(또는 미미하게)
// 되돌아온 경우를 감지한다. resolveAttribution은 두 끝점만 비교해 "cash" 순변화만 보므로, 구간
// 중간의 왕복은 net에 안 잡혀 원인 목록에서 통째로 사라진다 — "더 긴 기간엔 왜 안 보이냐"는
// 혼란을 막기 위한 안내용. cash만 대상으로 한다(시세는 상시 변동이 정상이라 매번 안내하면 노이즈).
// 이탈폭은 시점별 "기록으로 설명되는 현금 유입(income)"을 뺀 뒤 재는다 — 왕복 판정에 쓰는
// netCashEffect(= cash cause, 기록으로 설명되지 않는 잔차)와 같은 기준으로 맞추기 위함.
// 그렇지 않으면 기록된 입금만으로 잔액이 단조 증가한 경우에도(잔차는 0인데 breakdown.cash는
// 영구히 올라 있으므로) "왕복 후 복귀"로 오판된다.
function detectCashRoundTrip(
  segmentDaily: AttributionPoint[],
  baselineCash: number,
  netCashEffect: number,
  startDate: string,
  assetData: AssetData,
  rates: { USD: number; JPY: number },
): { peakAmount: number; peakDate: string } | null {
  let peak = { amount: 0, date: "" };
  for (const p of segmentDaily) {
    if (!p.breakdown) continue;
    const incomeToDate = reflectedCashInflow(assetData, startDate, p._date, rates);
    const dev = p.breakdown.cash - baselineCash - incomeToDate;
    if (Math.abs(dev) > Math.abs(peak.amount)) peak = { amount: dev, date: p._date };
  }
  if (Math.abs(peak.amount) < CAUSE_DISPLAY_MIN) return null;
  // 순변화가 최고 이탈폭의 절반 이상이면 "왕복 후 복귀"로 보기 어렵다 — 조용히 생략
  if (Math.abs(netCashEffect) >= Math.abs(peak.amount) * 0.5) return null;
  return { peakAmount: peak.amount, peakDate: peak.date };
}

// 실측 daily 구간(start 이후 ~ curr까지)이 있을 때만 왕복을 탐지해 붙인다.
// start가 없거나 breakdown이 없으면(예측 전용 구간) 탐지 자체가 불가능하므로 그대로 반환.
function attachCashRoundTrip(
  attr: PeriodAttribution,
  dailyPoints: AttributionPoint[],
  start: AttributionPoint | undefined,
  curr: AttributionPoint,
  assetData: AssetData,
  rates: { USD: number; JPY: number },
): PeriodAttribution {
  if (!start || !start.breakdown) return attr;
  const segment = dailyPoints.filter((p) => p._date > start._date && p._date <= curr._date && p.breakdown);
  const netCash = attr.effects.find((e) => e.key === "cash")?.amount ?? 0;
  const roundTrip = detectCashRoundTrip(segment, start.breakdown.cash, netCash, start._date, assetData, rates);
  return roundTrip ? { ...attr, cashRoundTrip: roundTrip } : attr;
}

// 기간 시작점에 가장 가까운(시작일 이하 최근) 스냅샷 선택 후, 그 안에서 실측 가능한 부분 구간을
// 찾아 예측+실측으로 나눠 합성한다. **1주·1개월·3개월·올해 전부 이 알고리즘 하나를 공유** —
// 기간마다 다른 것은 시작일(targetStr) 계산뿐이다: 실측 스냅샷이 있는 구간은 실측으로, 그 이전의
// 부족한 구간만 예측으로 채운다(1주도 예외 아님 — 공유 링크로 복원한 기기는 daily의 enrich가
// 소실돼 1주도 예측이 될 수 있다).
// liveCurr 전달 시 끝점을 저장된 종가 스냅샷 대신 실시간 현재값(buildLiveAttributionCurr)으로
// 사용한다(computeAttributionSince와 동일 패턴) — 세션 중 기록한 자산 변경이 다음 스냅샷 저장
// 전까지 누락되던 문제, 일요일엔 "오늘" 날짜 daily가 아예 없어(토요일 슬롯만 upsert) curr이
// 토요일에 고정돼 일요일자 거래가 range 밖으로 밀리던 문제를 함께 해소한다(2026-08).
export function computePeriodAttribution(
  daily: DailyAssetSnapshot[],
  monthly: MonthlyAssetSnapshot[],
  exchangeHistory: Record<string, { USD: number; JPY: number }>,
  period: AttributionPeriod,
  assetData: AssetData,
  rates: { USD: number; JPY: number },
  liveCurr?: AttributionPoint,
): PeriodAttribution | null {
  const { dailyPoints, monthlyPoints } = buildAttributionPoints(daily, monthly);
  const curr = liveCurr ?? pickAttributionCurr(dailyPoints);
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

  const allPoints = [...dailyPoints, ...monthlyPoints, ...yearlyAnchorPoints(assetData)]
    .filter((s) => s._date < curr._date)
    .sort(byDateThenDaily);
  if (allPoints.length === 0) return null;

  // 시작 스냅샷: 목표일 이하 중 가장 최근. 없으면(연초 등 목표일보다 오래된 기록만 있거나 전혀
  // 없는 경우) "기록 없음"으로 죽이지 않고 가진 것 중 가장 오래된 포인트로 폴백한다
  // (computeAttributionSince의 `?? candidates[0]` 패턴과 동일 — 홈과 성적표가 같은 원칙을 쓴다).
  const prevOld = [...allPoints].reverse().find((s) => s._date <= targetStr) ?? allPoints[0];

  // 하이브리드 분기점: prevOld가 이미 실측(enrich 완비)이면 애초에 mid를 찾지 않는다 — 예를 들어
  // 1주는 daily 30일 롤링 창 안이라 prevOld가 대개 이미 완전히 실측인데, 여기서 무조건 mid를
  // 찾으면 불필요하게 두 구간으로 쪼개고(다음 줄부터) 실측 구간에 "예측" 경계가 잘못 찍힌다(P1 회귀).
  // prevOld가 예측(레거시 monthly·yearly 앵커 등)일 때만 (prevOld, curr) 구간에서 enrich를 모두
  // 가진 가장 오래된 daily를 찾는다. monthly는 mid 후보에서 제외 — _date가 월말로 강제돼 값 시점
  // (그 달 마지막 접속일)과 최대 30일 어긋나, 그 사이 거래·입출금이 flow 윈도우에서 누락된다.
  const mid = isFullyEnriched(prevOld) ? undefined : dailyPoints
    .filter((s) => s._date > prevOld._date && s._date < curr._date && isFullyEnriched(s))
    .sort((a, b) => a._date.localeCompare(b._date))[0];

  if (!mid) {
    const attr = resolveAttribution(prevOld, curr, exchangeHistory, assetData, rates);
    // prevOld가 실측일 때만(=isFullyEnriched) daily 세부가 있어 왕복 탐지가 가능하다
    return attachCashRoundTrip(attr, dailyPoints, isFullyEnriched(prevOld) ? prevOld : undefined, curr, assetData, rates);
  }
  const older = resolveAttribution(prevOld, mid, exchangeHistory, assetData, rates);
  const newer = resolveAttribution(mid, curr, exchangeHistory, assetData, rates);
  const merged = mergeAttributions(older, newer, mid);
  // 실측 구간은 (mid, curr]뿐이므로 왕복 탐지의 시작점도 mid로 한정한다
  return attachCashRoundTrip(merged, dailyPoints, mid, curr, assetData, rates);
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
    .sort(byDateThenDaily);
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
      tenantDeposit: summary.tenantDepositTotal,
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

// 통화별 외화노출 기준액(KRW 환산)을 자산군별로 산출 — computeFxExposure가 소비
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

