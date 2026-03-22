import { AssetData, AssetSummary } from "@/types/asset";
import { formatShortCurrency } from "@/lib/number-utils";

export interface AssetPromptContext {
  data: AssetData;
  summary: AssetSummary;
}

export interface PromptTemplate {
  id: string;
  label: string;
  sublabel: string;
  generate: (ctx: AssetPromptContext) => string;
}

// ─── 데이터 포맷 헬퍼 ────────────────────────────────────────────────────────

const REAL_ESTATE_TYPE: Record<string, string> = {
  apartment: "아파트", house: "주택", land: "토지", commercial: "상가", other: "기타",
};

const STOCK_CATEGORY: Record<string, string> = {
  domestic: "국내", foreign: "해외", irp: "IRP", isa: "ISA", pension: "연금", unlisted: "비상장",
};

const LOAN_TYPE: Record<string, string> = {
  credit: "신용대출", minus: "마이너스통장",
  home_mortgage: "주택담보대출", "mortgage-home": "주택담보대출",
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

function buildStockList(data: AssetData): string {
  if (data.stocks.length === 0) return "  - 등록된 주식 없음";
  return data.stocks.map((item) => {
    const category = STOCK_CATEGORY[item.category] ?? item.category;
    const value = item.quantity * item.currentPrice;
    const cost = item.quantity * item.averagePrice;
    const profit = value - cost;
    const profitRate = cost > 0 ? ((profit / cost) * 100).toFixed(1) : "0.0";
    const sign = profit >= 0 ? "+" : "";
    const currency = item.currency !== "KRW" ? ` (${item.currency})` : "";
    return `  • [${category}] ${item.name}${item.ticker ? ` (${item.ticker})` : ""}${currency}
    평균단가 ${formatShortCurrency(item.averagePrice)} × ${item.quantity}주 | 평가 ${formatShortCurrency(value)} | 손익 ${sign}${profitRate}%`;
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
    return `  • ${item.name} (${type})${item.institution ? ` — ${item.institution}` : ""}
    잔액 ${formatShortCurrency(item.balance)} | 금리 ${item.interestRate}%`;
  }).join("\n");
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

  return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 자산 현황 요약
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

• 총자산:   ${formatShortCurrency(summary.totalValue)}
• 총부채:   ${formatShortCurrency(summary.loanBalance)}${summary.tenantDepositTotal > 0 ? ` + 임차보증금 ${formatShortCurrency(summary.tenantDepositTotal)}` : ""}
• 순자산:   ${formatShortCurrency(summary.netAsset)} (순자산비율 ${netAssetRatio}%)
• 부채비율: ${debtRatio}%
• 전체 투자손익: ${summary.totalProfit >= 0 ? "+" : ""}${formatShortCurrency(summary.totalProfit)} (${summary.totalProfitRate.toFixed(1)}%)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🏠 부동산 (${formatShortCurrency(summary.realEstateValue)}, ${summary.realEstateCount}건 | 손익 ${realEstateProfitRate}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildRealEstateList(data)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📈 주식 (${formatShortCurrency(summary.stockValue)}, ${summary.stockCount}종목 | 손익 ${stockProfitRate}%)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${buildStockList(data)}

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
${buildLoanList(data)}`;
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

      return `당신은 한국의 15년 경력 자산관리 전문가입니다.
아래 제 자산 현황을 보고 현재 포트폴리오를 솔직하게 진단해 주세요.
좋은 말보다는 실제로 개선이 필요한 부분을 명확히 짚어주세요.
${buildDataSection(ctx)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 진단 요청 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **자산 구성 진단**
   - 부동산 / 주식 / 코인 / 현금의 비율이 제 나이와 자산 규모에 적합한가요?
   - 특정 자산에 과도하게 쏠려 있지는 않은지 평가해 주세요.

2. **수익률 분석**
   - 어떤 자산이 포트폴리오에 실질적으로 기여하고, 어떤 자산이 발목을 잡고 있나요?
   - 손실 중인 항목의 원인과 보유 vs 정리 판단 기준을 알려주세요.

3. **지금 당장 해야 할 3가지 행동** (구체적인 실행 항목으로 제시해 주세요)

4. **세금 관점 체크**
   - 현재 구성에서 양도소득세, 금융소득종합과세, IRP·ISA 연말정산 등 세금 측면에서 주의해야 할 사항이 있나요?

5. **전문가로서 한마디**
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

      return `당신은 한국의 자산 증식 전략 전문가입니다.
아래 제 현재 자산을 기반으로 향후 5년 내 순자산을 최대로 늘리기 위한 구체적인 전략을 세워주세요.
막연한 격언이 아니라, 이 데이터에 맞는 구체적인 수치와 실행 순서를 포함해 주세요.
${buildDataSection(ctx)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 전략 수립 요청 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **목표 포트폴리오 배분 제안**
   - 현재 구성 대비 이상적인 목표 배분(%)을 구체적으로 제시해 주세요.
   - 어떤 자산을 줄이고, 어떤 자산을 늘려야 하는지 금액 기준으로 알려주세요.

2. **세제혜택 계좌 최적화** (현재 등록된 계좌: ${taxAccounts})
   - IRP, ISA, 연금저축 등 세제혜택 계좌를 어느 수준까지 채워야 하는지 연간 한도 기준으로 설명해 주세요.
   - 각 계좌에 어떤 ETF/자산을 넣는 것이 세금 측면에서 유리한지 알려주세요.

3. **리밸런싱 실행 계획**
   - 매도 후 재투자가 필요한 종목이 있다면 우선순위 순으로 나열해 주세요.
   - 매도 시 세금 부담도 함께 고려해 주세요.

4. **월별 추가 투자 우선순위**
   - 매월 여유 자금이 생긴다면 어디에 먼저 투자해야 하는지 1순위부터 순서대로 알려주세요.

5. **3년 / 5년 순자산 시나리오**
   - 현재 ${formatShortCurrency(summary.netAsset)} 기준, 낙관·기본·보수 시나리오별 순자산 예측을 간략하게 제시해 주세요.`;
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

      return `당신은 한국의 자산 리스크 분석 전문가입니다.
아래 제 자산 현황에서 위험 요소와 부채 구조를 냉정하게 분석하고, 지금 당장 개선할 수 있는 방안을 알려주세요.
${buildDataSection(ctx)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 리스크 분석 요청 사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **부채 구조 평가**
   - 현재 부채비율 ${debtRatio}%, 추정 연간 이자 부담 ${formatShortCurrency(Math.round(annualInterest))}에 대한 평가를 해주세요.
   - 한국 가계의 적정 부채비율 기준과 비교해 제 상황이 위험한지, 허용 범위인지 알려주세요.
   - 대출별 우선 상환 순서를 금리, 세금 공제 가능 여부, 유동성 등을 종합해 제시해 주세요.

2. **집중 리스크 점검**
   - 현재 부동산 ${realEstateRatio}%, 주식 ${stockRatio}%, 코인 ${cryptoRatio}% 비율에서 특정 자산 과집중 문제가 있나요?
   - 단일 부동산 또는 단일 종목이 전체 자산에서 차지하는 비중이 과도하게 높은 항목이 있다면 지적해 주세요.

3. **비상금 적정성 평가**
   - 현재 현금·예금 ${formatShortCurrency(summary.cashValue)} (총자산의 ${cashRatio}%)가 비상금으로 충분한가요?
   - 일반적으로 권장하는 비상금 수준(월 생활비 기준)과 비교해 부족하다면 어떻게 채워야 하는지 알려주세요.

4. **시나리오별 충격 분석**
   - 금리 1% 추가 상승 시 연간 이자 부담 증가액과 가계 재정에 미치는 영향을 계산해 주세요.
   - 주식·코인 시장이 30% 하락한다면 순자산이 얼마나 줄어드는지, 버틸 수 있는 수준인지 평가해 주세요.

5. **즉각 리스크 감소를 위한 3가지 조치**
   - 지금 당장 실행 가능한 것부터 우선순위 순으로 구체적으로 알려주세요.`;
    },
  },
];
