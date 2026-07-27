import { AssetData, AssetSummary } from "@/types/asset";
import { formatShortCurrency } from "@/lib/number-utils";

export interface AssetPromptContext {
  data: AssetData;
  summary: AssetSummary;
  exchangeRates?: { USD: number; JPY: number };
}

export interface PromptTemplate {
  id: string;
  label: string;
  sublabel: string;
  generate: (ctx: AssetPromptContext) => string;
}

// 공통 가드레일 — 개별 종목 리딩(추천·목표가·타이밍)만 금지, 자산 구조·리스크·세금 관리 관점은 허용
// (서비스는 자산 "관리" 목적이며 투자 조언을 포함하지 않는다는 원칙과 일치)
const GUARDRAIL = `[중요 — 이 도구는 개인 자산 "관리" 보조용입니다]
- 개별 종목의 매수·매도 추천, 목표주가, 매매 타이밍 제시는 하지 마세요.
- 미래 가격·수익률을 단정적으로 예측하지 마세요 (시나리오는 "가정"으로만 제시).
- 제가 이미 보유한 자산의 구성·비중·리스크·부채·세금 구조 관점에서만 분석해 주세요.
`;

// 최신 LLM에서 답변 품질을 끌어올리는 공통 지침 — 근거 우선·구조화·가정 명시·수치 인용
const ANALYSIS_DIRECTIVE = `[답변 방식 — 아래 4가지를 지켜 분석의 밀도를 높여 주세요]
1. 결론 전에 근거가 되는 수치를 먼저 짚고, 단계적으로 따져 판단하세요.
2. 비교·배분·우선순위는 가능한 한 표로 정리하고, 실행 항목은 "기대 효과 × 실행 난이도"로 우선순위를 매기세요.
3. 사용한 가정(기대수익률·물가·저축률 등)은 명시하고, 데이터로 알 수 없는 부분은 단정하지 말고 "추가 확인 필요"로 표시하세요.
4. 일반론이 아니라 아래 제 실제 수치를 직접 인용해 "왜 그런지"까지 설명하세요.
`;

// ─── 데이터 포맷 헬퍼 ────────────────────────────────────────────────────────

const REAL_ESTATE_TYPE: Record<string, string> = {
  apartment: "아파트", house: "주택", land: "토지", commercial: "상가", other: "기타",
};

const STOCK_CATEGORY: Record<string, string> = {
  domestic: "국내", foreign: "해외", irp: "IRP", isa: "ISA", pension: "연금", unlisted: "비상장",
};

const LOAN_TYPE: Record<string, string> = {
  credit: "신용대출", minus: "마이너스통장",
  home_mortgage: "담보대출", "mortgage-home": "담보대출",
  stock_mortgage: "주식담보대출", "mortgage-stock": "주식담보대출",
  insurance_loan: "보험약관대출", "mortgage-insurance": "보험약관대출",
  deposit_loan: "전세자금대출", "mortgage-deposit": "전세자금대출",
  other: "기타", "mortgage-other": "기타",
};

function buildRealEstateList(data: AssetData): string {
  if (data.realEstate.length === 0) return "  - 등록된 부동산 없음";
  return data.realEstate.map((item) => {
    const type = REAL_ESTATE_TYPE[item.type] ?? item.type;
    const profit = item.currentValue - item.purchasePrice;
    const profitRate = item.purchasePrice > 0 ? ((profit / item.purchasePrice) * 100).toFixed(1) : "0.0";
    const sign = profit >= 0 ? "+" : "";
    return `  • ${item.name} (${type}) ${item.address ? `— ${item.address}` : ""}
    매입가 ${formatShortCurrency(item.purchasePrice)} → 현재가 ${formatShortCurrency(item.currentValue)} | 손익 ${sign}${profitRate}%${item.tenantDeposit ? ` | 임차보증금 ${formatShortCurrency(item.tenantDeposit)}` : ""}`;
  }).join("\n");
}

