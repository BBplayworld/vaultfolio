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
  annualInterest: number;         // 연간 이자 추정 = Σ 잔액 × 금리
  monthlyInterest: number;        // 월 이자 추정 = annualInterest / 12
  loanInterest: { name: string; balance: number; rate: number; annual: number }[]; // 대출별 상세 (연이자 내림차순)
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
    .map((l) => ({ name: l.name, balance: l.balance, rate: l.interestRate, annual: l.balance * (l.interestRate / 100) }))
    .sort((a, b) => b.annual - a.annual);
  const annualInterest = loanInterest.reduce((sum, l) => sum + l.annual, 0);
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
    loanInterest,
    debtRatio,
    leverage,
  };
}

// ── 근사 원인분해 (레거시 스냅샷 + 환율 이력 — 첫날부터 제공) ─────────
// 레거시 스냅샷은 netAsset만 있어 3단 분해 불가. Δ순자산(스냅샷) + 환율 변화율(환율 이력)
// + 현재 외화노출(fxBase, 근사)로 2단 분해: 환율효과 / 시세·입출금 합산.
export interface ApproxAttributionResult {
  fromDate: string;
  toDate: string;
  deltaNet: number;
  fxEffect: number;   // 환율효과 (근사: 현재 노출 기준)
  restEffect: number; // 시세·입출금 합산 (과거 원가 미기록으로 분리 불가)
  approx: true;
}

export function computeApproxAttribution(
  snapshots: DailyAssetSnapshot[],
  exchangeHistory: Record<string, { USD: number; JPY: number }>,
  daysBack: number,
): ApproxAttributionResult | null {
  const sorted = [...snapshots].sort((a, b) => a.date.localeCompare(b.date));
  // 최신 enriched(오늘) — fx·fxBase 필요
  const curr = [...sorted].reverse().find((s) => s.fx && s.fxBase);
  if (!curr?.fx || !curr.fxBase) return null;

  // 기준일: 최신 스냅샷 날짜 - daysBack. 그 이하 중 가장 최근 스냅샷(netAsset만 있으면 됨)
  const target = new Date(curr.date);
  target.setDate(target.getDate() - daysBack);
  const targetStr = target.toISOString().split("T")[0];
  const prev = [...sorted].reverse().find((s) => s.date <= targetStr);
  if (!prev || prev.date === curr.date) return null;

  const deltaNet = curr.netAsset - prev.netAsset;

  // 이전 날짜 환율: 정확한 날짜 없으면 그 이전 가장 가까운 이력으로 폴백
  const histDates = Object.keys(exchangeHistory).sort();
  const prevFxDate = [...histDates].reverse().find((d) => d <= prev.date);
  if (!prevFxDate) return null;
  const prevFx = exchangeHistory[prevFxDate];

  const fxEffect = (["USD", "JPY"] as const).reduce((sum, c) => {
    if (!prevFx[c] || prevFx[c] <= 0) return sum;
    return sum + curr.fxBase![c] * (curr.fx![c] / prevFx[c] - 1);
  }, 0);

  return {
    fromDate: prev.date,
    toDate: curr.date,
    deltaNet,
    fxEffect,
    restEffect: deltaNet - fxEffect,
    approx: true,
  };
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

// ── 시계열 원인분해 델타 ──────────────────────────────────────────────
export interface AttributionResult {
  fromDate: string;
  toDate: string;
  deltaNet: number;    // Δ순자산
  priceEffect: number; // 시세효과 (잔차)
  fxEffect: number;    // 환율효과
  flowEffect: number;  // 입출금효과 (원가·대출 변화)
}

type EnrichedSnapshot = (DailyAssetSnapshot | MonthlyAssetSnapshot) & {
  breakdown: NonNullable<DailyAssetSnapshot["breakdown"]>;
  fx: NonNullable<DailyAssetSnapshot["fx"]>;
  fxBase: NonNullable<DailyAssetSnapshot["fxBase"]>;
  cost: NonNullable<DailyAssetSnapshot["cost"]>;
};

function keyOf(s: DailyAssetSnapshot | MonthlyAssetSnapshot): string {
  return "date" in s ? s.date : s.month;
}

function isEnriched(s: DailyAssetSnapshot | MonthlyAssetSnapshot): s is EnrichedSnapshot {
  return !!s.breakdown && !!s.fx && !!s.fxBase && !!s.cost;
}

// 인리치드(v2) 스냅샷 목록에서 가장 최근 2건으로 원인분해. 2건 미만이면 null.
export function computeAttribution(
  snapshots: (DailyAssetSnapshot | MonthlyAssetSnapshot)[],
): AttributionResult | null {
  const enriched = snapshots
    .filter(isEnriched)
    .sort((a, b) => keyOf(a).localeCompare(keyOf(b)));
  if (enriched.length < 2) return null;

  const prev = enriched[enriched.length - 2];
  const curr = enriched[enriched.length - 1];

  const deltaNet = curr.netAsset - prev.netAsset;

  // 입출금효과: 총원가 변화 - 대출 변화 (원가·대출은 시장변동이 아닌 사용자 행위로만 바뀜)
  const flowEffect = (curr.cost.total - prev.cost.total) - (curr.breakdown.loans - prev.breakdown.loans);

  // 환율효과: 통화별 이전 외화노출 × 환율 변동률 (구성 안정 가정, 잔차는 시세로 흡수)
  const fxRate = (c: "USD" | "JPY") =>
    prev.fx[c] > 0 ? prev.fxBase[c] * (curr.fx[c] / prev.fx[c] - 1) : 0;
  const fxEffect = fxRate("USD") + fxRate("JPY");

  // 시세효과: 나머지
  const priceEffect = deltaNet - flowEffect - fxEffect;

  return {
    fromDate: keyOf(prev),
    toDate: keyOf(curr),
    deltaNet,
    priceEffect,
    fxEffect,
    flowEffect,
  };
}