function buildStockList(data: AssetData, exchangeRates?: { USD: number; JPY: number }): string {
  if (data.stocks.length === 0) return "  - 등록된 주식 없음";
  const getMultiplier = (currency?: string) => {
    if (!exchangeRates) return 1;
    if (currency === "USD") return exchangeRates.USD;
    if (currency === "JPY") return exchangeRates.JPY / 100;
    return 1;
  };
  return data.stocks.map((item) => {
    const category = STOCK_CATEGORY[item.category] ?? item.category;
    const multiplier = getMultiplier(item.currency);
    const value = item.quantity * item.currentPrice * multiplier;
    const cost = item.quantity * item.averagePrice * multiplier;
    const profit = value - cost;
    const profitRate = cost > 0 ? ((profit / cost) * 100).toFixed(1) : "0.0";
    const sign = profit >= 0 ? "+" : "";
    const currency = item.currency !== "KRW" ? ` (${item.currency})` : "";
    // 해외주식 환차손익 계산
    let fxLine = "";
    if (item.category === "foreign" && item.currency !== "KRW" && item.purchaseExchangeRate && item.purchaseExchangeRate > 0) {
      const purchaseRate = item.currency === "JPY" ? item.purchaseExchangeRate / 100 : item.purchaseExchangeRate;
      const currencyGain = (multiplier - purchaseRate) * item.quantity * item.averagePrice;
      const fxSign = currencyGain >= 0 ? "+" : "";
      fxLine = ` | 환차손익 ${fxSign}${formatShortCurrency(Math.round(currencyGain))} (매입환율 ${item.purchaseExchangeRate}→현재 ${item.currency === "JPY" ? (multiplier * 100).toFixed(0) : multiplier.toFixed(0)})`;
    }
    return `  • [${category}] ${item.name}${item.ticker ? ` (${item.ticker})` : ""}${currency}
    평균단가 ${formatShortCurrency(item.averagePrice)} × ${item.quantity}주 | 평가 ${formatShortCurrency(value)} | 손익 ${sign}${profitRate}%${fxLine}`;
  }).join("\n");
}

function buildCryptoList(data: AssetData): string {
  if (data.crypto.length === 0) return "  - 등록된 암호화폐 없음";
  return data.crypto.map((item) => {
    const value = item.quantity * item.currentPrice;
    const cost = item.quantity * item.averagePrice;
    const profit = value - cost;
    const profitRate = cost > 0 ? ((profit / cost) * 100).toFixed(1) : "0.0";
    const sign = profit >= 0 ? "+" : "";
    return `  • ${item.name} (${item.symbol})${item.exchange ? ` — ${item.exchange}` : ""}
    보유 ${item.quantity} ${item.symbol} | 평가 ${formatShortCurrency(value)} | 손익 ${sign}${profitRate}%`;
  }).join("\n");
}

function buildCashList(data: AssetData): string {
  if (!data.cash || data.cash.length === 0) return "  - 등록된 현금/예금 없음";
  return data.cash.map((item) => {
    const currency = item.currency !== "KRW" ? ` (${item.currency})` : "";
    return `  • ${item.name}${currency}${item.institution ? ` — ${item.institution}` : ""}: ${formatShortCurrency(item.balance)}`;
  }).join("\n");
}

function buildLoanList(data: AssetData): string {
  if (data.loans.length === 0) return "  - 등록된 대출 없음";
  return data.loans.map((item) => {
    const type = LOAN_TYPE[item.type] ?? item.type;
    // 담보대출 연계 자산 표시
    let linkedLine = "";
    if (item.linkedRealEstateId) {
      const linked = data.realEstate.find(r => r.id === item.linkedRealEstateId);
      if (linked) linkedLine = ` | 연계 부동산: ${linked.name} (현재가 ${formatShortCurrency(linked.currentValue)})`;
    }
    if (item.linkedStockId) {
      const linked = data.stocks.find(s => s.id === item.linkedStockId);
      if (linked) linkedLine = ` | 연계 주식: ${linked.name}${linked.ticker ? ` (${linked.ticker})` : ""}`;
    }
    if (item.linkedCashId) {
      const linked = data.cash?.find(c => c.id === item.linkedCashId);
      if (linked) linkedLine = ` | 연계 예금: ${linked.name} (${formatShortCurrency(linked.balance)})`;
    }
    return `  • ${item.name} (${type})${item.institution ? ` — ${item.institution}` : ""}
    잔액 ${formatShortCurrency(item.balance)} | 금리 ${item.interestRate}%${linkedLine}`;
  }).join("\n");
}

function buildFxSection(ctx: AssetPromptContext): string {
  const { data, summary } = ctx;
  const foreignStocks = data.stocks.filter(
    s => s.category === "foreign" && s.currency !== "KRW" && s.purchaseExchangeRate && s.purchaseExchangeRate > 0
  );
  if (foreignStocks.length === 0) return "";

  const getMultiplier = (currency?: string) => {
    if (!ctx.exchangeRates) return 1;
    if (currency === "USD") return ctx.exchangeRates.USD;
    if (currency === "JPY") return ctx.exchangeRates.JPY / 100;
    return 1;
  };

  const fxSign = summary.stockCurrencyGain >= 0 ? "+" : "";
  const fxRatio = summary.stockValue > 0
    ? ((summary.stockCurrencyGain / summary.stockValue) * 100).toFixed(2) : "0.00";

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💱 해외주식 환차손익 현황
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 전체 환차손익: ${fxSign}${formatShortCurrency(Math.round(summary.stockCurrencyGain))} (주식평가액 대비 ${fxSign}${fxRatio}%)
• 환평가손익 합계 (손익 + 환차): ${summary.stockFxProfit >= 0 ? "+" : ""}${formatShortCurrency(Math.round(summary.stockFxProfit))}
${foreignStocks.map(s => {
    const currentRate = getMultiplier(s.currency);
    const unit = s.currency === "JPY" ? "100JPY" : s.currency;
    const currentRateDisplay = s.currency === "JPY" ? (currentRate * 100).toFixed(0) : currentRate.toFixed(0);
    return `  • ${s.name} (${s.ticker ?? s.currency}): 매입환율 ${s.purchaseExchangeRate}원/${unit} → 현재 ${currentRateDisplay}원/${unit}`;
  }).join("\n")}`;
}

function buildCollateralSection(data: AssetData): string {
  const collateralLoans = data.loans.filter(
    l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId
  );
  if (collateralLoans.length === 0) return "";

  const lines = collateralLoans.map(loan => {
    const type = LOAN_TYPE[loan.type] ?? loan.type;
    let assetDesc = "";
    let ltv = "";
    if (loan.linkedRealEstateId) {
      const linked = data.realEstate.find(r => r.id === loan.linkedRealEstateId);
      if (linked) {
        assetDesc = `부동산 "${linked.name}" (평가 ${formatShortCurrency(linked.currentValue)})`;
        const ltvVal = linked.currentValue > 0 ? ((loan.balance / linked.currentValue) * 100).toFixed(1) : "?";
        ltv = ` | LTV ${ltvVal}%`;
      }
    } else if (loan.linkedStockId) {
      const linked = data.stocks.find(s => s.id === loan.linkedStockId);
      if (linked) assetDesc = `주식 "${linked.name}"${linked.ticker ? ` (${linked.ticker})` : ""}`;
    } else if (loan.linkedCashId) {
      const linked = data.cash?.find(c => c.id === loan.linkedCashId);
      if (linked) {
        assetDesc = `예금 "${linked.name}" (${formatShortCurrency(linked.balance)})`;
        const ratio = linked.balance > 0 ? ((loan.balance / linked.balance) * 100).toFixed(1) : "?";
        ltv = ` | 담보비율 ${ratio}%`;
      }
    }
    return `  • ${loan.name} (${type}) — 잔액 ${formatShortCurrency(loan.balance)}, 금리 ${loan.interestRate}%${ltv}
    담보: ${assetDesc}`;
  });

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔗 담보대출 연계 현황 (${collateralLoans.length}건)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${lines.join("\n")}`;
}

function buildDataSection(ctx: AssetPromptContext): string {
  const { data, summary } = ctx;
  const debtRatio = summary.totalValue > 0
    ? (summary.loanBalance / summary.totalValue * 100).toFixed(1) : "0";
  const netAssetRatio = summary.totalValue > 0
    ? (summary.netAsset / summary.totalValue * 100).toFixed(1) : "0";
  const stockProfitRate = summary.stockCost > 0
    ? ((summary.stockProfit / summary.stockCost) * 100).toFixed(1) : "0";
  const realEstateProfitRate = summary.realEstateCost > 0
    ? ((summary.realEstateProfit / summary.realEstateCost) * 100).toFixed(1) : "0";
  const cryptoProfitRate = summary.cryptoCost > 0
    ? ((summary.cryptoProfit / summary.cryptoCost) * 100).toFixed(1) : "0";

  const fxSection = buildFxSection(ctx);
  const collateralSection = buildCollateralSection(data);

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 자산 현황 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 총자산:   ${formatShortCurrency(summary.totalValue)}
• 총부채:   ${formatShortCurrency(summary.loanBalance)}${summary.tenantDepositTotal > 0 ? ` + 임차보증금 ${formatShortCurrency(summary.tenantDepositTotal)}` : ""}
• 순자산:   ${formatShortCurrency(summary.netAsset)} (순자산비율 ${netAssetRatio}%)
• 부채비율: ${debtRatio}%
• 전체 투자손익: ${summary.totalProfit >= 0 ? "+" : ""}${formatShortCurrency(summary.totalProfit)} (${summary.totalProfitRate.toFixed(1)}%)
${fxSection ? `• 해외주식 환차손익: ${summary.stockCurrencyGain >= 0 ? "+" : ""}${formatShortCurrency(Math.round(summary.stockCurrencyGain))}` : ""}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 부동산 (${formatShortCurrency(summary.realEstateValue)}, ${summary.realEstateCount}건 | 손익 ${realEstateProfitRate}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildRealEstateList(data)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 주식 (${formatShortCurrency(summary.stockValue)}, ${summary.stockCount}종목 | 손익 ${stockProfitRate}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildStockList(data, ctx.exchangeRates)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
₿ 암호화폐 (${formatShortCurrency(summary.cryptoValue)}, ${summary.cryptoCount}종목 | 손익 ${cryptoProfitRate}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildCryptoList(data)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💵 현금 · 예금 (${formatShortCurrency(summary.cashValue)})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildCashList(data)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💳 대출 (${formatShortCurrency(summary.loanBalance)}, ${summary.loanCount}건)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildLoanList(data)}${fxSection}${collateralSection}`;
}

// ─── 프롬프트 템플릿 ──────────────────────────────────────────────────────────

export const AI_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "diagnosis",
    label: "종합 진단",
    sublabel: "강점·약점·즉각 개선 사항",
    generate: (ctx) => {
      const { summary } = ctx;
      const debtRatio = summary.totalValue > 0
        ? (summary.loanBalance / summary.totalValue * 100).toFixed(1) : "0";

      return `${GUARDRAIL}
당신은 한국의 15년 경력 자산관리 전문가(CFP)입니다.
아래 제 자산 현황을 보고 현재 포트폴리오를 솔직하게 진단해 주세요.
듣기 좋은 말보다, 실제로 개선이 필요한 지점을 근거와 함께 명확히 짚어주세요.
${ANALYSIS_DIRECTIVE}${buildDataSection(ctx)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 진단 요청 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

0. **종합 점수표 (먼저 제시)**
   - 자산 구성 / 수익의 질 / 부채 건전성 / 분산 / 유동성 5개 항목을 각 1~5점으로 채점하고, 점수마다 한 줄 근거를 표로 정리해 주세요.

1. **자산 구성 진단**
   - 부동산 / 주식 / 코인 / 현금 비중을 제시하고, 제 나이·자산 규모대의 통념적 배분과 비교해 과부족을 판단해 주세요.
   - 단일 자산 과집중(예: 특정 부동산·종목이 순자산의 몇 %인지)을 수치로 짚어주세요.

2. **수익률 분석**
   - 자산별 기여도를 "포트폴리오를 끌어올린 항목 / 발목 잡는 항목"으로 나눠 표로 정리해 주세요.
   - 손실 중인 항목은 원인(시세·환율·진입가)을 구분하고, 보유 vs 정리 판단 기준을 제시해 주세요.
${summary.stockCurrencyGain !== 0 ? `
3. **해외주식 환차손익 분석**
   - 현재 환차손익이 ${summary.stockCurrencyGain >= 0 ? "+" : ""}${formatShortCurrency(Math.round(summary.stockCurrencyGain))}입니다. 환율 변동이 포트폴리오에 미치는 실질적인 영향을 평가해 주세요.
   - 환차손익을 줄이기 위한 헤지 전략이나 환율 리스크 관리 방법을 알려주세요.
` : ""}
${ctx.data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId) ? `
${summary.stockCurrencyGain !== 0 ? "4" : "3"}. **담보대출 구조 진단**
   - 담보대출 연계 현황(LTV, 담보비율)을 보고 현재 레버리지 구조가 적정한지 평가해 주세요.
   - 담보 자산 가치 하락 시 추가담보 요구(마진콜) 위험이 있는 항목이 있나요?
` : ""}
${summary.stockCurrencyGain !== 0 || ctx.data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId) ? "5" : "3"}. **지금 당장 해야 할 3가지 행동**
   - 기대 효과가 큰 순서로, 각 항목에 "예상 효과 · 실행 난이도 · 걸리는 기간"을 함께 표기해 주세요.

${summary.stockCurrencyGain !== 0 || ctx.data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId) ? "6" : "4"}. **세금 관점 체크**
   - 현재 구성에서 양도소득세, 금융소득종합과세, IRP·ISA 연말정산 등 세금 측면에서 주의해야 할 사항이 있나요?

${summary.stockCurrencyGain !== 0 || ctx.data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId) ? "7" : "5"}. **전문가로서 한마디**
   - "만약 당신이 제 자산관리사라면, 오늘 퇴근 전 반드시 하라고 할 일이 무엇인가요?"
   (부채비율 ${debtRatio}%, 총자산 ${formatShortCurrency(summary.totalValue)}, 순자산 ${formatShortCurrency(summary.netAsset)} 기준으로 답해주세요.)`;
    },
  },

  {
    id: "growth",
    label: "증식 전략",
    sublabel: "리밸런싱·IRP/ISA·월별 투자 우선순위",
    generate: (ctx) => {
      const { summary } = ctx;
      const hasIrp = ctx.data.stocks.some(s => s.category === "irp");
      const hasIsa = ctx.data.stocks.some(s => s.category === "isa");
      const hasPension = ctx.data.stocks.some(s => s.category === "pension");

      const taxAccounts = [
        hasIrp && "IRP",
        hasIsa && "ISA",
        hasPension && "연금저축",
      ].filter(Boolean).join("·") || "IRP·ISA·연금저축 (현재 미등록)";

      return `${GUARDRAIL}
당신은 한국의 자산 증식 전략 전문가입니다.
아래 제 현재 자산을 기반으로 향후 5년 내 순자산을 최대로 늘리기 위한 구체적인 전략을 세워주세요.
막연한 격언이 아니라, 이 데이터에 맞는 수치·순서·가정을 포함해 주세요.
(단, 개별 종목 추천이 아니라 자산군 배분·계좌·저축 구조 관점에서 제시해 주세요.)
${ANALYSIS_DIRECTIVE}${buildDataSection(ctx)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 전략 수립 요청 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **목표 포트폴리오 배분 (표로)**
   - 자산군 | 현재 % | 목표 % | 이동 금액(±) | 근거 형태의 표로 제시해 주세요.
   - 목표 배분의 전제(제 위험성향·투자기간 가정)를 먼저 밝혀주세요.

2. **세제혜택 계좌 최적화** (현재 등록된 계좌: ${taxAccounts})
   - IRP·ISA·연금저축의 연간 납입 한도 대비 현재 여유분을 계산하고, 채우는 우선순위를 매겨주세요.
   - 각 계좌에 어떤 성격의 자산(ETF 유형)을 담는 게 세금·수익 측면에서 유리한지 알려주세요.

3. **리밸런싱 실행 계획**
   - 조정이 필요한 항목을 우선순위 순으로 나열하고, 매도 시 예상 세금·수수료를 함께 고려해 주세요.

4. **월별 추가 투자 우선순위**
   - 매월 여유 자금이 생길 때 넣을 순서를 1순위부터, 각 순위의 이유와 함께 제시해 주세요.

5. **3년 / 5년 순자산 시나리오**
   - 현재 순자산 ${formatShortCurrency(summary.netAsset)} 기준, **가정한 연 수익률·월 저축액을 명시**하고 낙관·기본·보수 3가지로 예측해 주세요(단정 금지, 어디까지나 가정).`;
    },
  },

  {
    id: "risk",
    label: "리스크·부채 관리",
    sublabel: "부채 비율·집중 리스크·비상금 점검",
    generate: (ctx) => {
      const { summary, data } = ctx;
      const debtRatio = summary.totalValue > 0
        ? (summary.loanBalance / summary.totalValue * 100).toFixed(1) : "0";
      const cashRatio = summary.totalValue > 0
        ? (summary.cashValue / summary.totalValue * 100).toFixed(1) : "0";

      // 가장 비중이 큰 단일 자산 찾기
      const realEstateRatio = summary.totalValue > 0
        ? (summary.realEstateValue / summary.totalValue * 100).toFixed(1) : "0";
      const stockRatio = summary.totalValue > 0
        ? (summary.stockValue / summary.totalValue * 100).toFixed(1) : "0";
      const cryptoRatio = summary.totalValue > 0
        ? (summary.cryptoValue / summary.totalValue * 100).toFixed(1) : "0";

      // 연간 이자 추정 (단순 계산)
      const annualInterest = data.loans.reduce((sum, loan) => {
        return sum + loan.balance * (loan.interestRate / 100);
      }, 0);

      return `${GUARDRAIL}
당신은 한국의 자산 리스크 분석 전문가입니다.
아래 제 자산 현황에서 위험 요소와 부채 구조를 냉정하게 분석하고, 지금 당장 개선할 수 있는 방안을 알려주세요.
${ANALYSIS_DIRECTIVE}${buildDataSection(ctx)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 리스크 분석 요청 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **부채 구조 평가**
   - 현재 부채비율 ${debtRatio}%, 추정 연간 이자 ${formatShortCurrency(Math.round(annualInterest))}가 한국 가계 적정 기준 대비 위험한지·허용 범위인지 판단해 주세요.
   - 대출별 **우선 상환 순서를 표**(대출명 | 금리 | 유동성 | 세금공제 가능 | 상환 우선순위)로 제시해 주세요.
${data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId) ? `
2. **담보대출 연계 리스크 분석**
   - 담보대출 연계 현황의 LTV(담보인정비율)와 담보비율을 평가해 주세요.
   - 부동산·주식·예금 담보 자산의 가격이 하락할 경우 각 대출의 위험 수준을 분석해 주세요.
   - 주식담보대출의 경우 반대매매(마진콜) 발생 가능성과 대응 방안을 알려주세요.
   - 담보대출별 안전 마진(현재 자산가 - 대출잔액)을 계산하고 가장 취약한 항목을 식별해 주세요.
` : ""}
${summary.stockCurrencyGain !== 0 ? `
${data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId) ? "3" : "2"}. **환율 리스크 평가**
   - 현재 환차손익 ${summary.stockCurrencyGain >= 0 ? "+" : ""}${formatShortCurrency(Math.round(summary.stockCurrencyGain))}이 포트폴리오에 미치는 영향을 평가해 주세요.
   - 달러·엔 환율이 각각 10% 변동할 경우 순자산에 미치는 영향을 계산해 주세요.
   - 환위험 헤지가 필요한 수준인지, 필요하다면 현실적인 방법(RP, 환전 타이밍 등)을 알려주세요.
` : ""}

${[data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId), summary.stockCurrencyGain !== 0].filter(Boolean).length + 2}. **집중 리스크 점검**
   - 현재 부동산 ${realEstateRatio}%, 주식 ${stockRatio}%, 코인 ${cryptoRatio}% 비율에서 특정 자산 과집중 문제가 있나요?
   - 단일 부동산 또는 단일 종목이 전체 자산에서 차지하는 비중이 과도하게 높은 항목이 있다면 지적해 주세요.

${[data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId), summary.stockCurrencyGain !== 0].filter(Boolean).length + 3}. **비상금 적정성 평가**
   - 현재 현금·예금 ${formatShortCurrency(summary.cashValue)} (총자산의 ${cashRatio}%)가 비상금으로 충분한가요?
   - 일반적으로 권장하는 비상금 수준(월 생활비 기준)과 비교해 부족하다면 어떻게 채워야 하는지 알려주세요.

${[data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId), summary.stockCurrencyGain !== 0].filter(Boolean).length + 4}. **스트레스 시나리오 (수치로)**
   - ① 금리 +1%p ② 주식·코인 −30% ③ 부동산 −15% 세 경우 각각 순자산 변화액을 계산하고, 버틸 수 있는 수준인지 표로 정리해 주세요.
   - 세 충격이 겹칠 때 가장 먼저 문제가 되는 지점(유동성·마진콜 등)을 짚어주세요.

${[data.loans.some(l => l.linkedRealEstateId || l.linkedStockId || l.linkedCashId), summary.stockCurrencyGain !== 0].filter(Boolean).length + 5}. **즉각 리스크 감소를 위한 3가지 조치**
   - 지금 실행 가능한 것부터, 각 항목에 "기대 효과 · 실행 난이도"를 함께 표기해 우선순위 순으로 알려주세요.`;
    },
  },
];
